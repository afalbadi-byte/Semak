<?php
// ════════════════════════════════════════════════════════════════════════════
//  ألواح — متابعة حفظ القرآن للأسرة
//  ─────────────────────────────────────────────────────────────────────────
//  تطبيقٌ مستقلّ عن سماك إلا في الخادم: جداوله (al_*) ومفاتيح دخوله له وحده.
//  كل صفّ يحمل family_id، وكل استعلام مقيّدٌ به — فلا تلتقي أسرةٌ بأخرى.
//
//  الموضع لا يُخزَّن بل يُحسب: ما حفظه الفرد عند البدء + مجموع أسطر الحفظ
//  الجديد المقبول في سجلّاته. فتعديل تسميعٍ أو حذفه يُصحّح التقدّم وحده.
//  وورد اليوم ثلاثة: الحفظ الجديد، والألواح (آخر خمس صفحات شاملةً حفظ اليوم)،
//  والمراجعة (عشر صفحات تدور من الجزء الثلاثين صعوداً حتى آخر ما حُفظ).
// ════════════════════════════════════════════════════════════════════════════

ob_start();
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
date_default_timezone_set('Asia/Riyadh');

$db_host = 'localhost';
$db_user = '__DB_USER__';
$db_pass = '__DB_PASS__';
$db_name = '__DB_NAME__';

mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) { ob_end_clean(); die(json_encode(['success' => false, 'message' => 'تعذّر الاتصال بقاعدة البيانات'])); }
$conn->set_charset('utf8mb4');
$conn->query("SET time_zone = '+03:00'");

// مفتاح التوقيع مخصوصٌ بهذا التطبيق: مفتاح سماك أو عُهدة لا يفتح ألواح
define('AL_KEY', hash_hmac('sha256', 'alwah-app-v1', '__TOKEN_SECRET__'));
const PUSH_KEY = '__PUSH_KEY__';                 // مفتاح مرسِل الإشعارات (لا جلسة)
const GROQ_KEY = '__GROQ_KEY__';                 // تعرّفٌ سحابيّ على التلاوة (اختياري)

function out($a) { ob_end_clean(); echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }
function fail($m, $code = 200) { http_response_code($code); out(['success' => false, 'message' => $m]); }
function E($v) { global $conn; return $conn->real_escape_string((string)$v); }
function body() { static $b = null; if ($b === null) $b = json_decode(file_get_contents('php://input'), true) ?: []; return $b; }
function b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64u_dec($s) { return base64_decode(strtr($s, '-_', '+/')); }
function rows($sql) { global $conn; $o = []; if ($r = $conn->query($sql)) while ($x = $r->fetch_assoc()) $o[] = $x; return $o; }
function one($sql) { global $conn; if ($r = $conn->query($sql)) if ($x = $r->fetch_assoc()) return $x; return null; }

// ─── الجداول ────────────────────────────────────────────────────────────────
$__v = 0;
if ($r = $conn->query("SELECT v FROM al_meta WHERE k='schema' LIMIT 1")) if ($x = $r->fetch_assoc()) $__v = (int)$x['v'];
if ($__v < 1) {
    $conn->query("CREATE TABLE IF NOT EXISTS al_meta (k VARCHAR(40) PRIMARY KEY, v MEDIUMTEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS al_families (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS al_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        username VARCHAR(60) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        pass_hash VARCHAR(255) NOT NULL,
        role VARCHAR(12) NOT NULL DEFAULT 'member',
        member_id INT DEFAULT NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT NULL,
        INDEX (family_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS al_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        gender CHAR(1) NOT NULL DEFAULT 'm',
        color VARCHAR(12) NOT NULL DEFAULT '#1f5f4a',
        dir VARCHAR(4) NOT NULL DEFAULT 'desc',
        init_lines INT NOT NULL DEFAULT 0,
        target_lines INT NOT NULL DEFAULT 5,
        alwah_n INT NOT NULL DEFAULT 5,
        review_n INT NOT NULL DEFAULT 10,
        start_d DATE DEFAULT NULL,
        sort INT NOT NULL DEFAULT 0,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (family_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS al_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        member_id INT NOT NULL,
        d DATE NOT NULL,
        new_page INT DEFAULT NULL,
        new_lines INT NOT NULL DEFAULT 0,
        new_grade TINYINT NOT NULL DEFAULT 0,
        new_err INT NOT NULL DEFAULT 0,
        new_warn INT NOT NULL DEFAULT 0,
        alwah_list VARCHAR(200) DEFAULT NULL,
        alwah_done TINYINT(1) NOT NULL DEFAULT 0,
        alwah_grade TINYINT NOT NULL DEFAULT 0,
        alwah_err INT NOT NULL DEFAULT 0,
        alwah_warn INT NOT NULL DEFAULT 0,
        rev_list VARCHAR(400) DEFAULT NULL,
        rev_done TINYINT(1) NOT NULL DEFAULT 0,
        rev_grade TINYINT NOT NULL DEFAULT 0,
        rev_err INT NOT NULL DEFAULT 0,
        rev_warn INT NOT NULL DEFAULT 0,
        note TEXT,
        recorded_by INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (member_id, d), INDEX (family_id, d)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS al_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        action VARCHAR(40) NOT NULL,
        data MEDIUMTEXT,
        ip VARCHAR(64) DEFAULT NULL,
        at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (action, at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '1')");
}

// ─── الإصدار ٢: مصحف الفرد (العلامات)، وجلسة الذكر (المكالمة والصفحة المشتركة) ─
// العلامة لكل كلمةٍ في مصحف الفرد: كم مرّةً أخطأ فيها، وكم مرّةً نُبِّه، ومتى آخر مرّة،
// وهل أتقنها. المفتاح «سورة:آية:موضع الكلمة» ثابتٌ في كل طبعات مصحف المدينة.
if ($__v < 2) {
    $conn->query("CREATE TABLE IF NOT EXISTS al_marks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        member_id INT NOT NULL,
        word_key VARCHAR(16) NOT NULL,
        page SMALLINT NOT NULL,
        err INT NOT NULL DEFAULT 0,
        warn INT NOT NULL DEFAULT 0,
        resolved TINYINT(1) NOT NULL DEFAULT 0,
        last_d DATE DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (member_id, word_key), INDEX (member_id, page)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // كل ضغطةٍ حدثٌ مؤرَّخ: منه عدد أخطاء اليوم لكل جزءٍ من الورد، ومنه التراجع
    $conn->query("CREATE TABLE IF NOT EXISTS al_mark_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        member_id INT NOT NULL,
        word_key VARCHAR(16) NOT NULL,
        page SMALLINT NOT NULL,
        kind VARCHAR(8) NOT NULL,
        d DATE NOT NULL,
        by_user INT DEFAULT NULL,
        at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (member_id, d)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS al_session (
        family_id INT PRIMARY KEY,
        member_id INT DEFAULT NULL,
        page SMALLINT DEFAULT NULL,
        by_user INT DEFAULT NULL,
        rev INT NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS al_rtc_peers (
        id VARCHAR(24) NOT NULL PRIMARY KEY,
        family_id INT NOT NULL,
        user_id INT NOT NULL,
        name VARCHAR(120) DEFAULT NULL,
        state VARCHAR(10) NOT NULL DEFAULT 'in',
        mic TINYINT(1) NOT NULL DEFAULT 1,
        cam TINYINT(1) NOT NULL DEFAULT 1,
        hand TINYINT(1) NOT NULL DEFAULT 0,
        share TINYINT(1) NOT NULL DEFAULT 0,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        left_at DATETIME DEFAULT NULL,
        INDEX (family_id, state, seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS al_rtc_signals (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        from_peer VARCHAR(24) NOT NULL,
        to_peer VARCHAR(24) NOT NULL,
        kind VARCHAR(12) NOT NULL,
        payload MEDIUMTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (to_peer, id), INDEX (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '2')");
}
if ($__v < 3) {
    // ورد اليوم معدَّلاً يدوياً من المشرف (NULL = يبقى الحساب التلقائي لذلك الجزء)
    $conn->query("CREATE TABLE IF NOT EXISTS al_wird (
        member_id INT NOT NULL,
        d DATE NOT NULL,
        new_lines INT NULL,
        alwah_list VARCHAR(600) NULL,
        rev_list VARCHAR(600) NULL,
        by_user INT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (member_id, d)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '3')");
}
if ($__v < 4) {
    // المقاطع بالآيات: {"new":["67:1","67:5"],"alwah":[..],"rev":[..]}
    // (ADD COLUMN IF NOT EXISTS لا تعمل في MySQL: نفحص information_schema أوّلاً)
    foreach (['al_wird', 'al_logs'] as $t) {
        $has = one("SELECT 1 x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$t' AND COLUMN_NAME='ranges'");
        if (!$has) $conn->query("ALTER TABLE $t ADD COLUMN ranges VARCHAR(255) NULL");
    }
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '4')");
}
if ($__v < 5) {
    // الحفظ صار بالسورة وبأسطر النصّ (بلا رؤوس السور)، فتُحوَّل نقطة بداية كل فرد من
    // الوحدة القديمة (صفحات × ١٥ سطراً) إلى الجديدة. والقيم القديمة محفوظة في al_log للتراجع.
    $S = ml_sur();
    foreach (rows("SELECT id, dir, init_lines FROM al_members") as $m) {
        $old = (int)$m['init_lines']; $done = intdiv($old, 15); $part = $old % 15; $new = 0;
        if ($m['dir'] === 'asc') {
            // من الفاتحة: أسطر الصفحات المُتمّة، وما حُفظ من الصفحة التالية
            for ($q = 1; $q <= 114; $q++) foreach ($S[$q] as $x) {
                if ($x[0] <= $done) $new++;
                elseif ($x[0] === $done + 1 && $part > 0) { $new++; $part--; }
            }
        } elseif ($done > 0) {
            // من الناس صعوداً: كل سورةٍ تبدأ في الصفحات المحفوظة (من ٦٠٤ حتى أوّل صفحةٍ محفوظة)
            $fp = 605 - $done;
            for ($q = 114; $q >= 1 && $S[$q][0][0] >= $fp; $q--) $new += count($S[$q]);
        } else $new = $old;
        if ($new !== $old) {
            $conn->query("UPDATE al_members SET init_lines=$new WHERE id=" . (int)$m['id']);
            al_log(0, 'migrate_v5_init_lines', ['member' => (int)$m['id'], 'old' => $old, 'new' => $new]);
        }
    }
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '5')");
}
if ($__v < 6) {
    // أيام الراحة (أرقام أيام الأسبوع: الأحد ٠) والهدف: سورةٌ وتاريخ
    foreach ([['rest_days', "VARCHAR(20) NULL"], ['goal_surah', 'INT NULL'], ['goal_date', 'DATE NULL']] as [$c, $t]) {
        $has = one("SELECT 1 x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='al_members' AND COLUMN_NAME='$c'");
        if (!$has) $conn->query("ALTER TABLE al_members ADD COLUMN $c $t");
    }
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '6')");
}
if ($__v < 7) {
    // يوم الراحة: كم سطراً يُحفظ فيه (٠ = لا حفظ جديد)، وهل تبقى فيه الألواح
    foreach ([['rest_lines', 'INT NOT NULL DEFAULT 0'], ['rest_alwah', 'TINYINT NOT NULL DEFAULT 1']] as [$c, $t]) {
        $has = one("SELECT 1 x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='al_members' AND COLUMN_NAME='$c'");
        if (!$has) $conn->query("ALTER TABLE al_members ADD COLUMN $c $t");
    }
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '7')");
}
if ($__v < 8) {
    // أجهزة الإشعارات: لكل جهازٍ اشتراكه (endpoint فريد)
    $conn->query("CREATE TABLE IF NOT EXISTS al_push (
        id INT AUTO_INCREMENT PRIMARY KEY,
        family_id INT NOT NULL,
        user_id INT NOT NULL,
        endpoint VARCHAR(500) NOT NULL,
        p256dh VARCHAR(200) NOT NULL,
        auth VARCHAR(100) NOT NULL,
        agent VARCHAR(160) NULL,
        failed INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY ep (endpoint(190)), INDEX (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '8')");
}
if ($__v < 9) {
    // قواعد الحفظ للأسرة كلّها (تُعدَّل من الإعدادات)
    $has = one("SELECT 1 x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='al_families' AND COLUMN_NAME='rules'");
    if (!$has) $conn->query("ALTER TABLE al_families ADD COLUMN rules VARCHAR(600) NULL");
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '9')");
}

if ($__v < 10) {
    // صلاحية التسميع الذاتي: تُفتح لحساباتٍ يحدّدها صاحب الحساب
    $has = one("SELECT 1 x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='al_users' AND COLUMN_NAME='feat_recite'");
    if (!$has) $conn->query('ALTER TABLE al_users ADD COLUMN feat_recite TINYINT(1) NOT NULL DEFAULT 0');
    $conn->query("REPLACE INTO al_meta (k, v) VALUES ('schema', '10')");
}

// جلب نصٍّ من خدمةٍ خارجية (الإعراب من الباحث القرآني) — بلا تخزينٍ عندنا
function fetch_text($url) {
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_FOLLOWLOCATION => true,
                               CURLOPT_USERAGENT => 'alwah.semak.sa']);
        $r = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
        return ($r !== false && $code === 200) ? $r : null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'header' => "User-Agent: alwah.semak.sa\r\n"]]);
    $r = @file_get_contents($url, false, $ctx);
    return $r === false ? null : $r;
}

function al_log($uid, $action, $data = null) {
    global $conn;
    $ip = E(trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '')[0]));
    $conn->query("INSERT INTO al_log (user_id, action, data, ip) VALUES (" . ($uid ? (int)$uid : 'NULL') . ", '" . E($action) . "', "
        . ($data !== null ? "'" . E(json_encode($data, JSON_UNESCAPED_UNICODE)) . "'" : 'NULL') . ", '$ip')");
}

// ─── المصحف: بدايات الأجزاء (مصحف المدينة، ٦٠٤ صفحات، ١٥ سطراً) ─────────────
const JUZ_START = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282,
                   302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
const SUR_NAMES = ['الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'];
function sur_name($s) { return SUR_NAMES[$s - 1] ?? ''; }
// «الجاثية ١ إلى الجاثية ٦» من مقاطع الآيات
function segs_label($segs) {
    if (!$segs) return '';
    $a = null; $b = null;
    foreach ($segs as $g) {
        [$s0, $a0] = array_map('intval', explode(':', $g[0])); [$s1, $a1] = array_map('intval', explode(':', $g[1]));
        if ($a === null || $s0 < $a[0] || ($s0 === $a[0] && $a0 < $a[1])) $a = [$s0, $a0];
        if ($b === null || $s1 > $b[0] || ($s1 === $b[0] && $a1 > $b[1])) $b = [$s1, $a1];
    }
    $x = sur_name($a[0]) . ' ' . $a[1]; $y = sur_name($b[0]) . ' ' . $b[1];
    return $x === $y ? $x : ($a[0] === $b[0] ? sur_name($a[0]) . ' ' . $a[1] . '-' . $b[1] : $x . ' إلى ' . $y);
}
const PAGES = 604;
const LPP = 15;
const JUZ_AYAH = ['1:1', '2:142', '2:253', '3:93', '4:24', '4:148', '5:82', '6:111', '7:88', '8:41', '9:93', '11:6', '12:53', '15:1', '17:1', '18:75', '21:1', '23:1', '25:21', '27:56', '29:46', '33:31', '36:28', '39:32', '41:47', '46:1', '51:31', '58:1', '67:1', '78:1'];
// جزء الآية بحدود الأجزاء نفسها (لا بالصفحة، فبعض الأجزاء تبدأ في وسط صفحة)
function juz_of_ayah($s, $a) {
    static $B = null;
    if ($B === null) { $B = []; foreach (JUZ_AYAH as $k) { [$x, $y] = array_map('intval', explode(':', $k)); $B[] = [$x, $y]; } }
    $j = 1;
    foreach ($B as $i => $b) if ($s > $b[0] || ($s === $b[0] && $a >= $b[1])) $j = $i + 1;
    return $j;
}
function juz_of($p) { $j = 1; foreach (JUZ_START as $i => $s) if ($p >= $s) $j = $i + 1; return $j; }

// ─── خريطة الأسطر وترتيب الحفظ ───────────────────────────────────────────────
// الحفظ بالسورة: من الناس صعوداً سورةً سورة، وكل سورةٍ من أوّلها إلى آخرها (أو من
// الفاتحة بترتيب المصحف). والتقدّم بأسطر النصّ (بلا رؤوس السور)، وكل سطرٍ في
// خريطة الأسطر (lines.php) معروفةٌ صفحته وسورته وآياته.
function ml_sur() {
    static $S = null;
    if ($S !== null) return $S;
    $raw = require __DIR__ . '/lines.php';
    $S = array_fill(1, 114, []);
    foreach (explode('|', $raw) as $i => $pg) {
        foreach (explode(';', $pg) as $ln) {
            if ($ln === '') continue;
            $v = array_map('intval', explode(',', $ln));
            $S[$v[1]][] = [$i + 1, $v[0], $v[1], $v[2], $v[3]];     // [صفحة، سطر، سورة، أوّل آية، آخر آية]
        }
    }
    return $S;
}
// أسطر المصحف كلّها بترتيب حفظ هذا الاتجاه
function ml_seq($dir) {
    static $C = [];
    if (isset($C[$dir])) return $C[$dir];
    $S = ml_sur(); $o = [];
    if ($dir === 'asc') { for ($s = 1; $s <= 114; $s++) foreach ($S[$s] as $x) $o[] = $x; }
    else { for ($s = 114; $s >= 1; $s--) foreach ($S[$s] as $x) $o[] = $x; }
    return $C[$dir] = $o;
}
// أسطرٌ ← مقاطع بالآيات، مرتّبةً من جهة البقرة إلى جهة الناس: [["45:1","45:12"], ...]
function ml_segs($lines) {
    usort($lines, function ($a, $b) { return ($a[0] <=> $b[0]) ?: ($a[1] <=> $b[1]); });
    $o = []; $cs = 0; $a0 = 0; $a1 = 0;
    foreach ($lines as $x) {
        if ($cs === $x[2] && $x[3] <= $a1 + 1) { $a1 = max($a1, $x[4]); continue; }
        if ($cs) $o[] = [$cs . ':' . $a0, $cs . ':' . $a1];
        $cs = $x[2]; $a0 = $x[3]; $a1 = $x[4];
    }
    if ($cs) $o[] = [$cs . ':' . $a0, $cs . ':' . $a1];
    return $o;
}
// مقطع الحفظ الجديد: وإن حدّد المشرف آخر آية، ينتهي المقطع عندها لا عند آخر السطر
function new_segs($lines, $to) {
    $sg = ml_segs($lines);
    if (!is_string($to) || !preg_match('/^(\d{1,3}):(\d{1,3})$/', $to, $mm)) return $sg;
    foreach ($sg as &$x) {
        [$s0, $a0] = array_map('intval', explode(':', $x[0])); $a1 = (int)explode(':', $x[1])[1];
        if ($s0 === (int)$mm[1] && (int)$mm[2] >= $a0 && (int)$mm[2] <= $a1) $x[1] = $to;
    }
    unset($x);
    return $sg;
}
// مجموع أسطر كل صفحة وكل جزء في المصحف (لحساب المحفوظ بالصفحات والأجزاء)
function ml_totals() {
    static $T = null;
    if ($T !== null) return $T;
    $pg = array_fill(1, PAGES, 0); $jz = array_fill(1, 30, 0);
    foreach (ml_seq('asc') as $x) { $pg[$x[0]]++; $jz[juz_of_ayah($x[2], $x[3])]++; }
    return $T = ['p' => $pg, 'j' => $jz];
}
function ml_pages($lines) { $p = []; foreach ($lines as $x) $p[$x[0]] = true; $p = array_keys($p); sort($p); return $p; }

// ─── قواعد الأسرة: تُعدَّل من الإعدادات، وتسري على أفرادها ────────────────────
const RULES_DEF = [
    'new_needs_rev' => 1,     // لا يُعطى حفظاً جديداً حتى يُسمّع المراجعة
    'new_needs_alwah' => 0,   // وكذلك الألواح
    'target_lines' => 5, 'alwah_n' => 5, 'review_n' => 10, 'dir' => 'desc',
    'rest_days' => '', 'rest_lines' => 0, 'rest_alwah' => 1,
];
function family_rules($fid) {
    static $c = [];
    if (isset($c[$fid])) return $c[$fid];
    $r = one("SELECT rules FROM al_families WHERE id=" . (int)$fid);
    $v = $r && $r['rules'] ? json_decode($r['rules'], true) : null;
    return $c[$fid] = array_merge(RULES_DEF, is_array($v) ? $v : []);
}

// ترتيب المراجعة: من الجزء الثلاثين صعوداً، وصفحات الجزء بترتيب المصحف داخله
// (ولمن يحفظ من الفاتحة: بترتيب المصحف من أوّله)
function rev_key($dir, $p) { return $dir === 'asc' ? $p : (31 - juz_of($p)) * 1000 + $p; }

// ─── الخطة: الموضع، والألواح، والمراجعة ───────────────────────────────────────
// $exclude_d: عند حساب خطة يومٍ نستبعد سجلّه هو، فتبقى الخطة كما كانت قبل تسميعه
function member_plan($m, $exclude_d = null) {
    $mid = (int)$m['id'];
    $ex = $exclude_d ? " AND d <> '" . E($exclude_d) . "'" : '';
    $x = one("SELECT COALESCE(SUM(CASE WHEN new_grade <> 1 THEN new_lines ELSE 0 END),0) s FROM al_logs WHERE member_id=$mid$ex");
    $dir = $m['dir'] === 'asc' ? 'asc' : 'desc';
    $seq = ml_seq($dir); $T = count($seq);
    $L = max(0, min($T, (int)$m['init_lines'] + (int)$x['s']));
    $cur = $L < $T ? $seq[$L] : null;                       // أوّل سطرٍ لم يُحفظ
    $tl = max(1, (int)$m['target_lines']);
    // الحفظ القادم حدّده المشرف عند تسميع الجديد (في سجلّ ذلك اليوم: ranges.next)، ويسري
    // ما دام الموضع هو نفسه الذي حُدِّد عنده؛ وإلا فالمقدار اليومي المعتاد
    $manual = null;
    $nx = one("SELECT ranges FROM al_logs WHERE member_id=$mid AND ranges LIKE '%\"next\"%'$ex ORDER BY d DESC, id DESC LIMIT 1");
    if ($nx) {
        $rv = json_decode($nx['ranges'], true);
        if (isset($rv['next']['pos'], $rv['next']['lines']) && (int)$rv['next']['pos'] === $L && (int)$rv['next']['lines'] > 0) {
            $tl = min(90, (int)$rv['next']['lines']); $manual = $rv['next']['to'] ?? true;
        }
    }

    // الحفظ الجديد: الأسطر التالية بترتيب الحفظ (من أوّل السورة إلى آخرها)
    $newL = $cur ? array_slice($seq, $L, $tl) : [];
    $toLine = 0;
    foreach ($newL as $y) if ($y[0] === $cur[0]) $toLine = max($toLine, $y[1]);

    // الألواح: آخر (عدد الألواح × ١٥) سطراً من المحفوظ، وصفحة حفظ اليوم معها
    $aw = max(1, (int)$m['alwah_n']) * LPP;
    $a0 = max(0, $L - $aw);
    $A = array_slice($seq, $a0, $L - $a0);
    $alwah = ml_pages($A);
    if ($cur && !in_array($cur[0], $alwah, true)) { $alwah[] = $cur[0]; sort($alwah); }

    // دورة المراجعة: ما قبل الألواح من المحفوظ، بالصفحات (والصفحة المشتركة تبقى في الألواح)
    $R = array_slice($seq, 0, $a0);
    $inA = array_flip($alwah);
    $cyc = array_values(array_filter(ml_pages($R), function ($p) use ($inA) { return !isset($inA[$p]); }));
    usort($cyc, function ($a, $b) use ($dir) { return rev_key($dir, $a) <=> rev_key($dir, $b); });

    // تبدأ مراجعة اليوم بعد آخر صفحةٍ رُوجعت فعلاً
    $review = [];
    if ($cyc) {
        $last = one("SELECT rev_list FROM al_logs WHERE member_id=$mid AND rev_done=1 AND rev_list IS NOT NULL AND rev_list <> ''$ex
                     ORDER BY d DESC, id DESC LIMIT 1");
        $start = 0;
        if ($last) {
            // الورد يُعرض من جهة البقرة إلى جهة الناس، فآخر ما رُوجع في الدورة هو الصفحة
            // التي لا تليها في الدورة صفحةٌ من الورد نفسه (لا آخر عنصرٍ في القائمة)
            $lst = array_map('intval', explode(',', $last['rev_list']));
            $pos = array_flip($cyc); $in = array_flip($lst); $cn = count($cyc);
            $lp = end($lst);
            foreach ($lst as $q) {
                if (!isset($pos[$q])) continue;
                $nx = $cyc[($pos[$q] + 1) % $cn];
                if (!isset($in[$nx])) { $lp = $q; break; }
            }
            $lk = rev_key($dir, $lp);
            foreach ($cyc as $i => $p) if (rev_key($dir, $p) > $lk) { $start = $i; break; }
            if (rev_key($dir, end($cyc)) <= $lk) $start = 0;      // انتهت الدورة: من أوّلها
        }
        $n = min(max(1, (int)$m['review_n']), count($cyc));
        for ($i = 0; $i < $n; $i++) $review[] = $cyc[($start + $i) % count($cyc)];
    }
    // الورد دائماً نزولاً: يبدأ من جهة البقرة وينتهي بجهة الناس
    $cycle_pos = $cyc && $review ? (array_search($review[0], $cyc, true) + 1) : 0;
    sort($review);
    $inR = array_flip($review);
    $revL = array_values(array_filter($R, function ($y) use ($inR) { return isset($inR[$y[0]]); }));

    // المحفوظ: كل صفحةٍ بنسبة أسطرها المحفوظة، وكل جزءٍ كذلك، فالجزء التامّ جزءٌ تامّ
    $tot = ml_totals(); $gp = []; $gj = [];
    for ($i = 0; $i < $L; $i++) { $x = $seq[$i]; $gp[$x[0]] = ($gp[$x[0]] ?? 0) + 1; $j = juz_of_ayah($x[2], $x[3]); $gj[$j] = ($gj[$j] ?? 0) + 1; }
    $mp = 0.0; foreach ($gp as $p => $n) $mp += $tot['p'][$p] ? $n / $tot['p'][$p] : 0;
    $mj = 0.0; foreach ($gj as $j => $n) $mj += $tot['j'][$j] ? $n / $tot['j'][$j] : 0;
    $mem = ['pages' => round($mp, 2), 'juz' => round($mj, 2)];

    // المؤجَّل: كم يوماً مضى على آخر إجازةٍ لكل جزء (ورد الأمس يعود، ولا يتراكم)
    $d0 = $exclude_d ?: date('Y-m-d');
    $late = [];
    foreach ([['new', 'new_lines > 0 AND new_grade <> 1'], ['alwah', 'alwah_done=1'], ['rev', 'rev_done=1']] as [$k, $w]) {
        $x2 = one("SELECT d FROM al_logs WHERE member_id=$mid AND $w AND d < '" . E($d0) . "'$ex ORDER BY d DESC LIMIT 1");
        $late[$k] = $x2 ? max(0, (int)round((strtotime($d0) - strtotime($x2['d'])) / 86400) - 1) : null;
    }
    // «لا يأخذ حفظاً جديداً حتى يُسمّع المراجعة»: يُحسب لخطة الغد من سجلّ اليوم
    $R = family_rules((int)$m['family_id']);
    $hold = null;
    if ($exclude_d === null) {
        $lg = one("SELECT alwah_done, rev_done FROM al_logs WHERE member_id=$mid AND d='" . E(date('Y-m-d')) . "' LIMIT 1");
        $needR = !empty($R['new_needs_rev']) && count($review) > 0 && (!$lg || !(int)$lg['rev_done']);
        $needA = !empty($R['new_needs_alwah']) && count($alwah) > 0 && (!$lg || !(int)$lg['alwah_done']);
        if ($needR || $needA) $hold = $needR && $needA ? 'المراجعة والألواح' : ($needR ? 'المراجعة' : 'الألواح');
    }

    // يوم راحة: لا حفظ جديد فيه (والمراجعة تبقى فهي التي تثبّت المحفوظ)
    $rest = array_filter(array_map('intval', explode(',', (string)($m['rest_days'] ?? ''))), function ($x) { return $x >= 0 && $x <= 6; });
    $isRest = in_array((int)date('w', strtotime($d0)), $rest, true);
    if ($isRest) {
        $rl = max(0, min(90, (int)($m['rest_lines'] ?? 0)));
        if ($rl > 0 && $cur) { $tl = $rl; $newL = array_slice($seq, $L, $tl); $toLine = 0; foreach ($newL as $y) if ($y[0] === $cur[0]) $toLine = max($toLine, $y[1]); }
        else { $cur = null; $newL = []; }
        if (empty($m['rest_alwah'])) $alwah = [];
    }

    return [
        'lines' => $L, 'total' => $T, 'pos' => $L, 'dir' => $dir,
        'late' => $late, 'rest' => $isRest, 'new_hold' => $hold, 'rules' => $R,
        'goal' => member_goal($m, $seq, $L, $d0, count($rest)),
        'memorized_pages' => $mem['pages'], 'juz' => $mem['juz'],
        'current' => $cur ? $cur[0] : null,
        'new' => $cur ? ['page' => $cur[0], 'from_line' => $cur[1], 'to_line' => $toLine ?: $cur[1], 'lines' => $tl, 'manual' => $manual] : null,
        'alwah' => $alwah, 'review' => $review, 'cycle' => count($cyc), 'cycle_pos' => $cycle_pos,
        // المقاطع بالآيات كما حُسبت (وما عدّله المشرف في ranges)
        'auto' => ['new' => new_segs($newL, $manual), 'alwah' => ml_segs($A), 'rev' => ml_segs($revL)],
        'juz_map' => juz_map($seq, $L),
    ];
}

// المقاطع بالآيات: لكل جزءٍ قائمة مقاطع [من، إلى] (وتُقبل الصيغة القديمة: مقطعٌ واحد)
function ranges_in($r) {
    $o = [];
    if (!is_array($r)) return null;
    $ok = function ($k) { return is_string($k) && preg_match('/^\d{1,3}:\d{1,3}$/', $k); };
    foreach (['new', 'alwah', 'rev'] as $k) {
        if (!isset($r[$k]) || !is_array($r[$k]) || !$r[$k]) continue;
        $segs = is_string($r[$k][0] ?? null) ? [$r[$k]] : $r[$k];
        $v = [];
        foreach (array_slice($segs, 0, 20) as $sg) if (is_array($sg) && count($sg) === 2 && $ok($sg[0]) && $ok($sg[1])) $v[] = [$sg[0], $sg[1]];
        if ($v) $o[$k] = $v;
    }
    // الحفظ القادم كما حدّده المشرف: عند أيّ موضع، وكم سطراً، وإلى أيّ آية
    if (isset($r['next']['pos'], $r['next']['lines']) && is_array($r['next'])) {
        $to = (string)($r['next']['to'] ?? '');
        $o['next'] = ['pos' => max(0, (int)$r['next']['pos']), 'lines' => max(1, min(90, (int)$r['next']['lines'])), 'to' => $ok($to) ? $to : null];
    }
    return $o ?: null;
}
function ranges_out($j) {
    $v = $j ? json_decode($j, true) : null;
    if (!is_array($v)) return null;
    foreach ($v as $k => $x) if (is_array($x) && is_string($x[0] ?? null)) $v[$k] = [$x];   // مقطعٌ واحد بالصيغة القديمة
    return $v;
}

// أسطر مقاطع الآيات [[من، إلى]، …] من خريطة الأسطر، مرتّبةً بترتيب الحفظ
function ml_range_lines($segs, $dir) {
    $S = ml_sur(); $out = [];
    foreach ((array)$segs as $sg) {
        if (!is_array($sg) || count($sg) !== 2) continue;
        [$s0, $a0] = array_map('intval', explode(':', (string)$sg[0]));
        [$s1, $a1] = array_map('intval', explode(':', (string)$sg[1]));
        for ($s = max(1, $s0); $s <= min(114, $s1); $s++) {
            $lo = $s === $s0 ? $a0 : 1; $hi = $s === $s1 ? $a1 : 9999;
            foreach ($S[$s] as $x) if ($x[4] >= $lo && $x[3] <= $hi) $out[] = $x;
        }
    }
    usort($out, function ($a, $b) use ($dir) {
        if ($dir !== 'asc' && $a[2] !== $b[2]) return $b[2] <=> $a[2];     // من الناس صعوداً: السورة الأعلى رقماً أوّلاً
        return ($a[0] <=> $b[0]) ?: ($a[1] <=> $b[1]);
    });
    return $out;
}

// ─── الورد اليدوي: ما يحدّده المشرف يبقى حتى يغيّره ─────────────────────────────
// لكل جزءٍ (الجديد، الألواح، المراجعة) آخرُ ما حدّده المشرف في يومٍ لا يتجاوز اليوم
// المطلوب. والمحسوب تلقائياً (auto) يبقى اقتراحاً فقط، ولمن لم يُحدَّد له وردٌ بعد.
function wird_apply($plan, $mid, $d) {
    $plan['custom'] = null;
    $plan['ranges'] = null;
    $rows = rows("SELECT * FROM al_wird WHERE member_id=" . (int)$mid . " AND d <= '" . E($d) . "' ORDER BY d DESC LIMIT 120");
    if (!$rows) return $plan;
    $pick = function ($f) use ($rows) { foreach ($rows as $w) if ($w[$f] !== null) return $w; return null; };
    $pl = function ($csv) { $a = array_values(array_filter(array_map('intval', explode(',', (string)$csv)), function ($p) { return $p >= 1 && $p <= PAGES; })); sort($a); return array_values(array_unique($a)); };
    $c = []; $rg = [];

    $wn = $pick('new_lines');
    if ($wn) {
        $n = (int)$wn['new_lines']; $c['new_lines'] = $n;
        $r = ranges_out($wn['ranges'] ?? null);
        if ($n <= 0) { $plan['new'] = null; $plan['new_off'] = true; }
        elseif ($r && !empty($r['new'])) {
            // المقطع كما حدّده المشرف: صفحته وأسطره منه لا من الموضع المحسوب
            $L = ml_range_lines($r['new'], $plan['dir']);
            if ($L) {
                $to = 0; foreach ($L as $y) if ($y[0] === $L[0][0]) $to = max($to, $y[1]);
                $plan['new'] = ['page' => $L[0][0], 'from_line' => $L[0][1], 'to_line' => $to, 'lines' => count($L), 'manual' => true];
            }
            $rg['new'] = $r['new'];
        } elseif ($plan['new']) {
            $plan['new']['lines'] = $n;
            $nl = array_slice(ml_seq($plan['dir']), $plan['pos'], $n);
            $plan['auto']['new'] = ml_segs($nl);
            $to = 0; foreach ($nl as $y) if ($y[0] === $plan['new']['page']) $to = max($to, $y[1]);
            $plan['new']['to_line'] = $to ?: $plan['new']['from_line'];
        }
    }
    foreach ([['alwah', 'alwah_list', 'alwah'], ['rev', 'rev_list', 'review']] as [$k, $f, $pk]) {
        $w = $pick($f);
        if (!$w) continue;
        $plan[$pk] = $pl($w[$f]); $c[$pk] = true;
        $r = ranges_out($w['ranges'] ?? null);
        if ($r && !empty($r[$k])) $rg[$k] = $r[$k];
    }
    $plan['custom'] = $c ?: null;
    $plan['ranges'] = $rg ?: null;
    return $plan;
}

// الهدف: سورةٌ يُتمّها في تاريخ، ومنه المقدار اليومي المطلوب وهل هو متقدّم أم متأخّر
function member_goal($m, $seq, $L, $d0, $restCount) {
    $gs = (int)($m['goal_surah'] ?? 0); $gd = (string)($m['goal_date'] ?? '');
    if (!$gs || !$gd) return null;
    $end = 0;
    foreach ($seq as $i => $x) if ((int)$x[2] === $gs) $end = $i;            // آخر سطرٍ في السورة الهدف بترتيب الحفظ
    $remain = max(0, $end + 1 - $L);
    $days = max(0, (int)floor((strtotime($gd) - strtotime($d0)) / 86400));
    $active = max(1, (int)round($days * max(1, 7 - $restCount) / 7));
    $need = $remain > 0 ? (int)ceil($remain / $active) : 0;
    $tl = max(1, (int)$m['target_lines']);
    $state = $remain === 0 ? 'done' : ($need <= $tl ? ($need <= $tl - 1 ? 'ahead' : 'on') : 'behind');
    return ['surah' => $gs, 'date' => $gd, 'remain_lines' => $remain, 'days' => $days, 'active_days' => $active,
            'need' => $need, 'target' => $tl, 'state' => $state,
            'progress' => $end + 1 > 0 ? round(min(1, $L / ($end + 1)), 3) : 0];
}

// نسبة المحفوظ من كل جزء (للخريطة): أسطره المحفوظة من أسطره كلّها
function juz_map($seq, $L) {
    $tot = array_fill(1, 30, 0); $got = array_fill(1, 30, 0);
    foreach ($seq as $i => $x) { $j = juz_of_ayah($x[2], $x[3]); $tot[$j]++; if ($i < $L) $got[$j]++; }
    $out = [];
    for ($j = 1; $j <= 30; $j++) $out[] = $tot[$j] ? round($got[$j] / $tot[$j], 3) : 0;
    return $out;
}

// ─── الإحصاءات ──────────────────────────────────────────────────────────────
function day_score($l) { return (((int)$l['new_lines'] > 0 && (int)$l['new_grade'] !== 1) ? 1 : 0) + ((int)$l['alwah_done'] ? 1 : 0) + ((int)$l['rev_done'] ? 1 : 0); }
function member_stats($mid, $rest = []) {
    $logs = rows("SELECT d, new_lines, new_grade, new_err, new_warn, alwah_done, alwah_grade, alwah_err, rev_done, rev_grade, rev_err
                  FROM al_logs WHERE member_id=" . (int)$mid . " AND d >= CURDATE() - INTERVAL 120 DAY ORDER BY d DESC");
    $byd = [];
    foreach ($logs as $l) $byd[$l['d']] = $l;
    // أيامٌ متتالية: تُحسب من اليوم، أو من أمس إن لم يُسمَّع اليوم بعد
    $streak = 0; $t = time();
    $d0 = date('Y-m-d', $t);
    if (!isset($byd[$d0]) || !day_score($byd[$d0])) $t -= 86400;
    // أيام الراحة لا تكسر العدّاد ولا تُحتسب فيه
    $guard = 0;
    while ($guard++ < 400) {
        $d = date('Y-m-d', $t);
        if (isset($byd[$d]) && day_score($byd[$d]) > 0) { $streak++; $t -= 86400; continue; }
        if (in_array((int)date('w', $t), $rest, true)) { $t -= 86400; continue; }
        break;
    }
    $cal = [];
    for ($i = 59; $i >= 0; $i--) { $d = date('Y-m-d', time() - $i * 86400); $cal[] = ['d' => $d, 's' => isset($byd[$d]) ? day_score($byd[$d]) : 0, 'on' => isset($byd[$d])]; }
    $wk = 0; $mo = 0; $g = ['new' => [], 'alwah' => [], 'rev' => []]; $err = 0; $days30 = 0;
    foreach ($logs as $l) {
        $age = (strtotime(date('Y-m-d')) - strtotime($l['d'])) / 86400;
        $ok = (int)$l['new_grade'] !== 1 ? (int)$l['new_lines'] : 0;
        if ($age < 7) $wk += $ok;
        if ($age < 30) {
            $mo += $ok; $days30++;
            if ((int)$l['new_grade']) $g['new'][] = (int)$l['new_grade'];
            if ((int)$l['alwah_grade']) $g['alwah'][] = (int)$l['alwah_grade'];
            if ((int)$l['rev_grade']) $g['rev'][] = (int)$l['rev_grade'];
            $err += (int)$l['new_err'] + (int)$l['alwah_err'] + (int)$l['rev_err'];
        }
    }
    $avg = function ($a) { return $a ? round(array_sum($a) / count($a), 1) : null; };
    return ['streak' => $streak, 'calendar' => $cal, 'week_lines' => $wk, 'month_lines' => $mo,
            'days30' => $days30, 'avg' => ['new' => $avg($g['new']), 'alwah' => $avg($g['alwah']), 'rev' => $avg($g['rev'])],
            'errors30' => $err, 'today' => isset($byd[$d0]) ? $byd[$d0] : null];
}

// ─── الدخول ─────────────────────────────────────────────────────────────────
function make_token($uid) {
    $p = b64u(json_encode(['u' => (int)$uid, 'e' => time() + 90 * 86400]));
    return $p . '.' . b64u(hash_hmac('sha256', $p, AL_KEY, true));
}
function read_token() {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$h && function_exists('apache_request_headers')) { $ah = apache_request_headers(); $h = $ah['Authorization'] ?? $ah['authorization'] ?? ''; }
    if (!preg_match('/Bearer\s+(\S+)/', $h, $m)) return 0;
    $parts = explode('.', $m[1]);
    if (count($parts) !== 2) return 0;
    if (!hash_equals(b64u(hash_hmac('sha256', $parts[0], AL_KEY, true)), $parts[1])) return 0;
    $p = json_decode(b64u_dec($parts[0]), true);
    if (!$p || ($p['e'] ?? 0) < time()) return 0;
    return (int)$p['u'];
}
function me() {
    static $u = false;
    if ($u !== false) return $u;
    $u = null;
    $id = read_token();
    if ($id) { $x = one("SELECT id, family_id, username, name, role, member_id, is_admin, active, feat_recite FROM al_users WHERE id=$id LIMIT 1");
               if ($x && (int)$x['active'] === 1) $u = $x; }
    return $u;
}
function need() { $u = me(); if (!$u) fail('انتهت الجلسة، سجّل الدخول من جديد', 401); return $u; }
function is_sup($u) { return in_array($u['role'], ['owner', 'supervisor'], true); }
function need_sup() { $u = need(); if (!is_sup($u)) fail('للمشرف فقط', 403); return $u; }
function need_owner() { $u = need(); if ($u['role'] !== 'owner') fail('لصاحب الحساب فقط', 403); return $u; }

// الفرد المسموح به: المشرف يرى أفراد أسرته كلّهم، والفرد يرى نفسه فقط
function member_for($u, $id) {
    $fid = (int)$u['family_id']; $id = (int)$id;
    $m = one("SELECT * FROM al_members WHERE id=$id AND family_id=$fid AND deleted=0 LIMIT 1");
    if (!$m) fail('غير موجود', 404);
    if (!is_sup($u) && (int)$u['member_id'] !== $id) fail('لا صلاحية', 403);
    return $m;
}
function clean_member($m) {
    foreach (['id', 'init_lines', 'target_lines', 'alwah_n', 'review_n', 'sort', 'rest_lines', 'rest_alwah'] as $k) if (isset($m[$k])) $m[$k] = (int)$m[$k];
    $m['goal_surah'] = isset($m['goal_surah']) && $m['goal_surah'] !== null ? (int)$m['goal_surah'] : null;
    $m['rest_days'] = array_values(array_filter(array_map('intval', explode(',', (string)($m['rest_days'] ?? ''))), function ($x) { return $x >= 0 && $x <= 6; }));
    unset($m['deleted'], $m['family_id']);
    return $m;
}
function clean_log($l) {
    if (!$l) return null;
    foreach (['id', 'member_id', 'new_page', 'new_lines', 'new_grade', 'new_err', 'new_warn', 'alwah_done', 'alwah_grade', 'alwah_err', 'alwah_warn',
              'rev_done', 'rev_grade', 'rev_err', 'rev_warn', 'recorded_by'] as $k) if (isset($l[$k])) $l[$k] = $l[$k] === null ? null : (int)$l[$k];
    $l['alwah_list'] = $l['alwah_list'] ? array_map('intval', explode(',', $l['alwah_list'])) : [];
    $l['rev_list'] = $l['rev_list'] ? array_map('intval', explode(',', $l['rev_list'])) : [];
    $l['ranges'] = ranges_out($l['ranges'] ?? null);
    unset($l['family_id']);
    return $l;
}
function pages_csv($a) {
    $o = [];
    foreach ((array)$a as $p) { $p = (int)$p; if ($p >= 1 && $p <= PAGES && !in_array($p, $o, true)) $o[] = $p; }
    return implode(',', array_slice($o, 0, 60));
}

$action = $_GET['action'] ?? '';

switch ($action) {

case 'status': {
    $n = (int)one("SELECT COUNT(*) n FROM al_users")['n'];
    out(['success' => true, 'needs_setup' => $n === 0]);
}

// أول حساب: صاحب الأسرة الأولى ومدير التطبيق، وتُغلق التهيئة بعده
case 'setup': {
    if ((int)one("SELECT COUNT(*) n FROM al_users")['n'] > 0) fail('التهيئة مغلقة');
    $b = body();
    $un = strtolower(trim((string)($b['username'] ?? '')));
    $nm = trim((string)($b['name'] ?? ''));
    $fam = trim((string)($b['family'] ?? '')) ?: 'أسرتي';
    $pw = (string)($b['password'] ?? '');
    if (!preg_match('/^[a-z0-9_.-]{3,40}$/', $un)) fail('اسم الدخول: حروف إنجليزية وأرقام، ٣ أحرف فأكثر');
    if (mb_strlen($nm) < 2) fail('الاسم مطلوب');
    if (strlen($pw) < 6) fail('كلمة المرور ستة أحرف فأكثر');
    $conn->query("INSERT INTO al_families (name) VALUES ('" . E(mb_substr($fam, 0, 120)) . "')");
    $fid = (int)$conn->insert_id;
    $conn->query("INSERT INTO al_users (family_id, username, name, pass_hash, role, is_admin) VALUES ($fid, '" . E($un) . "', '" . E($nm) . "', '"
        . E(password_hash($pw, PASSWORD_DEFAULT)) . "', 'owner', 1)");
    $uid = (int)$conn->insert_id;
    al_log($uid, 'setup');
    out(['success' => true, 'token' => make_token($uid)]);
}

// تسجيلٌ جديد: من أراد أن يفتح لأسرته حساباً بنفسه، فيصير مشرفها
// (لا صلاحية له على غير أسرته، وبياناتها لا يراها أحدٌ سواه)
case 'register': {
    $b = body();
    $un = strtolower(trim((string)($b['username'] ?? '')));
    $nm = trim((string)($b['name'] ?? ''));
    $fam = trim((string)($b['family'] ?? '')) ?: 'أسرتي';
    $pw = (string)($b['password'] ?? '');
    if (!preg_match('/^[a-z0-9_.-]{3,40}$/', $un)) fail('اسم الدخول: حروف إنجليزية وأرقام، ٣ أحرف فأكثر');
    if (mb_strlen($nm) < 2) fail('الاسم مطلوب');
    if (strlen($pw) < 6) fail('كلمة المرور ستة أحرف فأكثر');
    if (one("SELECT id FROM al_users WHERE username='" . E($un) . "' LIMIT 1")) fail('اسم الدخول مستعمل، اختر غيره');
    $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '')[0]);
    $n = (int)one("SELECT COUNT(*) n FROM al_log WHERE action='register' AND ip='" . E($ip) . "' AND at > NOW() - INTERVAL 1 HOUR")['n'];
    if ($n >= 5) fail('محاولات كثيرة من هذا الجهاز، حاول بعد ساعة');
    $conn->query("INSERT INTO al_families (name) VALUES ('" . E(mb_substr($fam, 0, 120)) . "')");
    $fid = (int)$conn->insert_id;
    $conn->query("INSERT INTO al_users (family_id, username, name, pass_hash, role, is_admin) VALUES ($fid, '" . E($un) . "', '" . E($nm) . "', '"
        . E(password_hash($pw, PASSWORD_DEFAULT)) . "', 'owner', 0)");
    $uid = (int)$conn->insert_id;
    al_log($uid, 'register', ['family' => $fam]);
    out(['success' => true, 'token' => make_token($uid)]);
}

case 'login': {
    $b = body();
    $un = strtolower(trim((string)($b['username'] ?? '')));
    $fails = (int)one("SELECT COUNT(*) n FROM al_log WHERE action='login_fail' AND data='" . E(json_encode($un)) . "' AND at > NOW() - INTERVAL 15 MINUTE")['n'];
    if ($fails >= 8) fail('محاولات كثيرة، انتظر ربع ساعة');
    $u = one("SELECT * FROM al_users WHERE username='" . E($un) . "' LIMIT 1");
    if (!$u || !password_verify((string)($b['password'] ?? ''), $u['pass_hash'])) { al_log(null, 'login_fail', $un); fail('اسم الدخول أو كلمة المرور غير صحيحة'); }
    if ((int)$u['active'] !== 1) fail('الحساب موقوف');
    $conn->query("UPDATE al_users SET last_login=NOW() WHERE id=" . (int)$u['id']);
    out(['success' => true, 'token' => make_token($u['id'])]);
}

case 'me': {
    $u = need();
    $f = one("SELECT id, name FROM al_families WHERE id=" . (int)$u['family_id']);
    foreach (['id', 'family_id', 'member_id', 'is_admin', 'feat_recite'] as $k) $u[$k] = $u[$k] === null ? null : (int)$u[$k];
    if ($f) $f['rules'] = family_rules((int)$u['family_id']);
    out(['success' => true, 'user' => $u, 'family' => $f, 'sup' => is_sup($u)]);
}

case 'password': {
    $u = need(); $b = body();
    $row = one("SELECT pass_hash FROM al_users WHERE id=" . (int)$u['id']);
    if (!password_verify((string)($b['old'] ?? ''), $row['pass_hash'])) fail('كلمة المرور الحالية غير صحيحة');
    if (strlen((string)($b['new'] ?? '')) < 6) fail('كلمة المرور الجديدة ستة أحرف فأكثر');
    $conn->query("UPDATE al_users SET pass_hash='" . E(password_hash($b['new'], PASSWORD_DEFAULT)) . "' WHERE id=" . (int)$u['id']);
    al_log($u['id'], 'password');
    out(['success' => true]);
}

// ─── الأفراد ────────────────────────────────────────────────────────────────
case 'members': {
    $u = need(); $fid = (int)$u['family_id'];
    $w = is_sup($u) ? '' : ' AND id=' . (int)$u['member_id'];
    $list = [];
    foreach (rows("SELECT * FROM al_members WHERE family_id=$fid AND deleted=0$w ORDER BY sort, id") as $m) {
        $rd = array_map('intval', array_filter(explode(',', (string)($m['rest_days'] ?? ''))));
        $p = wird_apply(member_plan($m), $m['id'], date('Y-m-d')); $s = member_stats($m['id'], $rd);
        $list[] = clean_member($m) + ['plan' => $p, 'next' => wird_apply(member_plan($m), $m['id'], date('Y-m-d', strtotime('+1 day'))),
                                      'streak' => $s['streak'], 'week_lines' => $s['week_lines'], 'today' => clean_log($s['today'])];
    }
    out(['success' => true, 'data' => $list]);
}

case 'member': {
    $u = need(); $m = member_for($u, $_GET['id'] ?? 0);
    $today = date('Y-m-d');
    $hist = array_map('clean_log', rows("SELECT * FROM al_logs WHERE member_id=" . (int)$m['id'] . " ORDER BY d DESC LIMIT 90"));
    $names = [];
    foreach (rows("SELECT id, name FROM al_users WHERE family_id=" . (int)$u['family_id']) as $x) $names[(int)$x['id']] = $x['name'];
    foreach ($hist as &$h) $h['by'] = $names[$h['recorded_by']] ?? null;
    unset($h);
    out(['success' => true, 'member' => clean_member($m), 'plan' => wird_apply(member_plan($m, $today), $m['id'], $today), 'now' => member_plan($m),
         'next' => wird_apply(member_plan($m), $m['id'], date('Y-m-d', strtotime('+1 day'))),
         'stats' => member_stats($m['id'], array_map('intval', array_filter(explode(',', (string)($m['rest_days'] ?? ''))))), 'history' => $hist]);
}

case 'member_save': {
    $u = need_sup(); $fid = (int)$u['family_id']; $b = body();
    $id = (int)($b['id'] ?? 0);
    $nm = trim(mb_substr((string)($b['name'] ?? ''), 0, 120));
    if (mb_strlen($nm) < 2) fail('الاسم مطلوب');
    $dir = ($b['dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
    $init = max(0, min(PAGES * LPP, (int)($b['init_lines'] ?? 0)));
    $tl = max(1, min(90, (int)($b['target_lines'] ?? 5)));
    $an = max(1, min(20, (int)($b['alwah_n'] ?? 5)));
    $rn = max(1, min(60, (int)($b['review_n'] ?? 10)));
    $g = ($b['gender'] ?? 'm') === 'f' ? 'f' : 'm';
    $col = preg_match('/^#[0-9a-f]{6}$/i', (string)($b['color'] ?? '')) ? $b['color'] : '#1f5f4a';
    $rest = implode(',', array_values(array_unique(array_filter(array_map('intval', (array)($b['rest_days'] ?? [])), function ($x) { return $x >= 0 && $x <= 6; }))));
    $gs = (int)($b['goal_surah'] ?? 0); $gs = $gs >= 1 && $gs <= 114 ? $gs : 0;
    $gd = preg_match('/^d{4}-d{2}-d{2}$/', (string)($b['goal_date'] ?? '')) ? $b['goal_date'] : '';
    $set = "name='" . E($nm) . "', gender='$g', color='" . E($col) . "', dir='$dir', init_lines=$init, target_lines=$tl, alwah_n=$an, review_n=$rn"
        . ", rest_days='" . E($rest) . "', goal_surah=" . ($gs ?: 'NULL') . ", goal_date=" . ($gd ? "'" . E($gd) . "'" : 'NULL')
        . ', rest_lines=' . max(0, min(90, (int)($b['rest_lines'] ?? 0))) . ', rest_alwah=' . (empty($b['rest_alwah']) ? 0 : 1);
    if ($id) {
        member_for($u, $id);
        $conn->query("UPDATE al_members SET $set WHERE id=$id AND family_id=$fid");
    } else {
        $conn->query("INSERT INTO al_members SET family_id=$fid, start_d=CURDATE(), $set");
        $id = (int)$conn->insert_id;
    }
    al_log($u['id'], 'member_save', ['id' => $id] + $b);
    out(['success' => true, 'id' => $id]);
}

case 'member_delete': {
    $u = need_sup(); $b = body(); $m = member_for($u, $b['id'] ?? 0);
    $conn->query("UPDATE al_members SET deleted=1 WHERE id=" . (int)$m['id']);
    al_log($u['id'], 'member_delete', ['id' => (int)$m['id']]);
    out(['success' => true]);
}

// ─── التسميع ────────────────────────────────────────────────────────────────
// يُرجع سجلّ اليوم إن وُجد، وخطة ذلك اليوم محسوبةً قبل تسميعه
case 'log_get': {
    $u = need(); $m = member_for($u, $_GET['member_id'] ?? 0);
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($_GET['d'] ?? '')) ? $_GET['d'] : date('Y-m-d');
    $l = one("SELECT * FROM al_logs WHERE member_id=" . (int)$m['id'] . " AND d='" . E($d) . "' LIMIT 1");
    out(['success' => true, 'member' => clean_member($m), 'd' => $d, 'log' => clean_log($l), 'plan' => wird_apply(member_plan($m, $d), $m['id'], $d)]);
}

// ─── تعديل ورد اليوم يدوياً (للمشرف) ─────────────────────────────────────────
// ─── الإشعارات: اشتراك الأجهزة وما يُرسَل في كل موعد ─────────────────────────
case 'push_sub': {
    $u = need(); $b = body();
    $ep = trim((string)($b['endpoint'] ?? ''));
    $p2 = trim((string)($b['p256dh'] ?? '')); $au = trim((string)($b['auth'] ?? ''));
    if (!preg_match('#^https://#', $ep) || strlen($ep) > 500 || !$p2 || !$au) fail('اشتراك غير صحيح');
    $conn->query("INSERT INTO al_push (family_id, user_id, endpoint, p256dh, auth, agent) VALUES ("
        . (int)$u['family_id'] . ", " . (int)$u['id'] . ", '" . E($ep) . "', '" . E($p2) . "', '" . E($au) . "', '" . E(mb_substr((string)($b['agent'] ?? ''), 0, 120)) . "')
        ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), family_id=VALUES(family_id), p256dh=VALUES(p256dh), auth=VALUES(auth), agent=VALUES(agent), failed=0");
    out(['success' => true]);
}

case 'push_unsub': {
    $u = need(); $b = body();
    $conn->query("DELETE FROM al_push WHERE user_id=" . (int)$u['id'] . " AND endpoint='" . E((string)($b['endpoint'] ?? '')) . "'");
    out(['success' => true]);
}

// ما يجب إرساله الآن: يناديه مرسِل الإشعارات بمفتاحٍ سرّي (لا جلسة)
case 'push_due': {
    if (!hash_equals(PUSH_KEY, (string)($_GET['key'] ?? ''))) fail('غير مصرّح', 403);
    $slot = in_array($_GET['slot'] ?? '', ['fajr', 'morning', 'evening'], true) ? $_GET['slot'] : 'evening';
    $today = date('Y-m-d');
    $out = [];
    foreach (rows("SELECT * FROM al_push WHERE failed < 5") as $p) {
        $uid = (int)$p['user_id']; $fid = (int)$p['family_id'];
        $usr = one("SELECT id, role, member_id, active FROM al_users WHERE id=$uid LIMIT 1");
        if (!$usr || !(int)$usr['active']) continue;
        $sup = in_array($usr['role'], ['owner', 'supervisor'], true);
        $w = $sup ? '' : ' AND id=' . (int)$usr['member_id'];
        $pend = []; $names = []; $noNext = 0; $wird = [];
        foreach (rows("SELECT * FROM al_members WHERE family_id=$fid AND deleted=0$w") as $m) {
            $pl = wird_apply(member_plan($m, $today), $m['id'], $today);
            $l = one("SELECT * FROM al_logs WHERE member_id=" . (int)$m['id'] . " AND d='" . E($today) . "' LIMIT 1");
            $done = [
                'new' => $l && (int)$l['new_lines'] > 0 && (int)$l['new_grade'] !== 1,
                'alwah' => $l && (int)$l['alwah_done'],
                'rev' => $l && (int)$l['rev_done'],
            ];
            $need = (($pl['new'] && !$done['new']) ? 1 : 0) + ((count($pl['alwah']) && !$done['alwah']) ? 1 : 0) + ((count($pl['review']) && !$done['rev']) ? 1 : 0);
            if ($need) { $pend[] = $m['name']; }
            $names[] = $m['name'];
            // ورد اليوم بالسور والآيات (لإشعار الفجر)
            $rg = function ($k) use ($pl) { $x = ($pl['ranges'][$k] ?? null) ?: ($pl['auto'][$k] ?? null); return $x ? segs_label($x) : ''; };
            $parts = [];
            if ($pl['new']) { $t = $rg('new'); if ($t) $parts[] = 'الجديد: ' . $t; }
            if (count($pl['alwah'])) { $t = $rg('alwah'); if ($t) $parts[] = 'الألواح: ' . $t; }
            if (count($pl['review'])) { $t = $rg('rev'); if ($t) $parts[] = 'المراجعة: ' . $t; }
            if ($parts) $wird[] = ['name' => $m['name'], 'parts' => $parts, 'new' => $pl['new'] ? $rg('new') : ''];
            $nx = wird_apply(member_plan($m), $m['id'], date('Y-m-d', strtotime('+1 day')));
            if (!$nx['custom']) $noNext++;
        }
        $title = 'ألواح'; $body = ''; $url = './';
        if ($slot === 'fajr') {
            // بعد الفجر: ورد اليوم جاهزاً بين يديه
            if (!$wird) continue;
            if ($sup && count($wird) > 1) {
                $body = '';
                foreach (array_slice($wird, 0, 5) as $w) $body .= $w['name'] . ($w['new'] ? ' · ' . $w['new'] : '') . "
";
                $body = 'ورد اليوم الجديد:' . "
" . rtrim($body);
            } else {
                $body = implode("
", $wird[0]['parts']);
                $title = 'ورد ' . $wird[0]['name'];
            }
            $url = $sup && count($wird) > 1 ? '#/' : '#/hifz';
        } elseif ($slot === 'morning') {
            if (!$pend) continue;
            $body = $sup ? ('ورد اليوم بانتظار التسميع: ' . implode('، ', array_slice($pend, 0, 4))) : 'ورد اليوم بانتظارك، بارك الله فيك';
            $url = $sup ? '#/' : '#/hifz';
        } else {
            if ($pend) $body = $sup ? ('لم يُسمَّع بعد: ' . implode('، ', array_slice($pend, 0, 4))) : 'ما زال ورد اليوم بانتظارك';
            elseif ($sup && $noNext) $body = 'تمّ ورد اليوم. اعتمد ورد الغد';
            else continue;
            $url = $sup && !$pend ? '#/tomorrow' : ($sup ? '#/' : '#/hifz');
        }
        $out[] = ['id' => (int)$p['id'], 'endpoint' => $p['endpoint'], 'p256dh' => $p['p256dh'], 'auth' => $p['auth'],
                  'title' => $title, 'body' => $body, 'url' => $url, 'tag' => 'alwah-' . $slot];
    }
    out(['success' => true, 'slot' => $slot, 'data' => $out]);
}

// نتيجة الإرسال: يُبلّغ المرسِل عن الاشتراكات المنتهية فتُحذف
case 'push_result': {
    if (!hash_equals(PUSH_KEY, (string)($_GET['key'] ?? ''))) fail('غير مصرّح', 403);
    $b = body();
    foreach ((array)($b['gone'] ?? []) as $id) $conn->query("DELETE FROM al_push WHERE id=" . (int)$id);
    foreach ((array)($b['failed'] ?? []) as $id) $conn->query("UPDATE al_push SET failed=failed+1 WHERE id=" . (int)$id);
    out(['success' => true]);
}

case 'wird_save': {
    // يُحفظ ما أُرسل من الأجزاء فقط (ويبقى غيره كما كان في ذلك اليوم)؛ reset يمسح الورد اليدوي كلّه
    $u = need_sup(); $b = body(); $m = member_for($u, $b['member_id'] ?? 0);
    $mid = (int)$m['id'];
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($b['d'] ?? '')) ? $b['d'] : date('Y-m-d');
    if (!empty($b['reset'])) {
        $old = rows("SELECT * FROM al_wird WHERE member_id=$mid");
        $conn->query("DELETE FROM al_wird WHERE member_id=$mid");
        al_log($u['id'], 'wird_reset', ['member' => $mid, 'old' => $old]);      // المحذوف محفوظٌ هنا كاملاً
        out(['success' => true]);
    }
    $old = one("SELECT * FROM al_wird WHERE member_id=$mid AND d='" . E($d) . "' LIMIT 1");
    $sql = function ($v) { return $v === null ? 'NULL' : "'" . E($v) . "'"; };
    $nl = $old ? $old['new_lines'] : null;
    if (array_key_exists('new_lines', $b)) $nl = $b['new_lines'] === null || $b['new_lines'] === '' ? null : (string)max(0, min(90, (int)$b['new_lines']));
    $lst = function ($k, $cur) use ($b) {
        if (!array_key_exists($k, $b)) return $cur;
        if (!is_array($b[$k])) return null;
        $a = array_values(array_unique(array_filter(array_map('intval', $b[$k]), function ($p) { return $p >= 1 && $p <= PAGES; })));
        if (count($a) > 60) fail('الحدّ ٦٠ صفحة');
        sort($a);
        return implode(',', $a);
    };
    $al = $lst('alwah_list', $old ? $old['alwah_list'] : null);
    $rv = $lst('rev_list', $old ? $old['rev_list'] : null);
    $rg = ranges_out($old ? $old['ranges'] : null) ?: [];
    $in = ranges_in($b['ranges'] ?? null) ?: [];
    $rb = is_array($b['ranges'] ?? null) ? $b['ranges'] : [];
    foreach (['new', 'alwah', 'rev'] as $k) {
        if (isset($in[$k])) $rg[$k] = $in[$k];
        elseif (array_key_exists($k, $rb) && $rb[$k] === null) unset($rg[$k]);   // يعود المقطع إلى الحساب من الموضع
    }
    if ($nl === null || (int)$nl === 0) unset($rg['new']);
    if ($al === null || $al === '') unset($rg['alwah']);
    if ($rv === null || $rv === '') unset($rg['rev']);
    unset($rg['next']);
    $rgs = $rg ? json_encode($rg) : null;
    $conn->query("INSERT INTO al_wird (member_id, d, new_lines, alwah_list, rev_list, ranges, by_user) VALUES ($mid, '" . E($d) . "', "
        . ($nl === null ? 'NULL' : (int)$nl) . ", " . $sql($al) . ", " . $sql($rv) . ", " . $sql($rgs) . ", " . (int)$u['id'] . ")
                  ON DUPLICATE KEY UPDATE new_lines=VALUES(new_lines), alwah_list=VALUES(alwah_list), rev_list=VALUES(rev_list), ranges=VALUES(ranges), by_user=VALUES(by_user)");
    al_log($u['id'], 'wird_save', ['member' => $mid, 'd' => $d, 'new_lines' => $nl, 'alwah' => $al, 'rev' => $rv, 'ranges' => $rg]);
    out(['success' => true, 'plan' => wird_apply(member_plan($m, $d), $mid, $d)]);
}

// ─── الحفظ القادم: يحدّده المشرف عند تسميع الجديد ───────────────────────────────
case 'next_save': {
    $u = need_sup(); $b = body(); $m = member_for($u, $b['member_id'] ?? 0);
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($b['d'] ?? '')) ? $b['d'] : date('Y-m-d');
    $l = one("SELECT id, ranges FROM al_logs WHERE member_id=" . (int)$m['id'] . " AND d='" . E($d) . "' LIMIT 1");
    if (!$l) fail('سجّل تسميع اليوم أولاً');
    $r = ranges_out($l['ranges']) ?: [];
    if (!empty($b['reset'])) unset($r['next']);
    else {
        $pl = member_plan($m);                         // الموضع بعد تسميع اليوم
        $to = (string)($b['to'] ?? '');
        $r['next'] = ['pos' => $pl['lines'], 'lines' => max(1, min(90, (int)($b['lines'] ?? 0))), 'to' => preg_match('/^\d{1,3}:\d{1,3}$/', $to) ? $to : null];
    }
    $js = $r ? "'" . E(json_encode($r)) . "'" : 'NULL';
    $conn->query("UPDATE al_logs SET ranges=$js WHERE id=" . (int)$l['id']);
    al_log($u['id'], 'next_save', ['member' => (int)$m['id'], 'd' => $d, 'next' => $r['next'] ?? null]);
    out(['success' => true, 'plan' => wird_apply(member_plan($m), $m['id'], date('Y-m-d'))]);
}

case 'log_save': {
    // إجازة الورد للمشرف وحده: الفرد لا يسجّل تسميع نفسه
    $u = need_sup(); $b = body(); $m = member_for($u, $b['member_id'] ?? 0);
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($b['d'] ?? '')) ? $b['d'] : date('Y-m-d');
    if ($d > date('Y-m-d')) fail('لا يُسجَّل تسميعٌ ليومٍ لم يأتِ');
    $i = function ($k, $max = 999) use ($b) { return max(0, min($max, (int)($b[$k] ?? 0))); };
    $f = [
        'new_page' => (int)($b['new_page'] ?? 0) ?: 'NULL', 'new_lines' => $i('new_lines', 90), 'new_grade' => $i('new_grade', 5),
        'new_err' => $i('new_err'), 'new_warn' => $i('new_warn'),
        'alwah_list' => "'" . E(pages_csv($b['alwah_list'] ?? [])) . "'", 'alwah_done' => empty($b['alwah_done']) ? 0 : 1,
        'alwah_grade' => $i('alwah_grade', 5), 'alwah_err' => $i('alwah_err'), 'alwah_warn' => $i('alwah_warn'),
        'rev_list' => "'" . E(pages_csv($b['rev_list'] ?? [])) . "'", 'rev_done' => empty($b['rev_done']) ? 0 : 1,
        'rev_grade' => $i('rev_grade', 5), 'rev_err' => $i('rev_err'), 'rev_warn' => $i('rev_warn'),
        'note' => "'" . E(mb_substr(trim((string)($b['note'] ?? '')), 0, 1000)) . "'", 'recorded_by' => (int)$u['id'],
    ];
    $rg = ranges_in($b['ranges'] ?? null);
    $f['ranges'] = $rg ? "'" . E(json_encode($rg)) . "'" : 'NULL';
    // درس اليوم يُسجَّل متى سُمِّع. وإنّما يتوقّف «الحفظ الجديد القادم» حتى تُسمَّع المراجعة
    $cols = implode(', ', array_keys($f)); $vals = implode(', ', array_values($f));
    $upd = implode(', ', array_map(function ($k) { return "$k=VALUES($k)"; }, array_keys($f)));
    $conn->query("INSERT INTO al_logs (family_id, member_id, d, $cols) VALUES (" . (int)$u['family_id'] . ", " . (int)$m['id'] . ", '" . E($d) . "', $vals)
                  ON DUPLICATE KEY UPDATE $upd");
    al_log($u['id'], 'log_save', ['member' => (int)$m['id'], 'd' => $d]);
    out(['success' => true, 'plan' => member_plan($m)]);
}

case 'log_delete': {
    $u = need_sup(); $b = body(); $m = member_for($u, $b['member_id'] ?? 0);
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($b['d'] ?? '')) ? $b['d'] : '';
    if (!$d) fail('التاريخ مطلوب');
    $old = one("SELECT * FROM al_logs WHERE member_id=" . (int)$m['id'] . " AND d='" . E($d) . "'");
    $conn->query("DELETE FROM al_logs WHERE member_id=" . (int)$m['id'] . " AND d='" . E($d) . "'");
    al_log($u['id'], 'log_delete', $old);       // السجلّ المحذوف محفوظٌ هنا كاملاً
    out(['success' => true]);
}

// ─── الأسرة والحسابات ───────────────────────────────────────────────────────
case 'family_save': {
    $u = need_owner(); $b = body();
    $set = [];
    if (isset($b['name'])) {
        $nm = trim(mb_substr((string)$b['name'], 0, 120));
        if (mb_strlen($nm) < 2) fail('اسم الأسرة مطلوب');
        $set[] = "name='" . E($nm) . "'";
    }
    if (isset($b['rules']) && is_array($b['rules'])) {
        $r = family_rules((int)$u['family_id']);
        foreach (RULES_DEF as $k => $dv) {
            if (!array_key_exists($k, $b['rules'])) continue;
            $v = $b['rules'][$k];
            if ($k === 'dir') $r[$k] = $v === 'asc' ? 'asc' : 'desc';
            elseif ($k === 'rest_days') $r[$k] = implode(',', array_values(array_unique(array_filter(array_map('intval', (array)$v), function ($x) { return $x >= 0 && $x <= 6; }))));
            elseif (is_int($dv)) $r[$k] = max(0, min(90, (int)$v));
            else $r[$k] = $v;
        }
        $set[] = "rules='" . E(json_encode($r, JSON_UNESCAPED_UNICODE)) . "'";
    }
    if ($set) $conn->query("UPDATE al_families SET " . implode(', ', $set) . " WHERE id=" . (int)$u['family_id']);
    al_log($u['id'], 'family_save', $b);
    out(['success' => true, 'rules' => family_rules((int)$u['family_id'])]);
}

case 'users': {
    $u = need_owner();
    $list = rows("SELECT id, username, name, role, member_id, active, last_login, feat_recite FROM al_users WHERE family_id=" . (int)$u['family_id'] . " ORDER BY id");
    foreach ($list as &$x) { $x['id'] = (int)$x['id']; $x['member_id'] = $x['member_id'] === null ? null : (int)$x['member_id']; $x['active'] = (int)$x['active']; $x['feat_recite'] = (int)$x['feat_recite']; }
    unset($x);
    out(['success' => true, 'data' => $list]);
}

case 'user_save': {
    $u = need_owner(); $fid = (int)$u['family_id']; $b = body();
    $id = (int)($b['id'] ?? 0);
    $nm = trim(mb_substr((string)($b['name'] ?? ''), 0, 120));
    $un = strtolower(trim((string)($b['username'] ?? '')));
    $role = in_array($b['role'] ?? '', ['supervisor', 'member'], true) ? $b['role'] : 'member';
    $mid = (int)($b['member_id'] ?? 0);
    $pw = (string)($b['password'] ?? '');
    if (mb_strlen($nm) < 2) fail('الاسم مطلوب');
    if (!preg_match('/^[a-z0-9_.-]{3,40}$/', $un)) fail('اسم الدخول: حروف إنجليزية وأرقام، ٣ أحرف فأكثر');
    if ($role === 'member' && !$mid) fail('اختر الفرد الذي يتابعه هذا الحساب');
    if ($mid && !one("SELECT id FROM al_members WHERE id=$mid AND family_id=$fid AND deleted=0")) fail('الفرد غير موجود');
    $dup = one("SELECT id FROM al_users WHERE username='" . E($un) . "' AND id <> $id");
    if ($dup) fail('اسم الدخول مستخدم، اختر غيره');
    if ($id) {
        $t = one("SELECT role FROM al_users WHERE id=$id AND family_id=$fid");
        if (!$t) fail('غير موجود', 404);
        if ($t['role'] === 'owner') $role = 'owner';
        $set = "name='" . E($nm) . "', username='" . E($un) . "', role='$role', member_id=" . ($mid ?: 'NULL') . ", active=" . (empty($b['active']) && isset($b['active']) ? 0 : 1);
        if (array_key_exists('feat_recite', $b)) $set .= ', feat_recite=' . (empty($b['feat_recite']) ? 0 : 1);
        if ($pw !== '') { if (strlen($pw) < 6) fail('كلمة المرور ستة أحرف فأكثر'); $set .= ", pass_hash='" . E(password_hash($pw, PASSWORD_DEFAULT)) . "'"; }
        $conn->query("UPDATE al_users SET $set WHERE id=$id AND family_id=$fid");
    } else {
        if (strlen($pw) < 6) fail('كلمة المرور ستة أحرف فأكثر');
        $conn->query("INSERT INTO al_users (family_id, username, name, pass_hash, role, member_id) VALUES ($fid, '" . E($un) . "', '" . E($nm) . "', '"
            . E(password_hash($pw, PASSWORD_DEFAULT)) . "', '$role', " . ($mid ?: 'NULL') . ")");
        $id = (int)$conn->insert_id;
    }
    al_log($u['id'], 'user_save', ['id' => $id, 'username' => $un, 'role' => $role]);
    out(['success' => true, 'id' => $id]);
}

// ─── التعرّف السحابيّ على التلاوة ───────────────────────────────────────────
// يمرّ الصوت من الجوال إلى المزوّد ويعود نصّاً، ولا يُكتب عندنا في قرصٍ ولا
// قاعدة: لا ملفّ مؤقّت ولا سجلّ يحفظ الصوت. والكلمات المنتظرة تُرسل تلميحاً
// فيميل التعرّف إلى رسم المصحف بدل ما يشبهه من الكلام.
case 'asr': {
    $u = need();
    if (!(int)$u['feat_recite'] && $u['role'] !== 'owner') fail('التسميع الذاتي غير مفعّل لحسابك', 403);
    if (GROQ_KEY === '' || strpos(GROQ_KEY, '__') === 0) fail('التعرّف السحابيّ غير مُعدّ على الخادم', 503);

    $audio = file_get_contents('php://input');
    $n = strlen((string)$audio);
    if ($n < 800) fail('لا صوت');
    if ($n > 3000000) fail('المقطع أكبر من اللازم');
    $type = (string)($_SERVER['CONTENT_TYPE'] ?? 'audio/webm');
    $ext = strpos($type, 'mp4') !== false ? 'mp4' : (strpos($type, 'ogg') !== false ? 'ogg' : 'webm');
    $hint = mb_substr(trim((string)($_GET['hint'] ?? '')), 0, 600);

    $bd = '----alwah' . bin2hex(random_bytes(8));
    $part = function ($name, $val) use ($bd) {
        return "--$bd\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$val\r\n";
    };
    $post = $part('model', 'whisper-large-v3-turbo') . $part('language', 'ar')
        . $part('temperature', '0') . $part('response_format', 'json');
    if ($hint !== '') $post .= $part('prompt', $hint);
    $post .= "--$bd\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.$ext\"\r\n"
        . "Content-Type: $type\r\n\r\n" . $audio . "\r\n--$bd--\r\n";

    if (!function_exists('curl_init')) fail('الخادم لا يدعم الاتصال الخارجي', 500);
    $c = curl_init('https://api.groq.com/openai/v1/audio/transcriptions');
    curl_setopt_array($c, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $post, CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . GROQ_KEY, 'Content-Type: multipart/form-data; boundary=' . $bd],
    ]);
    $res = curl_exec($c);
    $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    unset($post, $audio);                                   // لا يبقى الصوت في الذاكرة بعد الإرسال

    if ($res === false || $code !== 200) {
        // سبب المزوّد كما جاء: مفتاحٌ خطأ أو حدٌّ مستهلك أو غيرهما، فيُعرف الخلل بلا تخمين
        $why = '';
        $e = json_decode((string)$res, true);
        if (isset($e['error']['message'])) $why = ' — ' . mb_substr((string)$e['error']['message'], 0, 120);
        fail('تعذّر التعرّف السحابيّ (' . $code . ')' . $why, 502);
    }
    $j = json_decode((string)$res, true);
    out(['success' => true, 'text' => trim((string)($j['text'] ?? ''))]);
}

// أسرٌ أخرى (لمدير التطبيق): لكل أسرة صاحب حساب، ولا ترى أسرةٌ أخرى
case 'families': {
    $u = need(); if (!(int)$u['is_admin']) fail('لمدير التطبيق فقط', 403);
    out(['success' => true, 'data' => rows("SELECT f.id, f.name, f.created_at,
        (SELECT COUNT(*) FROM al_members m WHERE m.family_id=f.id AND m.deleted=0) members,
        (SELECT username FROM al_users x WHERE x.family_id=f.id AND x.role='owner' ORDER BY id LIMIT 1) owner
        FROM al_families f ORDER BY f.id")]);
}

case 'family_create': {
    $u = need(); if (!(int)$u['is_admin']) fail('لمدير التطبيق فقط', 403);
    $b = body();
    $fam = trim(mb_substr((string)($b['family'] ?? ''), 0, 120));
    $nm = trim((string)($b['name'] ?? '')); $un = strtolower(trim((string)($b['username'] ?? ''))); $pw = (string)($b['password'] ?? '');
    if (mb_strlen($fam) < 2 || mb_strlen($nm) < 2) fail('اسم الأسرة واسم صاحبها مطلوبان');
    if (!preg_match('/^[a-z0-9_.-]{3,40}$/', $un)) fail('اسم الدخول: حروف إنجليزية وأرقام، ٣ أحرف فأكثر');
    if (strlen($pw) < 6) fail('كلمة المرور ستة أحرف فأكثر');
    if (one("SELECT id FROM al_users WHERE username='" . E($un) . "'")) fail('اسم الدخول مستخدم');
    $conn->query("INSERT INTO al_families (name) VALUES ('" . E($fam) . "')");
    $fid = (int)$conn->insert_id;
    $conn->query("INSERT INTO al_users (family_id, username, name, pass_hash, role) VALUES ($fid, '" . E($un) . "', '" . E($nm) . "', '"
        . E(password_hash($pw, PASSWORD_DEFAULT)) . "', 'owner')");
    al_log($u['id'], 'family_create', ['family' => $fid, 'username' => $un]);
    out(['success' => true, 'id' => $fid]);
}

// ─── مصحف الفرد: علامات الأخطاء والتنبيهات ─────────────────────────────────
// ─── إعراب الآية ────────────────────────────────────────────────────────────
// «الجدول في إعراب القرآن وصرفه وبيانه» لمحمود صافي، يُجلب عند الطلب من الباحث
// القرآني (tafsir.app) ولا يُخزَّن عندنا. والوسيط لأنّ الخدمة لا تسمح بالنداء
// المباشر من المتصفّح، والنصّ يُعرض كما هو باسم كتابه ومؤلّفه.
case 'irab': {
    need();
    $s = (int)($_GET['s'] ?? 0); $a = (int)($_GET['a'] ?? 0);
    if ($s < 1 || $s > 114 || $a < 1 || $a > 300) fail('آية غير صحيحة');
    $raw = fetch_text('https://tafsir.app/get.php?src=aljadwal&s=' . $s . '&a=' . $a . '&ver=1');
    if ($raw === null) fail('تعذّر جلب الإعراب الآن');
    $j = json_decode($raw, true);
    $txt = trim((string)($j['data'] ?? ''));
    // النصّ أقسامٌ يبدأ كلٌّ منها بسطرٍ مثل «* الإعراب:»
    $secs = [];
    foreach (preg_split('/\n\s*\*\s+/u', "\n" . $txt) as $part) {
        $part = trim($part);
        if ($part === '') continue;
        $p = explode("\n", $part, 2);
        $h = trim(trim(trim($p[0]), ':'));
        $t = isset($p[1]) ? trim($p[1]) : '';
        if ($t !== '' && mb_strlen($h) <= 40) $secs[] = ['h' => $h, 't' => $t];
    }
    out(['success' => true, 'start' => (int)($j['ayahs_start'] ?? $a), 'count' => max(1, (int)($j['count'] ?? 1)), 'secs' => $secs]);
}

case 'marks_page': {
    $u = need(); $m = member_for($u, $_GET['member_id'] ?? 0);
    $p = max(1, min(PAGES, (int)($_GET['page'] ?? 1)));
    $list = rows("SELECT word_key, err, warn, resolved, last_d FROM al_marks WHERE member_id=" . (int)$m['id'] . " AND page=$p AND (err>0 OR warn>0)");
    foreach ($list as &$x) { $x['err'] = (int)$x['err']; $x['warn'] = (int)$x['warn']; $x['resolved'] = (int)$x['resolved']; }
    unset($x);
    out(['success' => true, 'page' => $p, 'marks' => $list]);
}

// ضغطةٌ على كلمة: خطأ، تنبيه، تراجعٌ عن آخر ضغطة، إتقان، أو مسح
case 'mark': {
    $u = need(); $b = body(); $m = member_for($u, $b['member_id'] ?? 0);
    $mid = (int)$m['id']; $fid = (int)$u['family_id'];
    $wk = (string)($b['word_key'] ?? '');
    if (!preg_match('/^\d{1,3}:\d{1,3}:\d{1,3}$/', $wk)) fail('كلمة غير صحيحة');
    $p = max(1, min(PAGES, (int)($b['page'] ?? 0)));
    $op = (string)($b['op'] ?? '');
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($b['d'] ?? '')) ? $b['d'] : date('Y-m-d');
    $W = E($wk);
    if ($op === 'err' || $op === 'warn') {
        $conn->query("INSERT INTO al_mark_events (family_id, member_id, word_key, page, kind, d, by_user) VALUES ($fid, $mid, '$W', $p, '$op', '" . E($d) . "', " . (int)$u['id'] . ")");
        $conn->query("INSERT INTO al_marks (family_id, member_id, word_key, page, $op, last_d) VALUES ($fid, $mid, '$W', $p, 1, '" . E($d) . "')
                      ON DUPLICATE KEY UPDATE $op = $op + 1, resolved = 0, last_d = VALUES(last_d)");
    } elseif ($op === 'undo') {
        $ev = one("SELECT id, kind FROM al_mark_events WHERE member_id=$mid AND word_key='$W' ORDER BY id DESC LIMIT 1");
        if ($ev) {
            $k = $ev['kind'] === 'warn' ? 'warn' : 'err';
            $conn->query("DELETE FROM al_mark_events WHERE id=" . (int)$ev['id']);
            $conn->query("UPDATE al_marks SET $k = GREATEST(0, $k - 1) WHERE member_id=$mid AND word_key='$W'");
        }
    } elseif ($op === 'resolve') {
        $conn->query("UPDATE al_marks SET resolved = 1 - resolved WHERE member_id=$mid AND word_key='$W'");
    } elseif ($op === 'clear') {
        $conn->query("UPDATE al_marks SET err=0, warn=0, resolved=0 WHERE member_id=$mid AND word_key='$W'");
        al_log($u['id'], 'mark_clear', ['member' => $mid, 'word' => $wk]);
    } else fail('عملية غير معروفة');
    $x = one("SELECT word_key, err, warn, resolved, last_d FROM al_marks WHERE member_id=$mid AND word_key='$W'");
    if ($x) { $x['err'] = (int)$x['err']; $x['warn'] = (int)$x['warn']; $x['resolved'] = (int)$x['resolved']; }
    // من في جلسة الذكر يرى العلامة في نبضته التالية
    $conn->query("UPDATE al_session SET rev = rev + 1 WHERE family_id=$fid");
    out(['success' => true, 'mark' => $x]);
}

// ملخّص مواضع الضعف: أكثر الكلمات خطأً، وأكثر الصفحات، والمجموع
case 'marks_summary': {
    $u = need(); $m = member_for($u, $_GET['member_id'] ?? 0); $mid = (int)$m['id'];
    $tot = one("SELECT COALESCE(SUM(err),0) err, COALESCE(SUM(warn),0) warn, COUNT(*) words FROM al_marks WHERE member_id=$mid AND resolved=0 AND (err>0 OR warn>0)");
    $top = rows("SELECT word_key, page, err, warn, last_d FROM al_marks WHERE member_id=$mid AND resolved=0 AND (err>0 OR warn>0)
                 ORDER BY (err*2 + warn) DESC, last_d DESC LIMIT 12");
    $pages = rows("SELECT page, SUM(err) err, SUM(warn) warn, COUNT(*) words FROM al_marks WHERE member_id=$mid AND resolved=0 AND (err>0 OR warn>0)
                   GROUP BY page ORDER BY (SUM(err)*2 + SUM(warn)) DESC LIMIT 10");
    $mastered = (int)one("SELECT COUNT(*) n FROM al_marks WHERE member_id=$mid AND resolved=1")['n'];
    foreach ($top as &$x) { $x['page'] = (int)$x['page']; $x['err'] = (int)$x['err']; $x['warn'] = (int)$x['warn']; } unset($x);
    foreach ($pages as &$x) { $x['page'] = (int)$x['page']; $x['err'] = (int)$x['err']; $x['warn'] = (int)$x['warn']; $x['words'] = (int)$x['words']; } unset($x);
    out(['success' => true, 'total' => ['err' => (int)$tot['err'], 'warn' => (int)$tot['warn'], 'words' => (int)$tot['words'], 'mastered' => $mastered],
         'top' => $top, 'pages' => $pages]);
}

// علامات يومٍ بحسب الصفحة: منها تُعبّأ أخطاء التسميع لكل جزءٍ من الورد
case 'marks_day': {
    $u = need(); $m = member_for($u, $_GET['member_id'] ?? 0);
    $d = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($_GET['d'] ?? '')) ? $_GET['d'] : date('Y-m-d');
    $list = rows("SELECT page, SUM(kind='err') err, SUM(kind='warn') warn FROM al_mark_events WHERE member_id=" . (int)$m['id'] . " AND d='" . E($d) . "' GROUP BY page");
    foreach ($list as &$x) { $x['page'] = (int)$x['page']; $x['err'] = (int)$x['err']; $x['warn'] = (int)$x['warn']; } unset($x);
    out(['success' => true, 'data' => $list]);
}

// ─── جلسة الذكر: من يُسمِّع، وعلى أيّ صفحة — يراها الجميع ────────────────────
case 'session_set': {
    $u = need_sup(); $b = body(); $fid = (int)$u['family_id'];
    $mid = (int)($b['member_id'] ?? 0);
    if ($mid) member_for($u, $mid);
    $p = max(1, min(PAGES, (int)($b['page'] ?? 1)));
    $conn->query("INSERT INTO al_session (family_id, member_id, page, by_user, rev) VALUES ($fid, " . ($mid ?: 'NULL') . ", $p, " . (int)$u['id'] . ", 1)
                  ON DUPLICATE KEY UPDATE member_id=VALUES(member_id), page=VALUES(page), by_user=VALUES(by_user), rev=rev+1");
    out(['success' => true]);
}

case 'rtc_join': {
    $u = need(); $fid = (int)$u['family_id']; $uid = (int)$u['id'];
    $conn->query("UPDATE al_rtc_peers SET state='left', left_at=NOW() WHERE family_id=$fid AND user_id=$uid AND state='in'");
    $pid = bin2hex(random_bytes(8));
    $b = body();
    $conn->query("INSERT INTO al_rtc_peers (id, family_id, user_id, name, mic, cam) VALUES ('$pid', $fid, $uid, '" . E($u['name']) . "', "
        . (empty($b['mic']) ? 0 : 1) . ", " . (empty($b['cam']) ? 0 : 1) . ")");
    out(['success' => true, 'peer' => $pid, 'name' => $u['name'], 'role' => 'member', 'state' => 'in',
         'ice' => [['urls' => ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']]]]);
}

case 'rtc_poll': {
    $u = need(); $b = body(); $fid = (int)$u['family_id'];
    $pid = preg_replace('/[^a-f0-9]/', '', (string)($b['peer'] ?? ''));
    $me = one("SELECT * FROM al_rtc_peers WHERE id='$pid' AND user_id=" . (int)$u['id'] . " LIMIT 1");
    if (!$me) out(['success' => false, 'state' => 'gone']);
    if ($me['state'] !== 'in') out(['success' => true, 'state' => $me['state']]);
    $f = function ($k) use ($b) { return empty($b[$k]) ? 0 : 1; };
    $fm = $f('mic'); $fc = $f('cam'); $fh = $f('hand'); $fs = $f('share');
    $conn->query("UPDATE al_rtc_peers SET seen_at=NOW(), mic=$fm, cam=$fc, hand=$fh, share=$fs WHERE id='$pid'");
    $since = (int)($b['since'] ?? 0);
    if ($since > 0) $conn->query("DELETE FROM al_rtc_signals WHERE to_peer='$pid' AND id <= $since");
    $sig = [];
    foreach (rows("SELECT id, from_peer, kind, payload FROM al_rtc_signals WHERE to_peer='$pid' AND id > $since ORDER BY id LIMIT 60") as $x) {
        $x['id'] = (int)$x['id']; $x['payload'] = json_decode($x['payload'], true); $sig[] = $x;
    }
    $peers = [];
    foreach (rows("SELECT id, user_id, name, mic, cam, hand, share FROM al_rtc_peers WHERE family_id=$fid AND state='in' AND id <> '$pid'
                   AND seen_at > (NOW() - INTERVAL 20 SECOND) ORDER BY joined_at") as $x) {
        foreach (['mic', 'cam', 'hand', 'share', 'user_id'] as $k) $x[$k] = (int)$x[$k];
        $x['role'] = 'member'; $peers[] = $x;
    }
    if (mt_rand(1, 20) === 1) {
        $conn->query("UPDATE al_rtc_peers SET state='left', left_at=seen_at WHERE state='in' AND seen_at < (NOW() - INTERVAL 60 SECOND)");
        $conn->query("DELETE FROM al_rtc_signals WHERE created_at < (NOW() - INTERVAL 5 MINUTE)");
    }
    out(['success' => true, 'state' => 'in', 'signals' => $sig, 'peers' => $peers, 'waiting' => []]);
}

case 'rtc_signal': {
    $u = need(); $b = body(); $fid = (int)$u['family_id'];
    $pid = preg_replace('/[^a-f0-9]/', '', (string)($b['peer'] ?? ''));
    $me = one("SELECT id FROM al_rtc_peers WHERE id='$pid' AND user_id=" . (int)$u['id'] . " AND state='in' LIMIT 1");
    if (!$me) fail('لست في الجلسة');
    $to = preg_replace('/[^a-f0-9]/', '', (string)($b['to'] ?? ''));
    $kind = preg_replace('/[^a-z]/', '', (string)($b['kind'] ?? ''));
    $payload = json_encode($b['payload'] ?? null, JSON_UNESCAPED_UNICODE);
    if ($to === '' || $kind === '' || strlen($payload) > 65000) fail('رسالة غير صالحة');
    if (!one("SELECT id FROM al_rtc_peers WHERE id='$to' AND family_id=$fid AND state='in' LIMIT 1")) fail('الطرف غادر');
    $conn->query("INSERT INTO al_rtc_signals (family_id, from_peer, to_peer, kind, payload) VALUES ($fid, '$pid', '$to', '$kind', '" . E($payload) . "')");
    out(['success' => true]);
}

case 'rtc_leave': {
    $u = need(); $b = body();
    $pid = preg_replace('/[^a-f0-9]/', '', (string)($b['peer'] ?? ''));
    $conn->query("UPDATE al_rtc_peers SET state='left', left_at=NOW() WHERE id='$pid' AND user_id=" . (int)$u['id'] . " AND state='in'");
    out(['success' => true]);
}

// نبضة الجلسة الخفيفة: من يُسمِّع وأيّ صفحة، وعلاماتها — للمكالمة ولمن يتابع بلا مكالمة
case 'session_get': {
    $u = need(); $fid = (int)$u['family_id'];
    $s = one("SELECT member_id, page, by_user, rev FROM al_session WHERE family_id=$fid");
    $live = rows("SELECT name FROM al_rtc_peers WHERE family_id=$fid AND state='in' AND seen_at > (NOW() - INTERVAL 20 SECOND)");
    $marks = [];
    if ($s && $s['member_id'] && $s['page'] && (is_sup($u) || (int)$u['member_id'] === (int)$s['member_id'])) {
        $marks = rows("SELECT word_key, err, warn, resolved FROM al_marks WHERE member_id=" . (int)$s['member_id'] . " AND page=" . (int)$s['page'] . " AND (err>0 OR warn>0)");
        foreach ($marks as &$x) { $x['err'] = (int)$x['err']; $x['warn'] = (int)$x['warn']; $x['resolved'] = (int)$x['resolved']; } unset($x);
    }
    out(['success' => true, 'session' => $s ? ['member_id' => $s['member_id'] ? (int)$s['member_id'] : null, 'page' => $s['page'] ? (int)$s['page'] : null,
         'rev' => (int)$s['rev']] : null, 'marks' => $marks, 'live' => array_column($live, 'name')]);
}

default:
    fail('إجراء غير معروف');
}
