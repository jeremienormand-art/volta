import fs from 'node:fs'; import vm from 'node:vm';
const dir = new URL('../src/', import.meta.url);
const code = ['config.js','core.js','bot.js'].map(f=>fs.readFileSync(new URL(f,dir),'utf8')).join('\n');
const ctx={}; vm.createContext(ctx); vm.runInContext(code+'\nthis.API={DEFAULTS,runBotGame,BOT_PROFILES,summarize};',ctx);
const {DEFAULTS,runBotGame,BOT_PROFILES,summarize}=ctx.API;
const N=+(process.argv[2]||250);
console.log('réglage'.padEnd(22),'profil'.padEnd(9),'score  servis err partis jetés | Hugo moy  ', [8,9,10,11,12,13,14,15,16,17,18].join('   '));
for (const prep of ['tirage','simple']) for (const tray of [1,2,3]) for (const p of ['debutant','bon','expert']) {
  const cfg=Object.assign({},DEFAULTS,{prep,trayMax:tray}); const runs=[]; const hs=[];
  for(let i=0;i<N;i++){ const r=runBotGame(cfg,(777+i*7919)>>>0,BOT_PROFILES[p]); runs.push(r); if(r.hugoPlayed) hs.push(r.hugoServed); }
  const s=summarize(runs);
  const reach=t=>String(Math.round(100*hs.filter(x=>x>=t).length/hs.length)).padStart(3)+'%';
  console.log(`${prep} · plateau ${tray}`.padEnd(22),p.padEnd(9),String(Math.round(s.score)).padStart(5),s.drinks.toFixed(1).padStart(6),s.errors.toFixed(1).padStart(4),s.left.toFixed(1).padStart(5),s.discards.toFixed(1).padStart(5),'|',(hs.reduce((a,b)=>a+b,0)/hs.length).toFixed(1).padStart(5),'  ',[8,9,10,11,12,13,14,15,16,17,18].map(reach).join(' '));
}
