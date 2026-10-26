const { Contract } = require('ethers');
const pairAbi = ['function token0() view returns(address)','function token1() view returns(address)','function getReserves() view returns(uint112,uint112,uint32)'];
function amountOut(input, reserveIn, reserveOut) {
  if (input <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  return input * 997n * reserveOut / (reserveIn * 1000n + input * 997n);
}
async function loadGraph(factory, provider, blockTag) {
  const graph = new Map();
  const count = Number(await factory.allPairsLength({ blockTag }));
  for (let i=0; i<count; i++) {
    const address = await factory.allPairs(i, { blockTag });
    const p = new Contract(address, pairAbi, provider);
    const [a,b,r] = await Promise.all([p.token0({blockTag}),p.token1({blockTag}),p.getReserves({blockTag})]);
    for (const [from,to,rin,rout] of [[a,b,r[0],r[1]],[b,a,r[1],r[0]]]) {
      const key = from.toLowerCase();
      if (!graph.has(key)) graph.set(key, []);
      graph.get(key).push({ to, reserveIn:rin, reserveOut:rout, pair:address });
    }
  }
  return graph;
}
function findRoutes(graph, start, end, input, maxHops = 3) {
  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 6) throw new Error('maxHops must be 1..6');
  if (input <= 0n) throw new Error('amountIn must be positive');
  if (start.toLowerCase() === end.toLowerCase()) throw new Error('Use distinct input/output tokens');
  const results=[];
  function dfs(current, amount, path, visited) {
    if (current.toLowerCase() === end.toLowerCase()) { results.push({path, output:amount}); return; }
    if (path.length - 1 >= maxHops) return;
    for (const edge of graph.get(current.toLowerCase()) || []) {
      const key=edge.to.toLowerCase();
      if (visited.has(key)) continue;
      const output=amountOut(amount,edge.reserveIn,edge.reserveOut);
      if (!output) continue;
      dfs(edge.to,output,[...path,edge.to],new Set([...visited,key]));
    }
  }
  dfs(start,input,[start],new Set([start.toLowerCase()]));
  return results.sort((a,b) => a.output === b.output ? a.path.length-b.path.length : a.output>b.output ? -1:1);
}
async function bestRoutes(factory, provider, start, end, input, maxHops=3) {
  const block = await provider.getBlockNumber();
  const graph=await loadGraph(factory,provider,block);
  return {block, routes:findRoutes(graph,start,end,input,maxHops)};
}
module.exports={amountOut,loadGraph,findRoutes,bestRoutes};
