import fs from 'node:fs'; import vm from 'node:vm';
const dir = new URL('../src/', import.meta.url);
const code = ['config.js','core.js','bot.js'].map(f=>fs.readFileSync(new URL(f,dir),'utf8')).join('\n');
const ctx={}; vm.createContext(ctx); vm.runInContext(code+'\nthis.API={DEFAULTS,runBotGame,BOT_PROFILES};',ctx);
const {DEFAULTS,runBotGame,BOT_PROFILES}=ctx.API;
for (const prep of ['simple','tirage']) for (const p of ['debutant','bon','expert']) {
  const cfg=Object.assign({},DEFAULTS,{prep}); const served=[];
  for(let i=0;i<300;i++){ const r=runBotGame(cfg,(777+i*7919)>>>0,BOT_PROFILES[p]); if(r.hugoPlayed) served.push(r.hugoServed); }
  const reach=t=>Math.round(100*served.filter(x=>x>=t).length/served.length);
  console.log(prep.padEnd(7),p.padEnd(9),'moy',(served.reduce((a,b)=>a+b,0)/served.length).toFixed(1), [9,10,11,12,13,14,15,16].map(t=>t+':'+reach(t)+'%').join(' '));
}
