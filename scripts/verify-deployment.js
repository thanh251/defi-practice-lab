require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JsonRpcProvider, Contract, keccak256, ZeroAddress } = require('ethers');
const { v2 } = require('../lib/artifacts');
const root = path.resolve(__dirname, '..');
const manifest = require('../vendor/manifest.json');
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
async function main() {
  const provider = new JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
  try {
    const network = await provider.getNetwork();
    const file = `deployments/${network.chainId}.json`;
    const d = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    if ((await provider.getBlock(0)).hash !== d.genesisHash) throw new Error('Chain khong khop manifest; can deploy lai.');
    const build = manifest.uniswapBuild;
    if (!build) throw new Error('Chua co build local. Chay npm run compile:uniswap.');
    for (const [source, expected] of Object.entries(build.sources)) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, source))).digest('hex');
      if (actual !== expected) throw new Error(`Source thay doi sau build: ${source}. Compile va deploy lai.`);
    }
    const pairArtifact = v2('UniswapV2Pair');
    if (keccak256(pairArtifact.bytecode) !== build.pairInitCodeHash) throw new Error('Artifact Pair khong khop thong tin build.');
    console.log('Manifest CLI dang doc:', file);
    console.log('Chain ID:', network.chainId.toString());
    console.log('Phi swap trong ban build:', build.swapFeeNumerator / 10 + '%');
    for (const [routerAddress, expectedFactory] of [[d.router, d.factory], [d.router2, d.factory2]]) {
      const router = new Contract(routerAddress, v2('UniswapV2Router02').abi, provider);
      if (!same(await router.factory(), expectedFactory) || !same(await router.WETH(), d.weth)) throw new Error('Router khong tro dung Factory/WETH trong manifest.');
      const factory = new Contract(expectedFactory, v2('UniswapV2Factory').abi, provider);
      if ((await provider.getCode(expectedFactory)) !== v2('UniswapV2Factory').deployedBytecode) throw new Error('Factory tren chain KHAC ban build hien tai.');
      const count = await factory.allPairsLength();
      if (count === 0n) throw new Error('Factory chua co Pair de kiem tra.');
      console.log('Router:', routerAddress);
      for (let i = 0n; i < count; i++) {
        const pair = await factory.allPairs(i);
        if (same(pair, ZeroAddress) || (await provider.getCode(pair)) !== pairArtifact.deployedBytecode) throw new Error(`Pair ${pair}: bytecode KHAC ban build hien tai. Can redeploy.`);
        console.log('  Pair:', pair, '-> KHOP BYTECODE');
      }
    }
    const receiver = new Contract(d.receiver, ['function router1() view returns(address)', 'function router2() view returns(address)'], provider);
    if (!same(await receiver.router1(), d.router) || !same(await receiver.router2(), d.router2)) throw new Error('Receiver dang tro vao Router khac.');
    console.log('Receiver:', d.receiver, '-> TRO DUNG HAI ROUTER');
    console.log('KET QUA: Factory/Pair dang duoc cau hinh su dung KHOP ban build Uniswap hien tai.');
    console.log('Kiem tra nay doc chain, khong gui transaction; khong chung nhan bytecode moi contract Aave/Receiver.');
  } finally {
    provider.destroy();
  }
}
main().catch(error => {
  console.error('KHONG XAC NHAN DUOC:', error.shortMessage || error.message);
  process.exitCode = 1;
});
