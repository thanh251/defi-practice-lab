// Build the local Uniswap sources before deployment, including the CREATE2 Pair hash.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { keccak256 } = require('ethers');
const coreSolc = require('solc-v2-core');
const peripherySolc = require('solc-v2-periphery');
const root = path.resolve(__dirname, '..');
const core = 'vendor/solidity/uniswap-v2-core';
const periphery = 'vendor/solidity/uniswap-v2-periphery';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function compile(compiler, entries) {
  const sources = {};
  function collect(file) {
    file = file.split(path.sep).join('/');
    if (sources[file]) return;
    const content = source(file);
    sources[file] = { content };
    for (const [, target] of content.matchAll(/\bimport\s+[^;]*?['"]([^'"]+)['"]\s*;/g)) {
      if (!target.startsWith('.')) throw new Error(`Uniswap imports must be local: ${file}: ${target}`);
      const resolved = path.normalize(path.join(path.dirname(file), target));
      if (!resolved.startsWith('vendor/solidity/')) throw new Error('Import escapes vendor sources');
      collect(resolved);
    }
  }
  entries.forEach(collect);
  const input = {
    language: 'Solidity', sources,
    settings: {
      optimizer: { enabled: true, runs: 200 }, evmVersion: 'istanbul',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] } },
    },
  };
  const output = JSON.parse(compiler.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  return { output, sources, compiler: compiler.version() };
}
function artifact(build, file, name) {
  const c = build.output.contracts[file][name];
  return {
    _format: 'hh-sol-artifact-1', contractName: name, sourceName: file,
    abi: c.abi, bytecode: '0x' + c.evm.bytecode.object,
    deployedBytecode: '0x' + c.evm.deployedBytecode.object,
    linkReferences: c.evm.bytecode.linkReferences,
    deployedLinkReferences: c.evm.deployedBytecode.linkReferences,
  };
}
function main() {
  const pairSource = source(`${core}/UniswapV2Pair.sol`);
  const fees = [...pairSource.matchAll(/amount[01]In\.mul\((\d+)\)/g)].map(m => Number(m[1]));
  if (fees.length !== 2 || fees[0] !== fees[1] || fees[0] < 0 || fees[0] >= 1000) throw new Error('Check matching Pair input fee factors (denominator 1000).');
  const multiplier = 1000 - fees[0];
  const libraryFile = `${periphery}/libraries/UniswapV2Library.sol`;
  const originalLibrary = source(libraryFile);
  const quoteOut = originalLibrary.match(/amountInWithFee\s*=\s*amountIn\.mul\((\d+)\)/);
  const quoteIn = originalLibrary.match(/reserveOut\.sub\(amountOut\)\.mul\((\d+)\)/);
  if (Number(quoteOut?.[1]) !== multiplier || Number(quoteIn?.[1]) !== multiplier) throw new Error('Pair and Library swap fees differ. Update both quote formulas.');
  const coreBuild = compile(coreSolc, [`${core}/UniswapV2Factory.sol`]);
  const pair = artifact(coreBuild, `${core}/UniswapV2Pair.sol`, 'UniswapV2Pair');
  const pairHash = keccak256(pair.bytecode);
  const updatedLibrary = originalLibrary.replace(/hex'[a-fA-F0-9]{64}'(\s*\/\/ init code hash)/, `hex'${pairHash.slice(2)}'$1`);
  if (!updatedLibrary.includes(`hex'${pairHash.slice(2)}'`)) throw new Error('Could not locate Pair init code hash in Library.');
  fs.writeFileSync(path.join(root, libraryFile), updatedLibrary);
  let peripheryBuild;
  try {
    peripheryBuild = compile(peripherySolc, [`${periphery}/UniswapV2Router02.sol`, `${periphery}/test/WETH9.sol`]);
  } catch (error) {
    fs.writeFileSync(path.join(root, libraryFile), originalLibrary);
    throw error;
  }
  const builds = {
    UniswapV2Factory: artifact(coreBuild, `${core}/UniswapV2Factory.sol`, 'UniswapV2Factory'),
    UniswapV2Pair: pair,
    UniswapV2Router02: artifact(peripheryBuild, `${periphery}/UniswapV2Router02.sol`, 'UniswapV2Router02'),
    WETH9: artifact(peripheryBuild, `${periphery}/test/WETH9.sol`, 'WETH9'),
  };
  const manifestPath = path.join(root, 'vendor/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [name, data] of Object.entries(builds)) {
    const file = `vendor/artifacts/uniswap-v2/${name}.json`;
    const text = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(path.join(root, file), text);
    const previous = manifest.artifacts[file];
    manifest.artifacts[file] = {
      ...previous,
      upstreamSha256: previous.upstreamSha256 || previous.sha256,
      sha256: sha(text), origin: 'compiled from local vendor sources',
      compiler: name === 'UniswapV2Factory' || name === 'UniswapV2Pair' ? coreBuild.compiler : peripheryBuild.compiler,
    };
  }
  const sourceHashes = {};
  for (const [file, { content }] of Object.entries({ ...coreBuild.sources, ...peripheryBuild.sources })) {
    sourceHashes[file] = sha(content);
    if (manifest.sources[file]) manifest.sources[file].sha256 = sourceHashes[file];
  }
  manifest.uniswapBuild = {
    coreCompiler: coreBuild.compiler, peripheryCompiler: peripheryBuild.compiler,
    optimizer: { enabled: true, runs: 200 }, evmVersion: 'istanbul',
    pairInitCodeHash: pairHash, swapFeeNumerator: fees[0], swapFeeDenominator: 1000,
    inputMultiplier: multiplier, sources: sourceHashes,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Built local Uniswap V2: swap fee ${fees[0] / 10}%, Pair init code hash ${pairHash}`);
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
