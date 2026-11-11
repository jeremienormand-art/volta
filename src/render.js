// ─────────────────────────────────────────────────────────────
// RENDER — sprites Arcade 90 et dessins dynamiques sur grille de pixels.
// Les personnages, le décor et les boissons proviennent exclusivement des atlas illustrés.
// ─────────────────────────────────────────────────────────────
const C = {
  nuit: '#241C19', nuit2: '#382A24', nuit3: '#533C2B', nuit4: '#795537', nuit5: '#A48155',
  rose: '#F39BB1', roseD: '#D7607F', orange: '#F07B2D', orangeD: '#C55A17',
  creme: '#F7EBD5', cremeD: '#E1CCA8', ink: '#201915',
  good: '#86D9AE', warn: '#F2B33D', bad: '#EE4F5E',
  gold: '#F3B640', goldD: '#C98A1B', stout: '#221410', head: '#EBDDBB', spritz: '#F2622A', shot: '#E2457A',
};
const FONT_T = "'Helvetica Neue', Arial, sans-serif";
const FONT_D = FONT_T;
// Police pixel (Jersey 10, embarquée) : grands chiffres, titres et textes qui sautent. Jamais sous 15 px.
const FONT_P = "'Jersey 10', 'Helvetica Neue', Arial, sans-serif";

const L = { W: 360, H: 640, padX: 0 };
function computeLayout(H) {
  L.H = H;
  L.hudH = 44;
  L.stBot = H - 24;
  L.stTop = L.stBot - 150;
  L.maxBot = L.stTop - 4;
  L.maxTop = L.maxBot - 130;
  L.counterBot = L.maxTop;
  L.counterTop = L.counterBot - 8;
  L.custBase = L.counterTop + 5;        // bas du buste, caché par le comptoir
  L.bubbleY = L.counterTop - 151;        // centre des bulles de commande
  L.seatX = [45, 135, 225, 315];
  L.colW = 90;
}
computeLayout(640);

const ease = {
  out: (k) => 1 - Math.pow(1 - k, 3),
  back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
};

function rr(ctx, x, y, w, h, r) {
  // Courbes fines pour les bulles et petits éléments, sans marches de gros pixels.
  r = Math.max(0, Math.min(8, r, w / 2, h / 2));
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

function text(ctx, s, x, y, size, color, opt = {}) {
  // opt.pixel : taille donnée telle quelle ; opt.display dès 15 px : police pixel, un peu plus grande (elle est étroite).
  const pix = opt.pixel || (opt.display && size >= 15);
  ctx.font = pix ? `400 ${opt.pixel ? size : Math.round(size * 1.3)}px ${FONT_P}` : `${opt.weight || 700} ${size}px ${opt.display ? FONT_D : FONT_T}`;
  ctx.fillStyle = color;
  ctx.textAlign = opt.align || 'center';
  ctx.textBaseline = opt.base || 'alphabetic';
  if (opt.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = opt.strokeW || 4; ctx.strokeStyle = opt.stroke; ctx.strokeText(String(s).normalize('NFC'), x, y); }
  ctx.fillText(String(s).normalize('NFC'), x, y);
}

// ── Verres : la silhouette suffit à reconnaître la boisson, la couleur ne sert que de renfort ──
const GLASS_H = { ipa: 30, stout: 30, spritz: 30, shot: 16 };
function glassPath(ctx, d) {
  ctx.beginPath();
  if (d === 'ipa') { ctx.moveTo(-8, 0); ctx.lineTo(-11, -24); ctx.quadraticCurveTo(-12.5, -27, -11, -30); ctx.lineTo(11, -30); ctx.quadraticCurveTo(12.5, -27, 11, -24); ctx.lineTo(8, 0); ctx.closePath(); }
  else if (d === 'stout') { ctx.moveTo(-3, -7); ctx.bezierCurveTo(-13, -12, -13, -24, -9, -30); ctx.lineTo(9, -30); ctx.bezierCurveTo(13, -24, 13, -12, 3, -7); ctx.closePath(); }
  else if (d === 'spritz') { ctx.moveTo(-12, -30); ctx.lineTo(12, -30); ctx.bezierCurveTo(12, -18, 6, -14, 0, -14); ctx.bezierCurveTo(-6, -14, -12, -18, -12, -30); ctx.closePath(); }
  else { ctx.moveTo(-6, 0); ctx.lineTo(-7.5, -16); ctx.lineTo(7.5, -16); ctx.lineTo(6, 0); ctx.closePath(); }
}
const GLASS_PIXELS = new Map();
function drawGlass(ctx, d, cx, by, s, fill = 1, opt = {}) {
  // Ne jamais mettre en cache une image vide pendant le décodage des atlas.
  if (!DRINK_ART.complete || !DRINK_ART.naturalWidth) return;
  const level = Math.round(Math.max(0, Math.min(1, fill)) * 64) / 64;
  const foam = Math.round(Math.min(1, opt.foamOver || 0) * 16) / 16;
  const key = [d, level, foam, opt.line || '', d === 'stout' && stoutStepsReady() ? 'etapes' : ''].join('|');
  let sprite = GLASS_PIXELS.get(key);
  if (!sprite) {
    sprite = document.createElement('canvas'); sprite.width = 96; sprite.height = 128;
    const p = sprite.getContext('2d'); p.scale(2, 2);
    drawGlassDetail(p, d, 24, 44, 1, level, { line: opt.line, foamOver: foam });
    if (GLASS_PIXELS.size >= 256) GLASS_PIXELS.delete(GLASS_PIXELS.keys().next().value);
    GLASS_PIXELS.set(key, sprite);
  }
  ctx.save(); ctx.translate(cx, by);
  if (opt.rot) ctx.rotate(opt.rot);
  ctx.globalAlpha *= opt.alpha == null ? 1 : opt.alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sprite, -24 * s, -44 * s, 48 * s, 64 * s);
  ctx.restore();
}
// Volta : tasse de chocolat (tools/pack-boissons.py) : corps centré à −4,3 (l'anse à droite), demi-largeur 10, liquide de −1 (vide) à −28 (plein).
const CUP = { cx: -4.3, half: 11, base: -1, top: -28 };
// Atlas illustré partagé entre stations, commandes, plateau et scènes.
// La découpe révèle le liquide du bas vers le haut et conserve les gestes de tirage.
function drawIllustratedGlass(ctx, d, cx, by, s, fill, opt) {
  if (!DRINK_ART.complete || !DRINK_ART.naturalWidth) return false;
  const col = ['ipa','stout','spritz','shot'].indexOf(d), f = Math.max(0, Math.min(1, fill));
  // Stout (v1.18) : six étapes dessinées du même verre, en fondu (plus de découpe du verre plein ni de disque de mousse).
  // Le tirage (remplissage 0 → 0,65 à la station) va de l'étape 1 à la 4, le repos (0,65 → 1) de la 4 à la 6.
  if (d === 'stout' && stoutStepsReady()) {
    const t = Math.min(5, f <= 0.65 ? (f / 0.65) * 3 : 3 + ((f - 0.65) / 0.35) * 2);
    const i = Math.floor(t), k = t - i;
    ctx.save(); ctx.translate(cx, by); ctx.scale(s, s); ctx.imageSmoothingEnabled = true;
    const step = (n) => ctx.drawImage(STOUT_STEPS, n * 192, 0, 192, 256, -24, -44, 48, 64);
    step(i);
    if (k > 0.01 && i < 5) { ctx.globalAlpha *= k; step(i + 1); }
    ctx.restore(); return true;
  }
  const sx = col * 192;
  ctx.save(); ctx.translate(cx, by); ctx.scale(s, s); ctx.imageSmoothingEnabled = true;
  const draw = row => ctx.drawImage(DRINK_ART, sx, row * 256, 192, 256, -24, -44, 48, 64);
  if (f >= 1) draw(0);
  else {
    draw(1);
    if (f > 0) {
      // Volta : repères mesurés par tools/pack-boissons.py (chocolat dans la tasse en verre, tasse d'expresso, croissant)
      const base = d === 'stout' ? -7 : d === 'spritz' ? -5 : d === 'shot' ? -4 : CUP.base;
      const top = d === 'shot' ? -15 : d === 'spritz' ? -14 : CUP.top;
      const level = base - (base - top) * f;
      ctx.save(); ctx.beginPath(); ctx.rect(-24, level, 48, 44 - level); ctx.clip(); draw(0); ctx.restore();
      if (d === 'ipa') {   // Volta : surface du chocolat dans la tasse (corps de la tasse centré à −4,3, l'anse à droite)
        ctx.fillStyle = '#B98560';
        ctx.beginPath(); ctx.ellipse(CUP.cx, level + 1, 8, 1.6, 0, 0, 7); ctx.fill();
      }
    }
  }
  if (opt.foamOver > 0 && d === 'ipa') {
    ctx.fillStyle = '#7A4528'; ctx.beginPath(); ctx.ellipse(-4.3,-29,10,2+opt.foamOver*3,0,0,7); ctx.fill();   // Volta : le chocolat déborde
    ctx.fillRect(3,-29,2,4+opt.foamOver*8);
  }
  ctx.restore(); return true;
}

function drawGlassDetail(ctx, d, cx, by, s, fill = 1, opt = {}) {
  drawIllustratedGlass(ctx, d, cx, by, s, fill, opt);
}

// ── Personnages : seuls les indices des atlas sont nécessaires ──
const LOOK = Array.from({length:LOOKS}, () => ({}));
const MAX_SPEC = {portrait:0};
const ALEX_SPEC = {portrait:1};
const HUGO_SPEC = {portrait:2};


// ── Décor ──
function drawRoom(ctx, t, top0, inGame) {
  const ok = (im) => im.complete && im.naturalWidth;
  const title = top0 === 0 && !inGame;                        // accueil : la salle remplit tout l'écran, le menu fait l'ombre
  // v1.32 : la salle profonde nette, à l'accueil comme en partie (la version floue est retirée).
  const room = ROOM_DEPTH, dim = 0;
  if (ok(room)) {
    const top = top0 === undefined ? L.hudH : top0, h = L.counterTop - top;
    const scale = Math.max((360 + 2 * L.padX) / room.naturalWidth, (h + (title ? 64 : 0)) / room.naturalHeight);
    const width = room.naturalWidth * scale, height = room.naturalHeight * scale;
    ctx.save(); ctx.beginPath(); ctx.rect(-L.padX - 2, top, 364 + 2 * L.padX, title ? L.H - top : h); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    if (title) { ctx.fillStyle = C.nuit; ctx.fillRect(-4, top, 368, L.H - top); }
    ctx.drawImage(room, (360 - width) / 2, top, width, height);
    if (title) { ctx.restore(); return; }
    if (dim) { ctx.fillStyle = `rgba(22,16,12,${dim})`; ctx.fillRect(-L.padX - 4, top, 368 + 2 * L.padX, h); }
    // Ombre locale et progressive derrière les clients, sans éteindre l’enseigne.
    const shade = ctx.createLinearGradient(0, L.counterTop - 170, 0, L.counterTop);
    shade.addColorStop(0, 'rgba(25,19,16,0)'); shade.addColorStop(1, 'rgba(25,19,16,0.38)');
    ctx.fillStyle = shade; ctx.fillRect(-4, L.counterTop - 170, 368, 170);
    ctx.restore(); return;
  }
  ctx.fillStyle = C.nuit; ctx.fillRect(-40, L.hudH, 440, L.counterTop - L.hudH);

}

function drawCounter(ctx) {
  const y = L.counterTop, h = L.counterBot - y;
  ctx.fillStyle = '#B9803F'; ctx.fillRect(-40, y, 440, h);   // Volta : rebord en bois clair
  ctx.fillStyle = '#E2AE62'; ctx.fillRect(-40, y, 440, 2);
  ctx.fillStyle = '#493021'; ctx.fillRect(-40, y + h - 2, 440, 2);
}

// ── Clients ──
function custOffset(s) {
  if (s.phase === 'arrive') return (1 - ease.back(Math.min(1, s.pt / 0.35))) * 70;
  if (s.phase === 'leave') return ease.inOut(Math.min(1, s.pt / 0.35)) * 90;
  return 0;
}
function custMood(s) {
  if (s.phase === 'happy') return 'happy';
  if (s.phase === 'angry') return 'furious';
  if (s.wrongT > 0) return 'annoyed';
  const f = s.patience / s.pmax;
  return f > 0.55 ? 'idle' : f > 0.25 ? 'annoyed' : 'furious';
}

function drawCustomer(ctx, g, s, now) {
  const x = L.seatX[s.seat];
  const off = custOffset(s);
  const by = L.custBase + off;
  const mood = custMood(s);
  let shake = 0;
  if (s.wrongT > 0) shake = Math.sin(now * 50) * 3 * (s.wrongT / 0.6);
  if (mood === 'furious' && s.phase === 'wait') shake = Math.sin(now * 38) * 1.4;
  const bob = s.phase === 'happy' ? -Math.sin(Math.min(1, s.pt / 0.45) * Math.PI) * 7 : Math.sin(now * 2 + s.id) * 0.8;
  const cx = x + shake;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 45, 0, 90, L.counterTop + 4); ctx.clip();
  if (s.dbl) {
    // Table de potes (v1.8) : mêmes proportions que l'atlas (96 × 112), côte à côte épaule contre épaule, l'ami un pas en retrait (plus petit, dans l'ombre).
    drawCustomerSprite(ctx, cx - 20, by + 5 + bob * 0.6, 74, 86, mateOf(s), mood, 0.25);
    drawCustomerSprite(ctx, cx + 19, by + 3 + bob, 80, 93, s.look, mood);
  } else {
    drawCustomerSprite(ctx, cx, by + bob, 92, 116, s.look, mood);
    // Le badge d'horloge dans la commande indique les clients pressés ;
    // aucun téléphone ni main de l'ancien rendu en code par-dessus le sprite.
  }
  ctx.restore();
  if (s.phase === 'wait' || s.phase === 'arrive') drawBubble(ctx, g, s, x, L.bubbleY + off * 0.4, now);
}

// ── Les amis parlent (v1.13) ──
// Une bulle au-dessus de la commande, le temps d'une phrase. Volta : Antoine, coach de la salle, sort de son cours.
const TALK = {
  // Volta : Antoine, coach de la salle, prend la place de Nico (même case de l'atlas, clé « nico »)
  nico: {
    first: 'Fin de cours, j’ai soif !', reply: 'Moi, je suis en plein cardio…',
    again: ['Encore moi ! Série suivante.', 'Allez, on garde le rythme !', 'Tu verses mieux que tu squattes.', 'Récup active au comptoir.'],
    served: ['Merci champion !', 'Belle exécution !', 'Propre, la technique !'],
    wrong: 'C’est pas mon programme, ça !', left: 'Je file faire mes burpees !',
  },
  // v1.21 (Jérémie) : chaque champ est facultatif. again : à l'arrivée, chance pAgain (0,5 par défaut) ; croissant : servi avec un croissant.
  roxane: { again: ['Allô l’astreinte ?'], pAgain: 0.25 },   // Fanny
  jordan: { again: ['Allô l’astreinte ?'], pAgain: 0.25 },
  elea: { croissant: ['Super… Du gluten…'], pCroissant: 0.7 },
  rayan: {
    first: 'Ding ding ! Premier round !', reply: 'Pas de K.-O. au comptoir, hein !',
    again: ['Adriaaaan !', 'L’œil du tigre !', 'Encore un round ?', 'Ding ding !'],
    served: ['Vole comme le papillon, pique comme l’abeille !', 'Je suis le plus grand !', 'Champion du monde !'],
    wrong: 'Tout le monde a un plan… jusqu’au premier coup.', left: 'J’encaisse… et j’avance.',
  },
  helene: {
    // v1.22 : RH bienveillante (Hélène doit pouvoir jouer sans le prendre mal) : elle repère les talents, prend soin de l'équipe
    first: 'Hélène, RH. Je repère les talents !', reply: 'Alors regarde bien ce service !',
    again: ['Pense à poser tes RTT !', 'Qualité de vie au travail : validée !', 'Toujours en recherche de talents !'],
    served: ['Compétence validée !', 'Avantage en nature validé !', 'Ça, c’est du savoir-faire !', 'Bel esprit d’équipe !'],
    wrong: 'On dit que c’est un axe de progrès ?', left: 'J’ai un onboarding, je file !',
  },
};
function linesOf(s) { const f = s && !s.isAlex ? friendOf(s.look) : null; return f ? TALK[f.key] : null; }
// v1.26 : la bulle de Jérémie monte un peu, au-dessus de ce qu'il attend (« PINTE PARFAITE »)
function talk(s, txt, dur = 2.3) { V.talk = V.talk.filter((b) => b.id !== s.id); V.talk.push({ id: s.id, x: L.seatX[s.seat], text: txt, t0: V.now, dur, lift: s.isJer ? 18 : 0 }); }
function friendEvent(e, s) {
  const t = linesOf(s), k = t && friendOf(s.look).key;   // v1.21 : rencontre notée par personne (Rayan a deux indices, 0 et 4)
  if (!t) return;
  if (e.type === 'spawn') {
    if (t.first && !V.met[k]) { V.met[k] = true; talk(s, t.first); if (t.reply) V.pendingSay = { text: t.reply, at: V.now + 1.4 }; }
    else if (t.again && Math.random() < (t.pAgain ?? 0.5)) talk(s, pick(t.again));
  } else if (e.type === 'serve' && e.complete) {
    if (t.croissant && (e.drinks || []).includes('shot') && Math.random() < (t.pCroissant ?? 0.5)) talk(s, pick(t.croissant), 1.8);
    else if (t.served && Math.random() < 0.35) talk(s, pick(t.served), 1.6);
  }
  else if (e.type === 'wrong' && t.wrong) talk(s, t.wrong, 1.8);
  else if (e.type === 'left' && t.left) talk(s, t.left, 2);
}
function drawTalks(ctx, g, now) {
  for (const b of V.talk) {
    const s = g && g.seats.find((c) => c && c.id === b.id);
    if (s && s.complainT > 0) continue;                       // la bulle « Pas assez remplie » passe avant
    const age = now - b.t0, k = Math.min(1, age / 0.15), out = Math.min(1, (b.dur - age) / 0.25);
    ctx.font = `800 12.5px ${FONT_T}`;
    const lines = splitLine(ctx, b.text, 150);
    const w = Math.min(176, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22), h = 16 + lines.length * 15;
    const ax = b.x, ay = L.bubbleY - 33 - (b.lift || 0);
    const bx = Math.max(6, Math.min(354 - w, ax - w / 2)), by = Math.max(L.hudH + 40, ay - 8 - h);
    const tx = Math.max(bx + 14, Math.min(bx + w - 14, ax));
    ctx.save();
    ctx.globalAlpha = Math.max(0, out);
    ctx.translate(tx, by + h); ctx.scale(ease.back(k), ease.back(k)); ctx.translate(-tx, -(by + h));
    ctx.fillStyle = 'rgba(32,25,21,0.45)'; rr(ctx, bx + 2, by + 3, w, h, 8); ctx.fill();
    ctx.fillStyle = C.creme; rr(ctx, bx, by, w, h, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 7, by + h - 1); ctx.lineTo(tx, by + h + 7); ctx.lineTo(tx + 7, by + h - 1); ctx.fill();
    lines.forEach((l, i) => text(ctx, l, bx + w / 2, by + 20 + i * 15, 12.5, C.ink, { weight: 800 }));
    ctx.restore();
  }
}

// Le client refuse une IPA trop vide : il le dit, au-dessus de sa commande.
function drawComplaint(ctx, s, x, now) {
  const k = Math.min(1, (1.8 - s.complainT) / 0.15), out = s.complainT < 0.25 ? s.complainT / 0.25 : 1;
  const lines = ['Pas assez', 'remplie !'];
  const w = 96, h = 40;
  const ax = x, ay = L.bubbleY - 33;                      // pointe : haut de la bulle de commande
  const bx = Math.max(6, Math.min(354 - w, ax - w / 2)), by = Math.max(L.hudH + 40, ay - 8 - h);
  ctx.save();
  ctx.globalAlpha = out;
  ctx.translate(ax, by + h); ctx.scale(ease.back(k), ease.back(k)); ctx.translate(-ax, -(by + h));
  ctx.fillStyle = 'rgba(32,25,21,0.5)'; rr(ctx, bx + 2, by + 3, w, h, 6); ctx.fill();
  ctx.fillStyle = C.warn; rr(ctx, bx, by, w, h, 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ax - 7, by + h - 1); ctx.lineTo(ax, by + h + 7); ctx.lineTo(ax + 7, by + h - 1); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; rr(ctx, bx, by, w, h, 6); ctx.stroke();
  lines.forEach((l, i) => text(ctx, l, bx + w / 2, by + 17 + i * 15, 13, C.ink, { weight: 800 }));
  ctx.restore();
}

function drawBubble(ctx, g, s, x, cy, now) {
  const inv = g.inverted();
  const n = s.orders.length;
  const w = n > 1 ? 84 : 58, h = 60;
  const bx = x - w / 2, by = cy - h / 2;
  const pop = s.phase === 'arrive' ? ease.back(Math.min(1, s.pt / 0.35)) : 1;
  ctx.save();
  ctx.translate(x, cy + h / 2);
  ctx.scale(pop, pop);
  ctx.translate(-x, -(cy + h / 2));
  const f = s.patience / s.pmax;
  const low = f < 0.25 && s.phase === 'wait';
  ctx.fillStyle = inv ? C.rose : C.creme;
  rr(ctx, bx, by, w, h, 12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 7, by + h - 1); ctx.lineTo(x, by + h + 8); ctx.lineTo(x + 7, by + h - 1); ctx.fill();
  if (low) { ctx.strokeStyle = (Math.floor(now * 6) % 2) ? C.bad : 'rgba(238,79,94,0.4)'; ctx.lineWidth = 3; rr(ctx, bx, by, w, h, 12); ctx.stroke(); }
  if (s.wrongT > 0) { ctx.strokeStyle = C.bad; ctx.lineWidth = 3; rr(ctx, bx, by, w, h, 12); ctx.stroke(); }
  for (let i = 0; i < n; i++) {
    const o = s.orders[i];
    const gx = n > 1 ? x - 19 + i * 38 : x;
    const d = o.drink;
    const sc = n > 1 ? 1.05 : 1.25;
    const gy = by + 25 + (GLASS_H[d] * sc) / 2;
    if (inv && !o.done) {
      drawGlass(ctx, d, gx, gy - GLASS_H[d] * sc, sc, 1, { rot: Math.PI, line: C.nuit });
    } else {
      drawGlass(ctx, d, gx, gy, sc, 1, { line: C.nuit, alpha: o.done ? 0.3 : 1 });
    }
    if (o.done) drawUIIcon(ctx, 'check', gx - 12, by + 18, 24);
  }
  if (s.type === 'presse') { // badge : pressé, rapporte plus
    drawUIIcon(ctx, 'clock', bx + w - 12, by - 9, 22);
  }
  if (inv) { // signe d'inversion
    drawUIIcon(ctx, 'swap', bx - 8, by - 8, 22);
  }
  // jauge de patience, dans la bulle
  const gw = w - 16, gx0 = x - gw / 2, gy0 = by + h - 12;
  ctx.fillStyle = inv ? 'rgba(32,25,21,0.25)' : 'rgba(32,25,21,0.14)'; rr(ctx, gx0, gy0, gw, 6, 3); ctx.fill();
  ctx.fillStyle = f > 0.55 ? '#3FA772' : f > 0.25 ? '#D98A12' : C.bad;
  rr(ctx, gx0, gy0, Math.max(3, gw * Math.max(0, f)), 6, 3); ctx.fill();
  ctx.restore();
}

function drawAlexSeat(ctx, g, s, now) {
  const x = L.seatX[s.seat];
  const off = s.phase === 'arrive' ? (1 - ease.back(Math.min(1, s.pt / 0.35))) * 70 : s.phase === 'leave' ? ease.inOut(Math.min(1, s.pt / 0.35)) * 90 : 0;
  const by = L.custBase + off;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 45, 0, 90, L.counterTop + 4); ctx.clip();
  const mood = s.phase === 'vexed' ? 'vexed' : s.phase === 'cheers' ? 'proud' : 'happy';
  drawCharacterBust(ctx, x - 42, by - 120, 84, 120, ALEX_SPEC, {mood});
  // Plateau au niveau du torse, sous le visage ; trois shots bien séparés.
  if (SERVING_TRAY.complete && SERVING_TRAY.naturalWidth) {
    ctx.drawImage(SERVING_TRAY, x - 36, by - 16, 72, 17);
  }
  for (let i = 0; i < 3; i++) drawGlass(ctx, 'shot', x - 22 + i * 22, by - 8, 1, 1);
  ctx.restore();
  if (s.phase === 'offer' || s.phase === 'arrive') drawAlexOffer(ctx, g, s, x, off, now);
}

// Offre d'Alex (v1.9) : même gabarit qu'une bulle de commande, toujours entière à l'écran.
// Le shot et le multiplicateur en grand, le temps restant en jauge (comme la patience des clients),
// et l'appel « TOUCHE ALEX » collé au-dessus. La pointe reste sous Alex même quand la bulle est poussée vers l'intérieur.
function drawAlexOffer(ctx, g, s, x, off, now) {
  const w = 88, h = 60, top = L.bubbleY - 30 + off * 0.4;
  const bx = Math.max(6, Math.min(354 - w, x - w / 2));
  const tx = Math.max(bx + 16, Math.min(bx + w - 16, x));
  const pop = s.phase === 'arrive' ? ease.back(Math.min(1, s.pt / 0.35)) : 1;
  const k = Math.max(0, Math.min(1, (s.offerEnd - g.t) / g.cfg.alexOfferTime));
  const urgent = k < 0.3 && s.phase === 'offer';
  ctx.save();
  ctx.translate(tx, top + h); ctx.scale(pop, pop); ctx.translate(-tx, -(top + h));
  // appel
  const lab = 'TOUCHE MICHEL', lw = 84;
  ctx.fillStyle = C.nuit; rr(ctx, bx + (w - lw) / 2, top - 16, lw, 20, 7); ctx.fill();
  text(ctx, lab, bx + w / 2, top - 2, 10, urgent && Math.floor(now * 6) % 2 ? C.rose : C.creme, { weight: 800 });
  // bulle
  ctx.fillStyle = C.rose; rr(ctx, bx, top, w, h, 12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(tx - 7, top + h - 1); ctx.lineTo(tx, top + h + 8); ctx.lineTo(tx + 7, top + h - 1); ctx.fill();
  if (urgent) { ctx.strokeStyle = Math.floor(now * 6) % 2 ? C.nuit : 'rgba(32,25,21,0.35)'; ctx.lineWidth = 2.5; rr(ctx, bx, top, w, h, 12); ctx.stroke(); }
  drawGlass(ctx, 'shot', bx + 24, top + 42, 1.35, 1, { line: C.nuit });
  text(ctx, '×' + String(g.cfg.alexMult).replace('.', ',') + ' ?', bx + 60, top + 36, 26, C.ink, { pixel: true });
  // temps restant
  const gw = w - 16, gx0 = bx + 8, gy0 = top + h - 12;
  ctx.fillStyle = 'rgba(32,25,21,0.22)'; rr(ctx, gx0, gy0, gw, 6, 3); ctx.fill();
  ctx.fillStyle = C.ink; rr(ctx, gx0, gy0, Math.max(3, gw * k), 6, 3); ctx.fill();
  ctx.restore();
}

// ── Jérémie, le contrôle qualité (v1.26) ──
// Il s'installe comme un client et commande une IPA. Au-dessus de sa commande : ce qu'il attend (« PINTE PARFAITE »).
// Il goûte, puis tamponne son verdict sur place : « APPROUVÉ » ou « À REFAIRE ».
function jeremieMood(s) {
  if (s.phase === 'taste') return s.tastedDrink && s.tastedDrink !== 'ipa' ? 'tipsy' : 'taste';   // v1.35 : autre verre, tenu à côté
  if (s.phase === 'approve') return s.tipsy ? 'tipsy' : 'approve';
  if (s.phase === 'reject' || s.phase === 'gone' || s.wrongT > 0) return 'reject';
  return s.tipsy ? 'tipsy' : 'idle';
}
function drawJeremieSeat(ctx, g, s, now) {
  const x = L.seatX[s.seat];
  const off = custOffset(s);
  const by = L.custBase + off;
  const shake = s.wrongT > 0 ? Math.sin(now * 50) * 3 * (s.wrongT / 0.6) : 0;
  const sway = 0;   // Volta : Marie affamée ne tangue pas (Jérémie pompette tanguait)
  const bob = s.phase === 'approve' ? -Math.sin(Math.min(1, s.pt / 0.45) * Math.PI) * 7 : Math.sin(now * 2 + s.id) * 0.8;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 45, 0, 90, L.counterTop + 4); ctx.clip();
  const c = drawJeremieSprite(ctx, x + shake + sway, by + bob, 92, 116, jeremieMood(s));   // même taille que les amis
  // Silhouette provisoire : on montre la pinte qu'il goûte (avec ses dessins, elle est dans l'image)
  if (c && c.ghost && s.phase === 'taste') drawGlass(ctx, 'ipa', x + 22, by - 22, 0.9, 1);
  // v1.35 : pompette, il goûte un shot, une stout ou un spritz (son dessin « goûte » tient une IPA) : on montre le vrai verre
  else if (s.phase === 'taste' && s.tastedDrink && s.tastedDrink !== 'ipa') drawGlass(ctx, s.tastedDrink, x + 24, by - 26, 0.9, 1);
  ctx.restore();
  if (c && c.ghost && s.phase !== 'leave') text(ctx, '?', x + sway, by - 66 + bob, 30, C.cremeD, { pixel: true });
  if (s.phase === 'wait' || s.phase === 'arrive') {
    drawBubble(ctx, g, s, x, L.bubbleY + off * 0.4, now);
    // ce qu'il attend, collé au-dessus de la bulle (comme « TOUCHE ALEX »)
    const lab = s.tipsy ? 'ENCORE UNE !' : 'ZONE DORÉE', lw = s.tipsy ? 80 : 82, top = L.bubbleY - 30 + off * 0.4;
    const bx = Math.max(6, Math.min(354 - lw, x - lw / 2));
    ctx.fillStyle = C.nuit; rr(ctx, bx, top - 16, lw, 20, 7); ctx.fill();
    text(ctx, lab, bx + lw / 2, top - 2, 10, C.gold, { weight: 800 });
    if (!s.tipsy) drawUIIcon(ctx, 'star', x + 16, top + 4, 20);
  }
}
// Le tampon du verdict, qui claque sur le comptoir devant lui (dessiné après le comptoir et le bandeau de Max) :
// son expression et la pinte qu'il tient restent visibles.
function drawJeremieStamps(ctx, g) {
  for (const s of g.seats) {
    if (!s || !s.isJer || (s.phase !== 'approve' && s.phase !== 'reject')) continue;
    const x = Math.max(62, Math.min(298, L.seatX[s.seat]));
    const ok = s.phase === 'approve', k = Math.min(1, s.pt / 0.18), sc = 1 + (1 - ease.out(k)) * 1.2;
    const lab = ok ? 'APPROUVÉ' : (s.tries >= g.cfg.jeremieTries ? 'À REVOIR' : 'À REFAIRE');
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.pt / 0.08) * (s.pt > 1.2 ? Math.max(0, 1 - (s.pt - 1.2) / 0.3) : 1);
    ctx.translate(x, L.counterTop + 6); ctx.rotate(-0.09); ctx.scale(sc * 0.9, sc * 0.9);
    ctx.font = `400 25px ${FONT_P}`;
    const w = ctx.measureText(lab).width + 16;
    ctx.strokeStyle = ok ? C.rose : C.orange; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(32,25,21,0.85)'; rr(ctx, -w / 2, -17, w, 32, 5); ctx.fill(); rr(ctx, -w / 2, -17, w, 32, 5); ctx.stroke();
    text(ctx, lab, 0, 8, 25, ok ? C.rose : C.orange, { pixel: true });
    ctx.restore();
  }
}
