<?php
// deploy: 2026-06-07-v437
if (function_exists('opcache_reset')) opcache_reset();
ob_start();

$__o = $_SERVER['HTTP_ORIGIN'] ?? '';
header(in_array($__o, ['https://semak.sa','https://www.semak.sa','https://semak.icu','http://localhost:5173','http://localhost:5174'], true)
    ? "Access-Control-Allow-Origin: $__o"
    : "Access-Control-Allow-Origin: https://semak.sa");
header("Vary: Origin");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { http_response_code(200); exit(0); }

$db_host = "localhost";
$db_user = "__DB_USER__";
$db_pass = "__DB_PASS__";
$db_name = "__DB_NAME__";

mysqli_report(MYSQLI_REPORT_OFF);
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
    ob_end_clean();
    die(json_encode(["success" => false, "message" => "فشل الاتصال بقاعدة البيانات"]));
}
$conn->set_charset("utf8mb4");
// ─── fingerprint العميل (IP + User-Agent) — متاح عالمياً ─────────────────
$_clientIp = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '')[0]);
$_clientUa = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 250);
define('MOTTASL_TOKEN', '__MOTTASL_TOKEN__');

// ─── إعدادات الشركة (تُحمَّل مرة واحدة لكل طلب — متاحة عالمياً) ────────────
// tenant_id يُحدَّد من JWT إن وُجد، وإلا يبقى 1 (الإنتاج الافتراضي).
// نُحمّل مبكرًا كي تستخدمها الدوال (email_template / send_login_otp …).
$_tenantId_early = 1; // placeholder — سيُحدَّث بعد حل JWT
$_tenantSettings = [];
$_sq = $conn->query("SELECT skey,sval FROM acc_settings WHERE tenant_id=1");
if ($_sq) { while ($_sr = $_sq->fetch_assoc()) $_tenantSettings[$_sr['skey']] = $_sr['sval']; }
$_tenantName  = $_tenantSettings['company_name']  ?? 'سماك العقارية';
$_tenantPhone = $_tenantSettings['company_phone'] ?? '';
$_tenantColor = $_tenantSettings['primary_color'] ?? '#c5a059';

// ─── JWT — مصادقة موحّدة (HS256 بدون مكتبة خارجية) ─────────────────────────
// TOKEN_SECRET  : لإصدار/التحقق من رموز الموظفين والمستأجرين
// PLATFORM_SECRET: لإصدار/التحقق من رموز مدير المنصة فقط
// كلاهما يُحقن من GitHub Secrets وقت النشر (sed). يحتفظ بقيمة dev محليًا.
$_ts = '__TOKEN_SECRET__';
$_ps = '__PLATFORM_SECRET__';
define('TOKEN_SECRET',    (strlen($_ts) > 0 && $_ts[0] === '_') ? 'semak-jwt-dev-2026'       : $_ts);
define('PLATFORM_SECRET', (strlen($_ps) > 0 && $_ps[0] === '_') ? 'semak-platform-dev-2026'  : $_ps);
$_pe = '__PLATFORM_EMAIL__';
$_ph = '__PLATFORM_HASH__';
define('PLATFORM_EMAIL', (strlen($_pe) > 0 && $_pe[0] === '_') ? ''  : $_pe);
define('PLATFORM_HASH',  (strlen($_ph) > 0 && $_ph[0] === '_') ? ''  : $_ph);
unset($_ts, $_ps, $_pe, $_ph);

// ─── إضافة عمود متوافقة مع MySQL وMariaDB معاً ────────────────────────────────
// صيغة ADD COLUMN IF NOT EXISTS تعمل على MariaDB فقط — MySQL يرفضها بصمت.
// معرّفة قبل بوابات الإصدارات حتى تكون متاحة لأي بوابة تنفذ.
function ensure_column($conn, $table, $col, $ddl) {
    $t = $conn->real_escape_string($table);
    $c = $conn->real_escape_string($col);
    $r = $conn->query("SELECT 1 FROM information_schema.COLUMNS
                       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$t' AND COLUMN_NAME='$c' LIMIT 1");
    if ($r && $r->num_rows === 0) $conn->query("ALTER TABLE `$t` ADD COLUMN $ddl");
}

// ─── DDL migrations: runs once per schema version (skips on every subsequent request) ──
$conn->query("CREATE TABLE IF NOT EXISTS db_schema_version (
    id         INT NOT NULL PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");
$__sv = (int)((($__r = $conn->query("SELECT id FROM db_schema_version ORDER BY id DESC LIMIT 1")) && ($__row = $__r->fetch_assoc())) ? $__row['id'] : 0);
if ($__sv < 1) {
// ─── auto-migrate: status columns on inspections ─────────────────────────────
ensure_column($conn, "inspections", "status", "status VARCHAR(50) DEFAULT NULL");
ensure_column($conn, "inspections", "client_submitted_at", "client_submitted_at DATETIME DEFAULT NULL");

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

// ─── auto-migrate: إعدادات الربط (كوكي جلسة دفترة وغيره) ────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS daftra_config (
    k          VARCHAR(64) PRIMARY KEY,
    v          LONGTEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// مُساعد: استرجاع كوكي جلسة دفترة (من قاعدة البيانات أولاً ثم من السيكرت)
function daftra_session_cookie($conn) {
    $r = $conn->query("SELECT v FROM daftra_config WHERE k='session_cookie' LIMIT 1");
    if ($r && ($row = $r->fetch_assoc()) && !empty(trim($row['v']))) return trim($row['v']);
    return "__DAFTRA_SESSION__";
}

// ═══════════════════════════════════════════════════════════════════════════
// محرّك المحاسبة المستقل (Semak Ledger) — قاعدة بياناتنا، كودنا، صفر دفترة
// multi-tenant جاهز للترخيص والبيع
// ═══════════════════════════════════════════════════════════════════════════

// دليل الحسابات
$conn->query("CREATE TABLE IF NOT EXISTS acc_accounts (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id  INT NOT NULL DEFAULT 1,
    code       VARCHAR(32) NOT NULL,
    name       VARCHAR(255) NOT NULL,
    type       ENUM('asset','liability','equity','revenue','expense') NOT NULL,
    parent_id  INT DEFAULT NULL,
    is_group   TINYINT(1) DEFAULT 0,
    status     TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    UNIQUE KEY uniq_code (tenant_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// رؤوس القيود
$conn->query("CREATE TABLE IF NOT EXISTS acc_entries (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id    INT NOT NULL DEFAULT 1,
    entry_no     VARCHAR(32),
    date         DATE NOT NULL,
    description  TEXT,
    ref_type     VARCHAR(40) DEFAULT NULL,
    ref_id       INT DEFAULT NULL,
    total_debit  DECIMAL(16,2) DEFAULT 0,
    total_credit DECIMAL(16,2) DEFAULT 0,
    is_posted    TINYINT(1) DEFAULT 1,
    created_by   VARCHAR(128) DEFAULT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_date (tenant_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// بنود القيود (مدين/دائن)
$conn->query("CREATE TABLE IF NOT EXISTS acc_lines (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id      INT NOT NULL DEFAULT 1,
    entry_id       INT NOT NULL,
    account_id     INT NOT NULL,
    debit          DECIMAL(16,2) DEFAULT 0,
    credit         DECIMAL(16,2) DEFAULT 0,
    cost_center_id INT DEFAULT NULL,
    description    VARCHAR(512) DEFAULT NULL,
    INDEX idx_entry (entry_id),
    INDEX idx_account (tenant_id, account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── أبعاد إضافية على البنود: الطرف (عميل/مورد) وتاريخ الاستحقاق (للذمم والأعمار) ─
ensure_column($conn, "acc_lines", "party_type", "party_type VARCHAR(12) DEFAULT NULL");
ensure_column($conn, "acc_lines", "party_id", "party_id INT DEFAULT NULL");
ensure_column($conn, "acc_lines", "due_date", "due_date DATE DEFAULT NULL");
$conn->query("ALTER TABLE acc_lines ADD INDEX IF NOT EXISTS idx_party (tenant_id, party_type, party_id)");

// الأطراف: دفتر مساعد للعملاء والموردين (ذمم مدينة/دائنة)
$conn->query("CREATE TABLE IF NOT EXISTS acc_parties (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT NOT NULL DEFAULT 1,
    type        ENUM('customer','supplier') NOT NULL,
    name        VARCHAR(255) NOT NULL,
    vat_number  VARCHAR(20)  DEFAULT NULL,
    cr_number   VARCHAR(30)  DEFAULT NULL,
    phone       VARCHAR(40)  DEFAULT NULL,
    email       VARCHAR(120) DEFAULT NULL,
    address     VARCHAR(512) DEFAULT NULL,
    daftra_id   VARCHAR(40)  DEFAULT NULL,
    status      TINYINT(1)   DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_type (tenant_id, type),
    INDEX idx_daftra (tenant_id, daftra_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
// توسيع نوع الطرف ليشمل "شريك" (جاري شركاء) — يُنفَّذ مرة واحدة فقط عند غيابه
$__pt = $conn->query("SELECT COLUMN_TYPE ct FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='acc_parties' AND COLUMN_NAME='type'");
if ($__pt && ($__ptr = $__pt->fetch_assoc()) && strpos($__ptr['ct'], "'partner'") === false) {
    $conn->query("ALTER TABLE acc_parties MODIFY COLUMN type ENUM('customer','supplier','partner') NOT NULL");
}
// إضافة حقل الملاحظات للأطراف (ترحيل تلقائي مرة واحدة)
ensure_column($conn, "acc_parties", "notes", "notes TEXT DEFAULT NULL");

// بوابة المشترين: هوية وطنية + معرّف طرف محاسبي على جدول owners
ensure_column($conn, "owners", "national_id", "national_id VARCHAR(12) DEFAULT NULL");
ensure_column($conn, "owners", "party_id", "party_id INT DEFAULT NULL");
ensure_column($conn, "owners", "project_label", "project_label VARCHAR(200) DEFAULT NULL");
// إضافة tenant_id للجداول القديمة (ترحيل آمن — القيم الموجودة تُعيَّن للمستأجر 1)
ensure_column($conn, "projects", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "units", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "owners", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "maintenance", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "leads", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "inspections", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
$conn->query("CREATE INDEX IF NOT EXISTS idx_projects_tid     ON projects(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_units_tid        ON units(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_maintenance_tid  ON maintenance(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_leads_tid        ON leads(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_inspections_tid  ON inspections(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_owners_natid     ON owners(national_id)");
// جدول طلبات الشراء (Leads) للراغبين في الشراء من بوابة العملاء
$conn->query("CREATE TABLE IF NOT EXISTS acc_leads (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(30)  NOT NULL,
    national_id VARCHAR(12)  DEFAULT NULL,
    unit_code   VARCHAR(40)  DEFAULT NULL,
    project_id  INT          DEFAULT NULL,
    notes       TEXT         DEFAULT NULL,
    status      ENUM('new','contacted','reserved','closed') DEFAULT 'new',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// مراكز التكلفة
$conn->query("CREATE TABLE IF NOT EXISTS acc_cost_centers (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT NOT NULL DEFAULT 1,
    code        VARCHAR(32)  DEFAULT NULL,
    name        VARCHAR(255) NOT NULL,
    parent_id   INT DEFAULT NULL,
    status      TINYINT(1) DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// الفترات المالية (لمنع الترحيل في فترة مقفلة والإقفال السنوي)
$conn->query("CREATE TABLE IF NOT EXISTS acc_periods (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT NOT NULL DEFAULT 1,
    fy          INT NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    is_closed   TINYINT(1) DEFAULT 0,
    closed_at   DATETIME DEFAULT NULL,
    closed_by   VARCHAR(128) DEFAULT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_fy (tenant_id, fy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// أرقام تسلسلية آمنة للتزامن (قيود/فواتير/سندات)
$conn->query("CREATE TABLE IF NOT EXISTS acc_sequences (
    tenant_id INT NOT NULL,
    kind      VARCHAR(20) NOT NULL,
    yr        INT NOT NULL,
    last_no   INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, kind, yr)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// سجل التدقيق المحاسبي
$conn->query("CREATE TABLE IF NOT EXISTS acc_audit_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT NOT NULL DEFAULT 1,
    entity      VARCHAR(40) NOT NULL,
    entity_id   INT DEFAULT NULL,
    action      VARCHAR(20) NOT NULL,
    detail      TEXT,
    actor       VARCHAR(128) DEFAULT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entity (tenant_id, entity, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── التنبيهات (إشعارات داخل اللوحة) ──────────────────────────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT NOT NULL DEFAULT 1,
    user_id     INT DEFAULT NULL,
    type        VARCHAR(40)  DEFAULT 'info',
    title       VARCHAR(255) NOT NULL,
    body        VARCHAR(1024) DEFAULT NULL,
    link        VARCHAR(255) DEFAULT NULL,
    is_read     TINYINT(1) DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (tenant_id, user_id, is_read),
    INDEX idx_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── التحقق بخطوتين عند دخول الموظفين (OTP) — اختياري لكل مستخدم ──────────────
// twofa = 0 افتراضيًا ⇒ لا يتغيّر سلوك الدخول لأحد حتى يُفعّله المستخدم بنفسه.
ensure_column($conn, 'users', 'twofa',                'twofa TINYINT(1) DEFAULT 0');
ensure_column($conn, 'users', 'twofa_channel',        "twofa_channel VARCHAR(10) DEFAULT 'email'");
ensure_column($conn, 'users', 'must_change_password', 'must_change_password TINYINT(1) NOT NULL DEFAULT 0');
$conn->query("CREATE TABLE IF NOT EXISTS login_otp (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    ticket      CHAR(32) NOT NULL,
    code        VARCHAR(10) NOT NULL,
    channel     VARCHAR(10) DEFAULT 'email',
    attempts    INT DEFAULT 0,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticket (ticket),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$conn->query("CREATE TABLE IF NOT EXISTS trusted_devices (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    token_hash  CHAR(64) NOT NULL,
    label       VARCHAR(160) DEFAULT NULL,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dev_user (user_id),
    INDEX idx_dev_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── دخول موحّد بالـ OTP لكل البوابات ─────────────────────────────────────────
// القناة تتبع نوع المُعرّف: جوال⇒واتساب، إيميل⇒إيميل، هوية/وحدة⇒يختار المستخدم.
// scope يفصل بين الموظفين (users) والعملاء (owners) أمنيًا — لا تداخل صلاحيات.
$conn->query("CREATE TABLE IF NOT EXISTS auth_otp (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    ticket      CHAR(32) NOT NULL,
    scope       VARCHAR(12) NOT NULL,
    ref_id      INT DEFAULT NULL,
    ref_key     VARCHAR(60) DEFAULT NULL,
    code        VARCHAR(10) DEFAULT NULL,
    channel     VARCHAR(10) DEFAULT NULL,
    dest_email  VARCHAR(190) DEFAULT NULL,
    dest_phone  VARCHAR(30) DEFAULT NULL,
    attempts    INT DEFAULT 0,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auth_ticket (ticket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// كتالوج المنتجات/الخدمات (بيانات مرجعية مرحَّلة من دفترة)
$conn->query("CREATE TABLE IF NOT EXISTS acc_products (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id    INT NOT NULL DEFAULT 1,
    daftra_id    VARCHAR(40)  DEFAULT NULL,
    code         VARCHAR(80)  DEFAULT NULL,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    unit_price   DECIMAL(15,2) DEFAULT 0,
    buy_price    DECIMAL(15,2) DEFAULT 0,
    tax_rate     DECIMAL(6,3)  DEFAULT 0,
    barcode      VARCHAR(80)  DEFAULT NULL,
    track_stock  TINYINT(1)   DEFAULT 0,
    stock_balance DECIMAL(15,3) DEFAULT 0,
    unit         VARCHAR(40)  DEFAULT NULL,
    status       TINYINT(1)   DEFAULT 1,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prod_tenant (tenant_id),
    INDEX idx_prod_daftra (tenant_id, daftra_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── نظام الوسوم (Tags) — قابلة للإنشاء والتلوين والفلترة على أي كيان ─────────
$conn->query("CREATE TABLE IF NOT EXISTS acc_tags (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT NOT NULL DEFAULT 1,
    name        VARCHAR(80)  NOT NULL,
    color       VARCHAR(20)  DEFAULT 'slate',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_tag (tenant_id, name),
    INDEX idx_tag_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
// ربط الوسوم بالكيانات (فاتورة/طرف/منتج/مصروف...) — علاقة كثير-لكثير
$conn->query("CREATE TABLE IF NOT EXISTS acc_tag_links (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT NOT NULL DEFAULT 1,
    tag_id      INT NOT NULL,
    entity      VARCHAR(40) NOT NULL,
    entity_id   INT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_link (tenant_id, tag_id, entity, entity_id),
    INDEX idx_link_entity (tenant_id, entity, entity_id),
    INDEX idx_link_tag (tenant_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── المستندات المستقلة: الفواتير وبنودها والسندات (Phase 3) ────────────────
// رؤوس الفواتير (مبيعات/مشتريات) — مع حقول ZATCA Phase-2 جاهزة
$conn->query("CREATE TABLE IF NOT EXISTS acc_invoices (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id     INT NOT NULL DEFAULT 1,
    doc_type      ENUM('sales','purchase') NOT NULL DEFAULT 'sales',
    invoice_type  ENUM('standard','simplified') NOT NULL DEFAULT 'simplified',
    doc_kind      ENUM('invoice','credit_note','debit_note') NOT NULL DEFAULT 'invoice',
    invoice_no    VARCHAR(40)  DEFAULT NULL,
    party_id      INT          DEFAULT NULL,
    party_name    VARCHAR(255) DEFAULT NULL,
    issue_date    DATE NOT NULL,
    due_date      DATE         DEFAULT NULL,
    currency      VARCHAR(8)   DEFAULT 'SAR',
    gl_account_id INT          DEFAULT NULL,
    subtotal      DECIMAL(16,2) DEFAULT 0,
    discount      DECIMAL(16,2) DEFAULT 0,
    tax_total     DECIMAL(16,2) DEFAULT 0,
    total         DECIMAL(16,2) DEFAULT 0,
    paid          DECIMAL(16,2) DEFAULT 0,
    status        ENUM('draft','posted','partial','paid','void') NOT NULL DEFAULT 'draft',
    entry_id      INT          DEFAULT NULL,
    notes         VARCHAR(1024) DEFAULT NULL,
    uuid          CHAR(36)     DEFAULT NULL,
    icv           BIGINT       DEFAULT NULL,
    pih           VARCHAR(120) DEFAULT NULL,
    invoice_hash  VARCHAR(120) DEFAULT NULL,
    qr_base64     TEXT         DEFAULT NULL,
    signed_xml    MEDIUMTEXT   DEFAULT NULL,
    zatca_status  VARCHAR(20)  DEFAULT NULL,
    zatca_response MEDIUMTEXT  DEFAULT NULL,
    created_by    VARCHAR(128) DEFAULT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_type (tenant_id, doc_type, status),
    INDEX idx_party (tenant_id, party_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// بنود الفواتير
$conn->query("CREATE TABLE IF NOT EXISTS acc_invoice_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT NOT NULL DEFAULT 1,
    invoice_id  INT NOT NULL,
    product_id  INT DEFAULT NULL,
    description VARCHAR(512) NOT NULL,
    qty         DECIMAL(16,3) DEFAULT 1,
    unit_price  DECIMAL(16,2) DEFAULT 0,
    discount    DECIMAL(16,2) DEFAULT 0,
    tax_rate    DECIMAL(6,2)  DEFAULT 15,
    net_amount  DECIMAL(16,2) DEFAULT 0,
    tax_amount  DECIMAL(16,2) DEFAULT 0,
    line_total  DECIMAL(16,2) DEFAULT 0,
    INDEX idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// السندات: قبض (من عميل) / صرف (لمورد)
$conn->query("CREATE TABLE IF NOT EXISTS acc_payments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id           INT NOT NULL DEFAULT 1,
    pay_type            ENUM('receipt','payment') NOT NULL,
    pay_no              VARCHAR(40) DEFAULT NULL,
    party_id            INT DEFAULT NULL,
    invoice_id          INT DEFAULT NULL,
    date                DATE NOT NULL,
    amount              DECIMAL(16,2) NOT NULL,
    method              ENUM('cash','bank') DEFAULT 'cash',
    treasury_account_id INT DEFAULT NULL,
    entry_id            INT DEFAULT NULL,
    notes               VARCHAR(512) DEFAULT NULL,
    created_by          VARCHAR(128) DEFAULT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id, pay_type),
    INDEX idx_party (tenant_id, party_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// إعدادات المنشأة (ملف الشركة) — مفتاح/قيمة لكل تينانت — تُستخدم في ZATCA والطباعة
$conn->query("CREATE TABLE IF NOT EXISTS acc_settings (
    tenant_id INT NOT NULL DEFAULT 1,
    skey      VARCHAR(64) NOT NULL,
    sval      TEXT DEFAULT NULL,
    PRIMARY KEY (tenant_id, skey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// اعتماد هيئة الزكاة (ZATCA) وحالة الفوترة لكل منشأة — مفتاح/شهادة/عدّاد ICV/سلسلة PIH
// ملاحظة أمنية: المفتاح الخاص يُخزَّن هنا للتشغيل الذاتي؛ نقل ذلك لتخزين مُشفّر منفصل لاحقًا قبل الإنتاج.
$conn->query("CREATE TABLE IF NOT EXISTS acc_zatca (
    tenant_id          INT PRIMARY KEY,
    environment        ENUM('simulation','sandbox','production') NOT NULL DEFAULT 'simulation',
    egs_serial         VARCHAR(160) DEFAULT NULL,
    private_key        MEDIUMTEXT   DEFAULT NULL,
    csr                MEDIUMTEXT   DEFAULT NULL,
    compliance_cert    MEDIUMTEXT   DEFAULT NULL,
    compliance_secret  VARCHAR(255) DEFAULT NULL,
    compliance_request_id VARCHAR(80) DEFAULT NULL,
    production_cert    MEDIUMTEXT   DEFAULT NULL,
    production_secret  VARCHAR(255) DEFAULT NULL,
    production_request_id VARCHAR(80) DEFAULT NULL,
    last_icv           BIGINT       NOT NULL DEFAULT 0,
    last_pih           VARCHAR(120) DEFAULT NULL,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$conn->query("REPLACE INTO db_schema_version (id) VALUES (1)");
} // end DDL v1

if ($__sv < 2) {
// ─── v2: عمدة مستوى الخطورة + IP + UA + diff + tamper-hash ──────────────
ensure_column($conn, "acc_audit_log", "ip_address", "ip_address VARCHAR(45)      DEFAULT NULL AFTER actor");
ensure_column($conn, "acc_audit_log", "user_agent", "user_agent VARCHAR(250)     DEFAULT NULL AFTER ip_address");
ensure_column($conn, "acc_audit_log", "old_data", "old_data MEDIUMTEXT       DEFAULT NULL AFTER user_agent");
ensure_column($conn, "acc_audit_log", "new_data", "new_data MEDIUMTEXT       DEFAULT NULL AFTER old_data");
ensure_column($conn, "acc_audit_log", "risk_level", "risk_level TINYINT UNSIGNED DEFAULT 1   AFTER new_data");
ensure_column($conn, "acc_audit_log", "row_hash", "row_hash VARCHAR(64)      DEFAULT NULL AFTER risk_level");
$conn->query("ALTER TABLE acc_audit_log ADD INDEX IF NOT EXISTS idx_risk (tenant_id, risk_level)");
$conn->query("REPLACE INTO db_schema_version (id) VALUES (2)");
} // end DDL v2

if ($__sv < 3) {
// ─── v3: SaaS — جدول المستأجرين + tenant_id على users ──────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS tenants (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    slug          VARCHAR(60)  NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    plan          ENUM('trial','starter','pro','enterprise') DEFAULT 'trial',
    status        ENUM('active','suspended','cancelled') DEFAULT 'active',
    trial_ends    DATE DEFAULT NULL,
    owner_email   VARCHAR(255) NOT NULL,
    owner_name    VARCHAR(255) NOT NULL,
    phone         VARCHAR(40)  DEFAULT NULL,
    cr_number     VARCHAR(30)  DEFAULT NULL,
    vat_number    VARCHAR(20)  DEFAULT NULL,
    logo_url      VARCHAR(512) DEFAULT NULL,
    domain        VARCHAR(120) DEFAULT NULL,
    primary_color VARCHAR(20)  DEFAULT '#c5a059',
    max_users     SMALLINT     DEFAULT 5,
    notes         TEXT         DEFAULT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug   (slug),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
// إدراج مستأجر سماك الأصلي (tenant_id=1) — لا يُعاد إدراجه إن وُجد
$conn->query("INSERT IGNORE INTO tenants (id,slug,name,owner_email,owner_name,status,plan)
              VALUES (1,'semak','سماك العقارية','admin@semak.sa','سماك العقارية','active','enterprise')");
// ربط المستخدمين بمستأجريهم
ensure_column($conn, "users", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
$conn->query("ALTER TABLE users ADD INDEX    IF NOT EXISTS idx_user_tenant (tenant_id)");
$conn->query("REPLACE INTO db_schema_version (id) VALUES (3)");
} // end DDL v3

if ($__sv < 4) {
// ─── v4: بوابة التقنية — جداول sw_* ──────────────────────────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS sw_clients (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    company    VARCHAR(255),
    email      VARCHAR(255),
    phone      VARCHAR(30),
    notes      TEXT,
    status     VARCHAR(20) DEFAULT 'prospect',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS sw_tickets (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    client_id   INT,
    client_name VARCHAR(255),
    subject     VARCHAR(500) NOT NULL,
    body        TEXT,
    status      VARCHAR(30) DEFAULT 'open',
    priority    VARCHAR(20) DEFAULT 'medium',
    assigned_to INT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_st_client (client_id),
    INDEX idx_st_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS sw_ticket_replies (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id   INT NOT NULL,
    user_id     INT,
    user_name   VARCHAR(255),
    body        TEXT NOT NULL,
    is_internal TINYINT(1) DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_str_ticket (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS sw_products (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    type          VARCHAR(50) DEFAULT 'subscription',
    price         DECIMAL(15,2) DEFAULT 0,
    billing_cycle VARCHAR(30) DEFAULT 'yearly',
    description   TEXT,
    active        TINYINT(1) DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS sw_invoices (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    client_id   INT,
    client_name VARCHAR(255),
    product_id  INT,
    product_name VARCHAR(255),
    invoice_no  VARCHAR(50),
    amount      DECIMAL(15,2) DEFAULT 0,
    status      VARCHAR(20) DEFAULT 'draft',
    issue_date  DATE,
    due_date    DATE,
    paid_date   DATE,
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_si_client (client_id),
    INDEX idx_si_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("REPLACE INTO db_schema_version (id) VALUES (4)");
} // end DDL v4

if ($__sv < 5) {
// ─── v5: tenant_id لجداول بوابة التقنية + جدولا الخطط والاشتراكات ──────────
// إصلاح أمني حرج: إضافة tenant_id لعزل بيانات المستأجرين في sw_*
ensure_column($conn, "sw_clients", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "sw_tickets", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "sw_ticket_replies", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "sw_products", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "sw_invoices", "tenant_id", "tenant_id INT NOT NULL DEFAULT 1");
$conn->query("CREATE INDEX IF NOT EXISTS idx_swc_tid  ON sw_clients(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_swt_tid  ON sw_tickets(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_swtr_tid ON sw_ticket_replies(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_swp_tid  ON sw_products(tenant_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_swi_tid  ON sw_invoices(tenant_id)");

// جدول خطط الاشتراك (يحل محل ENUM على tenants — يتيح feature flags ديناميكية)
$conn->query("CREATE TABLE IF NOT EXISTS plans (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    code           VARCHAR(40)  NOT NULL UNIQUE,
    name           VARCHAR(120) NOT NULL,
    price_monthly  DECIMAL(12,2) DEFAULT 0,
    price_yearly   DECIMAL(12,2) DEFAULT 0,
    max_users      SMALLINT DEFAULT 5,
    feature_flags  JSON DEFAULT NULL,
    is_active      TINYINT(1) DEFAULT 1,
    sort_order     SMALLINT DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_plan_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("INSERT IGNORE INTO plans (code,name,price_monthly,price_yearly,max_users,feature_flags,sort_order) VALUES
('trial',      'تجريبي',   0,    0,    2,
  '{\"real_estate\":true,\"accounting\":true,\"sw_portal\":false,\"max_projects\":1}',   1),
('starter',    'أساسي',    499,  4788, 5,
  '{\"real_estate\":true,\"accounting\":true,\"sw_portal\":false,\"max_projects\":3}',   2),
('pro',        'احترافي',  999,  9588, 15,
  '{\"real_estate\":true,\"accounting\":true,\"sw_portal\":true,\"max_projects\":10}',   3),
('enterprise', 'مؤسسي',   0,    0,    999,
  '{\"real_estate\":true,\"accounting\":true,\"sw_portal\":true,\"max_projects\":-1}',   4)");

// جدول اشتراكات المستأجرين (ربط tenant ↔ plan + دورة الفوترة + الصلاحية)
$conn->query("CREATE TABLE IF NOT EXISTS subscriptions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id     INT NOT NULL UNIQUE,
    plan_id       INT NOT NULL,
    billing_cycle ENUM('monthly','yearly','custom') DEFAULT 'yearly',
    starts_at     DATE NOT NULL,
    ends_at       DATE DEFAULT NULL,
    auto_renew    TINYINT(1) DEFAULT 1,
    cancelled_at  DATETIME DEFAULT NULL,
    notes         TEXT DEFAULT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sub_plan (plan_id),
    INDEX idx_sub_ends (ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// اشتراك سماك العقارية (tenant_id=1) على خطة enterprise
$conn->query("INSERT IGNORE INTO subscriptions (tenant_id,plan_id,billing_cycle,starts_at,auto_renew)
              SELECT 1,id,'yearly',CURDATE(),1 FROM plans WHERE code='enterprise' LIMIT 1");

$conn->query("REPLACE INTO db_schema_version (id) VALUES (5)");
} // end DDL v5

if ($__sv < 6) {
// ─── DDL v6: real-estate procurement (contracts + purchase orders) ──────────
$conn->query("CREATE TABLE IF NOT EXISTS re_contracts (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id        INT NOT NULL DEFAULT 1,
    project_id       INT DEFAULT NULL,
    contract_no      VARCHAR(50) DEFAULT NULL,
    contractor_name  VARCHAR(200) NOT NULL,
    contractor_phone VARCHAR(30)  DEFAULT NULL,
    work_type        VARCHAR(100) DEFAULT NULL,
    contract_value   DECIMAL(15,2) DEFAULT 0,
    advance_amount   DECIMAL(15,2) DEFAULT 0,
    start_date       DATE DEFAULT NULL,
    end_date         DATE DEFAULT NULL,
    status           ENUM('draft','active','on_hold','completed','cancelled') DEFAULT 'draft',
    notes            TEXT DEFAULT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rc_tenant  (tenant_id),
    INDEX idx_rc_project (project_id),
    INDEX idx_rc_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS re_purchase_orders (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id        INT NOT NULL DEFAULT 1,
    project_id       INT DEFAULT NULL,
    po_no            VARCHAR(50) DEFAULT NULL,
    supplier_name    VARCHAR(200) NOT NULL,
    supplier_phone   VARCHAR(30)  DEFAULT NULL,
    order_date       DATE NOT NULL,
    delivery_date    DATE DEFAULT NULL,
    total_amount     DECIMAL(15,2) DEFAULT 0,
    status           ENUM('draft','ordered','partial','received','cancelled') DEFAULT 'draft',
    items            JSON DEFAULT NULL,
    notes            TEXT DEFAULT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rpo_tenant  (tenant_id),
    INDEX idx_rpo_project (project_id),
    INDEX idx_rpo_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("REPLACE INTO db_schema_version (id) VALUES (6)");
} // end DDL v6

// ─── DDL v7: إعادة تنفيذ كل أعمدة الإصدارات السابقة بطريقة متوافقة مع MySQL ──
// الإصدارات 1-6 استخدمت ADD COLUMN IF NOT EXISTS (MariaDB فقط) ففشلت أعمدتها
// بصمت على إنتاج MySQL بينما سُجّلت الإصدارات كمنفذة. ensure_column آمنة التكرار.
if ($__sv < 7) {
ensure_column($conn, "inspections",       "status",               "status VARCHAR(50) DEFAULT NULL");
ensure_column($conn, "inspections",       "client_submitted_at",  "client_submitted_at DATETIME DEFAULT NULL");
ensure_column($conn, "inspections",       "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "acc_lines",         "party_type",           "party_type VARCHAR(12) DEFAULT NULL");
ensure_column($conn, "acc_lines",         "party_id",             "party_id INT DEFAULT NULL");
ensure_column($conn, "acc_lines",         "due_date",             "due_date DATE DEFAULT NULL");
ensure_column($conn, "acc_parties",       "notes",                "notes TEXT DEFAULT NULL");
ensure_column($conn, "owners",            "national_id",          "national_id VARCHAR(12) DEFAULT NULL");
ensure_column($conn, "owners",            "party_id",             "party_id INT DEFAULT NULL");
ensure_column($conn, "owners",            "project_label",        "project_label VARCHAR(200) DEFAULT NULL");
ensure_column($conn, "owners",            "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "projects",          "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "units",             "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "maintenance",       "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "leads",             "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "users",             "twofa",                "twofa TINYINT(1) DEFAULT 0");
ensure_column($conn, "users",             "twofa_channel",        "twofa_channel VARCHAR(10) DEFAULT 'email'");
ensure_column($conn, "users",             "must_change_password", "must_change_password TINYINT(1) NOT NULL DEFAULT 0");
ensure_column($conn, "users",             "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "acc_audit_log",     "ip_address",           "ip_address VARCHAR(45) DEFAULT NULL AFTER actor");
ensure_column($conn, "acc_audit_log",     "user_agent",           "user_agent VARCHAR(250) DEFAULT NULL AFTER ip_address");
ensure_column($conn, "acc_audit_log",     "old_data",             "old_data MEDIUMTEXT DEFAULT NULL AFTER user_agent");
ensure_column($conn, "acc_audit_log",     "new_data",             "new_data MEDIUMTEXT DEFAULT NULL AFTER old_data");
ensure_column($conn, "acc_audit_log",     "risk_level",           "risk_level TINYINT UNSIGNED DEFAULT 1 AFTER new_data");
ensure_column($conn, "acc_audit_log",     "row_hash",             "row_hash VARCHAR(64) DEFAULT NULL AFTER risk_level");
ensure_column($conn, "sw_clients",        "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "sw_tickets",        "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "sw_ticket_replies", "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "sw_products",       "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
ensure_column($conn, "sw_invoices",       "tenant_id",            "tenant_id INT NOT NULL DEFAULT 1");
$conn->query("REPLACE INTO db_schema_version (id) VALUES (7)");
} // end DDL v7

// ─── DDL v8: ملخص فهد الذكي لكل عميل مهتم ────────────────────────────────────
if ($__sv < 8) {
ensure_column($conn, "leads", "summary", "summary VARCHAR(600) DEFAULT NULL");
$conn->query("REPLACE INTO db_schema_version (id) VALUES (8)");
} // end DDL v8

// ─── مُساعدات محرّك المحاسبة المستقل ────────────────────────────────────────
// مُولّد رقم تسلسلي آمن للتزامن (نمط LAST_INSERT_ID الذرّي)
function acc_next_no($conn, $tid, $kind, $yr) {
    $tid = (int)$tid; $yr = (int)$yr; $kind = $conn->real_escape_string($kind);
    $conn->query("INSERT INTO acc_sequences (tenant_id,kind,yr,last_no) VALUES ($tid,'$kind',$yr,LAST_INSERT_ID(1))
                  ON DUPLICATE KEY UPDATE last_no=LAST_INSERT_ID(last_no+1)");
    return (int)$conn->insert_id;
}
// تسجيل حركة في سجل التدقيق — عالمي المستوى
function acc_audit($conn, $tid, $entity, $eid, $action, $detail, $actor, $ip = '', $ua = '', $old = null, $new = null) {
    // اكتشاف مستوى الخطورة تلقائياً
    static $r4 = ['delete','void','reverse','reopen_year','close_year'];
    static $r3 = ['update','post','zatca_stamp','recurring_run','save','reclass','parties'];
    static $r2 = ['create','login','otp_sent'];
    if (in_array($action, $r4, true))      $risk = 4; // حرج
    elseif (in_array($action, $r3, true))  $risk = 3; // عالي
    elseif (in_array($action, $r2, true))  $risk = 2; // متوسط
    else                                    $risk = 1; // منخفض (login_fail,view,otp_fail...)
    // login_fail و otp_fail خطر حرج
    if (in_array($action, ['login_fail','otp_fail'], true)) $risk = 4;
    // تنظيف وتحويل
    $tid    = (int)$tid;
    $entity = $conn->real_escape_string($entity);
    $action = $conn->real_escape_string($action);
    $det    = $conn->real_escape_string(is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE));
    $act    = $conn->real_escape_string((string)($actor ?? ''));
    $ipEsc  = $conn->real_escape_string(substr((string)$ip, 0, 45));
    $uaEsc  = $conn->real_escape_string(substr((string)$ua, 0, 250));
    $oldEsc = $old === null ? 'NULL' : ("'" . $conn->real_escape_string(is_string($old) ? $old : json_encode($old, JSON_UNESCAPED_UNICODE)) . "'");
    $newEsc = $new === null ? 'NULL' : ("'" . $conn->real_escape_string(is_string($new) ? $new : json_encode($new, JSON_UNESCAPED_UNICODE)) . "'");
    $eidSql = ($eid === null) ? 'NULL' : (int)$eid;
    $now    = date('Y-m-d H:i:s');
    // هاش tamper-proof لكل صف
    $hash   = hash('sha256', "$tid|$entity|$eidSql|$action|$det|$now|SEMAK_AUDIT_v2");
    $conn->query("INSERT INTO acc_audit_log
        (tenant_id,entity,entity_id,action,detail,actor,ip_address,user_agent,old_data,new_data,risk_level,row_hash)
        VALUES ($tid,'$entity',$eidSql,'$action','$det'," . ($act !== '' ? "'$act'" : 'NULL') . ",'$ipEsc','$uaEsc',$oldEsc,$newEsc,$risk,'$hash')");
}
// إنشاء تنبيه داخل اللوحة (user_id = null يعني تنبيه عام لكل المستخدمين)
function notify($conn, $tid, $user_id, $type, $title, $body = null, $link = null) {
    $tid   = (int)$tid;
    $uid   = ($user_id === null || $user_id === '') ? 'NULL' : (int)$user_id;
    $type  = $conn->real_escape_string((string)$type);
    $title = $conn->real_escape_string((string)$title);
    $bodyS = ($body === null) ? 'NULL' : "'" . $conn->real_escape_string((string)$body) . "'";
    $linkS = ($link === null) ? 'NULL' : "'" . $conn->real_escape_string((string)$link) . "'";
    $conn->query("INSERT INTO notifications (tenant_id,user_id,type,title,body,link)
                  VALUES ($tid,$uid,'$type','$title',$bodyS,$linkS)");
}

// ─── SaaS helpers ────────────────────────────────────────────────────────────
// هل تملك خطة المستأجر ميزة معينة؟ (يرجع true/false)
function tenant_feature($conn, $tid, $feature) {
    $tid = (int)$tid;
    $r = $conn->query("SELECT p.feature_flags FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.tenant_id=$tid LIMIT 1");
    if ($r && ($row = $r->fetch_assoc()) && !empty($row['feature_flags'])) {
        $flags = json_decode($row['feature_flags'] ?? '{}', true);
        return !empty($flags[(string)$feature]);
    }
    // Fallback: tenants.plan ENUM
    $r2 = $conn->query("SELECT plan FROM tenants WHERE id=$tid LIMIT 1");
    if ($r2 && ($t = $r2->fetch_assoc())) {
        if ($feature === 'sw_portal') return in_array($t['plan'], ['pro','enterprise']);
        return true;
    }
    return true; // افتراضي: مسموح
}
// ما هو الحد الأقصى لعدد الموظفين في خطة المستأجر؟
function tenant_user_limit($conn, $tid) {
    $tid = (int)$tid;
    $r = $conn->query("SELECT p.max_users FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.tenant_id=$tid LIMIT 1");
    if ($r && ($row = $r->fetch_assoc())) return max(1,(int)$row['max_users']);
    $r2 = $conn->query("SELECT max_users FROM tenants WHERE id=$tid LIMIT 1");
    if ($r2 && ($t = $r2->fetch_assoc())) return max(1,(int)$t['max_users']);
    return 5;
}

// ─── JWT (HS256 بدون مكتبة خارجية) ──────────────────────────────────────────
function jwt_b64($d) { return rtrim(strtr(base64_encode($d), '+/', '-_'), '='); }
function jwt_sign($payload, $secret = null) {
    if ($secret === null) $secret = TOKEN_SECRET;
    $h = jwt_b64('{"alg":"HS256","typ":"JWT"}');
    $p = jwt_b64(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $s = jwt_b64(hash_hmac('sha256', "$h.$p", $secret, true));
    return "$h.$p.$s";
}
function jwt_verify($token, $secret = null) {
    if ($secret === null) $secret = TOKEN_SECRET;
    $parts = explode('.', (string)$token);
    if (count($parts) !== 3) return null;
    [$h, $p, $s] = $parts;
    $exp = jwt_b64(hash_hmac('sha256', "$h.$p", $secret, true));
    if (!hash_equals($exp, $s)) return null;
    $pl = json_decode(base64_decode(strtr($p, '-_', '+/')), true);
    if (!is_array($pl)) return null;
    if (isset($pl['exp']) && $pl['exp'] < time()) return null;
    return $pl;
}
function jwt_from_request() {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($auth === '' && function_exists('getallheaders')) {
        $hdrs = getallheaders();
        $auth = $hdrs['Authorization'] ?? $hdrs['authorization'] ?? '';
    }
    if (strncasecmp($auth, 'Bearer ', 7) !== 0) return null;
    return trim(substr($auth, 7));
}

// ─── البريد الإلكتروني (SMTP عبر بريد semak.sa) ──────────────────────────────
// القيم تُحقن وقت النشر من GitHub Secrets (sed). تبقى كـ placeholders محليًا.
function smtp_config() {
    return [
        'host'      => '__SMTP_HOST__',
        'port'      => '__SMTP_PORT__',
        'user'      => '__SMTP_USER__',
        'pass'      => '__SMTP_PASS__',
        'from'      => '__SMTP_FROM__',
        'from_name' => '__SMTP_FROM_NAME__',
        'secure'    => '__SMTP_SECURE__', // ssl (465) أو tls (587)
    ];
}
function smtp_ready($c) {
    foreach (['host', 'user', 'pass'] as $k) {
        if (empty($c[$k]) || strpos($c[$k], '__SMTP') !== false) return false;
    }
    return true;
}
// قالب بريد مُنسَّق بهوية المنشأة (RTL) — يستخدم اسم الشركة الديناميكي
function email_template($title, $bodyHtml, $cta = null) {
    global $_tenantName, $_tenantColor;
    $cname = $GLOBALS['_tenantName'] ?? 'سماك العقارية';
    $color = $GLOBALS['_tenantColor'] ?? '#c5a059';
    $year = date('Y');
    $btn  = '';
    if ($cta && !empty($cta['url'])) {
        $btn = '<div style="text-align:center;margin-top:24px"><a href="' . htmlspecialchars($cta['url']) . '" style="display:inline-block;background:' . $color . ';color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 30px;border-radius:10px">' . htmlspecialchars($cta['label'] ?? 'فتح') . '</a></div>';
    }
    return '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;background:#f1f5f9;font-family:Tahoma,Arial,sans-serif">'
        . '<div style="max-width:560px;margin:0 auto;padding:24px">'
        . '<div style="background:#1a365d;border-radius:20px 20px 0 0;padding:26px;text-align:center">'
        . '<div style="color:' . $color . ';font-size:24px;font-weight:bold;letter-spacing:1px">' . htmlspecialchars($cname) . '</div></div>'
        . '<div style="background:#ffffff;padding:32px;border-radius:0 0 20px 20px;box-shadow:0 10px 30px rgba(0,0,0,.06)">'
        . '<h1 style="color:#1a365d;font-size:20px;margin:0 0 16px">' . htmlspecialchars($title) . '</h1>'
        . '<div style="color:#475569;font-size:15px;line-height:1.9">' . $bodyHtml . '</div>' . $btn . '</div>'
        . '<p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">© ' . $year . ' ' . htmlspecialchars($cname) . ' · رسالة آلية، يُرجى عدم الرد</p>'
        . '</div></body></html>';
}
// إرسال بريد عبر SMTP (fsockopen) — يدعم SSL/465 و STARTTLS/587 و AUTH LOGIN
function send_email($to, $subject, $html, $alt = '') {
    $c = smtp_config();
    if (!smtp_ready($c)) return ['ok' => false, 'error' => 'SMTP not configured'];

    $port = (int)$c['port'];
    $secure = ($c['secure'] === 'tls') ? 'tls' : 'ssl';
    if ($port <= 0) $port = ($secure === 'tls') ? 587 : 465;
    $host = $c['host'];

    $transport = ($secure === 'ssl') ? "ssl://$host" : "tcp://$host";
    $ctx = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]]);
    $fp = @stream_socket_client("$transport:$port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) return ['ok' => false, 'error' => "connect failed: $errstr ($errno)"];
    stream_set_timeout($fp, 15);

    $read = function () use ($fp) {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    };
    $cmd = function ($s) use ($fp, $read) { fwrite($fp, $s . "\r\n"); return $read(); };

    $read(); // تحية الخادم (220)
    $domain  = $c['from'] ? substr(strrchr($c['from'], '@'), 1) : 'localhost';
    $ehloHost = $domain ?: 'localhost';
    $cmd("EHLO $ehloHost");

    if ($secure === 'tls') {
        $cmd("STARTTLS");
        $ok = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT);
        if (!$ok) { fclose($fp); return ['ok' => false, 'error' => 'STARTTLS failed']; }
        $cmd("EHLO $ehloHost");
    }

    $cmd("AUTH LOGIN");
    $cmd(base64_encode($c['user']));
    $authResp = $cmd(base64_encode($c['pass']));
    if (strpos($authResp, '235') === false) { fclose($fp); return ['ok' => false, 'error' => 'auth failed']; }

    $from = $c['from'] ?: $c['user'];
    $cmd("MAIL FROM:<$from>");
    $rcpt = $cmd("RCPT TO:<$to>");
    if (strpos($rcpt, '250') === false && strpos($rcpt, '251') === false) { fclose($fp); return ['ok' => false, 'error' => 'recipient rejected']; }
    $cmd("DATA");

    $fromName = $c['from_name'] ?: 'Semak';
    $encName  = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
    $encSubj  = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $boundary = 'b_' . bin2hex(random_bytes(8));
    if ($alt === '') $alt = trim(preg_replace('/\s+/', ' ', strip_tags($html)));

    $headers = [
        "From: $encName <$from>",
        "To: <$to>",
        "Subject: $encSubj",
        "MIME-Version: 1.0",
        "Date: " . date('r'),
        "Message-ID: <" . bin2hex(random_bytes(8)) . "@$ehloHost>",
        "Content-Type: multipart/alternative; boundary=\"$boundary\"",
    ];
    $body  = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($alt)) . "\r\n";
    $body .= "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "\r\n";
    $body .= "--$boundary--\r\n";

    $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    $message = preg_replace('/^\./m', '..', $message); // dot-stuffing

    fwrite($fp, $message . "\r\n.\r\n");
    $dataResp = $read();
    $cmd("QUIT");
    fclose($fp);

    if (strpos($dataResp, '250') === false) return ['ok' => false, 'error' => 'message rejected'];
    return ['ok' => true];
}

// ─── أدوات التحقق بخطوتين عند الدخول ──────────────────────────────────────────
function mask_email($e) {
    if (!$e || strpos($e, '@') === false) return $e;
    list($u, $d) = explode('@', $e, 2);
    $um = (strlen($u) <= 2) ? substr($u, 0, 1) . '*' : substr($u, 0, 2) . str_repeat('*', max(1, strlen($u) - 2));
    return $um . '@' . $d;
}
function mask_phone($p) {
    $p = preg_replace('/\D/', '', (string)$p);
    if (strlen($p) < 4) return $p;
    return substr($p, 0, 3) . ' **** ' . substr($p, -3);
}
function wa_send_text($to, $body) {
    $key = MOTTASL_TOKEN;
    $ch = curl_init('https://api.mottasl.ai/v1/message/send');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['to' => $to, 'type' => 'text', 'text' => ['body' => $body]]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $key"],
        CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false,
    ]);
    curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $status === 200 || $status === 201;
}
// إرسال رمز الدخول عبر القناة المختارة مع احتياطي تلقائي للقناة الأخرى
// الترتيب: القناة المفضّلة أولاً → إذا فشلت أو لا توجد بيانات → القناة الاحتياطية
function send_login_otp($user, $channel, $code) {
    $cname   = $GLOBALS['_tenantName'] ?? 'سماك العقارية';
    $channel = ($channel === 'whatsapp') ? 'whatsapp' : 'email';

    // محتوى البريد الإلكتروني
    $html = email_template('رمز تسجيل الدخول',
        'رمز الدخول لمرّة واحدة الخاص بك في لوحة ' . htmlspecialchars($cname) . ':'
        . '<div style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#1a365d;text-align:center;margin:22px 0;direction:ltr">' . $code . '</div>'
        . 'الرمز صالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز فتجاهل هذه الرسالة.');

    // تطبيع رقم الجوال مرة واحدة
    $waPhone = '';
    if (!empty($user['phone'])) {
        $p = preg_replace('/\D/', '', $user['phone']);
        $p = ltrim($p, '0');
        if (substr($p, 0, 3) !== '966') $p = '966' . $p;
        if (strlen($p) >= 12) $waPhone = $p; // 966 + 9 أرقام على الأقل
    }
    $waMsg = "🔐 {$cname}\nرمز تسجيل الدخول: $code\nصالح 10 دقائق.";

    if ($channel === 'email') {
        // المحاولة الأولى: إيميل
        if (!empty($user['email'])) {
            $r = send_email($user['email'], 'رمز الدخول · ' . $cname, $html);
            if (!empty($r['ok'])) return true;
        }
        // احتياطي: واتساب (يفيد إذا لم يُضبط SMTP)
        if ($waPhone) return wa_send_text($waPhone, $waMsg);
    } else {
        // المحاولة الأولى: واتساب
        if ($waPhone && wa_send_text($waPhone, $waMsg)) return true;
        // احتياطي: إيميل (يفيد إذا لم يكن للمستخدم رقم جوال)
        if (!empty($user['email'])) {
            $r = send_email($user['email'], 'رمز الدخول · ' . $cname, $html);
            if (!empty($r['ok'])) return true;
        }
    }
    return false; // كلتا القناتين فشلتا أو بيانات الاتصال مفقودة
}

// ─── دخول موحّد بالـ OTP: أدوات مساعدة ────────────────────────────────────────
// تطبيع رقم جوال سعودي إلى الصيغة الدولية 9665XXXXXXXX (يُرجع '' إذا غير صالح).
function auth_norm_phone($p) {
    $d = preg_replace('/\D/', '', (string)$p);
    if ($d === '') return '';
    $d = ltrim($d, '0');
    if (substr($d, 0, 3) === '966') $d = substr($d, 3);
    $d = ltrim($d, '0');
    // جوال سعودي: 9 أرقام تبدأ بـ 5
    if (strlen($d) === 9 && $d[0] === '5') return '966' . $d;
    if (strlen($d) >= 9) return '966' . substr($d, -9); // تساهل
    return '';
}
// تحديد نوع المُعرّف المُدخل: email | phone | national_id | unit
function auth_detect_identifier($raw) {
    $t = trim((string)$raw);
    if ($t === '') return ['type' => 'unknown', 'value' => ''];
    if (strpos($t, '@') !== false && filter_var($t, FILTER_VALIDATE_EMAIL)) {
        return ['type' => 'email', 'value' => strtolower($t)];
    }
    $d = preg_replace('/\D/', '', $t);
    // إذا كان المُدخل أرقامًا (مع رموز هاتف +/مسافات فقط)
    if ($d !== '' && preg_match('/^[\d\s\-\+\(\)]+$/', $t)) {
        // هوية وطنية سعودية: 10 أرقام تبدأ بـ 1 أو 2
        if (strlen($d) === 10 && ($d[0] === '1' || $d[0] === '2')) {
            return ['type' => 'national_id', 'value' => $d];
        }
        // جوال: 9665XXXXXXXX أو 05XXXXXXXX أو 5XXXXXXXX
        $norm = auth_norm_phone($d);
        if ($norm !== '') return ['type' => 'phone', 'value' => $norm];
        // أرقام أخرى ⇒ تُعامل كرقم وحدة رقمي
        return ['type' => 'unit', 'value' => strtoupper($t)];
    }
    // غير ذلك ⇒ رقم وحدة (أبجدي رقمي)
    return ['type' => 'unit', 'value' => strtoupper($t)];
}
// إرسال رمز عبر واتساب بقالب معتمَد (يعمل خارج نافذة 24 ساعة) مع احتياطي نصّي.
function wa_send_otp($to966, $name, $ref, $code) {
    $key = MOTTASL_TOKEN;
    $payload = json_encode([
        'to' => $to966, 'type' => 'template',
        'template' => [
            'name' => 'semak_request_ref', 'language' => ['code' => 'ar'],
            'components' => [[
                'type' => 'body',
                'parameters' => [
                    ['type' => 'text', 'text' => $name ?: 'عميلنا'],
                    ['type' => 'text', 'text' => $ref ?: 'سماك'],
                    ['type' => 'text', 'text' => $code],
                ],
            ]],
        ],
    ]);
    $ch = curl_init('https://api.mottasl.ai/v1/message/send?create=true');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $key"],
        CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false,
    ]);
    curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status === 200 || $status === 201) return true;
    // احتياطي: رسالة نصّية مباشرة
    return wa_send_text($to966, "🔐 سماك العقارية\nأهلاً " . ($name ?: '') . "، رمز الدخول: $code\nصالح 10 دقائق.");
}
// إرسال الرمز عبر القناة المطلوبة باستخدام بريد/جوال السجل المُحدَّد.
function auth_dispatch_code($channel, $name, $ref, $email, $phone, $code) {
    if ($channel === 'whatsapp') {
        $to = auth_norm_phone($phone);
        if ($to === '') return false;
        return wa_send_otp($to, $name, $ref, $code);
    }
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    $html = email_template('رمز تسجيل الدخول',
        'رمز الدخول لمرّة واحدة الخاص بك:'
        . '<div style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#1a365d;text-align:center;margin:22px 0;direction:ltr">' . $code . '</div>'
        . 'الرمز صالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز فتجاهل هذه الرسالة.');
    $r = send_email($email, 'رمز الدخول · سماك العقارية', $html);
    return !empty($r['ok']);
}

// قراءة إعداد منشأة واحد (مع قيمة افتراضية)
function acc_setting($conn, $tid, $key, $default = '') {
    $tid = (int)$tid; $key = $conn->real_escape_string($key);
    $r = $conn->query("SELECT sval FROM acc_settings WHERE tenant_id=$tid AND skey='$key' LIMIT 1");
    $row = $r ? $r->fetch_assoc() : null;
    return ($row && $row['sval'] !== null && $row['sval'] !== '') ? $row['sval'] : $default;
}
// مُولّد UUID v4
function acc_uuid4() {
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}
// ترميز حقل TLV واحد (وسم/طول/قيمة)
function acc_tlv($tag, $value) {
    $value = (string)$value; $len = strlen($value);
    // الطول قد يتجاوز 127 للأسماء العربية الطويلة — نستخدم ترميز طول من بايت واحد (يكفي ≤255)
    return chr($tag) . chr($len) . $value;
}
// توليد رمز QR وفق هيئة الزكاة والضريبة (TLV ثم Base64) — الوسوم 1..5 للفاتورة المبسّطة
function acc_zatca_qr($seller, $vat, $tsIso, $total, $vatTotal) {
    $tlv = acc_tlv(1, $seller)
         . acc_tlv(2, $vat)
         . acc_tlv(3, $tsIso)
         . acc_tlv(4, number_format((float)$total, 2, '.', ''))
         . acc_tlv(5, number_format((float)$vatTotal, 2, '.', ''));
    return base64_encode($tlv);
}
// PIH للفاتورة الأولى في السلسلة = Base64 لتمثيل sha256("0") النصّي (ثابت معروف لدى الهيئة)
function acc_zatca_pih0() { return base64_encode(hash('sha256', '0')); }
// جلب/إنشاء سجل اعتماد الزكاة للمنشأة
function acc_zatca_get($conn, $tid) {
    $tid = (int)$tid;
    $conn->query("INSERT IGNORE INTO acc_zatca (tenant_id, last_pih) VALUES ($tid, '".acc_zatca_pih0()."')");
    $r = $conn->query("SELECT * FROM acc_zatca WHERE tenant_id=$tid LIMIT 1");
    return $r ? $r->fetch_assoc() : null;
}
// توليد زوج مفاتيح secp256k1 + طلب توقيع شهادة (CSR) وتخزينه للمنشأة
// يعيد مصفوفة فيها csr و public_pem و egs_serial، ويُخزّن المفتاح الخاص في قاعدة البيانات
function acc_zatca_keygen($conn, $tid, $company, $egsSerial) {
    $pk = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'secp256k1']);
    if (!$pk) throw new Exception('تعذّر توليد المفتاح: '.openssl_error_string());
    $privPem = '';
    if (!openssl_pkey_export($pk, $privPem)) throw new Exception('تعذّر تصدير المفتاح الخاص');
    $det = openssl_pkey_get_details($pk);
    $pubPem = $det['key'] ?? '';
    // CSR قياسي الآن (إضافات قالب الزكاة المخصّصة تُضبط عند الربط بالمنصّة)
    $dn = [
        'countryName'            => 'SA',
        'organizationName'       => $company['company_name'] ?: 'Semak',
        'organizationalUnitName' => $company['cr_number'] ?: 'Branch',
        'commonName'             => $egsSerial,
    ];
    $csrPem = '';
    $csr = @openssl_csr_new($dn, $pk, ['digest_alg' => 'sha256']);
    if ($csr) @openssl_csr_export($csr, $csrPem);
    $tid = (int)$tid;
    $pk_e   = $conn->real_escape_string($privPem);
    $csr_e  = $conn->real_escape_string($csrPem);
    $egs_e  = $conn->real_escape_string($egsSerial);
    $conn->query("INSERT INTO acc_zatca (tenant_id, egs_serial, private_key, csr, last_pih)
                  VALUES ($tid,'$egs_e','$pk_e','$csr_e','".acc_zatca_pih0()."')
                  ON DUPLICATE KEY UPDATE egs_serial=VALUES(egs_serial), private_key=VALUES(private_key), csr=VALUES(csr)");
    return ['csr' => $csrPem, 'public_pem' => $pubPem, 'egs_serial' => $egsSerial];
}
// تهريب نص لإدراجه في XML
function acc_xmlesc($s) { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_XML1, 'UTF-8'); }
// بناء فاتورة UBL 2.1 مبسّطة (تمثيلية لوضع المحاكاة — تُشدّد للمطابقة الكاملة عند الربط بالمنصّة)
function acc_zatca_ubl($inv, $items, $company, $icv, $pihB64) {
    $isSimplified = (($inv['invoice_type'] ?? 'simplified') === 'simplified');
    $typeName = $isSimplified ? '0200000' : '0100000';
    $kindCode = ['invoice' => '388', 'debit_note' => '383', 'credit_note' => '381'][$inv['doc_kind'] ?? 'invoice'] ?? '388';
    $cur = $inv['currency'] ?: 'SAR';
    $sellerName = acc_xmlesc($company['company_name'] ?: 'Semak');
    $sellerVat  = acc_xmlesc($company['vat_number'] ?: '');
    $buyerName  = acc_xmlesc($inv['party_name'] ?: 'Walk-in Customer');
    $sub = number_format((float)$inv['subtotal'], 2, '.', '');
    $taxT = number_format((float)$inv['tax_total'], 2, '.', '');
    $tot = number_format((float)$inv['total'], 2, '.', '');
    $lines = '';
    foreach ($items as $i => $it) {
        $n = $i + 1;
        $qty = rtrim(rtrim(number_format((float)$it['qty'], 3, '.', ''), '0'), '.');
        $net = number_format((float)$it['net_amount'], 2, '.', '');
        $taxAmt = number_format((float)$it['tax_amount'], 2, '.', '');
        $ltWithTax = number_format((float)$it['net_amount'] + (float)$it['tax_amount'], 2, '.', '');
        $price = number_format((float)$it['unit_price'], 2, '.', '');
        $rate = number_format((float)$it['tax_rate'], 2, '.', '');
        $desc = acc_xmlesc($it['description']);
        $lines .= "<cac:InvoiceLine><cbc:ID>$n</cbc:ID><cbc:InvoicedQuantity unitCode=\"PCE\">$qty</cbc:InvoicedQuantity>"
            . "<cbc:LineExtensionAmount currencyID=\"$cur\">$net</cbc:LineExtensionAmount>"
            . "<cac:TaxTotal><cbc:TaxAmount currencyID=\"$cur\">$taxAmt</cbc:TaxAmount><cbc:RoundingAmount currencyID=\"$cur\">$ltWithTax</cbc:RoundingAmount></cac:TaxTotal>"
            . "<cac:Item><cbc:Name>$desc</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>$rate</cbc:Percent>"
            . "<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>"
            . "<cac:Price><cbc:PriceAmount currencyID=\"$cur\">$price</cbc:PriceAmount></cac:Price></cac:InvoiceLine>";
    }
    $xml = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"'
        . ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"'
        . ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">'
        . '<cbc:ProfileID>reporting:1.0</cbc:ProfileID>'
        . '<cbc:ID>' . acc_xmlesc($inv['invoice_no']) . '</cbc:ID>'
        . '<cbc:UUID>' . acc_xmlesc($inv['uuid']) . '</cbc:UUID>'
        . '<cbc:IssueDate>' . acc_xmlesc($inv['issue_date']) . '</cbc:IssueDate>'
        . '<cbc:IssueTime>' . acc_xmlesc(substr($inv['issue_time'] ?? '00:00:00', 0, 8)) . '</cbc:IssueTime>'
        . '<cbc:InvoiceTypeCode name="' . $typeName . '">' . $kindCode . '</cbc:InvoiceTypeCode>'
        . '<cbc:DocumentCurrencyCode>' . $cur . '</cbc:DocumentCurrencyCode>'
        . '<cbc:TaxCurrencyCode>' . $cur . '</cbc:TaxCurrencyCode>'
        . '<cac:AdditionalDocumentReference><cbc:ID>ICV</cbc:ID><cbc:UUID>' . (int)$icv . '</cbc:UUID></cac:AdditionalDocumentReference>'
        . '<cac:AdditionalDocumentReference><cbc:ID>PIH</cbc:ID><cac:Attachment>'
        . '<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">' . acc_xmlesc($pihB64) . '</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>'
        . '<cac:AccountingSupplierParty><cac:Party>'
        . '<cac:PartyTaxScheme><cbc:CompanyID>' . $sellerVat . '</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
        . '<cac:PartyLegalEntity><cbc:RegistrationName>' . $sellerName . '</cbc:RegistrationName></cac:PartyLegalEntity>'
        . '</cac:Party></cac:AccountingSupplierParty>'
        . '<cac:AccountingCustomerParty><cac:Party>'
        . '<cac:PartyLegalEntity><cbc:RegistrationName>' . $buyerName . '</cbc:RegistrationName></cac:PartyLegalEntity>'
        . '</cac:Party></cac:AccountingCustomerParty>'
        . '<cac:TaxTotal><cbc:TaxAmount currencyID="' . $cur . '">' . $taxT . '</cbc:TaxAmount>'
        . '<cac:TaxSubtotal><cbc:TaxableAmount currencyID="' . $cur . '">' . $sub . '</cbc:TaxableAmount>'
        . '<cbc:TaxAmount currencyID="' . $cur . '">' . $taxT . '</cbc:TaxAmount>'
        . '<cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>15.00</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>'
        . '<cac:LegalMonetaryTotal>'
        . '<cbc:LineExtensionAmount currencyID="' . $cur . '">' . $sub . '</cbc:LineExtensionAmount>'
        . '<cbc:TaxExclusiveAmount currencyID="' . $cur . '">' . $sub . '</cbc:TaxExclusiveAmount>'
        . '<cbc:TaxInclusiveAmount currencyID="' . $cur . '">' . $tot . '</cbc:TaxInclusiveAmount>'
        . '<cbc:PayableAmount currencyID="' . $cur . '">' . $tot . '</cbc:PayableAmount></cac:LegalMonetaryTotal>'
        . $lines
        . '</Invoice>';
    return $xml;
}
// هاش الفاتورة وفق الهيئة = Base64 لتمثيل sha256 النصّي (متوافق مع PIH0)
function acc_zatca_hash($xml) { return base64_encode(hash('sha256', $xml)); }
// التوقيع الرقمي ECDSA على هاش الفاتورة بالمفتاح الخاص — يعيد Base64
function acc_zatca_sign($data, $privPem) {
    $pk = openssl_pkey_get_private($privPem);
    if (!$pk) throw new Exception('مفتاح خاص غير صالح');
    $sig = '';
    if (!openssl_sign($data, $sig, $pk, OPENSSL_ALGO_SHA256)) throw new Exception('فشل التوقيع');
    return base64_encode($sig);
}
// استخراج بايتات المفتاح العام (DER من SubjectPublicKeyInfo) للوسم 8
function acc_zatca_pubkey_der($privPem) {
    $pk = openssl_pkey_get_private($privPem);
    if (!$pk) return '';
    $det = openssl_pkey_get_details($pk);
    $pem = $det['key'] ?? '';
    $b64 = preg_replace('/-----[^-]+-----|\s+/', '', $pem);
    return base64_decode($b64) ?: '';
}
// رمز QR للمرحلة الثانية (9 وسوم): 1..5 + هاش + توقيع + مفتاح عام + توقيع الختم
function acc_zatca_qr_v2($seller, $vat, $tsIso, $total, $vatTotal, $hashB64, $sigB64, $pubDer, $stampSigB64) {
    $tlv = acc_tlv(1, $seller) . acc_tlv(2, $vat) . acc_tlv(3, $tsIso)
         . acc_tlv(4, number_format((float)$total, 2, '.', ''))
         . acc_tlv(5, number_format((float)$vatTotal, 2, '.', ''))
         . acc_tlv(6, $hashB64) . acc_tlv(7, $sigB64)
         . acc_tlv(8, $pubDer) . acc_tlv(9, $stampSigB64);
    return base64_encode($tlv);
}
// ضبط شجرة الحسابات: تحديد الأب بأطول بادئة كود موجودة
function acc_fix_hierarchy($conn, $tid) {
    $tid = (int)$tid;
    $res = $conn->query("SELECT id, code FROM acc_accounts WHERE tenant_id=$tid");
    $byCode = []; $all = [];
    while ($res && ($x = $res->fetch_assoc())) { $all[] = $x; $byCode[$x['code']] = (int)$x['id']; }
    $n = 0;
    foreach ($all as $a) {
        $code = (string)$a['code']; $parent = null;
        for ($len = strlen($code) - 1; $len >= 1; $len--) {
            $pre = substr($code, 0, $len);
            if (isset($byCode[$pre])) { $parent = $byCode[$pre]; break; }
        }
        $pv = ($parent === null) ? 'NULL' : (int)$parent;
        $conn->query("UPDATE acc_accounts SET parent_id=$pv WHERE id=" . (int)$a['id'] . " AND tenant_id=$tid");
        $n++;
    }
    return $n;
}
// معرّف حساب من الكود (لربط المستندات بدليل الحسابات)
function acc_id_by_code($conn, $tid, $code) {
    $tid = (int)$tid; $code = $conn->real_escape_string($code);
    $r = $conn->query("SELECT id FROM acc_accounts WHERE tenant_id=$tid AND code='$code' LIMIT 1");
    if ($r && ($x = $r->fetch_assoc())) return (int)$x['id'];
    return 0;
}
// ترحيل قيد متوازن — لا يفتح معاملة خاصة به (يُستدعى داخل معاملة المستند). يرمي استثناء عند الفشل
function acc_post_entry($conn, $tid, $date, $desc, $reft, $refid, $by, $lines, $posted = 1) {
    $tid = (int)$tid;
    $date = $conn->real_escape_string($date);
    $desc = $conn->real_escape_string($desc);
    $reft = $conn->real_escape_string($reft);
    $refidSql = ($refid === null || $refid === '') ? 'NULL' : (int)$refid;
    $by = $conn->real_escape_string((string)($by ?? ''));
    $posted = (int)(bool)$posted;

    $fy = (int)substr($date, 0, 4);
    $pc = $conn->query("SELECT is_closed FROM acc_periods WHERE tenant_id=$tid AND fy=$fy LIMIT 1");
    if ($pc && ($pr = $pc->fetch_assoc()) && (int)$pr['is_closed'] === 1) throw new Exception("الفترة المالية $fy مقفلة");

    $td = 0; $tc = 0; $clean = [];
    foreach ($lines as $ln) {
        $acc = (int)($ln['account_id'] ?? 0);
        $dv  = round((float)($ln['debit'] ?? 0), 2);
        $cv  = round((float)($ln['credit'] ?? 0), 2);
        if (!$acc || ($dv == 0 && $cv == 0)) continue;
        if ($dv > 0 && $cv > 0) throw new Exception('البند لا يكون مدين ودائن معًا');
        $td += $dv; $tc += $cv;
        $pt  = isset($ln['party_type']) && in_array($ln['party_type'], ['customer','supplier','partner']) ? "'".$conn->real_escape_string($ln['party_type'])."'" : 'NULL';
        $plid= isset($ln['party_id']) && $ln['party_id'] !== '' && $ln['party_id'] !== null ? (int)$ln['party_id'] : 'NULL';
        $dd  = isset($ln['due_date']) && $ln['due_date'] !== '' && $ln['due_date'] !== null ? "'".$conn->real_escape_string($ln['due_date'])."'" : 'NULL';
        $cc  = isset($ln['cost_center_id']) && $ln['cost_center_id'] !== '' && $ln['cost_center_id'] !== null ? (int)$ln['cost_center_id'] : 'NULL';
        $clean[] = ['acc'=>$acc,'d'=>$dv,'c'=>$cv,'cc'=>$cc,'pt'=>$pt,'pid'=>$plid,'dd'=>$dd,'desc'=>$conn->real_escape_string($ln['description'] ?? '')];
    }
    if (count($clean) < 2) throw new Exception('القيد يحتاج بندين على الأقل');
    if (round($td,2) != round($tc,2)) throw new Exception("القيد غير متوازن: مدين $td ≠ دائن $tc");
    if ($td <= 0) throw new Exception('إجمالي القيد صفر');

    $yr  = (int)substr($date, 0, 4);
    $seq = acc_next_no($conn, $tid, 'JV', $yr);
    $eno = 'JV-'.$yr.'-'.str_pad($seq, 6, '0', STR_PAD_LEFT);
    if (!$conn->query("INSERT INTO acc_entries (tenant_id,entry_no,date,description,ref_type,ref_id,total_debit,total_credit,is_posted,created_by)
                  VALUES ($tid,'$eno','$date','$desc',".($reft?"'$reft'":'NULL').",$refidSql,$td,$tc,$posted,".($by?"'$by'":'NULL').")")) throw new Exception($conn->error);
    $eid = $conn->insert_id;
    foreach ($clean as $l) {
        if (!$conn->query("INSERT INTO acc_lines (tenant_id,entry_id,account_id,debit,credit,cost_center_id,party_type,party_id,due_date,description)
                      VALUES ($tid,$eid,{$l['acc']},{$l['d']},{$l['c']},{$l['cc']},{$l['pt']},{$l['pid']},{$l['dd']},'{$l['desc']}')")) throw new Exception($conn->error);
    }
    return ['eid'=>$eid, 'eno'=>$eno, 'total'=>$td];
}
// عكس قيد مُرحّل (لإلغاء مستند) — لا يفتح معاملة خاصة به. يرمي استثناء عند الفشل
function acc_reverse_entry($conn, $tid, $eid, $date, $by) {
    $tid = (int)$tid; $eid = (int)$eid;
    $date = $conn->real_escape_string($date ?: date('Y-m-d'));
    $h = $conn->query("SELECT * FROM acc_entries WHERE id=$eid AND tenant_id=$tid LIMIT 1");
    $head = $h ? $h->fetch_assoc() : null;
    if (!$head) throw new Exception('القيد الأصلي غير موجود');
    $lr = $conn->query("SELECT * FROM acc_lines WHERE entry_id=$eid AND tenant_id=$tid");
    $olines = []; while ($lr && ($x = $lr->fetch_assoc())) $olines[] = $x;
    if (!$olines) throw new Exception('لا توجد بنود للعكس');
    $yr = (int)substr($date, 0, 4);
    $pc = $conn->query("SELECT is_closed FROM acc_periods WHERE tenant_id=$tid AND fy=$yr LIMIT 1");
    if ($pc && ($pr = $pc->fetch_assoc()) && (int)$pr['is_closed'] === 1) throw new Exception("الفترة $yr مقفلة");
    $seq = acc_next_no($conn, $tid, 'JV', $yr);
    $eno = 'JV-'.$yr.'-'.str_pad($seq, 6, '0', STR_PAD_LEFT);
    $rdesc = $conn->real_escape_string('عكس قيد '.$head['entry_no']);
    if (!$conn->query("INSERT INTO acc_entries (tenant_id,entry_no,date,description,ref_type,ref_id,total_debit,total_credit,is_posted,created_by)
                  VALUES ($tid,'$eno','$date','$rdesc','reversal',$eid,{$head['total_credit']},{$head['total_debit']},1,".($by?"'".$conn->real_escape_string($by)."'":'NULL').")")) throw new Exception($conn->error);
    $nid = $conn->insert_id;
    foreach ($olines as $l) {
        $pt  = $l['party_type'] !== null ? "'".$conn->real_escape_string($l['party_type'])."'" : 'NULL';
        $plid= $l['party_id'] !== null ? (int)$l['party_id'] : 'NULL';
        $dd  = $l['due_date'] !== null ? "'".$conn->real_escape_string($l['due_date'])."'" : 'NULL';
        $cc  = $l['cost_center_id'] !== null ? (int)$l['cost_center_id'] : 'NULL';
        $ld  = $conn->real_escape_string($l['description'] ?? '');
        if (!$conn->query("INSERT INTO acc_lines (tenant_id,entry_id,account_id,debit,credit,cost_center_id,party_type,party_id,due_date,description)
                      VALUES ($tid,$nid,{$l['account_id']},{$l['credit']},{$l['debit']},$cc,$pt,$plid,$dd,'$ld')")) throw new Exception($conn->error);
    }
    return ['eid'=>$nid, 'eno'=>$eno];
}

// ─── auto-migrate: WhatsApp bot conversation history ────────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS wa_bot_conversations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    phone       VARCHAR(20) NOT NULL,
    role        ENUM('user','assistant') NOT NULL,
    message     TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_time (phone, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ─── auto-migrate: human takeover tracking ───────────────────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS wa_human_takeover (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    phone    VARCHAR(30) NOT NULL,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$raw_input  = file_get_contents("php://input");
$input_data = json_decode($raw_input, true);
if (!$input_data) $input_data = [];

$action = '';
if (isset($_GET['action']))        $action = $_GET['action'];
elseif (isset($_POST['action']))   $action = $_POST['action'];
elseif (isset($input_data['action'])) $action = $input_data['action'];

// طلب بلا action صريح يحمل بريداً وكلمة مرور = تسجيل دخول (توافق قديم).
// لا تخطف الطلبات المعنونة (invite_user/add_user ترسل email+password أيضاً).
if ($action === '' && isset($input_data['email']) && isset($input_data['password'])) {
    $action = 'login';
}

ob_end_clean();

// ─── استخراج هوية الطالب من JWT (اختياري — backward compatible) ───────────
$_jwt_raw      = jwt_from_request();
$_jwt_claims   = $_jwt_raw ? jwt_verify($_jwt_raw)                    : null;
$_plat_claims  = $_jwt_raw ? jwt_verify($_jwt_raw, PLATFORM_SECRET)   : null;
// نلغي plat_claims إن لم تكن بها role=platform_admin صريحة
if (!isset($_plat_claims['role']) || $_plat_claims['role'] !== 'platform_admin') $_plat_claims = null;
// إن كان platform_admin لا تعامله كمستخدم عادي
if ($_plat_claims) $_jwt_claims = null;
// tenant_id: من JWT أولاً، ثم من الطلب (backward compatible)
$_jwt_tid = isset($_jwt_claims['tid']) ? (int)$_jwt_claims['tid'] : null;

// ─── إعادة تحميل إعدادات المنشأة بعد حل JWT ────────────────────────────────
// إذا كان الـ JWT يحمل tenant_id مختلف عن 1، نُعيد تحميل الاسم واللون
// حتى تستخدمهما email_template() و send_login_otp() بشكل صحيح.
if ($_jwt_tid && $_jwt_tid !== 1) {
    $__ts = $conn->query("SELECT skey,sval FROM acc_settings WHERE tenant_id=$_jwt_tid");
    if ($__ts) {
        $_tenantSettings = [];
        while ($__tr = $__ts->fetch_assoc()) $_tenantSettings[$__tr['skey']] = $__tr['sval'];
        $_tenantName  = $_tenantSettings['company_name']  ?? $_tenantName;
        $_tenantPhone = $_tenantSettings['company_phone'] ?? $_tenantPhone;
        $_tenantColor = $_tenantSettings['primary_color'] ?? $_tenantColor;
    }
    unset($__ts, $__tr);
}

switch ($action) {

    case 'wa_mottasl_contact':
        // تشخيص: جلب بيانات contact/conversation من Mottasl API
        $test_phone = preg_replace('/\D/', '', trim($_GET['phone'] ?? $input_data['phone'] ?? '966500000000'));
        $conv_id    = trim($_GET['conv_id'] ?? $input_data['conv_id'] ?? '');
        $base       = "https://api.mottasl.ai/v1";
        $hdrs       = ["Authorization: Bearer " . MOTTASL_TOKEN, "Accept: application/json"];
        $endpoints  = array_filter([
            "$base/contacts?search=" . urlencode($test_phone),
            "$base/contacts?phone=" . urlencode($test_phone),
            "$base/contacts/$test_phone",
            "$base/chats?contact=$test_phone",
            "$base/conversations?contact=$test_phone",
            "$base/conversations?phone=$test_phone",
            $conv_id ? "$base/conversations/$conv_id" : null,
            $conv_id ? "$base/chats/$conv_id" : null,
            "$base/agents",
            "$base/users",
        ]);
        $results = [];
        foreach ($endpoints as $ep) {
            $ch = curl_init($ep);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_HTTPHEADER => $hdrs]);
            $body = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $results[] = ["url" => $ep, "http" => $code, "body" => json_decode($body, true) ?? substr($body, 0, 200)];
        }
        echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'wa_raw_log':
        // تشخيص: آخر N سطر من الـ debug log (fseek — لا يقرأ الملف كله)
        $lf = __DIR__ . '/wa_debug.log';
        if (!file_exists($lf)) { echo json_encode(['lines' => []]); break; }
        $n  = min((int)($_GET['n'] ?? $input_data['n'] ?? 10), 50);
        if ($n < 1) $n = 10;
        $fh = fopen($lf, 'r');
        fseek($fh, max(0, filesize($lf) - 102400)); // آخر 100KB فقط
        $chunk = fread($fh, 102400);
        fclose($fh);
        $all   = array_filter(explode("\n", $chunk));
        $lines = array_values(array_slice($all, -$n));
        $safe  = array_map(fn($l) => mb_substr($l, 0, 2000), $lines);
        echo json_encode(['lines' => $safe], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        break;

    case 'wa_log_out':
        // تشخيص: آخر 30 سطر من اللوج تحتوي على رسائل صادرة (out) — لمعرفة صيغة payload أزير
        $lf = __DIR__ . '/wa_debug.log';
        if (!file_exists($lf)) { echo json_encode(['lines'=>[]]); break; }
        $lines = array_slice(file($lf), -200);
        $out_lines = array_values(array_filter($lines, fn($l) => str_contains($l, '"out"') || str_contains($l, 'direction') || str_contains($l, 'out')));
        echo json_encode(['lines' => array_slice($out_lines, -30)], JSON_UNESCAPED_UNICODE);
        break;

    case 'ver':
        // فحص خفيف لإصدار النشر المُطبَّق (لتأكيد وصول الديبلوي دون GitHub API)
        echo json_encode(['success'=>true,'version'=>'v426-saas','deployed'=>'2026-06-07'], JSON_UNESCAPED_UNICODE);
        break;

    // ═══════════════════════════════════════════════════════════════════════
    // منصة SaaS — إدارة المستأجرين (platform_*)
    // تتطلب JWT موقّع بـ PLATFORM_SECRET
    // ═══════════════════════════════════════════════════════════════════════

    case 'platform_via_jwt': {
        // SSO: إذا كان المستخدم admin ← يحصل على platform token مباشرة
        if (!$_jwt_claims || ($_jwt_claims['role'] ?? '') !== 'admin') {
            echo json_encode(['success'=>false,'message'=>'يتطلب صلاحية مدير'], JSON_UNESCAPED_UNICODE);
            break;
        }
        // جلب اسم/بريد المستخدم من DB للسجل
        $uid_sso = (int)($_jwt_claims['sub'] ?? 0);
        $usr_row = $uid_sso ? $conn->query("SELECT name, email FROM users WHERE id=$uid_sso LIMIT 1")->fetch_assoc() : [];
        $token = jwt_sign([
            'sub'   => 'platform_admin',
            'role'  => 'platform_admin',
            'email' => $usr_row['email'] ?? 'admin@semak.sa',
            'name'  => $usr_row['name']  ?? 'Admin',
            'iat'   => time(),
            'exp'   => time() + 86400 * 7,
        ], PLATFORM_SECRET);
        echo json_encode(['success'=>true,'token'=>$token,'role'=>'platform_admin'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_login': {
        // مصادقة مدير المنصة — لا تعتمد على قاعدة البيانات
        $email = trim($input_data['email'] ?? '');
        $pass  = (string)($input_data['password'] ?? '');
        if (PLATFORM_EMAIL === '' || PLATFORM_HASH === '') {
            echo json_encode(['success'=>false,'message'=>'المنصة غير مُهيَّأة — راجع إعدادات GitHub Secrets'], JSON_UNESCAPED_UNICODE);
            break;
        }
        if ($email !== PLATFORM_EMAIL || !password_verify($pass, PLATFORM_HASH)) {
            acc_audit($conn, 0, 'platform', 0, 'login_fail', "email=$email", 'platform', $_clientIp, $_clientUa);
            echo json_encode(['success'=>false,'message'=>'بيانات الدخول غير صحيحة'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $token = jwt_sign([
            'sub'  => 'platform_admin',
            'role' => 'platform_admin',
            'email'=> $email,
            'iat'  => time(),
            'exp'  => time() + 86400 * 30,
        ], PLATFORM_SECRET);
        acc_audit($conn, 0, 'platform', 0, 'login', 'platform admin login', 'platform', $_clientIp, $_clientUa);
        echo json_encode(['success'=>true,'token'=>$token,'role'=>'platform_admin'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_tenant_list': {
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $q = $conn->query("SELECT t.*,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id=t.id) AS user_count,
            (SELECT COUNT(*) FROM acc_invoices i WHERE i.tenant_id=t.id) AS invoice_count,
            p.name AS plan_name, p.price_yearly AS plan_price_yearly, p.max_users AS plan_max_users
            FROM tenants t
            LEFT JOIN subscriptions s ON s.tenant_id=t.id
            LEFT JOIN plans p ON p.id=s.plan_id
            ORDER BY t.id DESC LIMIT 500");
        $rows = [];
        while ($r = $q->fetch_assoc()) $rows[] = $r;
        echo json_encode(['success'=>true,'tenants'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_tenant_get': {
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $tid2 = (int)($input_data['id'] ?? $_GET['id'] ?? 0);
        if (!$tid2) { echo json_encode(['success'=>false,'message'=>'id مطلوب'], JSON_UNESCAPED_UNICODE); break; }
        $q = $conn->query("SELECT * FROM tenants WHERE id=$tid2 LIMIT 1");
        if (!$q || !($row = $q->fetch_assoc())) { echo json_encode(['success'=>false,'message'=>'مستأجر غير موجود'], JSON_UNESCAPED_UNICODE); break; }
        // إعدادات المنشأة
        $sq = $conn->query("SELECT skey,sval FROM acc_settings WHERE tenant_id=$tid2");
        $settings = [];
        while ($sr = $sq->fetch_assoc()) $settings[$sr['skey']] = $sr['sval'];
        // المستخدمون
        $uq = $conn->query("SELECT id,name,email,role,status FROM users WHERE tenant_id=$tid2 LIMIT 50");
        $users2 = [];
        while ($ur = $uq->fetch_assoc()) $users2[] = $ur;
        echo json_encode(['success'=>true,'tenant'=>$row,'settings'=>$settings,'users'=>$users2], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_tenant_create': {
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $slug  = strtolower(preg_replace('/[^a-z0-9\-]/', '', trim($input_data['slug'] ?? '')));
        $name  = trim($conn->real_escape_string($input_data['name'] ?? ''));
        $oEmail= trim($conn->real_escape_string($input_data['owner_email'] ?? ''));
        $oName = trim($conn->real_escape_string($input_data['owner_name'] ?? ''));
        $plan  = in_array($input_data['plan']??'trial',['trial','starter','pro','enterprise'],'') ? $input_data['plan'] : 'trial';
        $phone = trim($conn->real_escape_string($input_data['phone'] ?? ''));
        $trial = (!empty($input_data['trial_ends'])) ? "'".$conn->real_escape_string($input_data['trial_ends'])."'" : 'DATE_ADD(NOW(), INTERVAL 14 DAY)';
        $notes = trim($conn->real_escape_string($input_data['notes'] ?? ''));
        if (!$slug || !$name || !$oEmail) {
            echo json_encode(['success'=>false,'message'=>'slug + name + owner_email مطلوبة'], JSON_UNESCAPED_UNICODE);
            break;
        }
        // slug فريد
        $chk = $conn->query("SELECT id FROM tenants WHERE slug='$slug' LIMIT 1");
        if ($chk && $chk->num_rows > 0) { echo json_encode(['success'=>false,'message'=>'الـ slug مستخدم — اختر آخر'], JSON_UNESCAPED_UNICODE); break; }

        $conn->query("INSERT INTO tenants (slug,name,plan,owner_email,owner_name,phone,trial_ends,notes)
                      VALUES ('$slug','$name','$plan','$oEmail','$oName','$phone',$trial,'$notes')");
        $newTid = $conn->insert_id;
        if (!$newTid) { echo json_encode(['success'=>false,'message'=>$conn->error], JSON_UNESCAPED_UNICODE); break; }

        // نسخ دليل الحسابات الافتراضي من tenant 1 للمستأجر الجديد
        $accsQ = $conn->query("SELECT code,name,type,parent_id,is_group FROM acc_accounts WHERE tenant_id=1 ORDER BY id");
        $idMap = [];
        while ($ac = $accsQ->fetch_assoc()) {
            $parentSql = ($ac['parent_id'] && isset($idMap[$ac['parent_id']])) ? $idMap[$ac['parent_id']] : 'NULL';
            $code2 = $conn->real_escape_string($ac['code']);
            $name2 = $conn->real_escape_string($ac['name']);
            $type2 = $conn->real_escape_string($ac['type']);
            $conn->query("INSERT INTO acc_accounts (tenant_id,code,name,type,parent_id,is_group)
                          VALUES ($newTid,'$code2','$name2','$type2',$parentSql,{$ac['is_group']})");
            if ($conn->insert_id) $idMap[$ac['id']] = $conn->insert_id; // لاحقًا نحتاج original id
        }
        // إعداد acc_settings الأساسية
        $conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES
            ($newTid,'company_name','$name'),
            ($newTid,'company_email','$oEmail'),
            ($newTid,'company_phone','$phone')
            ON DUPLICATE KEY UPDATE sval=VALUES(sval)");

        // ─ إنشاء المستخدم الأول (مدير المنشأة) ─────────────────────────────
        $tempPass   = substr(str_shuffle('ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#'), 0, 12);
        $tempHash   = password_hash($tempPass, PASSWORD_BCRYPT);
        $nameEsc    = $conn->real_escape_string($oName);
        $emailEsc   = $conn->real_escape_string($oEmail);
        $hashEsc    = $conn->real_escape_string($tempHash);
        $conn->query("INSERT INTO users (name,email,password,role,job,phone,department,permissions,tenant_id,must_change_password)
                      VALUES ('$nameEsc','$emailEsc','$hashEsc','admin','مدير','$phone','الإدارة','[]',$newTid,1)");
        $newUserId = $conn->insert_id;

        // ─ إرسال بيانات الدخول (إيميل + واتساب إن أمكن) ─────────────────────
        $portalUrl  = 'https://semak.sa/login';
        $inviteHtml = email_template(
            'مرحباً بك في نظام ' . htmlspecialchars($name) . ' 🎉',
            'تمّ تفعيل حسابك في منصة سماك للمحاسبة العقارية.'
            . '<br><br><b>بيانات الدخول الأولي:</b><br>'
            . '<table style="margin:12px 0;border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0;color:#64748b">البريد:</td><td><b>' . htmlspecialchars($oEmail) . '</b></td></tr>'
            . '<tr><td style="padding:4px 12px 4px 0;color:#64748b">كلمة المرور المؤقتة:</td><td style="font-size:22px;font-weight:bold;letter-spacing:4px;direction:ltr">' . htmlspecialchars($tempPass) . '</td></tr></table>'
            . 'يُرجى تغيير كلمة المرور بعد أول دخول.',
            ['url' => $portalUrl, 'label' => 'دخول لوحة التحكم']
        );
        $emailSent = send_email($oEmail, 'مرحباً بك · نظام ' . $name, $inviteHtml);
        $waSent    = false;
        if ($phone) {
            $normPhone = preg_replace('/\D/', '', $phone);
            $normPhone = ltrim($normPhone, '0');
            if (substr($normPhone, 0, 3) !== '966') $normPhone = '966' . $normPhone;
            $waSent = wa_send_text($normPhone,
                "🎉 مرحباً {$oName}!\nتمّ تفعيل حسابك في نظام {$name}.\n\n📧 البريد: {$oEmail}\n🔑 كلمة المرور: {$tempPass}\n\nيُرجى الدخول وتغييرها:\n{$portalUrl}");
        }

        acc_audit($conn, $newTid, 'tenant', $newTid, 'create', "slug=$slug | user#$newUserId", 'platform', $_clientIp, $_clientUa);
        echo json_encode([
            'success'    => true,
            'tenant_id'  => $newTid,
            'user_id'    => $newUserId,
            'slug'       => $slug,
            'email_sent' => !empty($emailSent['ok']),
            'wa_sent'    => $waSent,
            'message'    => 'تم إنشاء المستأجر والمستخدم الأول بنجاح',
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // التسجيل الذاتي للمستأجر — لا يحتاج مصادقة
    // ─────────────────────────────────────────────────────────────────────────
    case 'platform_register': {
        $company  = trim((string)($input_data['company_name'] ?? ''));
        $email    = strtolower(trim((string)($input_data['email'] ?? '')));
        $phone    = trim((string)($input_data['phone'] ?? ''));
        $password = (string)($input_data['password'] ?? '');
        $adminName = trim((string)($input_data['admin_name'] ?? 'مدير النظام'));

        if (!$company || !$email || !$password) {
            echo json_encode(['success'=>false,'message'=>'الاسم والبريد وكلمة المرور مطلوبة'], JSON_UNESCAPED_UNICODE); break;
        }
        if (strlen($password) < 8) {
            echo json_encode(['success'=>false,'message'=>'كلمة المرور يجب أن تكون 8 أحرف على الأقل'], JSON_UNESCAPED_UNICODE); break;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success'=>false,'message'=>'البريد الإلكتروني غير صحيح'], JSON_UNESCAPED_UNICODE); break;
        }

        $emailEsc   = $conn->real_escape_string($email);
        $alreadyUsr = $conn->query("SELECT id FROM users WHERE email='$emailEsc' LIMIT 1");
        if ($alreadyUsr && $alreadyUsr->num_rows > 0) {
            echo json_encode(['success'=>false,'message'=>'هذا البريد الإلكتروني مسجّل مسبقاً'], JSON_UNESCAPED_UNICODE); break;
        }

        // توليد slug من اسم الشركة
        $rawSlug  = strtolower(preg_replace('/[^a-z0-9\-]/', '', str_replace(' ', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $company))));
        if (!$rawSlug) $rawSlug = 'tenant-' . time();
        $baseSlug = $rawSlug;
        $slugIdx  = 1;
        while (true) {
            $trySlug = $conn->real_escape_string($rawSlug);
            $sc = $conn->query("SELECT id FROM tenants WHERE slug='$trySlug' LIMIT 1");
            if (!$sc || $sc->num_rows === 0) break;
            $rawSlug = $baseSlug . '-' . (++$slugIdx);
        }

        $nameEsc   = $conn->real_escape_string($company);
        $anameEsc  = $conn->real_escape_string($adminName);   // اسم المدير (مختلف عن اسم الشركة)
        $phoneEsc  = $conn->real_escape_string($phone);
        $trialEnd  = date('Y-m-d', strtotime('+14 days'));
        $slugEsc   = $conn->real_escape_string($rawSlug);
        $conn->query("INSERT INTO tenants (slug,name,plan,owner_email,owner_name,phone,trial_ends,status)
                      VALUES ('$slugEsc','$nameEsc','trial','$emailEsc','$anameEsc','$phoneEsc','$trialEnd','active')");
        $newTid = (int)$conn->insert_id;
        if (!$newTid) {
            echo json_encode(['success'=>false,'message'=>'خطأ في إنشاء الحساب، يرجى المحاولة مرة أخرى: ' . $conn->error], JSON_UNESCAPED_UNICODE); break;
        }

        // نسخ دليل الحسابات الافتراضي من tenant 1
        $accsQ = $conn->query("SELECT code,name,type,parent_id,is_group FROM acc_accounts WHERE tenant_id=1 ORDER BY id");
        $idMap = [];
        while ($ac = $accsQ->fetch_assoc()) {
            $parentSql = ($ac['parent_id'] && isset($idMap[$ac['parent_id']])) ? $idMap[$ac['parent_id']] : 'NULL';
            $code2 = $conn->real_escape_string($ac['code']);
            $name2 = $conn->real_escape_string($ac['name']);
            $type2 = $conn->real_escape_string($ac['type']);
            $conn->query("INSERT INTO acc_accounts (tenant_id,code,name,type,parent_id,is_group)
                          VALUES ($newTid,'$code2','$name2','$type2',$parentSql,{$ac['is_group']})");
            if ($conn->insert_id) $idMap[$ac['id']] = $conn->insert_id;
        }

        // الإعدادات الأساسية
        $conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES
            ($newTid,'company_name','$nameEsc'),
            ($newTid,'company_email','$emailEsc'),
            ($newTid,'company_phone','$phoneEsc')
            ON DUPLICATE KEY UPDATE sval=VALUES(sval)");

        // إنشاء المستخدم الأول — كلمة مروره يختارها بنفسه (must_change_password=0)
        $hash     = password_hash($password, PASSWORD_BCRYPT);
        $hashEsc  = $conn->real_escape_string($hash);
        $conn->query("INSERT INTO users (name,email,password,role,job,phone,department,permissions,tenant_id,must_change_password)
                      VALUES ('$anameEsc','$emailEsc','$hashEsc','admin','مدير','$phoneEsc','الإدارة','[]',$newTid,0)");
        $newUid = (int)$conn->insert_id;

        // إصدار JWT (Admin JWT — يُسجّل دخوله مباشرة)
        $payload = ['sub'=>$newUid,'role'=>'admin','tid'=>$newTid,'iat'=>time(),'exp'=>time()+86400*30];
        $_newJwt = jwt_sign($payload, TOKEN_SECRET);

        // إيميل ترحيب
        $portalUrl  = 'https://semak.sa/admin/dashboard';
        $welcomeHtml = email_template(
            'أهلاً بك في ' . htmlspecialchars($company) . '! 🎉',
            'تمّ إنشاء حسابك بنجاح. يمكنك الآن الدخول إلى لوحة التحكم.'
            . '<br><br><b>تفاصيل حسابك:</b><br>'
            . '<table style="margin:12px 0;border-collapse:collapse">'
            . '<tr><td style="padding:4px 12px 4px 0;color:#64748b">الشركة:</td><td><b>' . htmlspecialchars($company) . '</b></td></tr>'
            . '<tr><td style="padding:4px 12px 4px 0;color:#64748b">البريد:</td><td><b>' . htmlspecialchars($email) . '</b></td></tr>'
            . '<tr><td style="padding:4px 12px 4px 0;color:#64748b">انتهاء التجربة:</td><td><b>' . $trialEnd . '</b></td></tr>'
            . '</table>',
            ['url' => $portalUrl, 'label' => 'الدخول للوحة التحكم']
        );
        send_email($email, 'أهلاً بك في ' . $company, $welcomeHtml);
        if ($phone) {
            $normPhone = preg_replace('/\D/', '', $phone);
            $normPhone = ltrim($normPhone, '0');
            if (substr($normPhone, 0, 3) !== '966') $normPhone = '966' . $normPhone;
            wa_send_text($normPhone, "🎉 أهلاً بك في {$company}!\nتمّت التجربة المجانية لمدة 14 يوماً تنتهي في {$trialEnd}.\n\nادخل لوحة التحكم:\n{$portalUrl}");
        }

        acc_audit($conn, $newTid, 'tenant', $newTid, 'self_register', "email=$email|tid=$newTid", 'public', $_clientIp, $_clientUa);
        echo json_encode([
            'success'    => true,
            'message'    => 'تمّ إنشاء حسابك بنجاح 🎉',
            'jwt'        => $_newJwt,
            'trial_ends' => $trialEnd,
            'data'       => [
                'id'                  => $newUid,
                'name'                => $adminName,
                'email'               => $email,
                'role'                => 'admin',
                'tenant_id'           => $newTid,
                'must_change_password'=> 0,
            ],
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_tenant_update': {
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $tid2   = (int)($input_data['id'] ?? 0);
        if (!$tid2) { echo json_encode(['success'=>false,'message'=>'id مطلوب'], JSON_UNESCAPED_UNICODE); break; }
        $fields = [];
        foreach (['name','owner_email','owner_name','phone','plan','status','logo_url','domain','primary_color','max_users','notes','trial_ends'] as $f) {
            if (isset($input_data[$f])) {
                if ($f === 'plan')   $val = in_array($input_data[$f],['trial','starter','pro','enterprise']) ? $input_data[$f] : 'trial';
                elseif ($f === 'status') $val = in_array($input_data[$f],['active','suspended','cancelled']) ? $input_data[$f] : 'active';
                elseif ($f === 'max_users') $val = max(1,(int)$input_data[$f]);
                else $val = $conn->real_escape_string($input_data[$f]);
                $fields[] = "`$f`=" . (is_int($val) ? $val : "'$val'");
            }
        }
        if (empty($fields)) { echo json_encode(['success'=>false,'message'=>'لا توجد حقول للتحديث'], JSON_UNESCAPED_UNICODE); break; }
        $conn->query("UPDATE tenants SET " . implode(',', $fields) . " WHERE id=$tid2");
        acc_audit($conn, $tid2, 'tenant', $tid2, 'update', implode('|', $fields), 'platform', $_clientIp, $_clientUa);
        echo json_encode(['success'=>true,'message'=>'تم التحديث'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_stats': {
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        // أسعار الخطط الشهرية (SAR) — يمكن نقلها لجدول billing لاحقاً
        $planPrices = ['trial'=>0,'starter'=>299,'pro'=>599,'enterprise'=>1499];

        $total      = (int)$conn->query("SELECT COUNT(*) c FROM tenants")->fetch_assoc()['c'];
        $active     = (int)$conn->query("SELECT COUNT(*) c FROM tenants WHERE status='active'")->fetch_assoc()['c'];
        $suspended  = (int)$conn->query("SELECT COUNT(*) c FROM tenants WHERE status='suspended'")->fetch_assoc()['c'];
        $cancelled  = (int)$conn->query("SELECT COUNT(*) c FROM tenants WHERE status='cancelled'")->fetch_assoc()['c'];
        $trial      = (int)$conn->query("SELECT COUNT(*) c FROM tenants WHERE plan='trial' AND status='active'")->fetch_assoc()['c'];
        $paid       = (int)$conn->query("SELECT COUNT(*) c FROM tenants WHERE plan!='trial' AND status='active'")->fetch_assoc()['c'];
        $newMonth   = (int)$conn->query("SELECT COUNT(*) c FROM tenants WHERE created_at>=DATE_FORMAT(NOW(),'%Y-%m-01')")->fetch_assoc()['c'];
        $users      = (int)$conn->query("SELECT COUNT(*) c FROM users")->fetch_assoc()['c'];
        $invs       = (int)$conn->query("SELECT COUNT(*) c FROM acc_invoices")->fetch_assoc()['c'];
        // MRR: sum pricing per paid active tenant
        $mrr = 0;
        $planR = $conn->query("SELECT plan, COUNT(*) n FROM tenants WHERE status='active' AND plan!='trial' GROUP BY plan");
        if ($planR) { while ($pr = $planR->fetch_assoc()) { $mrr += ($planPrices[$pr['plan']] ?? 0) * (int)$pr['n']; } }
        // تجربة منتهية (trial_ends < today, status still active — مرشحون للإيقاف)
        $expiredTrials = (int)$conn->query("SELECT COUNT(*) c FROM tenants WHERE plan='trial' AND status='active' AND trial_ends < CURDATE()")->fetch_assoc()['c'];
        echo json_encode(['success'=>true,'stats'=>compact(
            'total','active','suspended','cancelled','trial','paid',
            'newMonth','users','invs','mrr','expiredTrials'
        )], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_resend_invite': {
        // إعادة إرسال بيانات الدخول لمدير المستأجر
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $tid = (int)($input_data['id'] ?? 0);
        if (!$tid) { echo json_encode(['success'=>false,'message'=>'id مطلوب'], JSON_UNESCAPED_UNICODE); break; }
        $tRes = $conn->query("SELECT * FROM tenants WHERE id=$tid LIMIT 1");
        $ten  = $tRes ? $tRes->fetch_assoc() : null;
        if (!$ten) { echo json_encode(['success'=>false,'message'=>'المستأجر غير موجود'], JSON_UNESCAPED_UNICODE); break; }
        // أول مدير للمستأجر
        $uRes = $conn->query("SELECT id,name,email,phone FROM users WHERE tenant_id=$tid AND role='admin' ORDER BY id ASC LIMIT 1");
        $usr  = $uRes ? $uRes->fetch_assoc() : null;
        if (!$usr) { echo json_encode(['success'=>false,'message'=>'لا يوجد مستخدم مدير لهذا المستأجر'], JSON_UNESCAPED_UNICODE); break; }
        // توليد كلمة مرور مؤقتة جديدة
        $chars    = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
        $tempPass = substr(str_shuffle($chars), 0, 12);
        $tempHash = password_hash($tempPass, PASSWORD_BCRYPT);
        $hashEsc  = $conn->real_escape_string($tempHash);
        $conn->query("UPDATE users SET password='$hashEsc', must_change_password=1 WHERE id={$usr['id']}");
        // إرسال دعوة جديدة
        $portalUrl  = 'https://semak.sa/login';
        $oName = $ten['owner_name']; $oEmail = $ten['owner_email']; $phone = $ten['phone'];
        $name  = $ten['name'];
        $inviteHtml = email_template(
            'بيانات دخول جديدة — ' . htmlspecialchars($name),
            'تم تجديد بيانات دخولك إلى النظام.'
            . '<br><br><b>بيانات الدخول المحدّثة:</b><br>'
            . '<table style="margin:12px 0;border-collapse:collapse">'
            . '<tr><td style="padding:4px 12px 4px 0;color:#64748b">البريد:</td><td><b>' . htmlspecialchars($usr['email']) . '</b></td></tr>'
            . '<tr><td style="padding:4px 12px 4px 0;color:#64748b">كلمة المرور المؤقتة:</td><td><b>' . htmlspecialchars($tempPass) . '</b></td></tr>'
            . '</table>'
            . '<p style="color:#ef4444;font-size:13px">⚠️ ستُطلب منك تغيير كلمة المرور عند أول دخول.</p>',
            ['label'=>'الدخول للنظام','url'=>$portalUrl]
        );
        $emailSent = send_email($usr['email'], $oName, 'بيانات دخول جديدة — ' . $name, $inviteHtml);
        $waSent = false;
        if ($phone) {
            $waText  = "مرحباً {$oName}،\n\nتم تجديد بيانات دخولك لنظام *{$name}*:\n\n";
            $waText .= "📧 البريد: {$usr['email']}\n🔑 كلمة المرور: {$tempPass}\n\n";
            $waText .= "⚠️ ستُطلب منك تغييرها عند أول دخول.\n\n🔗 الدخول: {$portalUrl}";
            $waSent = send_whatsapp($phone, $waText);
        }
        echo json_encode(['success'=>true,'email_sent'=>$emailSent,'wa_sent'=>$waSent,'message'=>'تم إرسال بيانات الدخول الجديدة'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_trial_reminders': {
        // إرسال تذكيرات انتهاء التجربة تلقائياً — منصة فقط
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $today    = date('Y-m-d');
        $in3days  = date('Y-m-d', strtotime('+3 days'));
        $in7days  = date('Y-m-d', strtotime('+7 days'));
        $yesterday= date('Y-m-d', strtotime('-1 day'));

        // مستأجرون تنتهي تجربتهم خلال 7 أيام (لم ترسل لهم تذكير اليوم)
        $soonR = $conn->query("SELECT t.*,
                   (SELECT email FROM users WHERE tenant_id=t.id AND role='admin' ORDER BY id ASC LIMIT 1) admin_email,
                   (SELECT name  FROM users WHERE tenant_id=t.id AND role='admin' ORDER BY id ASC LIMIT 1) admin_name
                 FROM tenants t
                 WHERE t.plan='trial' AND t.status='active'
                   AND t.trial_ends >= '$today' AND t.trial_ends <= '$in7days'
                 ORDER BY t.trial_ends ASC LIMIT 50");
        $expiredR = $conn->query("SELECT t.*,
                   (SELECT email FROM users WHERE tenant_id=t.id AND role='admin' ORDER BY id ASC LIMIT 1) admin_email,
                   (SELECT name  FROM users WHERE tenant_id=t.id AND role='admin' ORDER BY id ASC LIMIT 1) admin_name
                 FROM tenants t
                 WHERE t.plan='trial' AND t.status='active'
                   AND t.trial_ends < '$today' AND t.trial_ends >= '$yesterday'
                 LIMIT 20");

        $sent = []; $failed = [];
        $upgradeUrl = 'https://wa.me/966920032842?text=' . rawurlencode('أود ترقية اشتراكي في سماك');
        $loginUrl   = 'https://semak.sa/login';

        $sendReminder = function($rows, $type) use ($conn, $upgradeUrl, $loginUrl, &$sent, &$failed) {
            while ($rows && ($t = $rows->fetch_assoc())) {
                if (empty($t['admin_email'])) continue;
                $days  = (int)ceil((strtotime($t['trial_ends']) - time()) / 86400);
                $name  = $t['name'];
                $aName = $t['admin_name'] ?? $t['owner_name'] ?? 'عزيزي المدير';
                $aEmail= $t['admin_email'];
                if ($type === 'soon') {
                    $subj  = "تجربة سماك تنتهي خلال {$days} " . ($days === 1 ? 'يوم' : 'أيام');
                    $body  = "مرحباً {$aName}،<br><br>تنتهي فترة تجربتك المجانية في نظام <b>" . htmlspecialchars($name)
                           . "</b> خلال <b>{$days} " . ($days===1?'يوم':'أيام') . "</b> ({$t['trial_ends']}).<br><br>"
                           . "لمواصلة الاستخدام دون انقطاع، يرجى ترقية اشتراكك قبل انتهاء المدة.<br><br>"
                           . "تواصل معنا الآن وسنساعدك في اختيار الباقة المناسبة لشركتك.";
                } else {
                    $subj  = "انتهت فترة التجربة المجانية في سماك";
                    $body  = "مرحباً {$aName}،<br><br>انتهت فترة تجربتك المجانية في نظام <b>" . htmlspecialchars($name) . "</b>.<br><br>"
                           . "لإعادة تفعيل حسابك والاحتفاظ بجميع بياناتك، تواصل معنا لترقية الاشتراك.<br><br>"
                           . "<b>ملاحظة:</b> سيُوقف الحساب تلقائياً عند محاولة الدخول إذا لم يتم الاشتراك.";
                }
                $html = email_template($subj, $body,
                    ['label' => 'ترقية الاشتراك الآن', 'url' => $upgradeUrl]);
                $ok = send_email($aEmail, $aName, $subj, $html);
                if ($ok) {
                    $sent[]   = ['id'=>(int)$t['id'],'name'=>$name,'email'=>$aEmail,'days'=>$type==='soon'?$days:0,'type'=>$type];
                    $conn->query("UPDATE tenants SET notes=CONCAT(IFNULL(notes,''),'[تذكير {$type} " . date('Y-m-d') . "] ') WHERE id={$t['id']}");
                } else {
                    $failed[] = ['id'=>(int)$t['id'],'name'=>$name,'email'=>$aEmail];
                }
            }
        };

        $sendReminder($soonR,    'soon');
        $sendReminder($expiredR, 'expired');
        echo json_encode(['success'=>true,'sent'=>$sent,'failed'=>$failed,
                          'total_sent'=>count($sent),'total_failed'=>count($failed)], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_plan_list': {
        // قائمة خطط الاشتراك (منصة فقط)
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $rows = []; $r = $conn->query("SELECT * FROM plans ORDER BY sort_order ASC");
        while ($r && $x = $r->fetch_assoc()) $rows[] = $x;
        echo json_encode(['success'=>true,'plans'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_plan_save': {
        // إضافة أو تعديل خطة (منصة فقط)
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $id    = (int)($input_data['id'] ?? 0);
        $code  = $conn->real_escape_string(strtolower(trim($input_data['code'] ?? '')));
        $name  = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $prM   = (float)($input_data['price_monthly'] ?? 0);
        $prY   = (float)($input_data['price_yearly']  ?? 0);
        $maxU  = max(1,(int)($input_data['max_users'] ?? 5));
        $sort  = (int)($input_data['sort_order'] ?? 0);
        $flags = $conn->real_escape_string(is_string($input_data['feature_flags'] ?? '') ? ($input_data['feature_flags'] ?? '{}') : json_encode($input_data['feature_flags'] ?? new stdClass()));
        $active= isset($input_data['is_active']) ? (int)$input_data['is_active'] : 1;
        if (!$name || !$code) { echo json_encode(['success'=>false,'message'=>'code و name مطلوبان'], JSON_UNESCAPED_UNICODE); break; }
        if ($id > 0) {
            $conn->query("UPDATE plans SET code='$code',name='$name',price_monthly=$prM,price_yearly=$prY,max_users=$maxU,feature_flags='$flags',is_active=$active,sort_order=$sort WHERE id=$id");
        } else {
            $conn->query("INSERT INTO plans (code,name,price_monthly,price_yearly,max_users,feature_flags,is_active,sort_order) VALUES ('$code','$name',$prM,$prY,$maxU,'$flags',$active,$sort)");
            $id = $conn->insert_id;
        }
        echo json_encode(['success'=>true,'id'=>$id], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'platform_subscription_update': {
        // تغيير خطة مستأجر (منصة فقط)
        if (!$_plat_claims) { echo json_encode(['success'=>false,'message'=>'غير مصرح'], JSON_UNESCAPED_UNICODE); break; }
        $tid2  = (int)($input_data['tenant_id'] ?? 0);
        $planCode = $conn->real_escape_string($input_data['plan_code'] ?? '');
        if (!$tid2 || !$planCode) { echo json_encode(['success'=>false,'message'=>'tenant_id و plan_code مطلوبان'], JSON_UNESCAPED_UNICODE); break; }
        $pr = $conn->query("SELECT id,max_users FROM plans WHERE code='$planCode' LIMIT 1");
        if (!$pr || !($pl = $pr->fetch_assoc())) { echo json_encode(['success'=>false,'message'=>'خطة غير موجودة'], JSON_UNESCAPED_UNICODE); break; }
        $planId = (int)$pl['id']; $maxU = (int)$pl['max_users'];
        $conn->query("INSERT INTO subscriptions (tenant_id,plan_id,billing_cycle,starts_at,auto_renew)
                      VALUES ($tid2,$planId,'yearly',CURDATE(),1)
                      ON DUPLICATE KEY UPDATE plan_id=$planId,starts_at=CURDATE(),auto_renew=1,cancelled_at=NULL");
        // تحديث tenants.plan للتوافق مع الكود القديم
        $planEsc = in_array($planCode,['trial','starter','pro','enterprise']) ? $planCode : 'trial';
        $conn->query("UPDATE tenants SET plan='$planEsc',max_users=$maxU WHERE id=$tid2");
        acc_audit($conn, $tid2, 'subscription', $tid2, 'update', "plan=$planCode", 'platform', $_clientIp, $_clientUa);
        echo json_encode(['success'=>true,'message'=>'تم تحديث الخطة'], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ─── هوية المنشأة (للفرونت-إند: ألوان + شعار + اسم) ────────────────────────
    case 'tenant_branding': {
        // endpoint عام — يُرجع إعدادات الهوية البصرية + بيانات الاشتراك
        // إذا لم يكن JWT وكان ?unit= موجوداً → ابحث عن المستأجر من رمز الوحدة (بوابة العملاء)
        $btid = $_jwt_tid ?? null;
        if (!$btid) {
            $unitCode = $conn->real_escape_string(trim((string)($_GET['unit'] ?? '')));
            if ($unitCode) {
                $uq = $conn->query("SELECT p.tenant_id FROM units u
                                     JOIN projects p ON u.project_id=p.id
                                     WHERE u.unit_code='$unitCode' LIMIT 1");
                if ($uq && ($ur = $uq->fetch_assoc())) $btid = (int)$ur['tenant_id'];
            }
        }
        if (!$btid) $btid = 1;   // fallback نهائي — المستأجر الأول
        $tq = $conn->query("SELECT name,status,primary_color,logo_url,slug,plan,trial_ends FROM tenants WHERE id=$btid LIMIT 1");
        $tenant = $tq ? $tq->fetch_assoc() : null;
        if (!$tenant || $tenant['status'] === 'cancelled') {
            echo json_encode(['success'=>false,'message'=>'المستأجر غير موجود أو ملغى'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $sq = $conn->query("SELECT skey,sval FROM acc_settings WHERE tenant_id=$btid AND skey IN ('company_name','company_logo','primary_color','company_phone','company_email','company_address','cr_number','vat_number')");
        $s = [];
        while ($sr = $sq->fetch_assoc()) $s[$sr['skey']] = $sr['sval'];
        // احسب الأيام المتبقية للتجربة
        $daysLeft = null;
        if ($tenant['plan'] === 'trial' && $tenant['trial_ends']) {
            $daysLeft = (int)ceil((strtotime($tenant['trial_ends']) - time()) / 86400);
        }
        echo json_encode([
            'success'        => true,
            'tenant_id'      => $btid,
            'slug'           => $tenant['slug'],
            'company_name'   => $s['company_name']   ?? $tenant['name'],
            'primary_color'  => $s['primary_color']  ?? $tenant['primary_color'] ?? '#c5a059',
            'logo_url'       => $s['company_logo']   ?? $tenant['logo_url'] ?? null,
            'company_phone'  => $s['company_phone']  ?? '',
            'company_email'  => $s['company_email']  ?? '',
            'company_address'=> $s['company_address'] ?? '',
            'cr_number'      => $s['cr_number']      ?? '',
            'vat_number'     => $s['vat_number']     ?? '',
            'plan'           => $tenant['plan']       ?? 'trial',
            'status'         => $tenant['status']     ?? 'active',
            'trial_ends'     => $tenant['trial_ends'] ?? null,
            'days_left'      => $daysLeft,
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ─── المصادقة ───────────────────────────────────────────────────────────

    case 'login':
        $email   = $conn->real_escape_string($input_data['email'] ?? '');
        $rawPass = (string)($input_data['password'] ?? ''); // لا نهرب — نقارنها مع الهاش
        $ip      = $conn->real_escape_string($_SERVER['REMOTE_ADDR'] ?? '');
        // جلب المستخدم بالإيميل فقط أولاً ثم نتحقق من كلمة المرور بشكل آمن
        $res = $conn->query("SELECT * FROM users WHERE email='$email' LIMIT 1");
        $loginOk = false; $row = null;
        if ($res && ($row = $res->fetch_assoc())) {
            $stored = $row['password'] ?? '';
            if (strlen($stored) > 40 && ($stored[0] ?? '') === '$') {
                // مُشفَّر مسبقًا (bcrypt/argon)
                $loginOk = password_verify($rawPass, $stored);
            } else {
                // نص صريح — فحص مباشر + ترقية فورية للـ bcrypt
                $loginOk = ($stored === $rawPass);
                if ($loginOk) {
                    $h = password_hash($rawPass, PASSWORD_BCRYPT);
                    $he = $conn->real_escape_string($h);
                    $conn->query("UPDATE users SET password='$he' WHERE id={$row['id']}");
                }
            }
        }
        if ($loginOk) {
            $uid   = (int)$row['id'];
            $twofa = (int)($row['twofa'] ?? 0);

            // ── التحقق من حالة المستأجر قبل إتمام الدخول ──────────────────
            $loginTid = (int)($row['tenant_id'] ?? 1);
            $tCheck   = $conn->query("SELECT status, plan, trial_ends FROM tenants WHERE id=$loginTid LIMIT 1");
            if ($tCheck && ($tRow = $tCheck->fetch_assoc())) {
                // تجريبي منتهي؟ أوقّفه تلقائياً
                if ($tRow['plan'] === 'trial' && $tRow['status'] === 'active'
                    && $tRow['trial_ends'] && $tRow['trial_ends'] < date('Y-m-d')) {
                    $conn->query("UPDATE tenants SET status='suspended' WHERE id=$loginTid");
                    $tRow['status'] = 'suspended';
                }
                if ($tRow['status'] === 'suspended') {
                    acc_audit($conn, 1, 'auth', $uid, 'login_fail', 'حساب موقوف', $row['email'] ?? $email, $_clientIp, $_clientUa);
                    echo json_encode(['success'=>false,'message'=>'حساب شركتك موقوف مؤقتاً — تواصل مع الدعم لإعادة التفعيل','code'=>'tenant_suspended'], JSON_UNESCAPED_UNICODE);
                    break;
                }
                if ($tRow['status'] === 'cancelled') {
                    acc_audit($conn, 1, 'auth', $uid, 'login_fail', 'حساب ملغى', $row['email'] ?? $email, $_clientIp, $_clientUa);
                    echo json_encode(['success'=>false,'message'=>'هذا الحساب غير نشط — تواصل مع الدعم','code'=>'tenant_cancelled'], JSON_UNESCAPED_UNICODE);
                    break;
                }
            }

            // ── التحقق بخطوتين مُفعّل لهذا المستخدم؟ ──
            if ($twofa === 1) {
                // جهاز موثوق سابقًا؟ تخطَّ الرمز
                $dev = isset($input_data['device_token']) ? trim((string)$input_data['device_token']) : '';
                if ($dev !== '') {
                    $dh  = hash('sha256', $dev);
                    $now = date('Y-m-d H:i:s');
                    $tr  = $conn->query("SELECT id FROM trusted_devices WHERE user_id=$uid AND token_hash='$dh' AND expires_at > '$now' LIMIT 1");
                    if ($tr && $tr->num_rows > 0) {
                        unset($row['password']);
                        acc_audit($conn, 1, 'auth', $uid, 'login', 'جهاز موثوق', $row['email'] ?? $email, $_clientIp, $_clientUa);
                        $_jwt = jwt_sign(['sub'=>$uid,'tid'=>(int)($row['tenant_id']??1),'role'=>$row['role']??'admin','iat'=>time(),'exp'=>time()+28800]);
                        echo json_encode(["success" => true, "data" => $row, "jwt" => $_jwt, "must_change_password" => (int)($row['must_change_password'] ?? 0)]);
                        break;
                    }
                }
                // أنشئ رمزًا وأرسله عبر القناة المختارة أو الافتراضية
                $channel = $input_data['channel'] ?? ($row['twofa_channel'] ?? 'email');
                $channel = ($channel === 'whatsapp') ? 'whatsapp' : 'email';
                $ticket  = bin2hex(random_bytes(16));
                $code    = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                $expires = date('Y-m-d H:i:s', time() + 600);
                $conn->query("DELETE FROM login_otp WHERE user_id=$uid");
                $tk = $conn->real_escape_string($ticket);
                $cd = $conn->real_escape_string($code);
                $cl = $conn->real_escape_string($channel);
                $conn->query("INSERT INTO login_otp (user_id,ticket,code,channel,expires_at) VALUES ($uid,'$tk','$cd','$cl','$expires')");
                $sent = send_login_otp($row, $channel, $code);
                acc_audit($conn, 1, 'auth', $uid, 'otp_sent', 'قناة=' . $channel, $row['email'] ?? $email, $_clientIp, $_clientUa);
                echo json_encode([
                    "success"      => true,
                    "otp_required" => true,
                    "ticket"       => $ticket,
                    "channel"      => $channel,
                    "sent"         => $sent,
                    "masked_email" => mask_email($row['email'] ?? ''),
                    "masked_phone" => mask_phone($row['phone'] ?? ''),
                    "has_email"    => !empty($row['email']),
                    "has_phone"    => !empty($row['phone']),
                ]);
                break;
            }

            // ── الوضع الاعتيادي (بدون تحقق بخطوتين) ──
            unset($row['password']);
            acc_audit($conn, 1, 'auth', $uid, 'login', 'تسجيل دخول ناجح', $row['email'] ?? $email, $_clientIp, $_clientUa);
            $_jwt = jwt_sign(['sub'=>$uid,'tid'=>(int)($row['tenant_id']??1),'role'=>$row['role']??'admin','iat'=>time(),'exp'=>time()+28800]);
            echo json_encode(["success" => true, "data" => $row, "jwt" => $_jwt, "must_change_password" => (int)($row['must_change_password'] ?? 0)]);
        } else {
            acc_audit($conn, 1, 'auth', null, 'login_fail', 'محاولة فاشلة', $input_data['email'] ?? '', $_clientIp, $_clientUa);
            echo json_encode(["success" => false, "message" => "البريد الإلكتروني أو كلمة المرور غير صحيحة"]);
        }
        break;

    // ─── إعادة إرسال رمز الدخول / تبديل القناة (واتساب ⇄ إيميل) ───────────────
    case 'login_send_otp': {
        $ticket  = $conn->real_escape_string(trim($input_data['ticket'] ?? ''));
        $channel = (($input_data['channel'] ?? '') === 'whatsapp') ? 'whatsapp' : 'email';
        if ($ticket === '') { echo json_encode(['success' => false, 'message' => 'جلسة غير صالحة']); break; }
        $now = date('Y-m-d H:i:s');
        $r = $conn->query("SELECT * FROM login_otp WHERE ticket='$ticket' AND expires_at > '$now' LIMIT 1");
        if (!$r || $r->num_rows === 0) { echo json_encode(['success' => false, 'message' => 'انتهت صلاحية الجلسة، أعد تسجيل الدخول']); break; }
        $otp  = $r->fetch_assoc();
        $uid  = (int)$otp['user_id'];
        $ur   = $conn->query("SELECT * FROM users WHERE id=$uid LIMIT 1");
        $user = $ur ? $ur->fetch_assoc() : null;
        if (!$user) { echo json_encode(['success' => false, 'message' => 'المستخدم غير موجود']); break; }
        $code    = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expires = date('Y-m-d H:i:s', time() + 600);
        $cd = $conn->real_escape_string($code);
        $cl = $conn->real_escape_string($channel);
        $conn->query("UPDATE login_otp SET code='$cd', channel='$cl', expires_at='$expires', attempts=0 WHERE ticket='$ticket'");
        $sent = send_login_otp($user, $channel, $code);
        echo json_encode([
            'success' => true, 'channel' => $channel, 'sent' => $sent,
            'masked_email' => mask_email($user['email'] ?? ''),
            'masked_phone' => mask_phone($user['phone'] ?? ''),
        ]);
        break;
    }

    // ─── التحقق من رمز الدخول وإصدار الجلسة ──────────────────────────────────
    case 'verify_login_otp': {
        $ticket   = $conn->real_escape_string(trim($input_data['ticket'] ?? ''));
        $code     = $conn->real_escape_string(trim($input_data['code'] ?? ''));
        $remember = !empty($input_data['remember_device']);
        $ip       = $conn->real_escape_string($_SERVER['REMOTE_ADDR'] ?? '');
        if ($ticket === '' || $code === '') { echo json_encode(['success' => false, 'message' => 'بيانات ناقصة']); break; }
        $now = date('Y-m-d H:i:s');
        $r = $conn->query("SELECT * FROM login_otp WHERE ticket='$ticket' AND expires_at > '$now' LIMIT 1");
        if (!$r || $r->num_rows === 0) { echo json_encode(['success' => false, 'message' => 'انتهت صلاحية الرمز، أعد تسجيل الدخول']); break; }
        $otp = $r->fetch_assoc();
        $oid = (int)$otp['id'];
        if ((int)$otp['attempts'] >= 5) {
            $conn->query("DELETE FROM login_otp WHERE id=$oid");
            echo json_encode(['success' => false, 'message' => 'محاولات كثيرة، أعد تسجيل الدخول']); break;
        }
        if (!hash_equals((string)$otp['code'], (string)$code)) {
            $conn->query("UPDATE login_otp SET attempts=attempts+1 WHERE id=$oid");
            acc_audit($conn, 1, 'auth', (int)$otp['user_id'], 'otp_fail', 'رمز خاطئ', '', $_clientIp, $_clientUa);
            echo json_encode(['success' => false, 'message' => 'الرمز غير صحيح']); break;
        }
        $uid = (int)$otp['user_id'];
        $conn->query("DELETE FROM login_otp WHERE user_id=$uid");
        $ur   = $conn->query("SELECT * FROM users WHERE id=$uid LIMIT 1");
        $user = $ur ? $ur->fetch_assoc() : null;
        if (!$user) { echo json_encode(['success' => false, 'message' => 'المستخدم غير موجود']); break; }
        unset($user['password']);
        $device_token = null;
        if ($remember) {
            $device_token = bin2hex(random_bytes(32));
            $dh    = hash('sha256', $device_token);
            $exp   = date('Y-m-d H:i:s', time() + 30 * 86400);
            $label = $conn->real_escape_string(substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 150));
            $conn->query("INSERT INTO trusted_devices (user_id,token_hash,label,expires_at) VALUES ($uid,'$dh','$label','$exp')");
        }
        acc_audit($conn, 1, 'auth', $uid, 'login', 'دخول بتحقق خطوتين', $user['email'] ?? '', $_clientIp, $_clientUa);
        $_jwt = jwt_sign(['sub'=>$uid,'tid'=>(int)($user['tenant_id']??1),'role'=>$user['role']??'admin','iat'=>time(),'exp'=>time()+28800]);
        echo json_encode(['success' => true, 'data' => $user, 'jwt' => $_jwt, 'device_token' => $device_token, 'must_change_password' => (int)($user['must_change_password'] ?? 0)]);
        break;
    }

    // ─── تفعيل/تعطيل التحقق بخطوتين لمستخدم ──────────────────────────────────
    case 'set_twofa': {
        $uid     = (int)($input_data['user_id'] ?? 0);
        $enabled = !empty($input_data['enabled']) ? 1 : 0;
        $channel = (($input_data['channel'] ?? 'email') === 'whatsapp') ? 'whatsapp' : 'email';
        if ($uid <= 0) { echo json_encode(['success' => false, 'message' => 'مستخدم غير صالح']); break; }
        $cl = $conn->real_escape_string($channel);
        $conn->query("UPDATE users SET twofa=$enabled, twofa_channel='$cl' WHERE id=$uid");
        if (!$enabled) $conn->query("DELETE FROM trusted_devices WHERE user_id=$uid");
        acc_audit($conn, 1, 'auth', $uid, 'update', 'التحقق بخطوتين: ' . ($enabled ? 'تفعيل' : 'تعطيل') . ' · ' . $channel, '');
        echo json_encode(['success' => true, 'twofa' => $enabled, 'channel' => $channel]);
        break;
    }

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

        $mottasl_key = MOTTASL_TOKEN;

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

    // ─── دخول موحّد بالـ OTP لكل البوابات ────────────────────────────────────
    // المرحلة 1: استقبال المُعرّف، تحديد القناة، إرسال الرمز (أو طلب الاختيار).
    case 'auth_otp_start': {
        $scope = (($input_data['scope'] ?? 'customer') === 'staff') ? 'staff' : 'customer';
        $det   = auth_detect_identifier($input_data['identifier'] ?? '');
        $type  = $det['type']; $val = $det['value'];
        if ($type === 'unknown' || $val === '') { echo json_encode(['success' => false, 'message' => 'أدخل بريدًا أو رقم جوال أو رقم وحدة']); break; }

        $ip = $conn->real_escape_string($_SERVER['REMOTE_ADDR'] ?? '');
        $rec = null; // ['id','name','email','phone','ref']

        if ($scope === 'staff') {
            // الموظفون: بريد أو جوال فقط (لا وحدة/هوية)
            if ($type === 'email') {
                $e = $conn->real_escape_string($val);
                $q = $conn->query("SELECT id,name,email,phone FROM users WHERE email='$e' LIMIT 1");
                if ($q && $r = $q->fetch_assoc()) $rec = ['id'=>(int)$r['id'],'name'=>$r['name'],'email'=>$r['email'],'phone'=>$r['phone'],'ref'=>'بوابة الموظفين'];
            } elseif ($type === 'phone') {
                $last9 = substr(preg_replace('/\D/', '', $val), -9);
                $le = $conn->real_escape_string($last9);
                $q = $conn->query("SELECT id,name,email,phone FROM users WHERE REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+','') LIKE '%$le%' LIMIT 1");
                if ($q && $r = $q->fetch_assoc()) $rec = ['id'=>(int)$r['id'],'name'=>$r['name'],'email'=>$r['email'],'phone'=>$r['phone'],'ref'=>'بوابة الموظفين'];
            } else {
                echo json_encode(['success' => false, 'message' => 'لدخول الموظفين استخدم البريد أو رقم الجوال']); break;
            }
        } else {
            // العملاء: بريد/جوال/رقم وحدة (الهوية غير مُخزّنة بعد)
            if ($type === 'email') {
                $e = $conn->real_escape_string($val);
                $q = $conn->query("SELECT id,owner_name,owner_email,owner_phone,unit_code FROM owners WHERE owner_email='$e' LIMIT 1");
                if ($q && $r = $q->fetch_assoc()) $rec = ['id'=>(int)$r['id'],'name'=>$r['owner_name'],'email'=>$r['owner_email'],'phone'=>$r['owner_phone'],'ref'=>$r['unit_code']];
            } elseif ($type === 'phone') {
                $last9 = substr(preg_replace('/\D/', '', $val), -9);
                $le = $conn->real_escape_string($last9);
                $q = $conn->query("SELECT id,owner_name,owner_email,owner_phone,unit_code FROM owners WHERE REPLACE(REPLACE(REPLACE(owner_phone,' ',''),'-',''),'+','') LIKE '%$le%' LIMIT 1");
                if ($q && $r = $q->fetch_assoc()) $rec = ['id'=>(int)$r['id'],'name'=>$r['owner_name'],'email'=>$r['owner_email'],'phone'=>$r['owner_phone'],'ref'=>$r['unit_code']];
            } elseif ($type === 'unit') {
                $u = $conn->real_escape_string($val);
                $q = $conn->query("SELECT id,owner_name,owner_email,owner_phone,unit_code FROM owners WHERE UPPER(unit_code)='$u' LIMIT 1");
                if ($q && $r = $q->fetch_assoc()) $rec = ['id'=>(int)$r['id'],'name'=>$r['owner_name'],'email'=>$r['owner_email'],'phone'=>$r['owner_phone'],'ref'=>$r['unit_code']];
            } elseif ($type === 'national_id') {
                $nid = $conn->real_escape_string($val);
                $q = $conn->query("SELECT id,owner_name,owner_email,owner_phone,unit_code FROM owners WHERE national_id='$nid' LIMIT 1");
                if ($q && $r = $q->fetch_assoc()) {
                    $rec = ['id'=>(int)$r['id'],'name'=>$r['owner_name'],'email'=>$r['owner_email'],'phone'=>$r['owner_phone'],'ref'=>$r['unit_code']];
                } else {
                    // بحث احتياطي في acc_parties بواسطة رقم الضريبة (يُستخدم أحياناً لتخزين الهوية)
                    $q2 = $conn->query("SELECT id,name,email,phone FROM acc_parties WHERE tenant_id=1 AND vat_number='$nid' LIMIT 1");
                    if ($q2 && $r2 = $q2->fetch_assoc()) {
                        // إنشاء مدخل مؤقت في owners إن لم يكن موجوداً
                        $pn = $conn->real_escape_string($r2['name']); $pe = $conn->real_escape_string($r2['email']??''); $pp = $conn->real_escape_string($r2['phone']??'');
                        $conn->query("INSERT INTO owners (owner_name,owner_email,owner_phone,unit_code,national_id,party_id) VALUES ('$pn','$pe','$pp','','$nid',{$r2['id']}) ON DUPLICATE KEY UPDATE national_id='$nid'");
                        $newId = (int)$conn->insert_id ?: (int)(($conn->query("SELECT id FROM owners WHERE national_id='$nid' LIMIT 1"))->fetch_assoc()['id']??0);
                        if ($newId) $rec = ['id'=>$newId,'name'=>$r2['name'],'email'=>$r2['email']??'','phone'=>$r2['phone']??'','ref'=>''];
                    }
                }
            }
        }

        if (!$rec) { echo json_encode(['success' => false, 'message' => 'لم نجد حسابًا مطابقًا لهذا المُعرّف']); break; }

        // جهاز موثوق (للموظفين فقط) — تخطَّ الرمز
        if ($scope === 'staff') {
            $dev = trim((string)($input_data['device_token'] ?? ''));
            if ($dev !== '') {
                $dh = hash('sha256', $dev); $now = date('Y-m-d H:i:s'); $uid = $rec['id'];
                $tr = $conn->query("SELECT id FROM trusted_devices WHERE user_id=$uid AND token_hash='$dh' AND expires_at > '$now' LIMIT 1");
                if ($tr && $tr->num_rows > 0) {
                    $ur = $conn->query("SELECT * FROM users WHERE id=$uid LIMIT 1");
                    $user = $ur ? $ur->fetch_assoc() : null;
                    if ($user) {
                        unset($user['password']);
                        acc_audit($conn, 1, 'auth', $uid, 'login', 'دخول موحّد عبر جهاز موثوق · IP ' . $ip, $user['email'] ?? '');
                        echo json_encode(['success' => true, 'scope' => 'staff', 'data' => $user]);
                        break;
                    }
                }
            }
        }

        $hasEmail = !empty($rec['email']) && filter_var($rec['email'], FILTER_VALIDATE_EMAIL);
        $hasPhone = auth_norm_phone($rec['phone']) !== '';
        if (!$hasEmail && !$hasPhone) { echo json_encode(['success' => false, 'message' => 'لا توجد وسيلة تواصل مسجّلة لهذا الحساب']); break; }

        // تحديد القناة حسب نوع المُعرّف
        $choose = false; $channel = null;
        if ($type === 'email')      { $channel = 'email'; }
        elseif ($type === 'phone')  { $channel = 'whatsapp'; }
        else { // unit / national_id ⇒ يختار المستخدم إن توفّرت قناتان
            if ($hasEmail && $hasPhone) $choose = true;
            elseif ($hasPhone)          $channel = 'whatsapp';
            else                        $channel = 'email';
        }

        $ticket = bin2hex(random_bytes(16));
        $tk = $conn->real_escape_string($ticket);
        $sc = $conn->real_escape_string($scope);
        $de = $conn->real_escape_string($rec['email'] ?? '');
        $dp = $conn->real_escape_string($rec['phone'] ?? '');
        $rk = $conn->real_escape_string($rec['ref'] ?? '');
        $rid = (int)$rec['id'];
        $expires = date('Y-m-d H:i:s', time() + 600);
        // نظّف تذاكر سابقة لنفس السجل
        $conn->query("DELETE FROM auth_otp WHERE scope='$sc' AND ref_id=$rid");

        $sent = false; $code = null; $cl = null;
        if (!$choose) {
            $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $cl   = ($channel === 'whatsapp') ? 'whatsapp' : 'email';
            $sent = auth_dispatch_code($cl, $rec['name'] ?? '', $rec['ref'] ?? '', $rec['email'] ?? '', $rec['phone'] ?? '', $code);
            acc_audit($conn, 1, 'auth', $scope === 'staff' ? $rid : null, 'otp_sent', 'رمز دخول موحّد (' . $scope . ') عبر ' . $cl . ' · IP ' . $ip, $rec['email'] ?? $rec['ref'] ?? '');
        }
        $cd  = $code !== null ? "'" . $conn->real_escape_string($code) . "'" : 'NULL';
        $clq = $cl   !== null ? "'" . $conn->real_escape_string($cl)   . "'" : 'NULL';
        $conn->query("INSERT INTO auth_otp (ticket,scope,ref_id,ref_key,code,channel,dest_email,dest_phone,expires_at) VALUES ('$tk','$sc',$rid,'$rk',$cd,$clq,'$de','$dp','$expires')");

        echo json_encode([
            'success' => true, 'otp_required' => true, 'ticket' => $ticket,
            'choose' => $choose, 'channel' => $channel, 'sent' => $sent,
            'has_email' => $hasEmail, 'has_phone' => $hasPhone,
            'masked_email' => mask_email($rec['email'] ?? ''),
            'masked_phone' => mask_phone($rec['phone'] ?? ''),
            'name' => $rec['name'] ?? '',
        ]);
        break;
    }

    // المرحلة 2 (اختيارية): إرسال/إعادة إرسال عبر القناة المختارة.
    case 'auth_otp_send': {
        $ticket  = $conn->real_escape_string(trim($input_data['ticket'] ?? ''));
        $want    = (($input_data['channel'] ?? '') === 'whatsapp') ? 'whatsapp' : 'email';
        if ($ticket === '') { echo json_encode(['success' => false, 'message' => 'جلسة غير صالحة']); break; }
        $now = date('Y-m-d H:i:s');
        $q = $conn->query("SELECT * FROM auth_otp WHERE ticket='$ticket' AND expires_at > '$now' LIMIT 1");
        if (!$q || $q->num_rows === 0) { echo json_encode(['success' => false, 'message' => 'انتهت صلاحية الجلسة، أعد المحاولة']); break; }
        $row = $q->fetch_assoc();
        if ($want === 'whatsapp' && auth_norm_phone($row['dest_phone']) === '') { echo json_encode(['success' => false, 'message' => 'لا يوجد رقم جوال مسجّل']); break; }
        if ($want === 'email' && (empty($row['dest_email']) || !filter_var($row['dest_email'], FILTER_VALIDATE_EMAIL))) { echo json_encode(['success' => false, 'message' => 'لا يوجد بريد مسجّل']); break; }
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $cd = $conn->real_escape_string($code); $cl = $conn->real_escape_string($want);
        $conn->query("UPDATE auth_otp SET code='$cd', channel='$cl', attempts=0, expires_at='" . date('Y-m-d H:i:s', time() + 600) . "' WHERE ticket='$ticket'");
        $sent = auth_dispatch_code($want, '', $row['ref_key'] ?? '', $row['dest_email'] ?? '', $row['dest_phone'] ?? '', $code);
        echo json_encode([
            'success' => true, 'channel' => $want, 'sent' => $sent,
            'masked_email' => mask_email($row['dest_email'] ?? ''),
            'masked_phone' => mask_phone($row['dest_phone'] ?? ''),
        ]);
        break;
    }

    // المرحلة 3: التحقق من الرمز وإصدار الجلسة (مع وثوق الجهاز للموظفين).
    case 'auth_otp_verify': {
        $ticket   = $conn->real_escape_string(trim($input_data['ticket'] ?? ''));
        $code     = trim((string)($input_data['code'] ?? ''));
        $remember = !empty($input_data['remember_device']);
        $ip       = $conn->real_escape_string($_SERVER['REMOTE_ADDR'] ?? '');
        if ($ticket === '' || $code === '') { echo json_encode(['success' => false, 'message' => 'بيانات ناقصة']); break; }
        $now = date('Y-m-d H:i:s');
        $q = $conn->query("SELECT * FROM auth_otp WHERE ticket='$ticket' AND expires_at > '$now' LIMIT 1");
        if (!$q || $q->num_rows === 0) { echo json_encode(['success' => false, 'message' => 'انتهت صلاحية الرمز، أعد المحاولة']); break; }
        $row = $q->fetch_assoc();
        $aid = (int)$row['id'];
        if ($row['code'] === null || $row['code'] === '') { echo json_encode(['success' => false, 'message' => 'لم يُرسَل رمز بعد، اختر قناة الإرسال']); break; }
        if ((int)$row['attempts'] >= 5) { $conn->query("DELETE FROM auth_otp WHERE id=$aid"); echo json_encode(['success' => false, 'message' => 'محاولات كثيرة، أعد المحاولة']); break; }
        if (!hash_equals((string)$row['code'], $code)) {
            $conn->query("UPDATE auth_otp SET attempts=attempts+1 WHERE id=$aid");
            acc_audit($conn, 1, 'auth', $row['scope'] === 'staff' ? (int)$row['ref_id'] : null, 'otp_fail', 'رمز دخول موحّد خاطئ (' . $row['scope'] . ') · IP ' . $ip, $row['dest_email'] ?? '');
            echo json_encode(['success' => false, 'message' => 'الرمز غير صحيح']); break;
        }
        $scope = $row['scope']; $rid = (int)$row['ref_id'];
        $conn->query("DELETE FROM auth_otp WHERE id=$aid");

        if ($scope === 'staff') {
            $ur = $conn->query("SELECT * FROM users WHERE id=$rid LIMIT 1");
            $user = $ur ? $ur->fetch_assoc() : null;
            if (!$user) { echo json_encode(['success' => false, 'message' => 'المستخدم غير موجود']); break; }
            // تحقق من حالة المستأجر
            $uTid   = (int)($user['tenant_id'] ?? 1);
            $utChk  = $conn->query("SELECT status,plan,trial_ends FROM tenants WHERE id=$uTid LIMIT 1");
            if ($utChk && ($utRow = $utChk->fetch_assoc())) {
                if ($utRow['plan'] === 'trial' && $utRow['status'] === 'active'
                    && $utRow['trial_ends'] && $utRow['trial_ends'] < date('Y-m-d')) {
                    $conn->query("UPDATE tenants SET status='suspended' WHERE id=$uTid");
                    $utRow['status'] = 'suspended';
                }
                if (in_array($utRow['status'], ['suspended','cancelled'], true)) {
                    $lbl = $utRow['status'] === 'suspended' ? 'حساب موقوف' : 'حساب ملغى';
                    $msg = $utRow['status'] === 'suspended'
                        ? 'حساب شركتك موقوف مؤقتاً — تواصل مع الدعم'
                        : 'هذا الحساب غير نشط — تواصل مع الدعم';
                    echo json_encode(['success'=>false,'message'=>$msg,'code'=>'tenant_'.$utRow['status']], JSON_UNESCAPED_UNICODE);
                    break;
                }
            }
            unset($user['password']);
            $device_token = null;
            if ($remember) {
                $device_token = bin2hex(random_bytes(32));
                $dh = hash('sha256', $device_token);
                $exp = date('Y-m-d H:i:s', time() + 30 * 86400);
                $label = $conn->real_escape_string(substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 150));
                $conn->query("INSERT INTO trusted_devices (user_id,token_hash,label,expires_at) VALUES ($rid,'$dh','$label','$exp')");
            }
            acc_audit($conn, 1, 'auth', $rid, 'login', 'دخول موحّد ناجح · IP ' . $ip, $user['email'] ?? '');
            $_jwt = jwt_sign(['sub'=>$rid,'tid'=>(int)($user['tenant_id']??1),'role'=>$user['role']??'admin','iat'=>time(),'exp'=>time()+28800]);
            echo json_encode(['success' => true, 'scope' => 'staff', 'data' => $user, 'jwt' => $_jwt, 'device_token' => $device_token, 'must_change_password' => (int)($user['must_change_password'] ?? 0)]);
        } else {
            $or = $conn->query("SELECT owner_name as name, owner_phone as phone, owner_email as email, unit_code as unit, national_id, party_id, project_label FROM owners WHERE id=$rid LIMIT 1");
            $owner = $or ? $or->fetch_assoc() : null;
            if (!$owner) { echo json_encode(['success' => false, 'message' => 'العميل غير موجود']); break; }
            // اجلب اسم المشروع من جدول units إن لم يكن محفوظاً
            if (empty($owner['project_label']) && !empty($owner['unit'])) {
                $uc = $conn->real_escape_string($owner['unit']);
                $pj = $conn->query("SELECT p.name FROM units u JOIN projects p ON p.id=u.project_id WHERE u.unit_code='$uc' LIMIT 1");
                if ($pj && ($pjr = $pj->fetch_assoc())) $owner['project_label'] = $pjr['name'];
            }
            acc_audit($conn, 1, 'auth', null, 'login', 'عميل · وحدة=' . ($owner['unit'] ?? ''), $owner['name'] ?? '', $_clientIp, $_clientUa);
            echo json_encode(['success' => true, 'scope' => 'customer', 'data' => $owner]);
        }
        break;
    }

    // ─── بوابة العملاء / المشترين ────────────────────────────────────────────────

    case 'customer_account': {
        // كشف الحساب المالي للعميل: الفواتير المفتوحة + سجل المدفوعات
        // البحث بالجوال ثم party_id (إن عُرِف)
        $phone = preg_replace('/\D/', '', (string)($_GET['phone'] ?? ''));
        $phone = ltrim($phone, '0');
        $pid   = (int)($_GET['party_id'] ?? 0);
        $tid   = $_jwt_tid ?? 1;
        // إيجاد الطرف
        $party = null;
        if ($pid > 0) {
            $pr = $conn->query("SELECT id,name,phone,email FROM acc_parties WHERE id=$pid AND tenant_id=$tid LIMIT 1");
            if ($pr) $party = $pr->fetch_assoc();
        }
        if (!$party && $phone !== '') {
            $last9 = substr($phone, -9);
            $le    = $conn->real_escape_string($last9);
            $pr    = $conn->query("SELECT id,name,phone,email FROM acc_parties WHERE tenant_id=$tid AND REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+','') LIKE '%$le%' LIMIT 1");
            if ($pr) $party = $pr->fetch_assoc();
        }
        if (!$party) { echo json_encode(['success'=>false,'message'=>'لا يوجد حساب مالي مرتبط']); break; }
        $ppid = (int)$party['id'];
        // الفواتير المفتوحة
        $ir = $conn->query("SELECT id,invoice_no,issue_date,due_date,total,paid,status,doc_type FROM acc_invoices WHERE tenant_id=$tid AND party_id=$ppid AND status NOT IN ('draft','void') ORDER BY issue_date DESC LIMIT 50");
        $invoices = []; while ($ir && ($x = $ir->fetch_assoc())) $invoices[] = $x;
        // سجل المدفوعات
        $pymr = $conn->query("SELECT pay_no,date,method,amount,invoice_id FROM acc_payments WHERE tenant_id=$tid AND party_id=$ppid ORDER BY date DESC LIMIT 50");
        $payments = []; while ($pymr && ($x = $pymr->fetch_assoc())) $payments[] = $x;
        // الإجماليات
        $totInv = array_sum(array_column($invoices, 'total'));
        $totPd  = array_sum(array_column($invoices, 'paid'));
        $totBal = array_sum(array_map(fn($r) => max(0, $r['total']-$r['paid']), $invoices));
        echo json_encode(['success'=>true,'party'=>$party,'invoices'=>$invoices,'payments'=>$payments,
            'totals'=>['invoiced'=>round($totInv,2),'paid'=>round($totPd,2),'balance'=>round($totBal,2)]
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'customer_available_units': {
        // الوحدات المتاحة للبيع: status='متاح' ولا يوجد مالك مسجّل
        $res = $conn->query("
            SELECT u.id, u.unit_code, u.status, u.spaces,
                   p.id AS project_id, p.name AS project_name, p.description AS project_desc, p.status AS project_status
            FROM units u
            JOIN projects p ON p.id = u.project_id
            LEFT JOIN owners o ON o.unit_code = u.unit_code
            WHERE u.status = 'متاح' AND o.id IS NULL
            ORDER BY p.name, u.unit_code
            LIMIT 100");
        $rows = [];
        while ($res && ($x = $res->fetch_assoc())) {
            $spaces = json_decode($x['spaces'] ?? '[]', true) ?: [];
            // استخلاص المساحة والسعر من حقل spaces (مخصص حسب المشروع)
            $area  = null; $price = null;
            foreach ($spaces as $sp) {
                if (!empty($sp['label']) && (strpos($sp['label'],'مساحة') !== false || strpos($sp['label'],'Area') !== false)) $area = $sp['value'] ?? null;
                if (!empty($sp['label']) && (strpos($sp['label'],'سعر') !== false || strpos($sp['label'],'Price') !== false)) $price = $sp['value'] ?? null;
            }
            $rows[] = ['id'=>$x['id'],'unit_code'=>$x['unit_code'],'project_id'=>$x['project_id'],
                'project_name'=>$x['project_name'],'project_desc'=>$x['project_desc'],'project_status'=>$x['project_status'],
                'area'=>$area,'price'=>$price,'spaces'=>$spaces];
        }
        echo json_encode(['success'=>true,'data'=>$rows,'count'=>count($rows)], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'customer_lead_save': {
        // حفظ طلب اهتمام بشراء وحدة (Lead)
        $name  = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $phone = $conn->real_escape_string(trim($input_data['phone'] ?? ''));
        $nid   = $conn->real_escape_string(trim($input_data['national_id'] ?? ''));
        $unit  = $conn->real_escape_string(trim($input_data['unit_code'] ?? ''));
        $proj  = (int)($input_data['project_id'] ?? 0);
        $notes = $conn->real_escape_string(trim($input_data['notes'] ?? ''));
        if (!$name || !$phone) { echo json_encode(['success'=>false,'message'=>'الاسم والجوال مطلوبان']); break; }
        $projSql = $proj > 0 ? $proj : 'NULL';
        $conn->query("INSERT INTO acc_leads (name,phone,national_id,unit_code,project_id,notes) VALUES ('$name','$phone','$nid','$unit',$projSql,'$notes')");
        $lid = (int)$conn->insert_id;
        // إشعار واتساب للإدارة
        $sRes = $conn->query("SELECT value FROM acc_settings WHERE tenant_id=1 AND key_name='company_phone' LIMIT 1");
        $adminPhone = $sRes && ($sr=$sRes->fetch_assoc()) ? $sr['value'] : '';
        if ($adminPhone) {
            $aPhone = preg_replace('/\D/', '', $adminPhone); $aPhone = ltrim($aPhone, '0');
            if (substr($aPhone,0,3)!=='966') $aPhone='966'.$aPhone;
            $unitTxt = $unit ?: ($proj > 0 ? "مشروع #$proj" : 'غير محدد');
            wa_send_text($aPhone, "🏠 طلب اهتمام جديد برقم $lid\nالاسم: $name\nالجوال: $phone\nالوحدة: $unitTxt\n" . ($notes ? "ملاحظات: $notes" : ''));
        }
        echo json_encode(['success'=>true,'lead_id'=>$lid,'message'=>'تم تسجيل طلبك، سيتواصل معك فريقنا قريباً'], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ─── سجل النشاط (اللوق) + التنبيهات ───────────────────────────────────────
    case 'log_event': {
        $entity = $input_data['entity'] ?? 'app';
        $eid    = isset($input_data['entity_id']) && $input_data['entity_id'] !== '' ? (int)$input_data['entity_id'] : null;
        $act    = $input_data['action'] ?? 'view';
        $detail = $input_data['detail'] ?? '';
        $actor  = $input_data['actor'] ?? '';
        acc_audit($conn, 1, $entity, $eid, $act, $detail, $actor);
        echo json_encode(['success' => true]);
        break;
    }

    case 'activity_log': {
        $gv  = function ($k) use ($input_data) { return isset($input_data[$k]) ? trim((string)$input_data[$k]) : ''; };
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);

        // ── وضع الإحصاءات ────────────────────────────────────────────────
        if (!empty($input_data['stats'])) {
            $today = date('Y-m-d');
            $week  = date('Y-m-d', strtotime('-7 days'));
            $month = date('Y-m-d', strtotime('-30 days'));
            $s = [];
            $r = $conn->query("SELECT COUNT(*) AS c FROM acc_audit_log WHERE tenant_id=$tid AND DATE(created_at)='$today'");
            $s['today']    = $r ? (int)$r->fetch_assoc()['c'] : 0;
            $r = $conn->query("SELECT COUNT(*) AS c FROM acc_audit_log WHERE tenant_id=$tid AND risk_level>=4 AND created_at>='$week 00:00:00'");
            $s['critical'] = $r ? (int)$r->fetch_assoc()['c'] : 0;
            $r = $conn->query("SELECT COUNT(*) AS c FROM acc_audit_log WHERE tenant_id=$tid AND risk_level=3 AND created_at>='$week 00:00:00'");
            $s['high']     = $r ? (int)$r->fetch_assoc()['c'] : 0;
            $r = $conn->query("SELECT COUNT(DISTINCT actor) AS c FROM acc_audit_log WHERE tenant_id=$tid AND actor IS NOT NULL AND created_at>='$month 00:00:00'");
            $s['actors']   = $r ? (int)$r->fetch_assoc()['c'] : 0;
            $r = $conn->query("SELECT entity, COUNT(*) AS c FROM acc_audit_log WHERE tenant_id=$tid GROUP BY entity ORDER BY c DESC LIMIT 5");
            $s['top'] = []; if ($r) while ($x = $r->fetch_assoc()) $s['top'][] = $x;
            echo json_encode(['success'=>true,'stats'=>$s], JSON_UNESCAPED_UNICODE);
            break;
        }

        // ── قائمة الأحداث ─────────────────────────────────────────────────
        $page = max(1, (int)($gv('page') ?: 1));
        $per  = min(200, max(1, (int)($gv('per') ?: 50)));
        $off  = ($page - 1) * $per;

        $w = ["tenant_id = $tid"];
        if ($gv('entity') !== '') $w[] = "entity = '" . $conn->real_escape_string($gv('entity')) . "'";
        if ($gv('action') !== '') $w[] = "action = '" . $conn->real_escape_string($gv('action')) . "'";
        if ($gv('actor')  !== '') $w[] = "actor LIKE '%" . $conn->real_escape_string($gv('actor')) . "%'";
        if ($gv('ip')     !== '') $w[] = "ip_address LIKE '%" . $conn->real_escape_string($gv('ip')) . "%'";
        if ($gv('risk')   !== '') {
            $rMin = (int)$gv('risk');
            $w[] = "risk_level >= $rMin";
        }
        if ($gv('q') !== '') {
            $q   = $conn->real_escape_string($gv('q'));
            $w[] = "(detail LIKE '%$q%' OR actor LIKE '%$q%' OR entity LIKE '%$q%' OR ip_address LIKE '%$q%')";
        }
        if ($gv('from') !== '') $w[] = "created_at >= '" . $conn->real_escape_string($gv('from')) . " 00:00:00'";
        if ($gv('to')   !== '') $w[] = "created_at <= '" . $conn->real_escape_string($gv('to'))   . " 23:59:59'";
        $where = implode(' AND ', $w);

        $cnt   = $conn->query("SELECT COUNT(*) AS c FROM acc_audit_log WHERE $where");
        $total = $cnt ? (int)$cnt->fetch_assoc()['c'] : 0;

        $rows  = [];
        $r = $conn->query("SELECT id,entity,entity_id,action,detail,actor,ip_address,user_agent,old_data,new_data,risk_level,row_hash,created_at
                           FROM acc_audit_log WHERE $where ORDER BY id DESC LIMIT $per OFFSET $off");
        if ($r) while ($x = $r->fetch_assoc()) $rows[] = $x;

        echo json_encode(['success'=>true,'data'=>$rows,'total'=>$total,'page'=>$page,'per'=>$per], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'audit_stats': {
        // اختصار مباشر للإحصاءات (GET مريح للـ dashboard)
        $tid   = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $today = date('Y-m-d');
        $week  = date('Y-m-d', strtotime('-7 days'));
        $month = date('Y-m-d', strtotime('-30 days'));
        $s = [];
        $r = $conn->query("SELECT COUNT(*) AS c FROM acc_audit_log WHERE tenant_id=$tid AND DATE(created_at)='$today'");
        $s['today']    = $r ? (int)$r->fetch_assoc()['c'] : 0;
        $r = $conn->query("SELECT COUNT(*) AS c FROM acc_audit_log WHERE tenant_id=$tid AND risk_level>=4 AND created_at>='$week 00:00:00'");
        $s['critical'] = $r ? (int)$r->fetch_assoc()['c'] : 0;
        $r = $conn->query("SELECT COUNT(*) AS c FROM acc_audit_log WHERE tenant_id=$tid AND risk_level=3 AND created_at>='$week 00:00:00'");
        $s['high']     = $r ? (int)$r->fetch_assoc()['c'] : 0;
        $r = $conn->query("SELECT COUNT(DISTINCT actor) AS c FROM acc_audit_log WHERE tenant_id=$tid AND actor IS NOT NULL AND created_at>='$month 00:00:00'");
        $s['actors']   = $r ? (int)$r->fetch_assoc()['c'] : 0;
        $r = $conn->query("SELECT COUNT(*) AS c FROM acc_audit_log WHERE tenant_id=$tid");
        $s['total']    = $r ? (int)$r->fetch_assoc()['c'] : 0;
        echo json_encode(['success'=>true,'stats'=>$s], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'notifications_list': {
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $uid = isset($input_data['user_id']) && $input_data['user_id'] !== '' ? (int)$input_data['user_id'] : 0;
        $lim = min(100, max(1, (int)($input_data['limit'] ?? 30)));
        $cond = "tenant_id = $tid AND (user_id IS NULL" . ($uid ? " OR user_id = $uid" : "") . ")";

        $rows = [];
        $r = $conn->query("SELECT id, type, title, body, link, is_read, created_at FROM notifications WHERE $cond ORDER BY id DESC LIMIT $lim");
        if ($r) while ($x = $r->fetch_assoc()) $rows[] = $x;

        $uc = $conn->query("SELECT COUNT(*) AS c FROM notifications WHERE $cond AND is_read = 0");
        $unread = $uc ? (int)$uc->fetch_assoc()['c'] : 0;

        echo json_encode(['success' => true, 'data' => $rows, 'unread' => $unread], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'notifications_unread': {
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $uid = isset($input_data['user_id']) && $input_data['user_id'] !== '' ? (int)$input_data['user_id'] : 0;
        $cond = "tenant_id = $tid AND (user_id IS NULL" . ($uid ? " OR user_id = $uid" : "") . ") AND is_read = 0";
        $uc = $conn->query("SELECT COUNT(*) AS c FROM notifications WHERE $cond");
        $unread = $uc ? (int)$uc->fetch_assoc()['c'] : 0;
        echo json_encode(['success' => true, 'unread' => $unread]);
        break;
    }

    case 'notifications_mark_read': {
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $uid = isset($input_data['user_id']) && $input_data['user_id'] !== '' ? (int)$input_data['user_id'] : 0;
        $cond = "tenant_id = $tid AND (user_id IS NULL" . ($uid ? " OR user_id = $uid" : "") . ")";
        if (!empty($input_data['all'])) {
            $conn->query("UPDATE notifications SET is_read = 1 WHERE $cond");
        } elseif (isset($input_data['id'])) {
            $id = (int)$input_data['id'];
            $conn->query("UPDATE notifications SET is_read = 1 WHERE id = $id AND $cond");
        }
        echo json_encode(['success' => true]);
        break;
    }

    case 'notify_create': {
        $tid   = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $uid   = isset($input_data['user_id']) && $input_data['user_id'] !== '' ? (int)$input_data['user_id'] : null;
        $type  = $input_data['type']  ?? 'info';
        $title = $input_data['title'] ?? '';
        $body  = $input_data['body']  ?? null;
        $link  = $input_data['link']  ?? null;
        if ($title === '') { echo json_encode(['success' => false, 'message' => 'العنوان مطلوب']); break; }
        notify($conn, $tid, $uid, $type, $title, $body, $link);
        echo json_encode(['success' => true]);
        break;
    }

    // ─── إرسال البريد (SMTP عبر بريد سماك) ───────────────────────────────────
    // اختبار الإعداد: يرسل رسالة تجريبية ويُرجع جاهزية SMTP + نتيجة الإرسال.
    case 'send_test_email': {
        $cfg = smtp_config();
        if (!smtp_ready($cfg)) {
            echo json_encode(['success' => false, 'configured' => false, 'message' => 'لم يتم إعداد بيانات SMTP بعد']);
            break;
        }
        $to = trim($input_data['to'] ?? $cfg['from'] ?? '');
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'configured' => true, 'message' => 'البريد المستلِم غير صالح']);
            break;
        }
        $html = email_template('رسالة اختبار', '<p>هذه رسالة تجريبية للتأكد من عمل خادم البريد (SMTP) الخاص بسماك العقارية.</p><p>إن وصلتك هذه الرسالة فالإعداد سليم ✅</p>');
        $r = send_email($to, 'اختبار بريد سماك', $html);
        if (!empty($r['ok'])) {
            acc_audit($conn, 1, 'app', null, 'view', 'إرسال بريد اختبار إلى ' . $to, $input_data['actor'] ?? '');
        }
        echo json_encode(['success' => !empty($r['ok']), 'configured' => true, 'message' => !empty($r['ok']) ? 'تم إرسال رسالة الاختبار' : ('فشل الإرسال: ' . ($r['error'] ?? 'خطأ غير معروف'))]);
        break;
    }
    // إرسال بريد تحديث/إشعار إلى مستلِم واحد أو عدة مستلِمين بقالب سماك.
    case 'send_update_email': {
        $cfg = smtp_config();
        if (!smtp_ready($cfg)) {
            echo json_encode(['success' => false, 'configured' => false, 'message' => 'لم يتم إعداد بيانات SMTP بعد']);
            break;
        }
        $subject = trim($input_data['subject'] ?? '');
        $title   = trim($input_data['title'] ?? $subject);
        $bodyTxt = $input_data['body'] ?? '';
        $bodyHtml = $input_data['body_html'] ?? null;
        $ctaUrl   = trim($input_data['cta_url'] ?? '');
        $ctaLabel = trim($input_data['cta_label'] ?? 'فتح');
        if ($subject === '' || ($bodyTxt === '' && !$bodyHtml)) {
            echo json_encode(['success' => false, 'configured' => true, 'message' => 'العنوان والمحتوى مطلوبان']);
            break;
        }
        // قبول to كنص مفصول بفواصل أو مصفوفة
        $rawTo = $input_data['to'] ?? '';
        $list  = is_array($rawTo) ? $rawTo : preg_split('/[,;\s]+/', (string)$rawTo, -1, PREG_SPLIT_NO_EMPTY);
        $valid = [];
        foreach ($list as $addr) {
            $addr = trim($addr);
            if (filter_var($addr, FILTER_VALIDATE_EMAIL)) $valid[] = $addr;
        }
        if (!$valid) {
            echo json_encode(['success' => false, 'configured' => true, 'message' => 'لا يوجد بريد مستلِم صالح']);
            break;
        }
        if (!$bodyHtml) $bodyHtml = '<p>' . nl2br(htmlspecialchars($bodyTxt)) . '</p>';
        $cta  = $ctaUrl ? ['url' => $ctaUrl, 'label' => $ctaLabel] : null;
        $html = email_template($title ?: $subject, $bodyHtml, $cta);
        $sent = 0; $failed = [];
        foreach ($valid as $addr) {
            $r = send_email($addr, $subject, $html, $bodyTxt);
            if (!empty($r['ok'])) $sent++; else $failed[] = $addr;
        }
        acc_audit($conn, 1, 'app', null, 'create', 'إرسال بريد تحديث «' . $subject . '» إلى ' . $sent . ' مستلِم', $input_data['actor'] ?? '');
        echo json_encode(['success' => $sent > 0, 'configured' => true, 'sent' => $sent, 'failed' => $failed, 'message' => 'تم الإرسال إلى ' . $sent . ' من ' . count($valid)]);
        break;
    }

    // ─── المشاريع والوحدات ──────────────────────────────────────────────────

    case 'get_projects_data':
        $tid = $_jwt_tid ?? 1;
        $projects = [];
        $p_query = $conn->query("SELECT * FROM projects WHERE tenant_id=$tid ORDER BY id DESC");
        if ($p_query) {
            while ($p_row = $p_query->fetch_assoc()) {
                $proj_id = $p_row['id'];
                $u_query = $conn->query("SELECT u.id, u.unit_code, u.spaces, u.status, o.id as owner_id, o.owner_name, o.owner_phone, o.owner_email FROM units u LEFT JOIN owners o ON u.unit_code = o.unit_code WHERE u.project_id = $proj_id AND u.tenant_id=$tid ORDER BY u.id ASC");
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
        $tid = $_jwt_tid ?? 1;
        $res  = $conn->query("SELECT unit_code FROM owners WHERE tenant_id=$tid");
        $sold = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $sold[$row['unit_code']] = 'مباعة'; } }
        echo json_encode(['success' => true, 'data' => $sold]);
        break;

    case 'add_project':
        $tid = $_jwt_tid ?? 1;
        $name = $conn->real_escape_string($input_data['name']);
        $desc = $conn->real_escape_string($input_data['description'] ?? '');
        $conn->query("INSERT INTO projects (name, description, tenant_id) VALUES ('$name', '$desc', $tid)");
        echo json_encode(["success" => true]);
        break;

    case 'update_project_info':
        $tid    = $_jwt_tid ?? 1;
        $id     = (int)$input_data['id'];
        $name   = $conn->real_escape_string($input_data['name']);
        $desc   = $conn->real_escape_string($input_data['description']);
        $status = $conn->real_escape_string($input_data['status']);
        $conn->query("UPDATE projects SET name='$name', description='$desc', status='$status' WHERE id=$id AND tenant_id=$tid");
        echo json_encode(["success" => true]);
        break;

    case 'add_unit_card':
        $tid      = $_jwt_tid ?? 1;
        $projId   = (int)$input_data['project_id'];
        $unitCode = $conn->real_escape_string($input_data['unit_code']);
        $spaces   = json_encode([], JSON_UNESCAPED_UNICODE);
        $check    = $conn->query("SELECT id FROM units WHERE project_id=$projId AND unit_code='$unitCode' AND tenant_id=$tid");
        if ($check->num_rows > 0) { echo json_encode(["success" => false, "message" => "هذه الوحدة موجودة مسبقاً"]); break; }
        $conn->query("INSERT INTO units (project_id, unit_code, spaces, status, tenant_id) VALUES ($projId, '$unitCode', '$spaces', 'متاح', $tid)");
        echo json_encode(["success" => true, "unit_id" => $conn->insert_id]);
        break;

    case 'update_unit_spaces':
        $tid    = $_jwt_tid ?? 1;
        $unitId = (int)$input_data['unit_id'];
        $spaces = $conn->real_escape_string(json_encode($input_data['spaces'], JSON_UNESCAPED_UNICODE));
        $conn->query("UPDATE units SET spaces = '$spaces' WHERE id = $unitId AND tenant_id=$tid");
        echo json_encode(["success" => true]);
        break;

    case 'update_unit_status':
        $tid    = $_jwt_tid ?? 1;
        $unitId = (int)$input_data['unit_id'];
        $allowed = ['متاح', 'مباعة', 'محجوز'];
        $status  = $input_data['status'] ?? '';
        if (!in_array($status, $allowed)) { echo json_encode(["success" => false, "message" => "حالة غير صالحة"]); break; }
        $status = $conn->real_escape_string($status);
        $conn->query("UPDATE units SET status = '$status' WHERE id = $unitId AND tenant_id=$tid");
        echo json_encode(["success" => true]);
        break;

    case 'delete_unit_card':
        $tid    = $_jwt_tid ?? 1;
        $unitId = (int)$input_data['unit_id'];
        $conn->query("DELETE FROM units WHERE id = $unitId AND tenant_id=$tid");
        echo json_encode(["success" => true]);
        break;

    case 'duplicate_project':
        $tid     = $_jwt_tid ?? 1;
        $orig_id = (int)$input_data['project_id'];
        $res = $conn->query("SELECT * FROM projects WHERE id = $orig_id AND tenant_id=$tid");
        if ($row = $res->fetch_assoc()) {
            $newName = $conn->real_escape_string($row['name'] . " (نسخة)");
            $newDesc = $conn->real_escape_string($row['description']);
            $status  = $conn->real_escape_string($row['status']);
            $conn->query("INSERT INTO projects (name, description, status, tenant_id) VALUES ('$newName', '$newDesc', '$status', $tid)");
            $new_proj_id = $conn->insert_id;
            $u_res = $conn->query("SELECT * FROM units WHERE project_id = $orig_id AND tenant_id=$tid");
            while ($u_row = $u_res->fetch_assoc()) {
                $u_code   = $conn->real_escape_string($u_row['unit_code'] . "-C");
                $u_spaces = $conn->real_escape_string($u_row['spaces']);
                $conn->query("INSERT INTO units (project_id, unit_code, spaces, status, tenant_id) VALUES ($new_proj_id, '$u_code', '$u_spaces', 'متاح', $tid)");
            }
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false]);
        }
        break;

    case 'duplicate_unit':
        $tid      = $_jwt_tid ?? 1;
        $unit_id  = (int)$input_data['unit_id'];
        $new_code = $conn->real_escape_string($input_data['new_unit_code']);
        $res = $conn->query("SELECT * FROM units WHERE id = $unit_id AND tenant_id=$tid");
        if ($row = $res->fetch_assoc()) {
            $proj_id = $row['project_id'];
            $spaces  = $conn->real_escape_string($row['spaces']);
            $check   = $conn->query("SELECT id FROM units WHERE project_id=$proj_id AND unit_code='$new_code' AND tenant_id=$tid");
            if ($check->num_rows > 0) { echo json_encode(["success" => false, "message" => "رقم الوحدة الجديد مستخدم مسبقاً"]); break; }
            $conn->query("INSERT INTO units (project_id, unit_code, spaces, status, tenant_id) VALUES ($proj_id, '$new_code', '$spaces', 'متاح', $tid)");
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false]);
        }
        break;

    // ─── الملاك ─────────────────────────────────────────────────────────────

    case 'add_owner':
        $tid   = $_jwt_tid ?? 1;
        $unit  = $conn->real_escape_string($input_data['unit_code']);
        $name  = $conn->real_escape_string($input_data['name']);
        $phone = $conn->real_escape_string($input_data['phone']);
        $email = $conn->real_escape_string($input_data['email']);
        $conn->query("INSERT INTO owners (unit_code, owner_name, owner_phone, owner_email, tenant_id) VALUES ('$unit', '$name', '$phone', '$email', $tid)");
        $conn->query("UPDATE units SET status = 'مباعة' WHERE unit_code = '$unit' AND tenant_id=$tid");
        echo json_encode(["success" => true]);
        break;

    case 'get_owners':
        $tid  = $_jwt_tid ?? 1;
        $res  = $conn->query("SELECT o.*, p.name as project_name FROM owners o LEFT JOIN units u ON o.unit_code = u.unit_code LEFT JOIN projects p ON u.project_id = p.id WHERE o.tenant_id=$tid ORDER BY o.id DESC");
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
        $tid  = $_jwt_tid ?? 1;
        $res  = $conn->query("SELECT * FROM inspections WHERE tenant_id=$tid ORDER BY id DESC");
        $data = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $data[] = $row; } }
        echo json_encode(["success" => true, "data" => $data]);
        break;

    case 'get_inspection':
        $unit = $conn->real_escape_string($_GET['unit'] ?? '');
        $res  = $conn->query("SELECT id, unit, progress, status, client_submitted_at FROM inspections WHERE unit = '$unit' LIMIT 1");
        if ($res && $row = $res->fetch_assoc()) {
            echo json_encode(["success" => true, "data" => $row]);
        } else {
            echo json_encode(["success" => false]);
        }
        break;

    case 'set_inspection_status':
        $tid    = $_jwt_tid ?? 1;
        $unit   = $conn->real_escape_string($input_data['unit'] ?? '');
        $status = $conn->real_escape_string($input_data['status'] ?? '');
        if (!$unit || !$status) { echo json_encode(["success" => false, "message" => "بيانات ناقصة"]); break; }
        $conn->query("UPDATE inspections SET status='$status' WHERE unit='$unit' AND tenant_id=$tid");
        echo json_encode(["success" => true]);
        break;

    case 'save_inspection':
        $tid       = $_jwt_tid ?? 1;
        $unit      = $conn->real_escape_string($input_data['unit']);
        $evaluator = (int)$input_data['evaluator_id'];
        $insData   = $conn->real_escape_string($input_data['inspection_data']);
        $progress  = (int)$input_data['progress'];
        $check     = $conn->query("SELECT id FROM inspections WHERE unit = '$unit' AND tenant_id=$tid");
        if ($check && $check->num_rows > 0) {
            $conn->query("UPDATE inspections SET inspection_data='$insData', progress=$progress WHERE unit='$unit' AND tenant_id=$tid");
        } else {
            $conn->query("INSERT INTO inspections (tenant_id, unit, evaluator_id, inspection_data, progress) VALUES ($tid, '$unit', $evaluator, '$insData', $progress)");
        }
        echo json_encode(["success" => true]);
        break;

    case 'delete_inspection': {
        // حذف محضر فحص وحدة (صفحة محاضر التسليم)
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid  = $_jwt_tid ?? 1;
        $unit = $conn->real_escape_string(trim($input_data['unit'] ?? ''));
        if ($unit === '') { echo json_encode(['success'=>false,'message'=>'رمز الوحدة مطلوب'], JSON_UNESCAPED_UNICODE); break; }
        $ok = $conn->query("DELETE FROM inspections WHERE unit='$unit' AND tenant_id=$tid");
        acc_audit($conn, $tid, 'inspection', null, 'delete', "unit=$unit", 'admin', $_clientIp, $_clientUa);
        echo json_encode(['success'=>(bool)$ok, 'message'=>$ok?'تم الحذف':$conn->error], JSON_UNESCAPED_UNICODE);
        break;
    }

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

    case 'get_current_user': {
        $uid = (int)($_GET['id'] ?? $input_data['id'] ?? 0);
        if (!$uid) { echo json_encode(['success'=>false,'message'=>'id مطلوب']); break; }
        $__r = $conn->query("SELECT id,name,email,role,job,phone,department,permissions FROM users WHERE id=$uid LIMIT 1");
        $__row = $__r ? $__r->fetch_assoc() : null;
        echo $__row
            ? json_encode(['success'=>true,'user'=>$__row])
            : json_encode(['success'=>false,'message'=>'المستخدم غير موجود']);
        break;
    }

    case 'get_users':
        // ─ عزل المستأجرين: كل مستأجر يرى موظفيه فقط ─────────────────────
        // SELECT * ثم حذف الحساسات — أعمدة اختيارية مفقودة كانت تُفشل الاستعلام بصمت
        $tid  = $_jwt_tid ?? 1;
        $res  = $conn->query("SELECT * FROM users WHERE tenant_id=$tid ORDER BY id DESC");
        if (!$res) { echo json_encode(["success" => false, "message" => "خطأ في الاستعلام: " . $conn->error], JSON_UNESCAPED_UNICODE); break; }
        $users = [];
        while ($row = $res->fetch_assoc()) {
            unset($row['password'], $row['twofa'], $row['twofa_channel']);
            $row['id'] = (int)$row['id'];
            $users[] = $row;
        }
        echo json_encode(["success" => true, "data" => $users]);
        break;

    case 'add_user': {
        $tid   = $_jwt_tid ?? 1;
        $name  = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $email = strtolower(trim($conn->real_escape_string($input_data['email'] ?? '')));
        $role  = in_array($input_data['role']??'employee',['admin','employee','tech']) ? $input_data['role'] : 'employee';
        $job   = $conn->real_escape_string(trim($input_data['job'] ?? ''));
        $phone = $conn->real_escape_string(trim($input_data['phone'] ?? ''));
        $rawPw = (string)($input_data['password'] ?? '');
        if (!$name || !$email || strlen($rawPw) < 6) {
            echo json_encode(['success'=>false,'message'=>'الاسم والبريد وكلمة المرور (6+ أحرف) مطلوبة'], JSON_UNESCAPED_UNICODE); break;
        }
        // التحقق من حد عدد المستخدمين
        $maxU = tenant_user_limit($conn, $tid);
        $curU = (int)(($conn->query("SELECT COUNT(*) c FROM users WHERE tenant_id=$tid"))->fetch_assoc()['c'] ?? 0);
        if ($curU >= $maxU) { echo json_encode(['success'=>false,'message'=>"تجاوزت الحد الأقصى ($maxU موظف) في خطتك الحالية. رقّ خطتك لإضافة المزيد."], JSON_UNESCAPED_UNICODE); break; }
        $check = $conn->query("SELECT id FROM users WHERE email='$email' LIMIT 1");
        if ($check && $check->num_rows > 0) { echo json_encode(['success'=>false,'message'=>'هذا البريد موجود مسبقاً'], JSON_UNESCAPED_UNICODE); break; }
        $pwHash = $conn->real_escape_string(password_hash($rawPw, PASSWORD_BCRYPT));
        $sql = "INSERT INTO users (name,email,password,role,job,phone,department,permissions,tenant_id,must_change_password)
                VALUES ('$name','$email','$pwHash','$role','$job','$phone','الإدارة','[]',$tid,0)";
        if ($conn->query($sql)) {
            acc_audit($conn, $tid, 'user', $conn->insert_id, 'create', "email=$email|role=$role", 'admin', $_clientIp, $_clientUa);
            echo json_encode(['success'=>true,'id'=>(int)$conn->insert_id], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['success'=>false,'message'=>$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'invite_user': {
        // دعوة موظف جديد — يُنشئ الحساب ويُرسل بيانات الدخول بالبريد
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يجب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid   = $_jwt_tid ?? 1;
        $name  = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $email = strtolower(trim($conn->real_escape_string($input_data['email'] ?? '')));
        $role  = in_array($input_data['role']??'employee',['admin','employee','tech']) ? $input_data['role'] : 'employee';
        $job   = $conn->real_escape_string(trim($input_data['job'] ?? ''));
        $phone = $conn->real_escape_string(trim($input_data['phone'] ?? ''));
        if (!$name || !$email) { echo json_encode(['success'=>false,'message'=>'الاسم والبريد مطلوبان'], JSON_UNESCAPED_UNICODE); break; }
        // التحقق من حد عدد المستخدمين
        $maxU = tenant_user_limit($conn, $tid);
        $curU = (int)(($conn->query("SELECT COUNT(*) c FROM users WHERE tenant_id=$tid"))->fetch_assoc()['c'] ?? 0);
        if ($curU >= $maxU) { echo json_encode(['success'=>false,'message'=>"تجاوزت الحد الأقصى ($maxU موظف) في خطتك الحالية. رقّ خطتك لإضافة المزيد."], JSON_UNESCAPED_UNICODE); break; }
        $check = $conn->query("SELECT id FROM users WHERE email='$email' LIMIT 1");
        if ($check && $check->num_rows > 0) { echo json_encode(['success'=>false,'message'=>'هذا البريد مستخدم مسبقاً'], JSON_UNESCAPED_UNICODE); break; }
        $tempPass = substr(str_shuffle('ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#'), 0, 10);
        $tempHash = $conn->real_escape_string(password_hash($tempPass, PASSWORD_BCRYPT));
        $conn->query("INSERT INTO users (name,email,password,role,job,phone,department,permissions,tenant_id,must_change_password)
                      VALUES ('$name','$email','$tempHash','$role','$job','$phone','الإدارة','[]',$tid,1)");
        $newUid = (int)$conn->insert_id;
        if (!$newUid) { echo json_encode(['success'=>false,'message'=>$conn->error], JSON_UNESCAPED_UNICODE); break; }
        // جلب اسم الشركة
        $cq = $conn->query("SELECT sval FROM acc_settings WHERE tenant_id=$tid AND skey='company_name' LIMIT 1");
        $cName = $cq ? ($cq->fetch_assoc()['sval'] ?? $_tenantName) : $_tenantName;
        // إرسال الدعوة
        $portalUrl = 'https://semak.sa/login';
        $html = email_template(
            "دعوة للانضمام إلى فريق " . htmlspecialchars($cName),
            "تمّت إضافتك كعضو في فريق <b>" . htmlspecialchars($cName) . "</b>."
            . "<br><br><b>بيانات دخولك الأولية:</b><br>"
            . "<table style='margin:12px 0;border-collapse:collapse'>"
            . "<tr><td style='padding:4px 12px 4px 0;color:#64748b'>البريد:</td><td><b>" . htmlspecialchars($email) . "</b></td></tr>"
            . "<tr><td style='padding:4px 12px 4px 0;color:#64748b'>كلمة المرور المؤقتة:</td><td style='font-size:22px;font-weight:bold;letter-spacing:4px;direction:ltr'>" . htmlspecialchars($tempPass) . "</td></tr></table>"
            . "يُرجى تغيير كلمة المرور بعد أول دخول.",
            ['url' => $portalUrl, 'label' => 'الدخول للوحة التحكم']
        );
        $emailSent = send_email($email, "دعوة للانضمام إلى " . $cName, $html);
        $waSent = false;
        if ($phone) {
            $np = preg_replace('/\D/','', $phone); $np = ltrim($np,'0');
            if (substr($np,0,3)!=='966') $np='966'.$np;
            $waSent = wa_send_text($np, "🎉 مرحباً {$name}!\nتمّت دعوتك للانضمام إلى فريق {$cName}.\n\n📧 البريد: {$email}\n🔑 كلمة المرور المؤقتة: {$tempPass}\n\nيُرجى الدخول وتغيير كلمة المرور:\n{$portalUrl}");
        }
        acc_audit($conn, $tid, 'user', $newUid, 'invite', "email=$email|role=$role", 'admin', $_clientIp, $_clientUa);
        echo json_encode(['success'=>true,'id'=>$newUid,'email_sent'=>!empty($emailSent['ok']),'wa_sent'=>$waSent,'message'=>'تمّت الدعوة بنجاح — تحقق من بريدك'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'update_user': {
        $tid   = $_jwt_tid ?? 1;
        $id    = (int)$input_data['id'];
        $name  = $conn->real_escape_string($input_data['name'] ?? '');
        $email = strtolower(trim($conn->real_escape_string($input_data['email'] ?? '')));
        $role  = in_array($input_data['role']??'employee',['admin','employee','tech']) ? $input_data['role'] : 'employee';
        $job   = $conn->real_escape_string($input_data['job'] ?? '');
        $phone = $conn->real_escape_string($input_data['phone'] ?? '');
        if (!$id) { echo json_encode(['success'=>false,'message'=>'id مطلوب'], JSON_UNESCAPED_UNICODE); break; }
        $sql = "UPDATE users SET name='$name', email='$email', role='$role', job='$job', phone='$phone'";
        if (!empty($input_data['password'])) {
            $pwH = $conn->real_escape_string(password_hash((string)$input_data['password'], PASSWORD_BCRYPT));
            $sql .= ", password='$pwH'";
        }
        $sql .= " WHERE id=$id AND tenant_id=$tid";  // ← حماية المستأجر
        if ($conn->query($sql)) {
            echo json_encode(['success'=>true], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['success'=>false,'message'=>$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'delete_user': {
        $tid = $_jwt_tid ?? 1;
        $id  = (int)$input_data['id'];
        // لا نحذف — نُعطّل فقط (soft delete via role change أو flag)
        // الحذف الفعلي مسموح لكن فقط ضمن نفس المستأجر
        $conn->query("DELETE FROM users WHERE id=$id AND tenant_id=$tid");
        echo json_encode(['success'=>true], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'change_password': {
        // تغيير كلمة المرور — يتطلب JWT، وكلمة المرور الحالية للتحقق
        if (!$_jwt_claims) {
            echo json_encode(['success'=>false,'message'=>'يجب تسجيل الدخول أولاً'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $uid     = (int)($_jwt_claims['sub'] ?? 0);
        $oldPass = (string)($input_data['old_password'] ?? '');
        $newPass = (string)($input_data['new_password'] ?? '');
        if (!$uid || $oldPass === '' || strlen($newPass) < 8) {
            echo json_encode(['success'=>false,'message'=>'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $ur = $conn->query("SELECT password,must_change_password FROM users WHERE id=$uid LIMIT 1");
        if (!$ur || !($ud = $ur->fetch_assoc())) {
            echo json_encode(['success'=>false,'message'=>'المستخدم غير موجود'], JSON_UNESCAPED_UNICODE);
            break;
        }
        if (!password_verify($oldPass, $ud['password'])) {
            echo json_encode(['success'=>false,'message'=>'كلمة المرور الحالية غير صحيحة'], JSON_UNESCAPED_UNICODE);
            break;
        }
        $newHash = $conn->real_escape_string(password_hash($newPass, PASSWORD_BCRYPT));
        $conn->query("UPDATE users SET password='$newHash', must_change_password=0 WHERE id=$uid");
        echo json_encode(['success'=>true,'message'=>'تم تغيير كلمة المرور بنجاح'], JSON_UNESCAPED_UNICODE);
        break;
    }

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
        $tid     = $_jwt_tid ?? 1;
        $res     = $conn->query("SELECT * FROM maintenance WHERE tenant_id=$tid ORDER BY id DESC");
        $tickets = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $tickets[] = $row; } }
        echo json_encode($tickets);
        break;

    case 'add_maintenance':
        $tid     = $_jwt_tid ?? 1;
        $name    = $conn->real_escape_string($input_data['name']   ?? '');
        $phone   = $conn->real_escape_string($input_data['phone']  ?? '');
        $unit    = $conn->real_escape_string($input_data['unit']   ?? '');
        $type    = $conn->real_escape_string($input_data['type']   ?? '');
        $descrip = $conn->real_escape_string($input_data['desc']   ?? '');
        $date    = date('Y-m-d H:i:s');
        $status  = "قيد الانتظار";
        $sql     = "INSERT INTO maintenance (tenant_id, name, phone, unit, type, descrip, status, date) VALUES ($tid, '$name', '$phone', '$unit', '$type', '$descrip', '$status', '$date')";
        if ($conn->query($sql)) {
            $new_id = $conn->insert_id;
            notify($conn, 1, null, 'maintenance', 'طلب صيانة جديد', 'العميل ' . $name . ' · وحدة ' . $unit . ' · ' . $type, '/admin/dashboard/maintenance');
            acc_audit($conn, $tid, 'maintenance', $new_id, 'create', 'طلب صيانة · ' . $name . ' · ' . $unit, $name);
            $wa_token    = MOTTASL_TOKEN;
            $wa_headers  = ["Content-Type: application/json", "Authorization: Bearer $wa_token"];
            // رقم المدير الخاص بالمستأجر (من جدول tenants أو الإعدادات)
            $tPhoneRow   = $conn->query("SELECT phone FROM tenants WHERE id=$tid LIMIT 1");
            $tPhone      = ($tPhoneRow && ($tpr = $tPhoneRow->fetch_assoc()) && !empty($tpr['phone']))
                           ? preg_replace('/\D/', '', $tpr['phone']) : '966550163121';
            if (substr($tPhone, 0, 3) !== '966') $tPhone = '966' . ltrim($tPhone, '0');
            $admin_phone = $tPhone;

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
        $tid       = $_jwt_tid ?? 1;
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
        $sql .= " WHERE id=$ticket_id AND tenant_id=$tid";
        $conn->query($sql);

        // إرسال إشعار واتساب للعميل عند تغيير الحالة فقط
        if ($field === 'status') {
            $t = $conn->query("SELECT * FROM maintenance WHERE id=$ticket_id AND tenant_id=$tid");
            if ($t && $row = $t->fetch_assoc()) {
                $client_phone = preg_replace('/\D/', '', $row['phone']);
                $client_phone = ltrim($client_phone, '0');
                if (substr($client_phone, 0, 3) !== '966') $client_phone = '966' . $client_phone;
                if (strlen($client_phone) < 12) break; // رقم غير صالح
                $tech  = (!empty($row['technician']) && $row['technician'] !== 'لم يتم التعيين') ? $row['technician'] : 'سيتم التحديد';
                $sched = !empty($row['date']) ? $row['date'] : 'سيتم التأكيد';
                $otp_val = !empty($row['otp']) ? $row['otp'] : '—';
                // قالب semak_maint_update: [name, ticket_id, status]
                $wa_token = MOTTASL_TOKEN;
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
        $tid   = $_jwt_tid ?? 1;
        $res   = $conn->query("SELECT * FROM leads WHERE tenant_id=$tid ORDER BY id DESC");
        $leads = [];
        if ($res) { while ($row = $res->fetch_assoc()) { $leads[] = $row; } }
        echo json_encode($leads);
        break;

    case 'add_lead':
        $tid      = $_jwt_tid ?? 1;
        $name     = $conn->real_escape_string($input_data['name']     ?? '');
        $phone    = $conn->real_escape_string($input_data['phone']    ?? '');
        $interest = $conn->real_escape_string($input_data['interest'] ?? '');
        $source   = $conn->real_escape_string($input_data['source']   ?? '');
        $status   = "جديد";

        // ── منع تكرار الجوال: إذا الرقم مسجل مسبقاً، أضف الاهتمام للسجل القائم ──
        $clean_phone   = preg_replace('/\D/', '', $phone);
        $phone_no_zero = preg_replace('/^(0|966)/', '', $clean_phone);
        $dup_res = $conn->query("SELECT id, interest, notes FROM leads WHERE tenant_id=$tid AND REPLACE(REPLACE(phone, '+', ''), ' ', '') LIKE '%$phone_no_zero%' ORDER BY id DESC LIMIT 1");
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

        $sql = "INSERT INTO leads (tenant_id, name, phone, interest, source, unit, status) VALUES ($tid, '$name', '$phone', '$interest', '$source', '$interest', '$status')";
        if ($conn->query($sql)) {
            $new_id = $conn->insert_id;
            notify($conn, 1, null, 'lead', 'عميل محتمل جديد', 'الاسم: ' . $name . ' · ' . $interest, '/admin/dashboard/leads');
            acc_audit($conn, $tid, 'lead', $new_id, 'create', 'عميل محتمل · ' . $name . ' · ' . $interest, $name);
            // إرسال إشعار واتساب للإدارة تلقائياً
            $wa_token    = MOTTASL_TOKEN;
            $tPhoneRow   = $conn->query("SELECT phone FROM tenants WHERE id=$tid LIMIT 1");
            $tPhone      = ($tPhoneRow && ($tpr = $tPhoneRow->fetch_assoc()) && !empty($tpr['phone']))
                           ? preg_replace('/\D/', '', $tpr['phone']) : '966550163121';
            if (substr($tPhone, 0, 3) !== '966') $tPhone = '966' . ltrim($tPhone, '0');
            $admin_phone = $tPhone;
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
            $sql2  = "INSERT INTO leads (tenant_id, name, phone, status, notes) VALUES ($tid, '$name', '$phone', '$status', '$notes')";
            if ($conn->query($sql2)) {
                echo json_encode(["success" => true, "id" => $conn->insert_id]);
            } else {
                echo json_encode(["success" => false, "message" => $conn->error]);
            }
        }
        break;

    case 'update_lead_status':
        $tid    = $_jwt_tid ?? 1;
        $id     = (int)$input_data['id'];
        $status = $conn->real_escape_string($input_data['status']);
        $sql    = "UPDATE leads SET status='$status'";
        if (!empty($input_data['notes'])) {
            $notes = $conn->real_escape_string($input_data['notes']);
            $sql  .= ", notes='$notes'";
        }
        $sql .= " WHERE id=$id AND tenant_id=$tid";
        $conn->query($sql);
        echo json_encode(["success" => true]);
        break;

    case 'delete_lead':
        $tid = $_jwt_tid ?? 1;
        $id  = (int)$input_data['id'];
        $conn->query("DELETE FROM leads WHERE id=$id AND tenant_id=$tid");
        echo json_encode(["success" => true]);
        break;

    // ─── عدادات لوحة الإدارة (شارات الإشعارات) ─────────────────────────────────
    case 'dashboard_counts':
        $tid    = $_jwt_tid ?? 1;
        $counts = [];
        $tasks  = [];

        // مهتمون جدد (لم تتغير حالتهم بعد)
        $r = $conn->query("SELECT COUNT(*) c FROM leads WHERE tenant_id=$tid AND status = 'جديد'");
        $counts['leads_new'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['leads_new'] > 0) {
            $tasks[] = ["icon" => "Users", "color" => "teal", "tab" => "leads",
                "text" => "{$counts['leads_new']} مهتم جديد ينتظر المتابعة"];
        }

        // طلبات صيانة مفتوحة
        $r = $conn->query("SELECT COUNT(*) c FROM maintenance WHERE tenant_id=$tid AND status NOT IN ('مكتمل', 'مغلق', 'ملغي')");
        $counts['maintenance_open'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['maintenance_open'] > 0) {
            $tasks[] = ["icon" => "Wrench", "color" => "purple", "tab" => "maintenance",
                "text" => "{$counts['maintenance_open']} طلب صيانة مفتوح"];
        }

        // طلبات صيانة بلا فني
        $r = $conn->query("SELECT COUNT(*) c FROM maintenance WHERE tenant_id=$tid AND (technician IS NULL OR technician = '' OR technician = 'لم يتم التعيين') AND status NOT IN ('مكتمل', 'مغلق', 'ملغي')");
        $counts['maintenance_unassigned'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['maintenance_unassigned'] > 0) {
            $tasks[] = ["icon" => "AlertTriangle", "color" => "red", "tab" => "maintenance",
                "text" => "{$counts['maintenance_unassigned']} طلب صيانة بدون فني معيّن"];
        }

        // محادثات البوت اليوم
        $r = $conn->query("SELECT COUNT(DISTINCT phone) c FROM wa_bot_conversations WHERE DATE(created_at) = CURDATE()");
        $counts['bot_customers_today'] = (int)($r ? $r->fetch_assoc()['c'] : 0);

        // تقارير ملاحظات (snaglist) معلقة
        $r = $conn->query("SELECT COUNT(*) c FROM inspections WHERE tenant_id=$tid AND (status IS NULL OR status = '')");
        $counts['inspections_pending'] = (int)($r ? $r->fetch_assoc()['c'] : 0);
        if ($counts['inspections_pending'] > 0) {
            $tasks[] = ["icon" => "ClipboardCheck", "color" => "indigo", "tab" => "inspection",
                "text" => "{$counts['inspections_pending']} فحص لم يُغلق بعد"];
        }

        // اعتراضات ميزانية (في الملاحظات)
        $r = $conn->query("SELECT COUNT(*) c FROM leads WHERE tenant_id=$tid AND (notes LIKE '%ميزانية%' OR notes LIKE '%اعتراض%')");
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

    case 'daftra_balances':
        // استكشاف (قراءة فقط): أي نقاط أرصدة تُتيحها دفترة لبناء القيد الافتتاحي آليًا (خزائن/موردون/حسابات)
        set_time_limit(60);
        $dk = "__DAFTRA_KEY__"; $base = "https://semak.daftra.com/api2"; $hh = ["APIKEY: $dk", "Accept: application/json"];
        $probe = function($ep) use ($base,$hh){
            $ch=curl_init("$base/$ep");
            curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$hh,CURLOPT_TIMEOUT=>20]);
            $r=curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
            $j=json_decode($r,true);
            $data = is_array($j['data']??null) ? $j['data'] : null;
            $first = $data && isset($data[0]) ? $data[0] : null;
            // نُظهر مفاتيح أول عنصر فقط (اكتشاف شكل البيانات) دون إغراق
            $firstKeys = null;
            if (is_array($first)) { $inner = (count($first)===1 && is_array(reset($first))) ? reset($first) : $first; $firstKeys = array_keys($inner); }
            return ['http'=>$code,'data_count'=>$data!==null?count($data):null,'top_keys'=>is_array($j)?array_keys($j):null,'first_item_keys'=>$firstKeys];
        };
        $out=[];
        foreach (['treasuries.json','suppliers.json','products.json','journals.json','journal_accounts.json','accounts.json','account_balances.json','expenses.json'] as $ep) $out[$ep]=$probe($ep);
        echo json_encode(['success'=>true,'probe'=>$out], JSON_UNESCAPED_UNICODE);
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
        $client_id_filter = (int)($_GET['client_id'] ?? 0);
        $qp   = "page=$page&limit=$limit";
        if ($from) $qp .= "&from_date=$from";
        if ($to)   $qp .= "&to_date=$to";
        if ($client_id_filter) $qp .= "&client_id=$client_id_filter";
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
    // إعدادات الربط — حفظ/حالة كوكي جلسة دفترة (خدمة ذاتية بدون redeploy)
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_save_cookie':
        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $cookie = trim($body['cookie'] ?? '');
        if ($cookie === '') { echo json_encode(['success'=>false,'message'=>'الكوكي فارغ']); break; }
        $esc = $conn->real_escape_string($cookie);
        $conn->query("INSERT INTO daftra_config (k,v) VALUES ('session_cookie','$esc')
                      ON DUPLICATE KEY UPDATE v='$esc'");
        // اختبار فوري على فاتورة معروفة (id=13) للتأكد أن الكوكي صالح
        $ok = false; $ctype = '';
        $ch = curl_init("https://semak.daftra.com/owner/invoices/view/13.pdf");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_FOLLOWLOCATION=>true, CURLOPT_TIMEOUT=>20,
            CURLOPT_HTTPHEADER=>["Cookie: $cookie"], CURLOPT_USERAGENT=>'Mozilla/5.0 SemakProxy']);
        $b = curl_exec($ch); $ctype = curl_getinfo($ch, CURLINFO_CONTENT_TYPE); curl_close($ch);
        $ok = ($b && (stripos($ctype,'pdf')!==false || substr($b,0,4)==='%PDF'));
        echo json_encode(['success'=>true,'valid'=>$ok,'message'=>$ok?'تم الحفظ والكوكي صالح ✓':'تم الحفظ لكن الكوكي قد يكون غير صالح'], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_cookie_status':
        $r = $conn->query("SELECT v, updated_at FROM daftra_config WHERE k='session_cookie' LIMIT 1");
        $row = $r ? $r->fetch_assoc() : null;
        $set = $row && !empty(trim($row['v']));
        echo json_encode([
            'success'    => true,
            'set'        => $set,
            'updated_at' => $row['updated_at'] ?? null,
            'preview'    => $set ? substr($row['v'],0,14).'…' : '',
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ══════════════════════════════════════════════════════════════════════
    // PDF الرسمي من دفترة (عربي صحيح + ZATCA QR) — proxy بالجلسة المخزّنة
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_doc_pdf':
        // type: invoice | estimate | purchase   id: رقم المستند
        $type    = $_GET['type'] ?? 'invoice';
        $doc_id  = (int)($_GET['id'] ?? 0);
        $session = daftra_session_cookie($conn);
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

        // فشل جلب PDF عبر جلسة الخادم (كوكي منتهي) — تدرّج سلس:
        // إن طُلب JSON صراحةً نُرجع تفاصيل التشخيص، وإلا نحوّل المتصفّح مباشرة
        // لرابط دفترة (يفتح بجلسة متصفّح المستخدم إن كان مسجّلاً في دفترة).
        $debug = isset($_GET['debug']);
        if ($debug) {
            echo json_encode([
                'success'   => false,
                'message'   => 'تعذّر جلب PDF عبر جلسة الخادم — الكوكي منتهي',
                'print_url' => "https://semak.daftra.com".$candidates[0],
                'tried'     => $tried,
            ], JSON_UNESCAPED_UNICODE);
        } else {
            ob_end_clean();
            header_remove('Content-Type');
            header('Location: https://semak.daftra.com'.$candidates[0], true, 302);
        }
        exit(0);

    // ══════════════════════════════════════════════════════════════════════
    // وحدة المشتريات — CRUD كامل
    // ══════════════════════════════════════════════════════════════════════

    case 'daftra_purchases_list':
        set_time_limit(30);
        $dk   = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $lim_pur = (int)($_GET['limit'] ?? 50);
        $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
        $supplier_id_filter = (int)($_GET['supplier_id'] ?? 0);
        $qp   = "page=$page&limit=$lim_pur";
        if ($from) $qp .= "&from_date=$from";
        if ($to)   $qp .= "&to_date=$to";
        if ($supplier_id_filter) $qp .= "&supplier_id=$supplier_id_filter";
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

    case 'daftra_purchase_get':
        // جلب تفاصيل مشتراة واحدة (بما في ذلك المرفقات والبنود)
        $dk = "__DAFTRA_KEY__"; $pur_id = (int)($_GET['id'] ?? 0);
        if (!$pur_id) { echo json_encode(['success'=>false,'message'=>'id مطلوب']); break; }
        $ch = curl_init("https://semak.daftra.com/api2/purchase_invoices/$pur_id.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        echo json_encode(['success'=>$code===200,'http_code'=>$code,'data'=>$data], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_attachment_download':
        // تحميل مرفق من دفترة عبر المسار (path) باستخدام /s3/ + session cookie
        $path = $_GET['path'] ?? '';
        if (!$path) { echo json_encode(['success'=>false,'message'=>'path مطلوب (مثال: files/11ddb74/purchase_order/UUID.pdf)']); break; }
        $session = daftra_session_cookie($conn);
        $url = "https://semak.daftra.com/s3/" . ltrim($path, '/');
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_COOKIE => "daftra_session=$session",
            CURLOPT_HTTPHEADER => ["Accept: */*"],
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $ct = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        curl_close($ch);
        if ($code === 200 && strlen($res) > 100) {
            echo json_encode([
                'success' => true,
                'http_code' => $code,
                'content_type' => $ct,
                'size' => strlen($res),
                'base64' => base64_encode($res),
            ], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode([
                'success' => false,
                'http_code' => $code,
                'content_type' => $ct,
                'size' => strlen($res),
                'final_url_domain' => parse_url($finalUrl, PHP_URL_HOST),
            ], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'daftra_purchase_delete':
        $dk = "__DAFTRA_KEY__"; $pur_id = (int)($_GET['id'] ?? 0);
        $ch = curl_init("https://semak.daftra.com/api2/purchase_invoices/$pur_id.json");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk"], CURLOPT_CUSTOMREQUEST=>'DELETE', CURLOPT_TIMEOUT=>15]);
        curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        echo json_encode(['success'=>in_array($code,[200,202,204]),'http_code'=>$code]);
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
            'note'                => $body['notes']        ?? '',
            'work_order_id'       => $body['work_order_id'] ?? null,
            'treasury_id'         => $body['treasury_id']  ?? '',
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
        $ch = curl_init("https://semak.daftra.com/v2/api/entity/rental_unit/list/$page");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["APIKEY: $dk","Accept: application/json"], CURLOPT_TIMEOUT=>15, CURLOPT_FOLLOWLOCATION=>true]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $data = json_decode($res, true) ?? [];
        echo json_encode(['success'=>true,'data'=>$data['data']??[],'meta'=>$data['meta']??[],'http_code'=>$code], JSON_UNESCAPED_UNICODE);
        break;

    case 'daftra_reservation_orders':
        $dk = "__DAFTRA_KEY__";
        $page = (int)($_GET['page'] ?? 1);
        $ch = curl_init("https://semak.daftra.com/v2/api/entity/booking/list/$page");
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
            'assets'          => ['https://semak.daftra.com/v2/api/entity/asset/list/{page}', null],
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
    // ═══════════════════════════════════════════════════════════════════════
    // محرّك المحاسبة المستقل (Semak Ledger) — كودنا يخزّن ويعالج، صفر دفترة
    // ═══════════════════════════════════════════════════════════════════════

    case 'gl_seed':
        // زرع دليل حسابات سعودي أساسي إن كان فارغًا
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $cnt = 0; $r = $conn->query("SELECT COUNT(*) c FROM acc_accounts WHERE tenant_id=$tid");
        if ($r) $cnt = (int)$r->fetch_assoc()['c'];
        if ($cnt > 0) { echo json_encode(['success'=>true,'message'=>'دليل الحسابات موجود مسبقًا','count'=>$cnt]); break; }
        // [code, name, type, is_group]
        $seed = [
            ['1','الأصول','asset',1],
            ['11','الأصول المتداولة','asset',1],
            ['1101','الصندوق','asset',0],
            ['1102','البنك','asset',0],
            ['1103','العملاء (المدينون)','asset',0],
            ['1104','المخزون','asset',0],
            ['12','الأصول الثابتة','asset',1],
            ['1201','أراضي وعقارات','asset',0],
            ['1202','أثاث ومعدات','asset',0],
            ['2','الخصوم','liability',1],
            ['2101','الموردون (الدائنون)','liability',0],
            ['2102','ضريبة القيمة المضافة','liability',0],
            ['2103','رواتب مستحقة','liability',0],
            ['3','حقوق الملكية','equity',1],
            ['3101','رأس المال','equity',0],
            ['3102','الأرباح المُحتجزة','equity',0],
            ['4','الإيرادات','revenue',1],
            ['4101','إيرادات المبيعات','revenue',0],
            ['4102','إيرادات الإيجارات','revenue',0],
            ['5','المصروفات','expense',1],
            ['5101','تكلفة المبيعات','expense',0],
            ['5102','رواتب وأجور','expense',0],
            ['5103','إيجارات ومرافق','expense',0],
            ['5104','مصروفات تشغيلية','expense',0],
        ];
        $stmt = $conn->prepare("INSERT INTO acc_accounts (tenant_id,code,name,type,is_group) VALUES (?,?,?,?,?)");
        foreach ($seed as $a) { $stmt->bind_param('isssi', $tid, $a[0], $a[1], $a[2], $a[3]); $stmt->execute(); }
        $stmt->close();
        $fixed = acc_fix_hierarchy($conn, $tid); // اربط كل حساب بأبيه عبر بادئة الكود
        echo json_encode(['success'=>true,'message'=>'تم إنشاء دليل الحسابات','count'=>count($seed),'linked'=>$fixed], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_accounts':
        // دليل الحسابات + الرصيد المحسوب من البنود (كودنا يحسب)
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $sql = "SELECT a.*,
                   COALESCE(SUM(CASE WHEN e.is_posted=1 THEN l.debit  ELSE 0 END),0) AS sum_debit,
                   COALESCE(SUM(CASE WHEN e.is_posted=1 THEN l.credit ELSE 0 END),0) AS sum_credit
                FROM acc_accounts a
                LEFT JOIN acc_lines   l ON l.account_id=a.id AND l.tenant_id=a.tenant_id
                LEFT JOIN acc_entries e ON e.id=l.entry_id
                WHERE a.tenant_id=$tid
                GROUP BY a.id
                ORDER BY a.code";
        $res = $conn->query($sql); $rows = [];
        while ($res && ($x = $res->fetch_assoc())) {
            $d = (float)$x['sum_debit']; $c = (float)$x['sum_credit'];
            // اتجاه الرصيد الطبيعي حسب نوع الحساب
            $bal = in_array($x['type'], ['asset','expense']) ? ($d - $c) : ($c - $d);
            $x['balance'] = round($bal, 2);
            $rows[] = $x;
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_account_save':
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $code = $conn->real_escape_string(trim($input_data['code'] ?? ''));
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $type = $conn->real_escape_string($input_data['type'] ?? 'asset');
        $pid  = isset($input_data['parent_id']) && $input_data['parent_id'] !== '' ? (int)$input_data['parent_id'] : 'NULL';
        $grp  = (int)($input_data['is_group'] ?? 0);
        $cfs  = $conn->real_escape_string($input_data['cf_section'] ?? 'none');
        if (!in_array($cfs,['none','cash','operating','investing','financing'])) $cfs='none';
        if (!$code || !$name) { echo json_encode(['success'=>false,'message'=>'الكود والاسم مطلوبان']); break; }
        if (!in_array($type, ['asset','liability','equity','revenue','expense'])) $type = 'asset';
        if ($id) {
            $conn->query("UPDATE acc_accounts SET code='$code',name='$name',type='$type',parent_id=$pid,is_group=$grp,cf_section='$cfs' WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>true,'id'=>$id]);
        } else {
            $ok = $conn->query("INSERT INTO acc_accounts (tenant_id,code,name,type,parent_id,is_group,cf_section) VALUES ($tid,'$code','$name','$type',$pid,$grp,'$cfs')");
            echo json_encode(['success'=>$ok,'id'=>$conn->insert_id,'message'=>$ok?'تم':$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'gl_opening_balance_get': {
        // جلب بنود قيود الأرصدة الافتتاحية المرحّلة
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $rows = [];
        $r = $conn->query("SELECT e.id,e.entry_no,e.date,l.account_id,l.debit,l.credit,
                                  a.code AS acct_code,a.name AS acct_name,a.type AS acct_type
                           FROM acc_entries e
                           JOIN acc_lines  l ON l.entry_id=e.id AND l.tenant_id=e.tenant_id
                           JOIN acc_accounts a ON a.id=l.account_id AND a.tenant_id=e.tenant_id
                           WHERE e.tenant_id=$tid AND e.ref_type='opening' AND e.is_posted=1
                           ORDER BY e.date DESC, a.code ASC LIMIT 500");
        while ($r && ($x=$r->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_opening_balance_post': {
        // ترحيل قيد الأرصدة الافتتاحية
        $tid      = (int)($input_data['tenant_id'] ?? 1);
        $date     = $conn->real_escape_string($input_data['date'] ?? date('Y-01-01'));
        $rawLines = $input_data['lines'] ?? [];
        $lines    = [];
        foreach ($rawLines as $rl) {
            $aid = (int)($rl['account_id'] ?? 0);
            $d   = round((float)($rl['debit']  ?? 0), 2);
            $c   = round((float)($rl['credit'] ?? 0), 2);
            if (!$aid || ($d == 0 && $c == 0)) continue;
            $lines[] = ['account_id'=>$aid,'debit'=>$d,'credit'=>$c,'description'=>'رصيد افتتاحي'];
        }
        if (empty($lines)) { echo json_encode(['success'=>false,'message'=>'لا توجد بنود بمبالغ صالحة'], JSON_UNESCAPED_UNICODE); break; }
        $td = array_sum(array_column($lines,'debit'));
        $tc = array_sum(array_column($lines,'credit'));
        if (abs($td - $tc) > 0.01) {
            echo json_encode(['success'=>false,'message'=>'القيد غير متوازن: مدين '.round($td,2).' ≠ دائن '.round($tc,2)], JSON_UNESCAPED_UNICODE); break;
        }
        try {
            $r = acc_post_entry($conn, $tid, $date, 'أرصدة افتتاحية', 'opening', null, null, $lines, 1);
            echo json_encode(['success'=>true,'entry_no'=>$r['eno'],'message'=>'تم ترحيل الأرصدة الافتتاحية: '.$r['eno']], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success'=>false,'message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'gl_entry_create':
    case 'gl_entry_update':
        // إنشاء/تعديل قيد متوازن — كودنا يتحقق أن المدين = الدائن ويرحّل في معاملة واحدة
        $tid   = (int)($input_data['tenant_id'] ?? 1);
        $id    = (int)($input_data['id'] ?? 0);
        $date  = $conn->real_escape_string($input_data['date'] ?? date('Y-m-d'));
        $desc  = $conn->real_escape_string($input_data['description'] ?? '');
        $reft  = $conn->real_escape_string($input_data['ref_type'] ?? '');
        $refid = isset($input_data['ref_id']) && $input_data['ref_id'] !== '' ? (int)$input_data['ref_id'] : 'NULL';
        $by    = $conn->real_escape_string($input_data['created_by'] ?? '');
        $posted= isset($input_data['is_posted']) ? (int)(bool)$input_data['is_posted'] : 1;
        $lines = $input_data['lines'] ?? [];
        if (count($lines) < 2) { echo json_encode(['success'=>false,'message'=>'القيد يحتاج بندين على الأقل']); break; }

        // منع الترحيل في فترة مالية مقفلة
        $fy = (int)substr($date, 0, 4);
        $pc = $conn->query("SELECT is_closed FROM acc_periods WHERE tenant_id=$tid AND fy=$fy LIMIT 1");
        if ($pc && ($pr = $pc->fetch_assoc()) && (int)$pr['is_closed'] === 1) { echo json_encode(['success'=>false,'message'=>"الفترة المالية $fy مقفلة — لا يمكن الترحيل"], JSON_UNESCAPED_UNICODE); break; }

        $td = 0; $tc = 0; $clean = [];
        foreach ($lines as $ln) {
            $acc = (int)($ln['account_id'] ?? 0);
            $dv  = round((float)($ln['debit'] ?? 0), 2);
            $cv  = round((float)($ln['credit'] ?? 0), 2);
            if (!$acc || ($dv == 0 && $cv == 0)) continue;
            if ($dv > 0 && $cv > 0) { echo json_encode(['success'=>false,'message'=>'البند لا يكون مدين ودائن معًا']); break 2; }
            $td += $dv; $tc += $cv;
            $pt  = isset($ln['party_type']) && in_array($ln['party_type'], ['customer','supplier','partner']) ? "'".$conn->real_escape_string($ln['party_type'])."'" : 'NULL';
            $plid= isset($ln['party_id']) && $ln['party_id'] !== '' ? (int)$ln['party_id'] : 'NULL';
            $dd  = isset($ln['due_date']) && $ln['due_date'] !== '' ? "'".$conn->real_escape_string($ln['due_date'])."'" : 'NULL';
            $cc  = isset($ln['cost_center_id']) && $ln['cost_center_id'] !== '' ? (int)$ln['cost_center_id'] : 'NULL';
            $clean[] = ['acc'=>$acc,'d'=>$dv,'c'=>$cv,'cc'=>$cc,'pt'=>$pt,'pid'=>$plid,'dd'=>$dd,'desc'=>$conn->real_escape_string($ln['description'] ?? '')];
        }
        if (count($clean) < 2) { echo json_encode(['success'=>false,'message'=>'بنود غير كافية']); break; }
        if (round($td,2) != round($tc,2)) { echo json_encode(['success'=>false,'message'=>"القيد غير متوازن: مدين $td ≠ دائن $tc"], JSON_UNESCAPED_UNICODE); break; }
        if ($td <= 0) { echo json_encode(['success'=>false,'message'=>'إجمالي القيد صفر']); break; }

        $conn->begin_transaction();
        try {
            if ($id) {
                $er  = $conn->query("SELECT * FROM acc_entries WHERE id=$id AND tenant_id=$tid LIMIT 1");
                $old = $er ? $er->fetch_assoc() : null;
                if (!$old) throw new Exception('القيد غير موجود');
                if (!empty($old['ref_type']) && !in_array($old['ref_type'], ['', 'manual', 'proof'])) throw new Exception('قيد مرتبط بمستند — لا يُعدّل يدويًا، استخدم العكس');
                $ofy = (int)substr($old['date'], 0, 4);
                $opc = $conn->query("SELECT is_closed FROM acc_periods WHERE tenant_id=$tid AND fy=$ofy LIMIT 1");
                if ($opc && ($opr = $opc->fetch_assoc()) && (int)$opr['is_closed'] === 1) throw new Exception('تاريخ القيد الأصلي في فترة مقفلة');
                if (!$conn->query("UPDATE acc_entries SET date='$date',description='$desc',ref_type=".($reft?"'$reft'":'NULL').",ref_id=$refid,total_debit=$td,total_credit=$tc,is_posted=$posted WHERE id=$id AND tenant_id=$tid")) throw new Exception($conn->error);
                $conn->query("DELETE FROM acc_lines WHERE entry_id=$id AND tenant_id=$tid");
                $eid = $id; $eno = $old['entry_no'];
            } else {
                $yr  = (int)substr($date, 0, 4);
                $seq = acc_next_no($conn, $tid, 'JV', $yr);
                $eno = 'JV-'.$yr.'-'.str_pad($seq, 6, '0', STR_PAD_LEFT);
                if (!$conn->query("INSERT INTO acc_entries (tenant_id,entry_no,date,description,ref_type,ref_id,total_debit,total_credit,is_posted,created_by)
                              VALUES ($tid,'$eno','$date','$desc',".($reft?"'$reft'":'NULL').",$refid,$td,$tc,$posted,".($by?"'$by'":'NULL').")")) throw new Exception($conn->error);
                $eid = $conn->insert_id;
            }
            foreach ($clean as $l) {
                if (!$conn->query("INSERT INTO acc_lines (tenant_id,entry_id,account_id,debit,credit,cost_center_id,party_type,party_id,due_date,description)
                              VALUES ($tid,$eid,{$l['acc']},{$l['d']},{$l['c']},{$l['cc']},{$l['pt']},{$l['pid']},{$l['dd']},'{$l['desc']}')")) throw new Exception($conn->error);
            }
            $conn->commit();
            acc_audit($conn, $tid, 'entry', $eid, $id ? 'update' : 'create', $eno.' total='.$td, $by);
            echo json_encode(['success'=>true,'id'=>$eid,'entry_no'=>$eno,'total'=>$td,'message'=>$id?'تم تعديل القيد':'تم ترحيل القيد'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الترحيل: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'gl_entries':
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $from = $conn->real_escape_string($_GET['from'] ?? '');
        $to   = $conn->real_escape_string($_GET['to'] ?? '');
        $srch = $conn->real_escape_string(trim($_GET['search'] ?? ''));
        $lim  = min(500, max(1, (int)($_GET['limit']  ?? 100)));
        $off  = max(0,           (int)($_GET['offset'] ?? 0));
        $w = "tenant_id=$tid";
        if ($from) $w .= " AND date>='$from'";
        if ($to)   $w .= " AND date<='$to'";
        if ($srch) $w .= " AND (description LIKE '%$srch%' OR entry_no LIKE '%$srch%')";
        $tr = $conn->query("SELECT COUNT(*) c FROM acc_entries WHERE $w");
        $total = $tr ? (int)$tr->fetch_assoc()['c'] : 0;
        $res = $conn->query("SELECT * FROM acc_entries WHERE $w ORDER BY date DESC, id DESC LIMIT $lim OFFSET $off");
        $rows = []; while ($res && ($x=$res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows,'total'=>$total,'limit'=>$lim,'offset'=>$off], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_entry_single':
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1); $eid = (int)($_GET['id'] ?? 0);
        $h = $conn->query("SELECT * FROM acc_entries WHERE id=$eid AND tenant_id=$tid LIMIT 1");
        $head = $h ? $h->fetch_assoc() : null;
        if (!$head) { echo json_encode(['success'=>false,'message'=>'القيد غير موجود']); break; }
        // party_name من JOIN مباشر — يلغي الحاجة لجلب كل الأطراف في الواجهة
        $lr = $conn->query("SELECT l.*, a.code account_code, a.name account_name, p.name party_name, p.type party_type_label FROM acc_lines l JOIN acc_accounts a ON a.id=l.account_id LEFT JOIN acc_parties p ON p.id=l.party_id AND p.tenant_id=l.tenant_id WHERE l.entry_id=$eid ORDER BY l.id");
        $lines = []; while ($lr && ($x=$lr->fetch_assoc())) $lines[] = $x;
        echo json_encode(['success'=>true,'entry'=>$head,'lines'=>$lines], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_trial_balance':
        // ميزان المراجعة — يحسبه كودنا من البنود المُرحَّلة فقط (is_posted=1)
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $to  = $conn->real_escape_string($_GET['to'] ?? '');
        $dateCond = $to ? "AND e.date<='$to'" : '';
        // INNER JOIN بدل LEFT JOIN لضمان أن SUM يشمل فقط بنود القيود المُرحَّلة ضمن الفترة
        $sql = "SELECT a.id,a.code,a.name,a.type,
                   COALESCE(SUM(l.debit),0) debit, COALESCE(SUM(l.credit),0) credit
                FROM acc_accounts a
                JOIN acc_lines l ON l.account_id=a.id
                JOIN acc_entries e ON e.id=l.entry_id AND e.is_posted=1 $dateCond
                WHERE a.tenant_id=$tid AND a.is_group=0
                GROUP BY a.id HAVING debit<>0 OR credit<>0
                ORDER BY a.code";
        $res = $conn->query($sql); $rows = []; $TD = 0; $TC = 0;
        while ($res && ($x=$res->fetch_assoc())) {
            $d=(float)$x['debit']; $c=(float)$x['credit'];
            $net = $d - $c;
            $x['debit_balance']  = $net > 0 ? round($net,2) : 0;
            $x['credit_balance'] = $net < 0 ? round(-$net,2) : 0;
            $TD += $x['debit_balance']; $TC += $x['credit_balance'];
            $rows[] = $x;
        }
        echo json_encode([
            'success'=>true,'data'=>$rows,
            'totals'=>['debit'=>round($TD,2),'credit'=>round($TC,2),'balanced'=>round($TD,2)==round($TC,2)],
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_fix_hierarchy':
        // إعادة ربط الحسابات بآبائها عبر بادئة الكود (للحسابات القديمة)
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? $input_data['tenant_id'] ?? 1);
        $n = acc_fix_hierarchy($conn, $tid);
        echo json_encode(['success'=>true,'updated'=>$n], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_entry_delete':
        // حذف قيد يدوي غير مقفل وغير مرتبط بمستند (المستندات تُعكس لا تُحذف)
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? $_GET['tenant'] ?? 1);
        $eid = (int)($input_data['id'] ?? $_GET['id'] ?? 0);
        if (!$eid) { echo json_encode(['success'=>false,'message'=>'معرّف القيد مطلوب']); break; }
        $h = $conn->query("SELECT * FROM acc_entries WHERE id=$eid AND tenant_id=$tid LIMIT 1");
        $head = $h ? $h->fetch_assoc() : null;
        if (!$head) { echo json_encode(['success'=>false,'message'=>'القيد غير موجود']); break; }
        $fy = (int)substr($head['date'], 0, 4);
        $pc = $conn->query("SELECT is_closed FROM acc_periods WHERE tenant_id=$tid AND fy=$fy LIMIT 1");
        if ($pc && ($pr = $pc->fetch_assoc()) && (int)$pr['is_closed'] === 1) { echo json_encode(['success'=>false,'message'=>'لا يمكن الحذف: الفترة مقفلة']); break; }
        if (!empty($head['ref_type']) && !in_array($head['ref_type'], ['', 'manual', 'proof'])) { echo json_encode(['success'=>false,'message'=>'القيد مرتبط بمستند ('.$head['ref_type'].') — استخدم العكس'], JSON_UNESCAPED_UNICODE); break; }
        $conn->begin_transaction();
        try {
            $conn->query("DELETE FROM acc_lines WHERE entry_id=$eid AND tenant_id=$tid");
            $conn->query("DELETE FROM acc_entries WHERE id=$eid AND tenant_id=$tid");
            $conn->commit();
            acc_audit($conn, $tid, 'entry', $eid, 'delete', $head['entry_no'], $input_data['actor'] ?? null);
            echo json_encode(['success'=>true,'message'=>'تم حذف القيد']);
        } catch (Exception $e) { $conn->rollback(); echo json_encode(['success'=>false,'message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE); }
        break;

    case 'gl_entry_reverse':
        // إنشاء قيد عكسي (يقلب المدين/الدائن) بدل حذف قيد مُرحَّل
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $eid  = (int)($input_data['id'] ?? 0);
        $date = $conn->real_escape_string($input_data['date'] ?? date('Y-m-d'));
        if (!$eid) { echo json_encode(['success'=>false,'message'=>'معرّف القيد مطلوب']); break; }
        $h = $conn->query("SELECT * FROM acc_entries WHERE id=$eid AND tenant_id=$tid LIMIT 1");
        $head = $h ? $h->fetch_assoc() : null;
        if (!$head) { echo json_encode(['success'=>false,'message'=>'القيد غير موجود']); break; }
        $lr = $conn->query("SELECT * FROM acc_lines WHERE entry_id=$eid AND tenant_id=$tid");
        $olines = []; while ($lr && ($x = $lr->fetch_assoc())) $olines[] = $x;
        if (!$olines) { echo json_encode(['success'=>false,'message'=>'لا توجد بنود للعكس']); break; }
        $yr = (int)substr($date, 0, 4);
        $pc = $conn->query("SELECT is_closed FROM acc_periods WHERE tenant_id=$tid AND fy=$yr LIMIT 1");
        if ($pc && ($pr = $pc->fetch_assoc()) && (int)$pr['is_closed'] === 1) { echo json_encode(['success'=>false,'message'=>"الفترة $yr مقفلة"], JSON_UNESCAPED_UNICODE); break; }
        $conn->begin_transaction();
        try {
            $seq = acc_next_no($conn, $tid, 'JV', $yr);
            $eno = 'JV-'.$yr.'-'.str_pad($seq, 6, '0', STR_PAD_LEFT);
            $rdesc = $conn->real_escape_string('عكس قيد '.$head['entry_no']);
            if (!$conn->query("INSERT INTO acc_entries (tenant_id,entry_no,date,description,ref_type,ref_id,total_debit,total_credit,is_posted,created_by)
                          VALUES ($tid,'$eno','$date','$rdesc','reversal',$eid,{$head['total_credit']},{$head['total_debit']},1,NULL)")) throw new Exception($conn->error);
            $nid = $conn->insert_id;
            foreach ($olines as $l) {
                $pt  = $l['party_type'] !== null ? "'".$conn->real_escape_string($l['party_type'])."'" : 'NULL';
                $plid= $l['party_id'] !== null ? (int)$l['party_id'] : 'NULL';
                $dd  = $l['due_date'] !== null ? "'".$conn->real_escape_string($l['due_date'])."'" : 'NULL';
                $cc  = $l['cost_center_id'] !== null ? (int)$l['cost_center_id'] : 'NULL';
                $ld  = $conn->real_escape_string($l['description'] ?? '');
                if (!$conn->query("INSERT INTO acc_lines (tenant_id,entry_id,account_id,debit,credit,cost_center_id,party_type,party_id,due_date,description)
                              VALUES ($tid,$nid,{$l['account_id']},{$l['credit']},{$l['debit']},$cc,$pt,$plid,$dd,'$ld')")) throw new Exception($conn->error);
            }
            $conn->commit();
            acc_audit($conn, $tid, 'entry', $nid, 'reverse', 'عكس '.$head['entry_no'], $input_data['actor'] ?? null);
            echo json_encode(['success'=>true,'id'=>$nid,'entry_no'=>$eno,'message'=>'تم عكس القيد'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) { $conn->rollback(); echo json_encode(['success'=>false,'message'=>'فشل العكس: '.$e->getMessage()], JSON_UNESCAPED_UNICODE); }
        break;

    case 'gl_ledger':
        // كشف حساب: رصيد افتتاحي قبل الفترة + حركات + رصيد جارٍ (كودنا يحسب)
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $acc  = (int)($_GET['account_id'] ?? 0);
        $from = $conn->real_escape_string($_GET['from'] ?? '');
        $to   = $conn->real_escape_string($_GET['to'] ?? '');
        if (!$acc) { echo json_encode(['success'=>false,'message'=>'الحساب مطلوب']); break; }
        $ar = $conn->query("SELECT * FROM acc_accounts WHERE id=$acc AND tenant_id=$tid LIMIT 1");
        $accRow = $ar ? $ar->fetch_assoc() : null;
        if (!$accRow) { echo json_encode(['success'=>false,'message'=>'الحساب غير موجود']); break; }
        $isDebitNat = in_array($accRow['type'], ['asset','expense']);
        $opD = 0; $opC = 0;
        if ($from) {
            // الرصيد الافتتاحي: المُرحَّل فقط قبل تاريخ البداية
            $o = $conn->query("SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE l.account_id=$acc AND l.tenant_id=$tid AND e.is_posted=1 AND e.date<'$from'");
            if ($o && ($x = $o->fetch_assoc())) { $opD = (float)$x['d']; $opC = (float)$x['c']; }
        }
        $opening = $isDebitNat ? ($opD - $opC) : ($opC - $opD);
        $w = "l.account_id=$acc AND l.tenant_id=$tid AND e.is_posted=1";
        if ($from) $w .= " AND e.date>='$from'";
        if ($to)   $w .= " AND e.date<='$to'";
        $res = $conn->query("SELECT e.id entry_id,e.entry_no,e.date,e.description ent_desc,l.debit,l.credit,l.description line_desc,l.party_type,l.party_id FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE $w ORDER BY e.date,e.id,l.id");
        $rows = []; $run = $opening; $sumD = 0; $sumC = 0;
        while ($res && ($x = $res->fetch_assoc())) {
            $d = (float)$x['debit']; $c = (float)$x['credit'];
            $run += $isDebitNat ? ($d - $c) : ($c - $d);
            $x['balance'] = round($run, 2); $sumD += $d; $sumC += $c;
            $rows[] = $x;
        }
        echo json_encode(['success'=>true,'account'=>$accRow,'opening'=>round($opening,2),'data'=>$rows,'totals'=>['debit'=>round($sumD,2),'credit'=>round($sumC,2),'closing'=>round($run,2)]], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_dashboard': {
        // لوحة القيادة — مؤشرات مالية رئيسية + آخر القيود + فواتير متأخرة
        $tid   = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $today = date('Y-m-d');
        $ytdFrom = date('Y').'-01-01';
        $moFrom  = date('Y-m').'-01';

        // ── صافي الدخل (سنوي + شهري) ─────────────────────
        $incSQL = "SELECT
            COALESCE(SUM(CASE WHEN a.type='revenue' THEN l.credit-l.debit ELSE 0 END),0) rev,
            COALESCE(SUM(CASE WHEN a.type='expense' THEN l.debit-l.credit ELSE 0 END),0) exp
          FROM acc_entries e
          JOIN acc_lines l ON l.entry_id=e.id
          JOIN acc_accounts a ON a.id=l.account_id AND a.tenant_id=e.tenant_id
          WHERE e.tenant_id=$tid AND e.is_posted=1 AND a.is_group=0 AND a.type IN ('revenue','expense')";
        $rYTD = $conn->query("$incSQL AND e.date>='$ytdFrom' AND e.date<='$today'")->fetch_assoc();
        $rMo  = $conn->query("$incSQL AND e.date>='$moFrom' AND e.date<='$today'")->fetch_assoc();
        $netYTD = round((float)$rYTD['rev'] - (float)$rYTD['exp'], 2);
        $netMo  = round((float)$rMo['rev']  - (float)$rMo['exp'],  2);

        // ── الأصول النقدية والبنكية ────────────────────────
        // نجمع أرصدة حسابات الأصول التي تحتوي على كلمة نقد/صندوق/بنك
        $cashSQL = "SELECT COALESCE(SUM(
            (SELECT COALESCE(SUM(l2.debit-l2.credit),0) FROM acc_lines l2 JOIN acc_entries e2 ON e2.id=l2.entry_id AND e2.is_posted=1 AND e2.date<='$today' WHERE l2.account_id=a.id AND l2.tenant_id=a.tenant_id)
        ),0) cash
        FROM acc_accounts a
        WHERE a.tenant_id=$tid AND a.is_group=0 AND a.type='asset'
          AND (a.name LIKE '%نقد%' OR a.name LIKE '%صندوق%' OR a.name LIKE '%بنك%' OR a.name LIKE '%bank%' OR a.name LIKE '%cash%')";
        $rCash = $conn->query($cashSQL)->fetch_assoc();
        $cashBalance = round((float)($rCash['cash']??0), 2);

        // ── إجماليات العملاء والموردين ─────────────────────
        $arSQL = "SELECT COALESCE(SUM(l.debit-l.credit),0) tot
                  FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id AND e.is_posted=1 AND e.date<='$today'
                  WHERE l.party_type='customer' AND l.tenant_id=$tid";
        $rAR = $conn->query($arSQL)->fetch_assoc();
        $totalAR = round((float)($rAR['tot']??0), 2);

        $apSQL = "SELECT COALESCE(SUM(l.credit-l.debit),0) tot
                  FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id AND e.is_posted=1 AND e.date<='$today'
                  WHERE l.party_type='supplier' AND l.tenant_id=$tid";
        $rAP = $conn->query($apSQL)->fetch_assoc();
        $totalAP = round((float)($rAP['tot']??0), 2);

        // ── آخر 8 قيود ──────────────────────────────────────
        $recentSQL = "SELECT e.id,e.entry_no,e.date,e.description,e.is_posted,
                        (SELECT COUNT(*) FROM acc_lines l2 WHERE l2.entry_id=e.id) lines_count,
                        (SELECT SUM(l2.debit) FROM acc_lines l2 WHERE l2.entry_id=e.id) total_dr
                      FROM acc_entries e
                      WHERE e.tenant_id=$tid
                      ORDER BY e.id DESC LIMIT 8";
        $resRecent = $conn->query($recentSQL); $recent = [];
        while ($resRecent && ($x = $resRecent->fetch_assoc())) {
            $x['total_dr'] = round((float)$x['total_dr'],2);
            $recent[] = $x;
        }

        // ── فواتير البيع المتأخرة ─────────────────────────
        $overdueSQL = "SELECT COUNT(*) cnt, COALESCE(SUM(balance_due),0) tot
                       FROM acc_invoices
                       WHERE tenant_id=$tid AND doc_type='sales' AND status IN ('draft','partial')
                         AND due_date IS NOT NULL AND due_date<'$today' AND balance_due>0.001";
        $resOD = $conn->query($overdueSQL);
        $overdue = ['count'=>0,'total'=>0];
        if ($resOD && ($x=$resOD->fetch_assoc())) { $overdue=['count'=>(int)$x['cnt'],'total'=>round((float)$x['tot'],2)]; }

        // ── عدد القيود غير المرحّلة ──────────────────────
        $rdraft = $conn->query("SELECT COUNT(*) c FROM acc_entries WHERE tenant_id=$tid AND is_posted=0")->fetch_assoc();
        $draftCount = (int)($rdraft['c']??0);

        echo json_encode([
            'success'     => true,
            'as_of'       => $today,
            'net_ytd'     => $netYTD,
            'net_month'   => $netMo,
            'cash'        => $cashBalance,
            'receivables' => $totalAR,
            'payables'    => $totalAP,
            'recent'      => $recent,
            'overdue'     => $overdue,
            'draft_count' => $draftCount,
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_income_statement':
        // قائمة الدخل — إيرادات ومصروفات للفترة (المُرحَّلة فقط)
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $from = $conn->real_escape_string($_GET['from'] ?? date('Y-01-01'));
        $to   = $conn->real_escape_string($_GET['to']   ?? date('Y-m-d'));
        // CASE داخل SUM لضمان تصفية صحيحة حتى مع LEFT JOIN — لا تُجمع إلا الحركات المُرحَّلة ضمن الفترة
        $sql = "SELECT a.id,a.code,a.name,a.type,
                   COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$from' AND e.date<='$to' THEN l.debit  ELSE 0 END),0) d,
                   COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$from' AND e.date<='$to' THEN l.credit ELSE 0 END),0) c
                FROM acc_accounts a
                LEFT JOIN acc_lines l ON l.account_id=a.id AND l.tenant_id=a.tenant_id
                LEFT JOIN acc_entries e ON e.id=l.entry_id
                WHERE a.tenant_id=$tid AND a.is_group=0 AND a.type IN ('revenue','expense')
                GROUP BY a.id ORDER BY a.code";
        $res = $conn->query($sql); $rev = []; $exp = []; $totRev = 0; $totExp = 0;
        while ($res && ($x = $res->fetch_assoc())) {
            $d = (float)$x['d']; $c = (float)$x['c'];
            if ($x['type'] === 'revenue') { $amt = round($c - $d, 2); $x['amount'] = $amt; $totRev += $amt; $rev[] = $x; }
            else { $amt = round($d - $c, 2); $x['amount'] = $amt; $totExp += $amt; $exp[] = $x; }
        }
        echo json_encode(['success'=>true,'period'=>['from'=>$from,'to'=>$to],'revenue'=>$rev,'expenses'=>$exp,'totals'=>['revenue'=>round($totRev,2),'expenses'=>round($totExp,2),'net'=>round($totRev-$totExp,2)]], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_income_monthly': {
        // تحليل الدخل الشهري — إيرادات ومصروفات لكل شهر في السنة
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $year = $conn->real_escape_string($_GET['year'] ?? date('Y'));
        $sql  = "SELECT DATE_FORMAT(e.date,'%Y-%m') AS mo,
                    COALESCE(SUM(CASE WHEN a.type='revenue' THEN ROUND(l.credit-l.debit,2) ELSE 0 END),0) AS revenue,
                    COALESCE(SUM(CASE WHEN a.type='expense' THEN ROUND(l.debit-l.credit,2) ELSE 0 END),0) AS expenses
                 FROM acc_entries e
                 JOIN acc_lines l ON l.entry_id=e.id
                 JOIN acc_accounts a ON a.id=l.account_id AND a.tenant_id=e.tenant_id
                 WHERE e.tenant_id=$tid AND e.is_posted=1
                   AND e.date LIKE '$year-%'
                   AND a.type IN ('revenue','expense') AND a.is_group=0
                 GROUP BY DATE_FORMAT(e.date,'%Y-%m')
                 ORDER BY mo";
        $res  = $conn->query($sql);
        $byMo = [];
        while ($res && ($x = $res->fetch_assoc())) {
            $byMo[$x['mo']] = ['revenue'=>round((float)$x['revenue'],2),'expenses'=>round((float)$x['expenses'],2),'net'=>round((float)$x['revenue']-(float)$x['expenses'],2)];
        }
        // ضمان وجود كل الأشهر الـ 12
        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $k = $year.'-'.str_pad($m,2,'0',STR_PAD_LEFT);
            $months[] = array_merge(['month'=>$k], $byMo[$k] ?? ['revenue'=>0,'expenses'=>0,'net'=>0]);
        }
        $totRev = array_sum(array_column($months,'revenue'));
        $totExp = array_sum(array_column($months,'expenses'));
        echo json_encode(['success'=>true,'year'=>$year,'months'=>$months,'totals'=>['revenue'=>round($totRev,2),'expenses'=>round($totExp,2),'net'=>round($totRev-$totExp,2)]], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════
    //  الأصول الثابتة
    // ════════════════════════════════════════════════════════════════════
    case 'gl_assets': {
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $conn->query("CREATE TABLE IF NOT EXISTS acc_fixed_assets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            code VARCHAR(50) DEFAULT '',
            name VARCHAR(300) NOT NULL,
            cost DECIMAL(15,2) NOT NULL DEFAULT 0,
            residual_value DECIMAL(15,2) NOT NULL DEFAULT 0,
            purchase_date DATE NOT NULL,
            useful_life_months INT NOT NULL DEFAULT 60,
            depreciation_method ENUM('straight_line','declining') NOT NULL DEFAULT 'straight_line',
            gl_account_id INT DEFAULT NULL,
            accum_depr_account_id INT DEFAULT NULL,
            expense_account_id INT DEFAULT NULL,
            disposed_at DATE DEFAULT NULL,
            notes TEXT DEFAULT '',
            KEY idx_fa_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $conn->query("CREATE TABLE IF NOT EXISTS acc_asset_depreciations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            asset_id INT NOT NULL,
            period_date DATE NOT NULL,
            amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            book_value_after DECIMAL(15,2) NOT NULL DEFAULT 0,
            entry_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_ad_asset (asset_id),
            KEY idx_ad_period (period_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $rows = [];
        $res = $conn->query("SELECT a.*,
                               ag.code AS gl_code, ag.name AS gl_name,
                               COALESCE(SUM(d.amount),0) AS total_depr,
                               COUNT(d.id) AS depr_count
                             FROM acc_fixed_assets a
                             LEFT JOIN acc_accounts ag ON ag.id=a.gl_account_id
                             LEFT JOIN acc_asset_depreciations d ON d.asset_id=a.id AND d.tenant_id=a.tenant_id
                             WHERE a.tenant_id=$tid
                             GROUP BY a.id ORDER BY a.purchase_date DESC, a.code ASC");
        while ($res && ($x = $res->fetch_assoc())) {
            $x['book_value'] = round((float)$x['cost']-(float)$x['total_depr'],2);
            $rows[] = $x;
        }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_asset_save': {
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $code = $conn->real_escape_string(trim($input_data['code'] ?? ''));
        $cost = round((float)($input_data['cost'] ?? 0), 2);
        $resv = round((float)($input_data['residual_value'] ?? 0), 2);
        $pdate= $conn->real_escape_string($input_data['purchase_date'] ?? date('Y-m-d'));
        $ulm  = max(1, (int)($input_data['useful_life_months'] ?? 60));
        $dm   = in_array($input_data['depreciation_method']??'',['straight_line','declining']) ? $input_data['depreciation_method'] : 'straight_line';
        $glid = (int)($input_data['gl_account_id'] ?? 0) ?: 'NULL';
        $acid = (int)($input_data['accum_depr_account_id'] ?? 0) ?: 'NULL';
        $exid = (int)($input_data['expense_account_id'] ?? 0) ?: 'NULL';
        $disp = trim($input_data['disposed_at'] ?? '') ? "'".$conn->real_escape_string($input_data['disposed_at'])."'" : 'NULL';
        $notes= $conn->real_escape_string($input_data['notes'] ?? '');
        if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
        if ($id) {
            $conn->query("UPDATE acc_fixed_assets SET code='$code',name='$name',cost=$cost,residual_value=$resv,purchase_date='$pdate',useful_life_months=$ulm,depreciation_method='$dm',gl_account_id=$glid,accum_depr_account_id=$acid,expense_account_id=$exid,disposed_at=$disp,notes='$notes' WHERE id=$id AND tenant_id=$tid");
        } else {
            $conn->query("INSERT INTO acc_fixed_assets (tenant_id,code,name,cost,residual_value,purchase_date,useful_life_months,depreciation_method,gl_account_id,accum_depr_account_id,expense_account_id,disposed_at,notes) VALUES ($tid,'$code','$name',$cost,$resv,'$pdate',$ulm,'$dm',$glid,$acid,$exid,$disp,'$notes')");
            $id = (int)$conn->insert_id;
        }
        echo json_encode(['success'=>true,'id'=>$id,'message'=>'تم الحفظ'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_asset_schedule': {
        // جدول الإهلاك للأصل (straight-line افتراضياً)
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $id   = (int)($_GET['id'] ?? 0);
        $r    = $conn->query("SELECT * FROM acc_fixed_assets WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $a    = $r ? $r->fetch_assoc() : null;
        if (!$a) { echo json_encode(['success'=>false,'message'=>'أصل غير موجود']); break; }

        $cost    = (float)$a['cost'];
        $resv    = (float)$a['residual_value'];
        $ulm     = (int)$a['useful_life_months'];
        $dm      = $a['depreciation_method'];
        $pdate   = new DateTime($a['purchase_date']);

        // الإهلاك الفعلي المرحّل
        $posted = [];
        $pr = $conn->query("SELECT period_date,amount,book_value_after,entry_id FROM acc_asset_depreciations WHERE asset_id=$id AND tenant_id=$tid ORDER BY period_date ASC");
        while ($pr && ($x = $pr->fetch_assoc())) $posted[substr($x['period_date'],0,7)] = $x;

        $schedule = []; $bv = $cost;
        $monthlyDepr = $dm === 'straight_line' ? round(($cost - $resv) / $ulm, 2) : null;
        for ($m = 0; $m < $ulm; $m++) {
            $pd = clone $pdate; $pd->modify("+$m months");
            $per = $pd->format('Y-m');
            $pFull = $pd->format('Y-m-01');
            if ($dm === 'straight_line') {
                $depr = ($m === $ulm-1) ? round($bv - $resv, 2) : $monthlyDepr;
            } else { // declining
                $rate = 2.0 / $ulm;
                $depr = round($bv * $rate / 12, 2);
                if ($depr + $resv > $bv) $depr = max(0, $bv - $resv);
            }
            $bv = round($bv - $depr, 2);
            $isPosted = isset($posted[$per]);
            $schedule[] = ['period'=>$pFull,'depr_amount'=>$depr,'book_value'=>$bv,'posted'=>$isPosted?1:0,'entry_id'=>$isPosted?$posted[$per]['entry_id']:null];
        }
        echo json_encode(['success'=>true,'asset'=>$a,'schedule'=>$schedule], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_asset_depreciate': {
        // ترحيل إهلاك شهر محدد للأصل
        $tid    = (int)($input_data['tenant_id'] ?? 1);
        $aid    = (int)($input_data['asset_id'] ?? 0);
        $period = $conn->real_escape_string($input_data['period'] ?? ''); // YYYY-MM-DD (first of month)
        if (!$aid || !$period) { echo json_encode(['success'=>false,'message'=>'بيانات ناقصة']); break; }

        $r = $conn->query("SELECT * FROM acc_fixed_assets WHERE id=$aid AND tenant_id=$tid LIMIT 1");
        $a = $r ? $r->fetch_assoc() : null;
        if (!$a) { echo json_encode(['success'=>false,'message'=>'أصل غير موجود']); break; }
        if (!$a['expense_account_id'] || !$a['accum_depr_account_id']) {
            echo json_encode(['success'=>false,'message'=>'حدّد حساب مصروف الإهلاك وحساب مجمّع الإهلاك في بيانات الأصل'], JSON_UNESCAPED_UNICODE); break;
        }

        // تحقّق من عدم الترحيل المزدوج
        $perKey = substr($period,0,7);
        $ex = $conn->query("SELECT id FROM acc_asset_depreciations WHERE asset_id=$aid AND tenant_id=$tid AND LEFT(period_date,7)='$perKey' LIMIT 1");
        if ($ex && $ex->num_rows > 0) { echo json_encode(['success'=>false,'message'=>'تم ترحيل إهلاك هذا الشهر مسبقاً'], JSON_UNESCAPED_UNICODE); break; }

        // احسب القيمة الدفترية الحالية
        $tdp = $conn->query("SELECT COALESCE(SUM(amount),0) td FROM acc_asset_depreciations WHERE asset_id=$aid AND tenant_id=$tid");
        $totalDepr = $tdp ? (float)$tdp->fetch_assoc()['td'] : 0;
        $bv = (float)$a['cost'] - $totalDepr;
        $resv = (float)$a['residual_value'];

        $dm = $a['depreciation_method']; $ulm = (int)$a['useful_life_months'];
        $monthsLeft = max(0, $ulm - (int)$conn->query("SELECT COUNT(*) c FROM acc_asset_depreciations WHERE asset_id=$aid AND tenant_id=$tid")->fetch_assoc()['c']);
        if ($monthsLeft <= 0 || $bv <= $resv) { echo json_encode(['success'=>false,'message'=>'الأصل مكتمل الإهلاك'], JSON_UNESCAPED_UNICODE); break; }

        if ($dm === 'straight_line') {
            $depr = $monthsLeft === 1 ? round($bv-$resv,2) : round(((float)$a['cost']-$resv)/$ulm, 2);
        } else {
            $rate = 2.0/$ulm;
            $depr = round($bv*$rate/12, 2);
            if ($depr+$resv > $bv) $depr = max(0, $bv-$resv);
        }
        if ($depr <= 0) { echo json_encode(['success'=>false,'message'=>'مبلغ الإهلاك صفر'], JSON_UNESCAPED_UNICODE); break; }

        $bvAfter = round($bv - $depr, 2);
        $assetName = $conn->real_escape_string($a['name']);
        $lines = [
            ['account_id'=>(int)$a['expense_account_id'],'debit'=>$depr,'credit'=>0,'description'=>"إهلاك $assetName — $perKey"],
            ['account_id'=>(int)$a['accum_depr_account_id'],'debit'=>0,'credit'=>$depr,'description'=>"مجمع إهلاك $assetName — $perKey"],
        ];
        $conn->begin_transaction();
        try {
            $er = acc_post_entry($conn, $tid, $period, "إهلاك: $assetName ($perKey)", 'depreciation', $aid, null, $lines, 1);
            $eid = (int)$conn->query("SELECT id FROM acc_entries WHERE entry_no='".$conn->real_escape_string($er['eno'])."' AND tenant_id=$tid LIMIT 1")->fetch_assoc()['id'];
            $conn->query("INSERT INTO acc_asset_depreciations (tenant_id,asset_id,period_date,amount,book_value_after,entry_id) VALUES ($tid,$aid,'$period',$depr,$bvAfter,$eid)");
            $conn->commit();
            echo json_encode(['success'=>true,'entry_no'=>$er['eno'],'depr_amount'=>$depr,'book_value_after'=>$bvAfter,'message'=>"تم ترحيل إهلاك {$er['eno']}"], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'gl_assets_depreciate_batch': {
        // ترحيل إهلاك شهر كامل لجميع الأصول النشطة
        $tid    = (int)($input_data['tenant_id'] ?? 1);
        $period = $conn->real_escape_string($input_data['period'] ?? ''); // YYYY-MM-DD (first of month)
        if (!$period) { echo json_encode(['success'=>false,'message'=>'حدّد الشهر']); break; }
        $perKey = substr($period, 0, 7);

        // جلب الأصول النشطة غير المكتملة
        $ra = $conn->query("SELECT a.*,
            (SELECT COALESCE(SUM(amount),0) FROM acc_asset_depreciations WHERE asset_id=a.id AND tenant_id=$tid) total_depr,
            (SELECT COUNT(*) FROM acc_asset_depreciations WHERE asset_id=a.id AND tenant_id=$tid) depr_count
            FROM acc_fixed_assets a
            WHERE a.tenant_id=$tid AND a.disposed_at IS NULL");
        $assets = [];
        while ($ra && ($x=$ra->fetch_assoc())) {
            $bv = (float)$x['cost'] - (float)$x['total_depr'];
            if ($bv <= (float)$x['residual_value'] || (int)$x['depr_count'] >= (int)$x['useful_life_months']) continue;
            // تحقق أن الشهر لم يُرحَّل
            $ex = $conn->query("SELECT id FROM acc_asset_depreciations WHERE asset_id={$x['id']} AND tenant_id=$tid AND LEFT(period_date,7)='$perKey' LIMIT 1");
            if ($ex && $ex->num_rows > 0) continue; // تم الترحيل مسبقاً
            $assets[] = $x;
        }
        if (empty($assets)) { echo json_encode(['success'=>false,'message'=>"لا توجد أصول لترحيل إهلاكها في $perKey (قد تكون مكتملة أو مرحّلة مسبقاً)"], JSON_UNESCAPED_UNICODE); break; }

        $results = []; $errors = [];
        foreach ($assets as $a) {
            $aid = (int)$a['id'];
            if (!$a['expense_account_id'] || !$a['accum_depr_account_id']) {
                $errors[] = "الأصل «{$a['name']}»: غير مرتبط بحسابات إهلاك";
                continue;
            }
            $bv   = (float)$a['cost'] - (float)$a['total_depr'];
            $resv = (float)$a['residual_value'];
            $dm   = $a['depreciation_method']; $ulm = (int)$a['useful_life_months'];
            $mleft= max(0, $ulm - (int)$a['depr_count']);
            if ($dm === 'straight_line') {
                $depr = $mleft === 1 ? round($bv - $resv, 2) : round(((float)$a['cost'] - $resv) / $ulm, 2);
            } else {
                $rate = 2.0/$ulm; $depr = round($bv*$rate/12,2);
                if ($depr+$resv > $bv) $depr = max(0,$bv-$resv);
            }
            if ($depr <= 0) continue;
            $bvAfter = round($bv - $depr, 2);
            $assetName = $conn->real_escape_string($a['name']);
            $lines = [
                ['account_id'=>(int)$a['expense_account_id'], 'debit'=>$depr,'credit'=>0,'description'=>"إهلاك $assetName — $perKey"],
                ['account_id'=>(int)$a['accum_depr_account_id'],'debit'=>0,'credit'=>$depr,'description'=>"مجمع إهلاك $assetName — $perKey"],
            ];
            $conn->begin_transaction();
            try {
                $er  = acc_post_entry($conn,$tid,$period,"إهلاك: $assetName ($perKey)",'depreciation',$aid,null,$lines,1);
                $eid = (int)$conn->query("SELECT id FROM acc_entries WHERE entry_no='".$conn->real_escape_string($er['eno'])."' AND tenant_id=$tid LIMIT 1")->fetch_assoc()['id'];
                $conn->query("INSERT INTO acc_asset_depreciations (tenant_id,asset_id,period_date,amount,book_value_after,entry_id) VALUES ($tid,$aid,'$period',$depr,$bvAfter,$eid)");
                $conn->commit();
                $results[] = ['asset'=>$a['name'],'entry_no'=>$er['eno'],'amount'=>$depr,'book_value_after'=>$bvAfter];
            } catch (Exception $e) { $conn->rollback(); $errors[] = "الأصل «{$a['name']}»: ".$e->getMessage(); }
        }
        echo json_encode(['success'=>count($results)>0,'posted'=>$results,'errors'=>$errors,
            'message'=>count($results).' أصل — '.count($errors).' خطأ'], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ════════════════════════════════════════════════════════════════════
    //  بيان التدفقات النقدية (الطريقة غير المباشرة)
    // ════════════════════════════════════════════════════════════════════
    case 'gl_cash_flow': {
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $from = $conn->real_escape_string($_GET['from'] ?? date('Y-01-01'));
        $to   = $conn->real_escape_string($_GET['to']   ?? date('Y-12-31'));

        // ─── auto-migrate: cf_section column ─────────────────────────
        ensure_column($conn, "acc_accounts", "cf_section", "cf_section ENUM('none','cash','operating','investing','financing') NOT NULL DEFAULT 'none'");

        // ─── كل الحسابات الفرعية (غير المجمّعة) ──────────────────────
        $accts = [];
        $ra = $conn->query("SELECT id,code,name,type,cf_section FROM acc_accounts WHERE tenant_id=$tid AND is_group=0 ORDER BY code");
        while ($ra && ($x=$ra->fetch_assoc())) $accts[(int)$x['id']] = $x;

        // ─── أرصدة ختامية حتى اليوم السابق لبداية الفترة ────────────
        $prevDate = date('Y-m-d', strtotime($from.' -1 day'));
        $obMap = []; $cbMap = [];
        $r = $conn->query("SELECT l.account_id, COALESCE(SUM(l.debit-l.credit),0) bal FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE e.tenant_id=$tid AND e.is_posted=1 AND e.date<='$prevDate' GROUP BY l.account_id");
        while ($r && ($x=$r->fetch_assoc())) $obMap[(int)$x['account_id']] = (float)$x['bal'];
        $r = $conn->query("SELECT l.account_id, COALESCE(SUM(l.debit-l.credit),0) bal FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE e.tenant_id=$tid AND e.is_posted=1 AND e.date<='$to' GROUP BY l.account_id");
        while ($r && ($x=$r->fetch_assoc())) $cbMap[(int)$x['account_id']] = (float)$x['bal'];

        // ─── صافي الدخل (إيرادات − مصروفات) للفترة ──────────────────
        $revR = $conn->query("SELECT COALESCE(SUM(l.credit-l.debit),0) v FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id JOIN acc_accounts a ON a.id=l.account_id WHERE e.tenant_id=$tid AND e.is_posted=1 AND e.date>='$from' AND e.date<='$to' AND a.type='revenue'");
        $expR = $conn->query("SELECT COALESCE(SUM(l.debit-l.credit),0) v FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id JOIN acc_accounts a ON a.id=l.account_id WHERE e.tenant_id=$tid AND e.is_posted=1 AND e.date>='$from' AND e.date<='$to' AND a.type='expense'");
        $netIncome = round((float)($revR?$revR->fetch_assoc()['v']:0) - (float)($expR?$expR->fetch_assoc()['v']:0), 2);

        // ─── الإهلاك المرحّل في الفترة ────────────────────────────────
        $dpR = $conn->query("SELECT COALESCE(SUM(amount),0) d FROM acc_asset_depreciations WHERE tenant_id=$tid AND period_date>='$from' AND period_date<='$to'");
        $deprTotal = $dpR ? round((float)$dpR->fetch_assoc()['d'], 2) : 0;

        // ─── تصنيف الحسابات وحساب التغيرات ───────────────────────────
        $opItems = []; $invItems = []; $finItems = [];
        $cashOpening = 0; $cashClosing = 0;

        foreach ($accts as $id => $acct) {
            $sec  = $acct['cf_section'];
            $type = $acct['type'];
            if ($sec === 'none' || $type === 'revenue' || $type === 'expense') continue;

            $ob  = $obMap[$id] ?? 0;
            $cb  = $cbMap[$id] ?? 0;
            $chg = round($cb - $ob, 2);

            if ($sec === 'cash') { $cashOpening += $ob; $cashClosing += $cb; continue; }

            // أصول: زيادة = استخدام نقدية (سالب) | خصوم وحقوق: زيادة = مصدر نقدية (موجب)
            $cf = ($type === 'asset') ? -$chg : $chg;
            $item = ['id'=>$id,'code'=>$acct['code'],'name'=>$acct['name'],'opening'=>round($ob,2),'closing'=>round($cb,2),'change'=>$chg,'cf'=>round($cf,2)];

            if ($sec === 'operating')  $opItems[]  = $item;
            elseif ($sec === 'investing') $invItems[] = $item;
            elseif ($sec === 'financing') $finItems[] = $item;
        }

        $opCF  = round(array_sum(array_column($opItems,  'cf')) + $netIncome + $deprTotal, 2);
        $invCF = round(array_sum(array_column($invItems, 'cf')), 2);
        $finCF = round(array_sum(array_column($finItems, 'cf')), 2);
        $netChange = round($opCF + $invCF + $finCF, 2);

        echo json_encode([
            'success'      => true,
            'period'       => ['from'=>$from,'to'=>$to],
            'net_income'   => $netIncome,
            'depreciation' => $deprTotal,
            'operating'    => ['items'=>$opItems,  'total'=>$opCF],
            'investing'    => ['items'=>$invItems,  'total'=>$invCF],
            'financing'    => ['items'=>$finItems,  'total'=>$finCF],
            'net_change'   => $netChange,
            'cash_opening' => round($cashOpening, 2),
            'cash_closing' => round($cashClosing, 2),
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_cf_section_save': {
        // تحديث تصنيف CF للحساب (one at a time, or bulk via array)
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $updates = $input_data['updates'] ?? [];   // [{id, cf_section}]
        if (!is_array($updates) || empty($updates)) {
            // single update fallback
            $id  = (int)($input_data['id']         ?? 0);
            $sec = $conn->real_escape_string($input_data['cf_section'] ?? 'none');
            if (!in_array($sec,['none','cash','operating','investing','financing'])) $sec='none';
            $conn->query("UPDATE acc_accounts SET cf_section='$sec' WHERE id=$id AND tenant_id=$tid");
        } else {
            foreach ($updates as $u) {
                $id  = (int)($u['id']         ?? 0);
                $sec = $conn->real_escape_string($u['cf_section'] ?? 'none');
                if (!in_array($sec,['none','cash','operating','investing','financing'])) $sec='none';
                if ($id) $conn->query("UPDATE acc_accounts SET cf_section='$sec' WHERE id=$id AND tenant_id=$tid");
            }
        }
        echo json_encode(['success'=>true], JSON_UNESCAPED_UNICODE);
        break;
    }

    //  المطابقة البنكية
    // ════════════════════════════════════════════════════════════════════
    case 'gl_bank_accounts': {
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $conn->query("CREATE TABLE IF NOT EXISTS acc_bank_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            name VARCHAR(200) NOT NULL,
            gl_account_id INT DEFAULT NULL,
            bank_name VARCHAR(200) DEFAULT '',
            account_number VARCHAR(100) DEFAULT '',
            iban VARCHAR(50) DEFAULT '',
            currency VARCHAR(10) DEFAULT 'SAR',
            is_active TINYINT(1) DEFAULT 1,
            KEY idx_bk_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $conn->query("CREATE TABLE IF NOT EXISTS acc_bank_stmt_lines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            bank_account_id INT NOT NULL,
            stmt_date DATE NOT NULL,
            description VARCHAR(500) DEFAULT '',
            debit DECIMAL(15,2) DEFAULT 0,
            credit DECIMAL(15,2) DEFAULT 0,
            ref VARCHAR(200) DEFAULT '',
            reconciled TINYINT(1) DEFAULT 0,
            gl_entry_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_bsl_ba (bank_account_id),
            KEY idx_bsl_date (stmt_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $rows = [];
        $res = $conn->query("SELECT b.*,a.code AS gl_code,a.name AS gl_name
                             FROM acc_bank_accounts b
                             LEFT JOIN acc_accounts a ON a.id=b.gl_account_id
                             WHERE b.tenant_id=$tid AND b.is_active=1 ORDER BY b.name");
        while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_bank_account_save': {
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $gaid = (int)($input_data['gl_account_id'] ?? 0) ?: 'NULL';
        $bname= $conn->real_escape_string($input_data['bank_name'] ?? '');
        $ano  = $conn->real_escape_string($input_data['account_number'] ?? '');
        $iban = $conn->real_escape_string($input_data['iban'] ?? '');
        $cur  = $conn->real_escape_string($input_data['currency'] ?? 'SAR');
        if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
        if ($id) {
            $conn->query("UPDATE acc_bank_accounts SET name='$name',gl_account_id=$gaid,bank_name='$bname',account_number='$ano',iban='$iban',currency='$cur' WHERE id=$id AND tenant_id=$tid");
        } else {
            $conn->query("INSERT INTO acc_bank_accounts (tenant_id,name,gl_account_id,bank_name,account_number,iban,currency) VALUES ($tid,'$name',$gaid,'$bname','$ano','$iban','$cur')");
            $id = (int)$conn->insert_id;
        }
        echo json_encode(['success'=>true,'id'=>$id,'message'=>'تم الحفظ'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_bank_stmt_list': {
        // قائمة بنود كشف الحساب البنكي لحساب + فترة
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $baid = (int)($_GET['bank_account_id'] ?? 0);
        $from = $conn->real_escape_string($_GET['from'] ?? date('Y').'-01-01');
        $to   = $conn->real_escape_string($_GET['to']   ?? date('Y-m-d'));
        $w    = "s.tenant_id=$tid AND s.bank_account_id=$baid AND s.stmt_date>='$from' AND s.stmt_date<='$to'";
        if (isset($_GET['unreconciled']) && $_GET['unreconciled'] == '1') $w .= " AND s.reconciled=0";
        $rows = [];
        $res = $conn->query("SELECT s.*,e.entry_no FROM acc_bank_stmt_lines s
                             LEFT JOIN acc_entries e ON e.id=s.gl_entry_id
                             WHERE $w ORDER BY s.stmt_date ASC, s.id ASC");
        while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        // إجماليات
        $tot = $conn->query("SELECT COALESCE(SUM(debit),0) d,COALESCE(SUM(credit),0) c,COUNT(*) cnt,
                                    COALESCE(SUM(CASE WHEN reconciled=1 THEN debit END),0) rd,
                                    COALESCE(SUM(CASE WHEN reconciled=1 THEN credit END),0) rc,
                                    COALESCE(SUM(CASE WHEN reconciled=0 THEN 1 END),0) unmatched
                             FROM acc_bank_stmt_lines s WHERE $w");
        $totals = $tot ? $tot->fetch_assoc() : [];
        echo json_encode(['success'=>true,'data'=>$rows,'totals'=>$totals], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_bank_stmt_add': {
        // إضافة بنود كشف الحساب (دفعة واحدة)
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $baid = (int)($input_data['bank_account_id'] ?? 0);
        $lines= $input_data['lines'] ?? [];
        if (!$baid || empty($lines)) { echo json_encode(['success'=>false,'message'=>'بيانات ناقصة']); break; }
        $conn->begin_transaction();
        try {
            $added = 0;
            foreach ($lines as $l) {
                $d    = $conn->real_escape_string($l['stmt_date'] ?? '');
                $desc = $conn->real_escape_string($l['description'] ?? '');
                $dr   = round((float)($l['debit']  ?? 0), 2);
                $cr   = round((float)($l['credit'] ?? 0), 2);
                $ref  = $conn->real_escape_string($l['ref'] ?? '');
                if (!$d) continue;
                $conn->query("INSERT INTO acc_bank_stmt_lines (tenant_id,bank_account_id,stmt_date,description,debit,credit,ref)
                              VALUES ($tid,$baid,'$d','$desc',$dr,$cr,'$ref')");
                $added++;
            }
            $conn->commit();
            echo json_encode(['success'=>true,'added'=>$added,'message'=>"تمت إضافة $added بند"], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'gl_bank_stmt_delete': {
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        if (!$id) { echo json_encode(['success'=>false,'message'=>'معرّف مطلوب']); break; }
        $conn->query("DELETE FROM acc_bank_stmt_lines WHERE id=$id AND tenant_id=$tid");
        echo json_encode(['success'=>$conn->affected_rows>0,'message'=>'تم الحذف'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_bank_reconcile_mark': {
        // مطابقة / إلغاء مطابقة بند
        $tid       = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id        = (int)($input_data['id'] ?? 0);
        $reconciled= (int)($input_data['reconciled'] ?? 0) ? 1 : 0;
        $entryId   = (int)($input_data['gl_entry_id'] ?? 0) ?: 'NULL';
        if (!$id) { echo json_encode(['success'=>false,'message'=>'معرّف مطلوب']); break; }
        $conn->query("UPDATE acc_bank_stmt_lines SET reconciled=$reconciled,gl_entry_id=$entryId WHERE id=$id AND tenant_id=$tid");
        echo json_encode(['success'=>true,'message'=>$reconciled?'تمت المطابقة':'تم إلغاء المطابقة'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_bank_recon_report': {
        // تقرير المطابقة: رصيد دفتر الأستاذ vs رصيد كشف البنك + البنود غير المطابقة
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $baid = (int)($_GET['bank_account_id'] ?? 0);
        $to   = $conn->real_escape_string($_GET['to'] ?? date('Y-m-d'));

        // جلب بيانات الحساب البنكي
        $br = $conn->query("SELECT * FROM acc_bank_accounts WHERE id=$baid AND tenant_id=$tid LIMIT 1");
        $bankAcc = $br ? $br->fetch_assoc() : null;
        if (!$bankAcc) { echo json_encode(['success'=>false,'message'=>'حساب بنكي غير موجود']); break; }

        $gaid = (int)($bankAcc['gl_account_id'] ?? 0);
        $glBalance = 0;
        if ($gaid) {
            $glr = $conn->query("SELECT COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date<='$to' THEN l.debit  ELSE 0 END),0) d,
                                         COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date<='$to' THEN l.credit ELSE 0 END),0) c
                                  FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id
                                  WHERE l.account_id=$gaid AND l.tenant_id=$tid");
            if ($glr && ($gr = $glr->fetch_assoc())) $glBalance = round((float)$gr['d']-(float)$gr['c'],2);
        }

        // البنود غير المطابقة من كشف البنك
        $stmtUnmatched = [];
        $sr = $conn->query("SELECT * FROM acc_bank_stmt_lines WHERE tenant_id=$tid AND bank_account_id=$baid AND reconciled=0 AND stmt_date<='$to' ORDER BY stmt_date ASC");
        while ($sr && ($x = $sr->fetch_assoc())) $stmtUnmatched[] = $x;

        $totStmtD = array_sum(array_column($stmtUnmatched,'debit'));
        $totStmtC = array_sum(array_column($stmtUnmatched,'credit'));

        echo json_encode(['success'=>true,'bank_account'=>$bankAcc,'as_of'=>$to,
            'gl_balance'=>$glBalance,
            'stmt_unmatched'=>$stmtUnmatched,
            'stmt_unmatched_debit'=>round($totStmtD,2),'stmt_unmatched_credit'=>round($totStmtC,2),
            'adjusted_balance'=>round($glBalance+$totStmtD-$totStmtC,2)
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_fiscal_years': {
        // قائمة السنوات المالية (من acc_periods) + السنة الحالية إن لم تُسجَّل
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $curY = (int)date('Y');
        $rows = [];
        $fySet = [];
        $res  = $conn->query("SELECT fy,is_closed,closed_at,closed_by,start_date,end_date FROM acc_periods WHERE tenant_id=$tid ORDER BY fy DESC");
        while ($res && ($x = $res->fetch_assoc())) { $fySet[(int)$x['fy']] = true; $rows[] = $x; }
        // أضف السنة الحالية إن لم تكن مسجّلة
        if (!isset($fySet[$curY])) {
            array_unshift($rows, ['fy'=>$curY,'is_closed'=>0,'closed_at'=>null,'closed_by'=>null,'start_date'=>"$curY-01-01",'end_date'=>"$curY-12-31"]);
        }
        // إحصاء الحركات لكل سنة
        foreach ($rows as &$row) {
            $fy2 = (int)$row['fy'];
            $cnt = $conn->query("SELECT COUNT(*) c FROM acc_entries e WHERE e.tenant_id=$tid AND e.is_posted=1 AND YEAR(e.date)=$fy2 AND (e.ref_type IS NULL OR e.ref_type NOT IN('year_close'))");
            $row['entry_count'] = $cnt ? (int)$cnt->fetch_assoc()['c'] : 0;
        }
        unset($row);
        echo json_encode(['success'=>true,'data'=>$rows,'current_fy'=>$curY], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_periods_status': {
        // حالة الفترة المالية لسنة معينة
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $fy  = (int)($_GET['fy'] ?? date('Y'));
        $r   = $conn->query("SELECT fy,is_closed,closed_at,closed_by FROM acc_periods WHERE tenant_id=$tid AND fy=$fy LIMIT 1");
        $row = $r ? $r->fetch_assoc() : null;
        echo json_encode(['success'=>true,'period'=>$row ?: ['fy'=>$fy,'is_closed'=>0,'closed_at'=>null,'closed_by'=>null]], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_close_year': {
        // ═══ إقفال السنة المالية ═══════════════════════════════════════════════
        // 1) يُولّد قيد إقفال يُصفّر الإيرادات والمصروفات ويرحّل الصافي للأرباح المحتجزة
        // 2) يُقفل سجل acc_periods للسنة (is_closed=1)
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $fy  = (int)($input_data['fy'] ?? date('Y'));
        $by  = $input_data['actor'] ?? null;

        if ($fy < 2000 || $fy > 2100) { echo json_encode(['success'=>false,'message'=>'سنة غير صالحة']); break; }

        // منع الإقفال المزدوج
        $pc = $conn->query("SELECT is_closed FROM acc_periods WHERE tenant_id=$tid AND fy=$fy LIMIT 1");
        if ($pc && ($pr = $pc->fetch_assoc()) && (int)$pr['is_closed'] === 1) {
            echo json_encode(['success'=>false,'message'=>"السنة المالية $fy مقفلة مسبقًا"], JSON_UNESCAPED_UNICODE); break;
        }

        $from = "$fy-01-01"; $to = "$fy-12-31";

        // ─── أرصدة الإيرادات والمصروفات للسنة ───────────────────────────
        $sql = "SELECT a.id,a.code,a.name,a.type,
                   COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$from' AND e.date<='$to'
                                     AND (e.ref_type IS NULL OR e.ref_type NOT IN ('year_close'))
                                     THEN l.debit  ELSE 0 END),0) d,
                   COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$from' AND e.date<='$to'
                                     AND (e.ref_type IS NULL OR e.ref_type NOT IN ('year_close'))
                                     THEN l.credit ELSE 0 END),0) c
                FROM acc_accounts a
                LEFT JOIN acc_lines l ON l.account_id=a.id AND l.tenant_id=a.tenant_id
                LEFT JOIN acc_entries e ON e.id=l.entry_id
                WHERE a.tenant_id=$tid AND a.is_group=0 AND a.type IN ('revenue','expense')
                GROUP BY a.id HAVING (d+c)>0 ORDER BY a.code";
        $res = $conn->query($sql);
        $lines = []; $netRev = 0.0; $netExp = 0.0;
        while ($res && ($x = $res->fetch_assoc())) {
            $d = round((float)$x['d'], 2); $c = round((float)$x['c'], 2);
            if ($x['type'] === 'revenue') {
                $net = round($c - $d, 2); if ($net == 0) continue; $netRev += $net;
                $lines[] = ['account_id'=>(int)$x['id'],'debit'=>$net,'credit'=>0,
                            'description'=>'إقفال إيرادات: '.$x['name']];
            } else {
                $net = round($d - $c, 2); if ($net == 0) continue; $netExp += $net;
                $lines[] = ['account_id'=>(int)$x['id'],'debit'=>0,'credit'=>$net,
                            'description'=>'إقفال مصروفات: '.$x['name']];
            }
        }
        if (empty($lines)) { echo json_encode(['success'=>false,'message'=>'لا توجد أرصدة إيرادات/مصروفات لإقفالها'], JSON_UNESCAPED_UNICODE); break; }

        $netIncome = round($netRev - $netExp, 2);

        // ─── حساب الأرباح المحتجزة ──────────────────────────────────────
        $retAccId = (int)acc_setting($conn, $tid, 'retained_earnings_account_id', '0');
        if (!$retAccId) {
            $ra = $conn->query("SELECT id FROM acc_accounts WHERE tenant_id=$tid AND type='equity' AND is_group=0 ORDER BY code ASC LIMIT 1");
            $retAccId = ($ra && ($raRow = $ra->fetch_assoc())) ? (int)$raRow['id'] : 0;
            if (!$retAccId) {
                if (!$conn->query("INSERT INTO acc_accounts (tenant_id,code,name,type,is_group,status) VALUES ($tid,'3110','الأرباح المحتجزة','equity',0,1)
                                   ON DUPLICATE KEY UPDATE name=name")) throw new \Exception($conn->error);
                // قد تكون الكود موجودة بالفعل — نجلب المعرّف في الحالتين
                $ra2 = $conn->query("SELECT id FROM acc_accounts WHERE tenant_id=$tid AND code='3110' LIMIT 1");
                $retAccId = ($ra2 && ($r2 = $ra2->fetch_assoc())) ? (int)$r2['id'] : $conn->insert_id;
            }
            $conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES ($tid,'retained_earnings_account_id','$retAccId') ON DUPLICATE KEY UPDATE sval=VALUES(sval)");
        }
        if (!$retAccId) { echo json_encode(['success'=>false,'message'=>'تعذّر تحديد حساب الأرباح المحتجزة']); break; }

        // بند الصافي → الأرباح المحتجزة
        if ($netIncome >= 0) {
            $lines[] = ['account_id'=>$retAccId,'debit'=>0,'credit'=>$netIncome,
                        'description'=>"صافي ربح $fy"];
        } else {
            $lines[] = ['account_id'=>$retAccId,'debit'=>abs($netIncome),'credit'=>0,
                        'description'=>"صافي خسارة $fy"];
        }

        $conn->begin_transaction();
        try {
            $r = acc_post_entry($conn, $tid, "$fy-12-31", "إقفال السنة المالية $fy", 'year_close', $fy, $by, $lines, 1);
            // إنشاء/تحديث سجل الفترة وإقفالها
            $byEsc = $by ? "'".$conn->real_escape_string($by)."'" : 'NULL';
            $conn->query("INSERT INTO acc_periods (tenant_id,fy,start_date,end_date,is_closed,closed_at,closed_by)
                          VALUES ($tid,$fy,'$from','$to',1,NOW(),$byEsc)
                          ON DUPLICATE KEY UPDATE is_closed=1,closed_at=NOW(),closed_by=$byEsc");
            $conn->commit();
            acc_audit($conn, $tid, 'gl', null, 'close_year', "fy=$fy rev=$netRev exp=$netExp net=$netIncome entry=".$r['eno'], $by);
            echo json_encode(['success'=>true,'entry_no'=>$r['eno'],'fy'=>$fy,
                'net_revenue'=>$netRev,'net_expenses'=>$netExp,'net_income'=>$netIncome,
                'message'=>"تم إقفال السنة المالية $fy — قيد الإقفال: ".$r['eno']], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الإقفال: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'gl_reopen_year': {
        // إعادة فتح سنة مالية — لتصحيح الأخطاء (يحذف قيد الإقفال ويفتح الفترة)
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $fy  = (int)($input_data['fy'] ?? date('Y'));
        $by  = $input_data['actor'] ?? null;

        if ($fy < 2000 || $fy > 2100) { echo json_encode(['success'=>false,'message'=>'سنة غير صالحة']); break; }

        $conn->begin_transaction();
        try {
            // حذف قيود الإقفال لهذه السنة
            $eids = [];
            $er = $conn->query("SELECT id FROM acc_entries WHERE tenant_id=$tid AND ref_type='year_close' AND ref_id=$fy");
            while ($er && ($eRow = $er->fetch_assoc())) $eids[] = (int)$eRow['id'];
            foreach ($eids as $eid) {
                $conn->query("DELETE FROM acc_lines WHERE entry_id=$eid AND tenant_id=$tid");
                $conn->query("DELETE FROM acc_entries WHERE id=$eid AND tenant_id=$tid");
            }
            // فتح الفترة
            $conn->query("UPDATE acc_periods SET is_closed=0,closed_at=NULL,closed_by=NULL WHERE tenant_id=$tid AND fy=$fy");
            $conn->commit();
            acc_audit($conn, $tid, 'gl', null, 'reopen_year', "fy=$fy deleted=".count($eids)." entries", $by);
            echo json_encode(['success'=>true,'fy'=>$fy,'deleted_entries'=>count($eids),
                'message'=>"تم إعادة فتح السنة المالية $fy"], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الفتح: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    // ════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════
    //  القيود المتكررة / المجدولة
    // ════════════════════════════════════════════════════════════════════
    case 'gl_recurring_list': {
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $conn->query("CREATE TABLE IF NOT EXISTS acc_recurring_entries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            name VARCHAR(200) NOT NULL,
            template_id INT DEFAULT NULL,
            frequency ENUM('daily','weekly','monthly','quarterly','annually') NOT NULL DEFAULT 'monthly',
            next_date DATE NOT NULL,
            end_date DATE DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            last_run_at DATETIME DEFAULT NULL,
            last_entry_no VARCHAR(30) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_rec_tenant (tenant_id),
            KEY idx_rec_next (next_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $rows = [];
        $today = date('Y-m-d');
        $res = $conn->query("SELECT r.*,t.name AS tpl_name
                             FROM acc_recurring_entries r
                             LEFT JOIN acc_entry_templates t ON t.id=r.template_id
                             WHERE r.tenant_id=$tid ORDER BY r.next_date ASC");
        while ($res && ($x = $res->fetch_assoc())) {
            $x['is_due'] = ($x['next_date'] <= $today && $x['is_active'] && (!$x['end_date'] || $x['end_date'] >= $today)) ? 1 : 0;
            $rows[] = $x;
        }
        $due = count(array_filter($rows, fn($r)=>$r['is_due']));
        echo json_encode(['success'=>true,'data'=>$rows,'due_count'=>$due], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_recurring_save': {
        $tid      = (int)($input_data['tenant_id'] ?? 1);
        $id       = (int)($input_data['id'] ?? 0);
        $name     = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $tplId    = (int)($input_data['template_id'] ?? 0) ?: 'NULL';
        $freq     = in_array($input_data['frequency']??'', ['daily','weekly','monthly','quarterly','annually']) ? $input_data['frequency'] : 'monthly';
        $nextDate = $conn->real_escape_string($input_data['next_date'] ?? date('Y-m-d'));
        $endDate  = trim($input_data['end_date'] ?? '') ? "'".$conn->real_escape_string($input_data['end_date'])."'" : 'NULL';
        if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
        if ($id) {
            $conn->query("UPDATE acc_recurring_entries SET name='$name',template_id=$tplId,frequency='$freq',next_date='$nextDate',end_date=$endDate WHERE id=$id AND tenant_id=$tid");
        } else {
            $conn->query("INSERT INTO acc_recurring_entries (tenant_id,name,template_id,frequency,next_date,end_date) VALUES ($tid,'$name',$tplId,'$freq','$nextDate',$endDate)");
            $id = (int)$conn->insert_id;
        }
        echo json_encode(['success'=>true,'id'=>$id,'message'=>'تم الحفظ'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_recurring_toggle': {
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $conn->query("UPDATE acc_recurring_entries SET is_active = 1-is_active WHERE id=$id AND tenant_id=$tid");
        echo json_encode(['success'=>true,'message'=>'تم التحديث'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_recurring_delete': {
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $conn->query("DELETE FROM acc_recurring_entries WHERE id=$id AND tenant_id=$tid");
        echo json_encode(['success'=>true,'message'=>'تم الحذف'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_recurring_run': {
        // ترحيل قيد متكرر مستحق: يُنشئ قيداً من القالب ويُحدّث next_date
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $rr  = $conn->query("SELECT r.*,t.name AS tpl_name FROM acc_recurring_entries r LEFT JOIN acc_entry_templates t ON t.id=r.template_id WHERE r.id=$id AND r.tenant_id=$tid LIMIT 1");
        $rec = $rr ? $rr->fetch_assoc() : null;
        if (!$rec) { echo json_encode(['success'=>false,'message'=>'قيد غير موجود']); break; }
        if (!$rec['template_id']) { echo json_encode(['success'=>false,'message'=>'لا يوجد قالب مرتبط بهذا القيد']); break; }

        // جلب بنود القالب
        $lr = $conn->query("SELECT * FROM acc_entry_template_lines WHERE template_id={$rec['template_id']} AND tenant_id=$tid ORDER BY seq");
        $lines = []; while ($lr && ($l = $lr->fetch_assoc())) $lines[] = ['account_id'=>(int)$l['account_id'],'debit'=>(float)$l['debit'],'credit'=>(float)$l['credit'],'description'=>$l['description'],'cost_center_id'=>$l['cost_center_id']?:(int)0?:null];
        if (count($lines) < 2) { echo json_encode(['success'=>false,'message'=>'القالب يحتاج بندين على الأقل']); break; }

        $conn->begin_transaction();
        try {
            $today = date('Y-m-d');
            $r = acc_post_entry($conn, $tid, $today, $rec['name'], 'recurring', $id, null, $lines, 1);

            // احسب next_date التالية
            $nd = new DateTime($rec['next_date']);
            switch ($rec['frequency']) {
                case 'daily':     $nd->modify('+1 day');    break;
                case 'weekly':    $nd->modify('+7 days');   break;
                case 'monthly':   $nd->modify('+1 month');  break;
                case 'quarterly': $nd->modify('+3 months'); break;
                case 'annually':  $nd->modify('+1 year');   break;
            }
            $nextDate = $nd->format('Y-m-d');
            $eno = $conn->real_escape_string($r['eno']);
            $conn->query("UPDATE acc_recurring_entries SET next_date='$nextDate',last_run_at=NOW(),last_entry_no='$eno' WHERE id=$id AND tenant_id=$tid");
            $conn->commit();
            acc_audit($conn,$tid,'gl',null,'recurring_run',"id=$id eno={$r['eno']} next=$nextDate",null);
            echo json_encode(['success'=>true,'entry_no'=>$r['eno'],'next_date'=>$nextDate,'message'=>"تم ترحيل القيد ({$r['eno']})"], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الترحيل: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'gl_recurring_run_all': {
        // ترحيل جميع القيود المتكررة المستحقة اليوم دفعةً واحدة
        $tid   = (int)($input_data['tenant_id'] ?? 1);
        $today = date('Y-m-d');
        $res   = $conn->query("SELECT r.*,t.name AS tpl_name
                               FROM acc_recurring_entries r
                               LEFT JOIN acc_entry_templates t ON t.id=r.template_id
                               WHERE r.tenant_id=$tid AND r.is_active=1 AND r.next_date<='$today'
                                 AND (r.end_date IS NULL OR r.end_date>='$today')
                               ORDER BY r.next_date ASC");
        $posted = []; $errors = [];
        while ($res && ($rec = $res->fetch_assoc())) {
            if (!$rec['template_id']) { $errors[] = ['name'=>$rec['name'],'error'=>'لا يوجد قالب مرتبط']; continue; }
            $lr = $conn->query("SELECT * FROM acc_entry_template_lines WHERE template_id={$rec['template_id']} AND tenant_id=$tid ORDER BY seq");
            $lines = []; while ($lr && ($l=$lr->fetch_assoc())) $lines[] = ['account_id'=>(int)$l['account_id'],'debit'=>(float)$l['debit'],'credit'=>(float)$l['credit'],'description'=>$l['description'],'cost_center_id'=>$l['cost_center_id']?:null];
            if (count($lines) < 2) { $errors[] = ['name'=>$rec['name'],'error'=>'القالب يحتاج بندين على الأقل']; continue; }
            $conn->begin_transaction();
            try {
                $r = acc_post_entry($conn, $tid, $today, $rec['name'], 'recurring', (int)$rec['id'], null, $lines, 1);
                $nd = new DateTime($rec['next_date']);
                switch ($rec['frequency']) {
                    case 'daily':     $nd->modify('+1 day');    break;
                    case 'weekly':    $nd->modify('+7 days');   break;
                    case 'monthly':   $nd->modify('+1 month');  break;
                    case 'quarterly': $nd->modify('+3 months'); break;
                    case 'annually':  $nd->modify('+1 year');   break;
                }
                $nextDate = $nd->format('Y-m-d');
                $eno = $conn->real_escape_string($r['eno']);
                $conn->query("UPDATE acc_recurring_entries SET next_date='$nextDate',last_run_at=NOW(),last_entry_no='$eno' WHERE id={$rec['id']} AND tenant_id=$tid");
                $conn->commit();
                $posted[] = ['name'=>$rec['name'],'entry_no'=>$r['eno'],'next_date'=>$nextDate];
            } catch (Exception $e) {
                $conn->rollback();
                $errors[] = ['name'=>$rec['name'],'error'=>$e->getMessage()];
            }
        }
        $msg = count($posted) > 0 ? 'تم ترحيل '.count($posted).' قيد' : 'لا توجد قيود مستحقة';
        echo json_encode(['success'=>count($posted)>0||count($errors)===0,'posted'=>$posted,'errors'=>$errors,'message'=>$msg], JSON_UNESCAPED_UNICODE);
        break;
    }

    //  قوالب القيود اليومية
    // ════════════════════════════════════════════════════════════════════
    case 'gl_templates': {
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        // تأكد من وجود الجداول
        $conn->query("CREATE TABLE IF NOT EXISTS acc_entry_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            name VARCHAR(200) NOT NULL,
            description VARCHAR(500) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_tpl_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $conn->query("CREATE TABLE IF NOT EXISTS acc_entry_template_lines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            template_id INT NOT NULL,
            tenant_id INT NOT NULL DEFAULT 1,
            seq INT NOT NULL DEFAULT 0,
            account_id INT DEFAULT NULL,
            debit DECIMAL(15,2) NOT NULL DEFAULT 0,
            credit DECIMAL(15,2) NOT NULL DEFAULT 0,
            description VARCHAR(500) DEFAULT '',
            cost_center_id INT DEFAULT NULL,
            KEY idx_tpl_lines_tid (template_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $rows = [];
        $res = $conn->query("SELECT id,name,description,created_at FROM acc_entry_templates WHERE tenant_id=$tid ORDER BY name ASC");
        while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_template_get': {
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $id  = (int)($_GET['id'] ?? 0);
        $r   = $conn->query("SELECT * FROM acc_entry_templates WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $tpl = $r ? $r->fetch_assoc() : null;
        if (!$tpl) { echo json_encode(['success'=>false,'message'=>'قالب غير موجود']); break; }
        $lr   = $conn->query("SELECT tl.*,a.code AS account_code,a.name AS account_name
                               FROM acc_entry_template_lines tl
                               LEFT JOIN acc_accounts a ON a.id=tl.account_id
                               WHERE tl.template_id=$id AND tl.tenant_id=$tid ORDER BY tl.seq");
        $lines = [];
        while ($lr && ($l = $lr->fetch_assoc())) $lines[] = $l;
        echo json_encode(['success'=>true,'template'=>$tpl,'lines'=>$lines], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_template_save': {
        $tid   = (int)($input_data['tenant_id'] ?? 1);
        $id    = (int)($input_data['id'] ?? 0);
        $name  = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $desc  = $conn->real_escape_string(trim($input_data['description'] ?? ''));
        $lines = $input_data['lines'] ?? [];
        if (!$name) { echo json_encode(['success'=>false,'message'=>'اسم القالب مطلوب'], JSON_UNESCAPED_UNICODE); break; }
        $conn->begin_transaction();
        try {
            if ($id) {
                $conn->query("UPDATE acc_entry_templates SET name='$name',description='$desc' WHERE id=$id AND tenant_id=$tid");
                $conn->query("DELETE FROM acc_entry_template_lines WHERE template_id=$id AND tenant_id=$tid");
            } else {
                $conn->query("INSERT INTO acc_entry_templates (tenant_id,name,description) VALUES ($tid,'$name','$desc')");
                $id = (int)$conn->insert_id;
            }
            $seq = 0;
            foreach ($lines as $l) {
                $aid  = (int)($l['account_id'] ?? 0);
                $d    = round((float)($l['debit'] ?? 0), 2);
                $c    = round((float)($l['credit'] ?? 0), 2);
                $ld   = $conn->real_escape_string($l['description'] ?? '');
                $ccid = (int)($l['cost_center_id'] ?? 0) ?: 'NULL';
                if (!$aid) continue;
                $conn->query("INSERT INTO acc_entry_template_lines (template_id,tenant_id,seq,account_id,debit,credit,description,cost_center_id)
                              VALUES ($id,$tid,$seq,$aid,$d,$c,'$ld',$ccid)");
                $seq++;
            }
            $conn->commit();
            echo json_encode(['success'=>true,'id'=>$id,'message'=>'تم حفظ القالب'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'gl_template_delete': {
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        if (!$id) { echo json_encode(['success'=>false,'message'=>'معرّف مطلوب']); break; }
        $conn->query("DELETE FROM acc_entry_template_lines WHERE template_id=$id AND tenant_id=$tid");
        $conn->query("DELETE FROM acc_entry_templates WHERE id=$id AND tenant_id=$tid");
        echo json_encode(['success'=>true,'message'=>'تم حذف القالب'], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ════════════════════════════════════════════════════════════════════
    //  الميزانية التقديرية (Budget)
    // ════════════════════════════════════════════════════════════════════
    case 'gl_budget_get': {
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $fy  = (int)($_GET['fy'] ?? date('Y'));
        $conn->query("CREATE TABLE IF NOT EXISTS acc_budget (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            fy SMALLINT NOT NULL,
            account_id INT NOT NULL,
            amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            UNIQUE KEY uk_budget (tenant_id,fy,account_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $rows = [];
        $res = $conn->query("SELECT b.id,b.account_id,b.amount,a.code,a.name,a.type
                             FROM acc_budget b
                             JOIN acc_accounts a ON a.id=b.account_id
                             WHERE b.tenant_id=$tid AND b.fy=$fy
                             ORDER BY a.code");
        while ($res && ($x = $res->fetch_assoc())) { $x['amount'] = round((float)$x['amount'],2); $rows[] = $x; }
        echo json_encode(['success'=>true,'data'=>$rows,'fy'=>$fy], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_budget_save': {
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $fy   = (int)($input_data['fy'] ?? date('Y'));
        $rows = $input_data['rows'] ?? [];
        if ($fy < 2000 || $fy > 2100) { echo json_encode(['success'=>false,'message'=>'سنة غير صالحة']); break; }
        $conn->begin_transaction();
        try {
            $saved = 0;
            foreach ($rows as $row) {
                $aid = (int)($row['account_id'] ?? 0);
                $amt = round((float)($row['amount'] ?? 0), 2);
                if (!$aid) continue;
                $conn->query("INSERT INTO acc_budget (tenant_id,fy,account_id,amount) VALUES ($tid,$fy,$aid,$amt)
                              ON DUPLICATE KEY UPDATE amount=$amt");
                $saved++;
            }
            $conn->commit();
            echo json_encode(['success'=>true,'saved'=>$saved,'message'=>"تم حفظ $saved بند في الميزانية $fy"], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'gl_budget_vs_actual': {
        // مقارنة الميزانية التقديرية بالفعلي لسنة مالية
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $fy   = (int)($_GET['fy'] ?? date('Y'));
        $from = "$fy-01-01"; $to = "$fy-12-31";

        // الفعلي: إيرادات + مصروفات مرحّلة خلال السنة
        $sqlAct = "SELECT a.id,a.code,a.name,a.type,
                       COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$from' AND e.date<='$to'
                                         AND (e.ref_type IS NULL OR e.ref_type NOT IN ('year_close'))
                                         THEN l.debit  ELSE 0 END),0) d,
                       COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$from' AND e.date<='$to'
                                         AND (e.ref_type IS NULL OR e.ref_type NOT IN ('year_close'))
                                         THEN l.credit ELSE 0 END),0) c
                    FROM acc_accounts a
                    LEFT JOIN acc_lines l   ON l.account_id=a.id AND l.tenant_id=a.tenant_id
                    LEFT JOIN acc_entries e ON e.id=l.entry_id
                    WHERE a.tenant_id=$tid AND a.is_group=0 AND a.type IN ('revenue','expense')
                    GROUP BY a.id ORDER BY a.type,a.code";

        $actMap = [];
        $resA = $conn->query($sqlAct);
        while ($resA && ($x = $resA->fetch_assoc())) {
            $d = (float)$x['d']; $c = (float)$x['c'];
            $actual = $x['type']==='revenue' ? round($c-$d,2) : round($d-$c,2);
            $actMap[(int)$x['id']] = ['code'=>$x['code'],'name'=>$x['name'],'type'=>$x['type'],'actual'=>$actual];
        }

        // الميزانية
        $budMap = [];
        $resB = $conn->query("SELECT account_id,amount FROM acc_budget WHERE tenant_id=$tid AND fy=$fy");
        while ($resB && ($x = $resB->fetch_assoc())) $budMap[(int)$x['account_id']] = round((float)$x['amount'],2);

        // دمج: كل حساب له ميزانية أو فعلي
        $allIds = array_unique(array_merge(array_keys($actMap), array_keys($budMap)));
        $rows = []; $totalBudRev=0; $totalActRev=0; $totalBudExp=0; $totalActExp=0;
        // اجلب أسماء الحسابات التي في الميزانية فقط
        foreach ($allIds as $aid) {
            if (!isset($actMap[$aid])) {
                $ra = $conn->query("SELECT code,name,type FROM acc_accounts WHERE id=$aid AND tenant_id=$tid LIMIT 1");
                if ($ra && ($ra2 = $ra->fetch_assoc())) $actMap[$aid] = ['code'=>$ra2['code'],'name'=>$ra2['name'],'type'=>$ra2['type'],'actual'=>0];
                else continue;
            }
            $info   = $actMap[$aid];
            $budget = $budMap[$aid] ?? 0;
            $actual = $info['actual'];
            $var    = round($actual - $budget, 2);
            $pct    = $budget != 0 ? round(($actual/$budget)*100, 1) : null;
            $row = ['account_id'=>$aid,'code'=>$info['code'],'name'=>$info['name'],'type'=>$info['type'],
                    'budget'=>$budget,'actual'=>$actual,'variance'=>$var,'pct'=>$pct];
            $rows[] = $row;
            if ($info['type']==='revenue') { $totalBudRev+=$budget; $totalActRev+=$actual; }
            else { $totalBudExp+=$budget; $totalActExp+=$actual; }
        }
        // ترتيب: إيرادات أولاً ثم مصروفات، ثم حسب الكود
        usort($rows, fn($a,$b) => [$a['type']==='expense'?1:0,$a['code']] <=> [$b['type']==='expense'?1:0,$b['code']]);
        echo json_encode(['success'=>true,'fy'=>$fy,'data'=>$rows,
            'totals'=>[
                'rev_budget'=>round($totalBudRev,2),'rev_actual'=>round($totalActRev,2),'rev_variance'=>round($totalActRev-$totalBudRev,2),
                'exp_budget'=>round($totalBudExp,2),'exp_actual'=>round($totalActExp,2),'exp_variance'=>round($totalActExp-$totalBudExp,2),
                'net_budget'=>round($totalBudRev-$totalBudExp,2),'net_actual'=>round($totalActRev-$totalActExp,2),
                'net_variance'=>round(($totalActRev-$totalActExp)-($totalBudRev-$totalBudExp),2),
            ]], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_balance_sheet':
        // الميزانية العمومية حتى تاريخ — أصول/خصوم/حقوق ملكية + صافي الدخل (المُرحَّلة فقط)
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $to  = $conn->real_escape_string($_GET['to'] ?? date('Y-m-d'));
        // CASE داخل SUM لضمان تصفية صحيحة حتى مع LEFT JOIN
        $sql = "SELECT a.id,a.code,a.name,a.type,
                   COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date<='$to' THEN l.debit  ELSE 0 END),0) d,
                   COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date<='$to' THEN l.credit ELSE 0 END),0) c
                FROM acc_accounts a
                LEFT JOIN acc_lines l ON l.account_id=a.id AND l.tenant_id=a.tenant_id
                LEFT JOIN acc_entries e ON e.id=l.entry_id
                WHERE a.tenant_id=$tid AND a.is_group=0 AND a.type IN ('asset','liability','equity')
                GROUP BY a.id ORDER BY a.code";
        $res = $conn->query($sql); $assets = []; $liab = []; $eq = []; $tA = 0; $tL = 0; $tE = 0;
        while ($res && ($x = $res->fetch_assoc())) {
            $d = (float)$x['d']; $c = (float)$x['c'];
            if ($x['type'] === 'asset') { $amt = round($d - $c, 2); $x['amount'] = $amt; $tA += $amt; $assets[] = $x; }
            elseif ($x['type'] === 'liability') { $amt = round($c - $d, 2); $x['amount'] = $amt; $tL += $amt; $liab[] = $x; }
            else { $amt = round($c - $d, 2); $x['amount'] = $amt; $tE += $amt; $eq[] = $x; }
        }
        // صافي الدخل المتراكم حتى التاريخ يُضاف لحقوق الملكية (الأرباح غير المُرحَّلة)
        $ni = $conn->query("SELECT COALESCE(SUM(CASE WHEN a.type='revenue' THEN l.credit-l.debit ELSE 0 END),0) rev, COALESCE(SUM(CASE WHEN a.type='expense' THEN l.debit-l.credit ELSE 0 END),0) exp FROM acc_lines l JOIN acc_accounts a ON a.id=l.account_id JOIN acc_entries e ON e.id=l.entry_id WHERE l.tenant_id=$tid AND e.is_posted=1 AND e.date<='$to' AND a.type IN ('revenue','expense')");
        $netIncome = 0; if ($ni && ($nr = $ni->fetch_assoc())) $netIncome = round((float)$nr['rev'] - (float)$nr['exp'], 2);
        $tE2 = round($tE + $netIncome, 2);
        echo json_encode(['success'=>true,'as_of'=>$to,'assets'=>$assets,'liabilities'=>$liab,'equity'=>$eq,'net_income'=>$netIncome,'totals'=>['assets'=>round($tA,2),'liabilities'=>round($tL,2),'equity'=>$tE2,'liab_plus_equity'=>round($tL+$tE2,2),'balanced'=>round($tA,2)==round($tL+$tE2,2)]], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_vat_report':
        // إقرار ضريبة القيمة المضافة — مخرجات (2102) ومدخلات (1401) بشكل منفصل — المُرحَّلة فقط
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $from = $conn->real_escape_string($_GET['from'] ?? date('Y-01-01'));
        $to   = $conn->real_escape_string($_GET['to']   ?? date('Y-m-d'));
        // ضريبة المخرجات: الدائن صافي في حساب 2102 (ضريبة مبيعات مستحقة)
        $ar = $conn->query("SELECT id FROM acc_accounts WHERE tenant_id=$tid AND code='2102' LIMIT 1");
        $outVatId = $ar ? (int)($ar->fetch_assoc()['id'] ?? 0) : 0;
        // ضريبة المدخلات: المدين صافي في حساب 1401 (ضريبة مشتريات قابلة للاسترداد)
        $ar2 = $conn->query("SELECT id FROM acc_accounts WHERE tenant_id=$tid AND code='1401' LIMIT 1");
        $inVatId = $ar2 ? (int)($ar2->fetch_assoc()['id'] ?? 0) : 0;
        $out = 0; $in = 0;
        if ($outVatId) {
            $r = $conn->query("SELECT COALESCE(SUM(l.credit),0) cr, COALESCE(SUM(l.debit),0) dr FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE l.account_id=$outVatId AND l.tenant_id=$tid AND e.is_posted=1 AND e.date>='$from' AND e.date<='$to'");
            if ($r && ($x=$r->fetch_assoc())) $out = round((float)$x['cr'] - (float)$x['dr'], 2);
        }
        if ($inVatId) {
            $r2 = $conn->query("SELECT COALESCE(SUM(l.debit),0) dr, COALESCE(SUM(l.credit),0) cr FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE l.account_id=$inVatId AND l.tenant_id=$tid AND e.is_posted=1 AND e.date>='$from' AND e.date<='$to'");
            if ($r2 && ($x2=$r2->fetch_assoc())) $in = round((float)$x2['dr'] - (float)$x2['cr'], 2);
        }
        echo json_encode([
            'success'     => true,
            'period'      => ['from'=>$from,'to'=>$to],
            'output_vat'  => round($out, 2),
            'input_vat'   => round($in,  2),
            'net_payable' => round($out - $in, 2),
            'accounts'    => ['output'=>['code'=>'2102','id'=>$outVatId],'input'=>['code'=>'1401','id'=>$inVatId]],
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_parties':
        // دفتر الأطراف (عملاء/موردون) — يشمل الذمم المفتوحة من الفواتير المُرحّلة
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $type = $conn->real_escape_string($_GET['type'] ?? '');
        $w = "p.tenant_id=$tid";
        if (in_array($type, ['customer','supplier','partner'])) $w .= " AND p.type='$type'";
        $res = $conn->query("SELECT p.*,
                   COALESCE(SUM(CASE WHEN i.status IN ('posted','partial') THEN ROUND(i.total - i.paid, 2) ELSE 0 END), 0) AS open_balance,
                   COUNT(CASE WHEN i.status IN ('posted','partial') THEN 1 END) AS open_invoices
                 FROM acc_parties p
                 LEFT JOIN acc_invoices i ON i.party_id=p.id AND i.tenant_id=p.tenant_id
                 WHERE $w GROUP BY p.id ORDER BY p.name");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_party_save':
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $type = $conn->real_escape_string($input_data['type'] ?? 'customer');
        if (!in_array($type, ['customer','supplier','partner'])) $type = 'customer';
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $vat  = $conn->real_escape_string(trim($input_data['vat_number'] ?? ''));
        $cr   = $conn->real_escape_string(trim($input_data['cr_number'] ?? ''));
        $phone= $conn->real_escape_string(trim($input_data['phone'] ?? ''));
        $email= $conn->real_escape_string(trim($input_data['email'] ?? ''));
        $addr = $conn->real_escape_string(trim($input_data['address'] ?? ''));
        $daftra = $conn->real_escape_string(trim($input_data['daftra_id'] ?? ''));
        $notes  = $conn->real_escape_string(trim($input_data['notes'] ?? ''));
        if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
        if ($id) {
            $conn->query("UPDATE acc_parties SET type='$type',name='$name',vat_number='$vat',cr_number='$cr',phone='$phone',email='$email',address='$addr',notes='$notes',daftra_id='$daftra' WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>true,'id'=>$id], JSON_UNESCAPED_UNICODE);
        } else {
            $ok = $conn->query("INSERT INTO acc_parties (tenant_id,type,name,vat_number,cr_number,phone,email,address,notes,daftra_id) VALUES ($tid,'$type','$name','$vat','$cr','$phone','$email','$addr','$notes','$daftra')");
            echo json_encode(['success'=>(bool)$ok,'id'=>$conn->insert_id,'message'=>$ok?'تم':$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'gl_party_reclass':
        // إعادة تصنيف أطراف بالجملة — تغيير النوع فقط بلا حذف. الاستهداف بالأولوية: ids (مفتاح أساسي، دقيق) ثم daftra_ids.
        // ملاحظة: daftra_id غير فريد بين الأنواع (عميل#11 ≠ مورّد#11) — لذا استخدم from_type أو ids لتفادي التصادم.
        $tid  = (int)($input_data['tenant_id'] ?? $_GET['tenant_id'] ?? $_GET['tenant'] ?? 1);
        $type = $conn->real_escape_string($input_data['type'] ?? $_GET['type'] ?? '');
        if (!in_array($type, ['customer','supplier','partner'])) { echo json_encode(['success'=>false,'message'=>'type يجب أن يكون customer أو supplier أو partner']); break; }
        $fromType = $input_data['from_type'] ?? $_GET['from_type'] ?? '';
        $pkids = $input_data['ids'] ?? $_GET['ids'] ?? null;
        if (is_string($pkids)) $pkids = array_filter(array_map('trim', explode(',', $pkids)), 'strlen');
        $dids  = $input_data['daftra_ids'] ?? $_GET['daftra_ids'] ?? null;
        if (is_string($dids)) $dids = array_filter(array_map('trim', explode(',', $dids)), 'strlen');
        $where = "tenant_id=$tid";
        if (is_array($pkids) && $pkids) {
            $where .= " AND id IN (".implode(',', array_map('intval', $pkids)).")";
        } elseif (is_array($dids) && $dids) {
            $esc = array_map(function($v) use ($conn){ return "'".$conn->real_escape_string((string)$v)."'"; }, $dids);
            $where .= " AND daftra_id IN (".implode(',', $esc).")";
        } else { echo json_encode(['success'=>false,'message'=>'مرّر ids (مفتاح أساسي) أو daftra_ids']); break; }
        if (in_array($fromType, ['customer','supplier','partner'])) $where .= " AND type='".$conn->real_escape_string($fromType)."'";
        $before = []; $rb = $conn->query("SELECT id,daftra_id,name,type FROM acc_parties WHERE $where");
        while ($rb && ($x=$rb->fetch_assoc())) $before[] = $x;
        $conn->query("UPDATE acc_parties SET type='$type' WHERE $where");
        $affected = $conn->affected_rows;
        $changed = []; foreach ($before as $b) $changed[] = '#'.$b['id'].' '.$b['name'].' ('.$b['type'].'→'.$type.')';
        acc_audit($conn,$tid,'reclass',null,'parties','to='.$type.' from='.$fromType.' affected='.$affected,$input_data['actor']??null);
        echo json_encode(['success'=>true,'reclassified'=>$affected,'to_type'=>$type,'details'=>$changed], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_party_delete':
        // حذف طرف غير مرتبط بحركات، وإلا تعطيله
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? $_GET['tenant'] ?? 1);
        $id  = (int)($input_data['id'] ?? $_GET['id'] ?? 0);
        if (!$id) { echo json_encode(['success'=>false,'message'=>'المعرّف مطلوب']); break; }
        $u = $conn->query("SELECT COUNT(*) c FROM acc_lines WHERE tenant_id=$tid AND party_id=$id");
        $used = $u ? (int)$u->fetch_assoc()['c'] : 0;
        if ($used > 0) { $conn->query("UPDATE acc_parties SET status=0 WHERE id=$id AND tenant_id=$tid"); echo json_encode(['success'=>true,'message'=>'تم التعطيل (مرتبط بحركات)','deactivated'=>true]); break; }
        $conn->query("DELETE FROM acc_parties WHERE id=$id AND tenant_id=$tid");
        echo json_encode(['success'=>true,'message'=>'تم الحذف']);
        break;

    case 'gl_party_ledger':
        // كشف حساب طرف (ذمم مدينة/دائنة) — رصيد افتتاحي + حركات + رصيد جارٍ
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $pid  = (int)($_GET['party_id'] ?? 0);
        $from = $conn->real_escape_string($_GET['from'] ?? '');
        $to   = $conn->real_escape_string($_GET['to'] ?? '');
        if (!$pid) { echo json_encode(['success'=>false,'message'=>'الطرف مطلوب']); break; }
        $pr = $conn->query("SELECT * FROM acc_parties WHERE id=$pid AND tenant_id=$tid LIMIT 1");
        $party = $pr ? $pr->fetch_assoc() : null;
        if (!$party) { echo json_encode(['success'=>false,'message'=>'الطرف غير موجود']); break; }
        $sign = $party['type'] === 'customer' ? 1 : -1;
        $opD = 0; $opC = 0;
        if ($from) {
            $o = $conn->query("SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE l.party_id=$pid AND l.tenant_id=$tid AND e.is_posted=1 AND e.date<'$from'");
            if ($o && ($x = $o->fetch_assoc())) { $opD = (float)$x['d']; $opC = (float)$x['c']; }
        }
        $opening = $sign * ($opD - $opC);
        $w = "l.party_id=$pid AND l.tenant_id=$tid AND e.is_posted=1";
        if ($from) $w .= " AND e.date>='$from'";
        if ($to)   $w .= " AND e.date<='$to'";
        $res = $conn->query("SELECT e.id entry_id,e.entry_no,e.date,e.description ent_desc,l.debit,l.credit,l.due_date,l.description line_desc FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE $w ORDER BY e.date,e.id,l.id");
        $rows = []; $run = $opening; $sd = 0; $sc = 0;
        while ($res && ($x = $res->fetch_assoc())) {
            $d = (float)$x['debit']; $c = (float)$x['credit'];
            $run += $sign * ($d - $c); $x['balance'] = round($run, 2); $sd += $d; $sc += $c; $rows[] = $x;
        }
        echo json_encode(['success'=>true,'party'=>$party,'opening'=>round($opening,2),'data'=>$rows,'totals'=>['debit'=>round($sd,2),'credit'=>round($sc,2),'closing'=>round($run,2)]], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_dashboard_kpis':
        // مؤشرات لوحة القيادة من محرّك المحاسبة المستقل
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $yr   = (int)date('Y');
        $from = "$yr-01-01";
        $to   = date('Y-m-d');

        // ذمم العملاء (AR)
        $arR = $conn->query("SELECT COALESCE(SUM(l.debit-l.credit),0) total
            FROM acc_lines l
            JOIN acc_entries e ON e.id=l.entry_id AND e.is_posted=1
            JOIN acc_parties p ON p.id=l.party_id AND p.tenant_id=$tid AND p.type='customer'
            WHERE l.tenant_id=$tid");
        $ar = $arR ? round((float)$arR->fetch_assoc()['total'], 2) : 0;

        // ذمم الموردين (AP)
        $apR = $conn->query("SELECT COALESCE(SUM(l.credit-l.debit),0) total
            FROM acc_lines l
            JOIN acc_entries e ON e.id=l.entry_id AND e.is_posted=1
            JOIN acc_parties p ON p.id=l.party_id AND p.tenant_id=$tid AND p.type='supplier'
            WHERE l.tenant_id=$tid");
        $ap = $apR ? round((float)$apR->fetch_assoc()['total'], 2) : 0;

        // صافي دخل السنة من قائمة الدخل
        $niR = $conn->query("SELECT a.type,
            COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$from' AND e.date<='$to'
                              AND (e.ref_type IS NULL OR e.ref_type NOT IN ('year_close'))
                              THEN l.debit ELSE 0 END),0) d,
            COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$from' AND e.date<='$to'
                              AND (e.ref_type IS NULL OR e.ref_type NOT IN ('year_close'))
                              THEN l.credit ELSE 0 END),0) c
            FROM acc_accounts a
            JOIN acc_lines l ON l.account_id=a.id
            JOIN acc_entries e ON e.id=l.entry_id
            WHERE a.tenant_id=$tid AND a.is_group=0 AND a.type IN ('revenue','expense')
            GROUP BY a.type");
        $rev=0; $exp=0;
        while ($niR && ($nx=$niR->fetch_assoc())) {
            if ($nx['type']==='revenue') $rev = round((float)$nx['c'] - (float)$nx['d'], 2);
            if ($nx['type']==='expense') $exp = round((float)$nx['d'] - (float)$nx['c'], 2);
        }

        // عدد الأطراف بذمم متأخرة +30 يوم
        $overdR = $conn->query("SELECT COUNT(*) c FROM (
            SELECT p.id,
                SUM(CASE WHEN e.date<='$to' AND DATEDIFF('$to',COALESCE(l.due_date,e.date))>30
                         THEN ABS(l.debit-l.credit) ELSE 0 END) over30
            FROM acc_parties p
            LEFT JOIN acc_lines l ON l.party_id=p.id AND l.tenant_id=p.tenant_id
            LEFT JOIN acc_entries e ON e.id=l.entry_id AND e.is_posted=1
            WHERE p.tenant_id=$tid GROUP BY p.id HAVING over30>0.01
        ) x");
        $overdue = $overdR ? (int)$overdR->fetch_assoc()['c'] : 0;

        echo json_encode([
            'success'=>true,'ar'=>$ar,'ap'=>$ap,
            'net_income_ytd'=>round($rev-$exp,2),'revenue_ytd'=>$rev,'expenses_ytd'=>$exp,
            'overdue_parties'=>$overdue,'year'=>$yr
        ], JSON_UNESCAPED_UNICODE);
        break;

    // ─── إحصائيات الداشبورد من المحرّك المحلي (لكل المستأجرين بدون Daftra) ────
    case 'native_dashboard_stats': {
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $yr   = (int)date('Y');
        $mo   = date('m');
        $monthStart = "$yr-$mo-01";
        $today      = date('Y-m-d');

        // ── إيرادات ومصروفات الشهر الحالي من قائمة الدخل ────────────────────
        $glMonthR = $conn->query("SELECT a.type,
            COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$monthStart' AND e.date<='$today'
                              THEN l.debit ELSE 0 END),0) d,
            COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$monthStart' AND e.date<='$today'
                              THEN l.credit ELSE 0 END),0) c
            FROM acc_accounts a
            JOIN acc_lines l ON l.account_id=a.id
            JOIN acc_entries e ON e.id=l.entry_id
            WHERE a.tenant_id=$tid AND a.is_group=0 AND a.type IN ('revenue','expense')
            GROUP BY a.type");
        $rev_month = 0; $exp_month = 0;
        while ($glMonthR && ($gx = $glMonthR->fetch_assoc())) {
            if ($gx['type']==='revenue') $rev_month = round((float)$gx['c']-(float)$gx['d'], 2);
            if ($gx['type']==='expense') $exp_month = round((float)$gx['d']-(float)$gx['c'], 2);
        }

        // ── فواتير هذا الشهر (من acc_invoices) ────────────────────────────────
        $invR = $conn->query("SELECT COUNT(*) c, COALESCE(SUM(total_amount),0) v
                              FROM acc_invoices
                              WHERE tenant_id=$tid AND status='posted'
                              AND issue_date>='$monthStart' AND issue_date<='$today'");
        $invRow    = $invR ? $invR->fetch_assoc() : [];
        $inv_month = (int)($invRow['c'] ?? 0);
        $inv_rev   = (float)($invRow['v'] ?? 0);

        // ── عدد العملاء والموردين ──────────────────────────────────────────────
        $partyR = $conn->query("SELECT type, COUNT(*) c FROM acc_parties
                                WHERE tenant_id=$tid AND status!='archived'
                                GROUP BY type");
        $clients=0; $suppliers=0;
        while ($partyR && ($px=$partyR->fetch_assoc())) {
            if ($px['type']==='customer') $clients   = (int)$px['c'];
            if ($px['type']==='supplier') $suppliers = (int)$px['c'];
        }

        // ── المشاريع والوحدات والملاك ─────────────────────────────────────────
        $projR  = $conn->query("SELECT COUNT(*) c FROM projects WHERE tenant_id=$tid");
        $projects = (int)($projR ? $projR->fetch_assoc()['c'] : 0);

        $unitR   = $conn->query("SELECT COUNT(*) c,
                                 SUM(CASE WHEN status='مباع' OR status='sold' THEN 1 ELSE 0 END) sold
                                 FROM units WHERE tenant_id=$tid");
        $unitRow    = $unitR ? $unitR->fetch_assoc() : [];
        $units      = (int)($unitRow['c'] ?? 0);
        $units_sold = (int)($unitRow['sold'] ?? 0);

        $ownersR  = $conn->query("SELECT COUNT(*) c FROM owners WHERE tenant_id=$tid");
        $owners   = (int)($ownersR ? $ownersR->fetch_assoc()['c'] : 0);

        // عدد المستخدمين (للخطوات الإعدادية)
        $usersR  = $conn->query("SELECT COUNT(*) c FROM users WHERE tenant_id=$tid AND status=1");
        $ucount  = (int)($usersR ? $usersR->fetch_assoc()['c'] : 0);

        // هل الإعدادات مكتملة؟ (اسم الشركة، شعار، رقم ضريبي)
        $settR = $conn->query("SELECT skey,sval FROM acc_settings WHERE tenant_id=$tid AND skey IN ('company_name','vat_number','company_logo','cr_number')");
        $settings = [];
        while ($settR && ($sr=$settR->fetch_assoc())) { $settings[$sr['skey']] = $sr['sval']; }
        $has_logo    = !empty($settings['company_logo']);
        $has_vat     = !empty($settings['vat_number']);
        $has_cr      = !empty($settings['cr_number']);
        $onboarding  = [
            'logo'    => $has_logo,
            'vat'     => $has_vat,
            'cr'      => $has_cr,
            'project' => $projects > 0,
            'team'    => $ucount > 1,
        ];

        // ── اتجاه آخر 6 أشهر (إيرادات + مصروفات من GL) ──────────────────────
        $AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        $trend = [];
        for ($i=5; $i>=0; $i--) {
            $ts  = strtotime("first day of -$i month");
            $ms  = date('Y-m-01', $ts);
            $me  = date('Y-m-t',  $ts);
            $mon = $AR_MONTHS[(int)date('n',$ts)-1];
            $key = date('Y-m', $ts);
            $gTrend = $conn->query("SELECT a.type,
                COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$ms' AND e.date<='$me'
                                  THEN l.debit ELSE 0 END),0) d,
                COALESCE(SUM(CASE WHEN e.is_posted=1 AND e.date>='$ms' AND e.date<='$me'
                                  THEN l.credit ELSE 0 END),0) c
                FROM acc_accounts a
                JOIN acc_lines l ON l.account_id=a.id
                JOIN acc_entries e ON e.id=l.entry_id
                WHERE a.tenant_id=$tid AND a.is_group=0 AND a.type IN ('revenue','expense')
                GROUP BY a.type");
            $mr=0; $me2=0;
            while ($gTrend && ($gt=$gTrend->fetch_assoc())) {
                if ($gt['type']==='revenue') $mr  = round((float)$gt['c']-(float)$gt['d'],2);
                if ($gt['type']==='expense') $me2 = round((float)$gt['d']-(float)$gt['c'],2);
            }
            $trend[] = ['key'=>$key,'label'=>$mon,'revenue'=>$mr,'expenses'=>$me2];
        }

        // ── آخر 5 فواتير ─────────────────────────────────────────────────────
        $recentR = $conn->query("SELECT i.id,i.invoice_number,i.issue_date,i.total_amount,i.status,
                                        p.name party_name
                                 FROM acc_invoices i
                                 LEFT JOIN acc_parties p ON p.id=i.party_id
                                 WHERE i.tenant_id=$tid AND i.status='posted'
                                 ORDER BY i.id DESC LIMIT 5");
        $recent = [];
        while ($recentR && ($rr=$recentR->fetch_assoc())) { $recent[] = $rr; }

        echo json_encode([
            'success'    => true,
            'rev_month'  => $rev_month  ?: $inv_rev,   // GL أو فواتير إن لم يكن GL
            'exp_month'  => $exp_month,
            'inv_month'  => $inv_month,
            'clients'    => $clients,
            'suppliers'  => $suppliers,
            'projects'   => $projects,
            'units'      => $units,
            'units_sold' => $units_sold,
            'owners'     => $owners,
            'user_count' => $ucount,
            'onboarding' => $onboarding,
            'trend'      => $trend,
            'recent_inv' => $recent,
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_aging':
        // أعمار الذمم 30/60/90 حسب تاريخ الاستحقاق (أو تاريخ القيد)
        $tid   = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $ptype = $conn->real_escape_string($_GET['party_type'] ?? 'customer');
        if (!in_array($ptype, ['customer','supplier'])) $ptype = 'customer';
        $asof  = $conn->real_escape_string($_GET['as_of'] ?? date('Y-m-d'));
        $sign  = $ptype === 'customer' ? 1 : -1;
        // يشمل فقط القيود المُرحَّلة حتى تاريخ as_of — فلتر is_posted=1 في الجوين، وفلتر التاريخ في CASE
        $sql = "SELECT p.id,p.name,
                  COALESCE(SUM(CASE WHEN e.date<='$asof' AND DATEDIFF('$asof', COALESCE(l.due_date,e.date))<=0         THEN (l.debit-l.credit) ELSE 0 END),0) b_cur,
                  COALESCE(SUM(CASE WHEN e.date<='$asof' AND DATEDIFF('$asof', COALESCE(l.due_date,e.date)) BETWEEN 1  AND 30  THEN (l.debit-l.credit) ELSE 0 END),0) b30,
                  COALESCE(SUM(CASE WHEN e.date<='$asof' AND DATEDIFF('$asof', COALESCE(l.due_date,e.date)) BETWEEN 31 AND 60  THEN (l.debit-l.credit) ELSE 0 END),0) b60,
                  COALESCE(SUM(CASE WHEN e.date<='$asof' AND DATEDIFF('$asof', COALESCE(l.due_date,e.date)) BETWEEN 61 AND 90  THEN (l.debit-l.credit) ELSE 0 END),0) b90,
                  COALESCE(SUM(CASE WHEN e.date<='$asof' AND DATEDIFF('$asof', COALESCE(l.due_date,e.date))>90               THEN (l.debit-l.credit) ELSE 0 END),0) b90p,
                  COALESCE(SUM(CASE WHEN e.date<='$asof' THEN (l.debit-l.credit) ELSE 0 END),0) net
                FROM acc_parties p
                LEFT JOIN acc_lines l ON l.party_id=p.id AND l.party_type=p.type AND l.tenant_id=p.tenant_id
                LEFT JOIN acc_entries e ON e.id=l.entry_id AND e.is_posted=1
                WHERE p.tenant_id=$tid AND p.type='$ptype'
                GROUP BY p.id HAVING ABS(net)>0.001 ORDER BY p.name";
        $res = $conn->query($sql); $rows = []; $tot = ['current'=>0,'d30'=>0,'d60'=>0,'d90'=>0,'d90p'=>0,'total'=>0];
        while ($res && ($x = $res->fetch_assoc())) {
            $row = [
                'id'=>$x['id'],'name'=>$x['name'],
                'current'=>round($sign*(float)$x['b_cur'],2),
                'd30'=>round($sign*(float)$x['b30'],2),
                'd60'=>round($sign*(float)$x['b60'],2),
                'd90'=>round($sign*(float)$x['b90'],2),
                'd90p'=>round($sign*(float)$x['b90p'],2),
                'total'=>round($sign*(float)$x['net'],2),
            ];
            $tot['current']+=$row['current']; $tot['d30']+=$row['d30']; $tot['d60']+=$row['d60'];
            $tot['d90']+=$row['d90']; $tot['d90p']+=$row['d90p']; $tot['total']+=$row['total'];
            $rows[] = $row;
        }
        foreach ($tot as $k=>$v) $tot[$k] = round($v, 2);
        echo json_encode(['success'=>true,'party_type'=>$ptype,'as_of'=>$asof,'data'=>$rows,'totals'=>$tot], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_cost_centers':
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $res = $conn->query("SELECT * FROM acc_cost_centers WHERE tenant_id=$tid ORDER BY code,name");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_cc_report':
        // تقرير الأرباح والخسائر حسب مراكز التكلفة
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $from = $conn->real_escape_string($_GET['from'] ?? date('Y').'-01-01');
        $to   = $conn->real_escape_string($_GET['to']   ?? date('Y-m-d'));
        $sql = "SELECT cc.id, cc.code, cc.name,
                   COALESCE(SUM(CASE WHEN a.type='revenue'  AND e.is_posted=1 THEN l.credit-l.debit ELSE 0 END),0) AS revenue,
                   COALESCE(SUM(CASE WHEN a.type='expense'  AND e.is_posted=1 THEN l.debit-l.credit ELSE 0 END),0) AS expense
                FROM acc_cost_centers cc
                LEFT JOIN acc_lines   l  ON l.cost_center_id=cc.id AND l.tenant_id=cc.tenant_id
                LEFT JOIN acc_entries e  ON e.id=l.entry_id AND e.date>='$from' AND e.date<='$to'
                LEFT JOIN acc_accounts a ON a.id=l.account_id
                WHERE cc.tenant_id=$tid
                GROUP BY cc.id, cc.code, cc.name
                ORDER BY cc.code, cc.name";
        $res = $conn->query($sql); $rows = [];
        $totalRev = 0; $totalExp = 0;
        while ($res && ($x = $res->fetch_assoc())) {
            $x['revenue'] = round((float)$x['revenue'], 2);
            $x['expense'] = round((float)$x['expense'], 2);
            $x['net']     = round($x['revenue'] - $x['expense'], 2);
            $totalRev += $x['revenue']; $totalExp += $x['expense'];
            $rows[] = $x;
        }
        echo json_encode(['success'=>true,'data'=>$rows,'from'=>$from,'to'=>$to,
            'totals'=>['revenue'=>round($totalRev,2),'expense'=>round($totalExp,2),'net'=>round($totalRev-$totalExp,2)]], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_cost_center_save':
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $code = $conn->real_escape_string(trim($input_data['code'] ?? ''));
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $pid  = isset($input_data['parent_id']) && $input_data['parent_id'] !== '' ? (int)$input_data['parent_id'] : 'NULL';
        if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
        if ($id) {
            $conn->query("UPDATE acc_cost_centers SET code='$code',name='$name',parent_id=$pid WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>true,'id'=>$id]);
        } else {
            $ok = $conn->query("INSERT INTO acc_cost_centers (tenant_id,code,name,parent_id) VALUES ($tid,'$code','$name',$pid)");
            echo json_encode(['success'=>(bool)$ok,'id'=>$conn->insert_id,'message'=>$ok?'تم':$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;

    // ═══════════════════════════════════════════════════════════════════════
    // قيد المطور العقاري (الهيئة العامة للعقار) — حالة أداة المتابعة
    // تُخزَّن كامل حالة الأداة كـ JSON blob واحد لكل tenant في
    // acc_settings['rega_dev_tracker'] (عمود sval نوعه TEXT ≈ 64KB يكفي).
    // ═══════════════════════════════════════════════════════════════════════
    case 'rega_tracker_get': {
        // يتطلب جلسة موظف صالحة
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid = $_jwt_tid ?? 1;
        $raw = acc_setting($conn, $tid, 'rega_dev_tracker', '');
        $data = null;
        if ($raw !== '' && $raw !== null) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) $data = $decoded;
        }
        echo json_encode(['success'=>true, 'data'=>$data], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'rega_tracker_save': {
        // يتطلب جلسة موظف صالحة — يحفظ كامل الحالة المرسلة في المفتاح data
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid     = $_jwt_tid ?? 1;
        $payload = $input_data['data'] ?? null;
        if (!is_array($payload)) { echo json_encode(['success'=>false,'message'=>'بيانات غير صالحة'], JSON_UNESCAPED_UNICODE); break; }
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if (strlen($json) > 60000) { echo json_encode(['success'=>false,'message'=>'حجم البيانات كبير جداً'], JSON_UNESCAPED_UNICODE); break; }
        $vv = $conn->real_escape_string($json);
        $ok = $conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES ($tid,'rega_dev_tracker','$vv')
                            ON DUPLICATE KEY UPDATE sval=VALUES(sval)");
        echo json_encode(['success'=>(bool)$ok, 'message'=>$ok?'تم الحفظ':$conn->error], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // التمتير وتقدير تكلفة التنفيذ — عدة كشوف لكل tenant
    // كل كشف JSON blob في acc_settings['qs_survey_{id}'] + فهرس في 'qs_index'
    // ═══════════════════════════════════════════════════════════════════════
    case 'qs_list': {
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid = $_jwt_tid ?? 1;
        $raw = acc_setting($conn, $tid, 'qs_index', '');
        $idx = ($raw !== '' && $raw !== null) ? json_decode($raw, true) : [];
        echo json_encode(['success'=>true, 'surveys'=>is_array($idx) ? $idx : []], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'qs_get': {
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid = $_jwt_tid ?? 1;
        $sid = preg_replace('/[^a-z0-9_-]/i', '', (string)($_GET['id'] ?? $input_data['id'] ?? ''));
        if ($sid === '') { echo json_encode(['success'=>false,'message'=>'معرّف مفقود'], JSON_UNESCAPED_UNICODE); break; }
        $raw = acc_setting($conn, $tid, 'qs_survey_' . $sid, '');
        $data = ($raw !== '' && $raw !== null) ? json_decode($raw, true) : null;
        echo json_encode(['success'=>true, 'data'=>is_array($data) ? $data : null], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'qs_save': {
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid = $_jwt_tid ?? 1;
        $sid = preg_replace('/[^a-z0-9_-]/i', '', (string)($input_data['id'] ?? ''));
        $payload = $input_data['data'] ?? null;
        if ($sid === '' || !is_array($payload)) { echo json_encode(['success'=>false,'message'=>'بيانات غير صالحة'], JSON_UNESCAPED_UNICODE); break; }
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if (strlen($json) > 60000) { echo json_encode(['success'=>false,'message'=>'حجم الكشف كبير جداً — قسّمه إلى كشفين'], JSON_UNESCAPED_UNICODE); break; }
        $vv = $conn->real_escape_string($json);
        $ok = $conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES ($tid,'qs_survey_$sid','$vv')
                            ON DUPLICATE KEY UPDATE sval=VALUES(sval)");
        // تحديث الفهرس
        $raw = acc_setting($conn, $tid, 'qs_index', '');
        $idx = ($raw !== '' && $raw !== null) ? json_decode($raw, true) : [];
        if (!is_array($idx)) $idx = [];
        $entry = [
            'id'      => $sid,
            'name'    => mb_substr((string)($payload['name'] ?? 'كشف تمتير'), 0, 120),
            'total'   => (float)($input_data['total'] ?? 0),
            'updated' => date('Y-m-d H:i'),
        ];
        $found = false;
        foreach ($idx as $k => $e) { if (($e['id'] ?? '') === $sid) { $idx[$k] = $entry; $found = true; break; } }
        if (!$found) $idx[] = $entry;
        $iv = $conn->real_escape_string(json_encode($idx, JSON_UNESCAPED_UNICODE));
        $conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES ($tid,'qs_index','$iv')
                      ON DUPLICATE KEY UPDATE sval=VALUES(sval)");
        echo json_encode(['success'=>(bool)$ok, 'message'=>$ok?'تم الحفظ':$conn->error], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'qs_delete': {
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid = $_jwt_tid ?? 1;
        $sid = preg_replace('/[^a-z0-9_-]/i', '', (string)($input_data['id'] ?? ''));
        if ($sid === '') { echo json_encode(['success'=>false,'message'=>'معرّف مفقود'], JSON_UNESCAPED_UNICODE); break; }
        $conn->query("DELETE FROM acc_settings WHERE tenant_id=$tid AND skey='qs_survey_$sid'");
        $raw = acc_setting($conn, $tid, 'qs_index', '');
        $idx = ($raw !== '' && $raw !== null) ? json_decode($raw, true) : [];
        if (is_array($idx)) {
            $idx = array_values(array_filter($idx, fn($e) => ($e['id'] ?? '') !== $sid));
            $iv = $conn->real_escape_string(json_encode($idx, JSON_UNESCAPED_UNICODE));
            $conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES ($tid,'qs_index','$iv')
                          ON DUPLICATE KEY UPDATE sval=VALUES(sval)");
        }
        echo json_encode(['success'=>true, 'message'=>'تم الحذف'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'qs_extract_drawing': {
        // استخراج الفراغات وأبعادها من مخطط معماري (صورة أو PDF) عبر Claude vision
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $cad   = (string)($input_data['cad'] ?? '');
        $b64   = (string)($input_data['file'] ?? '');
        $mtype = (string)($input_data['media_type'] ?? 'image/png');

        if ($cad !== '') {
            // بيانات CAD مستخرجة من DWG في المتصفح (نصوص + ديمنشنات بإحداثياتها)
            if (strlen($cad) > 400000) { echo json_encode(['success'=>false,'message'=>'بيانات المخطط كبيرة جداً'], JSON_UNESCAPED_UNICODE); break; }
            $prompt = "هذه بيانات مستخرجة من ملف AutoCAD DWG لمخطط معماري: قائمة نصوص (t) وقائمة قياسات ديمنشن (m) مع إحداثيات كل عنصر (x,y) بوحدات الرسم.\n"
                    . "مهمتك: استخرج قائمة الفراغات (الغرف) مع أبعادها بالمتر.\n"
                    . "- بعض النصوص العربية مخزّنة بترميز خطوط AutoCAD القديمة فتظهر كحروف لاتينية مشوّهة (مثل: Hglf__k = المطبخ، Hg,H{m = الواجهة). فُكّ هذا الترميز إلى العربية الصحيحة.\n"
                    . "- اربط اسم كل غرفة بأقرب قياسات إليها إحداثياتياً (الطول والعرض عادة أقرب ديمنشنين متعامدين حول النص).\n"
                    . "- إذا كانت وحدات الرسم سنتيمتر أو مليمتر (قياسات مثل 520 أو 5200 لغرفة) حوّلها للمتر. أبعاد الغرف المنطقية بين 1 و 15 متراً.\n"
                    . "- تجاهل نصوص العناوين والأكواد والأرقام التسلسلية — خذ أسماء الفراغات فقط (مجلس، صالة، مطبخ، غرفة نوم، حمام، مدخل، غسيل، خادمة، مستودع، ملحق، درج، ممر...).\n"
                    . "- إذا تكرر نفس الفراغ في أكثر من شقة/دور اذكره مرة واحدة لكل موضع مختلف الأبعاد.\n"
                    . "أرجع JSON فقط بلا أي نص آخر بهذا الشكل بالضبط:\n"
                    . '{"rooms":[{"name":"المجلس","L":5.2,"W":3.5,"H":""}]}' . "\n\nالبيانات:\n" . $cad;
            $content = [['type'=>'text','text'=>$prompt]];
        } else {
            $allowed = ['image/png','image/jpeg','image/webp','image/gif','application/pdf'];
            // ملف واحد أو عدة صور (لوحات DWG المرسومة في المتصفح)
            $files = [];
            if (is_array($input_data['files'] ?? null)) {
                foreach ($input_data['files'] as $f) {
                    if (!is_array($f)) continue;
                    $fd = (string)($f['data'] ?? ''); $fm = (string)($f['media_type'] ?? 'image/png');
                    if ($fd !== '' && in_array($fm, $allowed, true)) $files[] = ['data'=>$fd,'media_type'=>$fm];
                    if (count($files) >= 6) break;
                }
            } elseif ($b64 !== '' && in_array($mtype, $allowed, true)) {
                $files[] = ['data'=>$b64,'media_type'=>$mtype];
            }
            if (!$files) { echo json_encode(['success'=>false,'message'=>'ملف غير صالح — ارفع صورة أو PDF أو DWG'], JSON_UNESCAPED_UNICODE); break; }
            $totalLen = 0; foreach ($files as $f) $totalLen += strlen($f['data']);
            if ($totalLen > 16000000) { echo json_encode(['success'=>false,'message'=>'حجم الملفات كبير جداً'], JSON_UNESCAPED_UNICODE); break; }

            $content = [];
            foreach ($files as $f) {
                $content[] = $f['media_type'] === 'application/pdf'
                    ? ['type'=>'document', 'source'=>['type'=>'base64','media_type'=>'application/pdf','data'=>$f['data']]]
                    : ['type'=>'image',    'source'=>['type'=>'base64','media_type'=>$f['media_type'],'data'=>$f['data']]];
            }
            $multi = count($files) > 1 ? "المرفق عدة لوحات لنفس المشروع (أدوار مختلفة عادة). استخرج فراغات كل اللوحات، وميّز الأدوار في الاسم إن أمكن (مثل: مطبخ - الدور الأول).\n" : '';
            $prompt = "هذا مخطط معماري. استخرج جميع الفراغات (الغرف والمساحات) الظاهرة فيه مع أبعادها بالمتر.\n"
                    . $multi
                    . "- اقرأ الأبعاد المكتوبة على المخطط (مثل 5.20 × 3.50 وقد تكون بأرقام عربية ٣٫٨٠). إذا كان البعد بالسنتيمتر أو المليمتر حوّله للمتر.\n"
                    . "- أسماء الفراغات بالعربية كما هي في المخطط (المجلس، الصالة، المطبخ، غرفة نوم، حمام، مدخل...).\n"
                    . "- إذا لم يُكتب البعد بجوار الغرفة قدّره من مقياس الرسم مقارنة بغرف معلومة الأبعاد.\n"
                    . "- إذا وُجد ارتفاع السقف مكتوباً أضفه في H وإلا اتركه فارغاً.\n"
                    . "أرجع JSON فقط بلا أي نص آخر بهذا الشكل بالضبط:\n"
                    . '{"rooms":[{"name":"المجلس","L":5.2,"W":3.5,"H":""}]}';
            $content[] = ['type'=>'text','text'=>$prompt];
        }

        $qs_log = __DIR__ . '/qs_extract_log.txt';
        $models = ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-haiku-4-5'];
        $txt = ''; $apiErr = ''; $http = 0;
        foreach ($models as $mdl) {
            $body = [
                'model' => $mdl,
                'max_tokens' => 8000,
                'messages' => [[ 'role' => 'user', 'content' => $content ]],
            ];
            $ch = curl_init('https://api.anthropic.com/v1/messages');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($body),
                CURLOPT_HTTPHEADER => ['Content-Type: application/json','x-api-key: __ANTHROPIC_KEY__','anthropic-version: 2023-06-01'],
                CURLOPT_TIMEOUT => 120,
            ]);
            $res  = curl_exec($ch);
            $cerr = curl_error($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($cerr) { $apiErr = 'اتصال: ' . $cerr; @file_put_contents($qs_log, date('c') . " | $mdl | CURL: $cerr\n", FILE_APPEND); continue; }
            $j = json_decode($res, true);
            $apiErr = $j['error']['message'] ?? '';
            // اجمع كل بلوكات النص — نماذج Claude 5 قد تُرجع بلوك تفكير قبل النص
            $txt = ''; $btypes = [];
            foreach (($j['content'] ?? []) as $blk) {
                $btypes[] = $blk['type'] ?? '?';
                if (($blk['type'] ?? '') === 'text') $txt .= $blk['text'] ?? '';
            }
            @file_put_contents($qs_log, date('c') . " | $mdl | HTTP $http | stop=" . ($j['stop_reason'] ?? '?') . " | blocks=" . implode(',', $btypes) . " | err=" . mb_substr($apiErr, 0, 150) . " | txt_len=" . strlen($txt) . "\n", FILE_APPEND);
            if ($txt !== '') break;              // نجح
            continue;                             // فاضي أو خطأ — جرّب النموذج التالي
        }
        // التقاط الـ JSON من الرد — من أول { إلى آخر } (يتجاوز أسوار ```json والنصوص المحيطة)
        $rooms = null;
        $jStart = strpos($txt, '{');
        $jEnd   = strrpos($txt, '}');
        if ($jStart !== false && $jEnd !== false && $jEnd > $jStart) {
            $frag = substr($txt, $jStart, $jEnd - $jStart + 1);
            $parsed = json_decode($frag, true);
            if (!is_array($parsed) && preg_match('/^(.*\})\s*,?\s*[^\}]*$/s', $frag, $mm)) {
                // رد مبتور — قصّه لآخر كائن مكتمل وأغلق المصفوفة
                $try = preg_replace('/,\s*\{[^\}]*$/s', '', $frag);
                $try = rtrim($try, " \t\n\r,");
                if (substr_count($try, '[') > substr_count($try, ']')) $try .= ']';
                if (substr_count($try, '{') > substr_count($try, '}')) $try .= '}';
                $parsed = json_decode($try, true);
            }
            if (is_array($parsed) && isset($parsed['rooms']) && is_array($parsed['rooms'])) $rooms = $parsed['rooms'];
        }
        if ($rooms === null) {
            @file_put_contents($qs_log, date('c') . " | PARSE FAIL | " . mb_substr($txt, 0, 400) . "\n", FILE_APPEND);
            echo json_encode(['success'=>false,'message'=>'تعذر قراءة المخطط' . ($apiErr ? ' — ' . $apiErr : ($http && $http !== 200 ? " (HTTP $http)" : '')), 'raw'=>mb_substr($txt, 0, 300)], JSON_UNESCAPED_UNICODE);
            break;
        }
        // تنظيف وتحديد الحقول
        $clean = [];
        foreach ($rooms as $r) {
            if (!is_array($r)) continue;
            $clean[] = [
                'name' => mb_substr(trim((string)($r['name'] ?? '')), 0, 60),
                'L' => is_numeric($r['L'] ?? null) ? (float)$r['L'] : '',
                'W' => is_numeric($r['W'] ?? null) ? (float)$r['W'] : '',
                'H' => is_numeric($r['H'] ?? null) ? (float)$r['H'] : '',
            ];
            if (count($clean) >= 80) break;
        }
        echo json_encode(['success'=>true, 'rooms'=>$clean], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_settings_get':
        // ملف الشركة (يُستخدم في QR والطباعة) — يعيد المفاتيح المعروفة مع قيم افتراضية فارغة
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $keys = ['company_name','vat_number','cr_number','address','city','district','postal_code','building_no','phone','email','logo_url','primary_color','company_phone','company_email','company_address','company_logo'];
        $out = [];
        foreach ($keys as $k) $out[$k] = acc_setting($conn, $tid, $k, '');
        echo json_encode(['success'=>true,'settings'=>$out], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_settings_save':
        // حفظ/تحديث ملف الشركة — يقبل كائن settings بمفاتيح مسموح بها فقط
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $by  = $input_data['actor'] ?? null;
        $allowed = ['company_name','vat_number','cr_number','address','city','district','postal_code',
                    'building_no','phone','email','logo_url','primary_color','company_phone','company_email',
                    'company_address','company_logo'];
        $set = is_array($input_data['settings'] ?? null) ? $input_data['settings'] : [];
        $n = 0;
        foreach ($set as $k => $v) {
            if (!in_array($k, $allowed, true)) continue;
            $kk = $conn->real_escape_string($k);
            $vv = $conn->real_escape_string((string)$v);
            if (!$conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES ($tid,'$kk','$vv')
                               ON DUPLICATE KEY UPDATE sval=VALUES(sval)")) { echo json_encode(['success'=>false,'message'=>$conn->error]); break 2; }
            $n++;
        }
        // مزامنة primary_color مع جدول tenants أيضاً (لاستخدامه في tenant_branding)
        if (isset($set['primary_color']) && $set['primary_color']) {
            $pc = $conn->real_escape_string($set['primary_color']);
            $conn->query("UPDATE tenants SET primary_color='$pc' WHERE id=$tid");
        }
        // مزامنة company_name مع جدول tenants أيضاً
        if (isset($set['company_name']) && $set['company_name']) {
            $cn = $conn->real_escape_string($set['company_name']);
            $conn->query("UPDATE tenants SET name='$cn' WHERE id=$tid");
        }
        acc_audit($conn, $tid, 'settings', null, 'save', "saved $n keys", $by);
        echo json_encode(['success'=>true,'saved'=>$n,'message'=>'تم حفظ إعدادات المنشأة'], JSON_UNESCAPED_UNICODE);
        break;

    case 'upload_logo': {
        // رفع شعار المنشأة — multipart/form-data, حقل اسمه "logo"
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يجب تسجيل الدخول أولاً'], JSON_UNESCAPED_UNICODE); break; }
        $tid = $_jwt_tid ?? 1;
        if (empty($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(['success'=>false,'message'=>'لم يتم استلام الملف — تأكد من إرساله بشكل صحيح'], JSON_UNESCAPED_UNICODE); break;
        }
        $file = $_FILES['logo'];
        if ($file['size'] > 2 * 1024 * 1024) {
            echo json_encode(['success'=>false,'message'=>'حجم الملف يتجاوز الحد المسموح (2 ميجابايت)'], JSON_UNESCAPED_UNICODE); break;
        }
        // التحقق من النوع الفعلي (ليس الامتداد فقط)
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        $extMap = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif'];
        if (!isset($extMap[$mime])) {
            echo json_encode(['success'=>false,'message'=>'نوع الملف غير مدعوم — JPG/PNG/WebP/GIF فقط'], JSON_UNESCAPED_UNICODE); break;
        }
        $ext  = $extMap[$mime];
        $dir  = __DIR__ . '/uploads/logos/';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            echo json_encode(['success'=>false,'message'=>'تعذّر إنشاء مجلد الرفع على الخادم'], JSON_UNESCAPED_UNICODE); break;
        }
        // حذف الشعارات القديمة لنفس المستأجر
        foreach (glob($dir . "logo_{$tid}.*") as $old) { @unlink($old); }
        $filename = "logo_{$tid}.{$ext}";
        if (!move_uploaded_file($file['tmp_name'], $dir . $filename)) {
            echo json_encode(['success'=>false,'message'=>'فشل حفظ الملف على الخادم'], JSON_UNESCAPED_UNICODE); break;
        }
        $logoUrl = '/uploads/logos/' . $filename;
        $urlEsc  = $conn->real_escape_string($logoUrl);
        $conn->query("INSERT INTO acc_settings (tenant_id,skey,sval) VALUES ($tid,'company_logo','$urlEsc') ON DUPLICATE KEY UPDATE sval='$urlEsc'");
        $conn->query("UPDATE tenants SET logo_url='$urlEsc' WHERE id=$tid");
        acc_audit($conn, $tid, 'settings', null, 'logo_upload', $filename, 'admin', $_clientIp, $_clientUa);
        echo json_encode(['success'=>true,'logo_url'=>$logoUrl,'message'=>'تم رفع الشعار بنجاح'], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'tenant_usage': {
        // استخدام المستأجر الحالي — عدد المستخدمين، الفواتير، حدود الباقة
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يجب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid = $_jwt_tid ?? 1;
        // جلب بيانات الباقة والحدود من tenants
        $planLimits = [
            'trial'      => ['max_users'=>3,  'max_invoices_month'=>50],
            'starter'    => ['max_users'=>5,  'max_invoices_month'=>500],
            'pro'        => ['max_users'=>15, 'max_invoices_month'=>-1],
            'enterprise' => ['max_users'=>-1, 'max_invoices_month'=>-1],
        ];
        $tq = $conn->query("SELECT plan,max_users FROM tenants WHERE id=$tid LIMIT 1");
        $tr = $tq ? $tq->fetch_assoc() : null;
        $plan2   = $tr['plan'] ?? 'trial';
        $limits  = $planLimits[$plan2] ?? $planLimits['trial'];
        if (($tr['max_users'] ?? 0) > 0) $limits['max_users'] = (int)$tr['max_users'];
        // عدد المستخدمين الحاليين
        $uRes = $conn->query("SELECT COUNT(*) AS cnt FROM users WHERE tenant_id=$tid");
        $uCnt = (int)($uRes->fetch_assoc()['cnt'] ?? 0);
        // فواتير هذا الشهر
        $monthStart = date('Y-m-01');
        $iRes = $conn->query("SELECT COUNT(*) AS cnt FROM acc_invoices WHERE tenant_id=$tid AND issue_date >= '$monthStart'");
        $iCnt = (int)($iRes->fetch_assoc()['cnt'] ?? 0);
        // التحقق من الرقم الضريبي
        $vnRes = $conn->query("SELECT sval FROM acc_settings WHERE tenant_id=$tid AND skey='vat_number' LIMIT 1");
        $vn    = $vnRes ? ($vnRes->fetch_assoc()['sval'] ?? '') : '';
        $vatOk = preg_match('/^\d{15}$/', $vn) ? 1 : 0;
        echo json_encode([
            'success'             => true,
            'plan'                => $plan2,
            'users'               => $uCnt,
            'max_users'           => $limits['max_users'],
            'invoices_month'      => $iCnt,
            'max_invoices_month'  => $limits['max_invoices_month'],
            'vat_verified'        => $vatOk,
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'delete_logo': {
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يجب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $tid = $_jwt_tid ?? 1;
        $dir = __DIR__ . '/uploads/logos/';
        foreach (glob($dir . "logo_{$tid}.*") as $old) { @unlink($old); }
        $conn->query("DELETE FROM acc_settings WHERE tenant_id=$tid AND skey='company_logo'");
        $conn->query("UPDATE tenants SET logo_url=NULL WHERE id=$tid");
        echo json_encode(['success'=>true,'message'=>'تم حذف الشعار'], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ─── نظام الوسوم (Tags) — قابلة للإنشاء/التلوين/الربط/الفلترة (نمط دفترة) ───────────
    case 'acc_tags_list':
        // كل الوسوم مع عدد مرّات الاستخدام (اختياري: فلترة بنوع كيان معيّن usage_entity)
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $ue  = isset($_GET['usage_entity']) ? $conn->real_escape_string(trim($_GET['usage_entity'])) : '';
        $cntJoin = "LEFT JOIN acc_tag_links l ON l.tag_id=t.id AND l.tenant_id=t.tenant_id";
        if ($ue !== '') $cntJoin .= " AND l.entity='$ue'";
        $res = $conn->query("SELECT t.id, t.name, t.color, COUNT(l.id) AS usage_count
                             FROM acc_tags t $cntJoin
                             WHERE t.tenant_id=$tid
                             GROUP BY t.id, t.name, t.color
                             ORDER BY t.name");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) { $x['id']=(int)$x['id']; $x['usage_count']=(int)$x['usage_count']; $rows[]=$x; }
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'acc_tag_save':
        // إنشاء/تعديل وسم (upsert على الاسم) — يعيد المعرّف
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $color= $conn->real_escape_string(trim($input_data['color'] ?? 'slate'));
        $id   = (int)($input_data['id'] ?? 0);
        if ($name === '') { echo json_encode(['success'=>false,'message'=>'اسم الوسم مطلوب']); break; }
        if ($color === '') $color = 'slate';
        if ($id) {
            $ok = $conn->query("UPDATE acc_tags SET name='$name', color='$color' WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>(bool)$ok,'id'=>$id,'message'=>$ok?'تم':$conn->error], JSON_UNESCAPED_UNICODE);
        } else {
            $ok = $conn->query("INSERT INTO acc_tags (tenant_id,name,color) VALUES ($tid,'$name','$color')
                                ON DUPLICATE KEY UPDATE color=VALUES(color), id=LAST_INSERT_ID(id)");
            echo json_encode(['success'=>(bool)$ok,'id'=>$conn->insert_id,'message'=>$ok?'تم':$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'acc_tag_delete':
        // حذف وسم وكل روابطه
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        if (!$id) { echo json_encode(['success'=>false,'message'=>'معرّف غير صالح']); break; }
        $conn->query("DELETE FROM acc_tag_links WHERE tag_id=$id AND tenant_id=$tid");
        $ok = $conn->query("DELETE FROM acc_tags WHERE id=$id AND tenant_id=$tid");
        echo json_encode(['success'=>(bool)$ok,'message'=>$ok?'تم الحذف':$conn->error], JSON_UNESCAPED_UNICODE);
        break;

    case 'acc_tag_set':
        // استبدال مجموعة الوسوم كاملةً لكيان واحد {entity, entity_id, tag_ids[]}
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $ent = $conn->real_escape_string(trim($input_data['entity'] ?? ''));
        $eid = (int)($input_data['entity_id'] ?? 0);
        $ids = is_array($input_data['tag_ids'] ?? null) ? $input_data['tag_ids'] : [];
        if ($ent === '' || !$eid) { echo json_encode(['success'=>false,'message'=>'الكيان ومعرّفه مطلوبان']); break; }
        $conn->query("DELETE FROM acc_tag_links WHERE tenant_id=$tid AND entity='$ent' AND entity_id=$eid");
        $n = 0;
        foreach ($ids as $tagId) {
            $tagId = (int)$tagId; if (!$tagId) continue;
            if ($conn->query("INSERT IGNORE INTO acc_tag_links (tenant_id,tag_id,entity,entity_id)
                              VALUES ($tid,$tagId,'$ent',$eid)")) $n++;
        }
        echo json_encode(['success'=>true,'count'=>$n,'message'=>'تم تحديث الوسوم'], JSON_UNESCAPED_UNICODE);
        break;

    case 'acc_tags_for':
        // وسوم كيان واحد (entity+entity_id) أو خريطة جماعية لنوع كيان (entity فقط → {entity_id:[tags]})
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $ent = isset($_GET['entity']) ? $conn->real_escape_string(trim($_GET['entity'])) : '';
        $eid = (int)($_GET['entity_id'] ?? 0);
        if ($ent === '') { echo json_encode(['success'=>false,'message'=>'الكيان مطلوب']); break; }
        if ($eid) {
            $res = $conn->query("SELECT t.id, t.name, t.color
                                 FROM acc_tag_links l JOIN acc_tags t ON t.id=l.tag_id AND t.tenant_id=l.tenant_id
                                 WHERE l.tenant_id=$tid AND l.entity='$ent' AND l.entity_id=$eid
                                 ORDER BY t.name");
            $rows = []; while ($res && ($x = $res->fetch_assoc())) { $x['id']=(int)$x['id']; $rows[]=$x; }
            echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        } else {
            $res = $conn->query("SELECT l.entity_id, t.id, t.name, t.color
                                 FROM acc_tag_links l JOIN acc_tags t ON t.id=l.tag_id AND t.tenant_id=l.tenant_id
                                 WHERE l.tenant_id=$tid AND l.entity='$ent'
                                 ORDER BY l.entity_id, t.name");
            $map = [];
            while ($res && ($x = $res->fetch_assoc())) {
                $k = (int)$x['entity_id'];
                if (!isset($map[$k])) $map[$k] = [];
                $map[$k][] = ['id'=>(int)$x['id'],'name'=>$x['name'],'color'=>$x['color']];
            }
            echo json_encode(['success'=>true,'map'=>(object)$map], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'zatca_selftest':
        // فحص قدرات التشفير على الخادم — هل ندعم secp256k1 والتوقيع الذي تتطلبه هيئة الزكاة؟ (قراءة فقط)
        $z = ['php' => PHP_VERSION, 'openssl_ext' => extension_loaded('openssl')];
        $z['openssl_version'] = defined('OPENSSL_VERSION_TEXT') ? OPENSSL_VERSION_TEXT : null;
        $curves = function_exists('openssl_get_curve_names') ? openssl_get_curve_names() : [];
        $z['has_secp256k1_curve'] = in_array('secp256k1', $curves, true);
        $z['curve_count'] = count($curves);
        // محاولة فعلية لإنشاء مفتاح secp256k1 وتوقيع عيّنة والتحقق منها
        $z['can_generate_key'] = false; $z['can_sign_verify'] = false; $z['key_bits'] = null; $z['error'] = null;
        if ($z['openssl_ext']) {
            $pk = @openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'secp256k1']);
            if ($pk) {
                $z['can_generate_key'] = true;
                $det = openssl_pkey_get_details($pk);
                $z['key_bits'] = $det['bits'] ?? null;
                $z['key_type_ec'] = isset($det['ec']);
                $sig = ''; $sample = 'ZATCA-secp256k1-selftest';
                if (@openssl_sign($sample, $sig, $pk, OPENSSL_ALGO_SHA256)) {
                    $pub = openssl_pkey_get_public($det['key']);
                    $z['can_sign_verify'] = ($pub && openssl_verify($sample, $sig, $pub, OPENSSL_ALGO_SHA256) === 1);
                }
            } else {
                $z['error'] = openssl_error_string();
            }
        }
        $z['sha256'] = in_array('sha256', array_map('strtolower', hash_algos()), true);
        echo json_encode(['success' => true, 'zatca' => $z], JSON_UNESCAPED_UNICODE);
        break;

    case 'zatca_status':
        // حالة اعتماد الزكاة للمنشأة (بدون أي أسرار) — للواجهة
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $row = acc_zatca_get($conn, $tid);
        echo json_encode(['success' => true, 'status' => [
            'environment'         => $row['environment'] ?? 'simulation',
            'egs_serial'          => $row['egs_serial'] ?? null,
            'has_private_key'     => !empty($row['private_key']),
            'has_csr'             => !empty($row['csr']),
            'has_compliance_cert' => !empty($row['compliance_cert']),
            'has_production_cert' => !empty($row['production_cert']),
            'last_icv'            => (int)($row['last_icv'] ?? 0),
            'last_pih'            => $row['last_pih'] ?? null,
        ]], JSON_UNESCAPED_UNICODE);
        break;

    case 'zatca_keygen':
        // توليد مفتاح secp256k1 + CSR للمنشأة (خطوة تحضيرية للربط) — لا يُعيد المفتاح الخاص أبدًا
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $by  = $input_data['actor'] ?? null;
        $company = [];
        foreach (['company_name','cr_number','vat_number'] as $k) $company[$k] = acc_setting($conn, $tid, $k, '');
        if (!$company['company_name']) { echo json_encode(['success'=>false,'message'=>'أكمل ملف المنشأة (الاسم القانوني) أولًا']); break; }
        $egs = trim($input_data['egs_serial'] ?? '');
        if ($egs === '') $egs = '1-Semak|2-Ledger|3-'.substr(acc_uuid4(), 0, 8);
        try {
            $res = acc_zatca_keygen($conn, $tid, $company, $egs);
            acc_audit($conn, $tid, 'zatca', null, 'keygen', 'egs='.$egs, $by);
            echo json_encode(['success'=>true,'egs_serial'=>$res['egs_serial'],'csr'=>$res['csr'],'public_pem'=>$res['public_pem'],'message'=>'تم توليد المفتاح وطلب الشهادة (CSR)'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success'=>false,'message'=>'فشل التوليد: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'zatca_stamp':
        // ختم فاتورة بيع وفق المرحلة الثانية (وضع المحاكاة): UBL → هاش → توقيع ECDSA →
        // رمز QR بتسعة وسوم + سلسلة ICV/PIH. خاص بالمقاولات (بيع/شراء بضريبة) فقط.
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $by  = $input_data['actor'] ?? null;
        $h = $conn->query("SELECT * FROM acc_invoices WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $inv = $h ? $h->fetch_assoc() : null;
        if (!$inv) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        if ($inv['doc_type'] !== 'sales') { echo json_encode(['success'=>false,'message'=>'الختم لفواتير البيع فقط']); break; }
        if (!in_array($inv['status'], ['posted','partial','paid'])) { echo json_encode(['success'=>false,'message'=>'لا تُختم إلا الفواتير المُرحّلة']); break; }
        // مختومة مسبقًا؟ أعِد بياناتها دون استهلاك ICV جديد (حفاظًا على سلامة السلسلة)
        if (!empty($inv['invoice_hash']) && !empty($inv['icv'])) {
            echo json_encode(['success'=>true,'already'=>true,'id'=>$id,'icv'=>(int)$inv['icv'],'uuid'=>$inv['uuid'],'invoice_hash'=>$inv['invoice_hash'],'qr_base64'=>$inv['qr_base64'],'message'=>'الفاتورة مختومة مسبقًا'], JSON_UNESCAPED_UNICODE);
            break;
        }
        // لا بدّ من مفتاح خاص للمنشأة (من zatca_keygen)
        $zrow0 = acc_zatca_get($conn, $tid);
        if (empty($zrow0['private_key'])) { echo json_encode(['success'=>false,'message'=>'ولّد مفتاح المنشأة (zatca_keygen) أولًا']); break; }
        $company = [];
        foreach (['company_name','vat_number','cr_number'] as $k) $company[$k] = acc_setting($conn, $tid, $k, '');
        $ir = $conn->query("SELECT * FROM acc_invoice_items WHERE invoice_id=$id AND tenant_id=$tid ORDER BY id");
        $items = []; while ($ir && ($x = $ir->fetch_assoc())) $items[] = $x;
        if (!$items) { echo json_encode(['success'=>false,'message'=>'لا توجد بنود في الفاتورة']); break; }
        $conn->begin_transaction();
        try {
            // قفل سجل الاعتماد، تخصيص ICV التالي، وجلب PIH (هاش الفاتورة السابقة)
            $lr = $conn->query("SELECT last_icv, last_pih, private_key FROM acc_zatca WHERE tenant_id=$tid FOR UPDATE");
            $z = $lr ? $lr->fetch_assoc() : null;
            if (!$z) throw new Exception('سجل اعتماد الزكاة مفقود');
            $icv     = (int)$z['last_icv'] + 1;
            $pihB64  = $z['last_pih'] ?: acc_zatca_pih0();
            $privPem = $z['private_key'];
            $uuid = $inv['uuid'] ?: acc_uuid4();
            $inv['uuid'] = $uuid;
            $inv['issue_time'] = gmdate('H:i:s');
            // UBL → هاش → توقيع → مفتاح عام → ختم تمثيلي
            $xml      = acc_zatca_ubl($inv, $items, $company, $icv, $pihB64);
            $hashB64  = acc_zatca_hash($xml);
            $sigB64   = acc_zatca_sign($hashB64, $privPem);   // توقيع الفاتورة (الوسم 7)
            $pubDer   = acc_zatca_pubkey_der($privPem);        // المفتاح العام (الوسم 8)
            $stampB64 = acc_zatca_sign($pubDer, $privPem);     // ختم تمثيلي للمحاكاة (الوسم 9)
            $seller = $company['company_name'] ?: 'سمك للمقاولات';
            $sVat   = $company['vat_number'] ?: '300000000000003';
            $tsIso  = $inv['issue_date'].'T'.$inv['issue_time'].'Z';
            $tot = round((float)$inv['total'],2); $taxT = round((float)$inv['tax_total'],2);
            $qr = acc_zatca_qr_v2($seller, $sVat, $tsIso, $tot, $taxT, $hashB64, $sigB64, $pubDer, $stampB64);
            // تخزين الختم على الفاتورة
            $upd = "UPDATE acc_invoices SET uuid='".$conn->real_escape_string($uuid)."',icv=$icv,"
                 . "pih='".$conn->real_escape_string($pihB64)."',invoice_hash='".$conn->real_escape_string($hashB64)."',"
                 . "qr_base64='".$conn->real_escape_string($qr)."',signed_xml='".$conn->real_escape_string($xml)."',"
                 . "zatca_status='stamped_simulation' WHERE id=$id AND tenant_id=$tid";
            if (!$conn->query($upd)) throw new Exception($conn->error);
            // تقديم السلسلة: PIH للفاتورة التالية = هاش هذه الفاتورة
            if (!$conn->query("UPDATE acc_zatca SET last_icv=$icv, last_pih='".$conn->real_escape_string($hashB64)."' WHERE tenant_id=$tid")) throw new Exception($conn->error);
            $conn->commit();
            acc_audit($conn, $tid, 'invoice', $id, 'zatca_stamp', 'icv='.$icv.' hash='.$hashB64, $by);
            echo json_encode(['success'=>true,'id'=>$id,'icv'=>$icv,'uuid'=>$uuid,'pih'=>$pihB64,'invoice_hash'=>$hashB64,'qr_base64'=>$qr,'zatca_status'=>'stamped_simulation','message'=>'تم ختم الفاتورة (وضع المحاكاة)'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الختم: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    // ═══════════════════════════════════════════════════════════════════════
    // ترحيل دفترة (Phase 3.4): بيانات أساسية (عملاء) + قيد افتتاحي بتاريخ القطع
    // ═══════════════════════════════════════════════════════════════════════

    case 'mig_daftra_preview':
        // معاينة (قراءة فقط — لا كتابة): العملاء وأرصدتهم الافتتاحية كما ستُرحَّل من دفترة
        set_time_limit(45);
        $dk = "__DAFTRA_KEY__"; $mbase = "https://semak.daftra.com/api2";
        $mhh = ["APIKEY: $dk", "Accept: application/json"];
        $mfetch = function($ep) use ($mbase,$mhh){ $ch=curl_init("$mbase/$ep"); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$mhh,CURLOPT_TIMEOUT=>20]); $r=curl_exec($ch); curl_close($ch); return json_decode($r,true); };
        $mClients = $mfetch("clients.json"); $mInvs = $mfetch("invoices.json");
        if (!isset($mClients['data'])) { echo json_encode(['success'=>false,'message'=>'تعذّر جلب العملاء من دفترة']); break; }
        // اختيار الرقم الضريبي/السجل من حقول bn1/bn2 حسب تسمياتها
        $pickBn = function($c, $kind){
            foreach (['bn1'=>'bn1_label','bn2'=>'bn2_label'] as $vk=>$lk){
                $lbl = mb_strtolower((string)($c[$lk] ?? '')); $val = trim((string)($c[$vk] ?? ''));
                if ($val==='') continue;
                if ($kind==='vat' && (mb_strpos($lbl,'ضريب')!==false||strpos($lbl,'vat')!==false||strpos($lbl,'tax')!==false)) return $val;
                if ($kind==='cr'  && (mb_strpos($lbl,'سجل')!==false||strpos($lbl,'cr')!==false||strpos($lbl,'commercial')!==false)) return $val;
            }
            return '';
        };
        // إجمالي غير المسدّد لكل عميل من الفواتير
        $unpaidByClient = [];
        if (isset($mInvs['data'])) foreach ($mInvs['data'] as $row){ $i=$row['Invoice']??[]; $cid=(string)($i['client_id']??''); if($cid==='')continue; $u=(float)($i['summary_unpaid']??max(0,(float)($i['summary_total']??0)-(float)($i['summary_paid']??0))); $unpaidByClient[$cid]=($unpaidByClient[$cid]??0)+$u; }
        $mParties=[]; $arTotal=0;
        foreach ($mClients['data'] as $row){
            $c=$row['Client']??$row;
            $cid=(string)($c['id']??'');
            $name=trim((string)($c['business_name']??'')) ?: trim(trim((string)($c['first_name']??'')).' '.trim((string)($c['last_name']??''))) ?: ('عميل #'.$cid);
            $start=(float)($c['starting_balance']??0);
            $unpaid=(float)($unpaidByClient[$cid]??0);
            $ar=round($start+$unpaid,2); $arTotal+=$ar;
            $mParties[]=[
                'daftra_id'=>$cid,'name'=>$name,'type'=>'customer',
                'vat_number'=>$pickBn($c,'vat'),'cr_number'=>$pickBn($c,'cr'),
                'phone'=>trim((string)($c['phone1']??'')) ?: trim((string)($c['phone2']??'')),
                'email'=>(string)($c['email']??''),
                'address'=>trim(trim((string)($c['address1']??'')).' '.trim((string)($c['city']??''))),
                'starting_balance'=>round($start,2),'unpaid_invoices'=>round($unpaid,2),'ar_opening'=>$ar,
            ];
        }
        echo json_encode(['success'=>true,'source'=>'daftra',
            'counts'=>['clients'=>count($mParties),'invoices'=>isset($mInvs['data'])?count($mInvs['data']):0],
            'parties'=>$mParties,'ar_opening_total'=>round($arTotal,2),
            'note'=>'أرصدة الحسابات العامة (نقد/بنك/حقوق ملكية...) تتطلب تصدير ميزان المراجعة من دفترة بتاريخ القطع ثم استدعاء mig_opening_entry'], JSON_UNESCAPED_UNICODE);
        break;

    case 'mig_daftra_commit':
        // كتابة العملاء في الدفتر المساعد acc_parties (idempotent عبر daftra_id) — يتطلب confirm=true
        $tid = (int)($input_data['tenant_id'] ?? 0);
        if ($tid<=0) { echo json_encode(['success'=>false,'message'=>'حدّد tenant_id']); break; }
        if (empty($input_data['confirm'])) { echo json_encode(['success'=>false,'message'=>'أضف confirm=true لتأكيد الكتابة']); break; }
        $parties = $input_data['parties'] ?? null;
        if (!is_array($parties) || !$parties) { echo json_encode(['success'=>false,'message'=>'مرّر مصفوفة parties من mig_daftra_preview']); break; }
        $created=0;$updated=0;
        foreach ($parties as $p){
            $name=$conn->real_escape_string(trim((string)($p['name']??''))); if($name==='')continue;
            $did=$conn->real_escape_string((string)($p['daftra_id']??''));
            $type=in_array($p['type']??'customer',['customer','supplier','partner'])?$p['type']:'customer';
            $vat=$conn->real_escape_string((string)($p['vat_number']??''));
            $cr =$conn->real_escape_string((string)($p['cr_number']??''));
            $ph =$conn->real_escape_string((string)($p['phone']??''));
            $em =$conn->real_escape_string((string)($p['email']??''));
            $ad =$conn->real_escape_string((string)($p['address']??''));
            $exrow=null;
            if($did!==''){ $ex=$conn->query("SELECT id FROM acc_parties WHERE tenant_id=$tid AND daftra_id='$did' LIMIT 1"); $exrow=$ex?$ex->fetch_assoc():null; }
            if($exrow){
                $conn->query("UPDATE acc_parties SET name='$name',type='$type',vat_number=NULLIF('$vat',''),cr_number=NULLIF('$cr',''),phone=NULLIF('$ph',''),email=NULLIF('$em',''),address=NULLIF('$ad','') WHERE id={$exrow['id']} AND tenant_id=$tid");
                $updated++;
            } else {
                $conn->query("INSERT INTO acc_parties (tenant_id,type,name,vat_number,cr_number,phone,email,address,daftra_id) VALUES ($tid,'$type','$name',NULLIF('$vat',''),NULLIF('$cr',''),NULLIF('$ph',''),NULLIF('$em',''),NULLIF('$ad',''),NULLIF('$did',''))");
                $created++;
            }
        }
        acc_audit($conn,$tid,'migration',null,'daftra_parties','created='.$created.' updated='.$updated,$input_data['actor']??null);
        echo json_encode(['success'=>true,'created'=>$created,'updated'=>$updated,'message'=>'تم ترحيل العملاء إلى الدفتر المساعد'], JSON_UNESCAPED_UNICODE);
        break;

    case 'mig_opening_entry':
        // قيد افتتاحي متوازن بتاريخ القطع — يُغذّى من ميزان المراجعة المصدَّر من دفترة. قيد واحد فقط لكل مستأجر
        $tid=(int)($input_data['tenant_id']??0);
        if($tid<=0){echo json_encode(['success'=>false,'message'=>'حدّد tenant_id']);break;}
        $date=$conn->real_escape_string($input_data['date']??date('Y-m-d'));
        $lines_in=$input_data['lines']??[];
        if(!is_array($lines_in)||count($lines_in)<2){echo json_encode(['success'=>false,'message'=>'القيد يحتاج سطرين على الأقل']);break;}
        $exq=$conn->query("SELECT id FROM acc_entries WHERE tenant_id=$tid AND ref_type='opening' LIMIT 1");
        if($exq&&$exq->fetch_assoc()){echo json_encode(['success'=>false,'message'=>'يوجد قيد افتتاحي مسبقًا لهذا المستأجر — احذفه أولًا إن أردت إعادة الترحيل']);break;}
        $lines=[]; $err=null;
        foreach($lines_in as $L){
            $code=trim((string)($L['account_code']??''));
            $aid=$code!==''?acc_id_by_code($conn,$tid,$code):(int)($L['account_id']??0);
            if(!$aid){$err='حساب غير موجود: '.($code?:(string)($L['account_id']??'?'));break;}
            $line=['account_id'=>$aid,'debit'=>round((float)($L['debit']??0),2),'credit'=>round((float)($L['credit']??0),2),'description'=>($L['description']??'رصيد افتتاحي')];
            if(!empty($L['party_type'])&&!empty($L['party_id'])){$line['party_type']=$L['party_type'];$line['party_id']=(int)$L['party_id'];}
            $lines[]=$line;
        }
        if($err){echo json_encode(['success'=>false,'message'=>$err]);break;}
        $conn->begin_transaction();
        try{
            $r=acc_post_entry($conn,$tid,$date,'قيد افتتاحي (ترحيل دفترة)','opening',null,$input_data['actor']??null,$lines,1);
            acc_audit($conn,$tid,'migration',$r['eid'],'opening_entry','total='.$r['total'],$input_data['actor']??null);
            $conn->commit();
            echo json_encode(['success'=>true,'entry_id'=>$r['eid'],'entry_no'=>$r['eno'],'total'=>$r['total'],'message'=>'تم ترحيل القيد الافتتاحي'], JSON_UNESCAPED_UNICODE);
        }catch(Exception $e){ $conn->rollback(); echo json_encode(['success'=>false,'message'=>'فشل: '.$e->getMessage()], JSON_UNESCAPED_UNICODE); }
        break;

    case 'mig_daftra_suppliers':
        // ترحيل الموردين من دفترة إلى acc_parties (type=supplier). قراءة فقط بدون confirm، كتابة idempotent مع confirm=true
        set_time_limit(90);
        $tid = (int)($input_data['tenant_id'] ?? ($_GET['tenant_id'] ?? 0));
        if ($tid<=0) { echo json_encode(['success'=>false,'message'=>'حدّد tenant_id']); break; }
        $confirm = !empty($input_data['confirm']) || (($_GET['confirm']??'')==='1');
        $dk="__DAFTRA_KEY__"; $sbase="https://semak.daftra.com/api2"; $shh=["APIKEY: $dk","Accept: application/json"];
        $sfetch=function($ep)use($sbase,$shh){ $ch=curl_init("$sbase/$ep"); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$shh,CURLOPT_TIMEOUT=>25]); $r=curl_exec($ch); curl_close($ch); return json_decode($r,true); };
        // جلب كل الصفحات
        $rows=[]; for($pg=1;$pg<=30;$pg++){ $j=$sfetch("suppliers.json?limit=200&page=$pg"); $d=$j['data']??null; if(!is_array($d)||!$d)break; foreach($d as $row) $rows[]=$row['Supplier']??$row; if(count($d)<200)break; }
        if(!$rows){ echo json_encode(['success'=>false,'message'=>'تعذّر جلب الموردين من دفترة']); break; }
        $pickBn=function($c,$kind){ foreach(['bn1'=>'bn1_label','bn2'=>'bn2_label'] as $vk=>$lk){ $lbl=mb_strtolower((string)($c[$lk]??'')); $val=trim((string)($c[$vk]??'')); if($val==='')continue; if($kind==='vat'&&(mb_strpos($lbl,'ضريب')!==false||strpos($lbl,'vat')!==false||strpos($lbl,'tax')!==false))return $val; if($kind==='cr'&&(mb_strpos($lbl,'سجل')!==false||strpos($lbl,'cr')!==false||strpos($lbl,'commercial')!==false))return $val; } return ''; };
        $parties=[]; foreach($rows as $s){
            $sid=(string)($s['id']??'');
            $name=trim((string)($s['business_name']??'')) ?: trim(trim((string)($s['first_name']??'')).' '.trim((string)($s['last_name']??''))) ?: ('مورد #'.$sid);
            $parties[]=['daftra_id'=>$sid,'name'=>$name,'type'=>'supplier','vat_number'=>$pickBn($s,'vat'),'cr_number'=>$pickBn($s,'cr'),'phone'=>trim((string)($s['phone1']??''))?:trim((string)($s['phone2']??'')),'email'=>(string)($s['email']??''),'address'=>trim(trim((string)($s['address1']??'')).' '.trim((string)($s['city']??'')))];
        }
        if(!$confirm){ echo json_encode(['success'=>true,'mode'=>'preview','source'=>'daftra','count'=>count($parties),'sample'=>array_slice($parties,0,8),'note'=>'أضف confirm=true لكتابة الموردين في الدفتر المساعد'], JSON_UNESCAPED_UNICODE); break; }
        $created=0;$updated=0;
        foreach($parties as $p){
            $name=$conn->real_escape_string($p['name']); if($name==='')continue;
            $did=$conn->real_escape_string($p['daftra_id']); $vat=$conn->real_escape_string($p['vat_number']); $cr=$conn->real_escape_string($p['cr_number']); $ph=$conn->real_escape_string($p['phone']); $em=$conn->real_escape_string($p['email']); $ad=$conn->real_escape_string($p['address']);
            $exrow=null; if($did!==''){ $ex=$conn->query("SELECT id FROM acc_parties WHERE tenant_id=$tid AND daftra_id='$did' AND type='supplier' LIMIT 1"); $exrow=$ex?$ex->fetch_assoc():null; }
            if($exrow){ $conn->query("UPDATE acc_parties SET name='$name',type='supplier',vat_number=NULLIF('$vat',''),cr_number=NULLIF('$cr',''),phone=NULLIF('$ph',''),email=NULLIF('$em',''),address=NULLIF('$ad','') WHERE id={$exrow['id']} AND tenant_id=$tid"); $updated++; }
            else { $conn->query("INSERT INTO acc_parties (tenant_id,type,name,vat_number,cr_number,phone,email,address,daftra_id) VALUES ($tid,'supplier','$name',NULLIF('$vat',''),NULLIF('$cr',''),NULLIF('$ph',''),NULLIF('$em',''),NULLIF('$ad',''),NULLIF('$did',''))"); $created++; }
        }
        acc_audit($conn,$tid,'migration',null,'daftra_suppliers','created='.$created.' updated='.$updated,$input_data['actor']??null);
        echo json_encode(['success'=>true,'mode'=>'commit','created'=>$created,'updated'=>$updated,'total'=>count($parties),'message'=>'تم ترحيل الموردين'], JSON_UNESCAPED_UNICODE);
        break;

    case 'mig_daftra_products':
        // ترحيل كتالوج المنتجات/الخدمات من دفترة إلى acc_products. قراءة فقط بدون confirm، كتابة idempotent مع confirm=true
        set_time_limit(90);
        $tid = (int)($input_data['tenant_id'] ?? ($_GET['tenant_id'] ?? 0));
        if ($tid<=0) { echo json_encode(['success'=>false,'message'=>'حدّد tenant_id']); break; }
        $confirm = !empty($input_data['confirm']) || (($_GET['confirm']??'')==='1');
        $dk="__DAFTRA_KEY__"; $pbase="https://semak.daftra.com/api2"; $phh=["APIKEY: $dk","Accept: application/json"];
        $pfetch=function($ep)use($pbase,$phh){ $ch=curl_init("$pbase/$ep"); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$phh,CURLOPT_TIMEOUT=>25]); $r=curl_exec($ch); curl_close($ch); return json_decode($r,true); };
        $rows=[]; for($pg=1;$pg<=30;$pg++){ $j=$pfetch("products.json?limit=200&page=$pg"); $d=$j['data']??null; if(!is_array($d)||!$d)break; foreach($d as $row) $rows[]=$row['Product']??$row; if(count($d)<200)break; }
        if(!$rows){ echo json_encode(['success'=>false,'message'=>'تعذّر جلب المنتجات من دفترة']); break; }
        $prods=[]; foreach($rows as $p){
            $pid=(string)($p['id']??'');
            $tx=(float)($p['tax1']??0); if($tx<0||$tx>100)$tx=0; // tax1 قد يكون معرّفًا لا نسبة — نقبل النِّسب المعقولة فقط
            $prods[]=['daftra_id'=>$pid,'code'=>(string)($p['product_code']??''),'name'=>trim((string)($p['name']??''))?:('منتج #'.$pid),'description'=>(string)($p['description']??''),'unit_price'=>round((float)($p['unit_price']??0),2),'buy_price'=>round((float)($p['buy_price']??($p['average_price']??0)),2),'tax_rate'=>$tx,'barcode'=>(string)($p['barcode']??''),'track_stock'=>!empty($p['track_stock'])?1:0,'stock_balance'=>round((float)($p['stock_balance']??0),3)];
        }
        if(!$confirm){ echo json_encode(['success'=>true,'mode'=>'preview','source'=>'daftra','count'=>count($prods),'sample'=>array_slice($prods,0,8),'note'=>'أضف confirm=true لكتابة المنتجات'], JSON_UNESCAPED_UNICODE); break; }
        $created=0;$updated=0;
        foreach($prods as $p){
            $name=$conn->real_escape_string($p['name']); if($name==='')continue;
            $did=$conn->real_escape_string($p['daftra_id']); $code=$conn->real_escape_string($p['code']); $desc=$conn->real_escape_string($p['description']); $bc=$conn->real_escape_string($p['barcode']);
            $up=(float)$p['unit_price']; $bp=(float)$p['buy_price']; $tr=(float)$p['tax_rate']; $sb=(float)$p['stock_balance']; $ts=(int)$p['track_stock'];
            $exrow=null; if($did!==''){ $ex=$conn->query("SELECT id FROM acc_products WHERE tenant_id=$tid AND daftra_id='$did' LIMIT 1"); $exrow=$ex?$ex->fetch_assoc():null; }
            if($exrow){ $conn->query("UPDATE acc_products SET code=NULLIF('$code',''),name='$name',description=NULLIF('$desc',''),unit_price=$up,buy_price=$bp,tax_rate=$tr,barcode=NULLIF('$bc',''),track_stock=$ts,stock_balance=$sb WHERE id={$exrow['id']} AND tenant_id=$tid"); $updated++; }
            else { $conn->query("INSERT INTO acc_products (tenant_id,daftra_id,code,name,description,unit_price,buy_price,tax_rate,barcode,track_stock,stock_balance) VALUES ($tid,NULLIF('$did',''),NULLIF('$code',''),'$name',NULLIF('$desc',''),$up,$bp,$tr,NULLIF('$bc',''),$ts,$sb)"); $created++; }
        }
        acc_audit($conn,$tid,'migration',null,'daftra_products','created='.$created.' updated='.$updated,$input_data['actor']??null);
        echo json_encode(['success'=>true,'mode'=>'commit','created'=>$created,'updated'=>$updated,'total'=>count($prods),'message'=>'تم ترحيل كتالوج المنتجات'], JSON_UNESCAPED_UNICODE);
        break;

    case 'mig_daftra_trial_balance':
        // قراءة فقط: ميزان المراجعة من دفترة (journal_accounts) + النقد/البنوك (treasuries) — للمراجعة قبل القيد الافتتاحي. لا كتابة إطلاقًا
        set_time_limit(90);
        $dk="__DAFTRA_KEY__"; $tbase="https://semak.daftra.com/api2"; $thh=["APIKEY: $dk","Accept: application/json"];
        $tfetch=function($ep)use($tbase,$thh){ $ch=curl_init("$tbase/$ep"); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$thh,CURLOPT_TIMEOUT=>25]); $r=curl_exec($ch); curl_close($ch); return json_decode($r,true); };
        // ميزان المراجعة من شجرة الحسابات. raw=1 يرجّع كل الحسابات بدون فلترة (تشخيص الفرق/حقوق الملكية المفقودة)
        $rawMode = !empty($_GET['raw']);
        $accs=[]; $rawAll=[]; $firstKeys=null;
        for($pg=1;$pg<=40;$pg++){
            $j=$tfetch("journal_accounts.json?limit=200&page=$pg");
            $d=$j['data']??null; if(!is_array($d)||!$d)break;
            foreach($d as $row){
                $a=$row['JournalAccount']??$row;
                if($firstKeys===null) $firstKeys=array_keys($a);
                $td=(float)($a['total_debit']??0); $tc=(float)($a['total_credit']??0);
                if($rawMode){ $rawAll[]=['code'=>(string)($a['code']??''),'name'=>(string)($a['name']??''),'type'=>(string)($a['type']??''),'level'=>(int)($a['level']??0),'is_hidden'=>!empty($a['is_hidden'])?1:0,'disabled'=>!empty($a['disabled'])?1:0,'debit'=>round($td,2),'credit'=>round($tc,2),'net'=>round($td-$tc,2)]; }
                if(!empty($a['disabled'])||!empty($a['is_hidden']))continue;
                if(round($td,2)==0&&round($tc,2)==0)continue;
                $accs[]=['code'=>(string)($a['code']??''),'name'=>(string)($a['name']??''),'type'=>(string)($a['type']??''),'level'=>(int)($a['level']??0),'debit'=>round($td,2),'credit'=>round($tc,2),'net'=>round($td-$tc,2)];
            }
            if(count($d)<200)break;
        }
        usort($accs,function($x,$y){ return strcmp($x['code'],$y['code']); });
        $sumD=0;$sumC=0; foreach($accs as $a){ $sumD+=$a['debit']; $sumC+=$a['credit']; }
        if($rawMode){ usort($rawAll,function($x,$y){ return strcmp($x['code'],$y['code']); }); }
        // النقد والبنوك
        $treas=[]; $tj=$tfetch("treasuries.json?limit=200"); if(isset($tj['data'])) foreach($tj['data'] as $row){ $t=$row['Treasury']??$row; $treas[]=['id'=>(string)($t['id']??''),'name'=>(string)($t['name']??''),'type'=>(string)($t['type_name']??($t['type']??'')),'is_primary'=>!empty($t['is_primary'])?1:0,'balance'=>round((float)($t['balance']??0),2)]; }
        $treasTotal=0; foreach($treas as $t)$treasTotal+=$t['balance'];
        echo json_encode(['success'=>true,'mode'=>'preview_readonly','source'=>'daftra',
            'trial_balance'=>['accounts'=>$accs,'count'=>count($accs),'total_debit'=>round($sumD,2),'total_credit'=>round($sumC,2),'balanced'=>round($sumD-$sumC,2)==0],
            'raw'=>$rawMode?['accounts'=>$rawAll,'count'=>count($rawAll),'first_row_keys'=>$firstKeys,'total_debit'=>round(array_sum(array_column($rawAll,'debit')),2),'total_credit'=>round(array_sum(array_column($rawAll,'credit')),2)]:null,
            'treasuries'=>['items'=>$treas,'total'=>round($treasTotal,2)],
            'note'=>'قراءة فقط للمراجعة — لم يُكتب أي قيد. عند الجاهزية نبني القيد الافتتاحي عبر mig_opening_entry بعد ربط أكواد دفترة بشجرة حساباتنا'], JSON_UNESCAPED_UNICODE);
        break;

    case 'mig_opening_auto':
        // القيد الافتتاحي الآلي: يسحب ميزان دفترة ويبني القيد تلقائيًا. preview افتراضيًا — لا يكتب شيئًا إلا confirm=1
        // الربط مبني على بادئة كود دفترة (data-driven) ليسهل التعديل لاحقًا. الشركاء → حقوق ملكية مساهمة (3103)
        set_time_limit(120);
        $tid = (int)($_GET['tenant_id'] ?? $_GET['tenant'] ?? 1);
        $confirm = !empty($_GET['confirm']);
        $odate = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($_GET['date'] ?? '')) ? $_GET['date'] : '2026-06-05';
        $suspenseCode = preg_match('/^\d{2,6}$/', (string)($_GET['suspense'] ?? '')) ? $_GET['suspense'] : '1190';
        // عائلة المموّلين (شركاء) — مطابقة بالاسم تمامًا كما في acc_parties
        $family = ['أمي وأبي','منيرة فهد البادي','إبراهيم فهد البادي','أسامة فهد البادي','طلال مفرج الحربي','ورود عبدالعزيز الحسون'];
        // منع التكرار: لو فيه قيد افتتاحي مُرحّل سابقًا
        $ex = $conn->query("SELECT id,entry_no FROM acc_entries WHERE tenant_id=$tid AND ref_type='opening' LIMIT 1");
        $exRow = $ex ? $ex->fetch_assoc() : null;
        if ($exRow && $confirm) { echo json_encode(['success'=>false,'message'=>'يوجد قيد افتتاحي مُرحّل مسبقًا: '.$exRow['entry_no'].' — احذفه أولًا قبل إعادة الترحيل','existing'=>$exRow], JSON_UNESCAPED_UNICODE); break; }
        // 1) اسحب ميزان دفترة (الأوراق فقط — صافي ≠ 0)
        $dk="__DAFTRA_KEY__"; $obase="https://semak.daftra.com/api2"; $ohh=["APIKEY: $dk","Accept: application/json"];
        $ofetch=function($ep)use($obase,$ohh){ $ch=curl_init("$obase/$ep"); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$ohh,CURLOPT_TIMEOUT=>25]); $r=curl_exec($ch); curl_close($ch); return json_decode($r,true); };
        $leaves=[]; for($pg=1;$pg<=40;$pg++){ $j=$ofetch("journal_accounts.json?limit=200&page=$pg"); $d=$j['data']??null; if(!is_array($d)||!$d)break; foreach($d as $row){ $a=$row['JournalAccount']??$row; if(!empty($a['disabled'])||!empty($a['is_hidden']))continue; $net=round((float)($a['total_debit']??0)-(float)($a['total_credit']??0),2); if($net==0)continue; $leaves[]=['code'=>(string)($a['code']??''),'name'=>trim((string)($a['name']??'')),'net'=>$net]; } if(count($d)<200)break; }
        // 2) صنّف كل حساب ورقي إلى صندوق (bucket) عبر بادئة الكود + اسم العائلة
        $B=['cash'=>0.0,'bank'=>0.0,'ar'=>0.0,'ap'=>0.0,'partner'=>0.0,'pnl'=>0.0];
        $details=['cash'=>[],'bank'=>[],'ar'=>[],'ap'=>[],'partner'=>[],'pnl'=>[],'unmapped'=>[]];
        $partnerByName=[]; // اسم → صافي (لترحيل بند لكل شريك)
        foreach($leaves as $L){ $c=$L['code']; $nm=$L['name']; $net=$L['net']; $b=null;
            if($c==='120101') $b='bank';
            elseif(strpos($c,'120102')===0 || strpos($c,'1202')===0) $b='cash';
            elseif(strpos($c,'1204')===0 && in_array($nm,$family,true)) { $b='partner'; $partnerByName[$nm]=round(($partnerByName[$nm]??0)+$net,2); }
            elseif(strpos($c,'1203')===0 || strpos($c,'1204')===0) $b='ar';
            elseif(strpos($c,'1210')===0 || strpos($c,'411')===0 || strpos($c,'541')===0) $b='pnl';
            elseif(strpos($c,'221')===0) $b='ap';
            else { $details['unmapped'][]=['code'=>$c,'name'=>$nm,'net'=>$net]; continue; }
            $B[$b]=round($B[$b]+$net,2); $details[$b][]=['code'=>$c,'name'=>$nm,'net'=>$net];
        }
        // 3) ابنِ بنود القيد على شجرة حساباتنا. (موجب=مدين، سالب=دائن)
        $coa=['cash'=>'1101','bank'=>'1102','ar'=>'1103','ap'=>'2101','partner'=>'3103','pnl'=>'3102'];
        $plan=[]; // [code,name,debit,credit,note,party_type,party_name]
        $addLine=function($code,$name,$net,$pt=null,$pn=null) use(&$plan){ if(round($net,2)==0) return; $plan[]=['code'=>$code,'name'=>$name,'debit'=>$net>0?round($net,2):0.0,'credit'=>$net<0?round(-$net,2):0.0,'party_type'=>$pt,'party_name'=>$pn]; };
        $addLine('1101','الصندوق',$B['cash']);
        $addLine('1102','البنك',$B['bank']);
        $addLine('1103','العملاء (المدينون)',$B['ar']);
        $addLine('2101','الموردون (الدائنون)',$B['ap']);
        // الشركاء: بند منفصل لكل شريك مع ربط الطرف (party subledger)
        ksort($partnerByName);
        foreach($partnerByName as $pn=>$pnet){ $addLine('3103','مساهمات الشركاء',$pnet,'partner',$pn); }
        $addLine('3102','الأرباح المُحتجزة (صافي تشغيل سابق)',$B['pnl']);
        // 4) فرق التوازن (أصول غير موثّقة: مشاريع تحت التنفيذ/مخزون/معدات) → حساب تسوية مدين
        $sumNet=0.0; foreach($B as $v)$sumNet=round($sumNet+$v,2);
        $plug=round(-$sumNet,2); // لو صافي الأصول ناقص نضيف مدين بحساب التسوية
        if($plug!=0) $addLine($suspenseCode,'أصول تحت التسوية — رصيد افتتاحي',$plug);
        // إجماليات
        $td=0.0;$tc=0.0; foreach($plan as $p){ $td+=$p['debit']; $tc+=$p['credit']; }
        $td=round($td,2);$tc=round($tc,2); $balanced=round($td-$tc,2)==0;
        // 5) PREVIEW (افتراضي) — لا كتابة
        if(!$confirm){
            echo json_encode(['success'=>true,'mode'=>'preview','date'=>$odate,'balanced'=>$balanced,
                'total_debit'=>$td,'total_credit'=>$tc,
                'lines'=>$plan,
                'buckets'=>$B,'plug'=>['account'=>$suspenseCode,'amount'=>$plug,'meaning'=>'صافي أصول غير موثّقة في دفترة (غالبًا مشاريع تحت التنفيذ/مخزون/معدات) — راجعها وأعد توزيعها لاحقًا'],
                'partners'=>$partnerByName,
                'unmapped'=>$details['unmapped'],
                'note'=>'معاينة فقط — لم يُكتب قيد. للترحيل: نفس الرابط + confirm=1. الشركاء → 3103 مساهمات الشركاء (حقوق ملكية). الفرق '.number_format($plug,2).' في حساب '.$suspenseCode.' بانتظار توزيعه على الأصول الفعلية',
                'existing_opening'=>$exRow], JSON_UNESCAPED_UNICODE);
            break;
        }
        // 6) COMMIT — تأكد من وجود الحسابات الجديدة ثم رحّل القيد داخل معاملة
        if(!$balanced){ echo json_encode(['success'=>false,'message'=>'القيد غير متوازن: مدين '.$td.' ≠ دائن '.$tc.' — لم يُرحّل']); break; }
        $conn->begin_transaction();
        try {
            // ensure 3103 + suspense exist
            $ensure=function($code,$name,$type) use($conn,$tid){ $id=acc_id_by_code($conn,$tid,$code); if($id) return $id; $ce=$conn->real_escape_string($code); $ne=$conn->real_escape_string($name); $te=$conn->real_escape_string($type); if(!$conn->query("INSERT INTO acc_accounts (tenant_id,code,name,type,is_group) VALUES ($tid,'$ce','$ne','$te',0)")) throw new Exception($conn->error); return $conn->insert_id; };
            $ensure('3103','مساهمات الشركاء','equity');
            $ensure($suspenseCode,'أصول تحت التسوية — رصيد افتتاحي','asset');
            acc_fix_hierarchy($conn,$tid); // اربط الحسابات الجديدة بآبائها
            // خريطة الشركاء: اسم → party_id من acc_parties
            $pmap=[]; $pr=$conn->query("SELECT id,name FROM acc_parties WHERE tenant_id=$tid AND type='partner'"); while($pr&&($x=$pr->fetch_assoc())) $pmap[trim($x['name'])]=(int)$x['id'];
            // ابنِ بنود acc_post_entry
            $lines=[];
            foreach($plan as $p){ $aid=acc_id_by_code($conn,$tid,$p['code']); if(!$aid) throw new Exception('حساب غير موجود: '.$p['code']); $ln=['account_id'=>$aid,'debit'=>$p['debit'],'credit'=>$p['credit'],'description'=>$p['name']]; if($p['party_type']==='partner'){ $ln['party_type']='partner'; if(isset($pmap[$p['party_name']])) $ln['party_id']=$pmap[$p['party_name']]; } $lines[]=$ln; }
            $res=acc_post_entry($conn,$tid,$odate,'القيد الافتتاحي — تحويل من دفترة بتاريخ '.$odate,'opening',null,'migration',$lines,1);
            $conn->commit();
            echo json_encode(['success'=>true,'mode'=>'committed','entry_no'=>$res['eno'],'entry_id'=>$res['eid'],'total'=>$res['total'],'balanced'=>true,'lines'=>count($plan),'plug'=>['account'=>$suspenseCode,'amount'=>$plug],'note'=>'تم ترحيل القيد الافتتاحي. الفرق '.number_format($plug,2).' في '.$suspenseCode.' بانتظار توزيعه على الأصول الفعلية'], JSON_UNESCAPED_UNICODE);
        } catch(Exception $e){ $conn->rollback(); echo json_encode(['success'=>false,'message'=>'فشل الترحيل: '.$e->getMessage()], JSON_UNESCAPED_UNICODE); }
        break;

    case 'mig_party_subledger':
        // تفصيل القيد الافتتاحي: استبدال سطرَي العملاء (1103) والموردين (2101) المجمَّعَين ببنود لكل طرف.
        //   - المصدر: حسابات دفترة الورقية (journal_accounts) — نفس تصنيف mig_opening_auto (1203/1204→عملاء، 221→موردون).
        //   - الربط بالأطراف: entity_id↔daftra_id أولًا ثم بالاسم. غير المطابق → سطر «متفرقون» (party NULL) ليبقى إجمالي الحساب مطابقًا تمامًا للرصيد المُرحَّل.
        //   - معاينة افتراضيًا (قراءة فقط). الكتابة تتطلب confirm=1، وتتم داخل معاملة، ولا تغيّر إجمالي القيد إطلاقًا.
        set_time_limit(120);
        $tid     = (int)($_GET['tenant_id'] ?? $_GET['tenant'] ?? $input_data['tenant_id'] ?? 1);
        $confirm = !empty($_GET['confirm']) || !empty($input_data['confirm']);
        // 1) القيد الافتتاحي + حسابات العملاء/الموردين
        $oe = $conn->query("SELECT id,entry_no,date,total_debit,total_credit FROM acc_entries WHERE tenant_id=$tid AND ref_type='opening' ORDER BY id LIMIT 1");
        $oerow = $oe ? $oe->fetch_assoc() : null;
        if (!$oerow) { echo json_encode(['success'=>false,'message'=>'لا يوجد قيد افتتاحي — رحّله أولًا عبر mig_opening_auto'], JSON_UNESCAPED_UNICODE); break; }
        $eid   = (int)$oerow['id'];
        $arAcc = acc_id_by_code($conn,$tid,'1103');
        $apAcc = acc_id_by_code($conn,$tid,'2101');
        if (!$arAcc || !$apAcc) { echo json_encode(['success'=>false,'message'=>'حسابات 1103/2101 غير موجودة في الشجرة'], JSON_UNESCAPED_UNICODE); break; }
        // الحالة الراهنة لسطور هذين الحسابين داخل القيد (لكشف ما إذا سبق التفصيل)
        $accState = function($accId) use ($conn,$tid,$eid){
            $r=$conn->query("SELECT id,debit,credit,party_id FROM acc_lines WHERE tenant_id=$tid AND entry_id=$eid AND account_id=".(int)$accId);
            $lines=[]; $d=0;$c=0; $split=false;
            while($r&&($x=$r->fetch_assoc())){ $lines[]=$x; $d+=(float)$x['debit']; $c+=(float)$x['credit']; if($x['party_id']!==null) $split=true; }
            return ['lines'=>$lines,'debit'=>round($d,2),'credit'=>round($c,2),'net'=>round($d-$c,2),'already_split'=>$split,'count'=>count($lines)];
        };
        $arState = $accState($arAcc);   // net موجب (مدين)
        $apState = $accState($apAcc);   // net سالب (دائن)
        $arControl = $arState['net'];           // مثال: 4231.64
        $apControl = round(-$apState['net'],2); // مثال: 81463.99 (دائن موجب)
        // 2) اسحب حسابات دفترة الورقية وصنّفها (نفس منطق mig_opening_auto)
        $dk="__DAFTRA_KEY__"; $sbase="https://semak.daftra.com/api2"; $shh=["APIKEY: $dk","Accept: application/json"];
        $sfetch=function($ep)use($sbase,$shh){ $ch=curl_init("$sbase/$ep"); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$shh,CURLOPT_TIMEOUT=>25]); $r=curl_exec($ch); curl_close($ch); return json_decode($r,true); };
        $family = ['أمي وأبي','منيرة فهد البادي','إبراهيم فهد البادي','أسامة فهد البادي','طلال مفرج الحربي','ورود عبدالعزيز الحسون'];
        $arLeaves=[]; $apLeaves=[]; $entityKeys=null;
        for($pg=1;$pg<=40;$pg++){
            $j=$sfetch("journal_accounts.json?limit=200&page=$pg"); $d=$j['data']??null; if(!is_array($d)||!$d)break;
            foreach($d as $row){ $a=$row['JournalAccount']??$row;
                if($entityKeys===null && (isset($a['entity_id'])||isset($a['entity_type']))) $entityKeys=['entity_type'=>$a['entity_type']??null,'entity_id'=>$a['entity_id']??null];
                if(!empty($a['disabled'])||!empty($a['is_hidden']))continue;
                $net=round((float)($a['total_debit']??0)-(float)($a['total_credit']??0),2); if($net==0)continue;
                $c=(string)($a['code']??''); $nm=trim((string)($a['name']??''));
                $entId=trim((string)($a['entity_id']??'')); $entTy=(string)($a['entity_type']??'');
                if(strpos($c,'1204')===0 && in_array($nm,$family,true)) continue; // شريك — مفصَّل أصلًا
                if(strpos($c,'1203')===0 || strpos($c,'1204')===0) $arLeaves[]=['code'=>$c,'name'=>$nm,'net'=>$net,'entity_id'=>$entId,'entity_type'=>$entTy];
                elseif(strpos($c,'221')===0)                       $apLeaves[]=['code'=>$c,'name'=>$nm,'net'=>$net,'entity_id'=>$entId,'entity_type'=>$entTy];
            }
            if(count($d)<200)break;
        }
        // 3) خرائط الأطراف
        $mapBy = function($type) use ($conn,$tid){
            $byD=[]; $byN=[]; $r=$conn->query("SELECT id,name,daftra_id FROM acc_parties WHERE tenant_id=$tid AND type='$type'");
            while($r&&($x=$r->fetch_assoc())){ if($x['daftra_id']!==null&&$x['daftra_id']!=='') $byD[(string)$x['daftra_id']]=(int)$x['id']; $byN[mb_strtolower(trim($x['name']))]=(int)$x['id']; }
            return ['d'=>$byD,'n'=>$byN];
        };
        $cust = $mapBy('customer'); $supp = $mapBy('supplier');
        // 4) ابنِ بنود التفصيل لكل جانب
        $buildSide = function($leaves,$accId,$control,$side,$maps,$pType,$accCode,$accName) {
            // side: 'debit' للعملاء أو 'credit' للموردين. control = صافي الحساب الموجب.
            $mapped=[]; $unmappedAmt=0; $unmappedList=[]; $sumMapped=0;
            foreach($leaves as $L){
                $amt = $side==='debit' ? $L['net'] : round(-$L['net'],2); // العملاء net موجب، الموردون net سالب
                if(round($amt,2)==0) continue;
                $pid = ($L['entity_id']!=='' && isset($maps['d'][$L['entity_id']])) ? $maps['d'][$L['entity_id']]
                     : ($maps['n'][mb_strtolower($L['name'])] ?? 0);
                if($pid){ $mapped[]=['party_id'=>$pid,'name'=>$L['name'],'amount'=>round($amt,2),'entity_id'=>$L['entity_id']]; $sumMapped=round($sumMapped+$amt,2); }
                else { $unmappedAmt=round($unmappedAmt+$amt,2); $unmappedList[]=['name'=>$L['name'],'amount'=>round($amt,2),'entity_id'=>$L['entity_id'],'code'=>$L['code']]; }
            }
            $residual = round($control - $sumMapped,2); // ما تبقّى ليطابق رصيد الحساب المُرحَّل (يشمل غير المطابق + أي انحراف)
            return ['account_id'=>$accId,'account_code'=>$accCode,'account_name'=>$accName,'party_type'=>$pType,'side'=>$side,
                    'control'=>$control,'mapped'=>$mapped,'mapped_sum'=>$sumMapped,'mapped_count'=>count($mapped),
                    'unmapped'=>$unmappedList,'unmapped_sum'=>$unmappedAmt,'residual'=>$residual];
        };
        $arPlan = $buildSide($arLeaves,$arAcc,$arControl,'debit', $cust,'customer','1103','العملاء (المدينون)');
        $apPlan = $buildSide($apLeaves,$apAcc,$apControl,'credit',$supp,'supplier','2101','الموردون (الدائنون)');
        // 5) معاينة (افتراضي)
        $diag = ['entry_no'=>$oerow['entry_no'],'entry_id'=>$eid,'date'=>$oerow['date'],
                 'ar'=>['control'=>$arControl,'already_split'=>$arState['already_split'],'leaves'=>count($arLeaves),'mapped'=>$arPlan['mapped_count'],'mapped_sum'=>$arPlan['mapped_sum'],'residual'=>$arPlan['residual'],'parties'=>$arPlan['mapped'],'unmapped'=>$arPlan['unmapped']],
                 'ap'=>['control'=>$apControl,'already_split'=>$apState['already_split'],'leaves'=>count($apLeaves),'mapped'=>$apPlan['mapped_count'],'mapped_sum'=>$apPlan['mapped_sum'],'residual'=>$apPlan['residual'],'parties'=>$apPlan['mapped'],'unmapped'=>$apPlan['unmapped']],
                 'entity_keys_sample'=>$entityKeys];
        if(!$confirm){
            echo json_encode(['success'=>true,'mode'=>'preview','tenant'=>$tid,'diagnostics'=>$diag,
                'note'=>'معاينة فقط — لم تُكتب أي بنود. أضف confirm=1 لاستبدال السطرين المجمَّعَين ببنود لكل طرف (دون تغيير إجمالي القيد). إجمالي كل حساب يبقى مطابقًا للرصيد المُرحَّل عبر سطر «متفرقون» إن وُجد فرق.'], JSON_UNESCAPED_UNICODE);
            break;
        }
        // 6) كتابة — استبدل سطور الحساب داخل القيد ببنود الأطراف (داخل معاملة)
        $errs=[]; $done=[];
        $conn->begin_transaction();
        try {
            // الثابت الحاكم: صافي كل حساب (مدين−دائن) لا يتغيّر إطلاقًا ⇒ ميزان المراجعة يبقى كما هو.
            // أرصدة الأطراف قد تكون عكسية (مورّد مدين/عميل دائن) ⇒ تُكتب كبند أحادي الجانب حسب الإشارة،
            // فيكبر إجمالي القيد القائم (gross) بمقدار البنود العكسية مع بقاء التوازن وصافي كل حساب ثابتًا.
            $applySide = function($state,$plan) use ($conn,$tid,$eid,&$done){
                $code=$plan['account_code'];
                if($state['already_split']){ $done[]="تخطّي $code: سبق تفصيله"; return; }
                if(round($plan['residual'],2) < -0.01){ throw new Exception("الحساب $code: الأطراف المطابقة (".$plan['mapped_sum'].") تتجاوز الرصيد المُرحَّل (".$plan['control'].") — راجِع قبل الكتابة"); }
                $accId=(int)$plan['account_id']; $isCredit=$plan['side']==='credit'; // الموردون=دائن، العملاء=مدين
                // المبلغ موجب = على الجانب الطبيعي للحساب (دائن للموردين/مدين للعملاء)، سالب = الجانب المعاكس
                $items=[];
                foreach($plan['mapped'] as $m){ $items[]=['amt'=>round((float)$m['amount'],2),'pid'=>(int)$m['party_id'],'desc'=>$m['name']]; }
                $res=round($plan['residual'],2);
                if(abs($res)>0.001) $items[]=['amt'=>$res,'pid'=>0,'desc'=>$isCredit?'موردون متفرقون (غير مطابقين)':'عملاء متفرقون (غير مطابقين)'];
                if(!$items){ $done[]="تخطّي $code: لا بنود"; return; }
                // تحقّق: صافي البنود على الجانب الطبيعي = الرصيد المُرحَّل تمامًا
                $net=0; foreach($items as $it) $net=round($net+$it['amt'],2);
                if(round($net-$plan['control'],2)!=0) throw new Exception("الحساب $code: صافي الأطراف ($net) ≠ الرصيد المُرحَّل (".$plan['control'].")");
                // احذف السطور القديمة لهذا الحساب ثم أدرج البنود لكل طرف
                if(!$conn->query("DELETE FROM acc_lines WHERE tenant_id=$tid AND entry_id=$eid AND account_id=$accId")) throw new Exception($conn->error);
                $pt="'".$plan['party_type']."'"; $contra=0;
                foreach($items as $it){
                    $a=round((float)$it['amt'],2); if($a==0) continue;
                    if($isCredit){ $deb=$a<0?round(-$a,2):0; $cre=$a>0?$a:0; } // الموردون: موجب→دائن، سالب→مدين
                    else         { $deb=$a>0?$a:0; $cre=$a<0?round(-$a,2):0; } // العملاء: موجب→مدين، سالب→دائن
                    if($a<0) $contra=round($contra+(-$a),2);
                    $pid=$it['pid']>0?(int)$it['pid']:'NULL';
                    $ptx=$it['pid']>0?$pt:'NULL';
                    $desc=$conn->real_escape_string($it['desc']);
                    if(!$conn->query("INSERT INTO acc_lines (tenant_id,entry_id,account_id,debit,credit,cost_center_id,party_type,party_id,due_date,description) VALUES ($tid,$eid,$accId,$deb,$cre,NULL,$ptx,$pid,NULL,'$desc')")) throw new Exception($conn->error);
                }
                $done[]="فُصّل $code إلى ".count($items)." بند".($res>0.001?' (منها متفرقون '.$res.')':'').($contra>0?' [بنود عكسية '.$contra.']':'');
            };
            $applySide($arState,$arPlan);
            $applySide($apState,$apPlan);
            // أعد احتساب إجمالي القيد من البنود (gross قد يكبر بسبب البنود العكسية) وتحقّق التوازن وثبات صافي الحسابين
            $tr=$conn->query("SELECT COALESCE(SUM(debit),0) d, COALESCE(SUM(credit),0) c FROM acc_lines WHERE tenant_id=$tid AND entry_id=$eid");
            $tx=$tr?$tr->fetch_assoc():['d'=>0,'c'=>0]; $ntd=round((float)$tx['d'],2); $ntc=round((float)$tx['c'],2);
            if(round($ntd-$ntc,2)!=0) throw new Exception("اختلّ توازن القيد بعد التفصيل: مدين $ntd ≠ دائن $ntc");
            $chkNet=function($accId) use($conn,$tid,$eid){ $r=$conn->query("SELECT COALESCE(SUM(debit-credit),0) n FROM acc_lines WHERE tenant_id=$tid AND entry_id=$eid AND account_id=".(int)$accId); $x=$r?$r->fetch_assoc():['n'=>0]; return round((float)$x['n'],2); };
            if($chkNet($arAcc)!=round($arState['net'],2)) throw new Exception("تغيّر صافي حساب العملاء بعد التفصيل — تراجُع");
            if($chkNet($apAcc)!=round($apState['net'],2)) throw new Exception("تغيّر صافي حساب الموردين بعد التفصيل — تراجُع");
            $conn->query("UPDATE acc_entries SET total_debit=$ntd, total_credit=$ntc WHERE id=$eid AND tenant_id=$tid");
            acc_audit($conn,$tid,'migration',$eid,'party_subledger','ar='.$arControl.' ap='.$apControl.' | '.implode(' | ',$done),$input_data['actor']??null);
            $conn->commit();
            echo json_encode(['success'=>true,'mode'=>'committed','entry_no'=>$oerow['entry_no'],'entry_id'=>$eid,
                'total_debit'=>$ntd,'total_credit'=>$ntc,'actions'=>$done,'diagnostics'=>$diag,
                'note'=>'تم تفصيل أرصدة الأطراف. صافي كل حساب (ميزان المراجعة) لم يتغيّر؛ قد يكبر إجمالي القيد الإجمالي بسبب البنود العكسية. افتح كشوف حسابات الأطراف لرؤية الأرصدة الافتتاحية.'], JSON_UNESCAPED_UNICODE);
        } catch(Exception $e){ $conn->rollback(); echo json_encode(['success'=>false,'message'=>'فشل التفصيل: '.$e->getMessage(),'diagnostics'=>$diag], JSON_UNESCAPED_UNICODE); }
        break;

    // ═══════════════════════════════════════════════════════════════════════
    // المستندات المستقلة (Phase 3): فواتير بيع/شراء + سندات قبض/صرف → ترحيل آلي
    // ═══════════════════════════════════════════════════════════════════════

    case 'inv_list':
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $dt   = $conn->real_escape_string($_GET['doc_type'] ?? '');
        $st   = $conn->real_escape_string($_GET['status'] ?? '');
        $from = $conn->real_escape_string($_GET['from'] ?? '');
        $to   = $conn->real_escape_string($_GET['to'] ?? '');
        $pid  = (int)($_GET['party_id'] ?? 0);
        $w = "i.tenant_id=$tid";
        if (in_array($dt, ['sales','purchase'])) $w .= " AND i.doc_type='$dt'";
        if (in_array($st, ['draft','posted','partial','paid','void'])) $w .= " AND i.status='$st'";
        if ($from) $w .= " AND i.issue_date>='$from'";
        if ($to)   $w .= " AND i.issue_date<='$to'";
        if ($pid)  $w .= " AND i.party_id=$pid";
        $res = $conn->query("SELECT i.*, COALESCE(p.name,i.party_name) party_label, p.phone AS party_phone
                             FROM acc_invoices i LEFT JOIN acc_parties p ON p.id=i.party_id
                             WHERE $w ORDER BY i.issue_date DESC, i.id DESC LIMIT 500");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'inv_single':
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1); $id = (int)($_GET['id'] ?? 0);
        $h = $conn->query("SELECT i.*, COALESCE(p.name,i.party_name) party_label, p.vat_number party_vat, p.address party_address
                           FROM acc_invoices i LEFT JOIN acc_parties p ON p.id=i.party_id
                           WHERE i.id=$id AND i.tenant_id=$tid LIMIT 1");
        $head = $h ? $h->fetch_assoc() : null;
        if (!$head) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        $ir = $conn->query("SELECT * FROM acc_invoice_items WHERE invoice_id=$id AND tenant_id=$tid ORDER BY id");
        $items = []; while ($ir && ($x = $ir->fetch_assoc())) $items[] = $x;
        // سجل الدفعات المرتبطة بالفاتورة
        $pr = $conn->query("SELECT pay_no,date,method,amount FROM acc_payments WHERE invoice_id=$id AND tenant_id=$tid ORDER BY date,id");
        $payments = []; while ($pr && ($x = $pr->fetch_assoc())) $payments[] = $x;
        echo json_encode(['success'=>true,'invoice'=>$head,'items'=>$items,'payments'=>$payments], JSON_UNESCAPED_UNICODE);
        break;

    case 'inv_whatsapp': {
        // إرسال إشعار واتساب للعميل بتفاصيل الفاتورة
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $by  = $conn->real_escape_string($input_data['actor'] ?? '');
        if (!$id) { echo json_encode(['success'=>false,'message'=>'معرّف الفاتورة مطلوب']); break; }
        $res = $conn->query("SELECT i.*, COALESCE(p.name,i.party_name) AS cust_name, p.phone AS cust_phone
                             FROM acc_invoices i LEFT JOIN acc_parties p ON p.id=i.party_id
                             WHERE i.id=$id AND i.tenant_id=$tid LIMIT 1");
        $inv = $res ? $res->fetch_assoc() : null;
        if (!$inv) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        // رقم الجوال
        $phone = preg_replace('/\D/', '', (string)($inv['cust_phone'] ?? ''));
        $phone = ltrim($phone, '0');
        if (strlen($phone) < 9) { echo json_encode(['success'=>false,'message'=>'لا يوجد رقم جوال صالح للعميل']); break; }
        if (substr($phone, 0, 3) !== '966') $phone = '966' . $phone;
        // اسم الشركة
        $sRes = $conn->query("SELECT value FROM acc_settings WHERE tenant_id=$tid AND key_name='company_name' LIMIT 1");
        $co   = ($sRes && ($sr = $sRes->fetch_assoc())) ? $sr['value'] : 'سماك العقارية';
        // بناء الرسالة
        $no   = $inv['invoice_no'] ?: "#$id";
        $cust = $inv['cust_name'] ?: 'عزيزي العميل';
        $dt   = $inv['issue_date'] ?? '';
        $due  = $inv['due_date'] ? "\nتاريخ الاستحقاق: {$inv['due_date']}" : '';
        $tot  = number_format((float)$inv['total'], 2);
        $paid = number_format((float)$inv['paid'], 2);
        $bal  = max(0, (float)$inv['total'] - (float)$inv['paid']);
        $balFmt = number_format($bal, 2);
        $docLbl = $inv['doc_type'] === 'sales' ? 'فاتورة' : 'فاتورة مشتريات';
        $body = "مرحباً {$cust} 👋\n\n"
              . "نُحيطكم علماً بـ{$docLbl} من {$co}:\n"
              . "─────────────────\n"
              . "رقم الفاتورة: *{$no}*\n"
              . "التاريخ: {$dt}{$due}\n"
              . "الإجمالي: *{$tot} ﷼*\n"
              . ($inv['paid'] > 0 ? "المسدَّد: {$paid} ﷼\n" : '')
              . ($bal > 0.01 ? "المتبقي: *{$balFmt} ﷼*\n" : "✅ مسدّدة بالكامل\n")
              . "─────────────────\n"
              . "شكراً لتعاملكم معنا 🙏";
        $ok = wa_send_text($phone, $body);
        if ($ok) {
            acc_audit($conn, $tid, 'invoice', $id, 'whatsapp', "$no → $phone", $by, $_clientIp, $_clientUa);
            echo json_encode(['success'=>true,'message'=>'تم إرسال الإشعار عبر واتساب ✓'], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['success'=>false,'message'=>'فشل إرسال الواتساب — تحقق من رقم العميل وإعدادات Mottasl'], JSON_UNESCAPED_UNICODE);
        }
        break;
    }

    case 'gl_ratios': {
        // النسب المالية المحسوبة من دفتر الأستاذ والفواتير
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $ys  = date('Y') . '-01-01';
        // إيرادات ومصروفات السنة
        $rr = $conn->query("SELECT
            SUM(CASE WHEN a.type='revenue' THEN GREATEST(0,l.credit-l.debit) ELSE 0 END) AS rev,
            SUM(CASE WHEN a.type='expense' THEN GREATEST(0,l.debit-l.credit) ELSE 0 END) AS exp
            FROM acc_lines l
            JOIN acc_entries e ON e.id=l.entry_id AND e.tenant_id=l.tenant_id AND e.is_posted=1 AND e.date>='$ys'
            JOIN acc_accounts a ON a.id=l.account_id AND a.tenant_id=l.tenant_id AND a.is_group=0
            WHERE l.tenant_id=$tid");
        $re  = $rr ? $rr->fetch_assoc() : [];
        $rev = max(0,(float)($re['rev']??0));
        $exp = max(0,(float)($re['exp']??0));
        $net = $rev - $exp;
        // نقدية (حسابات نقد + بنوك)
        $cr = $conn->query("SELECT COALESCE(SUM(l.debit-l.credit),0) AS v
            FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id AND e.is_posted=1
            JOIN acc_accounts a ON a.id=l.account_id AND a.is_group=0
            WHERE l.tenant_id=$tid AND a.type='asset'
            AND (a.name LIKE '%نقد%' OR a.name LIKE '%صندوق%' OR a.name LIKE '%بنك%' OR a.name LIKE '%كاش%')");
        $cashV = max(0,(float)(($cr ? $cr->fetch_assoc() : ['v'=>0])['v']));
        // ذمم مدينة/دائنة من الفواتير المفتوحة
        $ar = $conn->query("SELECT COALESCE(SUM(ROUND(total-paid,2)),0) AS v FROM acc_invoices WHERE tenant_id=$tid AND doc_type='sales' AND status IN ('posted','partial')");
        $arV = max(0,(float)(($ar ? $ar->fetch_assoc() : ['v'=>0])['v']));
        $ap = $conn->query("SELECT COALESCE(SUM(ROUND(total-paid,2)),0) AS v FROM acc_invoices WHERE tenant_id=$tid AND doc_type='purchase' AND status IN ('posted','partial')");
        $apV = max(0,(float)(($ap ? $ap->fetch_assoc() : ['v'=>0])['v']));
        // إجمالي الأصول والخصوم
        $bs = $conn->query("SELECT
            SUM(CASE WHEN a.type='asset'     THEN GREATEST(0,l.debit-l.credit)  ELSE 0 END) AS ta,
            SUM(CASE WHEN a.type='liability' THEN GREATEST(0,l.credit-l.debit)  ELSE 0 END) AS tl
            FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id AND e.tenant_id=l.tenant_id AND e.is_posted=1
            JOIN acc_accounts a ON a.id=l.account_id AND a.tenant_id=l.tenant_id AND a.is_group=0
            WHERE l.tenant_id=$tid");
        $bsd = $bs ? $bs->fetch_assoc() : [];
        $ta  = max(0,(float)($bsd['ta']??0));
        $tl  = max(0,(float)($bsd['tl']??0));
        // حساب النسب
        $ratios = [
            'net_margin'  => $rev  > 0 ? round($net/$rev*100,1)       : null,
            'dso'         => $rev  > 0 ? round($arV/($rev/365),0)     : null,
            'dpo'         => $exp  > 0 ? round($apV/($exp/365),0)     : null,
            'debt_ratio'  => $ta   > 0 ? round($tl/$ta*100,1)         : null,
            'ar_ap_ratio' => $apV  > 0 ? round($arV/$apV,2)           : null,
            'cash_ap'     => $apV  > 0 ? round($cashV/$apV,2)         : null,
            'revenue'=>round($rev,2),'expenses'=>round($exp,2),'net'=>round($net,2),
            'ar'=>round($arV,2),'ap'=>round($apV,2),'cash'=>round($cashV,2),
            'total_assets'=>round($ta,2),'total_liab'=>round($tl,2),
        ];
        echo json_encode(['success'=>true,'ratios'=>$ratios], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'gl_product_ledger':
        // حركة صنف: مشتريات = وارد (+) ، مبيعات = منصرف (-) — من بنود الفواتير المُرحّلة.
        // المسودات والفواتير الملغاة تُستثنى. يُرجع رصيدًا جاريًا للكمية + لقطة المخزون المسجّل.
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $pid  = (int)($_GET['product_id'] ?? 0);
        $from = $conn->real_escape_string($_GET['from'] ?? '');
        $to   = $conn->real_escape_string($_GET['to'] ?? '');
        if (!$pid) { echo json_encode(['success'=>false,'message'=>'المنتج مطلوب']); break; }
        $pr = $conn->query("SELECT * FROM acc_products WHERE id=$pid AND tenant_id=$tid LIMIT 1");
        $prod = $pr ? $pr->fetch_assoc() : null;
        if (!$prod) { echo json_encode(['success'=>false,'message'=>'المنتج غير موجود']); break; }
        $statusFilter = "i.status IN ('posted','partial','paid')";
        $opQ = 0;
        if ($from) {
            $o = $conn->query("SELECT COALESCE(SUM(CASE WHEN i.doc_type='purchase' THEN it.qty ELSE -it.qty END),0) q
                               FROM acc_invoice_items it JOIN acc_invoices i ON i.id=it.invoice_id
                               WHERE it.product_id=$pid AND it.tenant_id=$tid AND $statusFilter AND i.issue_date<'$from'");
            if ($o && ($x = $o->fetch_assoc())) $opQ = (float)$x['q'];
        }
        $w = "it.product_id=$pid AND it.tenant_id=$tid AND $statusFilter";
        if ($from) $w .= " AND i.issue_date>='$from'";
        if ($to)   $w .= " AND i.issue_date<='$to'";
        $res = $conn->query("SELECT i.id invoice_id,i.invoice_no,i.issue_date,i.doc_type,i.status,i.party_id,COALESCE(p.name,i.party_name) party_label,
                                    it.qty,it.unit_price,it.line_total,it.description
                             FROM acc_invoice_items it JOIN acc_invoices i ON i.id=it.invoice_id
                             LEFT JOIN acc_parties p ON p.id=i.party_id
                             WHERE $w ORDER BY i.issue_date, i.id, it.id");
        $rows = []; $run = $opQ; $inQ = 0; $outQ = 0;
        while ($res && ($x = $res->fetch_assoc())) {
            $q = (float)$x['qty'];
            if ($x['doc_type'] === 'purchase') { $x['qty_in'] = $q; $x['qty_out'] = 0; $run += $q; $inQ += $q; }
            else { $x['qty_in'] = 0; $x['qty_out'] = $q; $run -= $q; $outQ += $q; }
            $x['balance'] = round($run, 3); $rows[] = $x;
        }
        echo json_encode(['success'=>true,'product'=>$prod,'opening'=>round($opQ,3),'data'=>$rows,
            'totals'=>['in'=>round($inQ,3),'out'=>round($outQ,3),'closing'=>round($run,3),'stock_balance'=>(float)$prod['stock_balance']]], JSON_UNESCAPED_UNICODE);
        break;

    case 'inv_save':
        // إنشاء/تعديل فاتورة كمسودة — تُحسب الإجماليات في الخادم (لا نثق ببيانات العميل)
        $tid   = (int)($input_data['tenant_id'] ?? 1);
        $id    = (int)($input_data['id'] ?? 0);
        $dt    = in_array($input_data['doc_type'] ?? '', ['sales','purchase']) ? $input_data['doc_type'] : 'sales';
        $ityp  = in_array($input_data['invoice_type'] ?? '', ['standard','simplified']) ? $input_data['invoice_type'] : 'simplified';
        $kind  = in_array($input_data['doc_kind'] ?? '', ['invoice','credit_note','debit_note']) ? $input_data['doc_kind'] : 'invoice';
        $pid   = isset($input_data['party_id']) && $input_data['party_id'] !== '' ? (int)$input_data['party_id'] : 'NULL';
        $pname = $conn->real_escape_string($input_data['party_name'] ?? '');
        $idate = $conn->real_escape_string($input_data['issue_date'] ?? date('Y-m-d'));
        $ddate = isset($input_data['due_date']) && $input_data['due_date'] !== '' ? "'".$conn->real_escape_string($input_data['due_date'])."'" : 'NULL';
        $cur   = $conn->real_escape_string($input_data['currency'] ?? 'SAR');
        $glacc = isset($input_data['gl_account_id']) && $input_data['gl_account_id'] !== '' ? (int)$input_data['gl_account_id'] : 'NULL';
        $notes = $conn->real_escape_string($input_data['notes'] ?? '');
        $items = $input_data['items'] ?? [];
        if (!is_array($items) || count($items) < 1) { echo json_encode(['success'=>false,'message'=>'الفاتورة تحتاج بندًا واحدًا على الأقل']); break; }

        // لا يُعدّل إلا المسودات
        if ($id) {
            $cs = $conn->query("SELECT status FROM acc_invoices WHERE id=$id AND tenant_id=$tid LIMIT 1");
            $crow = $cs ? $cs->fetch_assoc() : null;
            if (!$crow) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
            if ($crow['status'] !== 'draft') { echo json_encode(['success'=>false,'message'=>'لا يمكن تعديل فاتورة مُرحّلة — استخدم الإلغاء']); break; }
        }

        // حساب الإجماليات
        $sub = 0; $taxT = 0; $discT = 0; $clean = [];
        foreach ($items as $it) {
            $desc = trim($it['description'] ?? '');
            $qty  = round((float)($it['qty'] ?? 0), 3);
            $up   = round((float)($it['unit_price'] ?? 0), 2);
            $dsc  = round((float)($it['discount'] ?? 0), 2);
            $rate = isset($it['tax_rate']) ? round((float)$it['tax_rate'], 2) : 15;
            if ($desc === '' || $qty == 0) continue;
            $net  = round($qty * $up - $dsc, 2);
            if ($net < 0) $net = 0;
            $tax  = round($net * $rate / 100, 2);
            $lt   = round($net + $tax, 2);
            $sub += $net; $taxT += $tax; $discT += $dsc;
            $clean[] = ['pid'=>(isset($it['product_id'])&&$it['product_id']!==''?(int)$it['product_id']:'NULL'),
                        'desc'=>$conn->real_escape_string($desc),'qty'=>$qty,'up'=>$up,'dsc'=>$dsc,
                        'rate'=>$rate,'net'=>$net,'tax'=>$tax,'lt'=>$lt];
        }
        if (!$clean) { echo json_encode(['success'=>false,'message'=>'بنود غير صالحة']); break; }
        $sub = round($sub,2); $taxT = round($taxT,2); $discT = round($discT,2); $tot = round($sub + $taxT, 2);

        $conn->begin_transaction();
        try {
            if ($id) {
                if (!$conn->query("UPDATE acc_invoices SET doc_type='$dt',invoice_type='$ityp',doc_kind='$kind',party_id=$pid,party_name='$pname',
                        issue_date='$idate',due_date=$ddate,currency='$cur',gl_account_id=$glacc,subtotal=$sub,discount=$discT,tax_total=$taxT,total=$tot,notes='$notes'
                        WHERE id=$id AND tenant_id=$tid")) throw new Exception($conn->error);
                $conn->query("DELETE FROM acc_invoice_items WHERE invoice_id=$id AND tenant_id=$tid");
                $iid = $id; $ino = null;
            } else {
                $yr  = (int)substr($idate, 0, 4);
                $knd = ($dt === 'sales') ? 'INVS' : 'INVP';
                $pre = ($dt === 'sales') ? 'INV' : 'PUR';
                $seq = acc_next_no($conn, $tid, $knd, $yr);
                $ino = $pre.'-'.$yr.'-'.str_pad($seq, 6, '0', STR_PAD_LEFT);
                if (!$conn->query("INSERT INTO acc_invoices (tenant_id,doc_type,invoice_type,doc_kind,invoice_no,party_id,party_name,issue_date,due_date,currency,gl_account_id,subtotal,discount,tax_total,total,status,notes,created_by)
                        VALUES ($tid,'$dt','$ityp','$kind','$ino',$pid,'$pname','$idate',$ddate,'$cur',$glacc,$sub,$discT,$taxT,$tot,'draft','$notes',".($pname?"NULL":"NULL").")")) throw new Exception($conn->error);
                $iid = $conn->insert_id;
            }
            foreach ($clean as $c) {
                if (!$conn->query("INSERT INTO acc_invoice_items (tenant_id,invoice_id,product_id,description,qty,unit_price,discount,tax_rate,net_amount,tax_amount,line_total)
                        VALUES ($tid,$iid,{$c['pid']},'{$c['desc']}',{$c['qty']},{$c['up']},{$c['dsc']},{$c['rate']},{$c['net']},{$c['tax']},{$c['lt']})")) throw new Exception($conn->error);
            }
            $conn->commit();
            acc_audit($conn, $tid, 'invoice', $iid, $id ? 'update' : 'create', ($ino?:'').' total='.$tot, $input_data['actor'] ?? null);
            echo json_encode(['success'=>true,'id'=>$iid,'invoice_no'=>$ino,'subtotal'=>$sub,'tax_total'=>$taxT,'total'=>$tot,'message'=>'تم حفظ الفاتورة'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الحفظ: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'inv_post':
        // ترحيل فاتورة (مسودة) إلى قيد محاسبي متوازن
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $by  = $input_data['actor'] ?? null;
        $h = $conn->query("SELECT * FROM acc_invoices WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $inv = $h ? $h->fetch_assoc() : null;
        if (!$inv) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        if ($inv['status'] !== 'draft') { echo json_encode(['success'=>false,'message'=>'الفاتورة مُرحّلة مسبقًا']); break; }
        $sub = round((float)$inv['subtotal'],2); $taxT = round((float)$inv['tax_total'],2); $tot = round((float)$inv['total'],2);
        if ($tot <= 0) { echo json_encode(['success'=>false,'message'=>'إجمالي الفاتورة صفر']); break; }
        $ar     = acc_id_by_code($conn,$tid,'1103'); // ذمم عملاء
        $ap     = acc_id_by_code($conn,$tid,'2101'); // ذمم موردين
        $vatOut = acc_id_by_code($conn,$tid,'2102'); // ضريبة مخرجات (خصوم) — للمبيعات
        $vatIn  = acc_id_by_code($conn,$tid,'1401') ?: $vatOut; // ضريبة مدخلات (أصول) — للمشتريات، يرجع لـ2102 إن لم يوجد 1401
        $defRev = acc_id_by_code($conn,$tid,'4101'); $defExp = acc_id_by_code($conn,$tid,'5104');
        $partyId = $inv['party_id'] !== null ? (int)$inv['party_id'] : null;
        $due = $inv['due_date'];
        $desc = trim(($inv['doc_type']==='sales'?'فاتورة مبيعات ':'فاتورة مشتريات ').$inv['invoice_no'].' '.($inv['party_name']??''));
        $conn->begin_transaction();
        try {
            if ($inv['doc_type'] === 'sales') {
                if (!$ar) throw new Exception('حساب العملاء 1103 غير موجود');
                $rev = ((int)$inv['gl_account_id']) ?: $defRev;
                if (!$rev) throw new Exception('حساب الإيراد غير موجود');
                $lines = [
                    ['account_id'=>$ar,'debit'=>$tot,'credit'=>0,'party_type'=>'customer','party_id'=>$partyId,'due_date'=>$due,'description'=>'ذمم عميل'],
                    ['account_id'=>$rev,'debit'=>0,'credit'=>$sub,'description'=>'إيراد'],
                ];
                if ($taxT > 0) { if(!$vatOut) throw new Exception('حساب ضريبة المخرجات 2102 غير موجود'); $lines[] = ['account_id'=>$vatOut,'debit'=>0,'credit'=>$taxT,'description'=>'ضريبة مخرجات']; }
                $reft = 'sales_invoice';
            } else {
                if (!$ap) throw new Exception('حساب الموردين 2101 غير موجود');
                $exp = ((int)$inv['gl_account_id']) ?: $defExp;
                if (!$exp) throw new Exception('حساب المصروف غير موجود');
                $lines = [
                    ['account_id'=>$exp,'debit'=>$sub,'credit'=>0,'description'=>'مصروف/مشتريات'],
                ];
                // ضريبة المدخلات في 1401 (أصول قابلة للاسترداد) أو 2102 إن لم يوجد 1401
                if ($taxT > 0) { $lines[] = ['account_id'=>$vatIn,'debit'=>$taxT,'credit'=>0,'description'=>'ضريبة مدخلات']; }
                $lines[] = ['account_id'=>$ap,'debit'=>0,'credit'=>$tot,'party_type'=>'supplier','party_id'=>$partyId,'due_date'=>$due,'description'=>'ذمم مورد'];
                $reft = 'purchase_invoice';
            }
            $r = acc_post_entry($conn, $tid, $inv['issue_date'], $desc, $reft, $id, $by, $lines, 1);
            // فواتير البيع: توليد UUID ورمز QR وفق هيئة الزكاة (يُحفظ مع الترحيل)
            $zSet = '';
            if ($inv['doc_type'] === 'sales') {
                $uuid = $inv['uuid'] ?: acc_uuid4();
                $seller = acc_setting($conn, $tid, 'company_name', 'سمك للمقاولات');
                $sVat   = acc_setting($conn, $tid, 'vat_number', '300000000000003');
                $tsIso  = $inv['issue_date'].'T'.gmdate('H:i:s').'Z';
                $qr = acc_zatca_qr($seller, $sVat, $tsIso, $tot, $taxT);
                $zSet = ",uuid='".$conn->real_escape_string($uuid)."',qr_base64='".$conn->real_escape_string($qr)."'";
            }
            if (!$conn->query("UPDATE acc_invoices SET status='posted',entry_id={$r['eid']}$zSet WHERE id=$id AND tenant_id=$tid")) throw new Exception($conn->error);
            $conn->commit();
            acc_audit($conn, $tid, 'invoice', $id, 'post', $inv['invoice_no'].' → '.$r['eno'], $by);
            echo json_encode(['success'=>true,'id'=>$id,'entry_id'=>$r['eid'],'entry_no'=>$r['eno'],'message'=>'تم ترحيل الفاتورة'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الترحيل: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'inv_void':
        // إلغاء فاتورة مُرحّلة بعكس قيدها (لا حذف — حفاظًا على التدقيق)
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $date= $conn->real_escape_string($input_data['date'] ?? date('Y-m-d'));
        $by  = $input_data['actor'] ?? null;
        $h = $conn->query("SELECT * FROM acc_invoices WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $inv = $h ? $h->fetch_assoc() : null;
        if (!$inv) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        if (!in_array($inv['status'], ['posted','partial','paid'])) { echo json_encode(['success'=>false,'message'=>'لا يمكن إلغاء هذه الفاتورة']); break; }
        if ((float)$inv['paid'] > 0) { echo json_encode(['success'=>false,'message'=>'الفاتورة عليها مدفوعات — ألغِ السندات أولًا']); break; }
        $conn->begin_transaction();
        try {
            if ($inv['entry_id']) acc_reverse_entry($conn, $tid, (int)$inv['entry_id'], $date, $by);
            if (!$conn->query("UPDATE acc_invoices SET status='void' WHERE id=$id AND tenant_id=$tid")) throw new Exception($conn->error);
            $conn->commit();
            acc_audit($conn, $tid, 'invoice', $id, 'void', $inv['invoice_no'], $by);
            echo json_encode(['success'=>true,'id'=>$id,'message'=>'تم إلغاء الفاتورة وعكس قيدها'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الإلغاء: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'inv_delete':
        // حذف مسودة فقط
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $cs = $conn->query("SELECT status FROM acc_invoices WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $crow = $cs ? $cs->fetch_assoc() : null;
        if (!$crow) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        if ($crow['status'] !== 'draft') { echo json_encode(['success'=>false,'message'=>'لا يُحذف إلا المسودات — استخدم الإلغاء']); break; }
        $conn->begin_transaction();
        try {
            if (!$conn->query("DELETE FROM acc_invoice_items WHERE invoice_id=$id AND tenant_id=$tid")) throw new Exception($conn->error);
            if (!$conn->query("DELETE FROM acc_invoices WHERE id=$id AND tenant_id=$tid")) throw new Exception($conn->error);
            $conn->commit();
            acc_audit($conn, $tid, 'invoice', $id, 'delete', 'حذف مسودة', $input_data['actor'] ?? null);
            echo json_encode(['success'=>true,'message'=>'تم حذف المسودة']);
        } catch (Exception $e) { $conn->rollback(); echo json_encode(['success'=>false,'message'=>'فشل الحذف: '.$e->getMessage()], JSON_UNESCAPED_UNICODE); }
        break;

    case 'pay_list':
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $pt   = $conn->real_escape_string($_GET['pay_type'] ?? '');
        $pfrom = $conn->real_escape_string($_GET['from'] ?? '');
        $pto   = $conn->real_escape_string($_GET['to']   ?? '');
        $ppid  = (int)($_GET['party_id'] ?? 0);
        $lim  = min(500, max(1, (int)($_GET['limit']  ?? 100)));
        $off  = max(0,           (int)($_GET['offset'] ?? 0));
        $w = "pm.tenant_id=$tid";
        if (in_array($pt, ['receipt','payment'])) $w .= " AND pm.pay_type='$pt'";
        if ($pfrom) $w .= " AND pm.date>='$pfrom'";
        if ($pto)   $w .= " AND pm.date<='$pto'";
        if ($ppid)  $w .= " AND pm.party_id=$ppid";
        $tr = $conn->query("SELECT COUNT(*) c FROM acc_payments pm WHERE $w");
        $total = $tr ? (int)$tr->fetch_assoc()['c'] : 0;
        $res = $conn->query("SELECT pm.*, p.name party_label, i.invoice_no
                             FROM acc_payments pm
                             LEFT JOIN acc_parties p ON p.id=pm.party_id
                             LEFT JOIN acc_invoices i ON i.id=pm.invoice_id
                             WHERE $w ORDER BY pm.date DESC, pm.id DESC LIMIT $lim OFFSET $off");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows,'total'=>$total,'limit'=>$lim,'offset'=>$off], JSON_UNESCAPED_UNICODE);
        break;

    case 'pay_save':
        // سند قبض (من عميل) / صرف (لمورد) — يُرحّل آليًا ويُحدّث رصيد الفاتورة المرتبطة
        $tid   = (int)($input_data['tenant_id'] ?? 1);
        $ptype = in_array($input_data['pay_type'] ?? '', ['receipt','payment']) ? $input_data['pay_type'] : 'receipt';
        $pid   = isset($input_data['party_id']) && $input_data['party_id'] !== '' ? (int)$input_data['party_id'] : null;
        $invId = isset($input_data['invoice_id']) && $input_data['invoice_id'] !== '' ? (int)$input_data['invoice_id'] : null;
        $date  = $conn->real_escape_string($input_data['date'] ?? date('Y-m-d'));
        $amt   = round((float)($input_data['amount'] ?? 0), 2);
        $method= in_array($input_data['method'] ?? '', ['cash','bank']) ? $input_data['method'] : 'cash';
        $notes = $conn->real_escape_string($input_data['notes'] ?? '');
        $by    = $input_data['actor'] ?? null;
        if ($amt <= 0) { echo json_encode(['success'=>false,'message'=>'المبلغ يجب أن يكون أكبر من صفر']); break; }
        $treasury = isset($input_data['treasury_account_id']) && $input_data['treasury_account_id'] !== ''
                    ? (int)$input_data['treasury_account_id']
                    : acc_id_by_code($conn,$tid,$method==='bank'?'1102':'1101');
        $ar = acc_id_by_code($conn,$tid,'1103'); $ap = acc_id_by_code($conn,$tid,'2101');
        if (!$treasury) { echo json_encode(['success'=>false,'message'=>'حساب الخزينة غير موجود']); break; }
        $conn->begin_transaction();
        try {
            $yr  = (int)substr($date, 0, 4);
            $knd = ($ptype==='receipt') ? 'RCV' : 'PAY';
            $pre = ($ptype==='receipt') ? 'RCV' : 'PAY';
            $seq = acc_next_no($conn, $tid, $knd, $yr);
            $pno = $pre.'-'.$yr.'-'.str_pad($seq, 6, '0', STR_PAD_LEFT);
            $desc = ($ptype==='receipt'?'سند قبض ':'سند صرف ').$pno;
            if ($ptype === 'receipt') {
                if (!$ar) throw new Exception('حساب العملاء 1103 غير موجود');
                $lines = [
                    ['account_id'=>$treasury,'debit'=>$amt,'credit'=>0,'description'=>'تحصيل'],
                    ['account_id'=>$ar,'debit'=>0,'credit'=>$amt,'party_type'=>'customer','party_id'=>$pid,'description'=>'سداد عميل'],
                ];
                $reft = 'receipt';
            } else {
                if (!$ap) throw new Exception('حساب الموردين 2101 غير موجود');
                $lines = [
                    ['account_id'=>$ap,'debit'=>$amt,'credit'=>0,'party_type'=>'supplier','party_id'=>$pid,'description'=>'سداد لمورد'],
                    ['account_id'=>$treasury,'debit'=>0,'credit'=>$amt,'description'=>'صرف'],
                ];
                $reft = 'payment';
            }
            $r = acc_post_entry($conn, $tid, $date, $desc, $reft, null, $by, $lines, 1);
            $invSql = $invId ? $invId : 'NULL';
            $pidSql = $pid !== null ? $pid : 'NULL';
            if (!$conn->query("INSERT INTO acc_payments (tenant_id,pay_type,pay_no,party_id,invoice_id,date,amount,method,treasury_account_id,entry_id,notes,created_by)
                    VALUES ($tid,'$ptype','$pno',$pidSql,$invSql,'$date',$amt,'$method',$treasury,{$r['eid']},'$notes',".($by?"'".$conn->real_escape_string($by)."'":'NULL').")")) throw new Exception($conn->error);
            $payId = $conn->insert_id;
            // تحديث رصيد الفاتورة المرتبطة
            if ($invId) {
                $ih = $conn->query("SELECT total,paid,status FROM acc_invoices WHERE id=$invId AND tenant_id=$tid LIMIT 1");
                $irow = $ih ? $ih->fetch_assoc() : null;
                if ($irow && in_array($irow['status'], ['posted','partial'])) {
                    $newPaid = round((float)$irow['paid'] + $amt, 2);
                    $newStatus = ($newPaid >= round((float)$irow['total'],2) - 0.01) ? 'paid' : 'partial';
                    $conn->query("UPDATE acc_invoices SET paid=$newPaid,status='$newStatus' WHERE id=$invId AND tenant_id=$tid");
                }
            }
            $conn->commit();
            acc_audit($conn, $tid, 'payment', $payId, 'create', $pno.' → '.$r['eno'].' amount='.$amt, $by);
            echo json_encode(['success'=>true,'id'=>$payId,'pay_no'=>$pno,'entry_id'=>$r['eid'],'entry_no'=>$r['eno'],'message'=>'تم تسجيل السند وترحيله'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل التسجيل: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'pay_void':
        // إلغاء سند بعكس قيده وإرجاع رصيد الفاتورة
        $tid = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $date= $conn->real_escape_string($input_data['date'] ?? date('Y-m-d'));
        $by  = $input_data['actor'] ?? null;
        $h = $conn->query("SELECT * FROM acc_payments WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $pay = $h ? $h->fetch_assoc() : null;
        if (!$pay) { echo json_encode(['success'=>false,'message'=>'السند غير موجود']); break; }
        $conn->begin_transaction();
        try {
            if ($pay['entry_id']) acc_reverse_entry($conn, $tid, (int)$pay['entry_id'], $date, $by);
            if ($pay['invoice_id']) {
                $ih = $conn->query("SELECT total,paid FROM acc_invoices WHERE id={$pay['invoice_id']} AND tenant_id=$tid LIMIT 1");
                $irow = $ih ? $ih->fetch_assoc() : null;
                if ($irow) {
                    $newPaid = round((float)$irow['paid'] - (float)$pay['amount'], 2);
                    if ($newPaid < 0) $newPaid = 0;
                    $newStatus = ($newPaid <= 0.01) ? 'posted' : 'partial';
                    $conn->query("UPDATE acc_invoices SET paid=$newPaid,status='$newStatus' WHERE id={$pay['invoice_id']} AND tenant_id=$tid");
                }
            }
            $conn->query("DELETE FROM acc_payments WHERE id=$id AND tenant_id=$tid");
            $conn->commit();
            acc_audit($conn, $tid, 'payment', $id, 'void', $pay['pay_no'], $by);
            echo json_encode(['success'=>true,'message'=>'تم إلغاء السند وعكس قيده'], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success'=>false,'message'=>'فشل الإلغاء: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
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
        ensure_column($conn, "projects", "daftra_id", "daftra_id INT DEFAULT NULL");
        $conn->query("UPDATE projects SET daftra_id=$did WHERE id=$pid");
        echo json_encode(['success' => true]);
        break;

    case 'project_cycle_summary':
        // ملخص دورة عمل لمشروع محلي: إحصائيات الوحدات + Daftra (إن كان مرتبطاً)
        $pid = (int)($_GET['id'] ?? 0);
        if (!$pid) { echo json_encode(['success' => false, 'message' => 'id مطلوب']); break; }

        // auto-migrate
        ensure_column($conn, "projects", "daftra_id", "daftra_id INT DEFAULT NULL");

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
            $matched_inv[] = ['id'=>$i['id'],'no'=>$i['no'],'date'=>$i['date'],'client'=>$i['client_business_name']??'','client_id'=>$i['client_id']??'','total'=>(float)($i['summary_total']??0),'paid'=>(float)($i['summary_paid']??0)];
            $rev += (float)($i['summary_total']??0);
            $paid_rev += (float)($i['summary_paid']??0);
        }

        $matched_pur = []; $purchases = 0;
        foreach ($all_pur as $r) {
            $p = $r['PurchaseOrder'] ?? [];
            if ((int)($p['work_order_id'] ?? 0) !== $wc_id) continue;
            $matched_pur[] = ['id'=>$p['id'],'no'=>$p['no'],'date'=>$p['date'],'supplier'=>$p['supplier_business_name']??'','supplier_id'=>$p['supplier_id']??'','total'=>(float)($p['summary_total']??0),'paid'=>(float)($p['summary_paid']??0)];
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

    // ─── تسليم محادثة البوت لموظف (يدوي) ───────────────────────────────────

    case 'wa_takeover':
        // موظف يستلم المحادثة → فهد يصمت 24 ساعة
        $takeover_phone = preg_replace('/\D/', '', $input_data['phone'] ?? '');
        if (!$takeover_phone) { echo json_encode(['success' => false, 'error' => 'missing phone']); break; }
        $safe_tp = $conn->real_escape_string($takeover_phone);
        $conn->query("INSERT INTO wa_human_takeover (phone) VALUES ('$safe_tp')
                      ON DUPLICATE KEY UPDATE taken_at = NOW()");
        echo json_encode(['success' => true]);
        break;

    case 'wa_release':
        // تحرير المحادثة → فهد يعود للرد فوراً
        $release_phone = preg_replace('/\D/', '', $input_data['phone'] ?? '');
        if (!$release_phone) { echo json_encode(['success' => false, 'error' => 'missing phone']); break; }
        $safe_rp = $conn->real_escape_string($release_phone);
        $conn->query("DELETE FROM wa_human_takeover WHERE phone = '$safe_rp'");
        echo json_encode(['success' => true]);
        break;

    case 'wa_reset_all_takeovers':
        $conn->query("TRUNCATE TABLE wa_human_takeover");
        echo json_encode(['success' => true, 'msg' => 'all takeovers cleared — فهد is active for everyone']);
        break;

    case 'wa_takeover_list':
        // قائمة المحادثات المُسلَّمة (للوحة التحكم)
        $res = $conn->query(
            "SELECT phone, taken_at FROM wa_human_takeover
             WHERE taken_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
             ORDER BY taken_at DESC"
        );
        $taken = [];
        if ($res) while ($r = $res->fetch_assoc()) $taken[] = $r;
        echo json_encode(['success' => true, 'data' => $taken]);
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

    case 'add_template': {
        // حفظ خطاب كقالب جديد (منشئ الخطابات)
        if (!$_jwt_claims) { echo json_encode(['success'=>false,'message'=>'يتطلب تسجيل الدخول'], JSON_UNESCAPED_UNICODE); break; }
        $cat   = $conn->real_escape_string(trim($input_data['category'] ?? 'عام'));
        $title = $conn->real_escape_string(trim($input_data['title'] ?? ''));
        $subj  = $conn->real_escape_string(trim($input_data['subject'] ?? ''));
        $bodyT = $conn->real_escape_string($input_data['body'] ?? '');
        if ($title === '' || $bodyT === '') { echo json_encode(['success'=>false,'message'=>'العنوان والنص مطلوبان'], JSON_UNESCAPED_UNICODE); break; }
        $ok = $conn->query("INSERT INTO templates (category, title, subject, body) VALUES ('$cat','$title','$subj','$bodyT')");
        echo json_encode(['success'=>(bool)$ok, 'id'=>(int)$conn->insert_id, 'message'=>$ok?'تم الحفظ':$conn->error], JSON_UNESCAPED_UNICODE);
        break;
    }

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
    // إرسال رسالة واتساب يدوية من لوحة الأدمن (الموظف يرد على العميل)
    // "حياك الله"      → يوقف فهد لهذا العميل
    // "سعدنا بخدمتك"  → يعيد تفعيل فهد لهذا العميل
    // ════════════════════════════════════════════════════════════════════════
    case 'wa_bot_status':
        $ph = preg_replace('/\D/', '', trim($data['phone'] ?? ''));
        if (!$ph) { echo json_encode(['paused' => false]); break; }
        $r = $conn->query("SELECT paused FROM wa_bot_paused WHERE phone='" . $conn->real_escape_string($ph) . "' LIMIT 1");
        $paused_val = ($r && ($row = $r->fetch_assoc())) ? (bool)$row['paused'] : false;
        echo json_encode(['paused' => $paused_val]);
        break;

    case 'wa_bot_toggle':
        $ph  = preg_replace('/\D/', '', trim($data['phone'] ?? ''));
        $val = (int)($data['paused'] ?? 0);
        if (!$ph) { echo json_encode(['success' => false]); break; }
        $conn->query(
            "CREATE TABLE IF NOT EXISTS wa_bot_paused (
                phone VARCHAR(50) NOT NULL PRIMARY KEY,
                paused TINYINT(1) NOT NULL DEFAULT 0,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
        $sp = $conn->real_escape_string($ph);
        $conn->query("INSERT INTO wa_bot_paused (phone, paused) VALUES ('$sp', $val)
                      ON DUPLICATE KEY UPDATE paused = $val");
        echo json_encode(['success' => true, 'paused' => (bool)$val]);
        break;

    case 'send_whatsapp':
        $to_phone  = preg_replace('/\D/', '', trim($data['phone'] ?? ''));
        $msg_body  = trim($data['message'] ?? '');

        if (!$to_phone || $msg_body === '') {
            echo json_encode(['success' => false, 'message' => 'phone and message required']);
            break;
        }

        // إنشاء جدول حالة البوت إن لم يكن موجوداً
        $conn->query(
            "CREATE TABLE IF NOT EXISTS wa_bot_paused (
                phone      VARCHAR(50)  NOT NULL PRIMARY KEY,
                paused     TINYINT(1)   NOT NULL DEFAULT 0,
                updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $safe_to     = $conn->real_escape_string($to_phone);
        $bot_paused  = null;

        if (mb_strpos($msg_body, 'حياك الله') !== false) {
            $conn->query("INSERT INTO wa_bot_paused (phone, paused) VALUES ('$safe_to', 1)
                          ON DUPLICATE KEY UPDATE paused = 1");
            $bot_paused = true;
        } elseif (mb_strpos($msg_body, 'سعدنا بخدمتك') !== false) {
            $conn->query("INSERT INTO wa_bot_paused (phone, paused) VALUES ('$safe_to', 0)
                          ON DUPLICATE KEY UPDATE paused = 0");
            $bot_paused = false;
        }

        // إرسال الرسالة عبر Mottasl
        $sent = wa_send_text($to_phone, $msg_body);

        // حفظ الرسالة في سجل المحادثات
        $safe_body = $conn->real_escape_string(mb_substr($msg_body, 0, 2000));
        $conn->query("INSERT INTO wa_bot_conversations (phone, role, message)
                      VALUES ('$safe_to', 'admin', '$safe_body')");

        echo json_encode([
            'success'    => $sent,
            'bot_paused' => $bot_paused,
        ], JSON_UNESCAPED_UNICODE);
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
        $mottasl_key  = MOTTASL_TOKEN;
        $mottasl_base = "https://api.mottasl.ai/v1";

        // ── قاعدة معارف سماك العقارية (system prompt) ──
        $semak_knowledge = <<<'KNOWLEDGE'
LANGUAGE RULE (MANDATORY — overrides everything): Detect the customer's language from their first message and reply ONLY in that language throughout the entire conversation. If they write in English → reply in English. If Arabic → reply in Arabic. If Urdu → Urdu. If Hindi → Hindi. Never switch languages unless the customer does first. This rule is absolute.

اسمك "فهد"، وأنت مستشار ذكاء اصطناعي تمثّل شركة سماك العقارية. أنت نظام ذكاء اصطناعي مدرَّب على مشاريع وخدمات الشركة — وضّح هذا في أول رسالة دائماً دون استثناء. شخصيتك: خبير تسويق عقاري راقٍ، هادئ النبرة، واسع الاطلاع، يقرأ احتياج العميل قبل أن يعرض عليه. أنت "جنتل" في الأسلوب، صياد في الفهم — تستكشف ما يبحث عنه العميل ثم تقدّم له الحل المناسب.

=== قواعد إلزامية ===
1. ممنوع إطلاقاً استخدام أي إيموجي أو رمز تعبيري (مثل 👋 😊 🏡 ✅).
2. تحدّث بلغة العميل تماماً — أي لغة كانت (عربية، إنجليزية، أردية، هندية، فرنسية، تركية، أو غيرها). اكتشف اللغة من أول رسالة وأجب بها. لا تغيّر لغتك إلا إذا غيّرها العميل. في العربية: ممنوع "أهلاً وسهلاً"، "كيف حالك"، "أنا جاهز" — استخدم: "السلام عليكم"، "أهلاً بك في سماك"، "تفضل باستفسارك".
3. ممنوع ذكر الأسعار إلا إذا طلب العميل ذلك صراحةً.
4. لا تخترع معلومات. ما لا تعرفه وجّه فيه إلى الرقم الموحد 920032842.
5. في أول رسالة فقط عرّف بنفسك وأنك ذكاء اصطناعي. إذا كانت المحادثة مستمرة وسبق تقديم نفسك، لا تكرر التعريف مطلقاً — استمر في الحوار مباشرة.

=== أسلوب البداية ===
- لا تبدأ بالحديث عن المشروع. عرّف بنفسك باسمك "فهد" وبيّن أنك ذكاء اصطناعي، ثم عرّف الشركة باختصار، ثم اسأل العميل عن احتياجه.
- الترحيب الأول يكون بلغة العميل:
  • إذا كتب بالعربية: "السلام عليكم، أهلاً بك في سماك العقارية. معك فهد، المستشار الذكي — نظام ذكاء اصطناعي مدرَّب على مشاريع وخدمات سماك. كيف يمكنني خدمتك؟"
  • إذا كتب بالإنجليزية: "Welcome to Semak Real Estate. I'm Fahad, an AI real estate advisor trained on Semak's projects and services. How can I help you?"
- لا تذكر اسم المشروع (سماك البوابة 1) في أول رسالة إلا إذا سأل العميل عنه مباشرة.

=== أسلوب البيع الذكي ===
- اقرأ احتياج العميل أولاً: هل يبحث للسكن أم للاستثمار؟ ما عدد أفراد أسرته؟ ما المنطقة المفضلة؟ ما مستوى التشطيبات الذي يطمح إليه؟
- اطرح سؤالاً واحداً ذكياً في كل رد لاستكشاف احتياجه، لا تطرح أسئلة كثيرة دفعة واحدة.
- بعد أن تفهم احتياجه، قدّم له الوحدة الأنسب من مشروع سماك البوابة 1 بطريقة تستهدف ما يهمه (مساحة، موقع، ضمانات، تشطيبات).
- استخدم لغة الفائدة لا لغة المواصفات: بدل "مساحة 197 متر" قل "مساحة تتيح لك راحة الأسرة وغرفاً مستقلة لكل فرد".
- اختم دائماً بدعوة لطيفة للخطوة التالية (معاينة، اتصال، زيارة).

=== استقبال طلبات البروشور (أولوية عالية) ===
- إذا احتوت الرسالة على "بروشور" أو "brochure":
  1. رحّب ووضّح فوراً: "وصلني طلبك. تفضل صفحة مشروع سماك البوابة: https://brochure.semak.sa/view.html"
  2. اسأل سؤالاً واحداً للتصنيف: "للمساعدة في اختيار الأنسب لك — هل اهتمامك بالمشروع للسكن أم للاستثمار؟"
  3. إذا احتوت الرسالة على "(مصدر: بانر)" → سجّل في META: notes يبدأ بـ "مصدر: بانر — "

=== ضوابط النبرة والإيجاز (إلزامية) ===
- الرد لا يتجاوز المعلومة التي سأل عنها العميل تحديداً. إذا سأل عن السعر أعطه السعر فقط. إذا سأل عن المساحة أعطه المساحة فقط.
- الرد القصير المركّز أفضل دائماً. الحد الأقصى: فقرتان قصيرتان (4-5 أسطر كحد أقصى).
- ممنوع تطوّع معلومات إضافية لم يُسأل عنها في نفس الرسالة.
- النبرة هادئة، واثقة، راقية. لا ترحّب ترحيباً مطوّلاً ولا تكرر العبارات الجاهزة.

=== قواعد الرد المباشر (مهم جداً) ===
- أجب على قدر السؤال بالضبط. إذا سأل العميل "كم سعر المتر" أعطه الرقم مباشرة، لا تذكر سعر الوحدة الإجمالي ولا تستعرض الحسابات أمامه.
- ممنوع إظهار الحسابات الرياضية في الرد (مثل "700,000 / 197 = 3,553"). الأرقام جاهزة في قاعدة المعرفة، استخدمها مباشرة.
- إذا سأل "كم السعر" دون تحديد، اسأل: "هل تقصد سعر الوحدة الإجمالي أم سعر المتر المربع؟"
- لا تستخدم تنسيقات Markdown مثل *النص العريض* أو # العناوين. واتساب لا يدعمها بشكل موحّد.
- عند ذكر أرقام أو خيارات استخدم سطراً جديداً لكل بند بدون رموز تنسيق.
- لا تذكر معلومة لم يسأل عنها العميل إلا إذا كانت ضرورية لفهم إجابته.

=== التحليل المخفي في نهاية كل رد (إلزامي) ===
في نهاية كل رد، أضف سطراً واحداً مخفياً بهذه الصيغة بالضبط (سيتم حذفه قبل إرسال الرد للعميل، فهو لاستخدام فريق المبيعات فقط):

[META]{"unit":"رمز الوحدة المهتم بها أو فارغ","interest":"وصف اهتمامه باختصار","summary":"ملخص شامل محدّث للعميل في سطر أو سطرين","notes":"الجديد في هذه الرسالة فقط"}[/META]

تعليمات تحليل META:
- "unit": رمز الوحدة من 7 وحدات سماك (SM-A01..SM-A07) أو "غير محدد" أو "متعدد".
- "interest": وصف موجز جداً (سطر واحد) مثل "سكن عائلي" أو "استثمار موسمي" أو "فيلا روف".
- "summary": أهم حقل — ملخص كامل محدّث يغني موظف المبيعات عن قراءة المحادثة: من العميل، ماذا يريد (سكن/استثمار)، ميزانيته، الوحدة المفضلة، آخر تطور أو عائق، والخطوة التالية المطلوبة. أعد كتابته كاملاً في كل رد بأحدث المعلومات. أمثلة:
  • "مستثمر، ميزانيته 650 ألف، معجب بـ SM-A01 لكن يعترض على السعر — يحتاج تواصل من المبيعات لتفاوض"
  • "باحث عن سكن عائلي (5 أفراد)، طلب البروشور واطلع عليه، لم يحدد وحدة بعد — يُنصح بمتابعته بعد يومين"
  • "استفسار أولي فقط، لم يتضح غرضه بعد"
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
- رابط الموقع على الخريطة: https://maps.app.goo.gl/ZbGW4bjhYpkmaguj6?g_st=ic
- إذا سأل العميل عن الموقع أو اللوكيشن أو طريقة الوصول أو العنوان، أرسل الرابط مباشرة في ردك دون الإشارة إلى أي فريق.
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
- الوحدات العادية (197 م²): يبدأ من 3,553 ريال للمتر
- فيلا الروف (477 م²): 2,305 ريال للمتر

الفرق بين الوحدتين في نفس الدور (للأدوار 1-3):
- الوحدة A (SM-A01 / SM-A03 / SM-A05): واجهتان — زاوية المبنى — تطل على شارعين — إضاءة طبيعية من اتجاهين — أكثر خصوصية وأوفر تهوية — سعرها 720,000 ريال.
- الوحدة B (SM-A02 / SM-A04 / SM-A06): واجهة أمامية واحدة — تطل على الشارع الرئيسي — سعرها 700,000 ريال.
- المواصفات الداخلية والمساحة متطابقة تماماً بين الاثنتين في نفس الدور. الفارق فقط في الاتجاه وعدد الواجهات.

📐 المواصفات العامة (وحدات الأدوار 1-3):
- المساحة: 197 م²
- التقسيم الداخلي: 3 غرف نوم + مجلس + غرفة طعام + صالة معيشة + مطبخ + غرفة غسيل + غرفة خادمة
- 4 دورات مياه
- موقف سيارة خاص
- دخول ذكي بصمة
- منزل ذكي (تحكم بالإضاءة والتكييف والدخول من الهاتف)
- خزان أرضي وعلوي مستقل

📐 مواصفات فيلا الروف SM-A07:
- المساحة: 477 م²
- عدد الغرف: 4 غرف نوم
- 4 دورات مياه + غرفة خادمة
- سطح خاص كبير جداً
- خزان أرضي وعلوي مستقل

📸 صور المشروع:
إذا طلب العميل صوراً أو قال "أبغى أشوف" أو "عندكم صور" أو "أرسل صور" أرسل هذا الرابط مباشرة — صفحة معرض الصور فقط بهوية سماك (خارجية وداخلية):
https://semak.sa/gallery

📋 ملف المشروع (بروشور):
إذا طلب العميل بروشوراً أو أي تفاصيل عن المشروع (مواصفات، خامات، ضمانات، تشطيبات)، أرسل الرابط مباشرة:
https://brochure.semak.sa/view.html

═══ الضمانات الموثّقة (مرجع ثابت — لا تتراجع عنها مهما اعترض العميل) ═══
- ضمان الإنشاء (الهيكل الخرساني، الجدران، الأسقف، العزل المائي والحراري): 10 سنوات
- ضمان الكهرباء (الأسلاك، الأفياش، المقابس، المفاتيح، الإنارة، المكيفات): 3 سنوات
- ضمان السباكة داخل الوحدة (الأنابيب، الخلاطات، الصمامات، السخانات، التجهيزات الصحية): 3 سنوات
- ضمان شبكة السباكة الرئيسية للمبنى: 50 سنة
- ضمان الألومنيوم والزجاج (الشبابيك، الأبواب، التجهيزات المعدنية): 10 سنوات (ضمن الضمان الإنشائي)
- خدمات ما بعد البيع: فريق صيانة جاهز عبر بوابة الملاك الإلكترونية + الواتساب الموحد

⚠️ قاعدة: إذا شكّك العميل في معلومة موثّقة أعلاه — لا تعتذر ولا تتراجع. قل بثقة: "هذه المعلومات موثّقة رسمياً في عقد المشروع والبروشور." إذا كانت المعلومة غير موثّقة أعلاه فوجّه للبروشور: https://brochure.semak.sa/view.html

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

═══ حالة الوحدات — مهم جداً ═══
في نهاية هذا البرومبت يوجد قسم "حالة الوحدات (محدّثة الآن من النظام)" — هو المرجع الوحيد للتوافر.
اتبعه حرفياً: إذا كانت الوحدة "مباعة" أو "محجوزة" لا تذكرها ولا تعرضها على العميل إطلاقاً.
لا تستنتج التوافر من أي مكان آخر في هذا النص.

الحالة الأساسية للمشروع (مرجع ثابت):
- SM-A05: مباعة — لا تعرضها
- SM-A07: مباعة — لا تعرضها
إذا قال النظام غير ذلك فالنظام أولى، وإن لم يقل شيئاً فهذا هو المرجع.

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

        // الرسائل الصادرة (الموظف يرسل) — نفحص كلمات الإيقاف/الاستئناف أولاً قبل التجاهل
        if (($payload['direction'] ?? '') === 'out') {
            $out_body  = $payload['message_body']['text']['body']
                      ?? $payload['message_body']['body']
                      ?? $payload['text']['body']
                      ?? $payload['body']
                      ?? '';
            $out_phone = preg_replace('/\D/', '', $payload['to'] ?? $payload['from'] ?? '');
            if ($out_phone && $out_body !== '') {
                $conn->query(
                    "CREATE TABLE IF NOT EXISTS wa_bot_paused (
                        phone      VARCHAR(50) NOT NULL PRIMARY KEY,
                        paused     TINYINT(1)  NOT NULL DEFAULT 0,
                        updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
                );
                $safe_out = $conn->real_escape_string($out_phone);
                if (mb_strpos($out_body, 'حياك الله') !== false) {
                    $conn->query("INSERT INTO wa_bot_paused (phone, paused) VALUES ('$safe_out', 1)
                                  ON DUPLICATE KEY UPDATE paused = 1");
                    file_put_contents($log_file,
                        date('Y-m-d H:i:s') . " | BOT PAUSED for $out_phone (outgoing: حياك الله)\n", FILE_APPEND);
                } elseif (mb_strpos($out_body, 'سعدنا بخدمتك') !== false) {
                    $conn->query("INSERT INTO wa_bot_paused (phone, paused) VALUES ('$safe_out', 0)
                                  ON DUPLICATE KEY UPDATE paused = 0");
                    file_put_contents($log_file,
                        date('Y-m-d H:i:s') . " | BOT RESUMED for $out_phone (outgoing: سعدنا بخدمتك)\n", FILE_APPEND);
                }
            }
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

        // ── تحقق ١: chat_status — إذا المحادثة معيّنة لموظف في Azeer → فهد يسكت ──
        if (($payload['chat_status'] ?? '') === 'assigned') {
            file_put_contents($log_file,
                date('Y-m-d H:i:s') . " | chat_status=assigned → agent handling, skipping Claude for $from_phone\n",
                FILE_APPEND);
            echo json_encode(["ok" => true, "bot_paused" => true, "reason" => "chat_assigned"]);
            break;
        }

        // ── تحقق ٢: هل البوت موقوف يدوياً لهذا الرقم؟ ──
        $bp_r = $conn->query("SELECT paused FROM wa_bot_paused WHERE phone='$safe_phone' LIMIT 1");
        if ($bp_r && ($bp_row = $bp_r->fetch_assoc()) && $bp_row['paused']) {
            file_put_contents($log_file,
                date('Y-m-d H:i:s') . " | bot manually paused for $from_phone → skipping Claude\n",
                FILE_APPEND);
            echo json_encode(["ok" => true, "bot_paused" => true, "reason" => "manual_pause"]);
            break;
        }

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

        // ── جلب محتوى البروشور الحالي (cache 6 ساعات — يتجدد تلقائياً عند تحديث البروشور) ──
        $brochure_cache_path = __DIR__ . '/brochure_cache_v2.txt';
        $cache_ttl = 6 * 3600;
        $brochure_fetched = '';
        $need_fetch = !file_exists($brochure_cache_path) || (time() - filemtime($brochure_cache_path)) > $cache_ttl;
        if ($need_fetch) {
            $bch = curl_init('https://brochure.semak.sa/view.html');
            curl_setopt_array($bch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT      => 'SemakBot/1.0',
            ]);
            $bhtml = curl_exec($bch);
            $berr  = curl_errno($bch);
            curl_close($bch);
            if (!$berr && $bhtml) {
                // احذف الصور المضمّنة (base64) لتقليل الحجم قبل المعالجة
                $bhtml = preg_replace('/src=["\']data:[^"\']{20,}["\']/', 'src=""', $bhtml);
                $bhtml = preg_replace('/<script\b[^>]*>.*?<\/script>/si', '', $bhtml);
                $bhtml = preg_replace('/<style\b[^>]*>.*?<\/style>/si',  '', $bhtml);
                $btext = strip_tags($bhtml);
                $btext = preg_replace('/\h+/', ' ', $btext);
                $btext = preg_replace('/(\n\s*){3,}/', "\n\n", trim($btext));
                $btext = mb_substr($btext, 0, 10000);
                file_put_contents($brochure_cache_path, $btext);
                $brochure_fetched = $btext;
            } elseif (file_exists($brochure_cache_path)) {
                // إذا فشل الجلب استخدم الـ cache القديم
                $brochure_fetched = file_get_contents($brochure_cache_path);
            }
        } else {
            $brochure_fetched = file_get_contents($brochure_cache_path);
        }
        if (!empty($brochure_fetched)) {
            $customer_context .= "\n═══ محتوى البروشور الرسمي (مُحدَّث تلقائياً — هذا هو المرجع الأحدث والأدق) ═══\n" . $brochure_fetched . "\n";
        }

        // ── تحديث يومي: ثقافة السوق العقاري (أخبار + لوائح + أسعار) ──
        $market_cache_path = __DIR__ . '/market_knowledge.txt';
        $market_cache_ttl  = 24 * 3600;
        $market_knowledge  = '';
        $need_market_fetch = !file_exists($market_cache_path)
            || (time() - filemtime($market_cache_path)) > $market_cache_ttl;

        if ($need_market_fetch) {
            $rss_feeds = [
                'https://www.argaam.com/ar/sectors/sector/24/feed',
                'https://www.aleqt.com/rss/property.xml',
            ];
            $headlines = [];
            foreach ($rss_feeds as $rss_url) {
                $mch = curl_init($rss_url);
                curl_setopt_array($mch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT        => 8,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; SemakBot/1.0)',
                ]);
                $rss_raw = curl_exec($mch);
                curl_close($mch);
                if (!$rss_raw) continue;
                preg_match_all('/<title><!\[CDATA\[(.*?)\]\]><\/title>/si', $rss_raw, $m_cdata);
                preg_match_all('/<title>(.*?)<\/title>/si', $rss_raw, $m_plain);
                $all_titles = array_unique(array_merge($m_cdata[1] ?? [], $m_plain[1] ?? []));
                $all_titles = array_slice($all_titles, 1, 12);
                foreach ($all_titles as $t) {
                    $t = html_entity_decode(strip_tags(trim($t)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    if (mb_strlen($t) > 10) $headlines[] = $t;
                }
            }

            if (count($headlines) >= 3) {
                $headlines_text = implode("\n- ", array_unique($headlines));
                $msum_ch = curl_init('https://api.anthropic.com/v1/messages');
                curl_setopt_array($msum_ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST           => true,
                    CURLOPT_TIMEOUT        => 25,
                    CURLOPT_HTTPHEADER     => [
                        'Content-Type: application/json',
                        'x-api-key: __ANTHROPIC_KEY__',
                        'anthropic-version: 2023-06-01',
                    ],
                    CURLOPT_POSTFIELDS => json_encode([
                        'model'      => 'claude-haiku-4-5-20251001',
                        'max_tokens' => 500,
                        'messages'   => [[
                            'role'    => 'user',
                            'content' => "أنت محلل عقاري. لخّص هذه الأخبار العقارية السعودية في 5-7 نقاط مفيدة لمستشار مبيعات عقاري في مكة المكرمة يريد إثراء معرفته بالسوق الحالي. ركّز على: أسعار العقارات، التمويل العقاري، اللوائح الجديدة، الطلب والعرض، الاتجاهات. أجب بالعربية فقط بصيغة نقاط:\n\n- $headlines_text",
                        ]],
                    ], JSON_UNESCAPED_UNICODE),
                ]);
                $msum_raw = curl_exec($msum_ch);
                curl_close($msum_ch);
                $msum_data  = json_decode($msum_raw, true);
                $mkt_summary = trim($msum_data['content'][0]['text'] ?? '');
                if ($mkt_summary) {
                    $mkt_dated = "التحديث: " . date('Y-m-d') . "\n" . $mkt_summary;
                    file_put_contents($market_cache_path, $mkt_dated);
                    $market_knowledge = $mkt_dated;
                }
            }
            if (empty($market_knowledge) && file_exists($market_cache_path)) {
                $market_knowledge = file_get_contents($market_cache_path);
            }
            file_put_contents($log_file,
                date('Y-m-d H:i:s') . " | market_knowledge: " . (empty($market_knowledge) ? "FAILED/EMPTY" : "updated " . strlen($market_knowledge) . " chars") . "\n",
                FILE_APPEND);
        } else {
            $market_knowledge = file_get_contents($market_cache_path);
        }

        if (!empty($market_knowledge)) {
            $customer_context .= "\n═══ ثقافة السوق العقاري (مُحدَّث يومياً — للاستئناس لا للاقتباس) ═══\n" . $market_knowledge . "\n";
        }

        // ── حالة الوحدات من قاعدة البيانات (حي - يُحدَّث مع كل محادثة) ──
        $units_context = "\n═══ حالة الوحدات (محدّثة الآن من النظام) ═══\n";
        $units_q = $conn->query(
            "SELECT u.unit_code, u.status, o.owner_name
             FROM units u
             LEFT JOIN owners o ON o.unit_code = u.unit_code AND o.tenant_id = u.tenant_id
             WHERE u.unit_code IN ('SM-A01','SM-A02','SM-A03','SM-A04','SM-A05','SM-A06','SM-A07')
             ORDER BY u.unit_code ASC"
        );
        $units_live = [];
        if ($units_q) {
            while ($ur = $units_q->fetch_assoc()) {
                $units_live[$ur['unit_code']] = $ur['status'];
            }
        }
        // وحدات موجودة في owners لكن ربما غير في units
        $owners_q = $conn->query(
            "SELECT unit_code FROM owners
             WHERE unit_code IN ('SM-A01','SM-A02','SM-A03','SM-A04','SM-A05','SM-A06','SM-A07')"
        );
        if ($owners_q) {
            while ($or2 = $owners_q->fetch_assoc()) {
                if (!isset($units_live[$or2['unit_code']])) {
                    $units_live[$or2['unit_code']] = 'مباعة';
                }
            }
        }
        // وحدات مباعة بشكل قاطع بغض النظر عن قاعدة البيانات
        $sold_override = ['SM-A05' => true, 'SM-A07' => true];
        $all_units = ['SM-A01','SM-A02','SM-A03','SM-A04','SM-A05','SM-A06','SM-A07'];
        foreach ($all_units as $uc) {
            if (isset($sold_override[$uc])) {
                $units_context .= "- $uc: مباعة\n";
                continue;
            }
            $st = $units_live[$uc] ?? 'متاح';
            $label = $st === 'مباعة' ? 'مباعة' : ($st === 'محجوز' ? 'محجوزة' : 'متاحة للبيع');
            $units_context .= "- $uc: $label\n";
        }
        $units_context .= "استخدم هذه الحالة دائماً ولا تعتمد على ما في ذاكرتك. إذا كانت الوحدة مباعة أو محجوزة لا تعرضها على العميل.\n";
        $customer_context .= $units_context;

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

        // ── رد فوري على طلب الموقع / اللوكيشن (بدون Claude) ──
        $loc_keywords = ['لوكيشن','الموقع','موقع','وين','فين','العنوان','الخريطة','خريطة','كيف اوصل','كيف أوصل','طريقة الوصول','location','map'];
        $user_msg_lower = mb_strtolower($user_msg, 'UTF-8');
        $is_location_request = false;
        foreach ($loc_keywords as $kw) {
            if (mb_strpos($user_msg_lower, mb_strtolower($kw, 'UTF-8')) !== false) {
                $is_location_request = true;
                break;
            }
        }
        if ($is_location_request) {
            $loc_reply = "يسعدنا خدمتكم.\n\nموقع مشروع سماك البوابة 1 على الخريطة:\nhttps://maps.app.goo.gl/ZbGW4bjhYpkmaguj6?g_st=ic\n\nالمشروع في حي البوابة، مكة المكرمة. للاستفسار والحجز: 920032842";
            $safe_loc_reply = $conn->real_escape_string($loc_reply);
            $conn->query("INSERT INTO wa_bot_conversations (phone, role, message) VALUES ('$safe_phone', 'assistant', '$safe_loc_reply')");
            $wa_loc_payload = json_encode(["to" => $from_phone, "type" => "text", "text" => ["body" => $loc_reply]], JSON_UNESCAPED_UNICODE);
            $ch_loc = curl_init("{$mottasl_base}/message/send");
            curl_setopt_array($ch_loc, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $wa_loc_payload,
                CURLOPT_HTTPHEADER => ["Content-Type: application/json", "Authorization: Bearer {$mottasl_key}"], CURLOPT_TIMEOUT => 10]);
            $loc_result = curl_exec($ch_loc);
            curl_close($ch_loc);
            file_put_contents($log_file, date('Y-m-d H:i:s') . " | location_auto_reply → $from_phone\n", FILE_APPEND);
            echo json_encode(["ok" => true, "type" => "location_reply", "sent" => json_decode($loc_result, true)]);
            break;
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
                $u_summary  = trim($meta['summary']  ?? '');

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
                    // الملخص المحدّث يستبدل السابق دائماً (آخر صورة كاملة للعميل)
                    if ($u_summary !== '' && !in_array($u_summary, $skip_notes) && mb_strlen($u_summary) > 3) {
                        $safe_s = $conn->real_escape_string(mb_substr($u_summary, 0, 590));
                        $fields[] = "summary='$safe_s'";
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

    // ══════════════════════════════════════════════════════════════════════
    // قوائم المحرّك المستقل — عملاء / موردون / منتجات (acc_* tables)
    // ══════════════════════════════════════════════════════════════════════

    case 'acc_parties_list':
        // قائمة أطراف من acc_parties مع رصيد محسوب من acc_lines
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $type = $conn->real_escape_string($_GET['type'] ?? '');
        $q    = $conn->real_escape_string(trim($_GET['search'] ?? ''));
        $pg   = max(1,(int)($_GET['page'] ?? 1));
        $lim  = min(500,(int)($_GET['limit'] ?? 50)); $off = ($pg-1)*$lim;
        $w    = "p.tenant_id=$tid AND p.status=1";
        if (in_array($type, ['customer','supplier','partner'])) $w .= " AND p.type='$type'";
        if ($q) $w .= " AND (p.name LIKE '%$q%' OR p.phone LIKE '%$q%' OR p.email LIKE '%$q%' OR p.vat_number LIKE '%$q%')";
        $res = $conn->query("
            SELECT p.id,p.type,p.name,p.phone,p.email,p.address,p.vat_number,p.cr_number,
                   COALESCE(p.notes,'') notes, COALESCE(p.daftra_id,'') daftra_id, p.created_at,
                   COALESCE(b.net,0) net
            FROM acc_parties p
            LEFT JOIN (SELECT party_id, SUM(debit-credit) net FROM acc_lines WHERE tenant_id=$tid GROUP BY party_id) b ON b.party_id=p.id
            WHERE $w ORDER BY p.name LIMIT $lim OFFSET $off
        ");
        $rows = [];
        while ($res && ($x = $res->fetch_assoc())) {
            $net = (float)$x['net'];
            $x['balance'] = round($x['type'] === 'supplier' ? -$net : $net, 2);
            unset($x['net']);
            $rows[] = $x;
        }
        $ct = $conn->query("SELECT COUNT(*) c FROM acc_parties p WHERE $w");
        $total = $ct ? (int)$ct->fetch_assoc()['c'] : 0;
        echo json_encode(['success'=>true,'data'=>$rows,'total'=>$total,'has_next_page'=>($off+$lim)<$total], JSON_UNESCAPED_UNICODE);
        break;

    case 'acc_products_list':
        // قائمة منتجات من acc_products
        $tid  = $_jwt_tid ?? (int)($_GET['tenant'] ?? 1);
        $q    = $conn->real_escape_string(trim($_GET['search'] ?? ''));
        $pg   = max(1,(int)($_GET['page'] ?? 1));
        $lim  = 50; $off = ($pg-1)*$lim;
        $w    = "tenant_id=$tid AND status=1";
        if ($q) $w .= " AND (name LIKE '%$q%' OR code LIKE '%$q%' OR description LIKE '%$q%')";
        $res = $conn->query("SELECT * FROM acc_products WHERE $w ORDER BY name LIMIT $lim OFFSET $off");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        $ct = $conn->query("SELECT COUNT(*) c FROM acc_products WHERE $w");
        $total = $ct ? (int)$ct->fetch_assoc()['c'] : 0;
        echo json_encode(['success'=>true,'data'=>$rows,'total'=>$total,'has_next_page'=>($off+$lim)<$total], JSON_UNESCAPED_UNICODE);
        break;

    case 'acc_product_save':
        // حفظ منتج (إنشاء أو تحديث)
        $tid  = $_jwt_tid ?? (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $code = $conn->real_escape_string(trim($input_data['code'] ?? ''));
        $desc = $conn->real_escape_string(trim($input_data['description'] ?? ''));
        $unit = $conn->real_escape_string(trim($input_data['unit'] ?? 'قطعة'));
        $up   = round((float)($input_data['unit_price'] ?? 0), 2);
        $bp   = round((float)($input_data['buy_price'] ?? 0), 2);
        $tr   = round((float)($input_data['tax_rate'] ?? 15), 3);
        if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
        if ($id) {
            $conn->query("UPDATE acc_products SET name='$name',code='$code',description='$desc',unit='$unit',unit_price=$up,buy_price=$bp,tax_rate=$tr WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>true,'id'=>$id,'message'=>'تم التحديث'], JSON_UNESCAPED_UNICODE);
        } else {
            $ok = $conn->query("INSERT INTO acc_products (tenant_id,name,code,description,unit,unit_price,buy_price,tax_rate) VALUES ($tid,'$name','$code','$desc','$unit',$up,$bp,$tr)");
            echo json_encode(['success'=>(bool)$ok,'id'=>$conn->insert_id,'message'=>$ok?'تم الإنشاء':$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'acc_product_delete':
        // حذف منتج — تعطيل إذا له حركات في الفواتير، وإلا حذف فعلي
        $tid = $_jwt_tid ?? (int)($_GET['tenant'] ?? $input_data['tenant_id'] ?? 1);
        $id  = (int)($_GET['id'] ?? $input_data['id'] ?? 0);
        if (!$id) { echo json_encode(['success'=>false,'message'=>'المعرّف مطلوب']); break; }
        $u = $conn->query("SELECT COUNT(*) c FROM acc_invoice_items WHERE product_id=$id AND tenant_id=$tid");
        $used = $u ? (int)$u->fetch_assoc()['c'] : 0;
        if ($used > 0) {
            $conn->query("UPDATE acc_products SET status=0 WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>true,'message'=>'تم التعطيل (مرتبط بحركات فواتير)','deactivated'=>true], JSON_UNESCAPED_UNICODE);
        } else {
            $conn->query("DELETE FROM acc_products WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>true,'message'=>'تم الحذف'], JSON_UNESCAPED_UNICODE);
        }
        break;

    // ═══════════════════════════════════════════════════════════════════════
    // بوابة التقنية — sw_* endpoints  (tenant-isolated v5)
    // ═══════════════════════════════════════════════════════════════════════

    case 'sw_overview': {
        $stid = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $clients_total  = (int)(($r=$conn->query("SELECT COUNT(*) c FROM sw_clients WHERE tenant_id=$stid")) ? $r->fetch_assoc()['c'] : 0);
        $clients_active = (int)(($r=$conn->query("SELECT COUNT(*) c FROM sw_clients WHERE tenant_id=$stid AND status='active'")) ? $r->fetch_assoc()['c'] : 0);
        $tickets_open   = (int)(($r=$conn->query("SELECT COUNT(*) c FROM sw_tickets WHERE tenant_id=$stid AND status IN ('open','in_progress')")) ? $r->fetch_assoc()['c'] : 0);
        $tickets_crit   = (int)(($r=$conn->query("SELECT COUNT(*) c FROM sw_tickets WHERE tenant_id=$stid AND status='open' AND priority='critical'")) ? $r->fetch_assoc()['c'] : 0);
        $now = date('Y-m');
        $rev_mtd = 0;
        $rr = $conn->query("SELECT SUM(amount) s FROM sw_invoices WHERE tenant_id=$stid AND status='paid' AND DATE_FORMAT(paid_date,'%Y-%m')='$now'");
        if ($rr && $row = $rr->fetch_assoc()) $rev_mtd = (float)($row['s'] ?? 0);
        $inv_ov = (int)(($r=$conn->query("SELECT COUNT(*) c FROM sw_invoices WHERE tenant_id=$stid AND status='overdue'")) ? $r->fetch_assoc()['c'] : 0);
        $ov_amt = 0;
        $ra = $conn->query("SELECT SUM(amount) s FROM sw_invoices WHERE tenant_id=$stid AND status='overdue'");
        if ($ra && $row = $ra->fetch_assoc()) $ov_amt = (float)($row['s'] ?? 0);

        $recent_t = []; $rt = $conn->query("SELECT t.*,c.name client_name FROM sw_tickets t LEFT JOIN sw_clients c ON c.id=t.client_id AND c.tenant_id=$stid WHERE t.tenant_id=$stid ORDER BY t.id DESC LIMIT 5");
        while ($rt && $x = $rt->fetch_assoc()) $recent_t[] = $x;

        $recent_c = []; $rc = $conn->query("SELECT id,name,company,email,status,created_at FROM sw_clients WHERE tenant_id=$stid ORDER BY id DESC LIMIT 5");
        while ($rc && $x = $rc->fetch_assoc()) $recent_c[] = $x;

        echo json_encode(['success'=>true,'clients_total'=>$clients_total,'clients_active'=>$clients_active,
            'tickets_open'=>$tickets_open,'tickets_critical'=>$tickets_crit,
            'revenue_mtd'=>$rev_mtd,'invoices_overdue'=>$inv_ov,'overdue_amount'=>$ov_amt,
            'recent_tickets'=>$recent_t,'recent_clients'=>$recent_c], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_clients_list': {
        $stid = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $rows = []; $r = $conn->query("SELECT * FROM sw_clients WHERE tenant_id=$stid ORDER BY id DESC");
        while ($r && $x = $r->fetch_assoc()) $rows[] = $x;
        echo json_encode(['success'=>true,'clients'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_client_save': {
        $stid    = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $id      = (int)($input_data['id'] ?? 0);
        $name    = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $company = $conn->real_escape_string(trim($input_data['company'] ?? ''));
        $email   = $conn->real_escape_string(trim($input_data['email'] ?? ''));
        $phone   = $conn->real_escape_string(trim($input_data['phone'] ?? ''));
        $notes   = $conn->real_escape_string(trim($input_data['notes'] ?? ''));
        $status  = $conn->real_escape_string($input_data['status'] ?? 'prospect');
        if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
        if ($id > 0) {
            $conn->query("UPDATE sw_clients SET name='$name',company='$company',email='$email',phone='$phone',notes='$notes',status='$status' WHERE id=$id AND tenant_id=$stid");
        } else {
            $conn->query("INSERT INTO sw_clients (tenant_id,name,company,email,phone,notes,status) VALUES ($stid,'$name','$company','$email','$phone','$notes','$status')");
            $id = $conn->insert_id;
        }
        echo json_encode(['success'=>true,'id'=>$id], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_client_del': {
        $stid = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $id = (int)($input_data['id'] ?? 0);
        if ($id > 0) $conn->query("DELETE FROM sw_clients WHERE id=$id AND tenant_id=$stid");
        echo json_encode(['success'=>true]);
        break;
    }

    case 'sw_tickets_list': {
        $stid = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $rows = []; $r = $conn->query("SELECT t.*,c.name client_name FROM sw_tickets t LEFT JOIN sw_clients c ON c.id=t.client_id AND c.tenant_id=$stid WHERE t.tenant_id=$stid ORDER BY t.id DESC");
        while ($r && $x = $r->fetch_assoc()) $rows[] = $x;
        echo json_encode(['success'=>true,'tickets'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_ticket_save': {
        $stid     = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $id       = (int)($input_data['id'] ?? 0);
        $cid      = (int)($input_data['client_id'] ?? 0);
        $subject  = $conn->real_escape_string(trim($input_data['subject'] ?? ''));
        $body     = $conn->real_escape_string(trim($input_data['body'] ?? ''));
        $status   = $conn->real_escape_string($input_data['status'] ?? 'open');
        $priority = $conn->real_escape_string($input_data['priority'] ?? 'medium');
        if (!$subject) { echo json_encode(['success'=>false,'message'=>'العنوان مطلوب']); break; }
        // جلب اسم العميل (مع تحقق الانتماء للمستأجر)
        $cname = '';
        if ($cid > 0) { $cr=$conn->query("SELECT name FROM sw_clients WHERE id=$cid AND tenant_id=$stid LIMIT 1"); if($cr&&$cx=$cr->fetch_assoc()) $cname=$conn->real_escape_string($cx['name']); }
        if ($id > 0) {
            $conn->query("UPDATE sw_tickets SET client_id=$cid,client_name='$cname',subject='$subject',body='$body',status='$status',priority='$priority' WHERE id=$id AND tenant_id=$stid");
        } else {
            $conn->query("INSERT INTO sw_tickets (tenant_id,client_id,client_name,subject,body,status,priority) VALUES ($stid,$cid,'$cname','$subject','$body','$status','$priority')");
            $id = $conn->insert_id;
        }
        echo json_encode(['success'=>true,'id'=>$id], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_ticket_update': {
        $stid   = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $id     = (int)($input_data['id'] ?? 0);
        $status = $conn->real_escape_string($input_data['status'] ?? '');
        if ($id > 0 && $status) $conn->query("UPDATE sw_tickets SET status='$status',updated_at=NOW() WHERE id=$id AND tenant_id=$stid");
        echo json_encode(['success'=>true]);
        break;
    }

    case 'sw_ticket_replies': {
        $stid = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $tid = (int)($_GET['ticket_id'] ?? $input_data['ticket_id'] ?? 0);
        // نتحقق أن التذكرة تنتمي للمستأجر ثم نجلب الردود
        $rows = []; $r = $conn->query("SELECT r.* FROM sw_ticket_replies r INNER JOIN sw_tickets t ON t.id=r.ticket_id AND t.tenant_id=$stid WHERE r.ticket_id=$tid ORDER BY r.id ASC");
        while ($r && $x = $r->fetch_assoc()) $rows[] = $x;
        echo json_encode(['success'=>true,'replies'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_ticket_reply': {
        $stid = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $tid  = (int)($input_data['ticket_id'] ?? 0);
        $body = $conn->real_escape_string(trim($input_data['body'] ?? ''));
        $uid  = (int)($_jwt_claims['uid'] ?? 0);
        $uname = ''; if ($uid) { $ur=$conn->query("SELECT name FROM users WHERE id=$uid LIMIT 1"); if($ur&&$ux=$ur->fetch_assoc()) $uname=$conn->real_escape_string($ux['name']); }
        if (!$tid || !$body) { echo json_encode(['success'=>false,'message'=>'بيانات ناقصة']); break; }
        // نتحقق أن التذكرة تنتمي للمستأجر الحالي قبل الإضافة
        $chk = $conn->query("SELECT id FROM sw_tickets WHERE id=$tid AND tenant_id=$stid LIMIT 1");
        if (!$chk || !$chk->fetch_assoc()) { echo json_encode(['success'=>false,'message'=>'تذكرة غير موجودة']); break; }
        $conn->query("INSERT INTO sw_ticket_replies (ticket_id,tenant_id,user_id,user_name,body) VALUES ($tid,$stid,$uid,'$uname','$body')");
        $rid = $conn->insert_id;
        $conn->query("UPDATE sw_tickets SET updated_at=NOW() WHERE id=$tid AND tenant_id=$stid");
        $reply = ['id'=>$rid,'ticket_id'=>$tid,'user_id'=>$uid,'user_name'=>$uname,'body'=>$input_data['body'],'created_at'=>date('Y-m-d H:i:s')];
        echo json_encode(['success'=>true,'reply'=>$reply], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_products_list': {
        $stid = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $rows = []; $r = $conn->query("SELECT * FROM sw_products WHERE tenant_id=$stid ORDER BY active DESC, id DESC");
        while ($r && $x = $r->fetch_assoc()) $rows[] = $x;
        echo json_encode(['success'=>true,'products'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_product_save': {
        $stid  = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $id    = (int)($input_data['id'] ?? 0);
        $name  = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $type  = $conn->real_escape_string($input_data['type'] ?? 'subscription');
        $price = (float)($input_data['price'] ?? 0);
        $cycle = $conn->real_escape_string($input_data['billing_cycle'] ?? 'yearly');
        $desc  = $conn->real_escape_string(trim($input_data['description'] ?? ''));
        $active= isset($input_data['active']) ? (int)$input_data['active'] : 1;
        if ($id > 0) {
            $conn->query("UPDATE sw_products SET name='$name',type='$type',price=$price,billing_cycle='$cycle',description='$desc',active=$active WHERE id=$id AND tenant_id=$stid");
        } else {
            if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
            $conn->query("INSERT INTO sw_products (tenant_id,name,type,price,billing_cycle,description,active) VALUES ($stid,'$name','$type',$price,'$cycle','$desc',$active)");
            $id = $conn->insert_id;
        }
        echo json_encode(['success'=>true,'id'=>$id], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_invoices_list': {
        $stid = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $rows = []; $r = $conn->query("SELECT i.*,c.name client_name,p.name product_name FROM sw_invoices i LEFT JOIN sw_clients c ON c.id=i.client_id AND c.tenant_id=$stid LEFT JOIN sw_products p ON p.id=i.product_id AND p.tenant_id=$stid WHERE i.tenant_id=$stid ORDER BY i.id DESC");
        while ($r && $x = $r->fetch_assoc()) $rows[] = $x;
        echo json_encode(['success'=>true,'invoices'=>$rows], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'sw_invoice_save': {
        $stid   = $_jwt_tid ?? 1;
        if (!tenant_feature($conn, $stid, 'sw_portal')) { echo json_encode(['success'=>false,'message'=>'بوابة التقنية غير متاحة في خطتك الحالية.'], JSON_UNESCAPED_UNICODE); break; }
        $id     = (int)($input_data['id'] ?? 0);
        $cid    = (int)($input_data['client_id'] ?? 0);
        $pid    = (int)($input_data['product_id'] ?? 0);
        $amount = (float)($input_data['amount'] ?? 0);
        $status = $conn->real_escape_string($input_data['status'] ?? 'draft');
        $notes  = $conn->real_escape_string(trim($input_data['notes'] ?? ''));
        $issue  = $conn->real_escape_string($input_data['issue_date'] ?? date('Y-m-d'));
        $due    = $conn->real_escape_string($input_data['due_date'] ?? '');
        $paid   = $conn->real_escape_string($input_data['paid_date'] ?? '');
        // جلب اسم العميل والمنتج (مع تحقق الانتماء للمستأجر)
        $cname = ''; if ($cid) { $cr=$conn->query("SELECT name FROM sw_clients WHERE id=$cid AND tenant_id=$stid LIMIT 1"); if($cr&&$cx=$cr->fetch_assoc()) $cname=$conn->real_escape_string($cx['name']); }
        $pname = ''; if ($pid) { $pr=$conn->query("SELECT name FROM sw_products WHERE id=$pid AND tenant_id=$stid LIMIT 1"); if($pr&&$px=$pr->fetch_assoc()) $pname=$conn->real_escape_string($px['name']); }
        $dueV  = $due  ? "'$due'"  : 'NULL';
        $paidV = $paid ? "'$paid'" : 'NULL';
        if ($id > 0) {
            $conn->query("UPDATE sw_invoices SET client_id=$cid,client_name='$cname',product_id=$pid,product_name='$pname',amount=$amount,status='$status',issue_date='$issue',due_date=$dueV,paid_date=$paidV,notes='$notes' WHERE id=$id AND tenant_id=$stid");
        } else {
            $conn->query("INSERT INTO sw_invoices (tenant_id,client_id,client_name,product_id,product_name,amount,status,issue_date,due_date,paid_date,notes) VALUES ($stid,$cid,'$cname',$pid,'$pname',$amount,'$status','$issue',$dueV,$paidV,'$notes')");
            $id = $conn->insert_id;
            $no = 'INV-' . str_pad($id, 4, '0', STR_PAD_LEFT);
            $conn->query("UPDATE sw_invoices SET invoice_no='$no' WHERE id=$id AND tenant_id=$stid");
        }
        echo json_encode(['success'=>true,'id'=>$id], JSON_UNESCAPED_UNICODE);
        break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // مشتريات وتعاقدات العقارية — re_contracts + re_purchase_orders
    // ══════════════════════════════════════════════════════════════════════════

    case 're_contracts_list': {
        $tid  = (int)($_jwt_claims['tid'] ?? 1);
        $rows = [];
        $res  = $conn->query("
            SELECT c.*, p.name AS project_name
            FROM re_contracts c
            LEFT JOIN projects p ON p.id = c.project_id
            WHERE c.tenant_id = $tid
            ORDER BY c.created_at DESC
        ");
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        echo json_encode(['success'=>true, 'contracts'=>$rows]);
        break;
    }

    case 're_contract_save': {
        $tid = (int)($_jwt_claims['tid'] ?? 1);
        $id  = (int)($body['id'] ?? 0);
        $pj  = (int)($body['project_id'] ?? 0) ?: 'NULL';
        $cn  = $conn->real_escape_string($body['contractor_name'] ?? '');
        $cp  = $conn->real_escape_string($body['contractor_phone'] ?? '');
        $wt  = $conn->real_escape_string($body['work_type'] ?? '');
        $cv  = (float)($body['contract_value'] ?? 0);
        $aa  = (float)($body['advance_amount'] ?? 0);
        $sd  = $conn->real_escape_string($body['start_date'] ?? '');
        $ed  = $conn->real_escape_string($body['end_date'] ?? '');
        $st  = in_array($body['status']??'', ['draft','active','on_hold','completed','cancelled']) ? $body['status'] : 'draft';
        $nt  = $conn->real_escape_string($body['notes'] ?? '');
        $sd_q = $sd ? "'$sd'" : 'NULL';
        $ed_q = $ed ? "'$ed'" : 'NULL';
        if ($id) {
            $conn->query("UPDATE re_contracts SET
                project_id=$pj, contractor_name='$cn', contractor_phone='$cp',
                work_type='$wt', contract_value=$cv, advance_amount=$aa,
                start_date=$sd_q, end_date=$ed_q, status='$st', notes='$nt'
                WHERE id=$id AND tenant_id=$tid");
        } else {
            $yr  = date('Ym');
            $seq_r = $conn->query("SELECT COUNT(*)+1 AS n FROM re_contracts WHERE tenant_id=$tid AND contract_no LIKE 'RC-$yr-%'");
            $seq = str_pad((int)($seq_r->fetch_assoc()['n'] ?? 1), 4, '0', STR_PAD_LEFT);
            $cno = "RC-$yr-$seq";
            $conn->query("INSERT INTO re_contracts
                (tenant_id,project_id,contract_no,contractor_name,contractor_phone,
                 work_type,contract_value,advance_amount,start_date,end_date,status,notes)
                VALUES ($tid,$pj,'$cno','$cn','$cp','$wt',$cv,$aa,$sd_q,$ed_q,'$st','$nt')");
            $id = $conn->insert_id;
        }
        echo json_encode(['success'=>true, 'id'=>$id]);
        break;
    }

    case 're_purchases_list': {
        $tid  = (int)($_jwt_claims['tid'] ?? 1);
        $rows = [];
        $res  = $conn->query("
            SELECT po.*, p.name AS project_name
            FROM re_purchase_orders po
            LEFT JOIN projects p ON p.id = po.project_id
            WHERE po.tenant_id = $tid
            ORDER BY po.created_at DESC
        ");
        while ($r = $res->fetch_assoc()) {
            $r['items'] = json_decode($r['items'] ?? '[]', true) ?: [];
            $rows[] = $r;
        }
        echo json_encode(['success'=>true, 'orders'=>$rows]);
        break;
    }

    case 're_purchase_save': {
        $tid = (int)($_jwt_claims['tid'] ?? 1);
        $id  = (int)($body['id'] ?? 0);
        $pj  = (int)($body['project_id'] ?? 0) ?: 'NULL';
        $sn  = $conn->real_escape_string($body['supplier_name'] ?? '');
        $sp  = $conn->real_escape_string($body['supplier_phone'] ?? '');
        $od  = $conn->real_escape_string($body['order_date'] ?? date('Y-m-d'));
        $dd  = $conn->real_escape_string($body['delivery_date'] ?? '');
        $ta  = (float)($body['total_amount'] ?? 0);
        $st  = in_array($body['status']??'', ['draft','ordered','partial','received','cancelled']) ? $body['status'] : 'draft';
        $it  = $conn->real_escape_string(json_encode($body['items'] ?? []));
        $nt  = $conn->real_escape_string($body['notes'] ?? '');
        $dd_q = $dd ? "'$dd'" : 'NULL';
        if ($id) {
            $conn->query("UPDATE re_purchase_orders SET
                project_id=$pj, supplier_name='$sn', supplier_phone='$sp',
                order_date='$od', delivery_date=$dd_q, total_amount=$ta,
                status='$st', items='$it', notes='$nt'
                WHERE id=$id AND tenant_id=$tid");
        } else {
            $yr  = date('Ym');
            $seq_r = $conn->query("SELECT COUNT(*)+1 AS n FROM re_purchase_orders WHERE tenant_id=$tid AND po_no LIKE 'PO-$yr-%'");
            $seq = str_pad((int)($seq_r->fetch_assoc()['n'] ?? 1), 4, '0', STR_PAD_LEFT);
            $pono = "PO-$yr-$seq";
            $conn->query("INSERT INTO re_purchase_orders
                (tenant_id,project_id,po_no,supplier_name,supplier_phone,
                 order_date,delivery_date,total_amount,status,items,notes)
                VALUES ($tid,$pj,'$pono','$sn','$sp','$od',$dd_q,$ta,'$st','$it','$nt')");
            $id = $conn->insert_id;
        }
        echo json_encode(['success'=>true, 'id'=>$id]);
        break;
    }

    default:
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "إجراء غير معروف: ".htmlspecialchars($_GET['action'] ?? '', ENT_QUOTES)]);
        break;
}

$conn->close();
?>
