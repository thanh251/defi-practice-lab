const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = require('../vendor/manifest.json');
function verify(file, expected) {
  const data = fs.readFileSync(path.join(root, file));
  const actual = crypto.createHash('sha256').update(data).digest('hex');
  if (actual !== expected) throw new Error(`Vendor snapshot changed: ${file}. Review and update the manifest intentionally.`);
}
for (const [file, info] of Object.entries(manifest.sources)) verify(file, info.sha256);
for (const [file, info] of Object.entries(manifest.artifacts)) verify(file, info.sha256);
for (const [file, info] of Object.entries(manifest.licenses)) verify(file, info.sha256);
// All imports in vendor and application contracts must resolve locally.
const sourceFiles = [...Object.keys(manifest.sources), 'contracts/LabToken.sol', 'contracts/FlashSwapReceiver.sol'];
for (const file of sourceFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const imports = text.matchAll(/\bimport\s+[^;]*?['"]([^'"]+)['"]\s*;/g);
  for (const [, target] of imports) {
    if (!target.startsWith('.')) throw new Error(`Non-local Solidity import in ${file}: ${target}`);
    const resolved = path.resolve(root, path.dirname(file), target);
    if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved)) throw new Error(`Unresolved import in ${file}: ${target}`);
  }
}
console.log(`Verified ${Object.keys(manifest.sources).length} local Solidity sources, ${Object.keys(manifest.artifacts).length} pinned artifacts and all imports.`);
