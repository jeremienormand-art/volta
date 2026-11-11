// Vérifie qu'une même personne n'est jamais deux fois au comptoir (v1.17) : node test/doublons.mjs [parties]
// Le bot joue des parties complètes ; à chaque arrivée, on compte les personnes visibles (clients et amis des tables de potes).
import fs from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../src/', import.meta.url);
const code = ['config.js', 'core.js', 'bot.js'].map((f) => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.API={DEFAULTS,Game,BOT_PROFILES,botDecide,mulberry32,lookPerson,mateOf,LOOKS};', ctx);
const { DEFAULTS, Game, BOT_PROFILES, botDecide, mulberry32, lookPerson, mateOf, LOOKS } = ctx.API;

const N = +(process.argv[2] || 200);
let spawns = 0, doublons = 0, friendSpawns = 0;
const parPersonne = new Array(lookPerson(LOOKS - 1) + 1).fill(0);
for (let i = 0; i < N; i++) {
  const g = new Game(Object.assign({}, DEFAULTS, { hints: false }), (1234 + i * 7919) >>> 0);
  const prof = BOT_PROFILES.bon, r = mulberry32(99 + i);
  let ready = 0;
  while (!g.over) {
    g.step(1 / 60);
    for (const e of g.events.splice(0)) {
      if (e.type !== 'spawn') continue;
      spawns++;
      const vis = [];
      for (const s of g.seats) {
        if (!s || s.isAlex) continue;
        vis.push(lookPerson(s.look));
        if (s.dbl) vis.push(lookPerson(mateOf(s)));
      }
      if (new Set(vis).size !== vis.length) doublons++;
      const nouveau = g.seats[e.seat];
      if (nouveau) { parPersonne[lookPerson(nouveau.look)]++; if (nouveau.look >= 8) friendSpawns++; }
    }
    if (g.hold) g.hold = false;
    const t = g.clock();
    if (t >= ready && g.freeze <= 0) {
      const act = botDecide(g, prof, r, 1);
      if (act) {
        if (act.kind === 'serve' || act.kind === 'alex') g.serve(act.seat);
        else if (act.kind === 'discard') g.discardSlot(act.slot);
        else { const res = g.press(act.pos); if (res === 'pull') { g.setPressing(true); for (let k = 0; k < 40 && g.st.ipa.fill < 0.9; k++) g.step(1 / 60); g.releasePull(); g.setPressing(false); } }
        ready = t + prof.think + prof.tap;
      } else ready = t + 0.05;
    }
  }
}
const noms = ['Rayan', 'Jordan', 'Hélène', 'Kenza', 'Anaïs', 'Antoine', 'Fanny', 'Djaher', 'Elea', 'Nise'];
console.log(`${N} parties, ${spawns} arrivées, ${doublons} avec une même personne en double`);
console.log('Arrivées par personne :', noms.map((n, i) => `${n} ${Math.round(100 * parPersonne[i] / spawns)} %`).join(' · '));
if (doublons) process.exit(1);
