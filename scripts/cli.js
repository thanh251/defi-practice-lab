require('dotenv').config();
const fs=require('node:fs');
const {JsonRpcProvider,Wallet,Contract,parseUnits,formatUnits,ZeroAddress}=require('ethers');
const {v2}=require('../lib/artifacts');
const {bestRoutes}=require('../lib/routes');
const tokenAbi=['function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)'];
async function main(){
  const [command='status',...args]=process.argv.slice(2);
  const provider=new JsonRpcProvider(process.env.RPC_URL||'http://127.0.0.1:8545');
  const network=await provider.getNetwork();
  const file=`deployments/${network.chainId}.json`;
  if(!fs.existsSync(file)) throw new Error(`No ${file}. Run deployment first.`);
  const d=JSON.parse(fs.readFileSync(file));
  if((await provider.getBlock(0)).hash!==d.genesisHash) throw new Error('Genesis differs from deployment. Redeploy on this chain.');
  for(const addr of [d.router,d.aave.pool,d.receiver]) if(await provider.getCode(addr)==='0x') throw new Error('Missing contract bytecode. Chain may have been reset; redeploy.');
  const signer=process.env.PRIVATE_KEY?new Wallet(process.env.PRIVATE_KEY,provider):await provider.getSigner(d.deployer);
  const owner=await signer.getAddress();
  const token=s=>{if(!d.tokens[s])throw new Error(`Unknown token ${s}; use A/B/C/D`);return new Contract(d.tokens[s],tokenAbi,signer);};
  const factory=new Contract(d.factory,v2('UniswapV2Factory').abi,provider);
  const router=new Contract(d.router,v2('UniswapV2Router02').abi,signer);
  const deadline=async()=> (await provider.getBlock('latest')).timestamp+300;
  const bps=Number(process.env.SLIPPAGE_BPS||50);
  if(!Number.isInteger(bps)||bps<0||bps>=10000)throw new Error('SLIPPAGE_BPS must be 0..9999');
  const minimum=x=>x*BigInt(10000-bps)/10000n;
  if(command==='status'){
    console.log(`chain=${network.chainId} wallet=${owner}`);
    for(const s of Object.keys(d.tokens)){const t=token(s);console.log(`${s}: ${formatUnits(await t.balanceOf(owner),await t.decimals())}`);}
    console.log('A/D pair:',await factory.getPair(d.tokens.A,d.tokens.D),'(expected',ZeroAddress+')');
    console.log('Aave Pool:',d.aave.pool,'Receiver:',d.receiver);
  }else if(command==='quote'||command==='swap'){
    const [amount,route='A,B']=args;
    const symbols=route.toUpperCase().split(',');
    if(symbols.length<2||new Set(symbols).size!==symbols.length)throw new Error('Provide a simple path, e.g. A,B,C,D');
    symbols.forEach(token);
    const path=symbols.map(s=>d.tokens[s]);
    const input=token(symbols[0]);
    const amountIn=parseUnits(amount,await input.decimals());
    if(amountIn<=0n)throw new Error('Amount must be positive');
    const outputToken=token(symbols.at(-1));
    if(command==='swap'&&await input.allowance(owner,d.router)<amountIn)await(await input.approve(d.router,amountIn)).wait();
    const amounts=await router.getAmountsOut(amountIn,path);
    const minOut=minimum(amounts.at(-1));
    console.log('Quote:',formatUnits(amounts.at(-1),await outputToken.decimals()),symbols.at(-1));
    if(command==='swap'){
      const before=await outputToken.balanceOf(owner);
      const tx=await router.swapExactTokensForTokens(amountIn,minOut,path,owner,await deadline());
      const receipt=await tx.wait();
      console.log('tx:',receipt.hash,'gas:',receipt.gasUsed.toString(),'received:',formatUnits((await outputToken.balanceOf(owner))-before,await outputToken.decimals()));
    }
  }else if(command==='route'){
    const [amount,from='A',to='D',hops='3']=args;
    const input=token(from), output=token(to);
    const {block,routes}=await bestRoutes(factory,provider,d.tokens[from],d.tokens[to],parseUnits(amount,await input.decimals()),Number(hops));
    const names=Object.fromEntries(Object.entries(d.tokens).map(([s,a])=>[a.toLowerCase(),s]));
    console.log('Snapshot block:',block,'(ranking by output before gas; single path, one factory)');
    for(const r of routes)console.log(r.path.map(a=>names[a.toLowerCase()]).join(' -> '),formatUnits(r.output,await output.decimals()));
    if(!routes.length)throw new Error('No route found');
  }else if(command==='flash'){
    const amount=parseUnits(args[0]||'100',18);
    const minProfit=parseUnits(args[1]||'1',18);
    if(amount<=0n||minProfit<0n)throw new Error('Invalid amount/profit');
    const r2=new Contract(d.router2,v2('UniswapV2Router02').abi,provider);
    const first=await router.getAmountsOut(amount,[d.tokens.A,d.tokens.B]);
    const second=await r2.getAmountsOut(first[1],[d.tokens.B,d.tokens.A]);
    console.log('Expected gross gain before Aave premium/gas:',formatUnits(second[1]-amount,18),'A');
    const artifact=require('../artifacts/contracts/FlashSwapReceiver.sol/FlashSwapReceiver.json');
    const receiver=new Contract(d.receiver,artifact.abi,signer);
    const params=[d.tokens.A,amount,d.tokens.B,minimum(first[1]),minimum(second[1]),minProfit,await deadline()];
    await receiver.start.staticCall(...params);
    // Nested Aave/DEX calls need headroom beyond RPC gas estimation on Geth.
    const estimated=await receiver.start.estimateGas(...params);
    const receipt=await(await receiver.start(...params,{gasLimit:estimated*150n/100n})).wait();
    for(const log of receipt.logs){try{const e=receiver.interface.parseLog(log);if(e?.name==='FlashCompleted')console.log('premium:',formatUnits(e.args.premium,18),'profit:',formatUnits(e.args.profit,18),'A (before gas)');}catch{}}
    console.log('tx:',receipt.hash,'gas:',receipt.gasUsed.toString());
  }else throw new Error('Commands: status | quote AMOUNT A,B | swap AMOUNT A,B,C,D | route AMOUNT A D 3 | flash AMOUNT MIN_PROFIT');
}
main().catch(e=>{
  console.error(e.shortMessage||e.message);
  if(e.receipt) console.error('Failed tx:',e.receipt.hash,'status:',e.receipt.status,'gas used:',e.receipt.gasUsed.toString());
  process.exitCode=1;
});
