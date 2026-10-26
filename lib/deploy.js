const { parseEther, parseUnits, ZeroAddress } = require('ethers');
const { aaveArtifact, v2, deployArtifact, aaveAt } = require('./artifacts');
const mined = async promise => (await promise).wait();
async function deployLab(hre, signer, log = console.log) {
  const owner = await signer.getAddress();
  const deployOwn = async (name, args = []) => {
    const c = await (await hre.ethers.getContractFactory(name, signer)).deploy(...args);
    await c.waitForDeployment(); return c;
  };
  log('Deploy tokens + Uniswap V2 (official artifacts)...');
  const tokens = {};
  for (const symbol of ['A','B','C','D']) {
    tokens[symbol] = await deployOwn('LabToken', [`Lab Token ${symbol}`, symbol]);
    await mined(tokens[symbol].mint(owner, parseEther('1000000')));
  }
  const weth = await deployArtifact(v2('WETH9'), signer);
  const factory = await deployArtifact(v2('UniswapV2Factory'), signer, [owner]);
  const router = await deployArtifact(v2('UniswapV2Router02'), signer, [await factory.getAddress(), await weth.getAddress()]);
  const factory2 = await deployArtifact(v2('UniswapV2Factory'), signer, [owner]);
  const router2 = await deployArtifact(v2('UniswapV2Router02'), signer, [await factory2.getAddress(), await weth.getAddress()]);
  async function liquidity(r, x, y, ax, ay) {
    const ra = await r.getAddress();
    await mined(tokens[x].approve(ra, parseEther(ax)));
    await mined(tokens[y].approve(ra, parseEther(ay)));
    const block = await signer.provider.getBlock('latest');
    await mined(r.addLiquidity(await tokens[x].getAddress(), await tokens[y].getAddress(), parseEther(ax), parseEther(ay), 0, 0, owner, block.timestamp + 3600));
  }
  // No A/D. A/C gives two competing paths from A to D.
  for (const [x,y,ax,ay] of [['A','B','10000','10000'],['B','C','10000','10000'],['C','D','10000','10000'],['A','C','10000','7000']]) {
    await liquidity(router,x,y,ax,ay);
  }
  // Deliberate price difference for repeatable local arbitrage: B is worth more A here.
  await liquidity(router2, 'A','B','15000','10000');
  log('Deploy Aave V3: linked libraries, provider, ACL, Pool + Configurator proxies...');
  const libraries = {};
  const deployAave = (name, args = []) => deployArtifact(aaveArtifact(name), signer, args, libraries);
  const provider = await deployAave('PoolAddressesProvider', ['Local Aave V3 Lab', owner]);
  const providerAddress = await provider.getAddress();
  await mined(provider.setACLAdmin(owner));
  const acl = await deployAave('ACLManager', [providerAddress]);
  await mined(provider.setACLManager(await acl.getAddress()));
  await mined(acl.addPoolAdmin(owner));
  const impl = await deployAave('Pool', [providerAddress]);
  await mined(provider.setPoolImpl(await impl.getAddress()));
  const poolAddress = await provider.getPool();
  const pool = aaveAt('Pool', poolAddress, signer);
  const configImpl = await deployAave('PoolConfigurator');
  await mined(provider.setPoolConfiguratorImpl(await configImpl.getAddress()));
  const configurator = aaveAt('PoolConfigurator', await provider.getPoolConfigurator(), signer);
  const data = await deployAave('AaveProtocolDataProvider', [providerAddress]);
  await mined(provider.setPoolDataProvider(await data.getAddress()));
  // Official AaveOracle; fallback price oracle is a lab-only mock from Aave's package.
  const fallback = await deployAave('PriceOracle');
  const A = await tokens.A.getAddress();
  await mined(fallback.setAssetPrice(A, 100000000n));
  const oracle = await deployAave('AaveOracle', [providerAddress, [], [], await fallback.getAddress(), ZeroAddress, 100000000n]);
  await mined(provider.setPriceOracle(await oracle.getAddress()));
  const ray = value => parseUnits(value, 27);
  const strategy = await deployAave('DefaultReserveInterestRateStrategy', [providerAddress,ray('0.8'),0,ray('0.04'),ray('0.75'),ray('0.02'),ray('0.75'),ray('0.02'),ray('0.05'),ray('0.2')]);
  const aToken = await deployAave('AToken', [poolAddress]);
  const stableDebt = await deployAave('StableDebtToken', [poolAddress]);
  const variableDebt = await deployAave('VariableDebtToken', [poolAddress]);
  await mined(configurator.initReserves([{
    aTokenImpl: await aToken.getAddress(), stableDebtTokenImpl: await stableDebt.getAddress(),
    variableDebtTokenImpl: await variableDebt.getAddress(), underlyingAssetDecimals: 18,
    interestRateStrategyAddress: await strategy.getAddress(), underlyingAsset: A,
    treasury: owner, incentivesController: ZeroAddress, aTokenName:'Aave Lab A', aTokenSymbol:'aLabA',
    variableDebtTokenName:'Variable Debt A', variableDebtTokenSymbol:'vdA',
    stableDebtTokenName:'Stable Debt A', stableDebtTokenSymbol:'sdA', params:'0x',
  }]));
  await mined(configurator.setReserveBorrowing(A, true));
  await mined(configurator.setReserveFlashLoaning(A, true));
  await mined(configurator.updateFlashloanPremiumTotal(5)); // Explicit 5 bps for this lab.
  await mined(tokens.A.approve(poolAddress, parseEther('50000')));
  await mined(pool.supply(A, parseEther('50000'), owner, 0));
  const receiver = await deployOwn('FlashSwapReceiver', [providerAddress, await router.getAddress(), await router2.getAddress()]);
  const addresses = {};
  for (const [k,t] of Object.entries(tokens)) addresses[k] = await t.getAddress();
  const reserve = await pool.getReserveData(A);
  const deployment = {
    chainId: (await signer.provider.getNetwork()).chainId.toString(),
    genesisHash: (await signer.provider.getBlock(0)).hash,
    deployer: owner, tokens: addresses, weth: await weth.getAddress(),
    factory: await factory.getAddress(), router: await router.getAddress(),
    factory2: await factory2.getAddress(), router2: await router2.getAddress(),
    aave: { provider:providerAddress, pool:poolAddress, configurator:await configurator.getAddress(), oracle:await oracle.getAddress(), aToken:reserve.aTokenAddress, libraries },
    receiver: await receiver.getAddress(),
  };
  return { deployment, tokens, factory, router, factory2, router2, pool, receiver, configurator };
}
module.exports = { deployLab, mined };
