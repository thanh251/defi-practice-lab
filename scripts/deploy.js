const hre = require('hardhat');
const fs = require('node:fs');
const path = require('node:path');
const { deployLab } = require('../lib/deploy');
const { saveDeployment } = require('../lib/deployment-store');
async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error('No signer. For Geth --dev use its unlocked dev account, or set PRIVATE_KEY for a funded account.');
  const chainId=(await signer.provider.getNetwork()).chainId;
  if (![1337n,31337n].includes(chainId) && process.env.ALLOW_TESTNET !== 'true') throw new Error('Set ALLOW_TESTNET=true for a funded testnet deployment.');
  if (chainId === 1n) throw new Error('This teaching project does not deploy to mainnet.');
  const file=path.resolve('deployments',`${chainId}.json`);
  const isLocal = [1337n, 31337n].includes(chainId);
  if (fs.existsSync(file) && !isLocal && process.env.REDEPLOY !== 'true') throw new Error('Testnet deployment exists. Set REDEPLOY=true to replace it.');
  console.log(isLocal ? 'Local deploy: a new lab will be created; the current addresses will be backed up on success.' : 'Deploying to testnet...');
  const {deployment}=await deployLab(hre,signer);
  const backup = saveDeployment(file, deployment);
  if (backup) console.log('Previous deployment saved:', backup);
  console.log('Saved:',file);
  console.log(JSON.stringify(deployment,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
