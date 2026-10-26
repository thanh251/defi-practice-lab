const fs = require('node:fs');
const path = require('node:path');
const { ContractFactory, Contract } = require('ethers');
const cache = new Map();
function aaveArtifact(name) {
  const root = path.join(path.dirname(require.resolve('@aave/core-v3/package.json')), 'artifacts/contracts');
  function find(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { const found = find(p); if (found) return found; }
      else if (entry.name === `${name}.json`) return JSON.parse(fs.readFileSync(p));
    }
  }
  if (!cache.has(name)) cache.set(name, find(root));
  if (!cache.get(name)) throw new Error(`Missing Aave artifact: ${name}`);
  return cache.get(name);
}
const v2 = name => require(`@uniswap/v2-${name === 'UniswapV2Factory' ? 'core' : 'periphery'}/build/${name}.json`);
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
