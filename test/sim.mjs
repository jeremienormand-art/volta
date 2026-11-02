// Lance le simulateur hors navigateur : node test/sim.mjs
import fs from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../src/', import.meta.url);
const code = ['config.js', 'core.js', 'bot.js'].map((f) => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.API={DEFAULTS,simulate,Game,BOT_PROFILES};', ctx);
const { DEFAULTS, simulate } = ctx.API;

const N = +(process.argv[2] || 300);
const variants = [
  ['simple', { prep: 'simple' }],
  ['tirage', { prep: 'tirage' }],
  ['tirage · inversion', { prep: 'tirage', alexMode: 'inversion' }],
  ['tirage · sans événements', { prep: 'tirage', alexOn: false, hugoOn: false, jeremieOn: false }],
  ['simple · sans événements', { prep: 'simple', alexOn: false, hugoOn: false, jeremieOn: false }],
];
const f = (x, d = 0) => x.toFixed(d);
console.log('variante'.padEnd(26), 'profil'.padEnd(11), 'score  p10   p90   servis err  partis parf  Hugo(moy/obj) atteint impecc');
for (const [name, over] of variants) {
  for (const p of ['debutant', 'bon', 'expert']) {
    const cfg = Object.assign({}, DEFAULTS, over);
    const t0 = Date.now();
    const s = simulate(cfg, N, p, 12345);
    console.log(name.padEnd(26), p.padEnd(11), f(s.score).padStart(5), f(s.p10).padStart(5), f(s.p90).padStart(5),
      f(s.drinks, 1).padStart(6), f(s.errors, 1).padStart(4), f(s.left, 1).padStart(5), f(s.perfect, 1).padStart(5),
      (f(s.hugoServed, 1) + '/' + s.hugoTarget).padStart(10), (f(s.hugoReached * 100) + '%').padStart(7), (f(s.hugoPerfect * 100) + '%').padStart(6),
      `  ${Date.now() - t0}ms`);
  }
}
