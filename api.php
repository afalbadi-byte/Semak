<?php
ob_start();

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { http_response_code(200); exit(0); }

$db_host = "localhost";
$db_user = "u817059398_Ahmed";
$db_pass = "Medo@3225";
$db_name = "u817059398_Semak_DB";

mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
    ob_end_clean();
    die(json_encode(["success" => false, "message" => "فشل الاتصال بقاعدة البيانات"]));
}
$conn->set_charset("utf8mb4");

// ─── auto-migrate: status columns on inspections ─────────────────────────────
$conn->query("ALTER TABLE inspections ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT NULL");
$conn->query("ALTER TABLE inspections ADD COLUMN IF NOT EXISTS client_submitted_at DATETIME DEFAULT NULL");

// ─── auto-migrate: WhatsApp bot conversation history ────────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS wa_bot_conversations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    phone       VARCHAR(20) NOT NULL,
    role        ENUM('user','assistant') NOT NULL,
    message     TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_time (phone, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$raw_input  = file_get_contents("php://input");
$input_data = json_decode($raw_input, true);
if (!$input_data) $input_data = [];

$action = '';
if (isset($_GET['action']))        $action = $_GET['action'];
elseif (isset($_POST['action']))   $action = $_POST['action'];
elseif (isset($input_data['action'])) $action = $input_data['action'];

if (isset($input_data['email']) && isset($input_data['password'])) {
    $action = 'login';
}

ob_end_clean();

switch ($action) {

    // ─── المصادقة ───────────────────────────────────────────────────────────

    case 'login':
        $email    = $conn->real_escape_string($input_data['email']);
        $password = $conn->real_escape_string($input_data['password']);
        $res = $conn->query("SELECT * FROM users WHERE email='$email' AND password='$password' LIMIT 1");
        if ($res && $row = $res->fetch_assoc()) {
            unset($row['password']);
            echo json_encode(["success" => true, "data" => $row]);
        } else {
            echo json_encode(["success" => false, "message" => "البريد الإلكتروني أو كلمة المرور غير صحيحة"]);
        }
        break;

    // ─── تسجيل دخول العملاء (رقم الوحدة + الجوال) — احتياطي ──────────────────
    case 'customer_login':
        $unit  = $conn->real_escape_string(trim($input_data['unit_code'] ?? ''));
        $phone = preg_replace('/\D/', '', $input_data['phone'] ?? '');
        $phone = ltrim($phone, '0');
        if (substr($phone, 0, 3) === '966') $phone = substr($phone, 3);
        if (!$unit || !$phone) { echo json_encode(['success' => false, 'message' => 'بيانات ناقصة']); break; }
        $res = $conn->query("SELECT owner_name as name, owner_phone as phone, unit_code as unit FROM owners WHERE unit_code = '$unit' LIMIT 1");
        if (!$res || $res->num_rows === 0) { echo json_encode(['success' => false, 'message' => 'الوحدة غير موجودة أو غير مسجلة']); break; }
        $owner   = $res->fetch_assoc();
        $dbPhone = preg_replace('/\D/', '', $owner['phone']);
        $dbPhone = ltrim($dbPhone, '0');
        if (substr($dbPhone, 0, 3) === '966') $dbPhone = substr($dbPhone, 3);
        if ($phone === $dbPhone) {
            echo json_encode(['success' => true, 'data' => ['name' => $owner['name'], 'phone' => $owner['phone'], 'unit' => $owner['unit']]]);
        } else {
            echo json_encode(['success' => false, 'message' => 'رقم الجوال غير مطابق']);
        }
        break;

    // ─── إرسال OTP عبر واتساب ──────────────────────────────────────────────
    case 'send_otp':
        $unit = strtoupper($conn->real_escape_string(trim($input_data['unit_code'] ?? '')));

        if (!$unit) { echo json_encode(['success' => false, 'message' => 'يرجى إدخال رقم الوحدة']); break; }

        // جلب بيانات المالك من قاعدة البيانات
        $res = $conn->query("SELECT owner_name, owner_phone FROM owners WHERE unit_code = '$unit' LIMIT 1");
        if (!$res || $res->num_rows === 0) { echo json_encode(['success' => false, 'message' => 'رقم الوحدة غير مسجل، تواصل مع الإدارة']); break; }
        $owner = $res->fetch_assoc();

        $dbPhone = preg_replace('/\D/', '', $owner['owner_phone']);
        $dbPhone = ltrim($dbPhone, '0');
        if (substr($dbPhone, 0, 3) === '966') $dbPhone = substr($dbPhone, 3);
        if (!$dbPhone) { echo json_encode(['success' => false, 'message' => 'لا يوجد رقم جوال مسجل لهذه الوحدة']); break; }
        $phone = $dbPhone;

        // إنشاء جدول OTP إذا لم يكن موجوداً
        $conn->query("CREATE TABLE IF NOT EXISTS otp_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            unit_code VARCHAR(20) NOT NULL,
            otp_code VARCHAR(10) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_unit (unit_code)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        // حذف OTP القديمة لهذه الوحدة
        $conn->query("DELETE FROM otp_sessions WHERE unit_code = '$unit'");

        // توليد رمز عشوائي 6 أرقام
        $otp_code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        $expires  = date('Y-m-d H:i:s', time() + 600); // صالح 10 دقائق
        $conn->query("INSERT INTO otp_sessions (unit_code, otp_code, expires_at) VALUES ('$unit', '$otp_code', '$expires')");

        // إرسال رمز التحقق عبر واتساب (Mottasl API — قالب semak_request_ref)
        $wa_to   = '966' . $phone;
        $wa_name = $owner['owner_name'];

        $mottasl_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZSwiaHR0cHM6Ly9oYXN1cmEuaW8vand0L2NsYWltcyI6eyJ4LWF2Yy1hcGlrZXktaWQiOiI0MzdmYjcxMC1mYjE1LTRjZDgtOWY4NC1jY2RkNDRmNmFmNGMiLCJ4LWF2Yy1hcGlrZXktc2NvcGUiOiJpbnNlcnQiLCJ4LWF2Yy1ob3N0LWlkIjoiZjNjZWZhMGUtYmQyYi00NjY0LWE5MzUtZmY5ZTc4MDY3MGRmIiwieC1hdmMtcGxhdGZvcm0taWQiOiJhLmYuYWxiYWRpQGdtYWlsLmNvbSIsIngtYXZjLXBsYXRmb3JtLXR5cGUiOiJhdm9jYWRvIiwieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInN1cGVyYWRtaW4iXSwieC1oYXN1cmEtYnVzaW5lc3MtaWQiOiI5OTBmMmU3Mi00NDY4LTQ4ZmQtODAzMi1mODY1ZGI1ODdlZjYiLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXByb2ZpbGUtaWQiOiI5OTE0NjE4IiwieC1oYXN1cmEtdXNlci1pZCI6Ijk5MTQ2MTgifSwiaWF0IjoxNzc4NzY3MTQ2LCJpc3MiOiJhdm9jYWRvLWNvcmUiLCJuYW1lIjoiQWhtZWQiLCJzdWIiOiI5OTE0NjE4In0.FtRdRnpdvZT6Xji2kPchvqw2AaOnp6ISYvE7KbICEwo';

        // ① الإرسال عبر قالب semak_request_ref ({{1}}=الاسم، {{2}}=رقم الوحدة، {{3}}=الرمز)
        //    القالب يعمل حتى خارج نافذة الـ 24 ساعة بعد الموافقة عليه
        $template_payload = json_encode([
            'to'   => $wa_to,
            'type' => 'template',
            'template' => [
                'name'     => 'semak_request_ref',
                'language' => ['code' => 'ar'],
                'components' => [[
                    'type'       => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => $wa_name],
                        ['type' => 'text', 'text' => $unit],
                        ['type' => 'text', 'text' => $otp_code],
                    ],
                ]],
            ],
        ]);

        $ch = curl_init('https://api.mottasl.ai/v1/message/send?create=true');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $template_payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer {$mottasl_key}"],
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $wa_resp   = curl_exec($ch);
        $wa_status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        // ② احتياطي: رسالة نصية مباشرة إن فشل القالب (ضمن نافذة 24 ساعة)
        if ($wa_status !== 200 && $wa_status !== 201) {
            $wa_body = "🔐 سماك العقارية\n\nأهلاً {$wa_name}، رمز المتابعة لوحدة {$unit}:\n\n{$otp_code}\n\nصالح 10 دقائق.";
            $ch2 = curl_init('https://api.mottasl.ai/v1/message/send');
            curl_setopt_array($ch2, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => json_encode(['to' => $wa_to, 'type' => 'text', 'text' => ['body' => $wa_body]]),
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer {$mottasl_key}"],
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_SSL_VERIFYPEER => false,
            ]);
            curl_exec($ch2);
            curl_close($ch2);
        }

        // إخفاء جزء من رقم الجوال للعرض فقط
        $masked = substr($dbPhone, 0, 3) . ' **** ' . substr($dbPhone, -3);
        echo json_encode(['success' => true, 'expires_in' => 600, 'masked_phone' => $masked]);
        break;

    // ─── التحقق من OTP ──────────────────────────────────────────────────────
    case 'verify_otp':
        $unit = strtoupper($conn->real_escape_string(trim($input_data['unit_code'] ?? '')));
        $otp  = $conn->real_escape_string(trim($input_data['otp'] ?? ''));
        if (!$unit || !$otp) { echo json_encode(['success' => false, 'message' => 'بيانات ناقصة']); break; }

        $now = date('Y-m-d H:i:s');
        $res = $conn->query("SELECT id FROM otp_sessions WHERE unit_code = '$unit' AND otp_code = '$otp' AND expires_at > '$now' LIMIT 1");
        if (!$res || $res->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'الرمز غير صحيح أو انتهت صلاحيته']);
            break;
        }

        // حذف الرمز بعد الاستخدام
        $conn->query("DELETE FROM otp_sessions WHERE unit_code = '$unit'");

        // إرجاع بيانات العميل
        $owner_res = $conn->query("SELECT owner_name as name, owner_phone as phone, unit_code as unit FROM owners WHERE unit_code = '$unit' LIMIT 1");
        $owner_data = $owner_res ? $owner_res->fetch_assoc() : null;
        if (!$owner_data) { echo json_encode(['success' => false, 'message' => 'خطأ في استرجاع بيانات الملك']); break; }
        echo json_encode(['success' => true, 'data' => $owner_data]);
        break;

    // ─── المشاريع والوحدات ──────────────────────────────────────────────────

    case 'get_projects_data':
        $projects = [];
        $p_query = $conn->query("SELECT * FROM projects ORDER BY id DESC");
        if ($p_query) {
            while ($p_row = $p_query->fetch_assoc()) {
                $proj_id = $p_row['id'];
                $u_query = $conn->query("SELECT u.id, u.unit_code, u.spaces, u.status, o.id as owner_id, o.owner_name, o.owner_phone, o.owner_email FROM units u LEFT JOIN owners o ON u.unit_code = o.unit_code WHERE u.project_id = $proj_id ORDER BY u.id ASC");
                $units_details = [];
                $units_basic   = [];
                if ($u_query) {
                    while ($u_row = $u_query->fetch_assoc()) {
                        $decoded = json_decode($u_row['spaces'], true);
                        $u_row['spaces'] = is_array($decoded) ? $decoded : [];
                        $units_details[] = $u_row;
                        $units_basic[]   = $u_row['unit_code'];
                    }
                }
                $p_row['units_details'] = $units_details;
                $p_row['units']         = $units_basic;
                $projects[] = $p_row;
            }
        }
        echo json_encode(["success" => true, "data" => $projects]);
        break;

    case 'get_units_status':
        $res  = $conn->query("SELECT unit_code FROM owners");
        $sold = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $sold[$row['unit_code']] = 'مباعة'; } }
        echo json_encode(['success' => true, 'data' => $sold]);
        break;

    case 'add_project':
        $name = $conn->real_escape_string($input_data['name']);
        $desc = $conn->real_escape_string($input_data['description'] ?? '');
        $conn->query("INSERT INTO projects (name, description) VALUES ('$name', '$desc')");
        echo json_encode(["success" => true]);
        break;

    case 'update_project_info':
        $id     = (int)$input_data['id'];
        $name   = $conn->real_escape_string($input_data['name']);
        $desc   = $conn->real_escape_string($input_data['description']);
        $status = $conn->real_escape_string($input_data['status']);
        $conn->query("UPDATE projects SET name='$name', description='$desc', status='$status' WHERE id=$id");
        echo json_encode(["success" => true]);
        break;

    case 'add_unit_card':
        $projId   = (int)$input_data['project_id'];
        $unitCode = $conn->real_escape_string($input_data['unit_code']);
        $spaces   = json_encode([], JSON_UNESCAPED_UNICODE);
        $check    = $conn->query("SELECT id FROM units WHERE project_id=$projId AND unit_code='$unitCode'");
        if ($check->num_rows > 0) { echo json_encode(["success" => false, "message" => "هذه الوحدة موجودة مسبقاً"]); break; }
        $conn->query("INSERT INTO units (project_id, unit_code, spaces, status) VALUES ($projId, '$unitCode', '$spaces', 'متاح')");
        echo json_encode(["success" => true, "unit_id" => $conn->insert_id]);
        break;

    case 'update_unit_spaces':
        $unitId = (int)$input_data['unit_id'];
        $spaces = $conn->real_escape_string(json_encode($input_data['spaces'], JSON_UNESCAPED_UNICODE));
        $conn->query("UPDATE units SET spaces = '$spaces' WHERE id = $unitId");
        echo json_encode(["success" => true]);
        break;

    case 'update_unit_status':
        $unitId = (int)$input_data['unit_id'];
        $allowed = ['متاح', 'مباعة', 'محجوز'];
        $status  = $input_data['status'] ?? '';
        if (!in_array($status, $allowed)) { echo json_encode(["success" => false, "message" => "حالة غير صالحة"]); break; }
        $status = $conn->real_escape_string($status);
        $conn->query("UPDATE units SET status = '$status' WHERE id = $unitId");
        echo json_encode(["success" => true]);
        break;

    case 'delete_unit_card':
        $unitId = (int)$input_data['unit_id'];
        $conn->query("DELETE FROM units WHERE id = $unitId");
        echo json_encode(["success" => true]);
        break;

    case 'duplicate_project':
        $orig_id = (int)$input_data['project_id'];
        $res = $conn->query("SELECT * FROM projects WHERE id = $orig_id");
        if ($row = $res->fetch_assoc()) {
            $newName = $conn->real_escape_string($row['name'] . " (نسخة)");
            $newDesc = $conn->real_escape_string($row['description']);
            $status  = $conn->real_escape_string($row['status']);
            $conn->query("INSERT INTO projects (name, description, status) VALUES ('$newName', '$newDesc', '$status')");
            $new_proj_id = $conn->insert_id;
            $u_res = $conn->query("SELECT * FROM units WHERE project_id = $orig_id");
            while ($u_row = $u_res->fetch_assoc()) {
                $u_code   = $conn->real_escape_string($u_row['unit_code'] . "-C");
                $u_spaces = $conn->real_escape_string($u_row['spaces']);
                $conn->query("INSERT INTO units (project_id, unit_code, spaces, status) VALUES ($new_proj_id, '$u_code', '$u_spaces', 'متاح')");
            }
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false]);
        }
        break;

    case 'duplicate_unit':
        $unit_id  = (int)$input_data['unit_id'];
        $new_code = $conn->real_escape_string($input_data['new_unit_code']);
        $res = $conn->query("SELECT * FROM units WHERE id = $unit_id");
        if ($row = $res->fetch_assoc()) {
            $proj_id = $row['project_id'];
            $spaces  = $conn->real_escape_string($row['spaces']);
            $check   = $conn->query("SELECT id FROM units WHERE project_id=$proj_id AND unit_code='$new_code'");
            if ($check->num_rows > 0) { echo json_encode(["success" => false, "message" => "رقم الوحدة الجديد مستخدم مسبقاً"]); break; }
            $conn->query("INSERT INTO units (project_id, unit_code, spaces, status) VALUES ($proj_id, '$new_code', '$spaces', 'متاح')");
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false]);
        }
        break;

    // ─── الملاك ─────────────────────────────────────────────────────────────

    case 'add_owner':
        $unit  = $conn->real_escape_string($input_data['unit_code']);
        $name  = $conn->real_escape_string($input_data['name']);
        $phone = $conn->real_escape_string($input_data['phone']);
        $email = $conn->real_escape_string($input_data['email']);
        $conn->query("INSERT INTO owners (unit_code, owner_name, owner_phone, owner_email) VALUES ('$unit', '$name', '$phone', '$email')");
        $conn->query("UPDATE units SET status = 'مباعة' WHERE unit_code = '$unit'");
        echo json_encode(["success" => true]);
        break;

    case 'get_owners':
        $res  = $conn->query("SELECT o.*, p.name as project_name FROM owners o LEFT JOIN units u ON o.unit_code = u.unit_code LEFT JOIN projects p ON u.project_id = p.id ORDER BY o.id DESC");
        $list = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $list[] = $row; } }
        echo json_encode(["success" => true, "data" => $list]);
        break;

    case 'get_unit_owner':
        $unit_code = isset($_GET['unit_code']) ? $conn->real_escape_string($_GET['unit_code']) : '';
        $res = $conn->query("SELECT owner_name as name, owner_phone as phone, unit_code as unit FROM owners WHERE unit_code = '$unit_code' LIMIT 1");
        if ($res && $row = $res->fetch_assoc()) {
            echo json_encode(["success" => true, "data" => $row]);
        } else {
            echo json_encode(["success" => false, "data" => ["name" => "غير مسجل", "phone" => "", "unit" => $unit_code]]);
        }
        break;

    case 'update_owner':
        $id       = (int)$input_data['id'];
        $name     = $conn->real_escape_string($input_data['name']);
        $phone    = $conn->real_escape_string($input_data['phone']);
        $email    = $conn->real_escape_string($input_data['email']);
        $new_unit = $conn->real_escape_string($input_data['unit_code']);
        $old_res  = $conn->query("SELECT unit_code FROM owners WHERE id=$id");
        if ($old_res && $old_row = $old_res->fetch_assoc()) {
            $old_unit = $old_row['unit_code'];
            if ($old_unit !== $new_unit) {
                $conn->query("UPDATE units SET status = 'متاح'  WHERE unit_code = '$old_unit'");
                $conn->query("UPDATE units SET status = 'مباعة' WHERE unit_code = '$new_unit'");
            }
        }
        $conn->query("UPDATE owners SET owner_name='$name', owner_phone='$phone', owner_email='$email', unit_code='$new_unit' WHERE id=$id");
        echo json_encode(["success" => true]);
        break;

    case 'delete_owner':
        $id  = (int)$input_data['id'];
        $res = $conn->query("SELECT unit_code FROM owners WHERE id=$id");
        if ($res && $row = $res->fetch_assoc()) {
            $unit = $row['unit_code'];
            $conn->query("UPDATE units SET status='متاح' WHERE unit_code='$unit'");
        }
        $conn->query("DELETE FROM owners WHERE id=$id");
        echo json_encode(["success" => true]);
        break;

    // ─── الفحص والتسليم ─────────────────────────────────────────────────────

    case 'get_all_inspections':
        $res  = $conn->query("SELECT * FROM inspections ORDER BY id DESC");
        $data = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $data[] = $row; } }
        echo json_encode(["success" => true, "data" => $data]);
        break;

    case 'get_inspection':
        $unit = $conn->real_escape_string($_GET['unit']);
        $res  = $conn->query("SELECT id, unit, progress, status, client_submitted_at FROM inspections WHERE unit = '$unit' LIMIT 1");
        if ($res && $row = $res->fetch_assoc()) {
            echo json_encode(["success" => true, "data" => $row]);
        } else {
            echo json_encode(["success" => false]);
        }
        break;

    case 'set_inspection_status':
        $unit   = $conn->real_escape_string($input_data['unit'] ?? '');
        $status = $conn->real_escape_string($input_data['status'] ?? '');
        if (!$unit || !$status) { echo json_encode(["success" => false, "message" => "بيانات ناقصة"]); break; }
        $conn->query("UPDATE inspections SET status='$status' WHERE unit='$unit'");
        echo json_encode(["success" => true]);
        break;

    case 'save_inspection':
        $unit      = $conn->real_escape_string($input_data['unit']);
        $evaluator = (int)$input_data['evaluator_id'];
        $insData   = $conn->real_escape_string($input_data['inspection_data']);
        $progress  = (int)$input_data['progress'];
        $check     = $conn->query("SELECT id FROM inspections WHERE unit = '$unit'");
        if ($check && $check->num_rows > 0) {
            $conn->query("UPDATE inspections SET inspection_data='$insData', progress=$progress WHERE unit='$unit'");
        } else {
            $conn->query("INSERT INTO inspections (unit, evaluator_id, inspection_data, progress) VALUES ('$unit', $evaluator, '$insData', $progress)");
        }
        echo json_encode(["success" => true]);
        break;

    case 'submit_client_inspection':
        $unit            = $conn->real_escape_string($input_data['unit']);
        $owner_name      = $conn->real_escape_string($input_data['owner_name']);
        $owner_phone     = $conn->real_escape_string($input_data['owner_phone']);
        $inspection_data = $conn->real_escape_string(json_encode($input_data['inspection_data']));
        $progress        = (int)$input_data['progress'];
        $check = $conn->query("SELECT id FROM inspections WHERE unit = '$unit'");
        $newStatus = ($progress == 100) ? 'handed_over' : 'client_submitted';
        if ($check->num_rows > 0) {
            $conn->query("UPDATE inspections SET inspection_data='$inspection_data', progress=$progress, status='$newStatus', client_submitted_at=NOW() WHERE unit='$unit'");
        } else {
            $conn->query("INSERT INTO inspections (unit, evaluator_id, inspection_data, progress, status, client_submitted_at) VALUES ('$unit', 0, '$inspection_data', $progress, '$newStatus', NOW())");
        }
        if ($progress == 100) {
            $checkOwner = $conn->query("SELECT id FROM owners WHERE unit_code = '$unit'");
            if ($checkOwner->num_rows > 0) {
                $conn->query("UPDATE owners SET owner_name='$owner_name', owner_phone='$owner_phone', created_at=CURRENT_TIMESTAMP WHERE unit_code='$unit'");
            } else {
                $conn->query("INSERT INTO owners (unit_code, owner_name, owner_phone) VALUES ('$unit', '$owner_name', '$owner_phone')");
            }
        }
        echo json_encode(["success" => true]);
        break;

    case 'handover_unit':
        $unit_code = $conn->real_escape_string($input_data['unit']);
        $name      = $conn->real_escape_string($input_data['owner_name']);
        $phone     = $conn->real_escape_string($input_data['owner_phone']);
        $email     = $conn->real_escape_string($input_data['owner_email'] ?? '');
        $check     = $conn->query("SELECT id FROM owners WHERE unit_code = '$unit_code'");
        if ($check->num_rows > 0) {
            $sql = "UPDATE owners SET owner_name='$name', owner_phone='$phone', owner_email='$email', created_at=CURRENT_TIMESTAMP WHERE unit_code='$unit_code'";
        } else {
            $sql = "INSERT INTO owners (unit_code, owner_name, owner_phone, owner_email) VALUES ('$unit_code', '$name', '$phone', '$email')";
        }
        if ($conn->query($sql)) {
            echo json_encode(["success" => true, "message" => "تم اعتماد المالك وبدء الضمان"]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
        break;

    // ─── الموظفون ────────────────────────────────────────────────────────────

    case 'get_users':
        $res   = $conn->query("SELECT id, name, email, role, job, phone, department, permissions FROM users ORDER BY id DESC");
        $users = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $users[] = $row; } }
        echo json_encode(["success" => true, "data" => $users]);
        break;

    case 'add_user':
        $name     = $conn->real_escape_string($input_data['name'] ?? '');
        $email    = $conn->real_escape_string($input_data['email'] ?? '');
        $password = $conn->real_escape_string($input_data['password'] ?? '');
        $role     = $conn->real_escape_string($input_data['role'] ?? 'employee');
        $check    = $conn->query("SELECT id FROM users WHERE email='$email'");
        if ($check && $check->num_rows > 0) { echo json_encode(["success" => false, "message" => "هذا البريد موجود مسبقاً"]); break; }
        $sql = "INSERT INTO users (name, email, password, role, job, phone, department, permissions) VALUES ('$name', '$email', '$password', '$role', '', '', '', '[]')";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
        break;

    case 'update_user':
        $id    = (int)$input_data['id'];
        $name  = $conn->real_escape_string($input_data['name']);
        $email = $conn->real_escape_string($input_data['email']);
        $role  = $conn->real_escape_string($input_data['role']);
        $sql   = "UPDATE users SET name='$name', email='$email', role='$role'";
        if (!empty($input_data['password'])) {
            $password = $conn->real_escape_string($input_data['password']);
            $sql .= ", password='$password'";
        }
        $sql .= " WHERE id=$id";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
        break;

    case 'delete_user':
        $id = (int)$input_data['id'];
        $conn->query("DELETE FROM users WHERE id=$id");
        echo json_encode(["success" => true]);
        break;

    // ─── الصيانة ─────────────────────────────────────────────────────────────

    case 'get_maintenance':
        $res     = $conn->query("SELECT * FROM maintenance ORDER BY id DESC");
        $tickets = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $tickets[] = $row; } }
        echo json_encode($tickets);
        break;

    case 'add_maintenance':
        $name    = $conn->real_escape_string($input_data['name']   ?? '');
        $phone   = $conn->real_escape_string($input_data['phone']  ?? '');
        $unit    = $conn->real_escape_string($input_data['unit']   ?? '');
        $type    = $conn->real_escape_string($input_data['type']   ?? '');
        $descrip = $conn->real_escape_string($input_data['desc']   ?? '');
        $date    = date('Y-m-d H:i:s');
        $status  = "قيد الانتظار";
        $sql     = "INSERT INTO maintenance (name, phone, unit, type, descrip, status, date) VALUES ('$name', '$phone', '$unit', '$type', '$descrip', '$status', '$date')";
        if ($conn->query($sql)) {
            $new_id = $conn->insert_id;
            $wa_token    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZSwiaHR0cHM6Ly9oYXN1cmEuaW8vand0L2NsYWltcyI6eyJ4LWF2Yy1hcGlrZXktaWQiOiI0MzdmYjcxMC1mYjE1LTRjZDgtOWY4NC1jY2RkNDRmNmFmNGMiLCJ4LWF2Yy1hcGlrZXktc2NvcGUiOiJpbnNlcnQiLCJ4LWF2Yy1ob3N0LWlkIjoiZjNjZWZhMGUtYmQyYi00NjY0LWE5MzUtZmY5ZTc4MDY3MGRmIiwieC1hdmMtcGxhdGZvcm0taWQiOiJhLmYuYWxiYWRpQGdtYWlsLmNvbSIsIngtYXZjLXBsYXRmb3JtLXR5cGUiOiJhdm9jYWRvIiwieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInN1cGVyYWRtaW4iXSwieC1oYXN1cmEtYnVzaW5lc3MtaWQiOiI5OTBmMmU3Mi00NDY4LTQ4ZmQtODAzMi1mODY1ZGI1ODdlZjYiLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXByb2ZpbGUtaWQiOiI5OTE0NjE4IiwieC1oYXN1cmEtdXNlci1pZCI6Ijk5MTQ2MTgifSwiaWF0IjoxNzc4NzY3MTQ2LCJpc3MiOiJhdm9jYWRvLWNvcmUiLCJuYW1lIjoiQWhtZWQiLCJzdWIiOiI5OTE0NjE4In0.FtRdRnpdvZT6Xji2kPchvqw2AaOnp6ISYvE7KbICEwo";
            $wa_headers  = ["Content-Type: application/json", "Authorization: Bearer $wa_token"];
            $admin_phone = "966550163121";

            // ① إشعار الإدارة (قالب semak_admin_maintenance)
            $ch = curl_init("https://api.mottasl.ai/v1/message/send?create=true");
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode(["to" => $admin_phone, "type" => "template",
                    "template" => ["template_id" => "semak_admin_maintenance", "language" => "ar",
                        "argument" => ["BODY" => [$name, (string)$new_id, $type]]]]),
                CURLOPT_HTTPHEADER => $wa_headers, CURLOPT_TIMEOUT => 5]);
            curl_exec($ch); curl_close($ch);

            // ② تأكيد استلام الطلب للعميل (قالب semak_maint_received)
            if (!empty($phone)) {
                $client_phone = preg_replace('/\D/', '', $phone);
                $client_phone = ltrim($client_phone, '0');
                if (substr($client_phone, 0, 3) !== '966') $client_phone = '966' . $client_phone;
                if (strlen($client_phone) >= 12) {
                    $ch2 = curl_init("https://api.mottasl.ai/v1/message/send?create=true");
                    curl_setopt_array($ch2, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                        CURLOPT_POSTFIELDS => json_encode(["to" => $client_phone, "type" => "template",
                            "template" => ["template_id" => "semak_maint_received", "language" => "ar",
                                "argument" => ["BODY" => [$name, (string)$new_id, $type]]]]),
                        CURLOPT_HTTPHEADER => $wa_headers, CURLOPT_TIMEOUT => 5]);
                    curl_exec($ch2); curl_close($ch2);
                }
            }
            echo json_encode(["success" => true, "id" => $new_id]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
        break;

    case 'update_maintenance':
        $ticket_id = (int)$input_data['ticket_id'];
        $value     = $conn->real_escape_string($input_data['new_value']);
        $allowed   = ['status', 'technician', 'descrip', 'otp'];
        $field     = in_array($input_data['field_name'] ?? '', $allowed) ? $input_data['field_name'] : '';
        if (!$field) { echo json_encode(["success" => false, "message" => "حقل غير مسموح"]); break; }
        $sql = "UPDATE maintenance SET `$field`='$value'";
        if (isset($input_data['otp'])) {
            $otp  = $conn->real_escape_string($input_data['otp']);
            $sql .= ", otp='$otp'";
        }
        $sql .= " WHERE id=$ticket_id";
        $conn->query($sql);

        // إرسال إشعار واتساب للعميل عند تغيير الحالة فقط
        if ($field === 'status') {
            $t = $conn->query("SELECT * FROM maintenance WHERE id=$ticket_id");
            if ($t && $row = $t->fetch_assoc()) {
                $client_phone = preg_replace('/\D/', '', $row['phone']);
                $client_phone = ltrim($client_phone, '0');
                if (substr($client_phone, 0, 3) !== '966') $client_phone = '966' . $client_phone;
                if (strlen($client_phone) < 12) break; // رقم غير صالح
                $tech  = (!empty($row['technician']) && $row['technician'] !== 'لم يتم التعيين') ? $row['technician'] : 'سيتم التحديد';
                $sched = !empty($row['date']) ? $row['date'] : 'سيتم التأكيد';
                $otp_val = !empty($row['otp']) ? $row['otp'] : '—';
                // قالب semak_maint_update: [name, ticket_id, status]
                $wa_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZSwiaHR0cHM6Ly9oYXN1cmEuaW8vand0L2NsYWltcyI6eyJ4LWF2Yy1hcGlrZXktaWQiOiI0MzdmYjcxMC1mYjE1LTRjZDgtOWY4NC1jY2RkNDRmNmFmNGMiLCJ4LWF2Yy1hcGlrZXktc2NvcGUiOiJpbnNlcnQiLCJ4LWF2Yy1ob3N0LWlkIjoiZjNjZWZhMGUtYmQyYi00NjY0LWE5MzUtZmY5ZTc4MDY3MGRmIiwieC1hdmMtcGxhdGZvcm0taWQiOiJhLmYuYWxiYWRpQGdtYWlsLmNvbSIsIngtYXZjLXBsYXRmb3JtLXR5cGUiOiJhdm9jYWRvIiwieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInN1cGVyYWRtaW4iXSwieC1oYXN1cmEtYnVzaW5lc3MtaWQiOiI5OTBmMmU3Mi00NDY4LTQ4ZmQtODAzMi1mODY1ZGI1ODdlZjYiLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXByb2ZpbGUtaWQiOiI5OTE0NjE4IiwieC1oYXN1cmEtdXNlci1pZCI6Ijk5MTQ2MTgifSwiaWF0IjoxNzc4NzY3MTQ2LCJpc3MiOiJhdm9jYWRvLWNvcmUiLCJuYW1lIjoiQWhtZWQiLCJzdWIiOiI5OTE0NjE4In0.FtRdRnpdvZT6Xji2kPchvqw2AaOnp6ISYvE7KbICEwo";
                $ch = curl_init("https://api.mottasl.ai/v1/message/send?create=true");
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST           => true,
                    CURLOPT_POSTFIELDS     => json_encode(["to" => $client_phone, "type" => "template",
                        "template" => ["template_id" => "semak_maint_update", "language" => "ar",
                            "argument" => ["BODY" => [$row['name'], (string)$row['id'], $value]]]]),
                    CURLOPT_HTTPHEADER     => ["Content-Type: application/json", "Authorization: Bearer $wa_token"],
                    CURLOPT_TIMEOUT        => 5,
                ]);
                curl_exec($ch);
                curl_close($ch);
            }
        }
        echo json_encode(["success" => true]);
        break;

    case 'get_customer_tickets':
        $unit = isset($_GET['unit']) ? $conn->real_escape_string($_GET['unit']) : '';
        if (!$unit) { echo json_encode(['success' => false, 'data' => []]); break; }
        $res     = $conn->query("SELECT id, type, status, date, descrip FROM maintenance WHERE unit='$unit' ORDER BY id DESC");
        $tickets = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $tickets[] = $row; } }
        echo json_encode(['success' => true, 'data' => $tickets]);
        break;

    // ─── المهتمون (Leads) ────────────────────────────────────────────────────

    case 'get_leads':
        $res   = $conn->query("SELECT * FROM leads ORDER BY id DESC");
        $leads = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $leads[] = $row; } }
        echo json_encode($leads);
        break;

    case 'add_lead':
        $name     = $conn->real_escape_string($input_data['name']     ?? '');
        $phone    = $conn->real_escape_string($input_data['phone']    ?? '');
        $interest = $conn->real_escape_string($input_data['interest'] ?? '');
        $source   = $conn->real_escape_string($input_data['source']   ?? '');
        $status   = "جديد";
        $sql = "INSERT INTO leads (name, phone, interest, source, unit, status) VALUES ('$name', '$phone', '$interest', '$source', '$interest', '$status')";
        if ($conn->query($sql)) {
            $new_id = $conn->insert_id;
            // إرسال إشعار واتساب للإدارة تلقائياً
            $wa_token  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZSwiaHR0cHM6Ly9oYXN1cmEuaW8vand0L2NsYWltcyI6eyJ4LWF2Yy1hcGlrZXktaWQiOiI0MzdmYjcxMC1mYjE1LTRjZDgtOWY4NC1jY2RkNDRmNmFmNGMiLCJ4LWF2Yy1hcGlrZXktc2NvcGUiOiJpbnNlcnQiLCJ4LWF2Yy1ob3N0LWlkIjoiZjNjZWZhMGUtYmQyYi00NjY0LWE5MzUtZmY5ZTc4MDY3MGRmIiwieC1hdmMtcGxhdGZvcm0taWQiOiJhLmYuYWxiYWRpQGdtYWlsLmNvbSIsIngtYXZjLXBsYXRmb3JtLXR5cGUiOiJhdm9jYWRvIiwieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInN1cGVyYWRtaW4iXSwieC1oYXN1cmEtYnVzaW5lc3MtaWQiOiI5OTBmMmU3Mi00NDY4LTQ4ZmQtODAzMi1mODY1ZGI1ODdlZjYiLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXByb2ZpbGUtaWQiOiI5OTE0NjE4IiwieC1oYXN1cmEtdXNlci1pZCI6Ijk5MTQ2MTgifSwiaWF0IjoxNzc4NzY3MTQ2LCJpc3MiOiJhdm9jYWRvLWNvcmUiLCJuYW1lIjoiQWhtZWQiLCJzdWIiOiI5OTE0NjE4In0.FtRdRnpdvZT6Xji2kPchvqw2AaOnp6ISYvE7KbICEwo";
            $admin_phone = "966550163121";
            // قالب semak_admin_lead: [name, phone, interest]
            $wa_payload = json_encode(["to" => $admin_phone, "type" => "template",
                "template" => ["template_id" => "semak_admin_lead", "language" => "ar",
                    "argument" => ["BODY" => [$name, $phone, $interest]]]]);
            $ch = curl_init("https://api.mottasl.ai/v1/message/send?create=true");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $wa_payload,
                CURLOPT_HTTPHEADER     => ["Content-Type: application/json", "Authorization: Bearer $wa_token"],
                CURLOPT_TIMEOUT        => 5,
            ]);
            curl_exec($ch);
            curl_close($ch);

            echo json_encode(["success" => true, "id" => $new_id]);
        } else {
            $notes = $conn->real_escape_string("الوحدة: $interest | المصدر: $source");
            $sql2  = "INSERT INTO leads (name, phone, status, notes) VALUES ('$name', '$phone', '$status', '$notes')";
            if ($conn->query($sql2)) {
                echo json_encode(["success" => true, "id" => $conn->insert_id]);
            } else {
                echo json_encode(["success" => false, "message" => $conn->error]);
            }
        }
        break;

    case 'update_lead_status':
        $id     = (int)$input_data['id'];
        $status = $conn->real_escape_string($input_data['status']);
        $sql    = "UPDATE leads SET status='$status'";
        if (!empty($input_data['notes'])) {
            $notes = $conn->real_escape_string($input_data['notes']);
            $sql  .= ", notes='$notes'";
        }
        $sql .= " WHERE id=$id";
        $conn->query($sql);
        echo json_encode(["success" => true]);
        break;

    case 'delete_lead':
        $id = (int)$input_data['id'];
        $conn->query("DELETE FROM leads WHERE id=$id");
        echo json_encode(["success" => true]);
        break;

    // ─── واتساب ─────────────────────────────────────────────────────────────

    case 'update_wa_status':
        $id   = intval($input_data['id']   ?? 0);
        $type = $input_data['type'] ?? '';
        if (!$id || !in_array($type, ['lead', 'maintenance'])) { echo json_encode(['success' => false]); break; }
        $table = $type === 'lead' ? 'leads' : 'maintenance';
        $conn->query("UPDATE `$table` SET wa_sent = 1 WHERE id = $id");
        echo json_encode(['success' => true]);
        break;

    // ─── الخطابات والقوالب ───────────────────────────────────────────────────

    case 'get_templates':
        $res       = $conn->query("SELECT * FROM templates ORDER BY id DESC");
        $templates = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $templates[] = $row; } }
        echo json_encode($templates);
        break;

    // ─── قوالب الفحص ────────────────────────────────────────────────────────

    case 'get_inspection_template':
        $res = $conn->query("SELECT setting_value FROM system_settings WHERE setting_key = 'inspection_template'");
        if ($res && $res->num_rows > 0) {
            $row = $res->fetch_assoc();
            echo json_encode(["success" => true, "data" => json_decode($row['setting_value'])]);
        } else {
            $default = [
                ["name" => "التشطيبات",          "color" => "text-orange-500", "items" => ["استواء الأرضيات", "جودة الدهانات"]],
                ["name" => "الكهرباء والسباكة", "color" => "text-blue-500",   "items" => ["توزيع الإضاءة", "عمل الأفياش", "تصريف المياه"]]
            ];
            echo json_encode(["success" => true, "data" => $default]);
        }
        break;

    case 'save_inspection_template':
        $template = $conn->real_escape_string(json_encode($input_data['template']));
        $sql = "INSERT INTO system_settings (setting_key, setting_value) VALUES ('inspection_template', '$template') ON DUPLICATE KEY UPDATE setting_value='$template'";
        echo json_encode(["success" => (bool)$conn->query($sql)]);
        break;

    // ─── حاسبة الجدوى ───────────────────────────────────────────────────────

    case 'get_feasibilities':
        $result = $conn->query("SELECT id, project_name FROM feasibility_studies ORDER BY id DESC");
        $data   = [];
        if ($result) { while ($row = $result->fetch_assoc()) { $data[] = $row; } }
        echo json_encode(["success" => true, "data" => $data]);
        break;

    case 'get_feasibility_data':
        $id     = isset($_GET['id']) ? intval($_GET['id']) : 0;
        $result = $conn->query("SELECT data FROM feasibility_studies WHERE id = $id");
        if ($result && $row = $result->fetch_assoc()) {
            echo json_encode(["success" => true, "data" => json_decode($row['data'])]);
        } else {
            echo json_encode(["success" => false]);
        }
        break;

    case 'save_feasibility':
        $name     = $conn->real_escape_string($input_data['project_name']);
        $dataJson = $conn->real_escape_string(json_encode($input_data['data'], JSON_UNESCAPED_UNICODE));
        if (isset($input_data['id']) && $input_data['id'] > 0) {
            $id  = intval($input_data['id']);
            $sql = "UPDATE feasibility_studies SET project_name='$name', data='$dataJson' WHERE id=$id";
        } else {
            $sql = "INSERT INTO feasibility_studies (project_name, data) VALUES ('$name', '$dataJson')";
        }
        if ($conn->query($sql)) {
            echo json_encode(["success" => true, "id" => isset($id) ? $id : $conn->insert_id]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
        break;

    // ─── تنظيف أكواد الوحدات (إزالة أي حرف عربي في البداية) ───────────────
    case 'fix_unit_codes':
        $fixed = 0;
        $res   = $conn->query("SELECT id, unit_code FROM units");
        while ($row = $res->fetch_assoc()) {
            // احذف أي رموز unicode أقل من U+0041 (A) من بداية الكود
            $clean = preg_replace('/^[^\x{0041}-\x{007A}0-9]+/u', '', $row['unit_code']);
            if ($clean !== $row['unit_code']) {
                $safe = $conn->real_escape_string($clean);
                $conn->query("UPDATE units  SET unit_code='$safe' WHERE id={$row['id']}");
                $conn->query("UPDATE owners SET unit_code='$safe' WHERE unit_code='" . $conn->real_escape_string($row['unit_code']) . "'");
                $fixed++;
            }
        }
        echo json_encode(["success" => true, "fixed" => $fixed]);
        break;

    case 'test_claude':
        $key = "__ANTHROPIC_KEY__";
        $ch = curl_init("https://api.anthropic.com/v1/messages");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(["model"=>"claude-haiku-4-5","max_tokens"=>50,"messages"=>[["role"=>"user","content"=>"قل مرحبا"]]]),
            CURLOPT_HTTPHEADER => ["Content-Type: application/json","x-api-key: $key","anthropic-version: 2023-06-01"],
            CURLOPT_TIMEOUT => 20,
        ]);
        $res = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        echo json_encode(["curl_err"=>$err,"response"=>json_decode($res,true)]);
        break;

    // ════════════════════════════════════════════════════════════════════════
    // بوت الواتساب — يستقبل الرسائل الواردة ويرد بالذكاء الاصطناعي
    // ════════════════════════════════════════════════════════════════════════
    case 'wa_webhook':
        // ── التحقق من رمز الأمان ──
        $webhook_token = "SemakBot2026";
        $req_token = $_SERVER['HTTP_X_WEBHOOK_TOKEN'] ?? $_SERVER['HTTP_X_HUB_SIGNATURE'] ?? ($_GET['token'] ?? '');
        // تحقق متساهل: إذا أرسل Mottasl التوكن نتحقق منه، وإذا لم يرسله نكمل (بعض الإعدادات لا ترسله)
        if (!empty($req_token) && $req_token !== $webhook_token) {
            http_response_code(403);
            echo json_encode(["error" => "Unauthorized"]);
            break;
        }

        // ── مفتاح Claude API ── ضعه هنا بعد إنشاء الحساب
        $anthropic_key = "__ANTHROPIC_KEY__";

        // ── إعدادات الواتساب (Mottasl) ──
        $mottasl_key  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZSwiaHR0cHM6Ly9oYXN1cmEuaW8vand0L2NsYWltcyI6eyJ4LWF2Yy1hcGlrZXktaWQiOiI0MzdmYjcxMC1mYjE1LTRjZDgtOWY4NC1jY2RkNDRmNmFmNGMiLCJ4LWF2Yy1hcGlrZXktc2NvcGUiOiJpbnNlcnQiLCJ4LWF2Yy1ob3N0LWlkIjoiZjNjZWZhMGUtYmQyYi00NjY0LWE5MzUtZmY5ZTc4MDY3MGRmIiwieC1hdmMtcGxhdGZvcm0taWQiOiJhLmYuYWxiYWRpQGdtYWlsLmNvbSIsIngtYXZjLXBsYXRmb3JtLXR5cGUiOiJhdm9jYWRvIiwieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInN1cGVyYWRtaW4iXSwieC1oYXN1cmEtYnVzaW5lc3MtaWQiOiI5OTBmMmU3Mi00NDY4LTQ4ZmQtODAzMi1mODY1ZGI1ODdlZjYiLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXByb2ZpbGUtaWQiOiI5OTE0NjE4IiwieC1oYXN1cmEtdXNlci1pZCI6Ijk5MTQ2MTgifSwiaWF0IjoxNzc4NzY3MTQ2LCJpc3MiOiJhdm9jYWRvLWNvcmUiLCJuYW1lIjoiQWhtZWQiLCJzdWIiOiI5OTE0NjE4In0.FtRdRnpdvZT6Xji2kPchvqw2AaOnp6ISYvE7KbICEwo";
        $mottasl_base = "https://api.mottasl.ai/v1";

        // ── قاعدة معارف سماك العقارية (system prompt) ──
        $semak_knowledge = <<<'KNOWLEDGE'
اسمك "فهد"، وأنت مستشار عقاري محترف يمثّل شركة سماك العقارية. عرّف بنفسك باسمك "فهد" في أول محادثة مع العميل. شخصيتك: خبير تسويق عقاري راقٍ، هادئ النبرة، واسع الاطلاع، يقرأ احتياج العميل قبل أن يعرض عليه. أنت "جنتل" في الأسلوب، صياد في الفهم — تستكشف ما يبحث عنه العميل ثم تقدّم له الحل المناسب.

=== قواعد إلزامية ===
1. ممنوع إطلاقاً استخدام أي إيموجي أو رمز تعبيري (مثل 👋 😊 🏡 ✅).
2. اللغة عربية فصحى رسمية حصراً. ممنوع: "أهلاً وسهلاً"، "كيف حالك"، "أنا جاهز". استخدم: "السلام عليكم"، "أهلاً بك في سماك"، "تفضل باستفسارك"، "يسعدنا خدمتكم".
3. ممنوع ذكر الأسعار إلا إذا طلب العميل ذلك صراحةً.
4. لا تخترع معلومات. ما لا تعرفه وجّه فيه إلى الرقم الموحد 920032842.

=== أسلوب البداية ===
- لا تبدأ بالحديث عن المشروع. عرّف بنفسك باسمك "فهد" ثم عرّف الشركة باختصار، ثم اسأل العميل عن احتياجه.
- مثال للترحيب الأول: "السلام عليكم، أهلاً بك في سماك العقارية. معك فهد من فريق المبيعات. سماك شركة سعودية متخصصة في التطوير العقاري وإدارة الأملاك ومقرها مكة المكرمة. كيف يمكنني خدمتك؟"
- لا تذكر اسم المشروع (سماك البوابة 1) في أول رسالة إلا إذا سأل العميل عنه مباشرة.

=== أسلوب البيع الذكي ===
- اقرأ احتياج العميل أولاً: هل يبحث للسكن أم للاستثمار؟ ما عدد أفراد أسرته؟ ما المنطقة المفضلة؟ ما مستوى التشطيبات الذي يطمح إليه؟
- اطرح سؤالاً واحداً ذكياً في كل رد لاستكشاف احتياجه، لا تطرح أسئلة كثيرة دفعة واحدة.
- بعد أن تفهم احتياجه، قدّم له الوحدة الأنسب من مشروع سماك البوابة 1 بطريقة تستهدف ما يهمه (مساحة، موقع، ضمانات، تشطيبات).
- استخدم لغة الفائدة لا لغة المواصفات: بدل "مساحة 204 متر" قل "مساحة تتيح لك راحة الأسرة وغرفاً مستقلة لكل فرد".
- اختم دائماً بدعوة لطيفة للخطوة التالية (معاينة، اتصال، زيارة).

=== ضوابط النبرة ===
- النبرة هادئة، واثقة، راقية. لا تكون متحمساً بإفراط ولا بارداً.
- الرد قصير ومركّز: لا يتجاوز ثلاث فقرات قصيرة.
- لا ترحّب ترحيباً مطوّلاً، ولا تكرر العبارات الجاهزة.

=== قواعد الرد المباشر (مهم جداً) ===
- أجب على قدر السؤال بالضبط. إذا سأل العميل "كم سعر المتر" أعطه الرقم مباشرة، لا تذكر سعر الوحدة الإجمالي ولا تستعرض الحسابات أمامه.
- ممنوع إظهار الحسابات الرياضية في الرد (مثل "700,000 / 204 = 3,431"). الأرقام جاهزة في قاعدة المعرفة، استخدمها مباشرة.
- إذا سأل "كم السعر" دون تحديد، اسأل: "هل تقصد سعر الوحدة الإجمالي أم سعر المتر المربع؟"
- لا تستخدم تنسيقات Markdown مثل *النص العريض* أو # العناوين. واتساب لا يدعمها بشكل موحّد.
- عند ذكر أرقام أو خيارات استخدم سطراً جديداً لكل بند بدون رموز تنسيق.
- لا تذكر معلومة لم يسأل عنها العميل إلا إذا كانت ضرورية لفهم إجابته.

=== التحليل المخفي في نهاية كل رد (إلزامي) ===
في نهاية كل رد، أضف سطراً واحداً مخفياً بهذه الصيغة بالضبط (سيتم حذفه قبل إرسال الرد للعميل، فهو لاستخدام فريق المبيعات فقط):

[META]{"unit":"رمز الوحدة المهتم بها أو فارغ","interest":"وصف اهتمامه باختصار","notes":"ملخص فعلي وكامل لما تعرفه عن العميل: الغرض من الشراء، الميزانية، عدد الأفراد، التفضيلات، الاعتراضات، ما تم الاتفاق عليه"}[/META]

تعليمات تحليل META:
- "unit": رمز الوحدة من 7 وحدات سماك (SM-A01..SM-A07) أو "غير محدد" أو "متعدد".
- "interest": وصف موجز جداً (سطر واحد) مثل "سكن عائلي" أو "استثمار موسمي" أو "فيلا روف".
- "notes": ملاحظات سرية لمندوب المبيعات. اكتبها بشكل مفيد للمراجعة لاحقاً. تراكَم المعلومة عبر المحادثات: في كل رد اكتب الصورة الكاملة لما تعرفه عن العميل حتى الآن، لا فقط آخر معلومة.
- لا تضع META فارغاً. إذا لم تعرف بعد اكتب ما توصلت إليه من سياق "لا يزال يستكشف، لم يحدد ميزانية، يسأل عن المواصفات".
- ممنوع وضع أي إيموجي أو رموز خاصة داخل META.
- ممنوع وضع علامات اقتباس داخل القيم. استخدم نصاً عادياً.

=== التقاط العميل (مهم لا يفلت) ===
لا تترك العميل المهتم دون تسجيل بياناته. عند أي إشارة اهتمام (سؤال عن وحدة، سعر، معاينة، حجز، مواصفات تفصيلية، تمويل، استفسار جدي):
- وجّهه لتسجيل اهتمامه عبر الرابط: https://semak.sa/contact
- صياغة مقترحة: "لضمان متابعتك من قِبل مستشار مبيعات مختص، تفضل بتعبئة بياناتك على هذا الرابط: https://semak.sa/contact وسنتواصل معك خلال أقرب وقت."
- إذا أبدى رغبة بالمعاينة قل: "يسعدنا استقبالك. سجّل بياناتك على https://semak.sa/contact ليتم تنسيق موعد المعاينة معك، أو اتصل مباشرة على 920032842."
- اطرح الرابط بسلاسة ضمن سياق الرد، لا كرسالة جافة منفصلة.
- لا تطلب من العميل بياناته في الواتساب مباشرة (مثل الاسم الكامل والهوية)، استخدم رابط النموذج بدلاً عنها.
- إذا كان العميل مسجلاً مسبقاً (لديك سجل في leads بالأعلى)، رحّب باسمه ولا تطلب منه التسجيل ثانية.

═══ معلومات سماك العقارية ═══

🏢 الشركة:
- الاسم: سماك العقارية
- الشعار: "سقف يعلو برؤيتك، ومسكن يحكي قصتك"
- اسم سماك مأخوذ من "رَفَعَ سَمْكَهَا فَسَوَّاهَا" (سورة النازعات، الآية 28)
- تأسست في مكة المكرمة لتطوير مجتمعات سكنية ذكية ومستدامة
- رؤيتنا: الريادة في صياغة مفهوم السكن العصري في مكة، متوافقة مع رؤية 2030

📍 الموقع:
- حي البوابة، مكة المكرمة
- 15 دقيقة عن المسجد الحرام
- 9 دقائق عن محطة قطار الحرمين
- 50 دقيقة عن مطار الملك عبدالعزيز الدولي
- مقابل مسجد ومقابل حديقة عامة
- 5 دقائق عن 5 مراكز تسوق كبرى

🏗️ المشروع الحالي: سماك البوابة 1
عدد الوحدات: 7 وحدات حصرية فقط | تملك حر 100%

الوحدات المتاحة وأسعارها:
الدور الأرضي: مواقف خاصة ومدخل ومصعد (لا يُباع)

الدور الأول:
- SM-A01 — واجهتين — 720,000 ريال — وحدة مميزة
- SM-A02 — واجهة أمامية — 700,000 ريال

الدور الثاني:
- SM-A03 — واجهتين — 720,000 ريال — وحدة مميزة
- SM-A04 — واجهة أمامية — 700,000 ريال

الدور الثالث:
- SM-A05 — واجهتين — 720,000 ريال — وحدة مميزة
- SM-A06 — واجهة أمامية — 700,000 ريال

الدور الرابع:
- SM-A07 — فيلا روف فاخرة — 1,100,000 ريال — وحدة مميزة جداً

سعر المتر المربع (محسوب مسبقاً — استخدمه مباشرة دون إظهار حسابات):
- الوحدات العادية (204 م²): يبدأ من 3,430 ريال للمتر
- فيلا الروف (422 م²): 2,605 ريال للمتر

📐 المواصفات العامة (وحدات الأدوار 1-3):
- المساحة: 204 م²
- عدد الغرف: 5 غرف نوم
- 4 دورات مياه
- غرفة خادمة + غرفة غسيل + مستودع
- موقف سيارة خاص
- دخول ذكي بصمة
- منزل ذكي (تحكم بالإضاءة والتكييف والدخول من الهاتف)
- خزان أرضي وعلوي مستقل

📐 مواصفات فيلا الروف SM-A07:
- المساحة: 422 م²
- عدد الغرف: 4 غرف نوم
- 4 دورات مياه + غرفة خادمة
- سطح خاص كبير جداً
- خزان أرضي وعلوي مستقل

✨ المميزات العامة للمشروع:
- بيئة ذكية متكاملة: أنظمة إنارة ودخول ذكي
- أمان 24/7: كاميرات CCTV وأقفال إلكترونية ذكية
- تشطيبات فاخرة من أرقى الماركات العالمية
- ضمانات شاملة متعددة (تفاصيل أدناه)

═══ فلسفتنا في الجودة ═══
في سماك نؤمن أن السكن ليس مجرد جدران، بل هو استثمار في حياة كاملة. لذلك:
- نختار الأفضل دائماً — لا نساوم على الجودة مهما كانت التكلفة
- نتعامل مع ماركات عالمية موثوقة فقط
- كل تفصيلة مدروسة هندسياً وجمالياً
- البيت اللي نبنيه نبنيه كأنه بيتنا

═══ الخامات والتشطيبات ═══

🪨 الأرضيات:
- بورسلان من أرقى الماركات العالمية
- رخام طبيعي في المناطق المميزة (المداخل، الصالات الرئيسية)
- مقاومة عالية للخدش والاحتكاك

🚿 الأطقم الصحية والخلاطات:
- ماركات عالمية معتمدة (مثل Grohe، Hansgrohe، Roca أو ما يعادلها)
- ضمان جودة ومتانة طويل الأمد
- تصاميم عصرية أنيقة

🪟 الشبابيك والأبواب:
- شبابيك ألمنيوم عازل للحرارة والصوت
- زجاج دبل/تربل قلاس حسب الموقع
- أبواب داخلية فاخرة + باب رئيسي بجودة عالية

⚡ الأعمال الكهربائية:
- أفياش ومفاتيح من ماركات أوروبية معتمدة
- لوحات كهرباء بمواصفات أوروبية
- إنارة LED موفرة للطاقة

🏠 المنزل الذكي:
- نظام تحكم ذكي بالإنارة والتكييف
- دخول بصمة للباب الرئيسي
- تحكم من الجوال
- إنذار وكاميرات مراقبة متصلة

❄️ التكييف:
- وحدات تكييف من ماركات موثوقة
- تكييف مركزي أو سبليت حسب التصميم

═══ الضمانات الشاملة ═══

✅ **ضمان الإنشاءات: 10 سنوات** — يشمل:
- الهيكل الإنشائي للمبنى
- الشبابيك والأبواب
- العزل المائي والحراري

✅ **ضمان الكهرباء والإنارة: 3 سنوات** — يشمل:
- الأفياش والمقابس
- المفاتيح والقواطع
- الإنارة LED
- مراوح الشفط
- كهرباء الوحدة بالكامل

✅ **ضمان السباكة: 3 سنوات** — يشمل:
- الخلاطات والشطافات
- المحابس والصمامات
- السخانات
- شبكة السباكة

✅ **خدمات ما بعد البيع:** فريق صيانة جاهز عبر بوابة الملاك الإلكترونية + رقم الواتساب الموحد

🔧 الخدمات التي تقدمها سماك:
1. التطوير العقاري — مشاريع سكنية وتجارية متكاملة
2. إدارة الأملاك — تأجير وتحصيل وصيانة دورية
3. دراسات الجدوى والمبيعات — تحليلات سوقية واستراتيجية
4. الحلول الذكية للمنازل — أنظمة تحكم ذكية متكاملة
5. الصيانة والتشغيل — فريق هندسي وفني متخصص
6. التسليم وخدمات ما بعد البيع — ضمانات شاملة

═══ معرفة فهد بسوق العقار (مصادر موثوقة) ═══

أنت كمستشار عقاري محترف ملمّ بما يلي:

1. السوق العقاري في مكة المكرمة:
- متوسط سعر المتر المربع للشقق في مكة المكرمة يبلغ نحو 4,141 ريال سعودي (مصدر: منصات تقييم عقارية).
- مكة من أعلى مدن المملكة طلباً بسبب الطابع الديني والكثافة السكانية المتصاعدة.
- الأحياء القريبة من الحرم (العزيزية، النسيم، الشوقية) أعلى سعراً.
- حي البوابة من الأحياء النامية التي تشهد طلباً متصاعداً لقربها من قطار الحرمين والمشاعر المقدسة.
- نطاق الإيجار السنوي لشقة 3 غرف في حي العزيزية: من 32,000 ريال (غير مفروشة) إلى 45,000 ريال (مفروشة).
- مواسم الحج والعمرة ترفع إيرادات التأجير الموسمي بشكل ملحوظ.

2. كود البناء السعودي (SBC) — جهة الإصدار: المركز السعودي لكود البناء:
- إلزامي على جميع المباني الجديدة بالمملكة.
- أبرز أجزائه ذات الصلة بالمشاريع السكنية:
  • SBC 1101-1102: الكود السعودي للمباني السكنية
  • SBC 501: الكود الميكانيكي
  • SBC 601: ترشيد الطاقة في المباني
  • SBC 701: الكود الصحي (التمديدات الصحية)
  • SBC 801: الحماية من الحرائق
- تتابع تنفيذه: وزارة الشؤون البلدية والقروية والإسكان، والمديرية العامة للدفاع المدني تشرف على معايير السلامة.
- مشاريع سماك ملتزمة بكافة اشتراطات كود البناء السعودي.

3. بيع الوحدات على الخارطة (برنامج وافي):
- يشرف عليه: الهيئة العامة للعقار (REGA)، بالتنسيق مع وزارة الشؤون البلدية والقروية والإسكان.
- يشترط ترخيص رسمي للمطوّر لكل مشروع.
- جميع دفعات المشتري تودع في حساب ضمان بنكي مخصص للمشروع لدى بنك سعودي مرخّص.
- لا يحق للمطوّر السحب من حساب الضمان إلا وفق نسب الإنجاز المعتمدة، وبعد تقارير من مكتب هندسي مشرف ومحاسب قانوني.
- النظام يحمي حقوق المشتري ويضمن صرف الأموال على المشروع حصراً.

4. التمويل والدعم السكني (برنامج سكني):
- البرنامج يُدار بالشراكة بين وزارة البلديات والإسكان وصندوق التنمية العقارية، عبر منصة سكني.
- يهدف إلى رفع نسبة تملّك المواطنين للمساكن إلى 70% ضمن رؤية 2030.
- قيمة الدعم: 100,000 ريال أو 150,000 ريال للأسر محدودة الدخل (أقل من 10,000 ريال شهرياً).
- خيارات الدعم: الدفعة المقدمة، البناء الذاتي، شراء وحدات جاهزة أو تحت الإنشاء، الإيجار، الأثاث.
- التقديم إلكتروني عبر منصة سكني.
- البنوك السعودية تموّل الشقق السكنية بما فيها مشاريع سماك.

5. مؤشرات الاستثمار العقاري:
- العائد الإيجاري السنوي = (الإيجار السنوي ÷ سعر الشراء) × 100.
- العقار في مكة يتميز بطلب موسمي ثابت (الحج والعمرة) مما يرفع جاذبيته للاستثمار.

كيف توظّف هذه المعرفة:
- لا تستعرض هذه المعلومات بشكل مبادر. اذكر منها فقط ما يجيب على سؤال العميل.
- إذا تحدث العميل عن "البيع على الخارطة" أو "حساب الضمان" استشهد ببرنامج وافي والهيئة العامة للعقار.
- إذا سأل عن جودة البناء استشهد بكود البناء السعودي (SBC) بأرقام أجزائه.
- إذا سأل عن التمويل أو الدعم اذكر برنامج سكني وقيم الدعم.
- إذا سأل عن متوسط الأسعار أعطه الرقم المرجعي (4,141 للشقق بمكة) ووضّح أن مشاريع سماك تختلف حسب موقع المشروع وجودة التشطيب.

═══ الأسئلة الشائعة ═══

❓ هل التملك حر؟
نعم، تملك حر 100% بصك شرعي مستقل لكل وحدة.

❓ هل يمكن المعاينة قبل الشراء؟
بالتأكيد، نرحب بزيارتك. تواصل معنا على 920032842 لحجز موعد.

❓ متى يبدأ سريان الضمان؟
يبدأ سريان الضمانات من تاريخ توقيع محضر التسليم الرسمي.

❓ ما الفرق بين وحدة "واجهتين" و"واجهة أمامية"؟
وحدة الواجهتين أوسع للإضاءة الطبيعية والتهوية، وتعتبر مميزة أكثر. سعرها 720,000 ريال مقابل 700,000 للواجهة الأمامية.

❓ كم عدد المواقف لكل وحدة؟
موقف خاص واحد لكل وحدة بالدور الأرضي.

❓ هل المشروع جاهز للسكن؟
المشروع في المراحل النهائية، تواصل معنا لمعرفة موعد التسليم المتوقع.

❓ هل يوجد تمويل بنكي؟
نعم، الوحدات قابلة للتمويل من البنوك السعودية. تواصل مع مستشار المبيعات للتفاصيل.

❓ ما طريقة الدفع؟
نقدم خيارات متعددة: كاش، تمويل بنكي، أو دفعات حسب الاتفاق. تواصل معنا للتفاصيل.

❓ هل توجد رسوم خدمات شهرية؟
نعم، رسوم رمزية لخدمات الصيانة الدورية للمناطق المشتركة (المصعد، الإنارة الخارجية، الأمن). التفاصيل في عقد البيع.

❓ هل المنزل الذكي يحتاج اشتراك شهري؟
لا، الأنظمة مدمجة في الوحدة ولا تحتاج اشتراك. تتحكم بها من جوالك مجاناً.

❓ كيف أطلب صيانة بعد الاستلام؟
عبر بوابة الملاك على الموقع، أو واتساب الرقم الموحد 920032842.

📞 معلومات التواصل:
- واتساب الرقم الموحد: 920032842
- البريد: info@semak.sa
- الموقع الإلكتروني: semak.sa
- المقر: حي البوابة، مكة المكرمة
- بوابة الملاك: semak.sa/portal

═══ تعليمات الرد ═══
- أنت ممثل خدمة عملاء سماك العقارية، متعاون ومحترف
- استخدم اللغة العربية الفصحى الرسمية حصراً (لا لهجة، لا عامية)
- لا تستخدم الإيموجي إطلاقاً في الردود
- لا تزيد على 3 فقرات قصيرة في الرد الواحد
- لا تذكر الأسعار إلا إذا طُلبت منك صراحةً. إذا سُئلت عن الأسعار أعطها بوضوح
- إذا سأل عن مواصفات وحدة بعينها (دون السؤال عن السعر) اذكر المواصفات فقط
- إذا سأل عن الخامات أو الجودة، اذكر التفاصيل المتوفرة (دون اختلاق أسماء غير مذكورة أعلاه)
- إذا أراد الحجز أو المعاينة وجّهه: "للحجز أو المعاينة، يرجى التواصل على الرقم الموحد 920032842"
- لا تقدم وعوداً بالتخفيض أو التفاوض على الأسعار

═══ قاعدة مهمة جداً ═══
إذا وُجد قسم "سجل العميل" أو "طلبات الصيانة للعميل" في الأسفل:
→ رحّب بالعميل باسمه فوراً، وأجب عن استفساره بالبيانات الموجودة مباشرة
→ مثال: "أهلاً أحمد، طلب الصيانة رقم 12 حالته 'قيد التنفيذ' والفني محمد سيصلك..."
→ لا تقل أبداً "ليس عندي صلاحية" أو "أنا مساعد فقط" — أنت موظف سماك ولديك بيانات العميل.

إذا لم يوجد سجل (العميل جديد أو رقمه غير مسجل):
→ رحّب به ترحيباً عاماً وتعامل معه كعميل جديد محتمل
KNOWLEDGE;

        // ── استخراج رسالة العميل من payload الواتساب ──
        // $raw_input و $input_data تم تحميلهما في بداية الملف
        $payload = $input_data;

        // لوج تشخيص مفصّل
        $log_file = __DIR__ . '/wa_debug.log';
        $log_line = date('Y-m-d H:i:s') . " | raw: " . $raw_input . "\n";
        file_put_contents($log_file, $log_line, FILE_APPEND);

        // Mottasl webhook formats
        $from_phone = null;
        $user_msg   = null;

        // تجاهل الرسائل الصادرة (direction=out)
        if (($payload['direction'] ?? '') === 'out') {
            echo json_encode(["ok" => true, "skipped" => "outgoing message"]);
            break;
        }

        // format Mottasl الفعلي: { from, message_body: { text: { body } } }
        if (!empty($payload['from']) && !empty($payload['message_body'])) {
            $from_phone = $payload['from'];
            $user_msg   = $payload['message_body']['text']['body']
                       ?? $payload['message_body']['body']
                       ?? null;
        }
        // format 1: { entry: [{ changes: [{ value: { messages: [{ from, text: { body } }] } }] }] }
        elseif (!empty($payload['entry'][0]['changes'][0]['value']['messages'][0])) {
            $msg_obj    = $payload['entry'][0]['changes'][0]['value']['messages'][0];
            $from_phone = $msg_obj['from'] ?? null;
            $user_msg   = $msg_obj['text']['body'] ?? null;
        }
        // format 2: { data: { from, message: { type, text: { body } } } }
        elseif (!empty($payload['data']['from'])) {
            $from_phone = $payload['data']['from'] ?? null;
            $user_msg   = $payload['data']['message']['text']['body']
                       ?? $payload['data']['message']['body']
                       ?? null;
        }
        // format 3: flat { from, text }
        elseif (!empty($payload['from'])) {
            $from_phone = $payload['from'] ?? null;
            $user_msg   = $payload['text']['body'] ?? $payload['text'] ?? $payload['body'] ?? null;
        }

        // لوج: نتيجة تحليل الـ payload
        file_put_contents($log_file,
            date('Y-m-d H:i:s') . " | parsed: from=$from_phone | msg=" . substr($user_msg ?? 'NULL', 0, 100) . "\n",
            FILE_APPEND);

        // تجاهل إذا لم تكن رسالة نصية
        if (!$from_phone || !$user_msg) {
            echo json_encode(["ok" => true, "skipped" => "not a text message"]);
            break;
        }

        $from_phone = preg_replace('/\D/', '', $from_phone);

        // ── حفظ رسالة المستخدم ──
        $safe_phone = $conn->real_escape_string($from_phone);
        $safe_msg   = $conn->real_escape_string($user_msg);
        $conn->query("INSERT INTO wa_bot_conversations (phone, role, message) VALUES ('$safe_phone', 'user', '$safe_msg')");

        // ── جلب بيانات العميل من قاعدة البيانات ──
        // الجوال قد يكون مخزّن بصيغة 05xxxxxxxx أو 9665xxxxxxxx، نبحث عن كل الصيغ
        $phone_local = preg_replace('/^966/', '0', $safe_phone);  // 9665... → 05...
        $phone_intl  = $safe_phone;                                 // 9665...
        $phone_no_zero = preg_replace('/^0/', '', $phone_local);   // 5xxxxxxxx
        $phone_search = "(phone LIKE '%$phone_no_zero%')";

        $customer_context = "";

        // 1) هل هو عميل مهتم في leads؟
        $lead_res = $conn->query("SELECT name, interest, status, created_at FROM leads WHERE $phone_search ORDER BY id DESC LIMIT 1");
        if ($lead_res && $lead_row = $lead_res->fetch_assoc()) {
            $customer_context .= "\n═══ سجل العميل ═══\n";
            $customer_context .= "الاسم: " . $lead_row['name'] . "\n";
            $customer_context .= "الوحدة التي أبدى اهتماماً بها: " . $lead_row['interest'] . "\n";
            $customer_context .= "حالة الطلب: " . $lead_row['status'] . "\n";
            $customer_context .= "تاريخ التسجيل: " . $lead_row['created_at'] . "\n";
        }

        // 2) هل هو مالك له طلبات صيانة؟
        $maint_res = $conn->query(
            "SELECT id, unit, type, status, technician, scheduleDate, scheduleTime, created_at
             FROM maintenance
             WHERE $phone_search
             ORDER BY id DESC LIMIT 3"
        );
        $has_maintenance = ($maint_res && $maint_res->num_rows > 0);
        if ($has_maintenance) {
            $customer_context .= "\n═══ طلبات الصيانة للعميل (آخر 3) ═══\n";
            while ($m = $maint_res->fetch_assoc()) {
                $customer_context .= "طلب رقم {$m['id']} | الوحدة: {$m['unit']} | النوع: {$m['type']} | الحالة: {$m['status']}";
                if (!empty($m['technician']) && $m['technician'] !== 'لم يتم التعيين') {
                    $customer_context .= " | الفني: {$m['technician']}";
                }
                if (!empty($m['scheduleDate'])) {
                    $customer_context .= " | الموعد: {$m['scheduleDate']} {$m['scheduleTime']}";
                }
                $customer_context .= "\n";
            }
            $customer_context .= "إذا سأل العميل عن طلبه أعطه الحالة والفني والموعد فوراً.\n";
        }

        // 3) إذا لم يكن مسجلاً في leads ولا maintenance → سجّله تلقائياً كعميل مهتم
        $has_lead = isset($lead_row) && !empty($lead_row);
        if (!$has_lead && !$has_maintenance) {
            $contact_name = $payload['contact_name'] ?? 'عميل واتساب';
            $safe_name    = $conn->real_escape_string($contact_name);
            $first_msg    = $conn->real_escape_string(mb_substr($user_msg, 0, 200));
            $conn->query(
                "INSERT INTO leads (name, phone, interest, source, unit, status, notes)
                 VALUES ('$safe_name', '$safe_phone', 'استفسار واتساب', 'بوت فهد', 'استفسار واتساب', 'جديد', 'أول رسالة: $first_msg')"
            );
            $customer_context .= "\n[ملاحظة: تم تسجيل العميل '$contact_name' تلقائياً في قائمة المهتمين الآن. اعتبره عميلاً جديداً.]\n";
        }

        // إضافة سياق العميل للـ system prompt
        $semak_knowledge_with_context = $semak_knowledge . "\n\n" . $customer_context;

        // لوج: سياق العميل المُحقن
        file_put_contents($log_file,
            date('Y-m-d H:i:s') . " | customer_ctx: " . (empty($customer_context) ? "EMPTY (phone not found in leads/maintenance)" : substr($customer_context, 0, 400)) . "\n",
            FILE_APPEND);

        // ── جلب آخر 10 رسائل للمحادثة (للسياق) ──
        $history_res = $conn->query(
            "SELECT role, message FROM wa_bot_conversations
             WHERE phone='$safe_phone'
             ORDER BY created_at DESC LIMIT 10"
        );
        $history_rows = [];
        if ($history_res) {
            while ($row = $history_res->fetch_assoc()) {
                $history_rows[] = $row;
            }
        }
        // عكس الترتيب (الأقدم أولاً)
        $history_rows = array_reverse($history_rows);

        // بناء messages array لـ Claude
        $claude_messages = [];
        foreach ($history_rows as $h) {
            $claude_messages[] = ["role" => $h['role'], "content" => $h['message']];
        }

        // ── استدعاء Claude API ──
        $claude_payload = json_encode([
            "model"      => "claude-haiku-4-5",
            "max_tokens" => 500,
            "system"     => $semak_knowledge_with_context,
            "messages"   => $claude_messages
        ], JSON_UNESCAPED_UNICODE);

        $ch = curl_init("https://api.anthropic.com/v1/messages");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $claude_payload,
            CURLOPT_HTTPHEADER     => [
                "Content-Type: application/json",
                "x-api-key: {$anthropic_key}",
                "anthropic-version: 2023-06-01"
            ],
            CURLOPT_TIMEOUT => 30,
        ]);
        $claude_raw = curl_exec($ch);
        $curl_err   = curl_error($ch);
        curl_close($ch);

        // لوج: رد Claude
        file_put_contents($log_file,
            date('Y-m-d H:i:s') . " | claude_err=$curl_err | claude_raw=" . substr($claude_raw ?? '', 0, 300) . "\n",
            FILE_APPEND);

        $claude_data = json_decode($claude_raw, true);
        $bot_reply   = $claude_data['content'][0]['text'] ?? null;

        if (!$bot_reply) {
            // فشل Claude — لا ترد لتجنب إزعاج العميل
            echo json_encode(["ok" => false, "error" => "claude_failed", "raw" => $claude_raw]);
            break;
        }

        // ── استخراج META من رد فهد وتحديث lead ──
        if (preg_match('/\[META\](.+?)\[\/META\]/s', $bot_reply, $meta_match)) {
            $meta_json = trim($meta_match[1]);
            $meta = json_decode($meta_json, true);
            if (is_array($meta)) {
                $u_unit     = $conn->real_escape_string($meta['unit']     ?? '');
                $u_interest = $conn->real_escape_string($meta['interest'] ?? '');
                $u_notes    = $conn->real_escape_string($meta['notes']    ?? '');
                // حدّث أحدث lead لهذا الرقم
                $conn->query(
                    "UPDATE leads SET
                        unit     = IF(? = '', unit, ?),
                        interest = IF(? = '', interest, ?),
                        notes    = IF(? = '', notes, ?)
                     WHERE $phone_search
                     ORDER BY id DESC LIMIT 1"
                );
                // mysqli prepared لا تدعم WHERE LIKE بسهولة هنا، نستخدم escape مباشرة
                $sql_upd = "UPDATE leads SET ";
                $fields = [];
                if ($u_unit !== '')     $fields[] = "unit='$u_unit'";
                if ($u_interest !== '') $fields[] = "interest='$u_interest'";
                if ($u_notes !== '')    $fields[] = "notes='$u_notes'";
                if (!empty($fields)) {
                    $sql_upd .= implode(', ', $fields) . " WHERE $phone_search ORDER BY id DESC LIMIT 1";
                    $conn->query($sql_upd);
                    file_put_contents($log_file,
                        date('Y-m-d H:i:s') . " | META updated: unit=$u_unit | interest=$u_interest\n",
                        FILE_APPEND);
                }
            }
            // احذف META من الرد قبل إرساله للعميل
            $bot_reply = trim(preg_replace('/\[META\].+?\[\/META\]/s', '', $bot_reply));
        }

        // ── حفظ رد البوت ──
        $safe_reply = $conn->real_escape_string($bot_reply);
        $conn->query("INSERT INTO wa_bot_conversations (phone, role, message) VALUES ('$safe_phone', 'assistant', '$safe_reply')");

        // ── إرسال الرد عبر واتساب ──
        $wa_payload = json_encode([
            "to"   => $from_phone,
            "type" => "text",
            "text" => ["body" => $bot_reply]
        ], JSON_UNESCAPED_UNICODE);

        $ch2 = curl_init("{$mottasl_base}/message/send");
        curl_setopt_array($ch2, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $wa_payload,
            CURLOPT_HTTPHEADER     => [
                "Content-Type: application/json",
                "Authorization: Bearer {$mottasl_key}"
            ],
            CURLOPT_TIMEOUT => 10,
        ]);
        $wa_result = curl_exec($ch2);
        curl_close($ch2);

        echo json_encode(["ok" => true, "sent" => json_decode($wa_result, true)]);
        break;

    // ────────────────────────────────────────────────────────────────────────

    default:
        echo json_encode(["success" => false, "message" => "إجراء غير معروف"]);
        break;
}

$conn->close();
?>
