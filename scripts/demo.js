const hre=require('hardhat');
const {parseEther,formatEther,ZeroAddress}=require('ethers');
const {deployLab,mined}=require('../lib/deploy');
const {bestRoutes}=require('../lib/routes');
async function main(){
  const [signer]=await hre.ethers.getSigners();
  const lab=await deployLab(hre,signer);
  const {deployment:d,tokens,router,pool,receiver}=lab;
  const owner=await signer.getAddress();
  console.log('No direct A/D:',await lab.factory.getPair(d.tokens.A,d.tokens.D)===ZeroAddress);
  for(const path of [[d.tokens.A,d.tokens.B],[d.tokens.A,d.tokens.B,d.tokens.C,d.tokens.D]]){
    const amount=parseEther('10');
    await mined(tokens.A.approve(d.router,amount));
    const q=await router.getAmountsOut(amount,path);
    const block=await signer.provider.getBlock('latest');
    const receipt=await mined(router.swapExactTokensForTokens(amount,q.at(-1)*995n/1000n,path,owner,block.timestamp+300));
    console.log('Swap',path.length-1,'hops:',receipt.hash,'quoted out:',formatEther(q.at(-1)));
  }
  const ranked=await bestRoutes(lab.factory,signer.provider,d.tokens.A,d.tokens.D,parseEther('100'),3);
  console.log('Routes:',ranked.routes.map(r=>({path:r.path,output:formatEther(r.output)})));
  const block=await signer.provider.getBlock('latest');
  const receipt=await mined(receiver.start(d.tokens.A,parseEther('100'),d.tokens.B,0,0,parseEther('1'),block.timestamp+300));
  for(const log of receipt.logs){try{const e=receiver.interface.parseLog(log);if(e?.name==='FlashCompleted')console.log('Flash:',{amount:formatEther(e.args.amount),premium:formatEther(e.args.premium),profit:formatEther(e.args.profit)});}catch{}}
  console.log('Receiver retained profit:',formatEther(await tokens.A.balanceOf(d.receiver)),'A');
  console.log('Aave premium bps:',(await pool.FLASHLOAN_PREMIUM_TOTAL()).toString());
}
main().catch(e=>{console.error(e);process.exitCode=1;});
