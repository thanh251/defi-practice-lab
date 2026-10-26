const hre = require('hardhat');
const fs = require('node:fs');
const path = require('node:path');
const { deployLab } = require('../lib/deploy');
async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error('No signer. For Geth --dev use its unlocked dev account, or set PRIVATE_KEY for a funded account.');
  const chainId=(await signer.provider.getNetwork()).chainId;
  if (![1337n,31337n].includes(chainId) && process.env.ALLOW_TESTNET !== 'true') throw new Error('Set ALLOW_TESTNET=true for a funded testnet deployment.');
  if (chainId === 1n) throw new Error('This teaching project does not deploy to mainnet.');
  const file=path.resolve('deployments',`${chainId}.json`);
  if(fs.existsSync(file) && process.env.REDEPLOY !== 'true') throw new Error(`Deployment file exists: ${file}. Set REDEPLOY=true to deploy a new lab.`);
  const {deployment}=await deployLab(hre,signer);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(deployment,null,2)+'\n');
  console.log('Saved:',file);
  console.log(JSON.stringify(deployment,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
