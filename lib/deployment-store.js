const fs = require('node:fs');
const path = require('node:path');

// Publish addresses only after deployment succeeds. Keep one previous manifest per chain.
function saveDeployment(file, deployment) {
  const data = JSON.stringify(deployment, null, 2) + '\n';
  const dir = path.dirname(file);
  const chain = path.basename(file, '.json');
  const backup = path.join(dir, `${chain}-backup.json`);
  const temporary = `${file}.tmp`;
  fs.mkdirSync(dir, { recursive: true });
  const previous = fs.existsSync(file) ? fs.readFileSync(file) : null;
  try {
    fs.writeFileSync(temporary, data);
    if (previous) {
      // An existing backup is replaced with the manifest that was active before this deploy.
      fs.writeFileSync(`${backup}.tmp`, previous);
      fs.renameSync(`${backup}.tmp`, backup);
    }
    fs.renameSync(temporary, file);
  } finally {
    for (const temp of [temporary, `${backup}.tmp`]) {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }
  if (previous) {
    // Retire legacy timestamped backups for this chain only, retaining the single stable backup.
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith(`${chain}-backup-`) && entry.endsWith('.json')) fs.unlinkSync(path.join(dir, entry));
    }
  }
  return previous ? backup : null;
}
module.exports = { saveDeployment };
