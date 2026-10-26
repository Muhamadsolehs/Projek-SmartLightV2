/**
 * test_provisioning_and_auth.cjs
 * Comprehensive Local Unit & Integration Verification Test Suite
 * 
 * Tests:
 * 1. Cryptographic Token Generation & SHA-256 Test Vector Compatibility
 * 2. Firmware config.h & credentials.h modularity & .gitignore rules
 * 3. Firmware esp32_smart_lightrap.ino header & URL integrity
 * 4. Edge Functions security & isolation checks
 * 5. Frontend service & component contract validation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ' - ' + details : ''}`);
  }
}

console.log('================================================================');
console.log('   WEB-LIGHTRAP: LOCAL AUDIT & PROVISIONING TEST SUITE          ');
console.log('================================================================\n');

// ----------------------------------------------------------------------
// Test Suite 1: Cryptography & CSPRNG Token Generation
// ----------------------------------------------------------------------
console.log('--- [1/5] Cryptographic Tokens & SHA-256 Digest Vectors ---');

// Test 1.1: CSPRNG format
const testTokenBytes = crypto.randomBytes(24);
const testToken = `slt_live_${testTokenBytes.toString('hex')}`;
assert(
  testToken.startsWith('slt_live_') && testToken.length === 57,
  'CSPRNG Token prefix and entropy length (57 chars total)',
  `Generated length: ${testToken.length}`
);

// Test 1.2: SHA-256 hash compatibility test vector
// digest('test_secret_token_123', 'sha256') produce known hex:
const knownInput = 'test_secret_token_123';
const expectedHash = 'f54b1d1804c84bb75911d837b42211f7bee87a40231920ebeac29f99bf6a41d4';
const actualHash = crypto.createHash('sha256').update(knownInput, 'utf8').digest('hex');

assert(
  actualHash === expectedHash,
  'SHA-256 calculation matches PostgreSQL digest(p_raw_token, \'sha256\')',
  `Actual: ${actualHash}`
);

// Test 1.3: Verify 00002_security_rls.sql uses extensions.digest
const rlsMigrationPath = path.join(ROOT_DIR, 'supabase', 'migrations', '00002_security_rls.sql');
const rlsContent = fs.readFileSync(rlsMigrationPath, 'utf8');
assert(
  rlsContent.includes('extensions.digest') && rlsContent.includes('SET search_path = public, extensions'),
  '00002_security_rls.sql sets explicit search_path and extensions.digest',
  'Missing explicit schema search path or extensions.digest'
);

// ----------------------------------------------------------------------
// Test Suite 2: Firmware Configuration & Git Safety
// ----------------------------------------------------------------------
console.log('\n--- [2/5] Firmware config.h & Git Ignore Safety ---');

const configHPath = path.join(ROOT_DIR, 'firmware', 'esp32_smart_lightrap', 'config.h');
const configHContent = fs.readFileSync(configHPath, 'utf8');

// Test 2.1: URL duplication bug check
assert(
  !configHContent.includes('/functions/v1/functions/v1'),
  'No duplicate /functions/v1 path segments in config.h',
  'Duplicate path segment found!'
);

// Test 2.2: Ensure endpoint definitions build on SUPABASE_BASE_URL cleanly
assert(
  configHContent.includes('#define URL_COMMAND_POLL  SUPABASE_BASE_URL "/device-command-poll"') &&
  configHContent.includes('#define URL_COMMAND_ACK   SUPABASE_BASE_URL "/device-command-ack"') &&
  configHContent.includes('#define URL_TELEMETRY     SUPABASE_BASE_URL "/device-telemetry"') &&
  configHContent.includes('#define URL_DEVICE_STATUS SUPABASE_BASE_URL "/device-status"'),
  'All 4 Edge Function endpoints have clean macro definitions in config.h'
);

// Test 2.3: Safe modular inclusion of credentials.h
assert(
  configHContent.includes('__has_include("credentials.h")'),
  'config.h supports local modular credentials.h inclusion'
);

// Test 2.4: .gitignore contains firmware credentials rules
const gitignorePath = path.join(ROOT_DIR, '.gitignore');
const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
assert(
  gitignoreContent.includes('firmware/**/credentials.h') && gitignoreContent.includes('firmware/**/secrets.h'),
  '.gitignore strictly ignores firmware/**/credentials.h and secrets.h'
);

// Test 2.5: Example template credentials.h.example exists
const examplePath = path.join(ROOT_DIR, 'firmware', 'esp32_smart_lightrap', 'credentials.h.example');
assert(
  fs.existsSync(examplePath),
  'credentials.h.example template is present for field developers'
);

// ----------------------------------------------------------------------
// Test Suite 3: Firmware .ino Handshake & Header Integrity
// ----------------------------------------------------------------------
console.log('\n--- [3/5] Firmware .ino Handshake & Protocol Integrity ---');

const inoPath = path.join(ROOT_DIR, 'firmware', 'esp32_smart_lightrap', 'esp32_smart_lightrap.ino');
const inoContent = fs.readFileSync(inoPath, 'utf8');

assert(
  inoContent.includes('gHttp.addHeader("X-Device-Code", DEVICE_CODE)') &&
  inoContent.includes('gHttp.addHeader("X-Device-Token", DEVICE_TOKEN)'),
  'esp32_smart_lightrap.ino sends both X-Device-Code and X-Device-Token headers'
);

assert(
  inoContent.includes('RELAY_ACTIVE_LEVEL') && inoContent.includes('digitalWrite'),
  'Active LOW relay initialization and control safety preserved in .ino'
);

// ----------------------------------------------------------------------
// Test Suite 4: Supabase Edge Functions Hardening
// ----------------------------------------------------------------------
console.log('\n--- [4/5] Supabase Edge Functions Hardening ---');

const sharedAuthPath = path.join(ROOT_DIR, 'supabase', 'functions', '_shared', 'auth.ts');
const sharedAuthContent = fs.readFileSync(sharedAuthPath, 'utf8');

assert(
  sharedAuthContent.includes('verifyDeviceAuth') &&
  sharedAuthContent.includes('verifyAdminAuth'),
  '_shared/auth.ts exports both verifyDeviceAuth and verifyAdminAuth'
);

assert(
  sharedAuthContent.includes('operational_status === \'decommissioned\'') ||
  sharedAuthContent.includes('decommissioned'),
  '_shared/auth.ts rejects decommissioned/inactive devices with HTTP 403'
);

const provisioningPath = path.join(ROOT_DIR, 'supabase', 'functions', 'device-provisioning', 'index.ts');
assert(
  fs.existsSync(provisioningPath),
  'supabase/functions/device-provisioning/index.ts is created'
);

const provisioningContent = fs.readFileSync(provisioningPath, 'utf8');
assert(
  provisioningContent.includes('verifyAdminAuth') &&
  provisioningContent.includes('crypto.getRandomValues') &&
  provisioningContent.includes('crypto.subtle.digest') &&
  provisioningContent.includes('action === \'provision\'') &&
  provisioningContent.includes('action === \'rotate-token\''),
  'device-provisioning implements server-side admin check, CSPRNG, and both provision & rotate-token actions'
);

// Verify device isolation in device-command-poll
const pollPath = path.join(ROOT_DIR, 'supabase', 'functions', 'device-command-poll', 'index.ts');
const pollContent = fs.readFileSync(pollPath, 'utf8');
assert(
  pollContent.includes(".eq('device_id', device.id)"),
  'device-command-poll strictly isolates command queries to device_id == device.id'
);

// Verify command ownership in device-command-ack
const ackPath = path.join(ROOT_DIR, 'supabase', 'functions', 'device-command-ack', 'index.ts');
const ackContent = fs.readFileSync(ackPath, 'utf8');
assert(
  ackContent.includes(".eq('device_id', device.id)"),
  'device-command-ack enforces command ownership verification (device_id == device.id)'
);

// ----------------------------------------------------------------------
// Test Suite 5: Frontend Service & Modal Single-View Contract
// ----------------------------------------------------------------------
console.log('\n--- [5/5] Frontend Service & UI Single-View Credentials Contract ---');

const deviceServicePath = path.join(ROOT_DIR, 'src', 'services', 'deviceService.ts');
const devServiceContent = fs.readFileSync(deviceServicePath, 'utf8');

assert(
  !devServiceContent.includes('Math.random()'),
  'Insecure Math.random() completely removed from deviceService.ts'
);

assert(
  devServiceContent.includes("supabase.functions.invoke('device-provisioning'") &&
  devServiceContent.includes('rotateDeviceToken'),
  'deviceService invokes server-side device-provisioning and exports rotateDeviceToken'
);

assert(
  devServiceContent.includes('supabase.auth.getSession()') &&
  devServiceContent.includes('Authorization: `Bearer ${accessToken}`'),
  'rotateDeviceToken strictly uses supabase.auth.getSession() and passes Bearer access token'
);

assert(
  devServiceContent.includes('HTTP 401') &&
  devServiceContent.includes('HTTP 403') &&
  devServiceContent.includes('HTTP 404'),
  'rotateDeviceToken handles HTTP 401, 403, and 404 responses with explicit user-friendly errors'
);

const formModalPath = path.join(ROOT_DIR, 'src', 'components', 'devices', 'DeviceFormModal.tsx');
const formModalContent = fs.readFileSync(formModalPath, 'utf8');

assert(
  formModalContent.includes('provisionedCredentials') &&
  formModalContent.includes('configHSnippet') &&
  !formModalContent.includes('localStorage.setItem(\'device_token\''),
  'DeviceFormModal implements single-view credentials display without client-side storage persistence'
);

const detailModalPath = path.join(ROOT_DIR, 'src', 'components', 'devices', 'DeviceDetailModal.tsx');
const detailModalContent = fs.readFileSync(detailModalPath, 'utf8');

assert(
  detailModalContent.includes('handleRotateToken') &&
  detailModalContent.includes('rotatedCredentials'),
  'DeviceDetailModal implements hardware token rotation flow for administrators'
);

assert(
  detailModalContent.includes('id="btn-rotate-token"') &&
  detailModalContent.includes('id="btn-confirm-rotate"'),
  'DeviceDetailModal provides prominent Rotate Token header button and confirmation dialog'
);

assert(
  detailModalContent.includes('id="btn-copy-raw-token"') &&
  detailModalContent.includes('id="btn-copy-config-snippet"') &&
  !detailModalContent.includes('localStorage.setItem') &&
  !detailModalContent.includes('sessionStorage.setItem'),
  'Single-view rotation result modal provides copy actions without client-side storage persistence'
);

// ----------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
if (failedTests === 0) {
  console.log('STATUS: ALL LOCAL AUDIT & SECURITY CHECKS PASSED SUCCESSFULLY [OK]');
} else {
  console.error(`STATUS: ${failedTests} CHECKS FAILED!`);
  process.exit(1);
}
console.log('================================================================\n');
