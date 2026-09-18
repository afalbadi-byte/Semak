<?php
// ════════════════════════════════════════════════════════════════════════════
//  عُهدة — تطبيق مستقلّ لتسجيل العُهد والمصاريف
//  ─────────────────────────────────────────────────────────────────────────
//  لا يشترك مع سماك إلا في الخادم: مستخدموه وجداوله (oh_*) ومفاتيح دخوله له
//  وحده. كل صفّ يحمل user_id، وكل استعلام مقيّدٌ به — فبيانات أمّك لا تلتقي
//  ببيانات عهدة عملك ولو في سطر.
//
//  الحذف ليّن دائماً (deleted=1) ومسجَّلٌ في oh_log: لا قرار في الواجهة يُفني
//  بيانات بلا رجعة.
// ════════════════════════════════════════════════════════════════════════════

ob_start();
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

$db_host = 'localhost';
$db_user = '__DB_USER__';
$db_pass = '__DB_PASS__';
$db_name = '__DB_NAME__';

mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) { ob_end_clean(); die(json_encode(['success' => false, 'message' => 'تعذّر الاتصال بقاعدة البيانات'])); }
$conn->set_charset('utf8mb4');

// مفتاح التوقيع مشتقٌّ من سرّ الخادم ومخصوصٌ بهذا التطبيق: مفتاح دخول سماك لا يفتح عُهدة
define('OH_KEY', hash_hmac('sha256', 'ohda-app-v1', '__TOKEN_SECRET__'));
define('OH_AI_KEY', '__ANTHROPIC_KEY__');
define('OH_G_ID', '__GOOGLE_CLIENT_ID__');
define('OH_G_SECRET', '__GOOGLE_CLIENT_SECRET__');
define('OH_FILES', __DIR__ . '/files');

function out($a) { ob_end_clean(); echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }
function fail($m, $code = 200) { http_response_code($code); out(['success' => false, 'message' => $m]); }
function E($v) { global $conn; return $conn->real_escape_string((string)$v); }
function body() { static $b = null; if ($b === null) $b = json_decode(file_get_contents('php://input'), true) ?: []; return $b; }
function secret_set($v) { return $v !== '' && strpos($v, '__') !== 0; }
function b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64u_dec($s) { return base64_decode(strtr($s, '-_', '+/')); }

// ─── الجداول ────────────────────────────────────────────────────────────────
// تُنشأ عند أول طلب وتُعلَّم بإصدار، فلا يتكرّر العمل في كل نداء
$__v = 0;
if ($r = $conn->query("SELECT v FROM oh_meta WHERE k='schema' LIMIT 1")) if ($x = $r->fetch_assoc()) $__v = (int)$x['v'];
if ($__v < 1) {
    $conn->query("CREATE TABLE IF NOT EXISTS oh_meta (k VARCHAR(40) PRIMARY KEY, v MEDIUMTEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS oh_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(60) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        pass_hash VARCHAR(255) NOT NULL,
        role VARCHAR(10) NOT NULL DEFAULT 'user',
        active TINYINT(1) NOT NULL DEFAULT 1,
        drive_folder VARCHAR(80) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS oh_funds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        kind VARCHAR(12) NOT NULL DEFAULT 'custody',
        color VARCHAR(12) DEFAULT '#0f766e',
        status VARCHAR(10) NOT NULL DEFAULT 'open',
        note TEXT,
        settled_at DATETIME DEFAULT NULL,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS oh_cats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(80) NOT NULL,
        icon VARCHAR(24) DEFAULT 'tag',
        color VARCHAR(12) DEFAULT '#64748b',
        budget DECIMAL(14,2) NOT NULL DEFAULT 0,
        sort INT NOT NULL DEFAULT 0,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        INDEX (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS oh_txns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fund_id INT DEFAULT NULL,
        type VARCHAR(4) NOT NULL DEFAULT 'out',
        d DATE NOT NULL,
        amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        vat DECIMAL(14,2) NOT NULL DEFAULT 0,
        vendor VARCHAR(160) DEFAULT '',
        cat_id INT DEFAULT NULL,
        method VARCHAR(12) DEFAULT 'cash',
        note TEXT,
        ref VARCHAR(80) DEFAULT '',
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (user_id, d), INDEX (user_id, fund_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS oh_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        txn_id INT DEFAULT NULL,
        name VARCHAR(200) NOT NULL,
        mime VARCHAR(80) NOT NULL,
        size INT NOT NULL DEFAULT 0,
        path VARCHAR(200) NOT NULL,
        drive_id VARCHAR(80) DEFAULT NULL,
        drive_status VARCHAR(10) NOT NULL DEFAULT 'pending',
        extracted MEDIUMTEXT,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (user_id), INDEX (txn_id), INDEX (drive_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS oh_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        action VARCHAR(40) NOT NULL,
        entity VARCHAR(20) DEFAULT NULL,
        entity_id INT DEFAULT NULL,
        data MEDIUMTEXT,
        ip VARCHAR(64) DEFAULT NULL,
        at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (user_id, at), INDEX (action, at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("REPLACE INTO oh_meta (k, v) VALUES ('schema', '1')");
}

function oh_col($table, $col, $ddl) {
    global $conn;
    $r = $conn->query("SHOW COLUMNS FROM `$table` LIKE '" . E($col) . "'");
    if ($r && $r->num_rows) return;
    $conn->query("ALTER TABLE `$table` $ddl");
}
if ($__v < 2) {
    oh_col('oh_users', 'lang',    "ADD COLUMN lang VARCHAR(2) NOT NULL DEFAULT 'ar'");
    oh_col('oh_users', 'phone',   "ADD COLUMN phone VARCHAR(20) DEFAULT NULL");
    oh_col('oh_users', 'email',   "ADD COLUMN email VARCHAR(160) DEFAULT NULL");
    oh_col('oh_users', 'profile', "ADD COLUMN profile MEDIUMTEXT");
    oh_col('oh_users', 'logo',    "ADD COLUMN logo VARCHAR(200) DEFAULT NULL");
    $conn->query("REPLACE INTO oh_meta (k, v) VALUES ('schema', '2')");
}
if ($__v < 3) {
    $conn->query("CREATE TABLE IF NOT EXISTS oh_passkeys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        cred_id VARCHAR(255) NOT NULL UNIQUE,
        pubkey TEXT NOT NULL,
        sign_count BIGINT NOT NULL DEFAULT 0,
        name VARCHAR(120) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME DEFAULT NULL,
        INDEX (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS oh_challenges (
        ch VARCHAR(64) PRIMARY KEY,
        user_id INT DEFAULT NULL,
        kind VARCHAR(8) NOT NULL,
        exp INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("REPLACE INTO oh_meta (k, v) VALUES ('schema', '3')");
}

function oh_log($uid, $action, $entity = null, $id = null, $data = null) {
    global $conn;
    $ip = E(trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '')[0]));
    $conn->query("INSERT INTO oh_log (user_id, action, entity, entity_id, data, ip) VALUES ("
        . ($uid ? (int)$uid : 'NULL') . ", '" . E($action) . "', " . ($entity ? "'" . E($entity) . "'" : 'NULL') . ", "
        . ($id ? (int)$id : 'NULL') . ", " . ($data !== null ? "'" . E(json_encode($data, JSON_UNESCAPED_UNICODE)) . "'" : 'NULL') . ", '$ip')");
}
function meta_get($k) { global $conn; if ($r = $conn->query("SELECT v FROM oh_meta WHERE k='" . E($k) . "'")) if ($x = $r->fetch_assoc()) return $x['v']; return null; }
function meta_set($k, $v) { global $conn; $conn->query("REPLACE INTO oh_meta (k, v) VALUES ('" . E($k) . "', " . ($v === null ? 'NULL' : "'" . E($v) . "'") . ")"); }

// ─── التصنيفات الافتراضية لكل مستخدم جديد ───────────────────────────────────
function seed_cats($uid, $lang = 'ar') {
    global $conn;
    if ($lang === 'en') {
        $cats = [
            ['Transport & Fuel', 'car', '#0ea5e9'], ['Meals & Hospitality', 'coffee', '#f97316'],
            ['Supplies & Office', 'package', '#8b5cf6'], ['Maintenance', 'wrench', '#64748b'],
            ['Telecom & Internet', 'wifi', '#06b6d4'], ['Government Fees', 'landmark', '#0f766e'],
            ['Education & Schools', 'graduation', '#2563eb'], ['Household', 'home', '#db2777'],
            ['Health', 'heart', '#dc2626'], ['Other', 'tag', '#94a3b8'],
        ];
        foreach ($cats as $i => $c)
            $conn->query("INSERT INTO oh_cats (user_id, name, icon, color, sort) VALUES ($uid, '" . E($c[0]) . "', '{$c[1]}', '{$c[2]}', $i)");
        $conn->query("INSERT INTO oh_funds (user_id, name, kind, color) VALUES ($uid, 'Main fund', 'custody', '#0f766e')");
        return;
    }
    $cats = [
        ['مواصلات ووقود', 'car', '#0ea5e9'], ['مطاعم وضيافة', 'coffee', '#f97316'],
        ['مستلزمات ومكتبية', 'package', '#8b5cf6'], ['صيانة وإصلاح', 'wrench', '#64748b'],
        ['اتصالات وإنترنت', 'wifi', '#06b6d4'], ['رسوم حكومية', 'landmark', '#0f766e'],
        ['تعليم ومدارس', 'graduation', '#2563eb'], ['مشتريات منزلية', 'home', '#db2777'],
        ['صحة وعلاج', 'heart', '#dc2626'], ['أخرى', 'tag', '#94a3b8'],
    ];
    foreach ($cats as $i => $c)
        $conn->query("INSERT INTO oh_cats (user_id, name, icon, color, sort) VALUES ($uid, '" . E($c[0]) . "', '{$c[1]}', '{$c[2]}', $i)");
    $conn->query("INSERT INTO oh_funds (user_id, name, kind, color) VALUES ($uid, 'الصندوق الرئيسي', 'custody', '#0f766e')");
}

// ─── الدخول بالبصمة (WebAuthn / مفاتيح المرور) ─────────────────────────────
// الجوّال يتحقّق من صاحبه ببصمته أو وجهه، ثم يوقّع تحدّياً بمفتاحٍ خاصّ لا
// يغادر الجهاز. نحفظ المفتاح العام وحده، فلا بصمة ولا كلمة مرور تصل خادمنا.
// النطاق semak.sa يجمع semak.sa/ohda وohda.semak.sa، فالمفتاح يصلح للاثنين.
function pk_rp() { $h = strtolower($_SERVER['HTTP_HOST'] ?? ''); return preg_match('/(^|\.)semak\.sa$/', $h) ? 'semak.sa' : $h; }
function pk_origin_ok($o) {
    $h = parse_url((string)$o, PHP_URL_HOST); $sc = parse_url((string)$o, PHP_URL_SCHEME);
    if ($sc !== 'https' || !$h) return false;
    $rp = pk_rp();
    return $h === $rp || substr($h, -strlen('.' . $rp)) === '.' . $rp;
}
function pk_challenge($kind, $uid) {
    global $conn;
    $conn->query("DELETE FROM oh_challenges WHERE exp < " . time());
    $ch = b64u(random_bytes(32));
    $conn->query("INSERT INTO oh_challenges (ch, user_id, kind, exp) VALUES ('$ch', " . ($uid ? (int)$uid : 'NULL') . ", '$kind', " . (time() + 300) . ")");
    return $ch;
}
// التحدّي يُستهلك مرّةً واحدة: يُحذف لحظة التحقّق نجح أو فشل
function pk_take($ch, $kind) {
    global $conn;
    $ch = E($ch);
    $row = $conn->query("SELECT * FROM oh_challenges WHERE ch='$ch' AND kind='" . E($kind) . "' AND exp >= " . time())->fetch_assoc();
    $conn->query("DELETE FROM oh_challenges WHERE ch='$ch'");
    return $row;
}
function cbor_len($s, &$o, $ai) {
    if ($ai < 24) return $ai;
    if ($ai === 24) return ord($s[$o++]);
    if ($ai === 25) { $v = unpack('n', substr($s, $o, 2))[1]; $o += 2; return $v; }
    if ($ai === 26) { $v = unpack('N', substr($s, $o, 4))[1]; $o += 4; return $v; }
    if ($ai === 27) { $v = unpack('J', substr($s, $o, 8))[1]; $o += 8; return $v; }
    throw new Exception('cbor');
}
function cbor_dec($s, &$o) {
    if ($o >= strlen($s)) throw new Exception('cbor');
    $b = ord($s[$o++]); $mt = $b >> 5; $ai = $b & 31;
    $n = cbor_len($s, $o, $ai);
    switch ($mt) {
        case 0: return $n;
        case 1: return -1 - $n;
        case 2: case 3: $v = substr($s, $o, $n); $o += $n; return $v;
        case 4: $a = []; for ($i = 0; $i < $n; $i++) $a[] = cbor_dec($s, $o); return $a;
        case 5: $m = []; for ($i = 0; $i < $n; $i++) { $k = cbor_dec($s, $o); $m[$k] = cbor_dec($s, $o); } return $m;
        case 6: return cbor_dec($s, $o);
        default: return $ai === 21 ? true : ($ai === 20 ? false : null);
    }
}
function der_len($n) { if ($n < 128) return chr($n); $b = ''; while ($n > 0) { $b = chr($n & 255) . $b; $n >>= 8; } return chr(0x80 | strlen($b)) . $b; }
function der($tag, $body) { return chr($tag) . der_len(strlen($body)) . $body; }
function der_int($x) { $x = ltrim($x, "\0"); if ($x === '' || (ord($x[0]) & 0x80)) $x = "\0" . $x; return der(0x02, $x); }
// مفتاح COSE (ES256 أو RS256) إلى PEM يفهمه openssl
function cose_pem($k) {
    if (!is_array($k)) return null;
    if (($k[1] ?? 0) === 2 && ($k[-1] ?? 0) === 1 && isset($k[-2], $k[-3]) && strlen($k[-2]) === 32 && strlen($k[-3]) === 32)
        $spki = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . "\x04" . $k[-2] . $k[-3];
    elseif (($k[1] ?? 0) === 3 && isset($k[-1], $k[-2]))
        $spki = der(0x30, der(0x30, hex2bin('06092a864886f70d0101010500')) . der(0x03, "\0" . der(0x30, der_int($k[-1]) . der_int($k[-2]))));
    else return null;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
}
// التحقّق من بيانات العميل: النوع والتحدّي والأصل
function pk_client($cdj, $type, $kind) {
    $c = json_decode($cdj, true);
    if (!$c || ($c['type'] ?? '') !== $type) return [null, 'بيانات غير صالحة'];
    if (!pk_origin_ok($c['origin'] ?? '')) return [null, 'مصدر الطلب غير موثوق'];
    $row = pk_take((string)($c['challenge'] ?? ''), $kind);
    if (!$row) return [null, 'انتهت مهلة التحقّق، أعد المحاولة'];
    return [$row, null];
}
// بيانات المصادقِ: بصمة النطاق، ووجود المستخدم وتحقّقه (البصمة أو الوجه)
function pk_authdata($ad) {
    if (strlen($ad) < 37) return null;
    if (!hash_equals(hash('sha256', pk_rp(), true), substr($ad, 0, 32))) return null;
    $flags = ord($ad[32]);
    if (!($flags & 0x01) || !($flags & 0x04)) return null;          // حضورٌ وتحقّقٌ إلزاميان
    return ['flags' => $flags, 'count' => unpack('N', substr($ad, 33, 4))[1]];
}

// ─── ملفّ الحساب ────────────────────────────────────────────────────────────
// بيانات المنشأة وصاحب العهدة والمعتمِد: تظهر في كشوف الحساب وتقارير التصفية
const PROFILE_KEYS = ['org_name', 'org_name_en', 'vat_no', 'cr_no', 'org_address', 'org_phone', 'org_email',
    'beneficiary', 'employee_no', 'job_title', 'department', 'iban', 'bank',
    'approver_name', 'approver_title', 'report_note'];
function profile_of($row) {
    $p = json_decode((string)($row['profile'] ?? ''), true);
    $out = [];
    foreach (PROFILE_KEYS as $k) $out[$k] = is_array($p) && isset($p[$k]) ? (string)$p[$k] : '';
    return $out;
}

// ─── الدخول ─────────────────────────────────────────────────────────────────
function make_token($uid) {
    $p = b64u(json_encode(['u' => (int)$uid, 'e' => time() + 60 * 86400]));
    return $p . '.' . b64u(hash_hmac('sha256', $p, OH_KEY, true));
}
function read_token() {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$h && function_exists('apache_request_headers')) { $ah = apache_request_headers(); $h = $ah['Authorization'] ?? $ah['authorization'] ?? ''; }
    if (!preg_match('/Bearer\s+(\S+)/', $h, $m)) return 0;
    $parts = explode('.', $m[1]);
    if (count($parts) !== 2) return 0;
    if (!hash_equals(b64u(hash_hmac('sha256', $parts[0], OH_KEY, true)), $parts[1])) return 0;
    $p = json_decode(b64u_dec($parts[0]), true);
    if (!$p || ($p['e'] ?? 0) < time()) return 0;
    return (int)$p['u'];
}
function me() {
    static $u = false;
    if ($u !== false) return $u;
    global $conn;
    $u = null;
    $id = read_token();
    if ($id && ($r = $conn->query("SELECT id, username, name, role, active, lang, phone, email FROM oh_users WHERE id=$id LIMIT 1")))
        if (($x = $r->fetch_assoc()) && (int)$x['active'] === 1) $u = $x;
    return $u;
}
function need() { $u = me(); if (!$u) fail('انتهت الجلسة، سجّل الدخول من جديد', 401); return $u; }
function need_admin() { $u = need(); if ($u['role'] !== 'admin') fail('للمدير فقط', 403); return $u; }

// رابط موقَّع للملف: يصلح لوسم <img> الذي لا يحمل ترويسة الدخول، ويسقط بعد ساعتين
function file_sig($id, $exp) { return b64u(hash_hmac('sha256', "f:$id:$exp", OH_KEY, true)); }
function base_url() {
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return 'https://' . ($_SERVER['HTTP_HOST'] ?? 'semak.sa') . $dir . '/';
}
function doc_link($id, $driveId) {
    if ($driveId) return 'https://drive.google.com/file/d/' . rawurlencode($driveId) . '/view';
    $exp = time() + 365 * 86400;
    return base_url() . 'api.php?action=file&id=' . (int)$id . '&exp=' . $exp . '&sig=' . file_sig($id, $exp);
}
function logo_url($uid) {
    $exp = time() + 7200;
    return 'api.php?action=logo&u=' . (int)$uid . '&exp=' . $exp . '&sig=' . b64u(hash_hmac('sha256', "l:$uid:$exp", OH_KEY, true));
}
// الجوّال السعودي بصيغةٍ دولية واحدة (9665xxxxxxxx) فيصلح لرابط واتساب مباشرة
function norm_phone($v) {
    $d = preg_replace('/\D+/', '', strtr((string)$v, ['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']));
    if ($d === '') return '';
    if (strpos($d, '00') === 0) $d = substr($d, 2);
    if (preg_match('/^05\d{8}$/', $d)) $d = '966' . substr($d, 1);
    if (preg_match('/^5\d{8}$/', $d)) $d = '966' . $d;
    return preg_match('/^\d{8,15}$/', $d) ? $d : '';
}
function file_url($id) { $exp = time() + 7200; return 'api.php?action=file&id=' . (int)$id . '&exp=' . $exp . '&sig=' . file_sig($id, $exp); }

// ─── Google Drive ───────────────────────────────────────────────────────────
// حساب المدير وحده يُربط، ولكل مستخدم مجلده تحت «عُهدة». النطاق drive.file:
// لا يرى التطبيق من درايفك إلا ما أنشأه هو.
function drive_ready() { return secret_set(OH_G_ID) && secret_set(OH_G_SECRET) && meta_get('drive_refresh'); }
function drive_token() {
    $cached = json_decode((string)meta_get('drive_access'), true);
    if ($cached && ($cached['exp'] ?? 0) > time() + 60) return $cached['t'];
    $rt = meta_get('drive_refresh');
    if (!$rt) return null;
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
        CURLOPT_POSTFIELDS => http_build_query(['client_id' => OH_G_ID, 'client_secret' => OH_G_SECRET,
            'refresh_token' => $rt, 'grant_type' => 'refresh_token'])]);
    $res = json_decode((string)curl_exec($ch), true); curl_close($ch);
    if (empty($res['access_token'])) { meta_set('drive_error', json_encode($res, JSON_UNESCAPED_UNICODE)); return null; }
    meta_set('drive_access', json_encode(['t' => $res['access_token'], 'exp' => time() + (int)($res['expires_in'] ?? 3600)]));
    return $res['access_token'];
}
function drive_folder($name, $parent, $tok) {
    $ch = curl_init('https://www.googleapis.com/drive/v3/files?fields=id');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $tok, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(array_filter(['name' => $name, 'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => $parent ? [$parent] : null]), JSON_UNESCAPED_UNICODE)]);
    $res = json_decode((string)curl_exec($ch), true); curl_close($ch);
    return $res['id'] ?? null;
}
function drive_root($tok) {
    $id = meta_get('drive_root');
    if ($id) return $id;
    $id = drive_folder('عُهدة', null, $tok);
    if ($id) meta_set('drive_root', $id);
    return $id;
}
function drive_user_folder($uid, $tok) {
    global $conn;
    $u = $conn->query("SELECT name, drive_folder FROM oh_users WHERE id=" . (int)$uid)->fetch_assoc();
    if (!$u) return null;
    if ($u['drive_folder']) return $u['drive_folder'];
    $root = drive_root($tok);
    if (!$root) return null;
    $fid = drive_folder($u['name'], $root, $tok);
    if ($fid) $conn->query("UPDATE oh_users SET drive_folder='" . E($fid) . "' WHERE id=" . (int)$uid);
    return $fid;
}
function drive_upload_one($f, $tok) {
    global $conn;
    $folder = drive_user_folder($f['user_id'], $tok);
    if (!$folder) return false;
    $full = OH_FILES . '/' . $f['path'];
    if (!is_file($full)) { $conn->query("UPDATE oh_files SET drive_status='failed' WHERE id=" . (int)$f['id']); return false; }
    // اسم الملف في درايف يُقرأ وحده: التاريخ والجهة والمبلغ
    $name = $f['name'];
    if ($f['txn_id'] && ($t = $conn->query("SELECT d, vendor, amount FROM oh_txns WHERE id=" . (int)$f['txn_id'])->fetch_assoc())) {
        $ext = pathinfo($f['name'], PATHINFO_EXTENSION) ?: 'jpg';
        $name = $t['d'] . ' — ' . ($t['vendor'] ?: 'بلا جهة') . ' — ' . rtrim(rtrim($t['amount'], '0'), '.') . '.' . $ext;
    }
    $bd = 'oh' . bin2hex(random_bytes(8));
    $meta = json_encode(['name' => $name, 'parents' => [$folder]], JSON_UNESCAPED_UNICODE);
    $payload = "--$bd\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n--$bd\r\nContent-Type: {$f['mime']}\r\n\r\n"
        . file_get_contents($full) . "\r\n--$bd--";
    $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $tok, 'Content-Type: multipart/related; boundary=' . $bd],
        CURLOPT_POSTFIELDS => $payload]);
    $res = json_decode((string)curl_exec($ch), true); curl_close($ch);
    if (!empty($res['id'])) {
        $conn->query("UPDATE oh_files SET drive_id='" . E($res['id']) . "', drive_status='done' WHERE id=" . (int)$f['id']);
        return true;
    }
    meta_set('drive_error', json_encode($res, JSON_UNESCAPED_UNICODE));
    return false;
}
// نبضة درايف: بعد إرسال الرد للمستخدم، تُرفع الملفات المعلّقة دفعةً صغيرة
function drive_tick() {
    global $conn;
    if (!drive_ready()) return;
    $last = (int)meta_get('drive_tick');
    if (time() - $last < 20) return;
    meta_set('drive_tick', (string)time());
    $tok = drive_token();
    if (!$tok) return;
    // الملف يُرفع بعد ربطه بحركة، فيحمل اسماً مقروءاً؛ وما بقي يتيماً ساعةً يُرفع باسمه
    $r = $conn->query("SELECT * FROM oh_files WHERE drive_status='pending' AND deleted=0
        AND (txn_id IS NOT NULL OR created_at < NOW() - INTERVAL 1 HOUR) ORDER BY id LIMIT 6");
    while ($r && ($f = $r->fetch_assoc())) drive_upload_one($f, $tok);
}
register_shutdown_function(function () {
    if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
    try { drive_tick(); } catch (\Throwable $e) {}
});

// ─── قراءة الإيصال ──────────────────────────────────────────────────────────
function scan_file($files, $cats, $lang = 'ar') {
    if (!secret_set(OH_AI_KEY)) return ['error' => 'قراءة الإيصالات غير مفعّلة على الخادم'];
    // ملفٌّ واحد أو صفحاتٌ متعدّدة لمستندٍ واحد (فاتورةٌ طويلة، أو فاتورةٌ وإيصالها)
    if (isset($files['path'])) $files = [$files];
    $blocks = [];
    foreach (array_slice($files, 0, 8) as $f) {
        $full = OH_FILES . '/' . $f['path'];
        if (!is_file($full)) continue;
        $data = base64_encode(file_get_contents($full));
        $blocks[] = $f['mime'] === 'application/pdf'
            ? ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $data]]
            : ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $f['mime'], 'data' => $data]];
    }
    if (!$blocks) return ['error' => 'الملف غير موجود'];
    $catNames = array_values(array_unique(array_merge(array_map(function ($c) { return $c['name']; }, $cats), ['أخرى'])));
    $schema = [
        'type' => 'object',
        'properties' => [
            'doc_type'   => ['type' => 'string', 'enum' => ['receipt', 'invoice', 'transfer', 'other']],
            'vendor'     => ['type' => 'string'],
            'date'       => ['type' => 'string'],
            'total'      => ['type' => 'number'],
            'vat'        => ['type' => 'number'],
            'currency'   => ['type' => 'string'],
            'invoice_no' => ['type' => 'string'],
            'method'     => ['type' => 'string', 'enum' => ['cash', 'card', 'transfer', 'unknown']],
            'category'   => ['type' => 'string', 'enum' => $catNames],
            'items'      => ['type' => 'array', 'items' => ['type' => 'object',
                'properties' => ['name' => ['type' => 'string'], 'qty' => ['type' => 'number'], 'amount' => ['type' => 'number']],
                'required' => ['name', 'qty', 'amount'], 'additionalProperties' => false]],
            'confidence' => ['type' => 'string', 'enum' => ['high', 'medium', 'low']],
            'note'       => ['type' => 'string'],
        ],
        'required' => ['doc_type', 'vendor', 'date', 'total', 'vat', 'currency', 'invoice_no', 'method', 'category', 'items', 'confidence', 'note'],
        'additionalProperties' => false,
    ];
    $sys = "You read receipts, invoices and bank-transfer slips (mostly Saudi, Arabic or English) and extract the facts for an expense log.\n"
        . "- total: the final amount actually paid, including VAT. vat: the VAT amount if printed, else 0.\n"
        . "- date: YYYY-MM-DD in the Gregorian calendar; convert Hijri dates. Empty string if absent.\n"
        . "- vendor: the merchant's name as a person would say it (Arabic if the document is Arabic).\n"
        . "- category: the closest of the allowed values for what was bought.\n"
        . "- If a value is not on the document, use empty string or 0 and say so in note. Never invent numbers.\n"
        . "- note: one short " . ($lang === 'en' ? 'English' : 'Arabic') . " sentence of anything the user should double-check; empty if all is clear.";
    $payload = [
        'model' => 'claude-opus-5',
        'max_tokens' => 16000,
        'output_config' => ['effort' => 'low', 'format' => ['type' => 'json_schema', 'schema' => $schema]],
        'fallbacks' => 'default',
        'system' => $sys,
        'messages' => [['role' => 'user', 'content' => array_merge($blocks, [['type' => 'text', 'text' => count($blocks) > 1
            ? 'These ' . count($blocks) . ' images are pages of ONE document, in order. Combine all items; take totals from the page that shows them.'
            : 'استخرج بيانات هذا المستند.']])]],
    ];
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: ' . OH_AI_KEY, 'anthropic-version: 2023-06-01',
            'anthropic-beta: server-side-fallback-2026-07-01'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
    $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $res = json_decode((string)$raw, true);
    if ($code !== 200 || !$res) return ['error' => 'تعذّرت القراءة (' . $code . ')' . (!empty($res['error']['message']) ? ': ' . $res['error']['message'] : '')];
    if (($res['stop_reason'] ?? '') === 'refusal') return ['error' => 'رفض القارئ هذا المستند'];
    if (($res['stop_reason'] ?? '') === 'max_tokens') return ['error' => 'المستند أطول من المتوقّع'];
    foreach ((array)($res['content'] ?? []) as $b)
        if (($b['type'] ?? '') === 'text') { $j = json_decode($b['text'], true); if (is_array($j)) return $j; }
    return ['error' => 'لم يُفهم ردّ القارئ'];
}

// ═════════════════════════════════════════════════════════════════════════════
$action = $_GET['action'] ?? '';

switch ($action) {

// ─── الحالة والتهيئة ────────────────────────────────────────────────────────
case 'status': {
    $n = (int)$conn->query("SELECT COUNT(*) n FROM oh_users")->fetch_assoc()['n'];
    out(['success' => true, 'needs_setup' => $n === 0, 'ai' => secret_set(OH_AI_KEY),
         'drive_configured' => secret_set(OH_G_ID) && secret_set(OH_G_SECRET), 'drive_linked' => (bool)meta_get('drive_refresh')]);
}

// أول حساب يصير المدير، وتُغلق التهيئة بعده إلى الأبد
case 'setup': {
    $n = (int)$conn->query("SELECT COUNT(*) n FROM oh_users")->fetch_assoc()['n'];
    if ($n > 0) fail('التهيئة مغلقة — يوجد مدير');
    $b = body();
    $un = strtolower(trim((string)($b['username'] ?? '')));
    $nm = trim((string)($b['name'] ?? ''));
    $pw = (string)($b['password'] ?? '');
    if (!preg_match('/^[a-z0-9_.-]{3,40}$/', $un)) fail('اسم الدخول: حروف إنجليزية وأرقام، ٣ أحرف فأكثر');
    if (mb_strlen($nm) < 2) fail('الاسم مطلوب');
    if (strlen($pw) < 8) fail('كلمة المرور ثمانية أحرف فأكثر');
    $lang = ($b['lang'] ?? 'ar') === 'en' ? 'en' : 'ar';
    $conn->query("INSERT INTO oh_users (username, name, pass_hash, role, lang) VALUES ('" . E($un) . "', '" . E($nm) . "', '"
        . E(password_hash($pw, PASSWORD_DEFAULT)) . "', 'admin', '$lang')");
    $uid = (int)$conn->insert_id;
    seed_cats($uid, $lang);
    oh_log($uid, 'setup');
    out(['success' => true, 'token' => make_token($uid)]);
}

case 'login': {
    $b = body();
    $un = strtolower(trim((string)($b['username'] ?? '')));
    // تباطؤ بعد المحاولات الفاشلة: ثماني محاولات في ربع ساعة لكل اسم
    $fails = (int)$conn->query("SELECT COUNT(*) n FROM oh_log WHERE action='login_fail' AND data='" . E(json_encode($un)) . "'
        AND at > NOW() - INTERVAL 15 MINUTE")->fetch_assoc()['n'];
    if ($fails >= 8) fail('محاولات كثيرة — انتظر ربع ساعة');
    $u = $conn->query("SELECT * FROM oh_users WHERE username='" . E($un) . "' LIMIT 1")->fetch_assoc();
    if (!$u || !password_verify((string)($b['password'] ?? ''), $u['pass_hash'])) {
        oh_log(null, 'login_fail', null, null, $un);
        fail('اسم الدخول أو كلمة المرور غير صحيحة');
    }
    if ((int)$u['active'] !== 1) fail('الحساب موقوف');
    $conn->query("UPDATE oh_users SET last_login=NOW() WHERE id=" . (int)$u['id']);
    out(['success' => true, 'token' => make_token($u['id'])]);
}

case 'me': {
    $u = need();
    $row = $conn->query("SELECT profile, logo FROM oh_users WHERE id=" . (int)$u['id'])->fetch_assoc();
    out(['success' => true, 'user' => $u, 'profile' => profile_of($row),
         'logo_url' => $row['logo'] ? logo_url((int)$u['id']) : null, 'ai' => secret_set(OH_AI_KEY),
         'drive_linked' => (bool)meta_get('drive_refresh'), 'drive_configured' => secret_set(OH_G_ID) && secret_set(OH_G_SECRET)]);
}

case 'password': {
    $u = need();
    $b = body();
    $row = $conn->query("SELECT pass_hash FROM oh_users WHERE id=" . (int)$u['id'])->fetch_assoc();
    if (!password_verify((string)($b['old'] ?? ''), $row['pass_hash'])) fail('كلمة المرور الحالية غير صحيحة');
    if (strlen((string)($b['new'] ?? '')) < 8) fail('كلمة المرور الجديدة ثمانية أحرف فأكثر');
    $conn->query("UPDATE oh_users SET pass_hash='" . E(password_hash($b['new'], PASSWORD_DEFAULT)) . "' WHERE id=" . (int)$u['id']);
    oh_log($u['id'], 'password');
    out(['success' => true]);
}

// ─── ملفّ الحساب ────────────────────────────────────────────────────────────
case 'profile_save': {
    $u = need(); $uid = (int)$u['id']; $b = body();
    $row = $conn->query("SELECT profile FROM oh_users WHERE id=$uid")->fetch_assoc();
    $p = profile_of($row);
    foreach (PROFILE_KEYS as $k) if (array_key_exists($k, $b)) $p[$k] = mb_substr(trim((string)$b[$k]), 0, $k === 'report_note' ? 600 : 200);
    if ($p['vat_no'] !== '' && !preg_match('/^\d{15}$/', $p['vat_no'])) fail('الرقم الضريبي ١٥ رقماً');
    if ($p['iban'] !== '') {
        $p['iban'] = strtoupper(preg_replace('/\s+/', '', $p['iban']));
        if (!preg_match('/^SA\d{22}$/', $p['iban'])) fail('الآيبان السعودي يبدأ بـ SA ثم ٢٢ رقماً');
    }
    $set = "profile='" . E(json_encode($p, JSON_UNESCAPED_UNICODE)) . "'";
    if (array_key_exists('name', $b) && mb_strlen(trim((string)$b['name'])) >= 2) $set .= ", name='" . E(trim($b['name'])) . "'";
    if (array_key_exists('email', $b)) {
        $em = trim((string)$b['email']);
        if ($em !== '' && !filter_var($em, FILTER_VALIDATE_EMAIL)) fail('البريد الإلكتروني غير صحيح');
        $set .= ", email=" . ($em === '' ? 'NULL' : "'" . E($em) . "'");
    }
    if (array_key_exists('phone', $b)) {
        $ph = norm_phone($b['phone']);
        if ($b['phone'] !== '' && $ph === '') fail('رقم الجوال غير صحيح');
        $set .= ", phone=" . ($ph === '' ? 'NULL' : "'" . E($ph) . "'");
    }
    if (in_array($b['lang'] ?? '', ['ar', 'en'], true)) $set .= ", lang='" . $b['lang'] . "'";
    $conn->query("UPDATE oh_users SET $set WHERE id=$uid");
    oh_log($uid, 'profile_save', 'user', $uid, $b);
    out(['success' => true, 'profile' => $p]);
}

case 'logo_upload': {
    $u = need(); $uid = (int)$u['id'];
    if (!empty(body()['remove'])) {
        $conn->query("UPDATE oh_users SET logo=NULL WHERE id=$uid");
        oh_log($uid, 'logo_remove');
        out(['success' => true, 'logo_url' => null]);
    }
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) fail('لم يصل الملف');
    $f = $_FILES['file'];
    if ($f['size'] > 3 * 1024 * 1024) fail('الشعار ثلاثة ميجابايت كحدٍّ أقصى');
    $fi = finfo_open(FILEINFO_MIME_TYPE); $mime = finfo_file($fi, $f['tmp_name']); finfo_close($fi);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if (!$ext) fail('الشعار صورة PNG أو JPG');
    $dir = OH_FILES . '/' . $uid;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail('تعذّر إنشاء مجلد الملفات');
    if (!is_file(OH_FILES . '/.htaccess')) @file_put_contents(OH_FILES . '/.htaccess', "Require all denied\nDeny from all\n");
    $rel = $uid . '/logo-' . bin2hex(random_bytes(5)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], OH_FILES . '/' . $rel)) fail('فشل الحفظ');
    $conn->query("UPDATE oh_users SET logo='" . E($rel) . "' WHERE id=$uid");
    oh_log($uid, 'logo_upload');
    out(['success' => true, 'logo_url' => logo_url($uid)]);
}

// الشعار برابطٍ موقَّع كالمستندات: يصلح لوسم الصورة وللطباعة
case 'logo': {
    $uid = (int)($_GET['u'] ?? 0); $exp = (int)($_GET['exp'] ?? 0);
    if ($exp < time() || !hash_equals(b64u(hash_hmac('sha256', "l:$uid:$exp", OH_KEY, true)), (string)($_GET['sig'] ?? ''))) fail('الرابط منتهٍ', 403);
    $row = $conn->query("SELECT logo FROM oh_users WHERE id=$uid")->fetch_assoc();
    if (!$row || !$row['logo'] || !is_file(OH_FILES . '/' . $row['logo'])) fail('غير موجود', 404);
    $full = OH_FILES . '/' . $row['logo'];
    $fi = finfo_open(FILEINFO_MIME_TYPE); $mime = finfo_file($fi, $full); finfo_close($fi);
    ob_end_clean();
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=3600');
    readfile($full);
    exit;
}

// ─── مفاتيح المرور ──────────────────────────────────────────────────────────
case 'pk_reg_options': {
    $u = need(); $uid = (int)$u['id'];
    $ex = [];
    $r = $conn->query("SELECT cred_id FROM oh_passkeys WHERE user_id=$uid");
    while ($r && ($x = $r->fetch_assoc())) $ex[] = ['type' => 'public-key', 'id' => $x['cred_id']];
    out(['success' => true, 'options' => [
        'challenge' => pk_challenge('reg', $uid),
        'rp' => ['id' => pk_rp(), 'name' => 'Ohda'],
        'user' => ['id' => b64u('ohda:' . $uid), 'name' => $u['username'], 'displayName' => $u['name']],
        'pubKeyCredParams' => [['type' => 'public-key', 'alg' => -7], ['type' => 'public-key', 'alg' => -257]],
        'authenticatorSelection' => ['authenticatorAttachment' => 'platform', 'userVerification' => 'required', 'residentKey' => 'required', 'requireResidentKey' => true],
        'attestation' => 'none', 'timeout' => 60000, 'excludeCredentials' => $ex,
    ]]);
}

case 'pk_reg_verify': {
    $u = need(); $uid = (int)$u['id']; $b = body();
    [$row, $err] = pk_client(b64u_dec((string)($b['clientDataJSON'] ?? '')), 'webauthn.create', 'reg');
    if ($err) fail($err);
    if ((int)$row['user_id'] !== $uid) fail('بيانات غير صالحة');
    try {
        $o = 0; $att = cbor_dec(b64u_dec((string)($b['attestationObject'] ?? '')), $o);
        $ad = $att['authData'] ?? '';
        $info = pk_authdata($ad);
        if (!$info || !($info['flags'] & 0x40)) fail('لم يُتحقَّق من البصمة');
        $len = unpack('n', substr($ad, 53, 2))[1];
        $cid = substr($ad, 55, $len);
        $oo = 55 + $len; $cose = cbor_dec($ad, $oo);
    } catch (\Throwable $e) { fail('تعذّرت قراءة بيانات الجهاز'); }
    $pem = cose_pem($cose);
    if (!$pem || !openssl_pkey_get_public($pem)) fail('نوع مفتاح غير مدعوم');
    $cidB = b64u($cid);
    $name = mb_substr(trim((string)($b['name'] ?? '')), 0, 120) ?: 'جهاز';
    $conn->query("INSERT INTO oh_passkeys (user_id, cred_id, pubkey, sign_count, name) VALUES ($uid, '" . E($cidB) . "', '" . E($pem) . "', "
        . (int)$info['count'] . ", '" . E($name) . "') ON DUPLICATE KEY UPDATE pubkey=VALUES(pubkey), name=VALUES(name)");
    oh_log($uid, 'passkey_add', 'passkey', (int)$conn->insert_id, $name);
    out(['success' => true]);
}

// خيارات الدخول بلا اسم مستخدم: الجهاز يعرض مفاتيحه المحفوظة لهذا النطاق
case 'pk_auth_options': {
    out(['success' => true, 'options' => [
        'challenge' => pk_challenge('auth', 0), 'rpId' => pk_rp(),
        'userVerification' => 'required', 'timeout' => 60000, 'allowCredentials' => [],
    ]]);
}

case 'pk_auth_verify': {
    $b = body();
    [$row, $err] = pk_client(b64u_dec((string)($b['clientDataJSON'] ?? '')), 'webauthn.get', 'auth');
    if ($err) fail($err);
    $cid = E((string)($b['id'] ?? ''));
    $k = $conn->query("SELECT k.*, u.active FROM oh_passkeys k JOIN oh_users u ON u.id=k.user_id WHERE k.cred_id='$cid' LIMIT 1")->fetch_assoc();
    if (!$k) { oh_log(null, 'passkey_fail', null, null, 'unknown'); fail('هذه البصمة غير مسجّلة — ادخل بكلمة المرور ثم فعّلها من الإعدادات'); }
    if ((int)$k['active'] !== 1) fail('الحساب موقوف');
    $ad = b64u_dec((string)($b['authenticatorData'] ?? ''));
    $info = pk_authdata($ad);
    if (!$info) fail('لم يُتحقَّق من البصمة');
    $cdj = b64u_dec((string)($b['clientDataJSON'] ?? ''));
    $ok = openssl_verify($ad . hash('sha256', $cdj, true), b64u_dec((string)($b['signature'] ?? '')), $k['pubkey'], OPENSSL_ALGO_SHA256);
    if ($ok !== 1) { oh_log((int)$k['user_id'], 'passkey_fail', 'passkey', (int)$k['id']); fail('تعذّر التحقّق من البصمة'); }
    // عدّاد التوقيع يكشف نسخ المفتاح؛ الأجهزة التي تُبقيه صفراً تُعفى
    if ($info['count'] > 0 && $info['count'] <= (int)$k['sign_count']) { oh_log((int)$k['user_id'], 'passkey_clone', 'passkey', (int)$k['id']); fail('تعذّر التحقّق من البصمة'); }
    $conn->query("UPDATE oh_passkeys SET sign_count=" . (int)$info['count'] . ", last_used=NOW() WHERE id=" . (int)$k['id']);
    $conn->query("UPDATE oh_users SET last_login=NOW() WHERE id=" . (int)$k['user_id']);
    oh_log((int)$k['user_id'], 'passkey_login', 'passkey', (int)$k['id']);
    out(['success' => true, 'token' => make_token($k['user_id'])]);
}

case 'pk_list': {
    $u = need(); $uid = (int)$u['id'];
    $rows = [];
    $r = $conn->query("SELECT id, name, created_at, last_used FROM oh_passkeys WHERE user_id=$uid ORDER BY id");
    while ($r && ($x = $r->fetch_assoc())) $rows[] = $x;
    out(['success' => true, 'data' => $rows]);
}

case 'pk_delete': {
    $u = need(); $uid = (int)$u['id'];
    $id = (int)(body()['id'] ?? 0);
    $conn->query("DELETE FROM oh_passkeys WHERE id=$id AND user_id=$uid");
    oh_log($uid, 'passkey_remove', 'passkey', $id);
    out(['success' => true]);
}

// ─── المستخدمون (المدير) ────────────────────────────────────────────────────
case 'users': {
    need_admin();
    $rows = [];
    $r = $conn->query("SELECT u.id, u.username, u.name, u.role, u.active, u.created_at, u.last_login, u.drive_folder, u.phone, u.lang,
        (SELECT COUNT(*) FROM oh_txns t WHERE t.user_id=u.id AND t.deleted=0) txns
        FROM oh_users u ORDER BY u.id");
    while ($r && ($x = $r->fetch_assoc())) $rows[] = $x;
    out(['success' => true, 'data' => $rows]);
}

case 'user_save': {
    $a = need_admin();
    $b = body();
    $id = (int)($b['id'] ?? 0);
    $nm = trim((string)($b['name'] ?? ''));
    if (mb_strlen($nm) < 2) fail('الاسم مطلوب');
    $ph = norm_phone($b['phone'] ?? '');
    if (!empty($b['phone']) && $ph === '') fail('رقم الجوال غير صحيح');
    $lang = ($b['lang'] ?? 'ar') === 'en' ? 'en' : 'ar';
    if ($id) {
        $set = "name='" . E($nm) . "', active=" . (!empty($b['active']) ? 1 : 0);
        if ($id === (int)$a['id']) $set = "name='" . E($nm) . "'";          // لا يوقف المدير نفسه
        $set .= ", phone=" . ($ph === '' ? 'NULL' : "'$ph'") . ", lang='$lang'";
        if (!empty($b['password'])) {
            if (strlen($b['password']) < 8) fail('كلمة المرور ثمانية أحرف فأكثر');
            $set .= ", pass_hash='" . E(password_hash($b['password'], PASSWORD_DEFAULT)) . "'";
        }
        $conn->query("UPDATE oh_users SET $set WHERE id=$id");
        oh_log($a['id'], 'user_update', 'user', $id);
        out(['success' => true, 'id' => $id]);
    }
    $un = strtolower(trim((string)($b['username'] ?? '')));
    if (!preg_match('/^[a-z0-9_.-]{3,40}$/', $un)) fail('اسم الدخول: حروف إنجليزية وأرقام، ٣ أحرف فأكثر');
    if (strlen((string)($b['password'] ?? '')) < 8) fail('كلمة المرور ثمانية أحرف فأكثر');
    if ($conn->query("SELECT id FROM oh_users WHERE username='" . E($un) . "'")->num_rows) fail('اسم الدخول مستعمل');
    $conn->query("INSERT INTO oh_users (username, name, pass_hash, role, lang, phone) VALUES ('" . E($un) . "', '" . E($nm) . "', '"
        . E(password_hash($b['password'], PASSWORD_DEFAULT)) . "', 'user', '$lang', " . ($ph === '' ? 'NULL' : "'$ph'") . ")");
    $nid = (int)$conn->insert_id;
    seed_cats($nid, $lang);
    oh_log($a['id'], 'user_create', 'user', $nid, $un);
    out(['success' => true, 'id' => $nid]);
}

// ─── الصناديق (العُهد) ──────────────────────────────────────────────────────
case 'funds': {
    $u = need(); $uid = (int)$u['id'];
    $rows = [];
    $r = $conn->query("SELECT f.*,
        COALESCE((SELECT SUM(amount) FROM oh_txns t WHERE t.fund_id=f.id AND t.deleted=0 AND t.type='in'),0)  AS received,
        COALESCE((SELECT SUM(amount) FROM oh_txns t WHERE t.fund_id=f.id AND t.deleted=0 AND t.type='out'),0) AS spent,
        (SELECT COUNT(*) FROM oh_txns t WHERE t.fund_id=f.id AND t.deleted=0 AND t.type='out') AS n_out,
        (SELECT COUNT(*) FROM oh_txns t WHERE t.fund_id=f.id AND t.deleted=0 AND t.type='out'
            AND NOT EXISTS (SELECT 1 FROM oh_files x WHERE x.txn_id=t.id AND x.deleted=0)) AS no_receipt
        FROM oh_funds f WHERE f.user_id=$uid AND f.deleted=0 ORDER BY f.status='settled', f.id");
    while ($r && ($x = $r->fetch_assoc())) {
        $x['balance'] = round($x['received'] - $x['spent'], 2);
        $rows[] = $x;
    }
    out(['success' => true, 'data' => $rows]);
}

case 'fund_save': {
    $u = need(); $uid = (int)$u['id']; $b = body();
    $id = (int)($b['id'] ?? 0);
    $nm = trim((string)($b['name'] ?? ''));
    if ($nm === '') fail('اسم العهدة مطلوب');
    $kind = in_array($b['kind'] ?? '', ['custody', 'budget', 'personal'], true) ? $b['kind'] : 'custody';
    $col = preg_match('/^#[0-9a-f]{6}$/i', (string)($b['color'] ?? '')) ? $b['color'] : '#0f766e';
    if ($id) {
        $conn->query("UPDATE oh_funds SET name='" . E($nm) . "', kind='$kind', color='$col', note='" . E($b['note'] ?? '') . "'
            WHERE id=$id AND user_id=$uid");
    } else {
        $conn->query("INSERT INTO oh_funds (user_id, name, kind, color, note) VALUES ($uid, '" . E($nm) . "', '$kind', '$col', '" . E($b['note'] ?? '') . "')");
        $id = (int)$conn->insert_id;
    }
    oh_log($uid, 'fund_save', 'fund', $id, $b);
    out(['success' => true, 'id' => $id]);
}

// تصفية العهدة: تُقفل ولا يُحذف منها شيء؛ ويمكن إعادة فتحها
case 'fund_settle': {
    $u = need(); $uid = (int)$u['id']; $b = body();
    $id = (int)($b['id'] ?? 0);
    $open = !empty($b['reopen']);
    $conn->query("UPDATE oh_funds SET status='" . ($open ? 'open' : 'settled') . "', settled_at=" . ($open ? 'NULL' : 'NOW()')
        . " WHERE id=$id AND user_id=$uid");
    oh_log($uid, $open ? 'fund_reopen' : 'fund_settle', 'fund', $id);
    out(['success' => true]);
}

// ─── التصنيفات والميزانيات ──────────────────────────────────────────────────
case 'cats': {
    $u = need(); $uid = (int)$u['id'];
    $rows = [];
    $r = $conn->query("SELECT * FROM oh_cats WHERE user_id=$uid AND deleted=0 ORDER BY sort, id");
    while ($r && ($x = $r->fetch_assoc())) { $x['budget'] = (float)$x['budget']; $rows[] = $x; }
    out(['success' => true, 'data' => $rows]);
}

case 'cat_save': {
    $u = need(); $uid = (int)$u['id']; $b = body();
    $id = (int)($b['id'] ?? 0);
    $nm = trim((string)($b['name'] ?? ''));
    if ($nm === '') fail('اسم التصنيف مطلوب');
    $col = preg_match('/^#[0-9a-f]{6}$/i', (string)($b['color'] ?? '')) ? $b['color'] : '#64748b';
    $icon = preg_match('/^[a-z-]{2,24}$/', (string)($b['icon'] ?? '')) ? $b['icon'] : 'tag';
    $bud = max(0, round((float)($b['budget'] ?? 0), 2));
    if (!empty($b['delete']) && $id) {
        $conn->query("UPDATE oh_cats SET deleted=1 WHERE id=$id AND user_id=$uid");
        oh_log($uid, 'cat_delete', 'cat', $id);
        out(['success' => true]);
    }
    if ($id) $conn->query("UPDATE oh_cats SET name='" . E($nm) . "', color='$col', icon='$icon', budget=$bud WHERE id=$id AND user_id=$uid");
    else { $conn->query("INSERT INTO oh_cats (user_id, name, color, icon, budget, sort) VALUES ($uid, '" . E($nm) . "', '$col', '$icon', $bud, 99)"); $id = (int)$conn->insert_id; }
    oh_log($uid, 'cat_save', 'cat', $id, $b);
    out(['success' => true, 'id' => $id]);
}

// ─── الحركات ────────────────────────────────────────────────────────────────
case 'txns': {
    $u = need(); $uid = (int)$u['id'];
    $w = ["t.user_id=$uid", "t.deleted=" . (!empty($_GET['trash']) ? 1 : 0)];
    if (!empty($_GET['id']))   $w[] = 't.id=' . (int)$_GET['id'];
    if (!empty($_GET['fund'])) $w[] = 't.fund_id=' . (int)$_GET['fund'];
    if (!empty($_GET['cat']))  $w[] = ((int)$_GET['cat'] === -1 ? 't.cat_id IS NULL' : 't.cat_id=' . (int)$_GET['cat']);
    if (in_array($_GET['type'] ?? '', ['in', 'out'], true)) $w[] = "t.type='" . $_GET['type'] . "'";
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '')) $w[] = "t.d >= '" . $_GET['from'] . "'";
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? ''))   $w[] = "t.d <= '" . $_GET['to'] . "'";
    if (!empty($_GET['method']) && preg_match('/^[a-z]+$/', $_GET['method'])) $w[] = "t.method='" . $_GET['method'] . "'";
    if (!empty($_GET['vendor'])) $w[] = "t.vendor='" . E($_GET['vendor']) . "'";
    if (!empty($_GET['noreceipt'])) $w[] = "t.type='out' AND NOT EXISTS (SELECT 1 FROM oh_files x WHERE x.txn_id=t.id AND x.deleted=0)";
    if (!empty($_GET['q'])) { $q = E($_GET['q']); $w[] = "(t.vendor LIKE '%$q%' OR t.note LIKE '%$q%' OR t.ref LIKE '%$q%')"; }
    $rows = [];
    $r = $conn->query("SELECT t.*, c.name cat_name, c.color cat_color, c.icon cat_icon, f.name fund_name,
        (SELECT x.id FROM oh_files x WHERE x.txn_id=t.id AND x.deleted=0 ORDER BY x.id LIMIT 1) file_id,
        (SELECT x.mime FROM oh_files x WHERE x.txn_id=t.id AND x.deleted=0 ORDER BY x.id LIMIT 1) file_mime,
        (SELECT x.drive_status FROM oh_files x WHERE x.txn_id=t.id AND x.deleted=0 ORDER BY x.id LIMIT 1) drive_status
        FROM oh_txns t LEFT JOIN oh_cats c ON c.id=t.cat_id LEFT JOIN oh_funds f ON f.id=t.fund_id
        WHERE " . implode(' AND ', $w) . " ORDER BY t.d DESC, t.id DESC LIMIT 2000");
    while ($r && ($x = $r->fetch_assoc())) {
        $x['amount'] = (float)$x['amount']; $x['vat'] = (float)$x['vat'];
        $x['file_url'] = $x['file_id'] ? file_url($x['file_id']) : null;
        $x['files'] = [];
        $rows[] = $x;
    }
    // كل صفحات المستندات دفعةً واحدة، ثم توزَّع على حركاتها
    $withFiles = array_values(array_filter(array_map(function ($x) { return $x['file_id'] ? (int)$x['id'] : 0; }, $rows)));
    if ($withFiles) {
        $pos = []; foreach ($rows as $i => $x) $pos[(int)$x['id']] = $i;
        $fr = $conn->query("SELECT id, txn_id, mime, name, drive_id FROM oh_files WHERE deleted=0 AND txn_id IN (" . implode(',', $withFiles) . ") ORDER BY id");
        while ($fr && ($y = $fr->fetch_assoc()))
            $rows[$pos[(int)$y['txn_id']]]['files'][] = ['id' => (int)$y['id'], 'mime' => $y['mime'], 'name' => $y['name'], 'url' => file_url($y['id'])];
    }
    out(['success' => true, 'data' => $rows]);
}

// الجهات السابقة مع آخر تصنيفٍ استُعمل لكلٍّ منها: اختيار الجهة يختار تصنيفها
case 'vendors': {
    $u = need(); $uid = (int)$u['id'];
    $rows = [];
    $r = $conn->query("SELECT vendor, COUNT(*) n,
        SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(cat_id,0) ORDER BY id DESC), ',', 1) cat_id,
        SUBSTRING_INDEX(GROUP_CONCAT(method ORDER BY id DESC), ',', 1) method
        FROM oh_txns WHERE user_id=$uid AND deleted=0 AND type='out' AND vendor<>''
        GROUP BY vendor ORDER BY n DESC LIMIT 300");
    while ($r && ($x = $r->fetch_assoc())) { $x['cat_id'] = (int)$x['cat_id']; $x['n'] = (int)$x['n']; $rows[] = $x; }
    out(['success' => true, 'data' => $rows]);
}

case 'txn_save': {
    $u = need(); $uid = (int)$u['id']; $b = body();
    $id = (int)($b['id'] ?? 0);
    $type = ($b['type'] ?? 'out') === 'in' ? 'in' : 'out';
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($b['d'] ?? '')) ? $b['d'] : date('Y-m-d');
    $amt = round((float)($b['amount'] ?? 0), 2);
    if ($amt <= 0) fail('المبلغ مطلوب');
    $vat = max(0, round((float)($b['vat'] ?? 0), 2));
    $fund = (int)($b['fund_id'] ?? 0);
    if ($fund && !$conn->query("SELECT id FROM oh_funds WHERE id=$fund AND user_id=$uid AND deleted=0")->num_rows) fail('العهدة غير موجودة');
    $cat = (int)($b['cat_id'] ?? 0);
    if ($cat && !$conn->query("SELECT id FROM oh_cats WHERE id=$cat AND user_id=$uid")->num_rows) $cat = 0;
    $method = in_array($b['method'] ?? '', ['cash', 'card', 'transfer'], true) ? $b['method'] : 'cash';
    $vendor = mb_substr(trim((string)($b['vendor'] ?? '')), 0, 160);

    // تنبيه التكرار: نفس المبلغ ونفس اليوم ونفس الجهة — يُسأل المستخدم ولا يُمنع
    if (!$id && empty($b['force']) && $type === 'out') {
        $dup = $conn->query("SELECT id, d, amount, vendor FROM oh_txns WHERE user_id=$uid AND deleted=0 AND type='out'
            AND d='$d' AND amount=$amt AND vendor='" . E($vendor) . "' LIMIT 1")->fetch_assoc();
        if ($dup) out(['success' => false, 'duplicate' => $dup, 'message' => 'يبدو أنها مسجّلة من قبل']);
    }

    $set = "fund_id=" . ($fund ?: 'NULL') . ", type='$type', d='$d', amount=$amt, vat=$vat, vendor='" . E($vendor) . "',
        cat_id=" . ($cat ?: 'NULL') . ", method='$method', note='" . E($b['note'] ?? '') . "', ref='" . E(mb_substr((string)($b['ref'] ?? ''), 0, 80)) . "'";
    if ($id) {
        $old = $conn->query("SELECT * FROM oh_txns WHERE id=$id AND user_id=$uid")->fetch_assoc();
        if (!$old) fail('الحركة غير موجودة');
        $conn->query("UPDATE oh_txns SET $set WHERE id=$id AND user_id=$uid");
        oh_log($uid, 'txn_update', 'txn', $id, ['before' => $old, 'after' => $b]);
    } else {
        $conn->query("INSERT INTO oh_txns SET user_id=$uid, $set");
        $id = (int)$conn->insert_id;
        oh_log($uid, 'txn_create', 'txn', $id, $b);
    }
    // ربط المرفقات بالحركة — ملفّات المستخدم نفسه فقط. الصفحة المُزالة في التعديل
    // تُفكّ من الحركة ولا تُحذف: تبقى في الخادم والدرايف
    $fids = array_values(array_filter(array_map('intval', is_array($b['file_ids'] ?? null) ? $b['file_ids'] : [$b['file_id'] ?? 0])));
    if (array_key_exists('file_ids', $b)) {
        $keep = $fids ? implode(',', $fids) : '0';
        $conn->query("UPDATE oh_files SET txn_id=NULL WHERE txn_id=$id AND user_id=$uid AND id NOT IN ($keep)");
    }
    if ($fids) $conn->query("UPDATE oh_files SET txn_id=$id WHERE id IN (" . implode(',', $fids) . ") AND user_id=$uid");
    out(['success' => true, 'id' => $id]);
}

// الحذف ليّن: الحركة تذهب إلى السلّة وتُستعاد منها
case 'txn_delete': {
    $u = need(); $uid = (int)$u['id']; $b = body();
    $id = (int)($b['id'] ?? 0);
    $restore = !empty($b['restore']);
    $conn->query("UPDATE oh_txns SET deleted=" . ($restore ? 0 : 1) . " WHERE id=$id AND user_id=$uid");
    oh_log($uid, $restore ? 'txn_restore' : 'txn_delete', 'txn', $id);
    out(['success' => true]);
}

// ─── الملفات ────────────────────────────────────────────────────────────────
case 'upload': {
    $u = need(); $uid = (int)$u['id'];
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) fail('لم يصل الملف');
    $f = $_FILES['file'];
    if ($f['size'] > 15 * 1024 * 1024) fail('الحد خمسة عشر ميجابايت');
    $fi = finfo_open(FILEINFO_MIME_TYPE); $mime = finfo_file($fi, $f['tmp_name']); finfo_close($fi);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'application/pdf' => 'pdf'][$mime] ?? null;
    if (!$ext) fail('صور أو PDF فقط');
    $dir = OH_FILES . '/' . $uid;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail('تعذّر إنشاء مجلد الملفات');
    if (!is_file(OH_FILES . '/.htaccess')) @file_put_contents(OH_FILES . '/.htaccess', "Require all denied\nDeny from all\n");
    $rel = $uid . '/' . date('Ymd') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], OH_FILES . '/' . $rel)) fail('فشل الحفظ');
    $nm = mb_substr(basename((string)$f['name']), 0, 180) ?: ('receipt.' . $ext);
    $conn->query("INSERT INTO oh_files (user_id, name, mime, size, path, drive_status) VALUES ($uid, '" . E($nm) . "', '$mime', "
        . (int)$f['size'] . ", '" . E($rel) . "', 'pending')");
    $id = (int)$conn->insert_id;
    oh_log($uid, 'upload', 'file', $id, $nm);
    out(['success' => true, 'id' => $id, 'mime' => $mime, 'url' => file_url($id)]);
}

// قراءة الإيصال: تستخرج الجهة والتاريخ والمبلغ والضريبة والتصنيف والبنود
case 'scan': {
    $u = need(); $uid = (int)$u['id']; $b = body();
    $ids = array_values(array_filter(array_map('intval', is_array($b['file_ids'] ?? null) ? $b['file_ids'] : [$b['file_id'] ?? 0])));
    if (!$ids) fail('الملف غير موجود');
    $files = [];
    $r = $conn->query("SELECT * FROM oh_files WHERE id IN (" . implode(',', $ids) . ") AND user_id=$uid AND deleted=0");
    while ($r && ($x = $r->fetch_assoc())) $files[(int)$x['id']] = $x;
    $f = [];
    foreach ($ids as $i) if (isset($files[$i])) $f[] = $files[$i];     // بترتيب الصفحات كما رُفعت
    if (!$f) fail('الملف غير موجود');
    $fid = (int)$f[0]['id'];
    $cats = [];
    $r = $conn->query("SELECT id, name FROM oh_cats WHERE user_id=$uid AND deleted=0");
    while ($r && ($x = $r->fetch_assoc())) $cats[] = $x;
    $res = scan_file($f, $cats, $u['lang'] ?? 'ar');
    if (!empty($res['error'])) fail($res['error']);
    $conn->query("UPDATE oh_files SET extracted='" . E(json_encode($res, JSON_UNESCAPED_UNICODE)) . "' WHERE id IN (" . implode(',', array_map(function ($x) { return (int)$x['id']; }, $f)) . ")");
    foreach ($cats as $c) if ($c['name'] === ($res['category'] ?? '')) $res['cat_id'] = (int)$c['id'];
    oh_log($uid, 'scan', 'file', $fid);
    out(['success' => true, 'data' => $res]);
}

// عرض الملف: برابطٍ موقَّع قصير العمر، فيصلح لوسوم الصور ولا يُتداول
case 'file': {
    $id = (int)($_GET['id'] ?? 0); $exp = (int)($_GET['exp'] ?? 0);
    if ($exp < time() || !hash_equals(file_sig($id, $exp), (string)($_GET['sig'] ?? ''))) fail('الرابط منتهٍ', 403);
    $f = $conn->query("SELECT * FROM oh_files WHERE id=$id AND deleted=0")->fetch_assoc();
    if (!$f || !is_file(OH_FILES . '/' . $f['path'])) fail('غير موجود', 404);
    ob_end_clean();
    header('Content-Type: ' . $f['mime']);
    header('Cache-Control: private, max-age=3600');
    header('Content-Disposition: inline; filename*=UTF-8\'\'' . rawurlencode($f['name']));
    readfile(OH_FILES . '/' . $f['path']);
    exit;
}

// ─── لوحة المعلومات ─────────────────────────────────────────────────────────
// كل رقم هنا يُرجع معه ما يلزم لفتح تفاصيله: التصنيف والجهة واليوم والعهدة
// ─── كشف الحساب ─────────────────────────────────────────────────────────────
// رصيدٌ افتتاحي لما قبل الفترة، ثم الحركات من الأقدم بالرصيد الجاري، ولكل
// مستندٍ رابطٌ يبقى صالحاً في ملف PDF بعد حفظه وإرساله
case 'statement': {
    $u = need(); $uid = (int)$u['id'];
    $fund = (int)($_GET['fund'] ?? 0);
    $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : '2000-01-01';
    $to   = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '')   ? $_GET['to']   : '2100-12-31';
    $fw = $fund ? " AND t.fund_id=$fund" : '';
    $f = null;
    if ($fund) {
        $f = $conn->query("SELECT id, name, kind, color, status FROM oh_funds WHERE id=$fund AND user_id=$uid")->fetch_assoc();
        if (!$f) fail('العهدة غير موجودة');
    }
    $opening = (float)$conn->query("SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END),0) s
        FROM oh_txns t WHERE t.user_id=$uid AND t.deleted=0$fw AND t.d < '$from'")->fetch_assoc()['s'];
    $rows = [];
    $r = $conn->query("SELECT t.id, t.type, t.d, t.amount, t.vat, t.vendor, t.method, t.note, t.ref, t.fund_id,
        c.name cat_name, fd.name fund_name,
        (SELECT x.id FROM oh_files x WHERE x.txn_id=t.id AND x.deleted=0 ORDER BY x.id LIMIT 1) file_id,
        (SELECT x.drive_id FROM oh_files x WHERE x.txn_id=t.id AND x.deleted=0 ORDER BY x.id LIMIT 1) drive_id
        FROM oh_txns t LEFT JOIN oh_cats c ON c.id=t.cat_id LEFT JOIN oh_funds fd ON fd.id=t.fund_id
        WHERE t.user_id=$uid AND t.deleted=0$fw AND t.d BETWEEN '$from' AND '$to'
        ORDER BY t.d, t.id LIMIT 5000");
    $bal = $opening;
    while ($r && ($x = $r->fetch_assoc())) {
        $x['amount'] = (float)$x['amount']; $x['vat'] = (float)$x['vat'];
        $bal += $x['type'] === 'in' ? $x['amount'] : -$x['amount'];
        $x['balance'] = round($bal, 2);
        $x['doc_url'] = $x['file_id'] ? doc_link($x['file_id'], $x['drive_id']) : null;
        $x['on_drive'] = !empty($x['drive_id']);
        $x['docs'] = [];
        if ($x['file_id'] && ($dr = $conn->query("SELECT id, drive_id FROM oh_files WHERE deleted=0 AND txn_id=" . (int)$x['id'] . " ORDER BY id")))
            while ($dd = $dr->fetch_assoc()) $x['docs'][] = ['url' => doc_link($dd['id'], $dd['drive_id']), 'drive' => !empty($dd['drive_id'])];
        unset($x['drive_id']);
        $rows[] = $x;
    }
    oh_log($uid, 'statement', 'fund', $fund ?: null, ['from' => $from, 'to' => $to, 'n' => count($rows)]);
    $prow = $conn->query("SELECT profile, logo, email, phone FROM oh_users WHERE id=$uid")->fetch_assoc();
    out(['success' => true, 'profile' => profile_of($prow), 'logo_url' => $prow['logo'] ? logo_url($uid) : null,
        'email' => $prow['email'], 'phone' => $prow['phone'],
        'fund' => $f, 'from' => $from, 'to' => $to, 'opening' => round($opening, 2),
        'closing' => round($bal, 2), 'rows' => $rows, 'user' => $u['name']]);
}

case 'dashboard': {
    $u = need(); $uid = (int)$u['id'];
    $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : date('Y-m-01');
    $to   = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '')   ? $_GET['to']   : date('Y-m-t');
    $fund = (int)($_GET['fund'] ?? 0);
    $fw = $fund ? " AND t.fund_id=$fund" : '';
    $base = "t.user_id=$uid AND t.deleted=0$fw AND t.d BETWEEN '$from' AND '$to'";

    $tot = $conn->query("SELECT
        COALESCE(SUM(CASE WHEN type='out' THEN amount END),0) spent,
        COALESCE(SUM(CASE WHEN type='in'  THEN amount END),0) received,
        COALESCE(SUM(CASE WHEN type='out' THEN vat END),0) vat,
        SUM(type='out') n_out,
        SUM(type='out' AND NOT EXISTS (SELECT 1 FROM oh_files x WHERE x.txn_id=t.id AND x.deleted=0)) no_receipt
        FROM oh_txns t WHERE $base")->fetch_assoc();

    // المدّة السابقة بنفس الطول — للمقارنة
    $days = (int)round((strtotime($to) - strtotime($from)) / 86400) + 1;
    $pf = date('Y-m-d', strtotime($from) - $days * 86400); $pt = date('Y-m-d', strtotime($from) - 86400);
    $prev = (float)$conn->query("SELECT COALESCE(SUM(amount),0) s FROM oh_txns t WHERE t.user_id=$uid AND t.deleted=0$fw
        AND t.type='out' AND t.d BETWEEN '$pf' AND '$pt'")->fetch_assoc()['s'];

    $bycat = [];
    $r = $conn->query("SELECT c.id, COALESCE(c.name,'بلا تصنيف') name, COALESCE(c.color,'#94a3b8') color, COALESCE(c.icon,'tag') icon,
        COALESCE(c.budget,0) budget, SUM(t.amount) total, COUNT(*) n
        FROM oh_txns t LEFT JOIN oh_cats c ON c.id=t.cat_id WHERE $base AND t.type='out'
        GROUP BY c.id ORDER BY total DESC");
    while ($r && ($x = $r->fetch_assoc())) { $x['total'] = (float)$x['total']; $x['budget'] = (float)$x['budget']; $bycat[] = $x; }

    // الميزانية الشهرية تُقاس على الشهر الجاري دائماً، لا على المدّة المختارة
    $budgets = [];
    $m1 = date('Y-m-01'); $m2 = date('Y-m-t');
    $r = $conn->query("SELECT c.id, c.name, c.color, c.icon, c.budget,
        COALESCE((SELECT SUM(amount) FROM oh_txns t WHERE t.cat_id=c.id AND t.deleted=0 AND t.type='out' AND t.d BETWEEN '$m1' AND '$m2'),0) used
        FROM oh_cats c WHERE c.user_id=$uid AND c.deleted=0 AND c.budget > 0 ORDER BY used/c.budget DESC");
    while ($r && ($x = $r->fetch_assoc())) { $x['budget'] = (float)$x['budget']; $x['used'] = (float)$x['used']; $budgets[] = $x; }

    $daily = [];
    $r = $conn->query("SELECT t.d, SUM(t.amount) total, COUNT(*) n FROM oh_txns t WHERE $base AND t.type='out' GROUP BY t.d ORDER BY t.d");
    while ($r && ($x = $r->fetch_assoc())) $daily[] = ['d' => $x['d'], 'total' => (float)$x['total'], 'n' => (int)$x['n']];

    $vendors = [];
    $r = $conn->query("SELECT t.vendor, SUM(t.amount) total, COUNT(*) n FROM oh_txns t WHERE $base AND t.type='out' AND t.vendor<>''
        GROUP BY t.vendor ORDER BY total DESC LIMIT 8");
    while ($r && ($x = $r->fetch_assoc())) $vendors[] = ['vendor' => $x['vendor'], 'total' => (float)$x['total'], 'n' => (int)$x['n']];

    $methods = [];
    $r = $conn->query("SELECT t.method, SUM(t.amount) total, COUNT(*) n FROM oh_txns t WHERE $base AND t.type='out' GROUP BY t.method");
    while ($r && ($x = $r->fetch_assoc())) $methods[] = ['method' => $x['method'], 'total' => (float)$x['total'], 'n' => (int)$x['n']];

    // الأشهر الستّة الأخيرة — الاتجاه العام
    $months = [];
    $r = $conn->query("SELECT DATE_FORMAT(t.d,'%Y-%m') m, SUM(CASE WHEN type='out' THEN amount END) spent,
        SUM(CASE WHEN type='in' THEN amount END) received FROM oh_txns t
        WHERE t.user_id=$uid AND t.deleted=0$fw AND t.d >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 5 MONTH)
        GROUP BY m ORDER BY m");
    while ($r && ($x = $r->fetch_assoc())) $months[] = ['m' => $x['m'], 'spent' => (float)$x['spent'], 'received' => (float)$x['received']];

    out(['success' => true, 'from' => $from, 'to' => $to,
        'spent' => (float)$tot['spent'], 'received' => (float)$tot['received'], 'vat' => (float)$tot['vat'],
        'n_out' => (int)$tot['n_out'], 'no_receipt' => (int)$tot['no_receipt'], 'prev_spent' => $prev,
        'by_cat' => $bycat, 'budgets' => $budgets, 'daily' => $daily, 'vendors' => $vendors, 'methods' => $methods, 'months' => $months]);
}

// ─── Google Drive (المدير) ──────────────────────────────────────────────────
case 'drive_url': {
    $a = need_admin();
    if (!secret_set(OH_G_ID)) fail('مفاتيح Google غير مضافة على الخادم بعد');
    $redirect = 'https://' . $_SERVER['HTTP_HOST']
        . strtok($_SERVER['REQUEST_URI'], '?') . '?action=drive_callback';
    $exp = time() + 900;
    $state = b64u(json_encode(['u' => (int)$a['id'], 'e' => $exp, 'r' => $redirect]));
    $state .= '.' . b64u(hash_hmac('sha256', $state, OH_KEY, true));
    out(['success' => true, 'redirect_uri' => $redirect, 'url' => 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id' => OH_G_ID, 'redirect_uri' => $redirect, 'response_type' => 'code',
        'scope' => 'https://www.googleapis.com/auth/drive.file', 'access_type' => 'offline', 'prompt' => 'consent',
        'state' => $state])]);
}

case 'drive_callback': {
    ob_end_clean();
    header('Content-Type: text/html; charset=UTF-8');
    $back = function ($ok, $msg) {
        echo '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="1;url=./#/settings?drive=' . ($ok ? 'ok' : 'err') . '">'
            . '<body style="font-family:sans-serif;direction:rtl;padding:40px">' . htmlspecialchars($msg) . '</body>';
        exit;
    };
    $st = explode('.', (string)($_GET['state'] ?? ''));
    if (count($st) !== 2 || !hash_equals(b64u(hash_hmac('sha256', $st[0], OH_KEY, true)), $st[1])) $back(false, 'طلب غير موثوق');
    $p = json_decode(b64u_dec($st[0]), true);
    if (!$p || $p['e'] < time()) $back(false, 'انتهت مهلة الربط، أعد المحاولة');
    if (empty($_GET['code'])) $back(false, 'أُلغي الربط');
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
        CURLOPT_POSTFIELDS => http_build_query(['code' => $_GET['code'], 'client_id' => OH_G_ID, 'client_secret' => OH_G_SECRET,
            'redirect_uri' => $p['r'], 'grant_type' => 'authorization_code'])]);
    $res = json_decode((string)curl_exec($ch), true); curl_close($ch);
    if (empty($res['refresh_token'])) { meta_set('drive_error', json_encode($res, JSON_UNESCAPED_UNICODE)); $back(false, 'لم يُمنح إذن دائم — أعد الربط'); }
    meta_set('drive_refresh', $res['refresh_token']);
    meta_set('drive_access', json_encode(['t' => $res['access_token'], 'exp' => time() + (int)($res['expires_in'] ?? 3600)]));
    // ربطٌ جديد قد يكون بحسابٍ آخر: مجلّدات الحساب القديم لا تُرى منه، فتُنشأ من جديد
    meta_set('drive_root', null);
    $GLOBALS['conn']->query("UPDATE oh_users SET drive_folder=NULL");
    $GLOBALS['conn']->query("UPDATE oh_files SET drive_status='pending' WHERE drive_status='failed' AND deleted=0");
    oh_log($p['u'], 'drive_link');
    $back(true, 'تم ربط Google Drive — جارٍ الرجوع…');
}

case 'drive_status': {
    need_admin();
    $n = [];
    $r = $conn->query("SELECT drive_status s, COUNT(*) n FROM oh_files WHERE deleted=0 GROUP BY drive_status");
    while ($r && ($x = $r->fetch_assoc())) $n[$x['s']] = (int)$x['n'];
    out(['success' => true, 'configured' => secret_set(OH_G_ID) && secret_set(OH_G_SECRET), 'linked' => (bool)meta_get('drive_refresh'),
        'counts' => $n, 'last_error' => json_decode((string)meta_get('drive_error'), true)]);
}

case 'drive_unlink': {
    $a = need_admin();
    meta_set('drive_refresh', null); meta_set('drive_access', null);
    oh_log($a['id'], 'drive_unlink');
    out(['success' => true]);
}

default:
    fail('إجراء غير معروف');
}
