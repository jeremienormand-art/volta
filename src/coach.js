// ─────────────────────────────────────────────────────────────
// COACH — guidage des premiers gestes, sans écran de règles.
// Une main fantôme montre le geste attendu, une bulle dit quoi faire, et rien ne disparaît
// tant que le geste n'est pas réussi. Chaque leçon est retenue d'une partie à l'autre :
//   hold  : maintenir l'IPA puis relâcher (tirage)
//   tap   : toucher une boisson (mode simple, spritz, shot)
//   stout : lancer la stout puis revenir la prendre (tirage)
//   serve : glisser le plateau jusqu'au client
// Pendant chaque consigne, le jeu se met en pause d'apprentissage (chrono, patience et arrivées arrêtés,
// voir Game.learnPause) et le reste de l'écran est grisé : seule la zone à toucher reste en clair.
// Le coach ne change pas les règles. Deux protections seulement, tant que « serve » n'est pas appris :
// le premier client patiente seul plus longtemps, et toucher le plateau ne jette pas le verre.
// ─────────────────────────────────────────────────────────────
const Coach = { learned: {}, nudge: null, key: '', since: 0, onLearn: null };

function coachLearn(k) {
  if (Coach.learned[k]) return;
  Coach.learned[k] = true;
  if (Coach.onLearn) Coach.onLearn(k);
}
function coachNudge(kind) { Coach.nudge = { kind, t: V.now }; }
function coachGuardsTray(cfg) { return !!cfg.hints && !Coach.learned.serve; }
function coachReset() { Coach.nudge = null; Coach.key = ''; }

function coachEvent(g, cfg, e) {
  if (!cfg.hints) return;
  const n = Coach.nudge && Coach.nudge.kind;
  switch (e.type) {
    case 'pullStart': if (n === 'cancel' || n === 'overflow') Coach.nudge = null; break;
    case 'pullCancel': if (!Coach.learned.hold) coachNudge('cancel'); break;
    case 'overflow': if (!Coach.learned.hold) coachNudge('overflow'); break;
    case 'pick':
      if (e.fill !== undefined && e.q === 'low') { if (!Coach.learned.hold) coachNudge('low'); break; } // relâchée trop tôt : la leçon continue
      if (e.fill !== undefined) coachLearn('hold');
      else if (g.gesture(e.drink) === 'rest') coachLearn('stout');
      else coachLearn('tap');
      if (n === 'cancel' || n === 'overflow') Coach.nudge = null;
      break;
    case 'serve': Coach.nudge = null; coachLearn('serve'); break;
    case 'tooLow': if (!Coach.learned.hold) coachNudge('low'); break;
  }
}

// Ce qu'il faut montrer maintenant, ou null. Suit les clients dans leur ordre d'arrivée.
function coachStep(g, cfg) {
  if (!cfg.hints || !g || g.over || g.freeze > 0 || V.countdown > 0) return null;
  const learned = Coach.learned;
  if (g.st.ipa.pulling) return learned.hold ? null : { kind: 'release', drink: 'ipa' };
  const waiting = g.seats.filter((s) => s && !s.isAlex && (s.phase === 'wait' || s.phase === 'arrive')).sort((a, b) => a.id - b.id);
  if (!waiting.length) return null;
  // une IPA trop vide (ou repartie sous la tireuse) ne compte pas : elle est à compléter
  const tray = g.tray.filter((x) => x.q !== 'low' && x !== g.st.ipa.topUp).map((x) => x.drink);
  // 1. un verre du plateau attend son client : glisser
  if (!learned.serve && tray.length) {
    for (const s of waiting) {
      if (s.orders.some((o) => !o.done && tray.includes(g.need(o.drink)))) return { kind: V.drag ? 'drop' : 'serve', seat: s.seat };
    }
  }
  // 2. la prochaine boisson qui manque (une stout qui repose laisse passer la suivante)
  const avail = tray.slice();
  let resting = null;
  for (const s of waiting) {
    for (const o of s.orders) {
      if (o.done) continue;
      const d = g.need(o.drink);
      const i = avail.indexOf(d);
      if (i >= 0) { avail.splice(i, 1); continue; }
      const gs = g.gesture(d);
      if (gs === 'rest') {
        const ph = g.st.stout.phase;
        if (ph === 'pour' || ph === 'rest') { if (!resting) resting = { kind: 'stoutRest', drink: 'stout', seat: s.seat }; continue; }
        if (learned.stout) return null;
        return { kind: ph === 'ready' ? 'stoutReady' : 'stoutLaunch', drink: 'stout', seat: s.seat };
      }
      const topUp = gs === 'hold' && g.tray.some((x) => x.q === 'low');
      if (g.trayFull() && !topUp) return null;
      if (gs === 'hold') return learned.hold ? null : { kind: 'hold', drink: d, seat: s.seat };
      return learned.tap ? null : { kind: 'tap', drink: d, seat: s.seat };
    }
  }
  return resting && !learned.stout ? resting : null;
}

function coachText(g, cfg, st) {
  const n = Coach.nudge ? Coach.nudge.kind : null;
  const many = g.trayMax() > 1;
  switch (st.kind) {
    case 'hold':
      if (n === 'cancel') return { main: 'Garde le doigt appuyé', sub: 'la tasse se remplit', tone: 'warn' };
      if (n === 'overflow') return { main: 'Trop plein !', sub: 'relâche plus tôt, dans le rose', tone: 'warn' };
      if (n === 'low' || g.tray.some((x) => x.q === 'low')) return { main: 'Pas assez remplie !', sub: 'maintiens pour la compléter', tone: 'warn' };
      return { main: 'Maintiens ici', sub: 'la tasse se remplit' };
    case 'release': {
      const f = g.st.ipa.fill;
      if (f >= cfg.perfectLo && f <= cfg.perfectHi) return { main: 'Relâche maintenant !', tone: 'rose' };
      if (f > cfg.perfectHi) return { main: 'Relâche vite !', sub: 'ça va déborder', tone: 'warn' };
      return { main: 'Garde le doigt appuyé', sub: 'lâche dans la zone rose' };
    }
    case 'tap':
      return { main: 'Touche ici', sub: cfg.prep === 'simple' ? (many ? 'la commande va sur ton plateau' : 'Etienne prend la commande') : 'un toucher suffit' };
    case 'stoutLaunch': return { main: 'Touche pour lancer le matcha', sub: 'elle doit reposer un peu' };
    case 'stoutRest': return { main: 'Le matcha infuse…', sub: 'reviens la prendre quand elle est prête' };
    case 'stoutReady': return { main: 'Elle est prête !', sub: 'touche pour la prendre', tone: 'rose' };
    case 'serve':
      if (n === 'tapTray') return { main: 'Garde le doigt sur le plateau', sub: 'et glisse jusqu’au client', tone: 'warn' };
      if (n === 'miss') return { main: 'Lâche sur le client', sub: 'glisse jusqu’à lui', tone: 'warn' };
      return { main: many ? 'Glisse le plateau vers le client' : 'Glisse le plateau vers le client' };
    case 'drop': return { main: 'Lâche sur le client' };
  }
  return null;
}

// ── Dessin ──
function drawCoach(ctx, g, cfg, st, now) {
  const key = st.kind + ':' + (st.seat === undefined ? '' : st.seat);
  if (key !== Coach.key) { Coach.key = key; Coach.since = now; }
  const fade = Math.min(1, (now - Coach.since) / 0.25);
  const txt = coachText(g, cfg, st);
  V.coachText = txt ? txt.main : null;
  const pulse = 0.55 + 0.45 * Math.sin(now * 6);
  ctx.save();
  ctx.globalAlpha = fade;
  switch (st.kind) {
    case 'hold': case 'tap': case 'stoutLaunch': case 'stoutRest': case 'stoutReady': {
      const p = stationX(g, st.drink);
      const x = p.x, top = L.stTop + p.y;
      ctx.strokeStyle = `rgba(247,235,213,${pulse})`; ctx.lineWidth = 3.5;
      rr(ctx, x - 44, top - 3, 88, 156, 16); ctx.stroke();
      const tx = (st.drink === 'spritz' || st.drink === 'shot') ? x - 10 : x, ty = top + 74;
      if (st.kind === 'hold') coachHoldAnim(ctx, tx, ty, now);
      else if (st.kind !== 'stoutRest') coachTapAnim(ctx, tx, ty, now);
      drawCallout(ctx, txt, x, L.stTop - 6, 'down', now);
      break;
    }
    case 'release': {
      const b = V.gaugeBox;
      if (!b) break;
      const half = (b.w || 108) / 2 + 4;
      if (b.x < 180) drawCallout(ctx, txt, b.x + half, b.zoneY, 'left', now);
      else drawCallout(ctx, txt, b.x - half, b.zoneY, 'right', now);
      break;
    }
    case 'serve': case 'drop': {
      const sx = L.seatX[st.seat];
      ctx.fillStyle = `rgba(247,235,213,${st.kind === 'drop' ? 0.1 : 0.05})`;
      ctx.fillRect(st.seat * 90 + 3, L.hudH + 2, 84, L.counterBot - L.hudH - 4);
      ctx.strokeStyle = `rgba(247,235,213,${st.kind === 'drop' ? 0.9 : pulse})`; ctx.lineWidth = 3.5;
      rr(ctx, st.seat * 90 + 3, L.hudH + 2, 84, L.counterBot - L.hudH - 4, 10); ctx.stroke();
      // la consigne se pose sur le comptoir, du côté que le geste ne traverse pas
      const path = coachDragPath(g, st.seat);
      const side = path.crossX > 180 ? 96 : 264;
      drawCallout(ctx, txt, st.kind === 'drop' ? sx : side, L.counterTop + 4, st.kind === 'drop' ? 'up' : 'none', now);
      if (st.kind === 'serve') coachDragAnim(ctx, g, path, now);
      break;
    }
  }
  ctx.restore();
}

// Coupe une consigne trop large en deux lignes, à l'espace le plus proche du milieu.
function splitLine(ctx, s, maxW) {
  if (ctx.measureText(s).width <= maxW) return [s];
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (best < 0 || Math.abs(i - s.length / 2) < Math.abs(best - s.length / 2))) best = i;
  return best < 0 ? [s] : [s.slice(0, best), s.slice(best + 1)];
}

// Bulle de consigne. (ax, ay) = pointe de la flèche ; dir = côté vers lequel elle pointe ('none' : (ax, ay) = haut de la bulle, centré).
function drawCallout(ctx, txt, ax, ay, dir, now) {
  if (!txt) return;
  ctx.font = `800 15px ${FONT_T}`;
  const lines = splitLine(ctx, txt.main, dir === 'none' ? 190 : 300);
  const mw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  let sw = 0;
  if (txt.sub) { ctx.font = `700 11.5px ${FONT_T}`; sw = ctx.measureText(txt.sub).width; }
  const w = Math.min(344, Math.max(mw, sw) + 28), gap = 9;
  const h = 32 + (lines.length - 1) * 18 + (txt.sub ? 14 : 0);
  const bob = Math.sin(now * 4) * 1.5;
  let bx, by;
  if (dir === 'down') { bx = ax - w / 2; by = ay - gap - h + bob; }
  else if (dir === 'up') { bx = ax - w / 2; by = ay + gap + bob; }
  else if (dir === 'none') { bx = ax - w / 2; by = ay + bob; }
  else if (dir === 'left') { bx = ax + gap + bob; by = ay - h / 2; }
  else { bx = ax - gap - w - bob; by = ay - h / 2; }
  bx = Math.max(8, Math.min(352 - w, bx));
  by = Math.max(L.hudH + 4, Math.min(L.H - h - 4, by));
  const fill = txt.tone === 'warn' ? C.warn : txt.tone === 'rose' ? C.rose : C.creme;
  ctx.fillStyle = 'rgba(32,25,21,0.5)'; rr(ctx, bx + 2, by + 4, w, h, 14); ctx.fill();
  ctx.fillStyle = fill;
  rr(ctx, bx, by, w, h, 14); ctx.fill();
  // flèche
  ctx.beginPath();
  if (dir === 'none') { /* pas de flèche */ }
  else if (dir === 'down') { const px = Math.max(bx + 16, Math.min(bx + w - 16, ax)); ctx.moveTo(px - 8, by + h - 1); ctx.lineTo(ax, ay + bob); ctx.lineTo(px + 8, by + h - 1); }
  else if (dir === 'up') { const px = Math.max(bx + 16, Math.min(bx + w - 16, ax)); ctx.moveTo(px - 8, by + 1); ctx.lineTo(ax, ay + bob); ctx.lineTo(px + 8, by + 1); }
  else if (dir === 'left') { ctx.moveTo(bx + 1, ay - 8); ctx.lineTo(ax + bob, ay); ctx.lineTo(bx + 1, ay + 8); }
  else { ctx.moveTo(bx + w - 1, ay - 8); ctx.lineTo(ax - bob, ay); ctx.lineTo(bx + w - 1, ay + 8); }
  ctx.closePath(); ctx.fill();
  const cx = bx + w / 2;
  lines.forEach((l, i) => text(ctx, l, cx, by + 21 + i * 18, 15, C.ink, { weight: 800 }));
  if (txt.sub) text(ctx, txt.sub, cx, by + 37 + (lines.length - 1) * 18, 11.5, C.nuit3, { weight: 700 });
}

// Main fantôme : (x, y) = bout de l'index, la main arrive d'en bas à droite.
function drawHand(ctx, x, y, s = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(-0.38); ctx.scale(0.85 * s, 0.85 * s);
  drawUIIcon(ctx, 'hand', -32, -3, 64);
  ctx.restore();
}

// Appui long : le doigt se pose, un anneau se remplit tant qu'il reste appuyé.
function coachHoldAnim(ctx, x, y, now) {
  const T = 1.9, t = now % T;
  let dy = 0, a = 1, s = 0.92;
  if (t < 0.25) { dy = (1 - t / 0.25) * 16; a = t / 0.25; s = 1; }
  else if (t > 1.45) { dy = -Math.min(1, (t - 1.45) / 0.2) * 8; s = 1; a = t > 1.65 ? Math.max(0, 1 - (t - 1.65) / 0.25) : 1; }
  const p = Math.max(0, Math.min(1, (t - 0.25) / 1.15));
  ctx.save();
  ctx.globalAlpha *= a;
  drawUIIcon(ctx, 'target', x - 25, y - 25, 50);
  if (p > 0) { ctx.strokeStyle = C.rose; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke(); ctx.lineCap = 'butt'; }
  ctx.restore();
  drawHand(ctx, x, y + dy, s, a);
}

// Toucher simple : le doigt tape, une onde part.
function coachTapAnim(ctx, x, y, now) {
  const T = 1.3, t = now % T;
  let dy = 0, a = 1, s = 1;
  if (t < 0.22) { dy = (1 - t / 0.22) * 14; a = t / 0.22; }
  else if (t < 0.36) s = 0.9;
  else if (t < 0.56) dy = -((t - 0.36) / 0.2) * 8;
  else { dy = -8; a = Math.max(0, 1 - (t - 0.9) / 0.3); }
  if (t > 0.24 && t < 0.9) {
    const k = (t - 0.24) / 0.66;
    ctx.save();
    ctx.globalAlpha *= 1 - k;
    const size = 20 + k * 52;
    drawUIIcon(ctx, 'target', x - size / 2, y - size / 2, size);
    ctx.restore();
  }
  drawHand(ctx, x, y + dy, s, Math.min(1, a));
}

// Trajet du geste : du verre attendu sur le plateau jusqu'au client.
function coachDragPath(g, seat) {
  const s = g.seats[seat], max = g.trayMax();
  let k = 0;
  if (s && s.orders) {
    const want = s.orders.filter((o) => !o.done).map((o) => g.need(o.drink));
    const i = g.tray.findIndex((gl) => want.includes(gl.drink) && gl.q !== 'low');
    if (i >= 0) k = i;
  }
  const p0 = { x: traySlotX(TRAY.cx, k, max), y: trayHomeY() - 14 }, p1 = { x: L.seatX[seat], y: L.counterTop - 12 };
  const c = { x: lerp(p0.x, p1.x, 0.2), y: lerp(p0.y, p1.y, 0.9) };
  const at = (t) => ({ x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y });
  let crossX = p1.x, best = Infinity; // où le geste traverse le comptoir
  for (let t = 0; t <= 1; t += 0.02) { const q = at(t), d = Math.abs(q.y - (L.counterTop + L.counterBot) / 2); if (d < best) { best = d; crossX = q.x; } }
  return { p0, p1, c, at, crossX };
}

// Glisser : le doigt prend le plateau et l'emmène jusqu'au client, en suivant la flèche.
function coachDragAnim(ctx, g, path, now) {
  const { p0, p1, c, at } = path;
  // flèche pointillée
  ctx.save();
  ctx.globalAlpha *= 0.6;
  ctx.strokeStyle = C.creme; ctx.lineWidth = 3; ctx.setLineDash([7, 7]); ctx.lineDashOffset = -now * 24;
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(c.x, c.y, p1.x, p1.y + 14); ctx.stroke();
  ctx.setLineDash([]);
  const ang = Math.atan2(p1.y + 14 - c.y, p1.x - c.x);
  ctx.fillStyle = C.creme; ctx.beginPath();
  ctx.moveTo(p1.x + Math.cos(ang) * 4, p1.y + 14 + Math.sin(ang) * 4);
  ctx.lineTo(p1.x + Math.cos(ang + 2.5) * 14, p1.y + 14 + Math.sin(ang + 2.5) * 14);
  ctx.lineTo(p1.x + Math.cos(ang - 2.5) * 14, p1.y + 14 + Math.sin(ang - 2.5) * 14);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // le geste
  const T = 2.3, t = now % T;
  let pos = p0, a = 1, s = 1, lift = 0;
  if (t < 0.25) { a = t / 0.25; }
  else if (t < 0.45) { s = 0.92; }
  else if (t < 1.4) { const k = ease.inOut((t - 0.45) / 0.95); pos = at(k); s = 0.92; lift = Math.min(1, (t - 0.45) / 0.18); }
  else if (t < 1.6) { pos = p1; lift = 1 - (t - 1.4) / 0.2; }
  else { pos = p1; lift = 0; a = Math.max(0, 1 - (t - 1.6) / 0.3); }
  if (t >= 1.4 && t < 1.9) {
    const k = (t - 1.4) / 0.5;
    ctx.save(); ctx.globalAlpha *= 1 - k;
    ctx.strokeStyle = C.creme; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p1.x, p1.y, 10 + k * 26, 0, 7); ctx.stroke();
    ctx.restore();
  }
  if (lift > 0 && g.tray.length) { // plateau fantôme porté au bout des doigts
    const max = g.trayMax(), w = max * TRAY.sp + 16;
    const ty = pos.y - 50 * lift;
    ctx.save(); ctx.globalAlpha *= 0.6 * a;
    ctx.fillStyle = '#E3D9C6'; rr(ctx, pos.x - w / 2, ty - 3, w, 6, 3); ctx.fill();
    g.tray.forEach((gl, i) => drawGlass(ctx, gl.drink, traySlotX(pos.x, i, max), ty - 2, 1.1, 1));
    ctx.restore();
  }
  drawHand(ctx, pos.x, pos.y, s, a);
}
