const fs = require('node:fs');
const path = require('node:path');
const { ContractFactory, Contract } = require('ethers');
const cache = new Map();
// Local artifacts: rebuilt Uniswap and pinned Aave. No Solidity package is loaded from node_modules.
const vendorRoot = path.resolve(__dirname, '../vendor/artifacts');
function readArtifact(group, name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Invalid artifact name');
  const key = `${group}/${name}`;
  if (!cache.has(key)) {
    const file = path.join(vendorRoot, group, `${name}.json`);
    if (!fs.existsSync(file)) throw new Error(`Missing local artifact: ${file}`);
    cache.set(key, JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  return cache.get(key);
}
const aaveArtifact = name => readArtifact('aave-v3', name);
const v2 = name => readArtifact('uniswap-v2', name);
async function deployArtifact(artifact, signer, args = [], libraries = {}) {
  let bytecode = artifact.bytecode.replace(/^0x/, '');
  for (const [source, refs] of Object.entries(artifact.linkReferences || {})) {
    for (const [name, offsets] of Object.entries(refs)) {
      const key = `${source}:${name}`;
      if (!libraries[key]) {
        const lib = await deployArtifact(aaveArtifact(name), signer, [], libraries);
        libraries[key] = await lib.getAddress();
      }
      for (const { start, length } of offsets) {
        const address = libraries[key].slice(2);
        if (address.length !== length * 2) throw new Error('Invalid library address');
        bytecode = bytecode.slice(0, start * 2) + address + bytecode.slice((start + length) * 2);
      }
    }
  }
  const contract = await new ContractFactory(artifact.abi, '0x' + bytecode, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}
const aaveAt = (name, address, signer) => new Contract(address, aaveArtifact(name).abi, signer);
module.exports = { aaveArtifact, v2, deployArtifact, aaveAt };
