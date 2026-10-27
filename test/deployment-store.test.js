const { expect } = require('chai');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { saveDeployment } = require('../lib/deployment-store');

describe('Deployment address publishing', function () {
  let dir, file;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'defi-address-test-')); file = path.join(dir, '1337.json'); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  it('publishes a fresh deployment without creating a fake backup', () => {
    expect(saveDeployment(file, { router: 'first' })).eq(null);
    expect(JSON.parse(fs.readFileSync(file)).router).eq('first');
    expect(fs.readdirSync(dir)).deep.eq(['1337.json']);
  });
  it('keeps exactly the immediately previous deployment and leaves other chains alone', () => {
    fs.writeFileSync(path.join(dir, '1337-backup-old.json'), '{"router":"older"}');
    fs.writeFileSync(path.join(dir, '31337-backup.json'), '{"router":"other-chain"}');
    saveDeployment(file, { router: 'first' });
    saveDeployment(file, { router: 'second' });
    saveDeployment(file, { router: 'third' });
    expect(JSON.parse(fs.readFileSync(file)).router).eq('third');
    expect(JSON.parse(fs.readFileSync(path.join(dir, '1337-backup.json'))).router).eq('second');
    expect(JSON.parse(fs.readFileSync(path.join(dir, '31337-backup.json'))).router).eq('other-chain');
    expect(fs.readdirSync(dir).filter(x => x.startsWith('1337-backup'))).deep.eq(['1337-backup.json']);
    expect(fs.readdirSync(dir).some(x => x.endsWith('.tmp'))).eq(false);
  });
  it('preserves the active manifest if the new result cannot be serialized', () => {
    saveDeployment(file, { router: 'working' });
    expect(() => saveDeployment(file, { chainId: 1337n })).throws();
    expect(JSON.parse(fs.readFileSync(file)).router).eq('working');
    expect(fs.existsSync(path.join(dir, '1337-backup.json'))).eq(false);
  });
});
