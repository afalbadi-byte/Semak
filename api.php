<?php
// deploy: 2026-06-04-v396
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
$conn->query("ALTER TABLE acc_lines ADD COLUMN IF NOT EXISTS party_type VARCHAR(12) DEFAULT NULL");
$conn->query("ALTER TABLE acc_lines ADD COLUMN IF NOT EXISTS party_id   INT DEFAULT NULL");
$conn->query("ALTER TABLE acc_lines ADD COLUMN IF NOT EXISTS due_date   DATE DEFAULT NULL");
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

// ─── مُساعدات محرّك المحاسبة المستقل ────────────────────────────────────────
// مُولّد رقم تسلسلي آمن للتزامن (نمط LAST_INSERT_ID الذرّي)
function acc_next_no($conn, $tid, $kind, $yr) {
    $tid = (int)$tid; $yr = (int)$yr; $kind = $conn->real_escape_string($kind);
    $conn->query("INSERT INTO acc_sequences (tenant_id,kind,yr,last_no) VALUES ($tid,'$kind',$yr,LAST_INSERT_ID(1))
                  ON DUPLICATE KEY UPDATE last_no=LAST_INSERT_ID(last_no+1)");
    return (int)$conn->insert_id;
}
// تسجيل حركة في سجل التدقيق
function acc_audit($conn, $tid, $entity, $eid, $action, $detail, $actor) {
    $tid    = (int)$tid;
    $entity = $conn->real_escape_string($entity);
    $action = $conn->real_escape_string($action);
    $detail = $conn->real_escape_string(is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE));
    $actor  = $conn->real_escape_string((string)($actor ?? ''));
    $eidSql = ($eid === null) ? 'NULL' : (int)$eid;
    $conn->query("INSERT INTO acc_audit_log (tenant_id,entity,entity_id,action,detail,actor)
                  VALUES ($tid,'$entity',$eidSql,'$action','$detail'," . ($actor !== '' ? "'$actor'" : 'NULL') . ")");
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
        $pt  = isset($ln['party_type']) && in_array($ln['party_type'], ['customer','supplier']) ? "'".$conn->real_escape_string($ln['party_type'])."'" : 'NULL';
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
        $tid = (int)($_GET['tenant'] ?? 1);
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
        $tid = (int)($_GET['tenant'] ?? 1);
        $sql = "SELECT a.*,
                   COALESCE(SUM(l.debit),0)  AS sum_debit,
                   COALESCE(SUM(l.credit),0) AS sum_credit
                FROM acc_accounts a
                LEFT JOIN acc_lines l ON l.account_id=a.id AND l.tenant_id=a.tenant_id
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
        $tid  = (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $code = $conn->real_escape_string(trim($input_data['code'] ?? ''));
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $type = $conn->real_escape_string($input_data['type'] ?? 'asset');
        $pid  = isset($input_data['parent_id']) && $input_data['parent_id'] !== '' ? (int)$input_data['parent_id'] : 'NULL';
        $grp  = (int)($input_data['is_group'] ?? 0);
        if (!$code || !$name) { echo json_encode(['success'=>false,'message'=>'الكود والاسم مطلوبان']); break; }
        if (!in_array($type, ['asset','liability','equity','revenue','expense'])) $type = 'asset';
        if ($id) {
            $conn->query("UPDATE acc_accounts SET code='$code',name='$name',type='$type',parent_id=$pid,is_group=$grp WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>true,'id'=>$id]);
        } else {
            $ok = $conn->query("INSERT INTO acc_accounts (tenant_id,code,name,type,parent_id,is_group) VALUES ($tid,'$code','$name','$type',$pid,$grp)");
            echo json_encode(['success'=>$ok,'id'=>$conn->insert_id,'message'=>$ok?'تم':$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;

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
            $pt  = isset($ln['party_type']) && in_array($ln['party_type'], ['customer','supplier']) ? "'".$conn->real_escape_string($ln['party_type'])."'" : 'NULL';
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
        $tid = (int)($_GET['tenant'] ?? 1);
        $from = $conn->real_escape_string($_GET['from'] ?? '');
        $to   = $conn->real_escape_string($_GET['to'] ?? '');
        $w = "tenant_id=$tid";
        if ($from) $w .= " AND date>='$from'";
        if ($to)   $w .= " AND date<='$to'";
        $res = $conn->query("SELECT * FROM acc_entries WHERE $w ORDER BY date DESC, id DESC LIMIT 500");
        $rows = []; while ($res && ($x=$res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_entry_single':
        $tid = (int)($_GET['tenant'] ?? 1); $eid = (int)($_GET['id'] ?? 0);
        $h = $conn->query("SELECT * FROM acc_entries WHERE id=$eid AND tenant_id=$tid LIMIT 1");
        $head = $h ? $h->fetch_assoc() : null;
        if (!$head) { echo json_encode(['success'=>false,'message'=>'القيد غير موجود']); break; }
        $lr = $conn->query("SELECT l.*, a.code account_code, a.name account_name FROM acc_lines l JOIN acc_accounts a ON a.id=l.account_id WHERE l.entry_id=$eid ORDER BY l.id");
        $lines = []; while ($lr && ($x=$lr->fetch_assoc())) $lines[] = $x;
        echo json_encode(['success'=>true,'entry'=>$head,'lines'=>$lines], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_trial_balance':
        // ميزان المراجعة — يحسبه كودنا من البنود (إثبات الاستقلال)
        $tid = (int)($_GET['tenant'] ?? 1);
        $to  = $conn->real_escape_string($_GET['to'] ?? '');
        $dateJoin = $to ? "AND e.date<='$to'" : '';
        $sql = "SELECT a.id,a.code,a.name,a.type,
                   COALESCE(SUM(l.debit),0) debit, COALESCE(SUM(l.credit),0) credit
                FROM acc_accounts a
                LEFT JOIN acc_lines l ON l.account_id=a.id
                LEFT JOIN acc_entries e ON e.id=l.entry_id $dateJoin
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
        $tid = (int)($_GET['tenant'] ?? $input_data['tenant_id'] ?? 1);
        $n = acc_fix_hierarchy($conn, $tid);
        echo json_encode(['success'=>true,'updated'=>$n], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_entry_delete':
        // حذف قيد يدوي غير مقفل وغير مرتبط بمستند (المستندات تُعكس لا تُحذف)
        $tid = (int)($input_data['tenant_id'] ?? $_GET['tenant'] ?? 1);
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
        $tid  = (int)($input_data['tenant_id'] ?? 1);
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
        $tid  = (int)($_GET['tenant'] ?? 1);
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
            $o = $conn->query("SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE l.account_id=$acc AND l.tenant_id=$tid AND e.date<'$from'");
            if ($o && ($x = $o->fetch_assoc())) { $opD = (float)$x['d']; $opC = (float)$x['c']; }
        }
        $opening = $isDebitNat ? ($opD - $opC) : ($opC - $opD);
        $w = "l.account_id=$acc AND l.tenant_id=$tid";
        if ($from) $w .= " AND e.date>='$from'";
        if ($to)   $w .= " AND e.date<='$to'";
        $res = $conn->query("SELECT e.entry_no,e.date,e.description ent_desc,l.debit,l.credit,l.description line_desc,l.party_type,l.party_id FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE $w ORDER BY e.date,e.id,l.id");
        $rows = []; $run = $opening; $sumD = 0; $sumC = 0;
        while ($res && ($x = $res->fetch_assoc())) {
            $d = (float)$x['debit']; $c = (float)$x['credit'];
            $run += $isDebitNat ? ($d - $c) : ($c - $d);
            $x['balance'] = round($run, 2); $sumD += $d; $sumC += $c;
            $rows[] = $x;
        }
        echo json_encode(['success'=>true,'account'=>$accRow,'opening'=>round($opening,2),'data'=>$rows,'totals'=>['debit'=>round($sumD,2),'credit'=>round($sumC,2),'closing'=>round($run,2)]], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_income_statement':
        // قائمة الدخل — إيرادات ومصروفات للفترة (كودنا يحسب)
        $tid  = (int)($_GET['tenant'] ?? 1);
        $from = $conn->real_escape_string($_GET['from'] ?? date('Y-01-01'));
        $to   = $conn->real_escape_string($_GET['to']   ?? date('Y-m-d'));
        $sql = "SELECT a.id,a.code,a.name,a.type, COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c
                FROM acc_accounts a
                LEFT JOIN acc_lines l ON l.account_id=a.id AND l.tenant_id=a.tenant_id
                LEFT JOIN acc_entries e ON e.id=l.entry_id AND e.date>='$from' AND e.date<='$to'
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

    case 'gl_balance_sheet':
        // الميزانية العمومية حتى تاريخ — أصول/خصوم/حقوق ملكية + صافي الدخل (كودنا يحسب)
        $tid = (int)($_GET['tenant'] ?? 1);
        $to  = $conn->real_escape_string($_GET['to'] ?? date('Y-m-d'));
        $sql = "SELECT a.id,a.code,a.name,a.type, COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c
                FROM acc_accounts a
                LEFT JOIN acc_lines l ON l.account_id=a.id AND l.tenant_id=a.tenant_id
                LEFT JOIN acc_entries e ON e.id=l.entry_id AND e.date<='$to'
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
        $ni = $conn->query("SELECT COALESCE(SUM(CASE WHEN a.type='revenue' THEN l.credit-l.debit ELSE 0 END),0) rev, COALESCE(SUM(CASE WHEN a.type='expense' THEN l.debit-l.credit ELSE 0 END),0) exp FROM acc_lines l JOIN acc_accounts a ON a.id=l.account_id JOIN acc_entries e ON e.id=l.entry_id WHERE l.tenant_id=$tid AND e.date<='$to' AND a.type IN ('revenue','expense')");
        $netIncome = 0; if ($ni && ($nr = $ni->fetch_assoc())) $netIncome = round((float)$nr['rev'] - (float)$nr['exp'], 2);
        $tE2 = round($tE + $netIncome, 2);
        echo json_encode(['success'=>true,'as_of'=>$to,'assets'=>$assets,'liabilities'=>$liab,'equity'=>$eq,'net_income'=>$netIncome,'totals'=>['assets'=>round($tA,2),'liabilities'=>round($tL,2),'equity'=>$tE2,'liab_plus_equity'=>round($tL+$tE2,2),'balanced'=>round($tA,2)==round($tL+$tE2,2)]], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_vat_report':
        // إقرار ضريبة القيمة المضافة — حساب 2102 (مخرجات دائن / مدخلات مدين)
        $tid  = (int)($_GET['tenant'] ?? 1);
        $from = $conn->real_escape_string($_GET['from'] ?? date('Y-01-01'));
        $to   = $conn->real_escape_string($_GET['to']   ?? date('Y-m-d'));
        $ar = $conn->query("SELECT id FROM acc_accounts WHERE tenant_id=$tid AND code='2102' LIMIT 1");
        $vatId = $ar ? (int)($ar->fetch_assoc()['id'] ?? 0) : 0;
        if (!$vatId) { echo json_encode(['success'=>false,'message'=>'حساب ضريبة القيمة المضافة (2102) غير موجود']); break; }
        $r = $conn->query("SELECT COALESCE(SUM(l.credit),0) out_vat, COALESCE(SUM(l.debit),0) in_vat FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE l.account_id=$vatId AND l.tenant_id=$tid AND e.date>='$from' AND e.date<='$to'");
        $out = 0; $in = 0; if ($r && ($x = $r->fetch_assoc())) { $out = (float)$x['out_vat']; $in = (float)$x['in_vat']; }
        echo json_encode(['success'=>true,'period'=>['from'=>$from,'to'=>$to],'output_vat'=>round($out,2),'input_vat'=>round($in,2),'net_payable'=>round($out-$in,2)], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_parties':
        // دفتر الأطراف (عملاء/موردون)
        $tid  = (int)($_GET['tenant'] ?? 1);
        $type = $conn->real_escape_string($_GET['type'] ?? '');
        $w = "tenant_id=$tid";
        if (in_array($type, ['customer','supplier'])) $w .= " AND type='$type'";
        $res = $conn->query("SELECT * FROM acc_parties WHERE $w ORDER BY name");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_party_save':
        $tid  = (int)($input_data['tenant_id'] ?? 1);
        $id   = (int)($input_data['id'] ?? 0);
        $type = $conn->real_escape_string($input_data['type'] ?? 'customer');
        if (!in_array($type, ['customer','supplier'])) $type = 'customer';
        $name = $conn->real_escape_string(trim($input_data['name'] ?? ''));
        $vat  = $conn->real_escape_string(trim($input_data['vat_number'] ?? ''));
        $cr   = $conn->real_escape_string(trim($input_data['cr_number'] ?? ''));
        $phone= $conn->real_escape_string(trim($input_data['phone'] ?? ''));
        $email= $conn->real_escape_string(trim($input_data['email'] ?? ''));
        $addr = $conn->real_escape_string(trim($input_data['address'] ?? ''));
        $daftra = $conn->real_escape_string(trim($input_data['daftra_id'] ?? ''));
        if (!$name) { echo json_encode(['success'=>false,'message'=>'الاسم مطلوب']); break; }
        if ($id) {
            $conn->query("UPDATE acc_parties SET type='$type',name='$name',vat_number='$vat',cr_number='$cr',phone='$phone',email='$email',address='$addr',daftra_id='$daftra' WHERE id=$id AND tenant_id=$tid");
            echo json_encode(['success'=>true,'id'=>$id]);
        } else {
            $ok = $conn->query("INSERT INTO acc_parties (tenant_id,type,name,vat_number,cr_number,phone,email,address,daftra_id) VALUES ($tid,'$type','$name','$vat','$cr','$phone','$email','$addr','$daftra')");
            echo json_encode(['success'=>(bool)$ok,'id'=>$conn->insert_id,'message'=>$ok?'تم':$conn->error], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'gl_party_delete':
        // حذف طرف غير مرتبط بحركات، وإلا تعطيله
        $tid = (int)($input_data['tenant_id'] ?? $_GET['tenant'] ?? 1);
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
        $tid  = (int)($_GET['tenant'] ?? 1);
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
            $o = $conn->query("SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE l.party_id=$pid AND l.tenant_id=$tid AND e.date<'$from'");
            if ($o && ($x = $o->fetch_assoc())) { $opD = (float)$x['d']; $opC = (float)$x['c']; }
        }
        $opening = $sign * ($opD - $opC);
        $w = "l.party_id=$pid AND l.tenant_id=$tid";
        if ($from) $w .= " AND e.date>='$from'";
        if ($to)   $w .= " AND e.date<='$to'";
        $res = $conn->query("SELECT e.entry_no,e.date,e.description ent_desc,l.debit,l.credit,l.due_date,l.description line_desc FROM acc_lines l JOIN acc_entries e ON e.id=l.entry_id WHERE $w ORDER BY e.date,e.id,l.id");
        $rows = []; $run = $opening; $sd = 0; $sc = 0;
        while ($res && ($x = $res->fetch_assoc())) {
            $d = (float)$x['debit']; $c = (float)$x['credit'];
            $run += $sign * ($d - $c); $x['balance'] = round($run, 2); $sd += $d; $sc += $c; $rows[] = $x;
        }
        echo json_encode(['success'=>true,'party'=>$party,'opening'=>round($opening,2),'data'=>$rows,'totals'=>['debit'=>round($sd,2),'credit'=>round($sc,2),'closing'=>round($run,2)]], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_aging':
        // أعمار الذمم 30/60/90 حسب تاريخ الاستحقاق (أو تاريخ القيد)
        $tid   = (int)($_GET['tenant'] ?? 1);
        $ptype = $conn->real_escape_string($_GET['party_type'] ?? 'customer');
        if (!in_array($ptype, ['customer','supplier'])) $ptype = 'customer';
        $asof  = $conn->real_escape_string($_GET['as_of'] ?? date('Y-m-d'));
        $sign  = $ptype === 'customer' ? 1 : -1;
        $sql = "SELECT p.id,p.name,
                  COALESCE(SUM(CASE WHEN DATEDIFF('$asof', COALESCE(l.due_date,e.date))<=0 THEN (l.debit-l.credit) ELSE 0 END),0) b_cur,
                  COALESCE(SUM(CASE WHEN DATEDIFF('$asof', COALESCE(l.due_date,e.date)) BETWEEN 1 AND 30 THEN (l.debit-l.credit) ELSE 0 END),0) b30,
                  COALESCE(SUM(CASE WHEN DATEDIFF('$asof', COALESCE(l.due_date,e.date)) BETWEEN 31 AND 60 THEN (l.debit-l.credit) ELSE 0 END),0) b60,
                  COALESCE(SUM(CASE WHEN DATEDIFF('$asof', COALESCE(l.due_date,e.date)) BETWEEN 61 AND 90 THEN (l.debit-l.credit) ELSE 0 END),0) b90,
                  COALESCE(SUM(CASE WHEN DATEDIFF('$asof', COALESCE(l.due_date,e.date))>90 THEN (l.debit-l.credit) ELSE 0 END),0) b90p,
                  COALESCE(SUM(l.debit-l.credit),0) net
                FROM acc_parties p
                LEFT JOIN acc_lines l ON l.party_id=p.id AND l.party_type=p.type AND l.tenant_id=p.tenant_id
                LEFT JOIN acc_entries e ON e.id=l.entry_id AND e.date<='$asof'
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
        $tid = (int)($_GET['tenant'] ?? 1);
        $res = $conn->query("SELECT * FROM acc_cost_centers WHERE tenant_id=$tid ORDER BY code,name");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_cost_center_save':
        $tid  = (int)($input_data['tenant_id'] ?? 1);
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

    case 'gl_settings_get':
        // ملف الشركة (يُستخدم في QR والطباعة) — يعيد المفاتيح المعروفة مع قيم افتراضية فارغة
        $tid = (int)($_GET['tenant'] ?? 1);
        $keys = ['company_name','vat_number','cr_number','address','city','district','postal_code','building_no','phone','email','logo_url'];
        $out = [];
        foreach ($keys as $k) $out[$k] = acc_setting($conn, $tid, $k, '');
        echo json_encode(['success'=>true,'settings'=>$out], JSON_UNESCAPED_UNICODE);
        break;

    case 'gl_settings_save':
        // حفظ/تحديث ملف الشركة — يقبل كائن settings بمفاتيح مسموح بها فقط
        $tid = (int)($input_data['tenant_id'] ?? 1);
        $by  = $input_data['actor'] ?? null;
        $allowed = ['company_name','vat_number','cr_number','address','city','district','postal_code','building_no','phone','email','logo_url'];
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
        acc_audit($conn, $tid, 'settings', null, 'save', "saved $n keys", $by);
        echo json_encode(['success'=>true,'saved'=>$n,'message'=>'تم حفظ إعدادات المنشأة'], JSON_UNESCAPED_UNICODE);
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
        $tid = (int)($_GET['tenant'] ?? 1);
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
        $tid = (int)($input_data['tenant_id'] ?? 1);
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
        $tid = (int)($input_data['tenant_id'] ?? 1);
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
            $type=in_array($p['type']??'customer',['customer','supplier'])?$p['type']:'customer';
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

    // ═══════════════════════════════════════════════════════════════════════
    // المستندات المستقلة (Phase 3): فواتير بيع/شراء + سندات قبض/صرف → ترحيل آلي
    // ═══════════════════════════════════════════════════════════════════════

    case 'inv_list':
        $tid  = (int)($_GET['tenant'] ?? 1);
        $dt   = $conn->real_escape_string($_GET['doc_type'] ?? '');
        $st   = $conn->real_escape_string($_GET['status'] ?? '');
        $from = $conn->real_escape_string($_GET['from'] ?? '');
        $to   = $conn->real_escape_string($_GET['to'] ?? '');
        $w = "i.tenant_id=$tid";
        if (in_array($dt, ['sales','purchase'])) $w .= " AND i.doc_type='$dt'";
        if (in_array($st, ['draft','posted','partial','paid','void'])) $w .= " AND i.status='$st'";
        if ($from) $w .= " AND i.issue_date>='$from'";
        if ($to)   $w .= " AND i.issue_date<='$to'";
        $res = $conn->query("SELECT i.*, COALESCE(p.name,i.party_name) party_label
                             FROM acc_invoices i LEFT JOIN acc_parties p ON p.id=i.party_id
                             WHERE $w ORDER BY i.issue_date DESC, i.id DESC LIMIT 500");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
        break;

    case 'inv_single':
        $tid = (int)($_GET['tenant'] ?? 1); $id = (int)($_GET['id'] ?? 0);
        $h = $conn->query("SELECT i.*, COALESCE(p.name,i.party_name) party_label, p.vat_number party_vat, p.address party_address
                           FROM acc_invoices i LEFT JOIN acc_parties p ON p.id=i.party_id
                           WHERE i.id=$id AND i.tenant_id=$tid LIMIT 1");
        $head = $h ? $h->fetch_assoc() : null;
        if (!$head) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        $ir = $conn->query("SELECT * FROM acc_invoice_items WHERE invoice_id=$id AND tenant_id=$tid ORDER BY id");
        $items = []; while ($ir && ($x = $ir->fetch_assoc())) $items[] = $x;
        echo json_encode(['success'=>true,'invoice'=>$head,'items'=>$items], JSON_UNESCAPED_UNICODE);
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
        $tid = (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $by  = $input_data['actor'] ?? null;
        $h = $conn->query("SELECT * FROM acc_invoices WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $inv = $h ? $h->fetch_assoc() : null;
        if (!$inv) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        if ($inv['status'] !== 'draft') { echo json_encode(['success'=>false,'message'=>'الفاتورة مُرحّلة مسبقًا']); break; }
        $sub = round((float)$inv['subtotal'],2); $taxT = round((float)$inv['tax_total'],2); $tot = round((float)$inv['total'],2);
        if ($tot <= 0) { echo json_encode(['success'=>false,'message'=>'إجمالي الفاتورة صفر']); break; }
        $ar = acc_id_by_code($conn,$tid,'1103'); $ap = acc_id_by_code($conn,$tid,'2101'); $vat = acc_id_by_code($conn,$tid,'2102');
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
                if ($taxT > 0) { if(!$vat) throw new Exception('حساب الضريبة 2102 غير موجود'); $lines[] = ['account_id'=>$vat,'debit'=>0,'credit'=>$taxT,'description'=>'ضريبة مخرجات']; }
                $reft = 'sales_invoice';
            } else {
                if (!$ap) throw new Exception('حساب الموردين 2101 غير موجود');
                $exp = ((int)$inv['gl_account_id']) ?: $defExp;
                if (!$exp) throw new Exception('حساب المصروف غير موجود');
                $lines = [
                    ['account_id'=>$exp,'debit'=>$sub,'credit'=>0,'description'=>'مصروف/مشتريات'],
                ];
                if ($taxT > 0) { if(!$vat) throw new Exception('حساب الضريبة 2102 غير موجود'); $lines[] = ['account_id'=>$vat,'debit'=>$taxT,'credit'=>0,'description'=>'ضريبة مدخلات']; }
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
        $tid = (int)($input_data['tenant_id'] ?? 1);
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
        $tid = (int)($input_data['tenant_id'] ?? 1);
        $id  = (int)($input_data['id'] ?? 0);
        $cs = $conn->query("SELECT status FROM acc_invoices WHERE id=$id AND tenant_id=$tid LIMIT 1");
        $crow = $cs ? $cs->fetch_assoc() : null;
        if (!$crow) { echo json_encode(['success'=>false,'message'=>'الفاتورة غير موجودة']); break; }
        if ($crow['status'] !== 'draft') { echo json_encode(['success'=>false,'message'=>'لا يُحذف إلا المسودات — استخدم الإلغاء']); break; }
        $conn->query("DELETE FROM acc_invoice_items WHERE invoice_id=$id AND tenant_id=$tid");
        $conn->query("DELETE FROM acc_invoices WHERE id=$id AND tenant_id=$tid");
        acc_audit($conn, $tid, 'invoice', $id, 'delete', 'حذف مسودة', $input_data['actor'] ?? null);
        echo json_encode(['success'=>true,'message'=>'تم حذف المسودة']);
        break;

    case 'pay_list':
        $tid  = (int)($_GET['tenant'] ?? 1);
        $pt   = $conn->real_escape_string($_GET['pay_type'] ?? '');
        $w = "pm.tenant_id=$tid";
        if (in_array($pt, ['receipt','payment'])) $w .= " AND pm.pay_type='$pt'";
        $res = $conn->query("SELECT pm.*, p.name party_label, i.invoice_no
                             FROM acc_payments pm
                             LEFT JOIN acc_parties p ON p.id=pm.party_id
                             LEFT JOIN acc_invoices i ON i.id=pm.invoice_id
                             WHERE $w ORDER BY pm.date DESC, pm.id DESC LIMIT 500");
        $rows = []; while ($res && ($x = $res->fetch_assoc())) $rows[] = $x;
        echo json_encode(['success'=>true,'data'=>$rows], JSON_UNESCAPED_UNICODE);
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
        $tid = (int)($input_data['tenant_id'] ?? 1);
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
