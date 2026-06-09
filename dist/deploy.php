<?php
// ─── سماك - نشر تلقائي من GitHub ───────────────────────────────
// يُستدعى تلقائياً من GitHub كلما اتحدث فرع dist

// القيم تُقرأ من ملف .deploy-config.php على السيرفر (مو في git)
$cfg = file_exists(__DIR__ . '/.deploy-config.php')
     ? include(__DIR__ . '/.deploy-config.php')
     : [];

define('WEBHOOK_SECRET', $cfg['secret'] ?? '');
define('GITHUB_TOKEN',   $cfg['token']  ?? '');
define('GITHUB_REPO',    'afalbadi-byte/Semak');
define('DEPLOY_BRANCH',  'dist');
define('DEPLOY_DIR',     __DIR__);

// ── التحقق من توقيع GitHub ──────────────────────────────────────
$payload   = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$expected  = 'sha256=' . hash_hmac('sha256', $payload, WEBHOOK_SECRET);

if (!hash_equals($expected, $sigHeader)) {
    http_response_code(403);
    die(json_encode(['error' => 'Invalid signature']));
}

$data = json_decode($payload, true);

// ── فقط على push لفرع dist ─────────────────────────────────────
if (($data['ref'] ?? '') !== 'refs/heads/' . DEPLOY_BRANCH) {
    die(json_encode(['status' => 'skipped', 'reason' => 'not dist branch']));
}

// ── تحميل الزيب من GitHub ──────────────────────────────────────
$zipUrl = "https://api.github.com/repos/" . GITHUB_REPO . "/zipball/" . DEPLOY_BRANCH;
$ch = curl_init($zipUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . GITHUB_TOKEN,
        'User-Agent: SemakAutoDeploy/1.0',
        'Accept: application/vnd.github+json',
    ],
    CURLOPT_TIMEOUT => 120,
]);
$zipData  = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$zipData) {
    http_response_code(500);
    die(json_encode(['error' => "Download failed (HTTP $httpCode)"]));
}

// ── حفظ الزيب مؤقتاً ──────────────────────────────────────────
$tmpZip = sys_get_temp_dir() . '/semak_deploy_' . time() . '.zip';
file_put_contents($tmpZip, $zipData);

// ── فك الضغط إلى public_html ───────────────────────────────────
$zip = new ZipArchive();
if ($zip->open($tmpZip) !== true) {
    unlink($tmpZip);
    die(json_encode(['error' => 'Cannot open zip']));
}

$deployed = 0;
for ($i = 0; $i < $zip->numFiles; $i++) {
    $name = $zip->getNameIndex($i);

    // GitHub يلف الملفات في مجلد مثل "afalbadi-byte-Semak-abc123/"
    // نتجاهل الجزء الأول
    $slashPos = strpos($name, '/');
    if ($slashPos === false) continue;
    $relative = substr($name, $slashPos + 1);

    if (!$relative || substr($relative, -1) === '/') continue; // مجلدات

    // لا تلمس deploy.php نفسه عشان ما يتكتب فوقه
    if (basename($relative) === 'deploy.php') continue;

    $target = DEPLOY_DIR . '/' . $relative;
    $dir    = dirname($target);

    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents($target, $zip->getFromIndex($i));
    $deployed++;
}

$zip->close();
unlink($tmpZip);

echo json_encode([
    'success'     => true,
    'files'       => $deployed,
    'deployed_at' => date('Y-m-d H:i:s'),
]);
