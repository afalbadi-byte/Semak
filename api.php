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

$input_data = json_decode(file_get_contents("php://input"), true);
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

        // إرسال رمز التحقق عبر واتساب (Mottasl API)
        $wa_to   = '966' . $phone;
        $wa_name = $owner['owner_name'];
        $wa_body = "🔐 *سماك العقارية — رمز الدخول*\n\nأهلاً {$wa_name}،\n\nرمز التحقق الخاص بك:\n\n*{$otp_code}*\n\n⏰ صالح لمدة 10 دقائق فقط\n🔒 لا تشارك هذا الرمز مع أي شخص";

        $mottasl_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZSwiaHR0cHM6Ly9oYXN1cmEuaW8vand0L2NsYWltcyI6eyJ4LWF2Yy1hcGlrZXktaWQiOiI0MzdmYjcxMC1mYjE1LTRjZDgtOWY4NC1jY2RkNDRmNmFmNGMiLCJ4LWF2Yy1hcGlrZXktc2NvcGUiOiJpbnNlcnQiLCJ4LWF2Yy1ob3N0LWlkIjoiZjNjZWZhMGUtYmQyYi00NjY0LWE5MzUtZmY5ZTc4MDY3MGRmIiwieC1hdmMtcGxhdGZvcm0taWQiOiJhLmYuYWxiYWRpQGdtYWlsLmNvbSIsIngtYXZjLXBsYXRmb3JtLXR5cGUiOiJhdm9jYWRvIiwieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInN1cGVyYWRtaW4iXSwieC1oYXN1cmEtYnVzaW5lc3MtaWQiOiI5OTBmMmU3Mi00NDY4LTQ4ZmQtODAzMi1mODY1ZGI1ODdlZjYiLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXByb2ZpbGUtaWQiOiI5OTE0NjE4IiwieC1oYXN1cmEtdXNlci1pZCI6Ijk5MTQ2MTgifSwiaWF0IjoxNzc4NzY3MTQ2LCJpc3MiOiJhdm9jYWRvLWNvcmUiLCJuYW1lIjoiQWhtZWQiLCJzdWIiOiI5OTE0NjE4In0.FtRdRnpdvZT6Xji2kPchvqw2AaOnp6ISYvE7KbICEwo';

        $ch = curl_init('https://api.mottasl.ai/v1/message/send');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode(['to' => $wa_to, 'type' => 'text', 'text' => ['body' => $wa_body]]),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer {$mottasl_key}"],
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        curl_exec($ch);
        curl_close($ch);

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

            // ① إشعار الإدارة (نص)
            $wa_msg = "🔧 *طلب صيانة جديد #$new_id - سماك*\n\n👤 المالك: $name\n📞 الجوال: $phone\n🏠 الوحدة: $unit\n⚠️ نوع العطل: $type\n\n⏰ " . date('Y-m-d H:i', strtotime('+3 hours'));
            $ch = curl_init("https://api.mottasl.ai/v1/message/send");
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode(["to" => $admin_phone, "type" => "text", "text" => ["body" => $wa_msg]]), CURLOPT_HTTPHEADER => $wa_headers, CURLOPT_TIMEOUT => 5]);
            curl_exec($ch); curl_close($ch);

            // ② تأكيد استلام الطلب للعميل (قالب)
            if (!empty($phone)) {
                $client_phone = preg_replace('/\D/', '', $phone);
                $client_phone = ltrim($client_phone, '0');
                if (substr($client_phone, 0, 3) !== '966') $client_phone = '966' . $client_phone;
                if (strlen($client_phone) >= 12) {
                    $client_payload = json_encode([
                        "to" => $client_phone, "type" => "template",
                        "template" => [
                            "template_id" => "semak_maintenance", "language" => "ar",
                            "components"  => [
                                ["type" => "header", "parameters" => [
                                    ["type" => "image", "image" => ["link" => "https://semak.sa/images/wa-maintenance-cover.png"]]
                                ]],
                                ["type" => "body", "parameters" => [
                                    ["type" => "text", "text" => $name],           // {{1}} الاسم
                                    ["type" => "text", "text" => (string)$new_id], // {{2}} رقم الطلب
                                    ["type" => "text", "text" => $unit],           // {{3}} الوحدة
                                    ["type" => "text", "text" => $type],           // {{4}} نوع العطل
                                    ["type" => "text", "text" => "قيد الانتظار"], // {{5}} الحالة
                                    ["type" => "text", "text" => "سيتم التحديد"], // {{6}} الفني
                                    ["type" => "text", "text" => "سيتم التأكيد"], // {{7}} الموعد
                                    ["type" => "text", "text" => "—"],             // {{8}} رمز الإغلاق
                                ]]
                            ]
                        ]
                    ]);
                    $ch2 = curl_init("https://api.mottasl.ai/v1/message/send?create=true");
                    curl_setopt_array($ch2, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $client_payload, CURLOPT_HTTPHEADER => $wa_headers, CURLOPT_TIMEOUT => 5]);
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
                $wa_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6dHJ1ZSwiaHR0cHM6Ly9oYXN1cmEuaW8vand0L2NsYWltcyI6eyJ4LWF2Yy1hcGlrZXktaWQiOiI0MzdmYjcxMC1mYjE1LTRjZDgtOWY4NC1jY2RkNDRmNmFmNGMiLCJ4LWF2Yy1hcGlrZXktc2NvcGUiOiJpbnNlcnQiLCJ4LWF2Yy1ob3N0LWlkIjoiZjNjZWZhMGUtYmQyYi00NjY0LWE5MzUtZmY5ZTc4MDY3MGRmIiwieC1hdmMtcGxhdGZvcm0taWQiOiJhLmYuYWxiYWRpQGdtYWlsLmNvbSIsIngtYXZjLXBsYXRmb3JtLXR5cGUiOiJhdm9jYWRvIiwieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiIsInN1cGVyYWRtaW4iXSwieC1oYXN1cmEtYnVzaW5lc3MtaWQiOiI5OTBmMmU3Mi00NDY4LTQ4ZmQtODAzMi1mODY1ZGI1ODdlZjYiLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXByb2ZpbGUtaWQiOiI5OTE0NjE4IiwieC1oYXN1cmEtdXNlci1pZCI6Ijk5MTQ2MTgifSwiaWF0IjoxNzc4NzY3MTQ2LCJpc3MiOiJhdm9jYWRvLWNvcmUiLCJuYW1lIjoiQWhtZWQiLCJzdWIiOiI5OTE0NjE4In0.FtRdRnpdvZT6Xji2kPchvqw2AaOnp6ISYvE7KbICEwo";
                $wa_payload = json_encode([
                    "to"       => $client_phone,
                    "type"     => "template",
                    "template" => [
                        "template_id" => "semak_maintenance",
                        "language"    => "ar",
                        "components"  => [
                            ["type" => "header", "parameters" => [
                                ["type" => "image", "image" => ["link" => "https://semak.sa/images/wa-maintenance-cover.png"]]
                            ]],
                            ["type" => "body", "parameters" => [
                                ["type" => "text", "text" => $row['name']],        // {{1}} الاسم
                                ["type" => "text", "text" => (string)$row['id']],  // {{2}} رقم الطلب
                                ["type" => "text", "text" => $row['unit']],        // {{3}} الوحدة
                                ["type" => "text", "text" => $row['type']],        // {{4}} نوع العطل
                                ["type" => "text", "text" => $value],              // {{5}} الحالة
                                ["type" => "text", "text" => $tech],               // {{6}} الفني
                                ["type" => "text", "text" => $sched],              // {{7}} الموعد
                                ["type" => "text", "text" => $otp_val],            // {{8}} رمز الإغلاق
                            ]]
                        ]
                    ]
                ]);
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
            $wa_msg = "🔔 *عميل جديد - سماك العقارية*\n\n👤 الاسم: $name\n📞 الجوال: $phone\n🏠 الاهتمام: $interest\n\n⏰ " . date('Y-m-d H:i', strtotime('+3 hours'));
            $wa_payload = json_encode(["to" => $admin_phone, "type" => "text", "text" => ["body" => $wa_msg]]);
            $ch = curl_init("https://api.mottasl.ai/v1/message/send");
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

    // ────────────────────────────────────────────────────────────────────────

    default:
        echo json_encode(["success" => false, "message" => "إجراء غير معروف"]);
        break;
}

$conn->close();
?>
