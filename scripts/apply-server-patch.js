/**
 * ArtSpace — Server Integration Patch v2.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ADD THESE 3 LINES to your existing server.js
 * (or run: node scripts/apply-server-patch.js)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 1. Near your existing route imports (around line 10):
 *
 *    const extendedV2Routes = require('./routes/extended-v2');
 *
 * 2. After your existing app.use('/api/extended', ...) line:
 *
 *    app.use('/api/extended', extendedV2Routes);
 *
 * NOTE: If your server.js already mounts extended.js at /api/extended,
 * you can either:
 *   a) Mount extended-v2 at a DIFFERENT prefix: app.use('/api/extended', extendedV2Routes);
 *      (Express allows multiple routers at the same prefix — routes are additive)
 *   b) OR merge extended-v2.js into extended.js manually.
 *
 * Both options are safe. Option (a) is zero-risk.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * This script auto-patches server.js if you run it directly.
 * Run: node scripts/apply-server-patch.js
 */

const fs   = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server.js');
let source = fs.readFileSync(serverPath, 'utf8');

const IMPORT_MARKER    = `const extendedRoutes`;  // existing require line
const IMPORT_ADDITION  = `const extendedV2Routes = require('./routes/extended-v2');`;
const ROUTE_MARKER     = `app.use('/api/extended'`;
const ROUTE_ADDITION   = `\napp.use('/api/extended', extendedV2Routes); // v2 admin features`;

let patched = false;

// 1. Add import (only if not already present)
if (!source.includes('extended-v2')) {
  if (source.includes(IMPORT_MARKER)) {
    source = source.replace(IMPORT_MARKER, `${IMPORT_ADDITION}\n${IMPORT_MARKER}`);
    console.log('✓ Added extended-v2 import');
    patched = true;
  } else {
    // Fallback: add near the top after other requires
    source = source.replace('require(\'express\');', `require('express');\n${IMPORT_ADDITION}`);
    console.log('✓ Added extended-v2 import (fallback position)');
    patched = true;
  }
}

// 2. Add route mounting (only if not already present)
if (!source.includes('extendedV2Routes')) {
  const idx = source.indexOf(ROUTE_MARKER);
  if (idx !== -1) {
    const lineEnd = source.indexOf('\n', idx);
    source = source.slice(0, lineEnd) + ROUTE_ADDITION + source.slice(lineEnd);
    console.log('✓ Mounted extended-v2 routes');
    patched = true;
  }
}

if (patched) {
  // Backup original
  fs.writeFileSync(serverPath + '.backup', fs.readFileSync(serverPath));
  fs.writeFileSync(serverPath, source);
  console.log('\n✅ server.js patched successfully!');
  console.log('   Original backed up to server.js.backup');
  console.log('\n   Restart your server: npm run dev');
} else {
  console.log('\n✅ server.js already patched — no changes needed.');
}
