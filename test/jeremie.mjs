// Contrôle qualité de Jérémie et menu d'événements (v1.26) : node test/jeremie.mjs [parties]
// Score par menu et par profil : les menus doivent rester proches (classement juste d'une semaine à l'autre).
import fs from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../src/', import.meta.url);
const code = ['config.js', 'core.js', 'bot.js'].map((f) => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.API={DEFAULTS,simulate,Game};', ctx);
const { DEFAULTS, simulate, Game } = ctx.API;
const N = +(process.argv[2] || 300);
const f = (x, d = 0) => x.toFixed(d);
console.log('menu'.padEnd(22), 'profil'.padEnd(9), 'score   p10    p90  Hugo or  Alex  Jér. passages approuvé refusé  clients×2');
for (const [name, over] of [['avant (sans Jérémie)', { jeremieOn: false }], ['alex', { menu: 'alex' }], ['jeremie', { menu: 'jeremie' }], ['tous', { menu: 'tous' }]]) {
  for (const p of ['debutant', 'bon', 'expert']) {
    const s = simulate(Object.assign({}, DEFAULTS, over), N, p, 12345);
    console.log(name.padEnd(22), p.padEnd(9), f(s.score).padStart(5), f(s.p10).padStart(6), f(s.p90).padStart(6), (f(s.hugoReached * 100) + '%').padStart(8),
      f(s.alexPasses, 2).padStart(5), f(s.jerVisits, 2).padStart(12), f(s.jerApproved, 2).padStart(9), f(s.jerRejected, 2).padStart(7), f(s.jerBoosted, 2).padStart(10));
  }
}
// Le hasard du menu : répartition sur 3 000 graines, et la suite des clients inchangée par rapport à « sans Jérémie »
const count = { alex: 0, jeremie: 0, tous: 0 };
for (let i = 0; i < 3000; i++) count[new Game(DEFAULTS, (12345 + i * 7919) >>> 0).menu]++;
console.log('menus tirés :', JSON.stringify(count));
