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

function al_log($uid, $action, $data = null) {
    global $conn;
    $ip = E(trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '')[0]));
    $conn->query("INSERT INTO al_log (user_id, action, data, ip) VALUES (" . ($uid ? (int)$uid : 'NULL') . ", '" . E($action) . "', "
        . ($data !== null ? "'" . E(json_encode($data, JSON_UNESCAPED_UNICODE)) . "'" : 'NULL') . ", '$ip')");
}

// ─── المصحف: بدايات الأجزاء (مصحف المدينة، ٦٠٤ صفحات، ١٥ سطراً) ─────────────
const JUZ_START = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282,
                   302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
const PAGES = 604;
const LPP = 15;
function juz_of($p) { $j = 1; foreach (JUZ_START as $i => $s) if ($p >= $s) $j = $i + 1; return $j; }

// ترتيب الحفظ: الصفحة رقم k (من الصفر) في مسيرة هذا الفرد
function mem_page($dir, $k) { return $dir === 'asc' ? 1 + $k : PAGES - $k; }

// ترتيب المراجعة: من الجزء الثلاثين صعوداً، وصفحات الجزء بترتيب المصحف داخله
// (ولمن يحفظ من الفاتحة: بترتيب المصحف من أوّله)
function rev_key($dir, $p) { return $dir === 'asc' ? $p : (31 - juz_of($p)) * 1000 + $p; }

// ─── الخطة: الموضع، والألواح، والمراجعة ───────────────────────────────────────
// $exclude_d: عند حساب خطة يومٍ نستبعد سجلّه هو، فتبقى الخطة كما كانت قبل تسميعه
function member_plan($m, $exclude_d = null) {
    $mid = (int)$m['id'];
    $ex = $exclude_d ? " AND d <> '" . E($exclude_d) . "'" : '';
    $x = one("SELECT COALESCE(SUM(CASE WHEN new_grade <> 1 THEN new_lines ELSE 0 END),0) s FROM al_logs WHERE member_id=$mid$ex");
    $L = min(PAGES * LPP, (int)$m['init_lines'] + (int)$x['s']);
    $done = intdiv($L, LPP);                 // صفحات أُتمّت
    $part = $done >= PAGES ? 0 : $L % LPP;   // أسطر في الصفحة الجارية
    $dir = $m['dir'] === 'asc' ? 'asc' : 'desc';
    $cur = $done < PAGES ? mem_page($dir, $done) : null;

    // الألواح: الصفحة الجارية (فيها حفظ اليوم) وما قبلها من آخر المحفوظ
    $an = max(1, (int)$m['alwah_n']);
    $alwah = [];
    if ($cur) $alwah[] = $cur;
    for ($k = $done - 1; $k >= 0 && count($alwah) < $an; $k--) $alwah[] = mem_page($dir, $k);
    sort($alwah);

    // دورة المراجعة: كل ما أُتمّ حفظه عدا الألواح
    $seq = [];
    for ($k = 0; $k < $done; $k++) { $p = mem_page($dir, $k); if (!in_array($p, $alwah, true)) $seq[] = $p; }
    usort($seq, function ($a, $b) use ($dir) { return rev_key($dir, $a) <=> rev_key($dir, $b); });

    // تبدأ مراجعة اليوم بعد آخر صفحةٍ رُوجعت فعلاً
    $review = [];
    if ($seq) {
        $last = one("SELECT rev_list FROM al_logs WHERE member_id=$mid AND rev_done=1 AND rev_list IS NOT NULL AND rev_list <> ''$ex
                     ORDER BY d DESC, id DESC LIMIT 1");
        $start = 0;
        if ($last) {
            // الورد يُعرض من جهة البقرة إلى جهة الناس، فآخر ما رُوجع في الدورة هو الصفحة
            // التي لا تليها في الدورة صفحةٌ من الورد نفسه (لا آخر عنصرٍ في القائمة)
            $lst = array_map('intval', explode(',', $last['rev_list']));
            $pos = array_flip($seq); $in = array_flip($lst); $cn = count($seq);
            $lp = end($lst);
            foreach ($lst as $q) {
                if (!isset($pos[$q])) continue;
                $nx = $seq[($pos[$q] + 1) % $cn];
                if (!isset($in[$nx])) { $lp = $q; break; }
            }
            $lk = rev_key($dir, $lp);
            $start = 0;
            foreach ($seq as $i => $p) if (rev_key($dir, $p) > $lk) { $start = $i; break; }
            if (rev_key($dir, end($seq)) <= $lk) $start = 0;      // انتهت الدورة: من أوّلها
        }
        $n = min(max(1, (int)$m['review_n']), count($seq));
        for ($i = 0; $i < $n; $i++) $review[] = $seq[($start + $i) % count($seq)];
    }

    // الورد دائماً نزولاً: يبدأ من جهة البقرة وينتهي بجهة الناس
    $cycle_pos = $seq && $review ? (array_search($review[0], $seq, true) + 1) : 0;
    sort($review);

    // الحفظ الجديد: من السطر التالي في الصفحة الجارية
    $tl = max(1, (int)$m['target_lines']);
    return [
        'lines' => $L, 'pages_done' => $done, 'part_lines' => $part,
        'memorized_pages' => round($L / LPP, 2), 'juz' => round($L / LPP / 20, 2),
        'current' => $cur, 'new' => $cur ? ['page' => $cur, 'from_line' => $part + 1, 'lines' => $tl] : null,
        'alwah' => $alwah, 'review' => $review, 'cycle' => count($seq),
        'cycle_pos' => $cycle_pos,
        'juz_map' => juz_map($dir, $L),
    ];
}

// نسبة المحفوظ من كل جزء (للخريطة)
function juz_map($dir, $L) {
    $done = intdiv($L, LPP); $part = $L % LPP;
    $cnt = array_fill(1, 30, 0.0);
    for ($k = 0; $k < min($done, PAGES); $k++) $cnt[juz_of(mem_page($dir, $k))] += 1;
    if ($done < PAGES && $part) $cnt[juz_of(mem_page($dir, $done))] += $part / LPP;
    $out = [];
    for ($j = 1; $j <= 30; $j++) {
        $size = ($j < 30 ? JUZ_START[$j] : PAGES + 1) - JUZ_START[$j - 1];
        $out[] = round(min(1, $cnt[$j] / $size), 3);
    }
    return $out;
}

// ─── الإحصاءات ──────────────────────────────────────────────────────────────
function day_score($l) { return (((int)$l['new_lines'] > 0 && (int)$l['new_grade'] !== 1) ? 1 : 0) + ((int)$l['alwah_done'] ? 1 : 0) + ((int)$l['rev_done'] ? 1 : 0); }
function member_stats($mid) {
    $logs = rows("SELECT d, new_lines, new_grade, new_err, new_warn, alwah_done, alwah_grade, alwah_err, rev_done, rev_grade, rev_err
                  FROM al_logs WHERE member_id=" . (int)$mid . " AND d >= CURDATE() - INTERVAL 120 DAY ORDER BY d DESC");
    $byd = [];
    foreach ($logs as $l) $byd[$l['d']] = $l;
    // أيامٌ متتالية: تُحسب من اليوم، أو من أمس إن لم يُسمَّع اليوم بعد
    $streak = 0; $t = time();
    $d0 = date('Y-m-d', $t);
    if (!isset($byd[$d0]) || !day_score($byd[$d0])) $t -= 86400;
    while (true) { $d = date('Y-m-d', $t); if (isset($byd[$d]) && day_score($byd[$d]) > 0) { $streak++; $t -= 86400; } else break; }
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
    if ($id) { $x = one("SELECT id, family_id, username, name, role, member_id, is_admin, active FROM al_users WHERE id=$id LIMIT 1");
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
    foreach (['id', 'init_lines', 'target_lines', 'alwah_n', 'review_n', 'sort'] as $k) $m[$k] = (int)$m[$k];
    unset($m['deleted'], $m['family_id']);
    return $m;
}
function clean_log($l) {
    if (!$l) return null;
    foreach (['id', 'member_id', 'new_page', 'new_lines', 'new_grade', 'new_err', 'new_warn', 'alwah_done', 'alwah_grade', 'alwah_err', 'alwah_warn',
              'rev_done', 'rev_grade', 'rev_err', 'rev_warn', 'recorded_by'] as $k) if (isset($l[$k])) $l[$k] = $l[$k] === null ? null : (int)$l[$k];
    $l['alwah_list'] = $l['alwah_list'] ? array_map('intval', explode(',', $l['alwah_list'])) : [];
    $l['rev_list'] = $l['rev_list'] ? array_map('intval', explode(',', $l['rev_list'])) : [];
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
    foreach (['id', 'family_id', 'member_id', 'is_admin'] as $k) $u[$k] = $u[$k] === null ? null : (int)$u[$k];
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
        $p = member_plan($m); $s = member_stats($m['id']);
        $list[] = clean_member($m) + ['plan' => $p, 'streak' => $s['streak'], 'week_lines' => $s['week_lines'],
                                      'today' => clean_log($s['today'])];
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
    out(['success' => true, 'member' => clean_member($m), 'plan' => member_plan($m, $today), 'now' => member_plan($m),
         'stats' => member_stats($m['id']), 'history' => $hist]);
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
    $set = "name='" . E($nm) . "', gender='$g', color='" . E($col) . "', dir='$dir', init_lines=$init, target_lines=$tl, alwah_n=$an, review_n=$rn";
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
    out(['success' => true, 'member' => clean_member($m), 'd' => $d, 'log' => clean_log($l), 'plan' => member_plan($m, $d)]);
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
    $u = need_owner(); $nm = trim(mb_substr((string)(body()['name'] ?? ''), 0, 120));
    if (mb_strlen($nm) < 2) fail('اسم الأسرة مطلوب');
    $conn->query("UPDATE al_families SET name='" . E($nm) . "' WHERE id=" . (int)$u['family_id']);
    out(['success' => true]);
}

case 'users': {
    $u = need_owner();
    $list = rows("SELECT id, username, name, role, member_id, active, last_login FROM al_users WHERE family_id=" . (int)$u['family_id'] . " ORDER BY id");
    foreach ($list as &$x) { $x['id'] = (int)$x['id']; $x['member_id'] = $x['member_id'] === null ? null : (int)$x['member_id']; $x['active'] = (int)$x['active']; }
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
