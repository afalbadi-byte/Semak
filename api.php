<?php
// deploy: 2026-06-04-v385
if (function_exists('opcache_reset')) opcache_reset();
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

// ─── auto-migrate: work cycles (دورات العمل) ───────────────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS work_cycles (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    project_name VARCHAR(255),
    start_date   DATE,
    end_date     DATE,
    budget       DECIMAL(14,2) DEFAULT 0,
    supplier_ids TEXT,
    categories   TEXT,
    status       VARCHAR(40) DEFAULT 'active',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── auto-migrate: Daftra OAuth tokens (حل دائم) ───────────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS daftra_tokens (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    access_token  TEXT,
    refresh_token TEXT,
    expires_at    DATETIME,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── auto-migrate: Daftra work cycles cache (bookmarklet sync) ───────────────
$conn->query("CREATE TABLE IF NOT EXISTS daftra_wc_cache (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    daftra_id  VARCHAR(64),
    name       VARCHAR(512),
    raw_json   LONGTEXT,
    synced_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_did (daftra_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS daftra_sync_log (
    entity      VARCHAR(64) PRIMARY KEY,
    count       INT DEFAULT 0,
    synced_at   DATETIME,
    synced_by   VARCHAR(128)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

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

    case 'update_permissions':
        $user_id = (int)($input_data['user_id'] ?? 0);
        $perms   = $input_data['permissions'] ?? [];
        if (!$user_id) {
            echo json_encode(["success" => false, "message" => "معرّف الموظف مطلوب"]);
            break;
        }
        if (!is_array($perms)) $perms = [];
        $perms_json = $conn->real_escape_string(json_encode(array_values($perms), JSON_UNESCAPED_UNICODE));
        if ($conn->query("UPDATE users SET permissions='$perms_json' WHERE id=$user_id")) {
            echo json_encode(["success" => true, "message" => "تم تحديث الصلاحيات بنجاح"]);
        } else {
            echo json_encode(["success" => false, "message" => $conn->error]);
        }
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

        // ── منع تكرار الجوال: إذا الرقم مسجل مسبقاً، أضف الاهتمام للسجل القائم ──
        $clean_phone   = preg_replace('/\D/', '', $phone);
        $phone_no_zero = preg_replace('/^(0|966)/', '', $clean_phone);
        $dup_res = $conn->query("SELECT id, interest, notes FROM leads WHERE REPLACE(REPLACE(phone, '+', ''), ' ', '') LIKE '%$phone_no_zero%' ORDER BY id DESC LIMIT 1");
        if ($dup_res && $dup_row = $dup_res->fetch_assoc()) {
            $existing_id       = (int)$dup_row['id'];
            $existing_interest = $dup_row['interest'] ?? '';
            $existing_notes    = $dup_row['notes'] ?? '';
            $stamp             = date('Y-m-d H:i');
            $new_interest = $existing_interest;
            if ($interest && strpos($existing_interest, $interest) === false) {
                $new_interest = $existing_interest ? "$existing_interest، $interest" : $interest;
            }
            $appended_note = "[$stamp - $source] اهتمام إضافي: $interest";
            $merged_notes  = $existing_notes ? "$existing_notes\n$appended_note" : $appended_note;
            $safe_interest = $conn->real_escape_string($new_interest);
            $safe_notes    = $conn->real_escape_string($merged_notes);
            $conn->query("UPDATE leads SET interest='$safe_interest', notes='$safe_notes', status='جديد' WHERE id=$existing_id");
            echo json_encode(["success" => true, "id" => $existing_id, "merged" => true]);
            break;
        }

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

    // ─── عدادات لوحة الإدارة (شارات الإشعارات) ─────────────────────────────────
    case 'dashboard_counts':
        $counts = [];
        $tasks  = [];

        // مهتمون جدد (لم تتغير حالتهم بعد)
        $r = $conn->query("SELECT COUNT(*) c FROM leads WHERE status = 'جديد'");
        $counts['leads_new'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['leads_new'] > 0) {
            $tasks[] = ["icon" => "Users", "color" => "teal", "tab" => "leads",
                "text" => "{$counts['leads_new']} مهتم جديد ينتظر المتابعة"];
        }

        // طلبات صيانة مفتوحة
        $r = $conn->query("SELECT COUNT(*) c FROM maintenance WHERE status NOT IN ('مكتمل', 'مغلق', 'ملغي')");
        $counts['maintenance_open'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['maintenance_open'] > 0) {
            $tasks[] = ["icon" => "Wrench", "color" => "purple", "tab" => "maintenance",
                "text" => "{$counts['maintenance_open']} طلب صيانة مفتوح"];
        }

        // طلبات صيانة بلا فني
        $r = $conn->query("SELECT COUNT(*) c FROM maintenance WHERE (technician IS NULL OR technician = '' OR technician = 'لم يتم التعيين') AND status NOT IN ('مكتمل', 'مغلق', 'ملغي')");
        $counts['maintenance_unassigned'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['maintenance_unassigned'] > 0) {
            $tasks[] = ["icon" => "AlertTriangle", "color" => "red", "tab" => "maintenance",
                "text" => "{$counts['maintenance_unassigned']} طلب صيانة بدون فني معيّن"];
        }

        // محادثات البوت اليوم
        $r = $conn->query("SELECT COUNT(DISTINCT phone) c FROM wa_bot_conversations WHERE DATE(created_at) = CURDATE()");
        $counts['bot_customers_today'] = (int)($r ? $r->fetch_assoc()['c'] : 0);

        // تقارير ملاحظات (snaglist) معلقة
        $r = $conn->query("SELECT COUNT(*) c FROM inspections WHERE status IS NULL OR status = ''");
        $counts['inspections_pending'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['inspections_pending'] > 0) {
            $tasks[] = ["icon" => "ClipboardCheck", "color" => "indigo", "tab" => "inspection",
                "text" => "{$counts['inspections_pending']} فحص لم يُغلق بعد"];
        }

        // اعتراضات ميزانية (في الملاحظات)
        $r = $conn->query("SELECT COUNT(*) c FROM leads WHERE notes LIKE '%ميزانية%' OR notes LIKE '%اعتراض%'");
        $counts['budget_objections'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['budget_objections'] > 0) {
            $tasks[] = ["icon" => "DollarSign", "color" => "amber", "tab" => "leads",
                "text" => "{$counts['budget_objections']} عميل أبدى اعتراض ميزانية يحتاج مراجعة الإدارة"];
        }

        echo json_encode(["success" => true, "counts" => $counts, "tasks" => $tasks]);
        break;

    // ═══════════════════════════════════════════════════════════════════════
    // تكامل دفترة (سماك الخير - المقاول الداخلي)
    // ═══════════════════════════════════════════════════════════════════════

    case 'daftra_check_key':
        // التحقق من أن المفتاح وصل بشكل صحيح (إظهار أول وآخر 4 حروف فقط)
        $daftra_key = "__DAFTRA_KEY__";
        $is_placeholder = strpos($daftra_key, '__DAFTRA') !== false;
        echo json_encode([
            "is_placeholder_not_replaced" => $is_placeholder,
            "key_length" => strlen($daftra_key),
            "key_first4" => substr($daftra_key, 0, 4),
            "key_last4"  => substr($daftra_key, -4),
            "expected_length" => 40,
            "hint" => $is_placeholder
                ? "GitHub Secret لم يُحقن — تأكد إن اسم السر بالضبط DAFTRA_API_KEY"
                : "المفتاح موجود، إذا الطول 40 والـ 5c98...bbf4 موجودة، يعني المفتاح وصل تمام والمشكلة في صلاحيات API في دفترة",
        ]);
        break;

    case 'daftra_test':
        // اختبار endpoints مختلفة (الـ auth نجح، نبحث عن endpoint صحيح)
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";

        $endpoints = [
            "projects/list/1.json",
            "projects/list.json",
            "projects.json",
            "clients/list/1.json",
            "clients.json",
            "invoices/list/1.json",
            "invoices.json",
            "expenses/list/1.json",
            "expenses.json",
            "products/list/1.json",
        ];

        $results = [];
        foreach ($endpoints as $ep) {
            $ch = curl_init("$base/$ep");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ["APIKEY: $daftra_key", "Accept: application/json"],
                CURLOPT_TIMEOUT => 10,
            ]);
            $res = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $results[$ep] = [
                "http" => $http,
                "preview" => substr($res ?: '', 0, 150),
            ];
        }

        echo json_encode([
            "base_url" => $base,
            "results" => $results,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_summary':
        // ملخص مالي شامل من دفترة (سماك الخير - المقاول الداخلي)
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $fetch = function($endpoint) use ($base, $headers) {
            $ch = curl_init("$base/$endpoint");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 15,
            ]);
            $res = curl_exec($ch);
            curl_close($ch);
            return json_decode($res, true);
        };

        $invoices_data = $fetch("invoices.json");
        $expenses_data = $fetch("expenses.json");
        $clients_data  = $fetch("clients.json");

        $total_invoiced = 0;
        $total_paid = 0;
        $invoice_count = 0;
        $unpaid_count = 0;
        $invoices_by_client = [];

        if (isset($invoices_data['data'])) {
            foreach ($invoices_data['data'] as $row) {
                $i = $row['Invoice'] ?? [];
                // الحقول الصحيحة في دفترة: summary_total / summary_paid / summary_unpaid
                $total  = (float)($i['summary_total']  ?? 0);
                $paid   = (float)($i['summary_paid']   ?? 0);
                $unpaid = (float)($i['summary_unpaid'] ?? max(0, $total - $paid));

                $total_invoiced += $total;
                $total_paid     += $paid;
                $invoice_count++;
                if ($unpaid > 0.01) $unpaid_count++;

                $cid = $i['client_id'] ?? 0;
                $cname = $i['client_business_name']
                       ?: trim(($i['client_first_name'] ?? '') . ' ' . ($i['client_last_name'] ?? ''))
                       ?: 'عميل #' . $cid;
                if (!isset($invoices_by_client[$cid])) {
                    $invoices_by_client[$cid] = ['name'=>$cname,'total'=>0,'paid'=>0,'unpaid'=>0,'count'=>0];
                }
                $invoices_by_client[$cid]['total']  += $total;
                $invoices_by_client[$cid]['paid']   += $paid;
                $invoices_by_client[$cid]['unpaid'] += $unpaid;
                $invoices_by_client[$cid]['count']++;
            }
        }

        $total_expenses = 0;
        $expense_count = 0;
        $expenses_by_category = [];
        if (isset($expenses_data['data'])) {
            foreach ($expenses_data['data'] as $row) {
                $e = $row['Expense'] ?? [];
                $amount = (float)($e['amount'] ?? 0);
                $cat    = $e['category'] ?? 'بدون تصنيف';
                $total_expenses += $amount;
                $expense_count++;
                if (!isset($expenses_by_category[$cat])) $expenses_by_category[$cat] = ['total'=>0,'count'=>0];
                $expenses_by_category[$cat]['total'] += $amount;
                $expenses_by_category[$cat]['count']++;
            }
        }

        $clients_count = isset($clients_data['data']) ? count($clients_data['data']) : 0;

        echo json_encode([
            "success" => true,
            "summary" => [
                "total_invoiced"   => round($total_invoiced, 2),
                "total_paid"       => round($total_paid, 2),
                "outstanding"      => round($total_invoiced - $total_paid, 2),
                "total_expenses"   => round($total_expenses, 2),
                "net_cashflow"     => round($total_paid - $total_expenses, 2),
                "invoice_count"    => $invoice_count,
                "unpaid_count"     => $unpaid_count,
                "expense_count"    => $expense_count,
                "clients_count"    => $clients_count,
                "currency"         => "SAR",
            ],
            "expenses_by_category" => $expenses_by_category,
            "invoices_by_client"   => $invoices_by_client,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'discover_workflows':
        // ─── v2: اكتشاف workflow IDs المتاحة في الحساب ──────────────────────
        set_time_limit(45);
        $dk   = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com";
        $hh   = ["APIKEY: $dk", "Accept: application/json"];

        $results = [];
        for ($wid = 1; $wid <= 15; $wid++) {
            $url = "$base/v2/api/entity/le_workflow-type-entity-$wid/list/1";
            $ch  = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => $hh,
                CURLOPT_TIMEOUT        => 6,
                CURLOPT_FOLLOWLOCATION => true,
            ]);
            $res  = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $json = json_decode($res, true);
            $has_data = $code === 200 && $json !== null && !isset($json['error']) && !isset($json['message']);

            $results[] = [
                'workflow_id' => $wid,
                'url'         => $url,
                'http_code'   => $code,
                'has_data'    => $has_data,
                'preview'     => substr($res, 0, 300),
                'keys'        => $json !== null ? array_keys((array)$json) : null,
            ];

            if ($has_data) break; // وجدنا بيانات — توقف
        }

        echo json_encode(['success' => true, 'results' => $results], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'dept_stats':
        // ─── إحصائيات سريعة لكل قسم (تُدمج في لوحة التحكم) ─────────────────
        set_time_limit(40);
        $dk   = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $hh   = ["APIKEY: $dk", "Accept: application/json"];

        $qfetch = function($ep) use ($base, $hh) {
            $ch = curl_init("$base/$ep");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => $hh,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_FOLLOWLOCATION => true,
            ]);
            $r = curl_exec($ch); curl_close($ch);
            return json_decode($r, true);
        };

        $month = date('Y-m-01');
        $today = date('Y-m-d');

        // ── جلب البيانات بالتوازي نسبياً ──
        $r_clients   = $qfetch("clients.json?limit=1");
        $r_suppliers = $qfetch("suppliers.json?limit=1");
        $r_inv_all   = $qfetch("invoices.json?limit=100");
        $r_inv_month = $qfetch("invoices.json?from_date=$month&to_date=$today&limit=100");
        $r_exp_all   = $qfetch("expenses.json?limit=100");
        $r_exp_month = $qfetch("expenses.json?from_date=$month&to_date=$today&limit=100");

        // ── جلب دورات العمل من V2 API ──
        $wf_ch = curl_init("https://semak.daftra.com/v2/api/entity/le_workflow-type-entity-1/list/1");
        curl_setopt_array($wf_ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $hh,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        $wf_raw = curl_exec($wf_ch); curl_close($wf_ch);
        $wf_data = json_decode($wf_raw, true);
        $wf_rows = $wf_data['data'] ?? [];
        // نستخدم count($wf_rows) فقط — حقل total قد يعني عدد الصفحات لا السجلات
        $wf_total = count($wf_rows);

        // ── تحليل ──
        $clients_total   = (int)($r_clients['meta']['total'] ?? count($r_clients['data'] ?? []));
        $suppliers_total = (int)($r_suppliers['meta']['total'] ?? count($r_suppliers['data'] ?? []));

        // عدد المشاريع النشطة (لا تحمل حالة متابعة = لم تكتمل بعد)
        $wo_total = $wf_total;
        $wo_open  = count(array_filter($wf_rows, fn($x) => !empty($x['id']) && ($x['follow_up_status_id'] ?? null) === null));

        $sum_inv = function($rows) {
            $t = 0; foreach ($rows as $r) $t += (float)($r['Invoice']['summary_total'] ?? $r['Invoice']['grand_total'] ?? 0); return $t;
        };
        $sum_exp = function($rows) {
            $t = 0; foreach ($rows as $r) $t += (float)($r['Expense']['amount'] ?? $r['Expense']['total'] ?? 0); return $t;
        };

        $rev_all   = $sum_inv($r_inv_all['data']   ?? []);
        $rev_month = $sum_inv($r_inv_month['data'] ?? []);
        $exp_all   = $sum_exp($r_exp_all['data']   ?? []);
        $exp_month = $sum_exp($r_exp_month['data'] ?? []);

        $inv_month_count = count($r_inv_month['data'] ?? []);

        echo json_encode([
            'success'     => true,
            'sales'       => ['clients' => $clients_total, 'invoices_month' => $inv_month_count, 'revenue_month' => $rev_month],
            'procurement' => ['suppliers' => $suppliers_total, 'work_orders' => $wo_total, 'open' => $wo_open],
            'finance'     => ['revenue_all' => $rev_all, 'expenses_all' => $exp_all, 'revenue_month' => $rev_month, 'expenses_month' => $exp_month, 'net' => $rev_all - $exp_all],
            '_src'        => 'v2-wf',
            '_wf_count'   => count($wf_rows),
            '_wf_total'   => $wf_total,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'dashboard_trend':
        // ─── اتجاه آخر 6 أشهر: إيرادات + مصروفات (للرسم البياني) ─────────────
        set_time_limit(40);
        $dk   = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $hh   = ["APIKEY: $dk", "Accept: application/json"];

        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $ts = strtotime("first day of -$i month");
            $months[date('Y-m', $ts)] = [
                'key'      => date('Y-m', $ts),
                'label'    => ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][(int)date('n', $ts)-1],
                'revenue'  => 0,
                'expenses' => 0,
            ];
        }
        $start = date('Y-m-01', strtotime('first day of -5 month'));
        $end   = date('Y-m-d');

        $fetch_paged = function($ep) use ($base, $hh) {
            $all = []; $pg = 1;
            while ($pg <= 15) {
                $sep = strpos($ep,'?')!==false ? '&' : '?';
                $ch = curl_init("$base/$ep{$sep}page=$pg&limit=100");
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>$hh, CURLOPT_TIMEOUT=>10, CURLOPT_FOLLOWLOCATION=>true]);
                $r = curl_exec($ch); curl_close($ch);
                $d = json_decode($r, true);
                if (!$d || empty($d['data'])) break;
                $all = array_merge($all, $d['data']);
                if (count($d['data']) < 100) break;
                $pg++;
            }
            return $all;
        };

        $invoices = $fetch_paged("invoices.json?from_date=$start&to_date=$end");
        $expenses = $fetch_paged("expenses.json?from_date=$start&to_date=$end");

        foreach ($invoices as $r) {
            $inv = $r['Invoice'] ?? $r;
            $m = substr($inv['date'] ?? '', 0, 7);
            if (isset($months[$m])) $months[$m]['revenue'] += (float)($inv['summary_total'] ?? $inv['grand_total'] ?? 0);
        }
        foreach ($expenses as $r) {
            $e = $r['Expense'] ?? $r;
            $m = substr($e['date'] ?? '', 0, 7);
            if (isset($months[$m])) $months[$m]['expenses'] += (float)($e['amount'] ?? $e['total'] ?? 0);
        }

        echo json_encode([
            'success' => true,
            'trend'   => array_values($months),
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_invoices':
        // قائمة الفواتير
        $daftra_key = "__DAFTRA_KEY__";
        $ch = curl_init("https://semak.daftra.com/api2/invoices.json");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ["APIKEY: $daftra_key", "Accept: application/json"],
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        echo $res;
        break;

    case 'daftra_expenses':
        // قائمة المصروفات
        $daftra_key = "__DAFTRA_KEY__";
        $ch = curl_init("https://semak.daftra.com/api2/expenses.json");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ["APIKEY: $daftra_key", "Accept: application/json"],
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        echo $res;
        break;

    case 'daftra_clients':
        // قائمة العملاء
        $daftra_key = "__DAFTRA_KEY__";
        $ch = curl_init("https://semak.daftra.com/api2/clients.json");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ["APIKEY: $daftra_key", "Accept: application/json"],
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        echo $res;
        break;

    // ══════════════════════════════════════════════════════════════════════
    // وحدة الفواتير — CRUD كامل
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_invoices_list':
        set_time_limit(30);
        $dk   = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $hh   = ["APIKEY: $dk", "Accept: application/json"];
        $page = (int)($_GET['page'] ?? 1);
        $limit = (int)($_GET['limit'] ?? 50);
        $from = $_GET['from'] ?? '';
        $to   = $_GET['to']   ?? '';
        $qp   = "page=$page&limit=$limit";
        if ($from) $qp .= "&from_date=$from";
        if ($to)   $qp .= "&to_date=$to";
        $ch = curl_init("$base/invoices.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>$hh, CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $data = json_decode($res, true) ?? [];
        // تسوية البيانات
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $i = $r['Invoice'] ?? $r;
            $rows[] = [
                'id'           => $i['id'],
                'no'           => $i['no'] ?? '',
                'date'         => $i['date'] ?? '',
                'client_id'    => $i['client_id'] ?? '',
                'client'       => $i['client_business_name'] ?? ($i['client_first_name'].' '.$i['client_last_name']),
                'phone'        => $i['client_mobile'] ?? $i['client_phone1'] ?? $i['client_phone2'] ?? '',
                'total'        => (float)($i['summary_total'] ?? $i['grand_total'] ?? 0),
                'paid'         => (float)($i['summary_paid'] ?? 0),
                'status'       => $i['status'] ?? '',
                'work_order_id'=> $i['work_order_id'] ?? null,
                'currency'     => $i['currency_code'] ?? 'SAR',
                'notes'        => $i['notes'] ?? '',
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows,'meta'=>$data['meta']??[]], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_invoice_single':
        $dk = "__DAFTRA_KEY__"; $inv_id = (int)($_GET['id']??0);
        if (!$inv_id) { echo json_encode(['success'=>false,'message'=>'id مطلوب']); break; }
        $ch = curl_init("https://semak.daftra.com/api2/invoices/$inv_id.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200) { echo json_encode(['success'=>false,'http_code'=>$code]); break; }
        echo json_encode(['success'=>true,'data'=>json_decode($res,true)], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_invoice_create':
    case 'daftra_invoice_update':
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $inv_id = (int)($body['id'] ?? $_GET['id'] ?? 0);
        $is_update = ($action === 'daftra_invoice_update' && $inv_id > 0);
        $url    = $is_update
            ? "https://semak.daftra.com/api2/invoices/$inv_id.json"
            : "https://semak.daftra.com/api2/invoices.json";
        $method = $is_update ? 'PUT' : 'POST';
        // بناء هيكل دفترة
        $items = [];
        foreach ($body['items'] ?? [] as $it) {
            $items[] = [
                'name'       => $it['name']       ?? '',
                'quantity'   => (float)($it['quantity']   ?? 1),
                'unit_price' => (float)($it['unit_price'] ?? 0),
                'discount'   => (float)($it['discount']   ?? 0),
                'tax'        => (float)($it['tax']        ?? 15),
            ];
        }
        $payload = ['Invoice' => [
            'client_id'     => $body['client_id']     ?? '',
            'date'          => $body['date']          ?? date('Y-m-d'),
            'currency_code' => $body['currency']      ?? 'SAR',
            'work_order_id' => $body['work_order_id'] ?? null,
            'notes'         => $body['notes']         ?? '',
            'InvoiceItem'   => $items,
        ]];
        if ($is_update) $payload['Invoice']['id'] = $inv_id;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ["APIKEY: $dk","Accept: application/json","Content-Type: application/json"],
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $resp = json_decode($res, true);
        echo json_encode([
            'success'   => in_array($code, [200,201]),
            'http_code' => $code,
            'data'      => $resp,
            'message'   => in_array($code,[200,201]) ? 'تمّ بنجاح' : 'فشل الإرسال',
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_invoice_delete':
        $dk = "__DAFTRA_KEY__"; $inv_id = (int)($_GET['id']??0);
        if (!$inv_id) { echo json_encode(['success'=>false]); break; }
        $ch = curl_init("https://semak.daftra.com/api2/invoices/$inv_id.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk"], CURLOPT_CUSTOMREQUEST=>'DELETE', CURLOPT_TIMEOUT=>15]);
        curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,204]),'http_code'=>$code]);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // المدفوعات والتحصيل — سندات قبض/صرف مربوطة بالفاتورة والخزينة
    // (دفترة تسجّل القيد المحاسبي وتحدّث الرصيد تلقائيًا)
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_invoice_payments_list':
        // قائمة دفعات العملاء — اختياريًا حسب الفاتورة
        $dk = "__DAFTRA_KEY__";
        $inv_id = (int)($_GET['invoice_id'] ?? 0);
        $page   = (int)($_GET['page'] ?? 1);
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $qp = "page=$page&limit=50";
        if ($inv_id) $qp .= "&invoice_id=$inv_id";
        if ($from)   $qp .= "&from_date=$from";
        if ($to)     $qp .= "&to_date=$to";
        $ch = curl_init("https://semak.daftra.com/api2/invoice_payments.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $p = $r['InvoicePayment'] ?? $r;
            $rows[] = [
                'id'         => $p['id'],
                'date'       => $p['date'] ?? '',
                'amount'     => (float)($p['amount'] ?? 0),
                'invoice_id' => $p['invoice_id'] ?? '',
                'invoice_no' => $p['invoice_no'] ?? '',
                'client'     => $p['client_business_name'] ?? ($p['client_first_name'].' '.$p['client_last_name']),
                'client_id'  => $p['client_id'] ?? '',
                'method'     => $p['payment_method'] ?? '',
                'treasury'   => $p['treasury_name'] ?? '',
                'treasury_id'=> $p['treasury_id'] ?? '',
                'notes'      => $p['notes'] ?? '',
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_invoice_payment_add':
        // سند قبض على فاتورة — يقفل/يخفّض الفاتورة ويزيد الخزينة
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $payload = ['InvoicePayment' => [
            'invoice_id'     => $body['invoice_id']  ?? '',
            'amount'         => (float)($body['amount'] ?? 0),
            'date'           => $body['date']        ?? date('Y-m-d'),
            'treasury_id'    => $body['treasury_id'] ?? '',
            'payment_method' => $body['method']      ?? 'cash',
            'notes'          => $body['notes']       ?? '',
        ]];
        $ch = curl_init("https://semak.daftra.com/api2/invoice_payments.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تم تسجيل الدفعة':'فشل التسجيل'], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_supplier_payments_list':
        // قائمة دفعات الموردين
        $dk = "__DAFTRA_KEY__";
        $pur_id = (int)($_GET['purchase_id'] ?? 0);
        $page   = (int)($_GET['page'] ?? 1);
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $qp = "page=$page&limit=50";
        if ($pur_id) $qp .= "&purchase_invoice_id=$pur_id";
        if ($from)   $qp .= "&from_date=$from";
        if ($to)     $qp .= "&to_date=$to";
        $ch = curl_init("https://semak.daftra.com/api2/purchase_invoice_payments.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $p = $r['PurchaseInvoicePayment'] ?? $r['PurchaseOrderPayment'] ?? $r;
            $rows[] = [
                'id'          => $p['id'],
                'date'        => $p['date'] ?? '',
                'amount'      => (float)($p['amount'] ?? 0),
                'purchase_id' => $p['purchase_invoice_id'] ?? $p['purchase_order_id'] ?? '',
                'supplier'    => $p['supplier_business_name'] ?? '',
                'supplier_id' => $p['supplier_id'] ?? '',
                'method'      => $p['payment_method'] ?? '',
                'treasury'    => $p['treasury_name'] ?? '',
                'notes'       => $p['notes'] ?? '',
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_supplier_payment_add':
        // سند صرف لمورد — يخفّض رصيد المورد ويخصم من الخزينة
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $payload = ['PurchaseInvoicePayment' => [
            'purchase_invoice_id' => $body['purchase_id'] ?? '',
            'supplier_id'         => $body['supplier_id'] ?? '',
            'amount'              => (float)($body['amount'] ?? 0),
            'date'                => $body['date']        ?? date('Y-m-d'),
            'treasury_id'         => $body['treasury_id'] ?? '',
            'payment_method'      => $body['method']      ?? 'cash',
            'notes'               => $body['notes']       ?? '',
        ]];
        $ch = curl_init("https://semak.daftra.com/api2/purchase_invoice_payments.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تم تسجيل الصرف':'فشل التسجيل'], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // PDF الرسمي من دفترة (عربي صحيح + ZATCA QR) — proxy بالجلسة المخزّنة
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_doc_pdf':
        // type: invoice | estimate | purchase   id: رقم المستند
        $type    = $_GET['type'] ?? 'invoice';
        $doc_id  = (int)($_GET['id'] ?? 0);
        $session = "__DAFTRA_SESSION__";
        if (!$doc_id) { echo json_encode(['success'=>false,'message'=>'id مطلوب']); break; }

        // مسارات الطباعة المرشّحة حسب نوع المستند (دفترة تولّد PDF عربي + QR)
        // الأنماط الصحيحة المؤكّدة من نظام دفترة الحيّ:
        //   فاتورة:  /owner/invoices/view/{id}.pdf   (وطباعة: /owner/invoices/view/{id}/print:1)
        $paths = [
            'invoice'  => ["/owner/invoices/view/$doc_id.pdf", "/owner/invoices/view/$doc_id/print:1"],
            'estimate' => ["/owner/invoices/view_estimate/$doc_id.pdf", "/owner/estimates/view/$doc_id.pdf", "/owner/invoices/view/$doc_id.pdf"],
            'purchase' => ["/owner/purchase_invoices/view/$doc_id.pdf", "/owner/purchase_invoices/view/$doc_id/print:1"],
        ];
        $candidates = $paths[$type] ?? $paths['invoice'];

        $pdf_body = null; $pdf_ctype = null; $tried = [];
        foreach ($candidates as $path) {
            $url = "https://semak.daftra.com$path";
            $ch  = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_TIMEOUT        => 25,
                CURLOPT_HTTPHEADER     => ["Cookie: $session", "Accept: application/pdf,text/html"],
                CURLOPT_USERAGENT      => 'Mozilla/5.0 SemakProxy',
            ]);
            $body  = curl_exec($ch);
            $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $ctype = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
            curl_close($ch);
            $tried[] = ['path'=>$path, 'code'=>$code, 'ctype'=>$ctype, 'len'=>strlen($body ?? '')];
            // PDF حقيقي يبدأ بـ %PDF
            if ($body && (stripos($ctype, 'pdf') !== false || substr($body, 0, 4) === '%PDF')) {
                $pdf_body  = $body; $pdf_ctype = 'application/pdf'; break;
            }
        }

        if ($pdf_body !== null) {
            ob_end_clean();
            header_remove('Content-Type');
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="'.$type.'_'.$doc_id.'.pdf"');
            header('Cache-Control: private, max-age=0, must-revalidate');
            echo $pdf_body;
            exit(0);
        }

        // فشل جلب PDF — نُرجع رابط الطباعة المباشر ليفتحه المتصفّح + سجل المحاولات
        echo json_encode([
            'success'   => false,
            'message'   => 'تعذّر جلب PDF — قد تكون الجلسة منتهية',
            'print_url' => "https://semak.daftra.com".$candidates[0],
            'tried'     => $tried,
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // وحدة المشتريات — CRUD كامل
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_purchases_list':
        set_time_limit(30);
        $dk   = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $qp   = "page=$page&limit=50";
        if ($from) $qp .= "&from_date=$from";
        if ($to)   $qp .= "&to_date=$to";
        $ch = curl_init("https://semak.daftra.com/api2/purchase_invoices.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $p = $r['PurchaseInvoice'] ?? $r['PurchaseOrder'] ?? $r;
            $rows[] = [
                'id'           => $p['id'],
                'no'           => $p['no']   ?? '',
                'date'         => $p['date'] ?? '',
                'supplier_id'  => $p['supplier_id'] ?? '',
                'supplier'     => $p['supplier_business_name'] ?? '',
                'total'        => (float)($p['summary_total'] ?? $p['grand_total'] ?? 0),
                'paid'         => (float)($p['summary_paid']  ?? 0),
                'work_order_id'=> $p['work_order_id'] ?? null,
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_purchase_create':
    case 'daftra_purchase_update':
        $dk   = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $pur_id    = (int)($body['id'] ?? $_GET['id'] ?? 0);
        $is_update = ($action === 'daftra_purchase_update' && $pur_id > 0);
        $url    = $is_update
            ? "https://semak.daftra.com/api2/purchase_invoices/$pur_id.json"
            : "https://semak.daftra.com/api2/purchase_invoices.json";
        $items = [];
        foreach ($body['items'] ?? [] as $it) {
            $items[] = ['name'=>$it['name']??'','quantity'=>(float)($it['quantity']??1),'unit_price'=>(float)($it['unit_price']??0),'discount'=>(float)($it['discount']??0),'tax'=>(float)($it['tax']??15)];
        }
        $payload = ['PurchaseInvoice' => [
            'supplier_id'   => $body['supplier_id']   ?? '',
            'date'          => $body['date']          ?? date('Y-m-d'),
            'work_order_id' => $body['work_order_id'] ?? null,
            'notes'         => $body['notes']         ?? '',
            'PurchaseInvoiceItem' => $items,
        ]];
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_CUSTOMREQUEST=>($is_update?'PUT':'POST'), CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تمّ بنجاح':'فشل'], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // وحدة الخزاين
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_treasuries':
        $dk = "__DAFTRA_KEY__";
        $ch = curl_init("https://semak.daftra.com/api2/treasuries.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $t = $r['Treasury'] ?? $r;
            $rows[] = ['id'=>$t['id'],'name'=>$t['name']??'','balance'=>(float)($t['balance']??0),'currency'=>$t['currency_code']??'SAR','status'=>$t['status']??1];
        }
        echo json_encode(['success'=>true,'data'=>$rows,'http_code'=>$code,'raw_count'=>count($data['data']??[])], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_treasury_transactions':
        $dk  = "__DAFTRA_KEY__";
        $tid = (int)($_GET['treasury_id'] ?? 0);
        $from= $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $qp  = $tid ? "treasury_id=$tid" : '';
        if ($from) $qp .= ($qp?'&':'')."from_date=$from";
        if ($to)   $qp .= ($qp?'&':'')."to_date=$to";
        $ch = curl_init("https://semak.daftra.com/api2/treasury_transactions.json".($qp?"?$qp":''));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $tx = $r['TreasuryTransaction'] ?? $r;
            $rows[] = ['id'=>$tx['id'],'date'=>$tx['date']??'','type'=>$tx['type']??'','amount'=>(float)($tx['amount']??0),'notes'=>$tx['notes']??'','treasury_id'=>$tx['treasury_id']??'','treasury'=>$tx['treasury_name']??''];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_treasury_add':
        $dk   = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $payload = ['TreasuryTransaction' => [
            'treasury_id' => $body['treasury_id'] ?? '',
            'type'        => $body['type']        ?? 'in',
            'date'        => $body['date']        ?? date('Y-m-d'),
            'amount'      => (float)($body['amount'] ?? 0),
            'notes'       => $body['notes']       ?? '',
        ]];
        $ch = curl_init("https://semak.daftra.com/api2/treasury_transactions.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true)], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // بيانات مرجعية: المنتجات / الموردون
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_products':
        $dk = "__DAFTRA_KEY__";
        $ch = curl_init("https://semak.daftra.com/api2/products.json?limit=200");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $pr = $r['Product'] ?? $r;
            $rows[] = ['id'=>$pr['id'],'name'=>$pr['name']??'','price'=>(float)($pr['selling_price']??0),'code'=>$pr['code']??''];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_suppliers_list':
        $dk = "__DAFTRA_KEY__";
        $ch = curl_init("https://semak.daftra.com/api2/suppliers.json?limit=200");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $s = $r['Supplier'] ?? $r;
            $rows[] = ['id'=>$s['id'],'name'=>$s['business_name']??($s['first_name'].' '.$s['last_name'])];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // عروض الأسعار — CRUD كامل
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_estimates_list':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $qp = "page=$page&limit=50";
        if ($from) $qp .= "&from_date=$from";
        if ($to)   $qp .= "&to_date=$to";
        $ch = curl_init("https://semak.daftra.com/api2/estimates.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $e = $r['Estimate'] ?? $r['Invoice'] ?? $r;
            $rows[] = [
                'id'        => $e['id'],
                'no'        => $e['no'] ?? '',
                'date'      => $e['date'] ?? '',
                'client_id' => $e['client_id'] ?? '',
                'client'    => $e['client_business_name'] ?? ($e['client_first_name'].' '.$e['client_last_name']),
                'total'     => (float)($e['summary_total'] ?? $e['grand_total'] ?? 0),
                'status'    => $e['status'] ?? '',
                'notes'     => $e['notes'] ?? '',
                'currency'  => $e['currency_code'] ?? 'SAR',
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_estimate_single':
        $dk = "__DAFTRA_KEY__"; $eid = (int)($_GET['id']??0);
        $ch = curl_init("https://semak.daftra.com/api2/estimates/$eid.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>$code===200,'data'=>json_decode($res,true)], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_estimate_create':
    case 'daftra_estimate_update':
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $eid = (int)($body['id'] ?? 0);
        $is_update = ($action === 'daftra_estimate_update' && $eid > 0);
        $url = $is_update ? "https://semak.daftra.com/api2/estimates/$eid.json" : "https://semak.daftra.com/api2/estimates.json";
        $items = [];
        foreach ($body['items'] ?? [] as $it) {
            $items[] = ['name'=>$it['name']??'','quantity'=>(float)($it['quantity']??1),'unit_price'=>(float)($it['unit_price']??0),'discount'=>(float)($it['discount']??0),'tax'=>(float)($it['tax']??15)];
        }
        $payload = ['Estimate' => [
            'client_id'    => $body['client_id'] ?? '',
            'date'         => $body['date']       ?? date('Y-m-d'),
            'currency_code'=> $body['currency']   ?? 'SAR',
            'notes'        => $body['notes']      ?? '',
            'EstimateItem' => $items,
        ]];
        if ($is_update) $payload['Estimate']['id'] = $eid;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_CUSTOMREQUEST=>($is_update?'PUT':'POST'), CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تمّ بنجاح':'فشل'], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_estimate_delete':
        $dk = "__DAFTRA_KEY__"; $eid = (int)($_GET['id']??0);
        $ch = curl_init("https://semak.daftra.com/api2/estimates/$eid.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk"], CURLOPT_CUSTOMREQUEST=>'DELETE', CURLOPT_TIMEOUT=>15]);
        curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,204])]);
        break;

    case 'daftra_estimate_to_invoice':
        // تحويل عرض السعر لفاتورة
        $dk = "__DAFTRA_KEY__"; $eid = (int)($_GET['id']??0);
        $ch = curl_init("https://semak.daftra.com/api2/estimates/$eid/convert_to_invoice.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>'{}', CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true)], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // المصروفات — CRUD كامل
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_expenses_list':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $qp = "page=$page&limit=50";
        if ($from) $qp .= "&from_date=$from";
        if ($to)   $qp .= "&to_date=$to";
        $ch = curl_init("https://semak.daftra.com/api2/expenses.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $e = $r['Expense'] ?? $r;
            $rows[] = [
                'id'          => $e['id'],
                'date'        => $e['date'] ?? '',
                'amount'      => (float)($e['amount'] ?? 0),
                'category'    => $e['category_name'] ?? $e['expense_category_name'] ?? '',
                'category_id' => $e['expense_category_id'] ?? '',
                'notes'       => $e['notes'] ?? $e['description'] ?? '',
                'supplier'    => $e['supplier_business_name'] ?? '',
                'supplier_id' => $e['supplier_id'] ?? '',
                'ref'         => $e['ref_no'] ?? $e['no'] ?? '',
                'work_order_id'=> $e['work_order_id'] ?? null,
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_expense_create':
    case 'daftra_expense_update':
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $exp_id = (int)($body['id'] ?? 0);
        $is_update = ($action === 'daftra_expense_update' && $exp_id > 0);
        $url = $is_update ? "https://semak.daftra.com/api2/expenses/$exp_id.json" : "https://semak.daftra.com/api2/expenses.json";
        $payload = ['Expense' => [
            'date'                => $body['date']         ?? date('Y-m-d'),
            'amount'              => (float)($body['amount'] ?? 0),
            'expense_category_id' => $body['category_id']  ?? '',
            'supplier_id'         => $body['supplier_id']  ?? '',
            'notes'               => $body['notes']        ?? '',
            'work_order_id'       => $body['work_order_id'] ?? null,
        ]];
        if ($is_update) $payload['Expense']['id'] = $exp_id;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_CUSTOMREQUEST=>($is_update?'PUT':'POST'), CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تمّ':'فشل'], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_expense_delete':
        $dk = "__DAFTRA_KEY__"; $exp_id = (int)($_GET['id']??0);
        $ch = curl_init("https://semak.daftra.com/api2/expenses/$exp_id.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk"], CURLOPT_CUSTOMREQUEST=>'DELETE', CURLOPT_TIMEOUT=>15]);
        curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,204])]);
        break;

    case 'daftra_expense_categories':
        $dk = "__DAFTRA_KEY__";
        $ch = curl_init("https://semak.daftra.com/api2/expense_categories.json?limit=100");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $c = $r['ExpenseCategory'] ?? $r;
            $rows[] = ['id'=>$c['id'],'name'=>$c['name']??''];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // سندات القبض / مدفوعات العملاء
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_incomes_list':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $qp = "page=$page&limit=50";
        if ($from) $qp .= "&from_date=$from";
        if ($to)   $qp .= "&to_date=$to";
        $ch = curl_init("https://semak.daftra.com/api2/incomes.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $inc = $r['Income'] ?? $r;
            $rows[] = [
                'id'        => $inc['id'],
                'date'      => $inc['date'] ?? '',
                'amount'    => (float)($inc['amount'] ?? 0),
                'client'    => $inc['client_business_name'] ?? ($inc['client_first_name'].' '.$inc['client_last_name']) ?? '',
                'client_id' => $inc['client_id'] ?? '',
                'notes'     => $inc['notes'] ?? '',
                'ref'       => $inc['ref_no'] ?? '',
                'treasury'  => $inc['treasury_name'] ?? '',
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_income_add':
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $payload = ['Income' => [
            'date'        => $body['date']        ?? date('Y-m-d'),
            'amount'      => (float)($body['amount'] ?? 0),
            'client_id'   => $body['client_id']   ?? '',
            'treasury_id' => $body['treasury_id'] ?? '',
            'notes'       => $body['notes']       ?? '',
        ]];
        $ch = curl_init("https://semak.daftra.com/api2/incomes.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تمّ':'فشل'], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // الشيكات — مستلمة ومدفوعة
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_cheques_list':
        $dk = "__DAFTRA_KEY__";
        $type = $_GET['type'] ?? 'receivable'; // receivable | payable
        $page = (int)($_GET['page'] ?? 1);
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $endpoint = ($type === 'payable') ? 'payable_cheques' : 'receivable_cheques';
        $qp = "page=$page&limit=50";
        if ($from) $qp .= "&from_date=$from";
        if ($to)   $qp .= "&to_date=$to";
        $ch = curl_init("https://semak.daftra.com/api2/{$endpoint}.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        $key = ($type === 'payable') ? 'PayableCheque' : 'ReceivableCheque';
        foreach ($data['data'] ?? [] as $r) {
            $c = $r[$key] ?? $r;
            $rows[] = [
                'id'          => $c['id'],
                'no'          => $c['cheque_no'] ?? $c['no'] ?? '',
                'amount'      => (float)($c['amount'] ?? 0),
                'due_date'    => $c['due_date'] ?? $c['date'] ?? '',
                'bank'        => $c['bank_name'] ?? '',
                'status'      => $c['status'] ?? '',
                'party'       => $c['client_business_name'] ?? $c['supplier_business_name'] ?? '',
                'notes'       => $c['notes'] ?? '',
                'type'        => $type,
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_cheque_update_status':
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $cheque_id = (int)($body['id'] ?? 0);
        $type = $body['type'] ?? 'receivable';
        $status = $body['status'] ?? '';
        $endpoint = ($type === 'payable') ? 'payable_cheques' : 'receivable_cheques';
        $key = ($type === 'payable') ? 'PayableCheque' : 'ReceivableCheque';
        $payload = [$key => ['id' => $cheque_id, 'status' => $status]];
        $ch = curl_init("https://semak.daftra.com/api2/{$endpoint}/$cheque_id.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_CUSTOMREQUEST=>'PUT', CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // إدارة العملاء — CRUD كامل
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_clients_list':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $search = $_GET['search'] ?? '';
        $qp = "page=$page&limit=50";
        if ($search) $qp .= "&search=$search";
        $ch = curl_init("https://semak.daftra.com/api2/clients.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $c = $r['Client'] ?? $r;
            $rows[] = [
                'id'      => $c['id'],
                'name'    => $c['business_name'] ?? trim($c['first_name'].' '.$c['last_name']),
                'email'   => $c['email'] ?? '',
                'phone'   => $c['phone'] ?? $c['mobile'] ?? '',
                'address' => $c['address'] ?? '',
                'balance' => (float)($c['balance'] ?? 0),
                'created' => $c['created'] ?? '',
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows,'total'=>$data['meta']['total']??count($rows)], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_client_create':
    case 'daftra_client_update':
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $cid = (int)($body['id'] ?? 0);
        $is_update = ($action === 'daftra_client_update' && $cid > 0);
        $url = $is_update ? "https://semak.daftra.com/api2/clients/$cid.json" : "https://semak.daftra.com/api2/clients.json";
        $payload = ['Client' => [
            'business_name' => $body['name']    ?? '',
            'email'         => $body['email']   ?? '',
            'phone'         => $body['phone']   ?? '',
            'mobile'        => $body['phone']   ?? '',
            'address'       => $body['address'] ?? '',
            'notes'         => $body['notes']   ?? '',
        ]];
        if ($is_update) $payload['Client']['id'] = $cid;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_CUSTOMREQUEST=>($is_update?'PUT':'POST'), CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تمّ':'فشل'], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_client_delete':
        $dk = "__DAFTRA_KEY__"; $cid = (int)($_GET['id']??0);
        $ch = curl_init("https://semak.daftra.com/api2/clients/$cid.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk"], CURLOPT_CUSTOMREQUEST=>'DELETE', CURLOPT_TIMEOUT=>15]);
        curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,204])]);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // إدارة الموردين — CRUD كامل
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_supplier_create':
    case 'daftra_supplier_update':
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sid = (int)($body['id'] ?? 0);
        $is_update = ($action === 'daftra_supplier_update' && $sid > 0);
        $url = $is_update ? "https://semak.daftra.com/api2/suppliers/$sid.json" : "https://semak.daftra.com/api2/suppliers.json";
        $payload = ['Supplier' => [
            'business_name' => $body['name']    ?? '',
            'email'         => $body['email']   ?? '',
            'phone'         => $body['phone']   ?? '',
            'mobile'        => $body['phone']   ?? '',
            'address'       => $body['address'] ?? '',
            'notes'         => $body['notes']   ?? '',
        ]];
        if ($is_update) $payload['Supplier']['id'] = $sid;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_CUSTOMREQUEST=>($is_update?'PUT':'POST'), CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تمّ':'فشل'], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_supplier_delete':
        $dk = "__DAFTRA_KEY__"; $sid = (int)($_GET['id']??0);
        $ch = curl_init("https://semak.daftra.com/api2/suppliers/$sid.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk"], CURLOPT_CUSTOMREQUEST=>'DELETE', CURLOPT_TIMEOUT=>15]);
        curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,204])]);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // إدارة المنتجات والخدمات — CRUD كامل
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_products_list':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $search = $_GET['search'] ?? '';
        $qp = "page=$page&limit=50";
        if ($search) $qp .= "&search=$search";
        $ch = curl_init("https://semak.daftra.com/api2/products.json?$qp");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $p = $r['Product'] ?? $r;
            $rows[] = [
                'id'            => $p['id'],
                'name'          => $p['name']          ?? '',
                'code'          => $p['code']          ?? '',
                'selling_price' => (float)($p['selling_price']  ?? 0),
                'buying_price'  => (float)($p['buying_price']   ?? 0),
                'unit'          => $p['unit']          ?? '',
                'category'      => $p['category_name'] ?? '',
                'stock'         => (float)($p['quantity'] ?? $p['stock_quantity'] ?? 0),
                'type'          => $p['product_type']  ?? $p['type'] ?? '',
            ];
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_product_create':
    case 'daftra_product_update':
        $dk = "__DAFTRA_KEY__";
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $pid = (int)($body['id'] ?? 0);
        $is_update = ($action === 'daftra_product_update' && $pid > 0);
        $url = $is_update ? "https://semak.daftra.com/api2/products/$pid.json" : "https://semak.daftra.com/api2/products.json";
        $payload = ['Product' => [
            'name'          => $body['name']          ?? '',
            'code'          => $body['code']          ?? '',
            'selling_price' => (float)($body['selling_price'] ?? 0),
            'buying_price'  => (float)($body['buying_price']  ?? 0),
            'unit'          => $body['unit']          ?? '',
            'notes'         => $body['notes']         ?? '',
        ]];
        if ($is_update) $payload['Product']['id'] = $pid;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json","Content-Type: application/json"], CURLOPT_CUSTOMREQUEST=>($is_update?'PUT':'POST'), CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT=>20]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,201]),'http_code'=>$code,'data'=>json_decode($res,true),'message'=>in_array($code,[200,201])?'تمّ':'فشل'], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_product_delete':
        $dk = "__DAFTRA_KEY__"; $pid = (int)($_GET['id']??0);
        $ch = curl_init("https://semak.daftra.com/api2/products/$pid.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk"], CURLOPT_CUSTOMREQUEST=>'DELETE', CURLOPT_TIMEOUT=>15]);
        curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,204])]);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // الإيجارات — وحدات + حجوزات + عقود + أقساط + تسليم
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_rental_units':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $ch = curl_init("https://semak.daftra.com/v2/api/rental/units?page=$page&limit=50");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        echo json_encode(['success'=>true,'data'=>$data['data']??[],'meta'=>$data['meta']??[],'http_code'=>$code], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_reservation_orders':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $ch = curl_init("https://semak.daftra.com/v2/api/rental/reservation-orders?page=$page&limit=50");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        echo json_encode(['success'=>true,'data'=>$data['data']??[],'meta'=>$data['meta']??[],'http_code'=>$code], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_lease_contracts':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $ch = curl_init("https://semak.daftra.com/v2/api/entity/lease_contract/list/$page");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        echo json_encode(['success'=>true,'data'=>$data['data']??[],'meta'=>$data['meta']??[],'raw'=>$data,'http_code'=>$code], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_lease_contract_single':
        $dk = "__DAFTRA_KEY__"; $lid = (int)($_GET['id']??0);
        $ch = curl_init("https://semak.daftra.com/v2/api/entity/lease_contract/$lid/1");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>$code===200,'data'=>json_decode($res,true)], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_contract_installments':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $contract_id = $_GET['contract_id'] ?? '';
        $status = $_GET['status'] ?? ''; // paid | unpaid | overdue
        $url = "https://semak.daftra.com/v2/api/entity/contract_installment/list/$page";
        if ($contract_id || $status) {
            $filters = [];
            if ($contract_id) $filters[] = "lease_contract_id=$contract_id";
            if ($status)      $filters[] = "status=$status";
            $url .= '?'.implode('&', $filters);
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        echo json_encode(['success'=>true,'data'=>$data['data']??[],'meta'=>$data['meta']??[],'http_code'=>$code], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_unit_delivery':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $ch = curl_init("https://semak.daftra.com/v2/api/entity/le_workflow-type-entity-3/list/$page");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        echo json_encode(['success'=>true,'data'=>$data['data']??[],'meta'=>$data['meta']??[],'http_code'=>$code], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // المحاسبة + الأصول + الإشعارات والمرتجعات — passthrough مرن
    // (يُرجع البيانات الخام + http_code، والواجهة تعرض الحقول ديناميكيًا)
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_generic_get':
        // جلب عام لأي مورد دفترة — endpoint مُمرّر عبر allowlist للأمان
        $dk    = "__DAFTRA_KEY__";
        $key   = $_GET['resource'] ?? '';
        $page  = (int)($_GET['page'] ?? 1);
        $from  = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';

        // خريطة الموارد المسموحة → [نمط الرابط, مفتاح السجل]
        $map = [
            // المحاسبة (api2)
            'journals'        => ['https://semak.daftra.com/api2/journals.json',          'Journal'],
            'journal_accounts'=> ['https://semak.daftra.com/api2/journal_accounts.json',  'JournalAccount'],
            'cost_centers'    => ['https://semak.daftra.com/api2/cost_centers.json',       'CostCenter'],
            'assets'          => ['https://semak.daftra.com/api2/assets.json',             'Asset'],
            // الإشعارات والمرتجعات (api2)
            'credit_notes'    => ['https://semak.daftra.com/api2/credit_notes.json',       'CreditNote'],
            'refund_receipts' => ['https://semak.daftra.com/api2/refund_receipts.json',    'RefundReceipt'],
            // الكيانات (v2)
            'purchase_refund'    => ['https://semak.daftra.com/v2/api/entity/purchase_refund/list/{page}',     null],
            'purchase_debit_note'=> ['https://semak.daftra.com/v2/api/entity/purchase_debit_note/list/{page}', null],
            'employee_custody'   => ['https://semak.daftra.com/v2/api/entity/employee_custody/list/{page}',    null],
        ];

        if (!isset($map[$key])) { echo json_encode(['success'=>false,'message'=>'مورد غير معروف']); break; }
        [$urlPattern, $recKey] = $map[$key];

        $is_v2 = strpos($urlPattern, '{page}') !== false;
        if ($is_v2) {
            $url = str_replace('{page}', $page, $urlPattern);
        } else {
            $qp = "page=$page&limit=50";
            if ($from) $qp .= "&from_date=$from";
            if ($to)   $qp .= "&to_date=$to";
            $url = "$urlPattern?$qp";
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>18, CURLOPT_FOLLOWLOCATION=>true]);
        $res  = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];

        // تسطيح السجلات (إزالة الغلاف مثل Journal{} إن وُجد)
        $rows = [];
        foreach ($data['data'] ?? [] as $r) {
            $rows[] = ($recKey && isset($r[$recKey])) ? $r[$recKey] : $r;
        }
        echo json_encode(['success'=>true,'resource'=>$key,'data'=>$rows,'meta'=>$data['meta']??[],'http_code'=>$code], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // تقارير مالية شاملة
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_reports':
        set_time_limit(60);
        $dk   = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $hh   = ["APIKEY: $dk", "Accept: application/json"];
        $from = $_GET['from'] ?? date('Y-01-01');
        $to   = $_GET['to']   ?? date('Y-m-d');

        $fetch_all = function($ep) use ($base, $hh) {
            $all = []; $pg = 1;
            while ($pg <= 20) {
                $ch = curl_init("$base/$ep".( strpos($ep,'?')!==false ? '&' : '?' )."page=$pg&limit=100");
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>$hh, CURLOPT_TIMEOUT=>12, CURLOPT_FOLLOWLOCATION=>true]);
                $r = curl_exec($ch); curl_close($ch);
                $d = json_decode($r, true);
                if (!$d || empty($d['data'])) break;
                $all = array_merge($all, $d['data']);
                if (count($d['data']) < 100) break;
                $pg++;
            }
            return $all;
        };

        $inv_raw = $fetch_all("invoices.json?from_date=$from&to_date=$to");
        $pur_raw = $fetch_all("purchase_invoices.json?from_date=$from&to_date=$to");
        $exp_raw = $fetch_all("expenses.json?from_date=$from&to_date=$to");

        // الإيرادات
        $revenue = 0; $rev_paid = 0;
        $by_client = []; $by_month = [];
        foreach ($inv_raw as $r) {
            $i = $r['Invoice'] ?? $r;
            $total = (float)($i['summary_total'] ?? $i['grand_total'] ?? 0);
            $paid  = (float)($i['summary_paid'] ?? 0);
            $revenue += $total; $rev_paid += $paid;
            $cn = $i['client_business_name'] ?? ($i['client_first_name']??'').' '.($i['client_last_name']??'');
            $by_client[$cn] = ($by_client[$cn] ?? 0) + $total;
            $month = substr($i['date'] ?? date('Y-m'), 0, 7);
            $by_month[$month]['revenue'] = ($by_month[$month]['revenue'] ?? 0) + $total;
        }

        // المشتريات
        $purchases = 0;
        foreach ($pur_raw as $r) {
            $p = $r['PurchaseInvoice'] ?? $r['PurchaseOrder'] ?? $r;
            $purchases += (float)($p['summary_total'] ?? $p['grand_total'] ?? 0);
            $month = substr($p['date'] ?? date('Y-m'), 0, 7);
            $by_month[$month]['purchases'] = ($by_month[$month]['purchases'] ?? 0) + (float)($p['summary_total'] ?? $p['grand_total'] ?? 0);
        }

        // المصروفات
        $expenses = 0;
        foreach ($exp_raw as $r) {
            $e = $r['Expense'] ?? $r;
            $expenses += (float)($e['amount'] ?? $e['total'] ?? 0);
            $month = substr($e['date'] ?? date('Y-m'), 0, 7);
            $by_month[$month]['expenses'] = ($by_month[$month]['expenses'] ?? 0) + (float)($e['amount'] ?? 0);
        }

        // ترتيب الشهور
        ksort($by_month);

        // أكبر العملاء
        arsort($by_client);
        $top_clients = array_slice(array_map(fn($n,$v) => ['name'=>$n,'total'=>$v], array_keys($by_client), array_values($by_client)), 0, 10, true);

        echo json_encode([
            'success'     => true,
            'period'      => ['from'=>$from, 'to'=>$to],
            'summary'     => ['revenue'=>$revenue,'rev_paid'=>$rev_paid,'purchases'=>$purchases,'expenses'=>$expenses,'net'=>$revenue-$purchases-$expenses,'costs'=>$purchases+$expenses],
            'by_month'    => $by_month,
            'by_client'   => array_values($top_clients),
            'counts'      => ['invoices'=>count($inv_raw),'purchases'=>count($pur_raw),'expenses'=>count($exp_raw)],
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ═══════════════════════════════════════════════════════════════════════
    // دورات العمل (Work Cycles) — تجميع التكاليف والإيرادات بفترة ومشروع
    // ═══════════════════════════════════════════════════════════════════════

    case 'cycles_list':
        $res = $conn->query("SELECT * FROM work_cycles ORDER BY id DESC");
        $rows = [];
        if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
        echo json_encode(["success" => true, "data" => $rows]);
        break;

    case 'cycle_save':
        $id          = (int)($input_data['id'] ?? 0);
        $name        = $conn->real_escape_string($input_data['name'] ?? '');
        $description = $conn->real_escape_string($input_data['description'] ?? '');
        $project     = $conn->real_escape_string($input_data['project_name'] ?? '');
        $start       = $conn->real_escape_string($input_data['start_date'] ?? null);
        $end         = $conn->real_escape_string($input_data['end_date'] ?? null);
        $budget      = (float)($input_data['budget'] ?? 0);
        $suppliers   = $conn->real_escape_string(is_array($input_data['supplier_ids'] ?? null) ? implode(',', $input_data['supplier_ids']) : ($input_data['supplier_ids'] ?? ''));
        $categories  = $conn->real_escape_string(is_array($input_data['categories'] ?? null) ? implode(',', $input_data['categories']) : ($input_data['categories'] ?? ''));
        $status      = $conn->real_escape_string($input_data['status'] ?? 'active');

        if (!$name) { echo json_encode(["success" => false, "message" => "اسم الدورة مطلوب"]); break; }

        if ($id) {
            $sql = "UPDATE work_cycles SET name='$name', description='$description', project_name='$project',
                    start_date=" . ($start ? "'$start'" : "NULL") . ", end_date=" . ($end ? "'$end'" : "NULL") . ",
                    budget=$budget, supplier_ids='$suppliers', categories='$categories', status='$status'
                    WHERE id=$id";
            $conn->query($sql);
            echo json_encode(["success" => true, "id" => $id]);
        } else {
            $sql = "INSERT INTO work_cycles (name, description, project_name, start_date, end_date, budget, supplier_ids, categories, status)
                    VALUES ('$name', '$description', '$project',
                    " . ($start ? "'$start'" : "NULL") . ", " . ($end ? "'$end'" : "NULL") . ",
                    $budget, '$suppliers', '$categories', '$status')";
            if ($conn->query($sql)) {
                echo json_encode(["success" => true, "id" => $conn->insert_id]);
            } else {
                echo json_encode(["success" => false, "message" => $conn->error]);
            }
        }
        break;

    case 'cycle_delete':
        $id = (int)($input_data['id'] ?? 0);
        if ($id) $conn->query("DELETE FROM work_cycles WHERE id=$id");
        echo json_encode(["success" => true]);
        break;

    // ─── دورات العمل: مشاريع محلية + ربط دفترة ──────────────────────────────

    case 'get_project_cycles':
        // كل المشاريع المحلية مع عدد الوحدات (مصدر دورات العمل)
        $rows = $conn->query("SELECT p.id, p.name, p.description, p.status,
            COUNT(u.id) AS total_units,
            SUM(CASE WHEN u.status = 'مباعة' OR o.id IS NOT NULL THEN 1 ELSE 0 END) AS sold_units,
            SUM(CASE WHEN u.status != 'مباعة' AND o.id IS NULL THEN 1 ELSE 0 END) AS available_units,
            p.daftra_id
            FROM projects p
            LEFT JOIN units u ON u.project_id = p.id
            LEFT JOIN owners o ON o.unit_code = u.unit_code
            GROUP BY p.id ORDER BY p.id ASC");
        $projects = [];
        if ($rows) while ($r = $rows->fetch_assoc()) $projects[] = $r;
        echo json_encode(['success' => true, 'data' => $projects]);
        break;

    case 'set_project_daftra_id':
        // ربط مشروع محلي بـ work_order في دفترة
        $pid = (int)($input_data['project_id'] ?? 0);
        $did = ($input_data['daftra_id'] !== '' && $input_data['daftra_id'] !== null)
               ? (int)$input_data['daftra_id'] : 'NULL';
        // auto-migrate: إضافة عمود daftra_id إن لم يكن موجوداً
        $conn->query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS daftra_id INT DEFAULT NULL");
        $conn->query("UPDATE projects SET daftra_id=$did WHERE id=$pid");
        echo json_encode(['success' => true]);
        break;

    case 'project_cycle_summary':
        // ملخص دورة عمل لمشروع محلي: إحصائيات الوحدات + Daftra (إن كان مرتبطاً)
        $pid = (int)($_GET['id'] ?? 0);
        if (!$pid) { echo json_encode(['success' => false, 'message' => 'id مطلوب']); break; }

        // auto-migrate
        $conn->query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS daftra_id INT DEFAULT NULL");

        $pq = $conn->query("SELECT p.id, p.name, p.description, p.status, p.daftra_id,
            COUNT(u.id) AS total_units,
            SUM(CASE WHEN o.id IS NOT NULL THEN 1 ELSE 0 END) AS sold_units,
            SUM(CASE WHEN o.id IS NULL THEN 1 ELSE 0 END) AS available_units
            FROM projects p
            LEFT JOIN units u ON u.project_id = p.id
            LEFT JOIN owners o ON o.unit_code = u.unit_code
            WHERE p.id = $pid GROUP BY p.id");
        if (!$pq || $pq->num_rows === 0) { echo json_encode(['success' => false, 'message' => 'المشروع غير موجود']); break; }
        $project = $pq->fetch_assoc();

        // إحصائيات الوحدات التفصيلية
        $uq = $conn->query("SELECT u.unit_code, u.status, o.owner_name, o.owner_phone
            FROM units u LEFT JOIN owners o ON o.unit_code = u.unit_code
            WHERE u.project_id = $pid ORDER BY u.unit_code");
        $units = [];
        if ($uq) while ($r = $uq->fetch_assoc()) $units[] = $r;

        $daftra_summary = null;
        $invoices_list  = [];
        $purchases_list = [];
        $expenses_list  = [];

        $wo_id = (int)($project['daftra_id'] ?? 0);
        if ($wo_id > 0) {
            // جلب بيانات دفترة
            $daftra_key = "__DAFTRA_KEY__";
            $base = "https://semak.daftra.com/api2";
            $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

            $fetch_daftra = function($endpoint) use ($base, $headers) {
                $all = []; $page = 1;
                while ($page <= 50) {
                    $ch = curl_init("$base/$endpoint.json?page=$page&limit=100");
                    curl_setopt_array($ch, [
                        CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
                        CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
                    ]);
                    $res = curl_exec($ch); curl_close($ch);
                    $data = json_decode($res, true);
                    if (!isset($data['data']) || count($data['data']) === 0) break;
                    $all = array_merge($all, $data['data']);
                    if (count($data['data']) < 100) break;
                    $page++;
                }
                return $all;
            };

            $all_invoices  = $fetch_daftra("invoices");
            $all_purchases = $fetch_daftra("purchase_invoices");
            $all_expenses  = $fetch_daftra("expenses");

            $total_revenue = 0; $total_purchases = 0; $total_expenses = 0;

            foreach ($all_invoices as $r) {
                $i = $r['Invoice'] ?? [];
                if ((int)($i['work_order_id'] ?? 0) !== $wo_id) continue;
                $invoices_list[] = ['no' => $i['no'], 'date' => $i['date'],
                    'client' => $i['client_business_name'] ?? '',
                    'total' => (float)($i['summary_total'] ?? 0),
                    'paid'  => (float)($i['summary_paid'] ?? 0)];
                $total_revenue += (float)($i['summary_total'] ?? 0);
            }
            foreach ($all_purchases as $r) {
                $p = $r['PurchaseOrder'] ?? [];
                if ((int)($p['work_order_id'] ?? 0) !== $wo_id) continue;
                $purchases_list[] = ['no' => $p['no'], 'date' => $p['date'],
                    'supplier' => $p['supplier_business_name'] ?? '',
                    'total' => (float)($p['summary_total'] ?? 0),
                    'paid'  => (float)($p['summary_paid'] ?? 0)];
                $total_purchases += (float)($p['summary_total'] ?? 0);
            }
            foreach ($all_expenses as $r) {
                $e = $r['Expense'] ?? [];
                if ((int)($e['work_order_id'] ?? 0) !== $wo_id) continue;
                $expenses_list[] = ['date' => $e['date'], 'amount' => (float)($e['amount'] ?? 0),
                    'category' => $e['category'] ?? '', 'vendor' => $e['vendor'] ?? '', 'note' => $e['note'] ?? ''];
                $total_expenses += (float)($e['amount'] ?? 0);
            }

            $total_cost  = $total_purchases + $total_expenses;
            $net_profit  = $total_revenue - $total_cost;
            $daftra_summary = [
                'total_revenue'   => $total_revenue,
                'total_purchases' => $total_purchases,
                'total_expenses'  => $total_expenses,
                'total_cost'      => $total_cost,
                'net_profit'      => $net_profit,
            ];
        }

        echo json_encode([
            'success'  => true,
            'project'  => $project,
            'units'    => $units,
            'daftra'   => $daftra_summary,
            'invoices' => $invoices_list,
            'purchases'=> $purchases_list,
            'expenses' => $expenses_list,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_work_order_summary':
        // ملخّص شامل لـ Work Order (دورة عمل) من دفترة مع كل البنود المرتبطة
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];
        $wo_id = (int)($_GET['id'] ?? 0);
        if (!$wo_id) { echo json_encode(["success" => false, "message" => "id مطلوب"]); break; }

        $fetch_all = function($endpoint) use ($base, $headers) {
            $all = []; $page = 1;
            while ($page <= 50) {
                $ch = curl_init("$base/$endpoint.json?page=$page&limit=100");
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 15]);
                $res = curl_exec($ch); curl_close($ch);
                $data = json_decode($res, true);
                if (!isset($data['data']) || count($data['data']) === 0) break;
                $all = array_merge($all, $data['data']);
                if (count($data['data']) < 100) break;
                $page++;
            }
            return $all;
        };

        // جلب الدورة بحد ذاتها (مع FOLLOWLOCATION لأن Daftra يرد أحياناً بـ 302)
        $ch = curl_init("$base/work_orders/$wo_id.json");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
        ]);
        $wo_raw = curl_exec($ch);
        $wo_http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $wo_data = json_decode($wo_raw, true);
        $wo = $wo_data['WorkOrder'] ?? $wo_data['data']['WorkOrder'] ?? null;

        // جلب الكل وفلترة بـ work_order_id
        $invoices  = $fetch_all("invoices");
        $purchases = $fetch_all("purchase_invoices");
        $expenses  = $fetch_all("expenses");

        $matched_invoices = [];
        $total_revenue = 0; $paid_revenue = 0;
        foreach ($invoices as $r) {
            $i = $r['Invoice'] ?? [];
            if ((int)($i['work_order_id'] ?? 0) !== $wo_id) continue;
            $matched_invoices[] = [
                'id' => $i['id'], 'no' => $i['no'], 'date' => $i['date'],
                'client' => $i['client_business_name'] ?? '',
                'total' => (float)($i['summary_total'] ?? 0),
                'paid' => (float)($i['summary_paid'] ?? 0),
            ];
            $total_revenue += (float)($i['summary_total'] ?? 0);
            $paid_revenue  += (float)($i['summary_paid'] ?? 0);
        }

        $matched_purchases = [];
        $total_purchases = 0; $paid_purchases = 0;
        foreach ($purchases as $r) {
            $p = $r['PurchaseOrder'] ?? [];
            if ((int)($p['work_order_id'] ?? 0) !== $wo_id) continue;
            $matched_purchases[] = [
                'id' => $p['id'], 'no' => $p['no'], 'date' => $p['date'],
                'supplier' => $p['supplier_business_name'] ?? '',
                'total' => (float)($p['summary_total'] ?? 0),
                'paid' => (float)($p['summary_paid'] ?? 0),
            ];
            $total_purchases += (float)($p['summary_total'] ?? 0);
            $paid_purchases  += (float)($p['summary_paid'] ?? 0);
        }

        $matched_expenses = [];
        $total_expenses = 0;
        foreach ($expenses as $r) {
            $e = $r['Expense'] ?? [];
            if ((int)($e['work_order_id'] ?? 0) !== $wo_id) continue;
            $matched_expenses[] = [
                'id' => $e['id'], 'date' => $e['date'],
                'amount' => (float)($e['amount'] ?? 0),
                'category' => $e['category'] ?? '',
                'note' => $e['note'] ?? '',
                'vendor' => $e['vendor'] ?? '',
            ];
            $total_expenses += (float)($e['amount'] ?? 0);
        }

        $total_cost = $total_purchases + $total_expenses;
        $net_profit = $total_revenue - $total_cost;
        $budget = (float)($wo['budget'] ?? 0);
        $budget_left = $budget - $total_cost;
        $budget_used_pct = $budget > 0 ? round(($total_cost / $budget) * 100, 1) : 0;

        echo json_encode([
            "success" => true,
            "work_order" => $wo,
            "summary" => [
                "budget" => $budget,
                "total_revenue" => $total_revenue,
                "paid_revenue" => $paid_revenue,
                "total_purchases" => $total_purchases,
                "paid_purchases" => $paid_purchases,
                "total_expenses" => $total_expenses,
                "total_cost" => $total_cost,
                "net_profit" => $net_profit,
                "budget_left" => $budget_left,
                "budget_used_pct" => $budget_used_pct,
            ],
            "invoices" => $matched_invoices,
            "purchases" => $matched_purchases,
            "expenses" => $matched_expenses,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'cycle_summary':
        // إحصائيات دورة عمل: المصروفات + المشتريات + الفواتير الصادرة خلال الفترة
        $id = (int)($_GET['id'] ?? 0);
        $cycle_q = $conn->query("SELECT * FROM work_cycles WHERE id=$id");
        if (!$cycle_q || $cycle_q->num_rows === 0) {
            echo json_encode(["success" => false, "message" => "الدورة غير موجودة"]);
            break;
        }
        $cycle = $cycle_q->fetch_assoc();
        $start = $cycle['start_date'] ?? null;
        $end   = $cycle['end_date'] ?? null;
        $sup_ids = array_filter(explode(',', $cycle['supplier_ids'] ?? ''));
        $cats    = array_filter(array_map('trim', explode(',', $cycle['categories'] ?? '')));

        // جلب بيانات دفترة
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];
        $fetch_all = function($endpoint) use ($base, $headers) {
            $all = []; $page = 1;
            while ($page <= 50) {
                $ch = curl_init("$base/$endpoint.json?page=$page&limit=100");
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_TIMEOUT => 15,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS => 5,
                ]);
                $res = curl_exec($ch); curl_close($ch);
                $data = json_decode($res, true);
                if (!isset($data['data']) || count($data['data']) === 0) break;
                $all = array_merge($all, $data['data']);
                if (count($data['data']) < 100) break;
                $page++;
            }
            return $all;
        };

        $purchases = $fetch_all("purchase_invoices");
        $expenses  = $fetch_all("expenses");
        $invoices  = $fetch_all("invoices");

        $in_range = function($date) use ($start, $end) {
            if (!$date) return false;
            if ($start && $date < $start) return false;
            if ($end   && $date > $end)   return false;
            return true;
        };

        // المشتريات المنطبقة
        $matched_purchases = [];
        $total_purchases = 0;
        $paid_purchases = 0;
        foreach ($purchases as $r) {
            $p = $r['PurchaseOrder'] ?? [];
            if (!$in_range($p['date'] ?? '')) continue;
            if (count($sup_ids) > 0 && !in_array($p['supplier_id'] ?? '', $sup_ids)) continue;
            $matched_purchases[] = [
                'id' => $p['id'], 'no' => $p['no'], 'date' => $p['date'],
                'supplier' => $p['supplier_business_name'] ?? '',
                'total' => (float)($p['summary_total'] ?? 0),
                'paid'  => (float)($p['summary_paid']  ?? 0),
            ];
            $total_purchases += (float)($p['summary_total'] ?? 0);
            $paid_purchases  += (float)($p['summary_paid'] ?? 0);
        }

        // المصروفات المنطبقة
        $matched_expenses = [];
        $total_expenses = 0;
        foreach ($expenses as $r) {
            $e = $r['Expense'] ?? [];
            if (!$in_range($e['date'] ?? '')) continue;
            if (count($cats) > 0 && !in_array($e['category'] ?? '', $cats)) continue;
            $matched_expenses[] = [
                'id' => $e['id'], 'date' => $e['date'],
                'amount' => (float)($e['amount'] ?? 0),
                'category' => $e['category'] ?? '',
                'note' => $e['note'] ?? '',
            ];
            $total_expenses += (float)($e['amount'] ?? 0);
        }

        // الفواتير الصادرة (إيرادات الدورة)
        $matched_invoices = [];
        $total_revenue = 0;
        $paid_revenue = 0;
        foreach ($invoices as $r) {
            $i = $r['Invoice'] ?? [];
            if (!$in_range($i['date'] ?? '')) continue;
            $matched_invoices[] = [
                'id' => $i['id'], 'no' => $i['no'], 'date' => $i['date'],
                'client' => $i['client_business_name'] ?? '',
                'total' => (float)($i['summary_total'] ?? 0),
                'paid' => (float)($i['summary_paid'] ?? 0),
            ];
            $total_revenue += (float)($i['summary_total'] ?? 0);
            $paid_revenue  += (float)($i['summary_paid'] ?? 0);
        }

        $total_cost = $total_purchases + $total_expenses;
        $net_profit = $total_revenue - $total_cost;
        $budget_left = (float)$cycle['budget'] - $total_cost;

        echo json_encode([
            "success" => true,
            "cycle" => $cycle,
            "summary" => [
                "total_revenue" => $total_revenue,
                "paid_revenue"  => $paid_revenue,
                "total_purchases" => $total_purchases,
                "paid_purchases"  => $paid_purchases,
                "total_expenses"  => $total_expenses,
                "total_cost"      => $total_cost,
                "net_profit"      => $net_profit,
                "budget"          => (float)$cycle['budget'],
                "budget_left"     => $budget_left,
                "budget_used_pct" => $cycle['budget'] > 0 ? round(($total_cost / (float)$cycle['budget']) * 100, 1) : 0,
            ],
            "purchases" => $matched_purchases,
            "expenses"  => $matched_expenses,
            "invoices"  => $matched_invoices,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_view':
        // جلب تفاصيل سجل واحد كاملاً (مع الأصناف للفواتير)
        $daftra_key = "__DAFTRA_KEY__";
        $module = preg_replace('/[^a-z_]/i', '', $_GET['module'] ?? '');
        $id     = (int)($_GET['id'] ?? 0);
        if (!$module || !$id) {
            echo json_encode(["success" => false, "message" => "module و id مطلوبان"]);
            break;
        }
        // دفترة تقدم endpoint مختلف للتفاصيل: /api2/{module}/view/{id}.json
        $endpoints = [
            "$module/view/$id.json",   // الصيغة المعتادة
            "$module/$id.json",        // بديل
        ];
        $found = null;
        foreach ($endpoints as $ep) {
            $ch = curl_init("https://semak.daftra.com/api2/$ep");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ["APIKEY: $daftra_key", "Accept: application/json"],
                CURLOPT_TIMEOUT => 15,
            ]);
            $res = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($http === 200) {
                $found = json_decode($res, true);
                $found['_endpoint_used'] = $ep;
                break;
            }
        }
        echo json_encode($found ?: ["success" => false, "message" => "السجل غير موجود"], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_list':
        // endpoint عام لجلب أي وحدة من دفترة مع pagination محدود وtimeout قصير
        set_time_limit(45);
        $daftra_key = "__DAFTRA_KEY__";
        $module = preg_replace('/[^a-z_]/i', '', $_GET['module'] ?? '');
        if (!$module) {
            echo json_encode(["success" => false, "message" => "module مطلوب"]);
            break;
        }
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $all = [];
        $page = 1;
        $entity_key = null;
        $max_pages = 20; // حد آمن (= 2000 سجل max)
        $start_time = microtime(true);

        while ($page <= $max_pages) {
            // قطع التنفيذ لو الوقت تجاوز 40 ثانية
            if (microtime(true) - $start_time > 40) break;

            $url = "$base/$module.json?page=$page&limit=100";
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 10,           // أقصر للصفحة الواحدة
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 5,
            ]);
            $res = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($http !== 200) break;
            $data = json_decode($res, true);
            if (!isset($data['data']) || !is_array($data['data']) || count($data['data']) === 0) break;
            if (!$entity_key && count($data['data']) > 0) {
                $entity_key = array_keys($data['data'][0])[0] ?? null;
            }
            $all = array_merge($all, $data['data']);
            if (count($data['data']) < 100) break;
            $page++;
        }

        $flat = [];
        foreach ($all as $row) {
            $flat[] = $entity_key && isset($row[$entity_key]) ? $row[$entity_key] : $row;
        }

        echo json_encode([
            "success" => true,
            "module" => $module,
            "entity" => $entity_key,
            "count" => count($flat),
            "pages_fetched" => $page,
            "elapsed_sec" => round(microtime(true) - $start_time, 2),
            "data" => $flat,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_probe_modules':
        set_time_limit(90);
        $daftra_key = "__DAFTRA_KEY__";
        $base_domain = "https://semak.daftra.com";

        $try = function($url, $extra_headers = []) use ($daftra_key) {
            $hdrs = array_merge(
                ["APIKEY: $daftra_key", "Accept: application/json", "Content-Type: application/json"],
                $extra_headers
            );
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => $hdrs,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 5,
            ]);
            $res  = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $final_url = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
            curl_close($ch);
            $decoded = @json_decode($res, true);
            return [
                'http'        => $code,
                'final_url'   => $final_url,
                'has_data'    => isset($decoded['data']) && !empty($decoded['data']),
                'count'       => isset($decoded['data']) ? (is_array($decoded['data']) ? count($decoded['data']) : 1) : 0,
                'top_keys'    => is_array($decoded) ? array_keys($decoded) : [],
                'raw_preview' => substr($res ?? '', 0, 200),
            ];
        };

        $results = [];

        // 1) api2 — أسماء le_ المحتملة
        foreach (['le_work_cycle','le_work_cycles','le_project','le_projects_management',
                  'le_work_cycle_project','le_phase','le_milestone','le_stages'] as $m) {
            $results["api2/$m"] = $try("$base_domain/api2/$m.json?limit=5");
        }

        // 2) v2 REST API — أنماط مختلفة
        $v2_paths = [
            'v2/work_cycles',
            'v2/projects',
            'v2/le_projects',
            'v2/work_cycle_projects',
            'v2/owner/work_cycles',
            'v2/owner/projects',
        ];
        foreach ($v2_paths as $p) {
            $results[$p] = $try("$base_domain/$p");
        }

        // 3) v2 entity/workflow (النمط المعروف لـ دفترة الجديد)
        $entity_paths = [
            'v2/owner/entity/workflow/le_workflow_type-entity-1/list',
            'v2/owner/entity/workflow/le_workflow_type-entity-2/list',
            'v2/owner/entity/le_work_cycle/list',
            'v2/owner/entity/le_project/list',
        ];
        foreach ($entity_paths as $p) {
            $results[$p] = $try("$base_domain/$p");
        }

        // 4) جرب مع Authorization: Bearer بدل APIKEY header
        $results['v2_bearer/work_cycles'] = $try(
            "$base_domain/v2/work_cycles",
            ["Authorization: Bearer $daftra_key"]
        );
        $results['v2_bearer/projects'] = $try(
            "$base_domain/v2/projects",
            ["Authorization: Bearer $daftra_key"]
        );

        // ──── مرحلة 2: نفس الـ v2 endpoints مع APIKEY كـ query param وبدون FOLLOWLOCATION ────
        $try_nofollow = function($url, $extra_headers = []) use ($daftra_key) {
            $hdrs = array_merge(
                ["APIKEY: $daftra_key", "Accept: application/json"],
                $extra_headers
            );
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => $hdrs,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_FOLLOWLOCATION => false, // لا نتبع الـ redirect
                CURLOPT_HEADER         => true,  // نشوف الهيدرز
            ]);
            $res  = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            // نستخرج Location header
            preg_match('/Location:\s*(.+)/i', $res, $loc);
            $decoded = @json_decode($res, true);
            return [
                'http'     => $code,
                'location' => trim($loc[1] ?? ''),
                'is_json'  => $decoded !== null,
                'preview'  => substr($res, 0, 300),
            ];
        };

        $v2_base = "v2/owner/entity";
        $candidates2 = [
            "nofollow/{$v2_base}/le_work_cycle/list"    => "$base_domain/{$v2_base}/le_work_cycle/list",
            "nofollow/{$v2_base}/le_project/list"       => "$base_domain/{$v2_base}/le_project/list",
            "queryparam/le_work_cycle?APIKEY"           => "$base_domain/{$v2_base}/le_work_cycle/list?APIKEY=$daftra_key",
            "queryparam/le_work_cycle?api_key"          => "$base_domain/{$v2_base}/le_work_cycle/list?api_key=$daftra_key",
            "queryparam/le_work_cycle?apikey"           => "$base_domain/{$v2_base}/le_work_cycle/list?apikey=$daftra_key",
            "queryparam/le_project?APIKEY"              => "$base_domain/{$v2_base}/le_project/list?APIKEY=$daftra_key",
            "bearer/le_work_cycle"                      => "$base_domain/{$v2_base}/le_work_cycle/list",
            "bearer/le_project"                         => "$base_domain/{$v2_base}/le_project/list",
        ];

        $extra_headers_map = [
            "bearer/le_work_cycle" => ["Authorization: Bearer $daftra_key"],
            "bearer/le_project"    => ["Authorization: Bearer $daftra_key"],
        ];

        foreach ($candidates2 as $label => $url) {
            $results["phase2/$label"] = $try_nofollow($url, $extra_headers_map[$label] ?? []);
        }

        // فلتر: أظهر فقط اللي ما راحت 404
        $non404 = array_filter($results, fn($r) => $r['http'] !== 404);

        echo json_encode([
            'success'   => true,
            'non_404'   => $non404,
            'all_codes' => array_map(fn($r) => $r['http'], $results),
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    // ════════════════════════════════════════════════════════════════════
    // دفترة OAuth2 — الحل الدائم (Authorization Code Flow)
    // ════════════════════════════════════════════════════════════════════

    case 'daftra_auth_url':
        // يولّد رابط التفويض للإعداد الأوّلي مرة واحدة فقط
        $client_id    = "__DAFTRA_CLIENT_ID__";   // 584
        $redirect_uri = "https://semak.sa/api.php?action=daftra_oauth_callback";
        $auth_base    = "https://semak.daftra.com/v2/oauth/authorize";
        $auth_url = $auth_base . '?' . http_build_query([
            'client_id'     => $client_id,
            'redirect_uri'  => $redirect_uri,
            'response_type' => 'code',
        ]);
        echo json_encode([
            'success'  => true,
            'auth_url' => $auth_url,
            'message'  => 'افتح هذا الرابط في المتصفح وسجّل دخولك لدفترة',
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_oauth_callback':
        // يستقبل الـ code من دفترة ويبادله بـ tokens ويحفظها في DB
        $code = $_GET['code'] ?? $_POST['code'] ?? ($input_data['code'] ?? null);

        if (!$code) {
            // ربما جاء مباشرة بدون code — أعد HTML للمتصفح
            header('Content-Type: text/html; charset=UTF-8');
            ob_end_clean();
            echo '<html><body dir="rtl" style="font-family:Arial;text-align:center;margin-top:80px">';
            echo '<h2 style="color:red">⚠️ لم يصل رمز التفويض</h2>';
            echo '<p>تأكد أنك زرت رابط التفويض الصحيح</p></body></html>';
            exit;
        }

        $client_id     = "__DAFTRA_CLIENT_ID__";
        $client_secret = "__DAFTRA_CLIENT_SECRET__";
        $redirect_uri  = "https://semak.sa/api.php?action=daftra_oauth_callback";

        // نبادل الـ code بـ access_token + refresh_token
        $token_data  = null;
        $token_debug = [];
        foreach (["https://semak.daftra.com/v2/oauth/token",
                  "https://semak.daftra.com/api2/v2/oauth/token"] as $tu) {
            $ch = curl_init($tu);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => http_build_query([
                    'grant_type'    => 'authorization_code',
                    'client_id'     => $client_id,
                    'client_secret' => $client_secret,
                    'redirect_uri'  => $redirect_uri,
                    'code'          => $code,
                ]),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded',
                                       'Accept: application/json'],
                CURLOPT_TIMEOUT    => 15,
            ]);
            $r = curl_exec($ch); $c = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            $j = json_decode($r, true);
            $token_debug[] = ['url'=>$tu, 'code'=>$c, 'preview'=>substr($r,0,300)];
            if ($c === 200 && !empty($j['access_token'])) { $token_data = $j; break; }
        }

        header('Content-Type: text/html; charset=UTF-8');
        ob_end_clean();

        if (!$token_data) {
            echo '<html><body dir="rtl" style="font-family:Arial;text-align:center;margin-top:80px">';
            echo '<h2 style="color:red">❌ فشل التفويض</h2>';
            echo '<pre>' . htmlspecialchars(json_encode($token_debug, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)) . '</pre>';
            echo '</body></html>';
            exit;
        }

        // احفظ الـ tokens في DB
        $at  = $conn->real_escape_string($token_data['access_token']);
        $rt  = $conn->real_escape_string($token_data['refresh_token'] ?? '');
        $exp = date('Y-m-d H:i:s', time() + intval($token_data['expires_in'] ?? 3600));
        $conn->query("DELETE FROM daftra_tokens");
        $conn->query("INSERT INTO daftra_tokens (access_token, refresh_token, expires_at)
                      VALUES ('$at', '$rt', '$exp')");

        echo '<html><body dir="rtl" style="font-family:Arial;text-align:center;margin-top:80px">';
        echo '<h2 style="color:green">✅ تم التفويض بنجاح!</h2>';
        echo '<p>تم حفظ الـ tokens. يمكنك إغلاق هذه الصفحة.</p>';
        echo '<p>تنتهي صلاحية الـ access token: <b>' . $exp . '</b></p>';
        echo '<p>refresh token: <b>' . (!empty($rt) ? 'محفوظ ✓' : 'غير متوفر ✗') . '</b></p>';
        echo '</body></html>';
        exit;

    case 'daftra_v2_work_cycles':
        // ─── الحل الدائم: APIKEY + le_workflow-type-entity-1 ─────────────────
        set_time_limit(30);
        $dk      = "__DAFTRA_KEY__";
        $wf_base = "https://semak.daftra.com/v2/api/entity/le_workflow-type-entity-1";
        $hh      = ["APIKEY: $dk", "Accept: application/json"];

        $all_rows = [];
        for ($pg = 1; $pg <= 10; $pg++) {
            $ch = curl_init("$wf_base/list/$pg");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => $hh,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_FOLLOWLOCATION => true,
            ]);
            $res  = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code !== 200) break;
            $json = json_decode($res, true);
            if (!$json || empty($json['data'])) break;

            foreach ($json['data'] as $item) $all_rows[] = $item;

            // آخر صفحة
            if (($json['current_page'] ?? 1) >= ($json['last_page'] ?? 1)) break;
        }

        echo json_encode([
            'success' => true,
            'source'  => 'daftra_api',
            'count'   => count($all_rows),
            'data'    => $all_rows,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_v2_work_cycle_single':
        // ─── تفاصيل مشروع واحد كاملة من Daftra v2 API ───────────────────────
        $wc_id = (int)($_GET['id'] ?? 0);
        if (!$wc_id) { echo json_encode(['success' => false, 'message' => 'id مطلوب']); break; }
        $dk = "__DAFTRA_KEY__";
        $hh = ["APIKEY: $dk", "Accept: application/json"];

        // التفاصيل الكاملة للمشروع
        $ch = curl_init("https://semak.daftra.com/v2/api/entity/le_workflow-type-entity-1/$wc_id/1");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $hh,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code !== 200) {
            echo json_encode(['success' => false, 'http_code' => $code, 'message' => 'فشل جلب المشروع']);
            break;
        }
        $detail = json_decode($res, true);

        // ─── نجيب الملخص المالي المرتبط بنفس الـ id عبر api2 ─────────────────
        $base2   = "https://semak.daftra.com/api2";
        $fetch2  = function($ep) use ($base2, $hh) {
            $ch = curl_init("$base2/$ep");
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>$hh, CURLOPT_TIMEOUT=>12, CURLOPT_FOLLOWLOCATION=>true]);
            $r = curl_exec($ch); curl_close($ch);
            return json_decode($r, true);
        };

        // الفواتير والمشتريات والمصروفات
        $all_inv  = ($fetch2("invoices.json?limit=200"))['data']   ?? [];
        $all_pur  = ($fetch2("purchase_invoices.json?limit=200"))['data'] ?? [];
        $all_exp  = ($fetch2("expenses.json?limit=200"))['data']   ?? [];

        $matched_inv = []; $rev = 0; $paid_rev = 0;
        foreach ($all_inv as $r) {
            $i = $r['Invoice'] ?? [];
            if ((int)($i['work_order_id'] ?? 0) !== $wc_id) continue;
            $matched_inv[] = ['id'=>$i['id'],'no'=>$i['no'],'date'=>$i['date'],'client'=>$i['client_business_name']??'','total'=>(float)($i['summary_total']??0),'paid'=>(float)($i['summary_paid']??0)];
            $rev += (float)($i['summary_total']??0);
            $paid_rev += (float)($i['summary_paid']??0);
        }

        $matched_pur = []; $purchases = 0;
        foreach ($all_pur as $r) {
            $p = $r['PurchaseOrder'] ?? [];
            if ((int)($p['work_order_id'] ?? 0) !== $wc_id) continue;
            $matched_pur[] = ['id'=>$p['id'],'no'=>$p['no'],'date'=>$p['date'],'supplier'=>$p['supplier_business_name']??'','total'=>(float)($p['summary_total']??0),'paid'=>(float)($p['summary_paid']??0)];
            $purchases += (float)($p['summary_total']??0);
        }

        $matched_exp = []; $expenses = 0;
        foreach ($all_exp as $r) {
            $e = $r['Expense'] ?? [];
            if ((int)($e['work_order_id'] ?? 0) !== $wc_id) continue;
            $matched_exp[] = ['id'=>$e['id'],'date'=>$e['date'],'description'=>$e['description']??'','amount'=>(float)($e['amount']??0)];
            $expenses += (float)($e['amount']??0);
        }

        $budget    = (float)($detail['budget'] ?? 0);
        $total_cost = $purchases + $expenses;
        $net        = $rev - $total_cost;
        $used_pct   = $budget > 0 ? round($total_cost / $budget * 100, 1) : 0;

        echo json_encode([
            'success'   => true,
            'data'      => $detail,
            'finance'   => [
                'revenue'        => $rev,
                'paid_revenue'   => $paid_rev,
                'purchases'      => $purchases,
                'expenses'       => $expenses,
                'net'            => $net,
                'budget'         => $budget,
                'total_cost'     => $total_cost,
                'budget_used_pct'=> $used_pct,
                'budget_left'    => $budget - $total_cost,
            ],
            'invoices'  => $matched_inv,
            'purchases' => $matched_pur,
            'expenses'  => $matched_exp,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'sync_daftra_work_cycles':
        // ─── استقبال بيانات من Bookmarklet في المتصفح ────────────────────────
        $payload = $input_data['data'] ?? null;
        if (!$payload) {
            echo json_encode(['success' => false, 'message' => 'لا بيانات مُرسَلة'], JSON_UNESCAPED_UNICODE);
            break;
        }

        // استخرج صفوف الدورات من أي شكل رد
        $items = [];
        if (isset($payload['data']) && is_array($payload['data']))       $items = $payload['data'];
        elseif (isset($payload['rows']) && is_array($payload['rows']))   $items = $payload['rows'];
        elseif (isset($payload['items']) && is_array($payload['items'])) $items = $payload['items'];
        elseif (is_array($payload) && isset($payload[0]))                $items = $payload;

        // حفظ البيانات الخام للتشخيص إذا كانت فارغة
        if (empty($items)) {
            echo json_encode([
                'success'  => false,
                'message'  => 'البيانات المُستلَمة فارغة أو بتنسيق غير متوقع',
                'received' => array_keys((array)$payload),
                'preview'  => substr(json_encode($payload), 0, 500),
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        // امسح الكاش القديم واحفظ الجديد
        $conn->query("DELETE FROM daftra_wc_cache");
        $count = 0;
        foreach ($items as $item) {
            $did  = $conn->real_escape_string((string)($item['id'] ?? $item['Id'] ?? $count + 1));
            $name = $conn->real_escape_string(
                $item['name'] ?? $item['Name'] ?? $item['title'] ?? $item['Title'] ?? "دورة $did"
            );
            $json_s = $conn->real_escape_string(json_encode($item, JSON_UNESCAPED_UNICODE));
            $conn->query("INSERT INTO daftra_wc_cache (daftra_id, name, raw_json) VALUES ('$did','$name','$json_s')");
            $count++;
        }

        // سجّل وقت المزامنة
        $conn->query("INSERT INTO daftra_sync_log (entity, count, synced_at) VALUES ('work_cycles', $count, NOW())
                      ON DUPLICATE KEY UPDATE count=$count, synced_at=NOW()");

        echo json_encode([
            'success' => true,
            'count'   => $count,
            'message' => "تم حفظ $count دورة عمل بنجاح",
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_parse_html':
        // يجلب HTML صفحة le_work_cycle بعد auth ويستخرج منها مسارات AJAX
        set_time_limit(45);
        $d_email         = "__DAFTRA_EMAIL__";
        $d_password      = "__DAFTRA_PASSWORD__";
        $d_client_id     = "__DAFTRA_CLIENT_ID__";
        $d_client_secret = "__DAFTRA_CLIENT_SECRET__";

        // الحصول على token أولاً
        $access_token = null;
        foreach (["https://semak.daftra.com/api2/v2/oauth/token", "https://semak.daftra.com/v2/oauth/token"] as $tu) {
            $ch = curl_init($tu);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => http_build_query([
                    'grant_type'    => 'password',
                    'client_id'     => $d_client_id,
                    'client_secret' => $d_client_secret,
                    'username'      => $d_email,
                    'password'      => $d_password,
                ]),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
                CURLOPT_TIMEOUT    => 10,
            ]);
            $r = curl_exec($ch); $c = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            $j = json_decode($r, true);
            if ($c === 200 && !empty($j['access_token'])) { $access_token = $j['access_token']; break; }
        }
        if (!$access_token) { echo json_encode(['success'=>false,'message'=>'فشل التوكن']); break; }

        $base_daftra = "https://semak.daftra.com";
        $daftra_apikey2 = "__DAFTRA_KEY__";
        $bh_bearer = ["Authorization: Bearer $access_token", 'Accept: application/json'];
        $bh_apikey = ["APIKEY: $daftra_apikey2", 'Accept: application/json'];

        $quick_get = function($url, $headers, $nofollow=true) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => $headers,
                CURLOPT_TIMEOUT        => 6,
                CURLOPT_FOLLOWLOCATION => !$nofollow,
            ]);
            $r = curl_exec($ch);
            $c = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return [$c, $r, json_decode($r,true)];
        };

        $results = [];

        // ── A) Bearer token مع /v2/api/owner/ endpoints (مثل notifications) ──
        $api_paths = [
            "$base_daftra/v2/api/owner/le_work_cycle",
            "$base_daftra/v2/api/owner/le_work_cycle/list",
            "$base_daftra/v2/api/owner/entity/le_work_cycle",
            "$base_daftra/v2/api/owner/entity/le_work_cycle/list",
            "$base_daftra/v2/api/owner/workflow_cycles",
            "$base_daftra/v2/api/owner/work_cycles",
        ];
        foreach ($api_paths as $p) {
            [$c, $r, $j] = $quick_get($p, $bh_bearer);
            $results["bearer:$p"] = ['code'=>$c,'is_json'=>$j!==null,'preview'=>substr($r,0,200)];
        }

        // ── B) APIKEY مع /v2/ entity endpoints ──
        $api_paths2 = [
            "$base_daftra/v2/owner/entity/le_work_cycle/list",
            "$base_daftra/v2/owner/entity/le_work_cycle/list?ajax=1",
            "$base_daftra/api2/v2/owner/entity/le_work_cycle/list",
        ];
        foreach ($api_paths2 as $p) {
            [$c, $r, $j] = $quick_get($p, $bh_apikey);
            $results["apikey:$p"] = ['code'=>$c,'is_json'=>$j!==null,'preview'=>substr($r,0,200)];
        }

        // ── C) ابحث عن entity "دورات العمل" بين le_workflow-type-entity-X ──
        // نجرب 2 و 4 و 5 (1=المشاريع, 3=تسليم الوحدات من نتائج سابقة)
        $workflow_titles = [];
        foreach ([2, 4, 5, 6] as $n) {
            $url = "$base_daftra/v2/owner/entity/workflow/le_workflow-type-entity-$n/list";
            [$c, $r, $j] = $quick_get($url, [], false);
            if ($c === 200 && preg_match('/<title>([^<]+)<\/title>/', $r, $mt)) {
                $workflow_titles["entity_$n"] = ['title'=>trim($mt[1]), 'code'=>$c];
            } else {
                $workflow_titles["entity_$n"] = ['code'=>$c, 'preview'=>substr($r,0,100)];
            }
        }

        echo json_encode([
            'success'         => false,
            'api_results'     => $results,
            'workflow_titles' => $workflow_titles,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_work_orders_all':
        // جلب كل دورات العمل من دفترة: القائمة العامة + محاولة IDs فردية للوصول للدورات المخفية
        set_time_limit(60);
        $daftra_key = "__DAFTRA_KEY__";
        $base_url   = "https://semak.daftra.com/api2";
        $hdrs       = ["APIKEY: $daftra_key", "Accept: application/json"];

        $fetch_wo = function($url) use ($hdrs) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => $hdrs,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 5,
            ]);
            $res  = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($code !== 200 || !$res) return null;
            return json_decode($res, true);
        };

        $all  = [];
        $seen = [];

        // 1) جلب القائمة (كل الصفحات)
        for ($pg = 1; $pg <= 10; $pg++) {
            $d = $fetch_wo("$base_url/work_orders.json?page=$pg&limit=100");
            if (!$d || empty($d['data'])) break;
            foreach ($d['data'] as $row) {
                $wo = $row['WorkOrder'] ?? [];
                $id = (string)($wo['id'] ?? '');
                if ($id && !isset($seen[$id])) { $seen[$id] = true; $all[] = $wo; }
            }
            if (count($d['data']) < 100) break;
        }

        // 2) جلب IDs 1-20 فردياً للوصول للدورات التي لا تظهر في القائمة (مختلفة الحالة أو النوع)
        for ($id = 1; $id <= 20; $id++) {
            if (isset($seen[(string)$id])) continue;
            $d = $fetch_wo("$base_url/work_orders/$id.json");
            if (!$d) continue;
            // دفترة قد ترجع البيانات تحت data.WorkOrder أو data مباشرة
            $wo = $d['data']['WorkOrder'] ?? ($d['data'] ?? null);
            if (!$wo || !isset($wo['id'])) continue;
            $wid = (string)$wo['id'];
            if (!isset($seen[$wid])) { $seen[$wid] = true; $all[] = $wo; }
        }

        // ترتيب تصاعدي حسب ID
        usort($all, fn($a,$b) => (int)($a['id']??0) - (int)($b['id']??0));

        echo json_encode(['success' => true, 'count' => count($all), 'data' => $all], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_full_summary':
        // ملخص مالي موسّع: فواتير + مصروفات + مشتريات + موردين + خزائن
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        // جلب صفحة واحدة
        $fetch_page = function($endpoint, $page = 1, $limit = 100) use ($base, $headers) {
            $sep = strpos($endpoint, '?') === false ? '?' : '&';
            $url = "$base/$endpoint{$sep}page=$page&limit=$limit";
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 20,
            ]);
            $res = curl_exec($ch);
            curl_close($ch);
            return json_decode($res, true);
        };

        // جلب كل الصفحات (يدمج البيانات في data واحدة)
        $fetch_all = function($endpoint) use ($fetch_page) {
            $all = [];
            $page = 1;
            $max_pages = 50; // حد أمان
            while ($page <= $max_pages) {
                $resp = $fetch_page($endpoint, $page, 100);
                if (!isset($resp['data']) || !is_array($resp['data']) || count($resp['data']) === 0) break;
                $all = array_merge($all, $resp['data']);
                if (count($resp['data']) < 100) break; // الصفحة الأخيرة
                $page++;
            }
            return ['data' => $all, 'pages_fetched' => $page];
        };

        $invoices_data   = $fetch_all("invoices.json");
        $expenses_data   = $fetch_all("expenses.json");
        $purchases_data  = $fetch_all("purchase_invoices.json");
        $suppliers_data  = $fetch_all("suppliers.json");
        $treasuries_data = $fetch_all("treasuries.json");
        $clients_data    = $fetch_all("clients.json");

        // فواتير المبيعات
        $sales = ['total'=>0,'paid'=>0,'unpaid'=>0,'count'=>0,'unpaid_count'=>0];
        $invoices_by_client = [];
        if (isset($invoices_data['data'])) {
            foreach ($invoices_data['data'] as $r) {
                $i = $r['Invoice'] ?? [];
                $t = (float)($i['summary_total']  ?? 0);
                $p = (float)($i['summary_paid']   ?? 0);
                $u = (float)($i['summary_unpaid'] ?? max(0, $t-$p));
                $sales['total']  += $t;
                $sales['paid']   += $p;
                $sales['unpaid'] += $u;
                $sales['count']++;
                if ($u > 0.01) $sales['unpaid_count']++;
                $cid = $i['client_id'] ?? 0;
                $cname = $i['client_business_name'] ?: trim(($i['client_first_name']??'').' '.($i['client_last_name']??'')) ?: 'عميل #'.$cid;
                if (!isset($invoices_by_client[$cid])) $invoices_by_client[$cid] = ['name'=>$cname,'total'=>0,'paid'=>0,'unpaid'=>0,'count'=>0];
                $invoices_by_client[$cid]['total']  += $t;
                $invoices_by_client[$cid]['paid']   += $p;
                $invoices_by_client[$cid]['unpaid'] += $u;
                $invoices_by_client[$cid]['count']++;
            }
        }

        // المصروفات
        $expenses = ['total'=>0,'count'=>0];
        $expenses_by_category = [];
        if (isset($expenses_data['data'])) {
            foreach ($expenses_data['data'] as $r) {
                $e = $r['Expense'] ?? [];
                $a = (float)($e['amount'] ?? 0);
                $cat = $e['category'] ?? '';
                $expenses['total'] += $a;
                $expenses['count']++;
                if (!isset($expenses_by_category[$cat])) $expenses_by_category[$cat] = ['total'=>0,'count'=>0];
                $expenses_by_category[$cat]['total'] += $a;
                $expenses_by_category[$cat]['count']++;
            }
        }

        // فواتير الشراء
        $purchases = ['total'=>0,'paid'=>0,'unpaid'=>0,'count'=>0,'unpaid_count'=>0];
        $purchases_by_supplier = [];
        if (isset($purchases_data['data'])) {
            foreach ($purchases_data['data'] as $r) {
                $po = $r['PurchaseOrder'] ?? [];
                $t  = (float)($po['summary_total']  ?? $po['total']         ?? 0);
                $p  = (float)($po['summary_paid']   ?? $po['paid_amount']   ?? 0);
                $u  = (float)($po['summary_unpaid'] ?? max(0, $t-$p));
                $purchases['total']  += $t;
                $purchases['paid']   += $p;
                $purchases['unpaid'] += $u;
                $purchases['count']++;
                if ($u > 0.01) $purchases['unpaid_count']++;
                $sid = $po['supplier_id'] ?? 0;
                $sname = $po['supplier_business_name']
                       ?: trim(($po['supplier_first_name']??'').' '.($po['supplier_last_name']??''))
                       ?: 'مورد #'.$sid;
                if (!isset($purchases_by_supplier[$sid])) $purchases_by_supplier[$sid] = ['name'=>$sname,'total'=>0,'paid'=>0,'unpaid'=>0,'count'=>0];
                $purchases_by_supplier[$sid]['total']  += $t;
                $purchases_by_supplier[$sid]['paid']   += $p;
                $purchases_by_supplier[$sid]['unpaid'] += $u;
                $purchases_by_supplier[$sid]['count']++;
            }
        }

        // الخزائن
        $treasuries_list = [];
        $total_balance = 0;
        if (isset($treasuries_data['data'])) {
            foreach ($treasuries_data['data'] as $r) {
                $t = $r['Treasury'] ?? [];
                $bal = (float)($t['balance'] ?? $t['current_balance'] ?? $t['amount'] ?? 0);
                $total_balance += $bal;
                $treasuries_list[] = [
                    'id' => $t['id'] ?? '',
                    'name' => $t['name'] ?? '',
                    'currency' => $t['currency_code'] ?? 'SAR',
                    'balance' => $bal,
                ];
            }
        }

        // قائمة الموردين
        $suppliers_list = [];
        if (isset($suppliers_data['data'])) {
            foreach ($suppliers_data['data'] as $r) {
                $s = $r['Supplier'] ?? [];
                $suppliers_list[] = [
                    'id' => $s['id'] ?? '',
                    'name' => $s['business_name'] ?: trim(($s['first_name']??'').' '.($s['last_name']??'')) ?: '—',
                    'phone' => $s['phone1'] ?? $s['phone2'] ?? '',
                    'email' => $s['email'] ?? '',
                    'balance' => (float)($s['starting_balance'] ?? 0),
                ];
            }
        }

        $clients_count = isset($clients_data['data']) ? count($clients_data['data']) : 0;

        echo json_encode([
            "success" => true,
            "currency" => "SAR",
            "sales" => $sales,
            "expenses" => $expenses,
            "purchases" => $purchases,
            "treasuries_total_balance" => $total_balance,
            "clients_count" => $clients_count,
            "suppliers_count" => count($suppliers_list),
            "net_position" => $sales['paid'] - $expenses['total'] - $purchases['paid'],
            "expenses_by_category" => $expenses_by_category,
            "invoices_by_client" => $invoices_by_client,
            "purchases_by_supplier" => $purchases_by_supplier,
            "treasuries" => $treasuries_list,
            "suppliers" => $suppliers_list,
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_debug_work_orders':
        // تشخيص: ماذا يرجع api2/work_orders.json بالضبط؟
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $results = [];
        // جرب page 1 و 2
        foreach ([1, 2] as $pg) {
            $ch = curl_init("$base/work_orders.json?page=$pg&limit=100");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HEADER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 5,
            ]);
            $raw = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $hsize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            curl_close($ch);

            $body = substr($raw, $hsize);
            $data = json_decode($body, true);
            $items = $data['data'] ?? [];
            $wo_list = [];
            foreach ($items as $r) {
                $w = $r['WorkOrder'] ?? $r;
                $wo_list[] = [
                    'id'     => $w['id'] ?? '?',
                    'number' => $w['number'] ?? '?',
                    'title'  => $w['title'] ?? $w['name'] ?? '?',
                    'status' => $w['status'] ?? '?',
                    'budget' => $w['budget'] ?? '?',
                    'start_date' => $w['start_date'] ?? '?',
                ];
            }
            $results["page_$pg"] = [
                'http'       => $http,
                'count'      => count($items),
                'entity_key' => count($items) > 0 ? (array_keys($items[0])[0] ?? null) : null,
                'work_orders'=> $wo_list,
                'raw_first_300' => substr($body, 0, 300),
            ];
        }

        // جرب أيضاً بدون pagination
        $ch = curl_init("$base/work_orders.json");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
        ]);
        $raw2 = curl_exec($ch);
        $http2 = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $data2 = json_decode($raw2, true);
        $results['no_pagination'] = [
            'http' => $http2,
            'count' => count($data2['data'] ?? []),
            'raw_first_300' => substr($raw2, 0, 300),
        ];

        echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_follow_redirect':
        // تتبع redirect لـ ID 5 لمعرفة الـ endpoint الجديد
        $daftra_key = "__DAFTRA_KEY__";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $ch = curl_init("https://semak.daftra.com/api2/work_orders/5.json");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $res = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $info = curl_getinfo($ch);
        curl_close($ch);

        // استخراج Location header
        $location = null;
        if (preg_match('/^Location:\s*(.+)$/mi', $res, $m)) {
            $location = trim($m[1]);
        }

        echo json_encode([
            "original_url" => "work_orders/5.json",
            "http" => $http,
            "redirect_to" => $location,
            "full_info" => $info,
            "raw_response_first_500" => substr($res, 0, 500),
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_probe_work_order_filters':
        // اختبار فلاتر work_orders للوصول لكل المشاريع
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $urls = [
            "work_orders.json",
            "work_orders.json?workflow_type_id=1",
            "work_orders.json?type=1",
            "work_orders.json?workflow_type_id=all",
            "work_orders/5.json",   // ID 5 مباشرة
            "work_orders/view/5.json",
            "work_orders/2.json",
        ];

        $results = [];
        foreach ($urls as $url) {
            $ch = curl_init("$base/$url");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 8,
            ]);
            $res = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $data = json_decode($res, true);
            $results[$url] = [
                "http" => $http,
                "count" => isset($data['data']) ? count($data['data']) : (isset($data['WorkOrder']) ? 1 : 0),
                "preview" => substr($res ?: '', 0, 250),
            ];
        }
        echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_probe_workflows':
        // V2 API: workflows / workflow_types / entities
        $daftra_key = "__DAFTRA_KEY__";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $bases = [
            "https://semak.daftra.com/api2",
            "https://semak.daftra.com/v2/api",
            "https://semak.daftra.com/api/v2",
            "https://semak.daftra.com/api",
        ];
        $endpoints = [
            "workflow_types", "workflow-types", "workflowtypes",
            "workflow_entities", "workflow-entities",
            "workflows/1/entities", "workflow-types/1/entities",
            "workflow_types/1", "workflow_types/list",
            "entities", "entity/workflow",
            "v2/owner/entity/workflow/le_workflow-type-entity-1/list",
            "owner/entity/workflow/le_workflow-type-entity-1/list",
        ];

        $results = [];
        foreach ($bases as $base) {
            foreach ($endpoints as $ep) {
                $url_json = "$base/$ep" . (strpos($ep, '.json') !== false ? '' : '.json') . "?limit=1";
                $url_plain = "$base/$ep";
                foreach ([$url_json, $url_plain] as $url) {
                    $ch = curl_init($url);
                    curl_setopt_array($ch, [
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_HTTPHEADER => $headers,
                        CURLOPT_TIMEOUT => 6,
                        CURLOPT_FOLLOWLOCATION => false,
                    ]);
                    $res = curl_exec($ch);
                    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    if ($http === 200) {
                        $data = json_decode($res, true);
                        $key = $base . '/' . $ep;
                        $count = isset($data['data']) ? count($data['data']) : 0;
                        $results[$key] = [
                            "status" => "✅ متاح",
                            "url" => $url,
                            "count" => $count,
                            "preview" => substr($res, 0, 200),
                        ];
                        break 2; // وجدنا — انتقل للـ endpoint التالي
                    }
                }
            }
        }
        if (empty($results)) {
            $results['_hint'] = 'لا يوجد endpoint مطابق - النظام v2 قد لا يكون له API عام';
        }
        echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_probe_projects':
        // اكتشاف endpoint إدارة المشاريع تحت دورات العمل
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $candidates = [
            "projects", "project", "pm_projects", "pm/projects",
            "project_management", "work_order_projects", "work_orders/projects",
            "work_orders",  // التأكد من العدد فيه
            "tasks", "jobs", "engagements", "agreements", "contracts",
            "schedules", "appointments",
        ];

        $results = [];
        foreach ($candidates as $ep) {
            $ch = curl_init("$base/$ep.json?limit=1");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 8,
                CURLOPT_FOLLOWLOCATION => false,
            ]);
            $res = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($http === 200) {
                $data = json_decode($res, true);
                $count = isset($data['data']) ? count($data['data']) : 0;
                // اجلب العدد الكلي بصفحة واحدة بحدّ كبير
                $ch2 = curl_init("$base/$ep.json?limit=500");
                curl_setopt_array($ch2, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 10]);
                $r2 = curl_exec($ch2); curl_close($ch2);
                $d2 = json_decode($r2, true);
                $real_count = isset($d2['data']) ? count($d2['data']) : 0;
                $first_key = $count > 0 ? array_keys($data['data'][0])[0] : null;
                $sample_fields = ($first_key && isset($data['data'][0][$first_key]))
                    ? array_slice(array_keys($data['data'][0][$first_key]), 0, 15) : [];
                $results[$ep] = [
                    "status" => "✅ متاح",
                    "entity_key" => $first_key,
                    "total_count" => $real_count,
                    "sample_fields" => $sample_fields,
                ];
            } else {
                $results[$ep] = ["status" => "❌ HTTP $http"];
            }
        }
        echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_probe_cycles':
        // اكتشاف endpoint دورات العمل في دفترة
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $candidates = [
            "work_cycles", "cycles", "work_orders", "workorders", "workflows",
            "accounting_cycles", "fiscal_periods", "periods", "accounting_periods",
            "billing_cycles", "subscription_cycles",
            "milestones", "phases", "stages", "contracts",
            "projects", "campaigns", "pipelines",
        ];

        $results = [];
        foreach ($candidates as $ep) {
            $ch = curl_init("$base/$ep.json?limit=1");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 8,
                CURLOPT_FOLLOWLOCATION => false,
            ]);
            $res = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($http === 200) {
                $data = json_decode($res, true);
                $count = isset($data['data']) && is_array($data['data']) ? count($data['data']) : 0;
                $first_key = $count > 0 ? array_keys($data['data'][0])[0] : null;
                $fields = $count > 0 && isset($data['data'][0][$first_key]) ? array_keys($data['data'][0][$first_key]) : [];
                $results[$ep] = [
                    "status" => "✅ متاح",
                    "entity_key" => $first_key,
                    "fields" => $fields,
                ];
            } else {
                $results[$ep] = ["status" => "❌ HTTP $http"];
            }
        }
        echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_discover_all':
        // اكتشاف شامل لكل endpoints دفترة المتاحة
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $all_endpoints = [
            // المبيعات
            "invoices", "estimates", "credit_notes", "delivery_notes", "sales_returns",
            "orders", "sales_orders", "quotations",
            // المشتريات
            "purchase_invoices", "purchase_orders", "purchase_returns", "purchase_estimates",
            // جهات الاتصال
            "clients", "suppliers", "contacts", "leads",
            // المنتجات والمخزون
            "products", "product_categories", "stores", "stock_levels",
            "stock_transfers", "stock_adjustments", "warehouses",
            // المالية
            "treasuries", "treasury_transactions", "payments", "receipts",
            "expenses", "expense_categories", "revenues", "journal_entries",
            // الموارد البشرية
            "staff", "departments", "positions", "attendance", "leaves",
            "payroll", "salaries",
            // CRM
            "opportunities", "deals", "tasks", "events",
            // المشاريع
            "projects", "milestones", "time_logs",
            // التقارير
            "reports", "profit_loss", "balance_sheet", "cash_flow",
            // الإعدادات
            "branches", "currencies", "taxes", "payment_methods",
            "categories", "tags", "custom_fields",
            // الأنشطة
            "activities", "logs", "audit_logs", "notifications",
        ];

        $results = [];
        foreach ($all_endpoints as $ep) {
            $ch = curl_init("$base/$ep.json?limit=1");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 8,
            ]);
            $res = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($http === 200) {
                $data = json_decode($res, true);
                $has_data = isset($data['data']) && is_array($data['data']);
                $sample = $has_data && count($data['data']) > 0 ? $data['data'][0] : null;
                $first_key = $sample ? array_keys($sample)[0] : null;
                $field_names = ($first_key && isset($sample[$first_key]) && is_array($sample[$first_key]))
                    ? array_keys($sample[$first_key]) : [];
                $results[$ep] = [
                    "status" => "✅ متاح",
                    "entity_key" => $first_key,
                    "fields_count" => count($field_names),
                    "sample_fields" => array_slice($field_names, 0, 15),
                ];
            } elseif ($http === 404) {
                // skip - not available
            } else {
                $results[$ep] = ["status" => "⚠️ HTTP $http"];
            }
        }

        echo json_encode([
            "discovered" => count($results),
            "endpoints" => $results
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_probe_endpoints':
        // اكتشاف endpoints المشتريات والموردين والخزائن
        $daftra_key = "__DAFTRA_KEY__";
        $base = "https://semak.daftra.com/api2";
        $headers = ["APIKEY: $daftra_key", "Accept: application/json"];

        $endpoints = [
            // مشتريات
            "purchase_orders.json", "purchases.json", "purchase_invoices.json", "vendor_invoices.json",
            // موردين
            "suppliers.json", "vendors.json",
            // خزائن
            "treasuries.json", "cash_boxes.json", "accounts.json", "bank_accounts.json",
            // أخرى
            "payments.json", "receipts.json", "store_transfers.json",
        ];

        $results = [];
        foreach ($endpoints as $ep) {
            $ch = curl_init("$base/$ep");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 10,
            ]);
            $res = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $data = json_decode($res, true);
            $count = isset($data['data']) && is_array($data['data']) ? count($data['data']) : 0;
            $results[$ep] = [
                "http" => $http,
                "count" => $count,
                "first_key" => $count > 0 ? array_keys($data['data'][0] ?? [])[0] : null,
                "preview" => substr($res ?: '', 0, 100),
            ];
        }

        echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'daftra_invoice_sample':
        // إظهار أول فاتورة كاملةً لمعرفة أسماء الحقول
        $daftra_key = "__DAFTRA_KEY__";
        $ch = curl_init("https://semak.daftra.com/api2/invoices.json");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ["APIKEY: $daftra_key", "Accept: application/json"],
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        $data = json_decode($res, true);
        $first = $data['data'][0] ?? null;
        echo json_encode(["first_invoice" => $first], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    // ─── إحصائيات بوت فهد ─────────────────────────────────────────────────────
    case 'bot_stats':
        $stats = [];

        // محادثات اليوم
        $r = $conn->query("SELECT COUNT(*) c FROM wa_bot_conversations WHERE DATE(created_at)=CURDATE()");
        $stats['messages_today'] = (int)($r ? $r->fetch_assoc()['c'] : 0);

        // محادثات هذا الأسبوع
        $r = $conn->query("SELECT COUNT(*) c FROM wa_bot_conversations WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
        $stats['messages_week'] = (int)($r ? $r->fetch_assoc()['c'] : 0);

        // إجمالي الرسائل
        $r = $conn->query("SELECT COUNT(*) c FROM wa_bot_conversations");
        $stats['messages_total'] = (int)($r ? $r->fetch_assoc()['c'] : 0);

        // عدد العملاء الفريدين
        $r = $conn->query("SELECT COUNT(DISTINCT phone) c FROM wa_bot_conversations");
        $stats['unique_customers'] = (int)($r ? $r->fetch_assoc()['c'] : 0);

        // عدد المهتمين الذين سجلهم البوت
        $r = $conn->query("SELECT COUNT(*) c FROM leads WHERE source = 'بوت فهد'");
        $stats['leads_from_bot'] = (int)($r ? $r->fetch_assoc()['c'] : 0);

        // المهتمين الذين تحولوا لمشترين (تم البيع) من البوت
        $r = $conn->query("SELECT COUNT(*) c FROM leads WHERE source = 'بوت فهد' AND status = 'تم البيع'");
        $stats['conversions_from_bot'] = (int)($r ? $r->fetch_assoc()['c'] : 0);

        // آخر محادثة
        $r = $conn->query("SELECT created_at FROM wa_bot_conversations ORDER BY id DESC LIMIT 1");
        $stats['last_interaction'] = $r ? ($r->fetch_assoc()['created_at'] ?? null) : null;

        // تقدير الكلفة التقريبية (Claude Haiku 4.5: ~$1/M input, ~$5/M output)
        // متوسط الرسالة: ~50 كلمة = ~75 token، السيستم برومبت: ~3000 token تقريباً
        $r = $conn->query("SELECT SUM(CHAR_LENGTH(message)) bytes, role FROM wa_bot_conversations GROUP BY role");
        $user_chars = 0; $assistant_chars = 0;
        if ($r) {
            while ($row = $r->fetch_assoc()) {
                if ($row['role'] === 'user')      $user_chars      = (int)$row['bytes'];
                if ($row['role'] === 'assistant') $assistant_chars = (int)$row['bytes'];
            }
        }
        // تقدير: 4 حروف ≈ 1 token (للعربية تقريباً 3 حروف = 1 token)
        $user_tokens      = (int)($user_chars / 3);
        $assistant_tokens = (int)($assistant_chars / 3);
        // كل رسالة بوت ترفع كامل السيستم + التاريخ (تقدير 3500 token كمتوسط)
        $r = $conn->query("SELECT COUNT(*) c FROM wa_bot_conversations WHERE role = 'assistant'");
        $bot_calls = (int)($r ? $r->fetch_assoc()['c'] : 0);
        $system_tokens = $bot_calls * 3500;
        $total_input_tokens = $user_tokens + $system_tokens;
        $cost_estimate = ($total_input_tokens / 1000000) * 1.0 + ($assistant_tokens / 1000000) * 5.0;
        $stats['estimated_cost_usd'] = round($cost_estimate, 4);
        $stats['estimated_input_tokens']  = $total_input_tokens;
        $stats['estimated_output_tokens'] = $assistant_tokens;
        $stats['bot_calls']               = $bot_calls;

        // إعدادات البوت
        $stats['config'] = [
            'name'      => 'فهد',
            'model'     => 'claude-haiku-4-5',
            'language'  => 'العربية الفصحى',
            'webhook'   => 'https://semak.sa/api.php?action=wa_webhook',
            'connected' => true,
        ];

        echo json_encode(["success" => true, "stats" => $stats]);
        break;

    // ─── محادثات البوت (آخر 50) ──────────────────────────────────────────────
    case 'bot_recent_conversations':
        $res = $conn->query(
            "SELECT phone, role, message, created_at
             FROM wa_bot_conversations
             ORDER BY id DESC LIMIT 50"
        );
        $rows = [];
        if ($res) while ($row = $res->fetch_assoc()) $rows[] = $row;
        echo json_encode(["success" => true, "data" => $rows]);
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
- "notes": اكتب الجديد فقط في هذه الرسالة. النظام سيختم ملاحظتك بالتاريخ والوقت تلقائياً ويضيفها فوق الملاحظات السابقة. لا تكرر ما قلته في رسالة سابقة. أمثلة:
  • "سأل عن سعر المتر، أبدى استغراباً من السعر"
  • "حدد ميزانيته بـ 600 ألف"
  • "يبحث للاستثمار الموسمي، 3 أفراد فقط"
  • "طلب جدولة معاينة يوم الخميس"
- إذا لم تتعلم شيئاً جديداً (مجرد ترحيب أو سؤال عام) اكتب: "لا جديد".
- ممنوع وضع أي إيموجي أو رموز خاصة داخل META.
- ممنوع وضع علامات اقتباس داخل القيم. استخدم نصاً عادياً.

=== التقاط بيانات العميل (لا تطلب الفورم) ===
أنت تعرف بالفعل رقم جوال العميل (هو الرقم الذي يراسلك منه)، وقد تم تسجيله تلقائياً في النظام. لذلك:

- لا تطلب من العميل تعبئة فورم خارجي.
- لا تذكر الرابط https://semak.sa/contact إلا في حالات نادرة جداً (مثلاً إذا طلب رسمياً تقديم طلب موثّق).
- إذا لم تعرف اسمه (مذكور في "سجل العميل" بالأعلى)، اسأل اسمه بشكل طبيعي: "تشرفت بك. مع من تكرّم بمراسلتنا؟"
- يكفي معرفة الاسم — رقم الجوال متوفر تلقائياً.
- بعد معرفة الاسم تابع المحادثة بشكل احترافي وسجّل ما يهم في META.
- إذا قال العميل "لا أرغب بإعطاء اسمي" احترم رغبته وتابع.

=== صياغة المتابعة عند اعتراض الميزانية أو الحالات الصعبة ===
بدل توجيهه للفورم، استخدم صياغة مثل:
- "تشرفت بك أستاذ [الاسم]. سأرفع طلبك لإدارة المبيعات وسنتواصل معك على نفس الرقم خلال يوم العمل القادم."
- "بياناتك معنا، وسنرد عليك بالتفصيل قريباً."
الفكرة: لا تترك العميل يشعر بأنه يحتاج لخطوة إضافية. هو سجّل عندنا فقط بمجرد مراسلتنا.

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

=== التعامل مع اعتراض الميزانية (مهم لا تخسر العميل) ===
إذا أشار العميل إلى أن ميزانيته أقل من أسعار الوحدات:
- لا تقفل الباب أمامه ولا تقترح عليه البحث في مكان آخر.
- لا تنفِ إمكانية التوصل لحل، ولا تؤكدها أيضاً.
- بياناته معك بالفعل، لذا الصياغة المناسبة: "أقدّر لك مصارحتك بميزانيتك. سأرفع طلبك لإدارة المبيعات لمراجعته، وسنعود إليك على هذا الرقم بإجابة قريباً."
- لا تطلب منه تعبئة فورم.
- في META سجّل اعتراض الميزانية بوضوح مع المبلغ الذي ذكره ليُراجَع من الإدارة.

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
            $contact_name = trim($payload['contact_name'] ?? '');
            // تجاهل الأسماء التافهة مثل "0" أو الأرقام أو الفراغ
            if ($contact_name === '' || $contact_name === '0' || ctype_digit($contact_name)) {
                $contact_name = 'عميل واتساب';
            }
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
                $u_unit     = trim($meta['unit']     ?? '');
                $u_interest = trim($meta['interest'] ?? '');
                $u_note     = trim($meta['notes']    ?? '');

                // اجلب سجل العميل الحالي
                $cur_res = $conn->query("SELECT id, notes FROM leads WHERE $phone_search ORDER BY id DESC LIMIT 1");
                if ($cur_res && $cur_row = $cur_res->fetch_assoc()) {
                    $lead_id_upd   = (int)$cur_row['id'];
                    $existing_notes = $cur_row['notes'] ?? '';
                    $stamp = date('Y-m-d H:i');

                    // أضف الملاحظة الجديدة مع تاريخ ووقت
                    $merged_notes = $existing_notes;
                    $skip_notes = ['', 'غير محدد', 'لا جديد', 'لا توجد ملاحظات جديدة', 'لا يوجد'];
                    if (!in_array($u_note, $skip_notes) && mb_strlen($u_note) > 2) {
                        $new_entry = "[$stamp] $u_note";
                        if (strpos($existing_notes, $u_note) === false) {
                            $merged_notes = $existing_notes ? "$existing_notes\n$new_entry" : $new_entry;
                        }
                    }

                    $sql_upd = "UPDATE leads SET ";
                    $fields = [];
                    if ($u_unit !== '' && $u_unit !== 'غير محدد') {
                        $safe_u = $conn->real_escape_string($u_unit);
                        $fields[] = "unit='$safe_u'";
                    }
                    if ($u_interest !== '') {
                        $safe_i = $conn->real_escape_string($u_interest);
                        $fields[] = "interest='$safe_i'";
                    }
                    if ($merged_notes !== $existing_notes) {
                        $safe_n = $conn->real_escape_string($merged_notes);
                        $fields[] = "notes='$safe_n'";
                    }
                    if (!empty($fields)) {
                        $sql_upd .= implode(', ', $fields) . " WHERE id=$lead_id_upd";
                        $conn->query($sql_upd);
                        file_put_contents($log_file,
                            date('Y-m-d H:i:s') . " | META appended note for lead $lead_id_upd\n",
                            FILE_APPEND);
                    }
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
