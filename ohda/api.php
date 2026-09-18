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
function seed_cats($uid) {
    global $conn;
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
    if ($id && ($r = $conn->query("SELECT id, username, name, role, active FROM oh_users WHERE id=$id LIMIT 1")))
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
function scan_file($f, $cats) {
    if (!secret_set(OH_AI_KEY)) return ['error' => 'قراءة الإيصالات غير مفعّلة على الخادم'];
    $full = OH_FILES . '/' . $f['path'];
    if (!is_file($full)) return ['error' => 'الملف غير موجود'];
    $data = base64_encode(file_get_contents($full));
    $mime = $f['mime'];
    $block = $mime === 'application/pdf'
        ? ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $data]]
        : ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mime, 'data' => $data]];
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
        . "- note: one short Arabic sentence of anything the user should double-check; empty if all is clear.";
    $payload = [
        'model' => 'claude-opus-5',
        'max_tokens' => 16000,
        'output_config' => ['effort' => 'low', 'format' => ['type' => 'json_schema', 'schema' => $schema]],
        'fallbacks' => 'default',
        'system' => $sys,
        'messages' => [['role' => 'user', 'content' => [$block, ['type' => 'text', 'text' => 'استخرج بيانات هذا المستند.']]]],
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
    $conn->query("INSERT INTO oh_users (username, name, pass_hash, role) VALUES ('" . E($un) . "', '" . E($nm) . "', '"
        . E(password_hash($pw, PASSWORD_DEFAULT)) . "', 'admin')");
    $uid = (int)$conn->insert_id;
    seed_cats($uid);
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
    out(['success' => true, 'user' => $u, 'ai' => secret_set(OH_AI_KEY),
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

// ─── المستخدمون (المدير) ────────────────────────────────────────────────────
case 'users': {
    need_admin();
    $rows = [];
    $r = $conn->query("SELECT u.id, u.username, u.name, u.role, u.active, u.created_at, u.last_login, u.drive_folder,
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
    if ($id) {
        $set = "name='" . E($nm) . "', active=" . (!empty($b['active']) ? 1 : 0);
        if ($id === (int)$a['id']) $set = "name='" . E($nm) . "'";          // لا يوقف المدير نفسه
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
    $conn->query("INSERT INTO oh_users (username, name, pass_hash, role) VALUES ('" . E($un) . "', '" . E($nm) . "', '"
        . E(password_hash($b['password'], PASSWORD_DEFAULT)) . "', 'user')");
    $nid = (int)$conn->insert_id;
    seed_cats($nid);
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
        $rows[] = $x;
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
    // ربط المرفق بالحركة — ملفّات المستخدم نفسه فقط
    if (!empty($b['file_id'])) {
        $fid = (int)$b['file_id'];
        $conn->query("UPDATE oh_files SET txn_id=$id WHERE id=$fid AND user_id=$uid");
    }
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
    $fid = (int)($b['file_id'] ?? 0);
    $f = $conn->query("SELECT * FROM oh_files WHERE id=$fid AND user_id=$uid AND deleted=0")->fetch_assoc();
    if (!$f) fail('الملف غير موجود');
    $cats = [];
    $r = $conn->query("SELECT id, name FROM oh_cats WHERE user_id=$uid AND deleted=0");
    while ($r && ($x = $r->fetch_assoc())) $cats[] = $x;
    $res = scan_file($f, $cats);
    if (!empty($res['error'])) fail($res['error']);
    $conn->query("UPDATE oh_files SET extracted='" . E(json_encode($res, JSON_UNESCAPED_UNICODE)) . "' WHERE id=$fid");
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
        unset($x['drive_id']);
        $rows[] = $x;
    }
    oh_log($uid, 'statement', 'fund', $fund ?: null, ['from' => $from, 'to' => $to, 'n' => count($rows)]);
    out(['success' => true, 'fund' => $f, 'from' => $from, 'to' => $to, 'opening' => round($opening, 2),
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
