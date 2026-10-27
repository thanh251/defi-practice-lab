const {expect}=require('chai');
const hre=require('hardhat');
const {parseEther,ZeroAddress,Contract}=require('ethers');
const {deployLab,mined}=require('../lib/deploy');
const {bestRoutes,amountOut,findRoutes}=require('../lib/routes');
describe('Actual Uniswap V2 + Aave V3 integration',function(){
  let lab,owner,other,snapshot;
  before(async()=>{[owner,other]=await hre.ethers.getSigners();lab=await deployLab(hre,owner,()=>{});});
  beforeEach(async()=>{snapshot=await hre.network.provider.send('evm_snapshot');});
  afterEach(async()=>{await hre.network.provider.send('evm_revert',[snapshot]);});
  const deadline=async()=> (await hre.ethers.provider.getBlock('latest')).timestamp+300;
  it('deploys compatible official factory/router and supplies genuine Aave reserve',async()=>{
    const d=lab.deployment;
    expect(await lab.router.factory()).eq(d.factory);
    expect(await lab.factory.getPair(d.tokens.A,d.tokens.D)).eq(ZeroAddress);
    const a=new Contract(d.aave.aToken,['function balanceOf(address) view returns(uint256)'],owner);
    expect(await a.balanceOf(owner.address)).eq(parseEther('50000'));
    expect(await lab.tokens.A.balanceOf(d.aave.aToken)).eq(parseEther('50000'));
  });
  for(const symbols of [['A','B'],['A','B','C','D']])it(`swaps ${symbols.join(' -> ')} in one transaction`,async()=>{
    const d=lab.deployment,path=symbols.map(s=>d.tokens[s]),input=parseEther('100');
    await mined(lab.tokens.A.approve(d.router,input));
    const out=lab.tokens[symbols.at(-1)];
    const before=await out.balanceOf(owner.address);
    const q=await lab.router.getAmountsOut(input,path);
    const receipt=await mined(lab.router.swapExactTokensForTokens(input,q.at(-1),path,owner.address,await deadline()));
    expect((await out.balanceOf(owner.address))-before).eq(q.at(-1));
    const swaps=receipt.logs.filter(l=>l.topics[0]===hre.ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)'));
    expect(swaps.length).eq(symbols.length-1);
  });
  it('rejects excess minOut and rolls back balances',async()=>{
    const d=lab.deployment,input=parseEther('100'),path=[d.tokens.A,d.tokens.B,d.tokens.C,d.tokens.D];
    await mined(lab.tokens.A.approve(d.router,input));
    const before=await lab.tokens.A.balanceOf(owner.address);
    const q=await lab.router.getAmountsOut(input,path);
    await expect(lab.router.swapExactTokensForTokens(input,q.at(-1)+1n,path,owner.address,await deadline())).revertedWith('UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
    expect(await lab.tokens.A.balanceOf(owner.address)).eq(before);
  });
  it('finds both candidate routes and matches every router quote at same block',async()=>{
    const d=lab.deployment,input=parseEther('100');
    const {block,routes}=await bestRoutes(lab.factory,owner.provider,d.tokens.A,d.tokens.D,input,3);
    expect(routes.length).eq(2);
    for(const r of routes){const q=await lab.router.getAmountsOut(input,r.path,{blockTag:block});expect(r.output).eq(q.at(-1));}
    expect(routes[0].path).deep.eq([d.tokens.A,d.tokens.B,d.tokens.C,d.tokens.D]);
    expect(routes[0].output).greaterThan(routes[1].output);
  });
  it('borrows from Aave, swaps on two DEXes and repays principal + premium',async()=>{
    const d=lab.deployment,amount=parseEther('100');
    const before=await lab.tokens.A.balanceOf(d.aave.aToken);
    const receipt=await mined(lab.receiver.start(d.tokens.A,amount,d.tokens.B,0,0,parseEther('1'),await deadline()));
    const event=receipt.logs.map(l=>{try{return lab.receiver.interface.parseLog(l);}catch{return null;}}).find(e=>e?.name==='FlashCompleted');
    expect(event.args.premium).eq(parseEther('0.05'));
    expect(event.args.profit).greaterThan(parseEther('1'));
    expect(await lab.tokens.A.balanceOf(d.receiver)).eq(event.args.profit);
    expect(await lab.tokens.A.balanceOf(d.aave.aToken)).eq(before+event.args.premium);
  });
  it('rolls back Aave and both DEXes when minimum profit is impossible',async()=>{
    const d=lab.deployment,before=await lab.tokens.A.balanceOf(d.aave.aToken);
    const pair=await lab.factory.getPair(d.tokens.A,d.tokens.B);
    const poolBalance=await lab.tokens.A.balanceOf(pair);
    await expect(lab.receiver.start(d.tokens.A,parseEther('100'),d.tokens.B,0,0,parseEther('1000'),await deadline())).revertedWith('NO_PROFIT');
    expect(await lab.tokens.A.balanceOf(d.aave.aToken)).eq(before);
    expect(await lab.tokens.A.balanceOf(pair)).eq(poolBalance);
  });
  it('does not use existing receiver funds to disguise a losing strategy',async()=>{
    const d=lab.deployment;
    // Reverse the profitable routers; enough pre-funded A must still not hide the loss.
    const bad=await(await hre.ethers.getContractFactory('FlashSwapReceiver')).deploy(d.aave.provider,d.router2,d.router);
    await bad.waitForDeployment();
    await mined(lab.tokens.A.transfer(await bad.getAddress(),parseEther('1000')));
    await expect(bad.start(d.tokens.A,parseEther('100'),d.tokens.B,0,0,0,await deadline())).revertedWith('NO_PROFIT');
    expect(await lab.tokens.A.balanceOf(await bad.getAddress())).eq(parseEther('1000'));
  });
  it('rejects unauthorized execution and fake callback',async()=>{
    const d=lab.deployment;
    await expect(lab.receiver.connect(other).start(d.tokens.A,1,d.tokens.B,0,0,0,await deadline())).revertedWith('Ownable: caller is not the owner');
    await expect(lab.receiver.executeOperation(d.tokens.A,1,0,d.receiver,'0x')).revertedWith('ONLY_POOL');
  });
  it('rejects a third party starting a loan with this receiver',async()=>{
    const d=lab.deployment;
    await expect(lab.pool.connect(other).flashLoanSimple(d.receiver,d.tokens.A,parseEther('1'),'0x',0)).revertedWith('INVALID_INITIATOR');
  });
  it('rejects expired strategies before borrowing',async()=>{
    const d=lab.deployment;
    await expect(lab.receiver.start(d.tokens.A,parseEther('1'),d.tokens.B,0,0,0,1)).revertedWith('EXPIRED');
  });
  it('reverts loan exceeding actual Aave liquidity',async()=>{
    const d=lab.deployment;
    await expect(lab.receiver.start(d.tokens.A,parseEther('50001'),d.tokens.B,0,0,0,await deadline())).reverted;
  });
});
describe('Routing boundaries',()=>{
  it('rounds integer output down and rejects unusable liquidity',()=>{
    expect(amountOut(100n,1000n,1000n)).eq(82n);
    expect(amountOut(100n,0n,1000n)).eq(0n);
    expect(findRoutes(new Map(),'A','D',100n,3)).deep.eq([]);
    expect(()=>findRoutes(new Map(),'A','D',100n,0)).throws('maxHops');
  });
});
