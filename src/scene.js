// ─────────────────────────────────────────────────────────────
// SCENE — composition de l'écran, présence de Max, effets visuels (cosmétiques uniquement).
// ─────────────────────────────────────────────────────────────
const V = {
  now: 0,
  max: { mood: 'idle', moodUntil: 0, say: '', sayUntil: 0, sayStart: 0, bounce: 0, shake: 0, lastSay: -9, idleSince: 0 },
  floats: [], flys: [], served: [],
  banner: null, shake: 0,
  press: { pos: -1, t: -9, bad: -9 },
  drag: null, hoverSeat: -1,
  pullAt: null, pullIn: false, gaugeAt: null,
  serveFrom: null, directServe: false, trayFlash: -9,
  countdown: 0, overT: -1, zones: false,
  coach: null, coachText: null, gaugeBox: null,
  talk: [], met: {}, pendingSay: null,
  spot: 0, spotNow: 0, spotHoles: [],
  lastCombo: 0, comboBreak: -9, comboPop: -9,
  openT: 9,
};
const HOLD_MIN = { alex: 1.5, hugo: 0.9, jeremie: 1.2 };   // s avant d'autoriser « touche pour continuer »
const TRAY = { cx: 283, sp: 34, base: 110 };   // centré dans l'ardoise PLATEAU (v1.7) ;   // position absolue conservée après récupération des 38 px du comptoir

function say(text, dur = 1.3, force = false) {
  const m = V.max;
  if (!force && V.now - m.lastSay < 0.9 && V.now < m.sayUntil) return;
  m.say = text; m.sayStart = V.now; m.sayUntil = V.now + dur; m.lastSay = V.now;
}
function setMood(mood, dur = 0.8) { V.max.mood = mood; V.max.moodUntil = V.now + dur; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function floatText(x, y, s, color, size = 16, dur = 0.9) { V.floats.push({ x: Math.max(size * 3, Math.min(360 - size * 3, x)), y, s, color, size, t: 0, dur }); }
// Annonce en enseigne néon. tone : 'rose' | 'orange' | 'blanc' | 'faible' (néon fatigué qui décroche).
// opt.delay : attendre avant de descendre l'enseigne ; opt.bell : la cloche de dernière commande au-dessus.
function banner(title, sub, tone = 'blanc', dur = 1.6, opt = {}) {
  V.banner = { title, sub, tone, t: 0, dur, delay: opt.delay || 0, bell: !!opt.bell, face: opt.face || null, medal: opt.medal || 0 };
  Sfx.neon((opt.delay || 0) + 0.15, tone === 'faible');
}

function stationX(g, d) {
  const p = g.layout.indexOf(d), q = g.prevLayout.indexOf(d);
  const k = Math.min(1, g.swapT / 0.45);
  if (k >= 1 || p === q) return { x: L.seatX[p], y: 0 };
  const e = ease.back(k);
  return { x: lerp(L.seatX[q], L.seatX[p], e), y: -Math.sin(Math.PI * Math.min(1, k)) * 26 };
}
function traySlotX(cx, i, max) { return cx + (i - (max - 1) / 2) * TRAY.sp; }
// Remplissage réel d'un verre : une IPA garde le niveau auquel elle a été tirée (un peu de mousse au-dessus de 1).
function glassLevel(g, gl) {
  const f = gl.fill === undefined ? 1 : gl.fill;
  const over = g && f > 1 ? (f - 1) / Math.max(0.05, g.cfg.overflowAt - 1) : 0;
  return { fill: Math.min(1, f), foamOver: over * 0.6 };
}
function trayHomeY() { return L.maxTop + TRAY.base; }

function updateView(dt, g) {
  V.now += dt;
  if (V.pendingSay && V.now >= V.pendingSay.at) { say(V.pendingSay.text, 1.8, true); V.pendingSay = null; }
  V.talk = V.talk.filter((b) => V.now - b.t0 < b.dur);
  const m = V.max;
  m.bounce = Math.max(0, m.bounce - dt * 4);
  m.shake = Math.max(0, m.shake - dt * 3);
  V.shake = Math.max(0, V.shake - dt * 5);
  for (const f of V.floats) f.t += dt;
  V.floats = V.floats.filter((f) => f.t < f.dur);
  for (const f of V.flys) f.t += dt;
  for (const f of V.flys) if (f.t >= f.dur && f.kind === 'serve') V.served.push({ seat: f.seat, drink: f.drink, t: 0, dx: f.dx || 0, fill: f.fill });
  V.flys = V.flys.filter((f) => f.t < f.dur);
  for (const s of V.served) s.t += dt;
  V.served = V.served.filter((s) => s.t < 0.75);
  if (V.banner) { V.banner.t += dt; if (V.banner.t >= V.banner.dur + V.banner.delay) V.banner = null; }
  V.openT += dt;
  if (V.countdown > 0) V.countdown = Math.max(0, V.countdown - dt);
  if (g && g.over && V.overT >= 0) { // le rideau touche le sol : ça secoue
    const p = V.overT; V.overT += dt;
    if (p < SHUTTER_T * 0.8 && V.overT >= SHUTTER_T * 0.8) V.shake = 0.8;
  }
}

// Humeur de fond de Max, quand aucune réaction ponctuelle n'est en cours
function maxBaseMood(g) {
  if (!g) return 'idle';
  if (g.over) return 'tired';
  if (g.alexActive()) return 'tipsy';
  if (g.rush()) return 'focus';
  if (g.st.ipa.pulling) return 'focus';
  const angry = g.seats.filter((s) => s && !s.isAlex && s.phase === 'wait' && s.patience / s.pmax < 0.3).length;
  if (angry >= 2) return 'sweat';
  if (g.combo >= 10) return 'hot';
  return 'idle';
}

// ─────────────────────────────────────────────────────────────
function renderGame(ctx, g, cfg) {
  const now = V.now;
  const coach = g ? coachStep(g, cfg) : null;
  V.coach = coach;
  if (!coach) V.coachText = null;
  ctx.save();
  if (V.shake > 0) ctx.translate((Math.random() - 0.5) * 6 * V.shake, (Math.random() - 0.5) * 4 * V.shake);
  // le tangage ne touche que la salle : stations et zones tactiles ne bougent jamais
  const sway = g && g.alexActive() && cfg.sway;
  ctx.save();
  if (sway) {
    ctx.translate(180, L.counterTop);
    ctx.rotate(Math.sin(now * 1.6) * 0.02);
    ctx.translate(-180 + Math.sin(now * 1.1) * 2.5, -L.counterTop);
  }
  drawRoom(ctx, now, 0, !!g);   // v1.49 : en partie aussi, la salle monte jusqu'en haut (plus de bande sombre)
  if (g) {
    for (const s of g.seats) if (s) { if (s.isAlex) drawAlexSeat(ctx, g, s, now); else if (s.isJer) drawJeremieSeat(ctx, g, s, now); else drawCustomer(ctx, g, s, now); }
    drawAlexPeek(ctx, g, now);
  }
  ctx.restore();
  if (g) drawCounter(ctx);
  for (const s of V.served) { const lv = glassLevel(g, s); drawGlass(ctx, s.drink, L.seatX[s.seat] + s.dx, L.counterTop + 9, 1, lv.fill, { foamOver: lv.foamOver, alpha: 1 - Math.max(0, s.t - 0.45) / 0.3 }); }
  if (g && V.hoverSeat >= 0 && (V.drag || V.pullAt)) {
    ctx.fillStyle = 'rgba(247,235,213,0.12)';
    ctx.fillRect(V.hoverSeat * 90 + 2, L.hudH, 86, L.counterBot - L.hudH);
    ctx.strokeStyle = 'rgba(247,235,213,0.7)'; ctx.lineWidth = 2.5;
    rr(ctx, V.hoverSeat * 90 + 3, L.hudH + 2, 84, L.counterBot - L.hudH - 4, 10); ctx.stroke();
  }
  if (g) {
    drawServiceSurface(ctx); drawMaxBand(ctx, g, cfg, now); drawStations(ctx, g, cfg, now); drawJeremieStamps(ctx, g); }
  if (g && !coach) drawHints(ctx, g, cfg, now);
  if (g) drawSpotlight(ctx, g, cfg, coach, now);
  for (const f of V.flys) {
    const k = ease.out(Math.min(1, f.t / f.dur));
    const x = lerp(f.x0, f.x1, k), y = lerp(f.y0, f.y1, k) - Math.sin(Math.PI * k) * (f.kind === 'tray' ? 18 : 26);
    const lv = glassLevel(g, f);
    drawGlass(ctx, f.drink, x, y, lerp(f.s0 || 1.1, f.s1 || 1, k), lv.fill, { foamOver: lv.foamOver });
  }
  if (V.drag && g && g.tray.length) drawTray(ctx, g, V.drag.x, V.drag.y - 50, true, now);
  if (g) drawPullGauge(ctx, g, cfg, now);
  // le refus d'un client reste lisible même sous le voile d'apprentissage
  if (g) for (const s of g.seats) if (s && !s.isAlex && s.complainT > 0 && s.phase !== 'leave') drawComplaint(ctx, s, L.seatX[s.seat], now);
  if (g && V.talk.length) drawTalks(ctx, g, now);
  if (coach) drawCoach(ctx, g, cfg, coach, now);
  ctx.globalAlpha = 1;
  for (const f of V.floats) {
    const k = f.t / f.dur;
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    text(ctx, f.s, f.x, f.y - ease.out(k) * 34, f.size, f.color, { display: true, stroke: C.ink, strokeW: 4 });
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (g) drawEventStrip(ctx, g, cfg, now);
  drawHUD(ctx, g, cfg, now);
  if (g) drawLearnClock(ctx, g, now);
  if (g && V.openT < SHUTTER_T + 0.05) drawShutter(ctx, 1 - ease.inOut(Math.min(1, V.openT / SHUTTER_T)));
  if (V.banner) drawBanner(ctx, V.banner);
  if (g && g.cut) drawCut(ctx, g, cfg, g.cut, now);
  if (V.countdown > 0) {
    ctx.fillStyle = 'rgba(32,25,21,0.55)'; ctx.fillRect(-40, 0, 440, L.H);
    text(ctx, String(Math.ceil(V.countdown / 0.5)), 180, L.H * 0.45, 72, C.creme, { display: true, stroke: C.ink, strokeW: 8 });
  }
  if (g && g.over) drawClosing(ctx, g);
  if (V.zones) drawZones(ctx);
}

// Comptoir continu : Max reste sous les clients, sans traverser leur zone.
function drawServiceSurface(ctx) {
  const top = L.maxTop;
  const px = L.padX, pw = 360 + 2 * L.padX;
  ctx.fillStyle = '#704023'; ctx.fillRect(-px, top, pw, L.H - top);
  if (SERVICE_PANEL.complete && SERVICE_PANEL.naturalWidth) {
    ctx.drawImage(SERVICE_PANEL, -px, top, pw, L.H - top);
  }
  const shade = ctx.createLinearGradient(0, top, 0, L.H);
  shade.addColorStop(0, 'rgba(35,22,15,0.40)');
  shade.addColorStop(0.36, 'rgba(35,22,15,0.22)');
  shade.addColorStop(1, 'rgba(35,22,15,0.08)');
  ctx.fillStyle = shade; ctx.fillRect(-px, top, pw, L.H - top);
  ctx.fillStyle = '#C18B51'; ctx.fillRect(-px, top, pw, 1);
  ctx.fillStyle = 'rgba(30,18,12,0.65)'; ctx.fillRect(-px, L.stTop - 4, pw, 3);
}

// Cartes d'événement : leurs illustrations restent indépendantes du comptoir.
function barPanel(ctx, x, y, w, h) {
  if (drawMaterialPanel(ctx, EVENT_PANEL, x, y, w, h)) return;
  ctx.fillStyle = '#292724'; rr(ctx, x, y, w, h, 5); ctx.fill();
}

// ── Bandeau de Max (v1.7) ──
// Trois zones fixes : Max à gauche ; une ardoise COMBO et une ardoise PLATEAU, de la même matière que les stations ;
// au-dessus des ardoises, une ligne réservée à la bulle de Max (elle ne chevauche plus rien).
const BAND = { modY: 36, modH: 88, comboX: 114, comboW: 92, trayX: 212, trayW: 142 };
const COMBO_COL = { 1: '#7D6A55', 1.5: C.gold, 2: C.orange, 3: C.rose };
const multLabel = (m) => '×' + String(m).replace('.', ',');

function drawMaxBand(ctx, g, cfg, now) {
  const top = L.maxTop;
  const m = V.max;
  const mood = now < m.moodUntil ? m.mood : maxBaseMood(g);
  const fx = 56, fy = top - 3, fw = 104, fh = 130;
  ctx.save();
  // Même avec le rebond, Max reste dans sa colonne.
  ctx.beginPath(); ctx.rect(0, top + 1, 112, L.maxBot - top - 1); ctx.clip();
  const bb = m.bounce, sh = m.shake;
  ctx.translate(fx + Math.sin(now * 60) * 4 * sh, fy + fh / 2 - bb * 6);
  ctx.scale(1 + bb * 0.07, 1 + bb * 0.07);
  ctx.translate(-fx, -(fy + fh / 2));
  drawCharacterBust(ctx, fx - fw / 2, fy, fw, fh, MAX_SPEC, { mood, tipsy: g && g.alexActive() ? 1 : 0 });
  ctx.restore();

  const y = top + BAND.modY;
  drawComboSlate(ctx, g, now, BAND.comboX, y, BAND.comboW, BAND.modH);
  drawTraySlate(ctx, g, cfg, now, BAND.trayX, y, BAND.trayW, BAND.modH);
  if (!(g && g.st.ipa.pulling)) drawMaxSay(ctx, top, now);
}

// Ardoise COMBO : le multiplicateur en pastille, le compteur en grand, les crans jusqu'au palier suivant.
function drawComboSlate(ctx, g, now, x, y, w, h) {
  const combo = g ? g.combo : 0, cm = comboMult(combo);
  if (g) { // transitions : combo cassé, palier franchi
    const prev = V.lastCombo;
    if (combo < prev && prev >= 3) V.comboBreak = now;
    if (combo > prev && cm > comboMult(prev)) V.comboPop = now;
    V.lastCombo = combo;
  }
  const brk = now - V.comboBreak < 0.9, pop = now - V.comboPop;
  barPanel(ctx, x, y, w, h);
  if (brk || pop < 0.6) {
    ctx.save();
    ctx.globalAlpha = brk ? 0.55 + 0.45 * Math.sin(now * 30) : 1 - pop / 0.6;
    ctx.strokeStyle = brk ? C.bad : COMBO_COL[cm]; ctx.lineWidth = 2.5;
    rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 6); ctx.stroke();
    ctx.restore();
  }
  text(ctx, 'COMBO', x + 10, y + 18, 10, C.cremeD, { weight: 800, align: 'left' });
  // pastille du multiplicateur
  const pk = pop < 0.35 ? 1 + 0.45 * (1 - pop / 0.35) : 1;
  const pw = 30, ph = 18, pcx = x + w - 8 - pw / 2, pcy = y + 14;
  ctx.save(); ctx.translate(pcx, pcy); ctx.scale(pk, pk);
  ctx.fillStyle = COMBO_COL[cm]; rr(ctx, -pw / 2, -ph / 2, pw, ph, 5); ctx.fill();
  text(ctx, multLabel(cm), 0, 6, 19, cm > 1 ? C.ink : C.creme, { pixel: true });
  ctx.restore();
  // compteur
  const shake = brk ? Math.sin(now * 55) * 3 * (1 - (now - V.comboBreak) / 0.9) : 0;
  text(ctx, String(combo), x + w / 2 + shake, y + 59, 42, brk ? C.bad : combo ? C.creme : '#8F7E68', { pixel: true });
  // crans jusqu'au palier suivant
  const nx = nextComboStep(combo), from = combo >= 10 ? 10 : combo >= 5 ? 5 : 0;
  const bx = x + 10, bw = w - 20, by = y + 66;
  if (nx) {
    const n = nx - from, gap = n > 6 ? 1.5 : 2, sw = (bw - gap * (n - 1)) / n, col = COMBO_COL[comboMult(nx)];
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < combo - from ? col : 'rgba(247,235,213,0.14)';
      ctx.fillRect(bx + i * (sw + gap), by, sw, 5);
    }
    // v1.31 : une erreur fait perdre un palier ; « COMBO PERDU » seulement quand il retombe à zéro
    text(ctx, brk ? (combo > 0 ? 'PALIER PERDU' : 'COMBO PERDU') : `${multLabel(comboMult(nx))} à ${nx}`, x + w / 2, y + 81, 9, brk ? C.bad : C.cremeD, { weight: 800 });
  } else {
    ctx.save(); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now * 6);
    ctx.fillStyle = C.rose; ctx.fillRect(bx, by, bw, 5);
    ctx.restore();
    text(ctx, 'AU MAXIMUM', x + w / 2, y + 81, 9, C.rose, { weight: 800 });
  }
}

// Ardoise PLATEAU : ce qu'il y a dessus, combien de place il reste.
function drawTraySlate(ctx, g, cfg, now, x, y, w, h) {
  const max = g ? g.trayMax() : (cfg.trayMax || 1);
  const n = g ? g.tray.length : 0, full = max > 1 && n >= max;
  barPanel(ctx, x, y, w, h);
  if (now - V.trayFlash < 0.45) {
    ctx.save(); ctx.globalAlpha = Math.floor(now * 14) % 2 ? 1 : 0.35;
    ctx.strokeStyle = C.warn; ctx.lineWidth = 2.5; rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 6); ctx.stroke();
    ctx.restore();
  }
  const lab = max > 1 ? (full ? 'PLATEAU PLEIN' : 'PLATEAU') : 'EN MAIN';
  text(ctx, lab, x + 10, y + 18, 10, full ? C.warn : C.cremeD, { weight: 800, align: 'left' });
  if (max > 1) text(ctx, `${n}/${max}`, x + w - 10, y + 20, 21, full ? C.warn : n ? C.creme : '#8F7E68', { pixel: true, align: 'right' });
  if (V.drag && g && g.tray.length) { // le plateau est au bout du doigt : sa place reste marquée
    const tw = max * TRAY.sp + 16;
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(247,235,213,0.3)'; ctx.lineWidth = 1.5;
    rr(ctx, TRAY.cx - tw / 2, trayHomeY() - 3, tw, 9, 4.5); ctx.stroke(); ctx.setLineDash([]);
  } else {
    drawTray(ctx, g, TRAY.cx, trayHomeY(), false, now, max);
  }
}

// Bulle de Max : sur sa ligne, au-dessus des ardoises. Une ligne, deux si la phrase est longue.
// Cachée quand la consigne du coach occupe le comptoir (glisser le plateau).
function drawMaxSay(ctx, top, now) {
  const m = V.max;
  const coachOnCounter = V.coach && (V.coach.kind === 'serve' || V.coach.kind === 'drop');
  if (!(now < m.sayUntil && m.say) || coachOnCounter) return;
  const k = Math.min(1, (now - m.sayStart) / 0.12);
  const bx = 116, room = 354 - bx, pad = 10;
  let size = 12, lines = [m.say];
  ctx.font = `800 ${size}px ${FONT_T}`;
  if (ctx.measureText(m.say).width + pad * 2 > room) { size = 11; ctx.font = `800 ${size}px ${FONT_T}`; }
  if (ctx.measureText(m.say).width + pad * 2 > room) lines = splitLine(ctx, m.say, room - pad * 2);
  const w = Math.min(room, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
  const h = lines.length > 1 ? 38 : 25, by = top + 5;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(20,15,12,0.4)'; rr(ctx, bx + 1, by + 3, w, h, 10); ctx.fill();
  ctx.fillStyle = C.creme; rr(ctx, bx, by, w, h, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + 1, by + 8); ctx.lineTo(bx - 9, by + 21); ctx.lineTo(bx + 1, by + 17); ctx.fill();
  lines.forEach((l, i) => text(ctx, l, bx + w / 2, by + (lines.length > 1 ? 15.5 + i * 14 : 17), size, C.ink, { weight: 800 }));
  ctx.restore();
}
function clampN(x) { return Math.max(-1, Math.min(1, x)); }

// Plateau de Max : posé sur l’ardoise ou déplacé vers le client pendant un glisser
function drawTray(ctx, g, cx, by, floating, now, maxOpt) {
  const max = maxOpt || (g ? g.trayMax() : 3);
  const w = max * TRAY.sp + 16;
  const flash = now - V.trayFlash < 0.45 && Math.floor(now * 14) % 2 === 0;
  // Plateau métallique de bistrot ; les verres gardent leurs positions tactiles.
  if (floating) { ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.beginPath(); ctx.ellipse(cx, by + 12, w / 2, 7, 0, 0, 7); ctx.fill(); }
  if (SERVING_TRAY.complete && SERVING_TRAY.naturalWidth) {
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(SERVING_TRAY, cx - w / 2 - 3, by - 22, w + 6, 30); ctx.restore();
  }
  if (flash && floating) { ctx.strokeStyle = C.warn; ctx.lineWidth = 1.5; rr(ctx, cx - w / 2, by - 12, w, 21, 6); ctx.stroke(); }
  for (let i = 0; i < max; i++) {
    const x = traySlotX(cx, i, max);
    const gl = g && g.tray[i];
    const incoming = !floating && V.flys.some((f) => f.kind === 'tray' && f.slot === i && f.t < f.dur);
    const underTap = gl && g.st.ipa.topUp === gl;
    if (gl && !incoming && !underTap) {
      const lv = glassLevel(g, gl);
      drawGlass(ctx, gl.drink, x, by - 2, 1.1, lv.fill, { foamOver: lv.foamOver });
      if (gl.q === 'perfect') star(ctx, x + 12, by - 34, 6, C.rose);
      else if (gl.q === 'low') lowBadge(ctx, x + 12, by - 36, now);
    } else if (underTap) { // le verre est reparti sous la tireuse : place réservée
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(242,179,64,0.8)'; ctx.lineWidth = 1.5;
      rr(ctx, x - 12, by - 36, 24, 34, 4); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = '#605951'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.ellipse(x, by - 4, 10, 3, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}
// Pastille « ! » : IPA trop vide, le client la refusera
function lowBadge(ctx, x, y, now) {
  const k = 1 + 0.12 * Math.max(0, Math.sin(now * 8));
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  drawUIIcon(ctx, 'warn', -10, -10, 20);
  ctx.restore();
}
function star(ctx, x, y, r) {
  drawUIIcon(ctx, 'star', x - r * 1.3, y - r * 1.3, r * 2.6);
}

// ── Stations ──
function stationCaption(g, d) {
  const gs = g ? g.gesture(d) : 'tap';
  if (gs === 'hold') return g && !g.st.ipa.pulling && g.tray.some((x) => x.q === 'low') ? 'compléter' : 'maintenir';
  if (gs === 'rest') {
    const p = g.st.stout.phase;
    return p === 'idle' ? 'lancer' : p === 'ready' ? 'prête !' : 'repose…';
  }
  return 'toucher';
}
function drawStations(ctx, g, cfg, now) {
  const mirror = g && g.alexActive() && cfg.alexMode === 'miroir';
  const full = g && g.trayFull();
  for (const d of DRINKS) {
    const pos = g ? stationX(g, d) : { x: L.seatX[DRINKS.indexOf(d)], y: 0 };
    const x = pos.x, top = L.stTop + pos.y;
    const p = g ? g.layout.indexOf(d) : DRINKS.indexOf(d);
    const pressed = V.press.pos === p && now - V.press.t < 0.14;
    const busyShake = V.press.pos === p && now - V.press.bad < 0.25 ? Math.sin(now * 70) * 3 : 0;
    const gs = g ? g.gesture(d) : 'tap';
    const blocked = full && !(gs === 'rest' && g.st.stout.phase !== 'ready') && !(gs === 'hold' && g.tray.some((x) => x.q === 'low'));
    ctx.save();
    ctx.translate(busyShake, 0);
    if (pressed) { ctx.translate(x, top + 75); ctx.scale(0.96, 0.96); ctx.translate(-x, -(top + 75)); }
    if (blocked) ctx.globalAlpha = 0.45;
    if (STATION_PANEL.complete && STATION_PANEL.naturalWidth) {
      ctx.drawImage(STATION_PANEL, x - 41, top, 82, 150);
    } else {
      ctx.fillStyle = '#292724'; rr(ctx, x - 41, top, 82, 150, 4); ctx.fill();
    }
    ctx.fillStyle = ({ipa: C.gold, stout: C.head, spritz: C.spritz, shot: C.shot})[d]; ctx.fillRect(x - 30, top + 9, 60, 2);
    if (mirror || pressed) { ctx.strokeStyle = mirror ? C.rose : C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 39, top + 2, 78, 146, 6); ctx.stroke(); }
    // verre
    let fill = 1;
    if (gs === 'hold') fill = g && g.st.ipa.pulling ? Math.min(1, g.st.ipa.fill) : 0;
    if (gs === 'rest') {
      const so = g.st.stout;
      fill = so.phase === 'idle' ? 0 : so.phase === 'pour' ? 0.65 * (so.t / cfg.stoutPour) : so.phase === 'rest' ? 0.65 + 0.35 * (so.t / cfg.stoutRest) : 1;
    }
    const gx = x;
    if (fill === 0) drawGlass(ctx, d, gx, top + 98, 1.65, 1, { alpha: 0.28 });
    drawGlass(ctx, d, gx, top + 98, d === 'shot' ? 2.5 : 1.65, fill, { line: gs === 'hold' && !fill ? 'rgba(247,235,213,0.6)' : undefined });
    if (gs === 'rest') {
      const so = g.st.stout;
      if (so.phase === 'pour' || so.phase === 'rest') {
        const k = so.phase === 'pour' ? 0.25 * so.t / cfg.stoutPour : 0.25 + 0.75 * so.t / cfg.stoutRest;
        ctx.strokeStyle = 'rgba(247,235,213,0.2)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, top + 76, 31, 0, 7); ctx.stroke();
        ctx.strokeStyle = C.creme; ctx.beginPath(); ctx.arc(x, top + 76, 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      } else if (so.phase === 'ready') {
        const a = 0.55 + 0.45 * Math.sin(now * 10);
        ctx.strokeStyle = `rgba(243,155,177,${a})`; ctx.lineWidth = 4; rr(ctx, x - 39, top + 2, 78, 146, 13); ctx.stroke();
      }
    }
    text(ctx, DRINK_NAMES[d].toUpperCase(), x, top + 125, 21, C.creme, { pixel: true });
    const cap = blocked ? 'plateau plein' : stationCaption(g, d);
    if (cap) text(ctx, cap, x, top + 140, 10.5, cap === 'prête !' ? C.rose : (blocked || cap === 'compléter') ? C.warn : C.cremeD, { weight: 700 });
    ctx.restore();
  }
}

// Aides du premier passage : la station puis le client clignotent, une main fantôme montre le glisser.
function drawHints(ctx, g, cfg, now) {
  if (!cfg.hints) return;
  const tut = g.seats.find((s) => s && s.tuto && (s.phase === 'wait' || s.phase === 'arrive'));
  if (!tut || V.drag || g.st.ipa.pulling) return;
  const d = g.need(tut.orders[0].drink);
  const a = 0.4 + 0.4 * Math.sin(now * 7);
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(247,235,213,${a})`;
  if (g.tray.some((x) => x.drink === d && x.q !== 'low')) {
    rr(ctx, tut.seat * 90 + 3, L.hudH + 2, 84, L.counterBot - L.hudH - 4, 10); ctx.stroke();
    // main fantôme : du plateau vers le client
    const k = (now % 1.5) / 1.2;
    if (k <= 1) {
      const e = ease.inOut(k);
      const x = lerp(TRAY.cx, L.seatX[tut.seat], e), y = lerp(trayHomeY() + 10, L.counterTop - 60, e);
      ctx.globalAlpha = k < 0.8 ? 0.9 : 0.9 * (1 - k) / 0.2;
      drawUIIcon(ctx, 'target', x - 15, y - 15, 30);
      ctx.globalAlpha = 1;
    }
  } else {
    const p = stationX(g, d);
    rr(ctx, p.x - 44, L.stTop - 3 + p.y, 88, 156, 16); ctx.stroke();
  }
}

// Jauge du tirage (v1.8) : elle remplace l'ardoise COMBO le temps du maintien.
// Toujours au même endroit, hors du pouce, et Max reste visible à côté pour réagir.
// « MAINTIENS » tant que la pinte n'est pas au bon niveau, « LÂCHE ! » dans la zone rose, « TROP ! » au-delà.
// Le trait en travers du verre marque le niveau en dessous duquel le client refusera la pinte.
function pullMessage(cfg, fill) {
  if (fill > cfg.perfectHi) return { text: 'TROP !', color: C.warn };
  if (fill >= cfg.perfectLo) return { text: 'LÂCHE !', color: C.rose };
  return { text: 'MAINTIENS', color: C.creme };
}
function drawPullGauge(ctx, g, cfg, now) {
  const s = g.st.ipa;
  if (!s.pulling) return;
  const fill = s.fill;
  const inZ = fill >= cfg.perfectLo && fill <= cfg.perfectHi, over = fill > cfg.perfectHi;
  const x = BAND.comboX - 2, w = BAND.comboW + 4, y = L.maxTop + 6, h = L.maxBot - L.maxTop - 8;
  barPanel(ctx, x, y, w, h);
  // v1.48 : plus de contour clair au repos (il faisait un liseré comme l'ancienne ardoise) ; contour seulement rose (lâche) ou orange (trop)
  if (inZ || over) { ctx.strokeStyle = inZ ? C.rose : C.warn; ctx.lineWidth = inZ ? 3 : 2; rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 5); ctx.stroke(); }
  // v1.29 : Jérémie attend → « TIENS… » jusqu'à sa zone dorée, « DORÉE ! » dedans (au-dessus, la pinte reste parfaite pour les clients)
  const brewMsg = !g.jerWants() ? null : g.brewOk(fill) ? { text: 'DORÉE !', color: C.gold } : (fill >= cfg.perfectLo && fill < cfg.jeremieLo) ? { text: 'TIENS…', color: C.gold } : null;
  const msg = brewMsg || pullMessage(cfg, fill);
  text(ctx, msg.text, x + w / 2, y + 22, inZ ? 23 + Math.sin(now * 30) : 20, msg.color, { pixel: true });
  // le verre, à gauche ; la réglette, à droite
  const sc = 2, gx = x + 38, gy = y + h - 8;
  const lvY = (f) => gy - 30 * sc * f;
  drawGlass(ctx, 'ipa', gx, gy, sc, Math.min(1, fill), { foamOver: Math.max(0, fill - 1) / (cfg.overflowAt - 1) });
  const yLo = lvY(cfg.perfectLo), yHi = lvY(Math.min(1.06, cfg.perfectHi));
  ctx.fillStyle = 'rgba(243,155,177,0.3)'; ctx.fillRect(gx - 26, yHi, 52, yLo - yHi);
  ctx.strokeStyle = C.rose; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(gx - 26, yHi); ctx.lineTo(gx + 26, yHi); ctx.moveTo(gx - 26, yLo); ctx.lineTo(gx + 26, yLo); ctx.stroke();
  // v1.29 : Jérémie attend → sa zone dorée, plus étroite, dans la zone rose
  const brew = g.jerWants(), jLo = lvY(cfg.jeremieLo), jHi = lvY(cfg.jeremieHi);
  if (brew) {
    ctx.fillStyle = 'rgba(243,182,64,0.45)'; ctx.fillRect(gx - 26, jHi, 52, jLo - jHi);
    ctx.strokeStyle = C.gold; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(gx - 26, jHi); ctx.lineTo(gx + 26, jHi); ctx.moveTo(gx - 26, jLo); ctx.lineTo(gx + 26, jLo); ctx.stroke();
    ctx.setLineDash([4, 3]);
  }
  const yMin = lvY(cfg.goodLo), okMin = fill >= cfg.goodLo;
  ctx.strokeStyle = okMin ? 'rgba(247,235,213,0.5)' : C.bad;
  ctx.beginPath(); ctx.moveTo(gx - 26, yMin); ctx.lineTo(gx + 26, yMin); ctx.stroke();
  ctx.setLineDash([]);
  // réglette : rouge = trop vide, crème = acceptée, rose = parfaite, jaune = trop
  const bx = x + w - 20, bTop = lvY(1.15);
  const seg = (f0, f1, col) => { ctx.fillStyle = col; ctx.fillRect(bx, lvY(f1), 8, lvY(f0) - lvY(f1)); };
  seg(0, cfg.goodLo, 'rgba(238,79,94,0.6)');
  seg(cfg.goodLo, cfg.perfectLo, 'rgba(247,235,213,0.35)');
  seg(cfg.perfectLo, Math.min(1.06, cfg.perfectHi), C.rose);
  seg(Math.min(1.06, cfg.perfectHi), 1.15, 'rgba(242,179,64,0.5)');
  if (brew) { seg(cfg.jeremieLo, cfg.jeremieHi, C.gold); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(bx, jHi, 8, jLo - jHi); }
  ctx.strokeStyle = 'rgba(247,235,213,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(bx, bTop, 8, gy - bTop);
  const yf = lvY(Math.min(1.15, fill));
  ctx.fillStyle = C.creme; ctx.beginPath(); ctx.moveTo(bx - 1, yf); ctx.lineTo(bx - 8, yf - 5); ctx.lineTo(bx - 8, yf + 5); ctx.fill();
  V.gaugeBox = { x: x + w / 2, top: y, w, h, zoneY: (yLo + yHi) / 2 };
  V.gaugeAt = { x: x + w / 2, y: y + 22 };
}

// Alex passe la tête avant de faire boire Max (mode imposé)
function drawAlexPeek(ctx, g, now) {
  if (g.alex.state !== 'telegraph') return;
  const k = Math.min(1, (g.alex.cutAt - g.t) > 0 ? 1 - (g.alex.cutAt - g.t) / ALEX_TELEGRAPH : 1);
  const x = 380 - ease.back(Math.min(1, k * 3)) * 74;
  const y = L.counterTop - 54;
  drawCharacterBust(ctx, x - 39, L.counterTop - 113, 78, 119, ALEX_SPEC, {mood:'proud'});
  drawGlass(ctx, 'shot', x - 40, y + 10, 1.3, 1);
  ctx.fillStyle = C.rose; rr(ctx, 150, y - 84, 156, 30, 15); ctx.fill();
  text(ctx, 'Etienne ! J’en ai une bonne…', 228, y - 64, 12.5, C.ink, { weight: 800 });
}

// ── Bandeaux d'événements ──
function drawEventTimer(ctx, left, duration, x, y, h = 32) {
  const seconds = Math.max(0, Math.ceil(left));
  const urgent = seconds <= Math.min(3, duration * 0.2);
  ctx.fillStyle = '#1C1B19'; rr(ctx, x, y, 66, h, 6); ctx.fill();
  ctx.strokeStyle = urgent ? C.roseD : '#6B6050'; ctx.lineWidth = 1;
  rr(ctx, x, y, 66, h, 6); ctx.stroke();
  drawUIIcon(ctx, 'clock', x + 3, y + 4, h - 8);
  text(ctx, `${seconds} s`, x + 46, y + h / 2 + 5, 13, urgent ? C.rose : C.creme, {weight:800});
}
// Humeur d'Hugo pendant le rush (v1.20) : il presse, il est fier dès l'objectif atteint, il déchante quand c'est perdu d'avance.
// v1.25 : fier dès l'or ; déçu quand même le bronze n'est plus atteignable dans les dernières secondes.
function hugoMood(g) {
  const h = g.hugo, left = h.end - g.t, tier = g.hugoTier(), need = h.tiers[0] - h.served;
  if (tier === 3) return 'proud';
  if (left < 6 && need > 0 && need > left * 0.8) return 'sad';
  return 'focus';
}
// Médailles du rush d'Hugo (v1.25) : celles du classement (rank-icons.webp de ChatGPT, cases 0 or, 1 argent, 2 bronze).
// tier : 1 bronze · 2 argent · 3 or.
const TIER_NAME = ['', 'bronze', 'argent', 'or'];
function drawMedal(ctx, tier, x, y, size) {
  if (!tier || !artReady(RANK_ART)) return;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(RANK_ART, (3 - tier) * 128, 0, 128, 128, x, y, size, size);
  ctx.restore();
}
function drawEventStrip(ctx, g, cfg, now) {
  // Sur écran court, ne pas empiéter sur les commandes et leurs badges.
  const compact = L.counterTop - L.hudH < 250;
  const y = L.hudH + 4, h = compact ? 34 : 50;
  const titleY = y + (compact ? 13 : 18), detailY = y + (compact ? 28 : 37);
  const timerY = y + (compact ? 3 : 9), timerH = compact ? 28 : 32;
  if (g.rush()) {
    const hugo = g.hugo, tier = g.hugoTier(), done = tier === 3;
    barPanel(ctx, 8, y, 344, h);
    drawCharacterFace(ctx, 12, y + 2, 38, h - 4, HUGO_SPEC, {mood: hugoMood(g)});
    text(ctx, 'VISITE CLIENT', 54, titleY, 11, C.creme, {weight:800,align:'left'});
    // v1.25 : la médaille déjà gagnée, et le palier suivant tant qu'on n'est pas à l'argent
    const detail = tier < 2 ? `${hugo.served} / ${hugo.target} · ${TIER_NAME[tier + 1]} à ${hugo.tiers[tier]}` : `${hugo.served} / ${hugo.target} boissons`;
    text(ctx, detail, 54, detailY, 12, done ? C.good : C.cremeD, {weight:800,align:'left'});
    drawMedal(ctx, tier, 236, y + (compact ? 3 : 9), compact ? 28 : 32);
    drawEventTimer(ctx, hugo.end - g.t, cfg.hugoDuration, 278, timerY, timerH);
  } else if (g.alexActive()) {
    barPanel(ctx, 8, y, 344, h);
    drawCharacterFace(ctx, 12, y + 2, 38, h - 4, ALEX_SPEC, {mood:'proud'});
    text(ctx, `MICHEL · POINTS ×${String(cfg.alexMult).replace('.', ',')}`, 54, titleY, 11, C.rose, {weight:800,align:'left'});
    if (cfg.alexMode === 'inversion') {
      for (const [a,b,x] of [['ipa','stout',65],['spritz','shot',159]]) {
        drawGlass(ctx,a,x,detailY + (compact ? 3 : 6),compact ? 0.48 : 0.62,1);
        drawUIIcon(ctx,'swap',x + 13,detailY - 12,compact ? 14 : 17);
        drawGlass(ctx,b,x + 43,detailY + (compact ? 3 : 6),compact ? 0.48 : 0.62,1);
      }
    } else text(ctx, 'POSTES À L’ENVERS', 54, detailY, 10.5, C.cremeD, {weight:800,align:'left'});
    drawEventTimer(ctx, g.alex.effectEnd - g.t, cfg.alexDuration, 278, timerY, timerH);
  } else if (g.jer.state === 'seat' && g.seats[g.jer.seat] && g.seats[g.jer.seat].isJer && g.seats[g.jer.seat].phase !== 'leave') {
    // v1.26 : Jérémie au comptoir. Ce qu'il veut, ce qu'on y gagne, et le temps qu'il nous laisse.
    const s = g.seats[g.jer.seat], mult = String(cfg.jeremieMult).replace('.', ',');
    barPanel(ctx, 8, y, 344, h);
    drawJeremieFace(ctx, 12, y + 2, 38, h - 4, jeremieMood(s));
    text(ctx, s.tipsy ? 'MARIE · ELLE REPASSE' : 'MARIE · CONTRÔLE QUALITÉ', 54, titleY, 11, C.gold, {weight:800,align:'left'});
    const detail = s.tipsy ? `Un croissant = points ×${mult} · ${cfg.jeremieBoost} clients` : `Zone dorée = points ×${mult} · ${cfg.jeremieBoost} clients`;
    text(ctx, detail, 54, detailY, compact ? 10.5 : 11.5, C.cremeD, {weight:800,align:'left'});
    if (s.phase === 'wait' || s.phase === 'arrive') drawEventTimer(ctx, s.patience, s.pmax, 278, timerY, timerH);
  } else if (g.jer.boost > 0) {
    // Pinte approuvée : le bonus du brasseur, client par client
    const n = g.jer.boost, mult = String(cfg.jeremieMult).replace('.', ',');
    barPanel(ctx, 8, y, 344, h);
    drawJeremieFace(ctx, 12, y + 2, 38, h - 4, g.jer.visit > 1 ? 'tipsy' : 'approve');
    text(ctx, `APPROUVÉ · POINTS ×${mult}`, 54, titleY, 11, C.rose, {weight:800,align:'left'});
    text(ctx, `encore ${n} client${n > 1 ? 's' : ''}`, 54, detailY, 12, C.cremeD, {weight:800,align:'left'});
    // une étoile par client restant (les étoiles consommées s'éteignent)
    const sz = compact ? 26 : 28, sy0 = y + (compact ? 4 : 11), n0 = Math.min(cfg.jeremieBoost, 4);
    for (let i = 0; i < n0; i++) {
      ctx.save(); ctx.globalAlpha = i < n ? 1 : 0.25;
      drawUIIcon(ctx, 'star', 344 - (n0 - i) * (sz + 4), sy0, sz);
      ctx.restore();
    }
  }
}

// ── Apprentissage : le reste de l'écran est grisé, seule la zone à toucher reste en clair ──
function spotHoles(g, coach) {
  if (!coach) return null;
  const holes = [];
  const station = (d) => { const p = stationX(g, d); holes.push({ x: p.x - 44, y: L.stTop - 3 + p.y, w: 88, h: Math.min(156, L.H - (L.stTop - 3 + p.y)) }); };
  const max = g.trayMax(), tw = max * TRAY.sp + 24;
  switch (coach.kind) {
    case 'hold': case 'tap': case 'stoutLaunch': case 'stoutRest': case 'stoutReady': station(coach.drink); break;
    case 'release': station('ipa'); break;                       // la jauge est dessinée par-dessus le voile
    case 'serve': case 'drop':
      holes.push({ x: coach.seat * 90 + 3, y: L.hudH + 2, w: 84, h: L.counterBot - L.hudH - 4 });
      if (coach.kind === 'serve') holes.push({ x: TRAY.cx - tw / 2, y: L.maxTop + 8, w: tw, h: L.maxBot - L.maxTop - 8 });
      break;
  }
  return holes;
}
function drawSpotlight(ctx, g, cfg, coach, now) {
  const dt = Math.max(0, Math.min(0.1, now - V.spotNow)); V.spotNow = now;
  const holes = spotHoles(g, coach);
  if (holes) V.spotHoles = holes;
  V.spot += ((holes ? 1 : 0) - V.spot) * Math.min(1, dt * 9);
  if (V.spot < 0.01 || !V.spotHoles.length) return;
  ctx.save();
  ctx.fillStyle = `rgba(20,15,12,${0.66 * V.spot})`;
  ctx.beginPath();
  ctx.rect(-40, 0, 440, L.H);
  for (const h of V.spotHoles) { ctx.moveTo(h.x, h.y); ctx.lineTo(h.x, h.y + h.h); ctx.lineTo(h.x + h.w, h.y + h.h); ctx.lineTo(h.x + h.w, h.y); ctx.closePath(); }
  ctx.fill('evenodd');
  ctx.restore();
}
// Pendant une consigne, le chrono est arrêté : on le dit, en haut, là où on le regarde.
function drawLearnClock(ctx, g, now) {
  if (V.spot < 0.01) return;
  ctx.save();
  ctx.globalAlpha = V.spot;
  ctx.fillStyle = 'rgba(20,15,12,0.66)'; ctx.fillRect(-40, 0, 440, L.hudH);
  const w = 176, x = 180 - w / 2, y = 9;
  ctx.fillStyle = C.creme; rr(ctx, x, y, w, 26, 6); ctx.fill();
  drawUIIcon(ctx, 'pause', x + 9, y + 4, 18);
  text(ctx, 'CHRONO EN PAUSE', x + w / 2 + 9, y + 17.5, 10.5, C.ink, { display: true });
  ctx.restore();
}

// v1.49 (choix de Jérémie parmi cinq essais : « juste les chiffres », renforcée en v1.50) : plus de bande sombre en haut. La salle monte jusqu'en
// haut de l'écran sous un voile sombre ; score (étoile) à gauche et chrono au centre en chiffres crème avec une ombre brune,
// comme le titre ARCADE ; les boutons son et pause sont réduits à leur icône (#hud, src/style.css).
function drawHUD(ctx, g, cfg, now) {
  if (!g) return;
  const left = Math.max(0, cfg.duration - g.t);
  const mm = Math.floor(Math.ceil(left) / 60), ss = Math.ceil(left) % 60;
  const urgent = left <= 10 && !g.over;
  const sc = urgent ? 1 + 0.12 * Math.max(0, Math.sin(now * Math.PI * 2)) : 1;
  const score = g.score.toLocaleString('fr-FR'), clock = `${mm}:${String(ss).padStart(2, '0')}`;
  // v1.50 (renforcée, demande de Jérémie) : voile plus dense et plus haut, chiffres un peu plus grands avec un contour brun
  const veil = ctx.createLinearGradient(0, 0, 0, L.hudH + 34);
  veil.addColorStop(0, 'rgba(15,10,8,0.84)'); veil.addColorStop(0.5, 'rgba(15,10,8,0.55)'); veil.addColorStop(1, 'rgba(15,10,8,0)');
  ctx.fillStyle = veil; ctx.fillRect(-40, 0, 440, L.hudH + 34);
  const SZ = 22;                                    // police pixel ×1,3 → 29 px (20 avant)
  ctx.font = `400 ${Math.round(SZ * 1.3)}px ${FONT_P}`;
  const cw = Math.ceil(ctx.measureText(clock).width);
  const lit = (s, x, y, color, align) => {   // ombre brune décalée, contour brun, puis le chiffre avec un halo sombre
    text(ctx, s, x, y + 3, SZ, '#2A1A10', { display: true, align, stroke: '#2A1A10', strokeW: 4 });
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 7;
    text(ctx, s, x, y, SZ, color, { display: true, align, stroke: '#2A1A10', strokeW: 4 }); ctx.restore();
  };
  const cx = 180 - (cw + 28) / 2;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1.5;
  drawUIIcon(ctx, 'star', 9, 9, 21); drawUIIcon(ctx, 'clock', cx, 8, 23); ctx.restore();
  lit(score, 35, 31, C.creme, 'left');
  ctx.save(); ctx.translate(cx + 28 + cw / 2, 22); ctx.scale(sc, sc);
  lit(clock, 0, 9, urgent ? C.orange : C.creme, 'center'); ctx.restore();
}

// ── Annonces (v1.11) : enseignes néon suspendues ──
// L'enseigne descend au bout de ses fils, le néon s'allume en grésillant, reste allumé, s'éteint, puis l'enseigne disparaît.
// Visuels à brancher ici quand ils arrivent (cadre néon allumé et éteint, cloche) ; le texte reste écrit en code.
const NEON = { rose: '#FF4F9A', orange: '#FFA03A', blanc: '#FFE3B8', faible: '#FF7FAE' };
function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
const NEON_IGNITE = [[0, 1], [0.05, 0], [0.12, 1], [0.17, 0], [0.24, 0.6], [0.29, 0], [0.36, 1]];
function neonLevel(b, t) {
  if (t < 0) return 0;
  let v = 0;
  for (const [at, l] of NEON_IGNITE) if (t >= at) v = l;
  if (b.tone === 'faible' && t > 0.4) { // néon fatigué : il décroche par moments
    const a = (t * 2.3) % 1, c = (t * 5.7) % 1;
    if (a < 0.1 || (a > 0.42 && a < 0.47) || c < 0.04) v = 0.15;
  }
  return v;
}
function drawBanner(ctx, b) {
  const u = b.t - b.delay;
  if (u < 0) return;
  const col = NEON[b.tone] || NEON.blanc;
  const out = Math.max(0, (u - (b.dur - 0.3)) / 0.3);          // 0 → 1 pendant la sortie
  const lit = out > 0 ? (out < 0.2 ? 0.4 : 0) : neonLevel(b, u - 0.15);
  // v1.20 : avec un visage (verdict d'Hugo), l'enseigne se décale à droite et le personnage passe la tête à gauche.
  const face = b.face, maxTw = face ? 196 : 270;
  let size = 31;
  ctx.font = `400 ${size}px ${FONT_P}`;
  while (ctx.measureText(b.title).width > maxTw && size > 20) { size -= 1; ctx.font = `400 ${size}px ${FONT_P}`; }
  const tw = ctx.measureText(b.title).width;
  ctx.font = `800 12.5px ${FONT_T}`;
  const sw = b.sub ? ctx.measureText(b.sub).width + 36 : 0;   // v1.25 : le sous-titre tient aussi dans la plaque
  const w = face ? Math.min(256, Math.max(200, tw + 56, sw)) : Math.min(334, Math.max(210, tw + 64, sw)), h = b.sub ? 82 : 62;
  const cx = face ? 352 - w / 2 : 180;
  let cy = L.hudH + (L.counterTop - L.hudH) * 0.36;
  if (b.bell) cy = Math.max(cy, L.hudH + 80 + h / 2);
  const drop = ease.back(Math.min(1, u / 0.24));
  const top = cy - h / 2 - (1 - drop) * 46 - out * 18;
  const swing = Math.sin(u * 9) * Math.exp(-u * 3) * 0.045;
  const glow = view.dpr * view.s;                                 // le flou d'ombre ne suit pas l'échelle du canvas
  if (b.bell) drawBell(ctx, Math.sin(u * 11) * Math.exp(-u * 1.3) * 0.5, 1 - out);
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate(cx, top); ctx.rotate(swing);
  // fils de suspension
  ctx.strokeStyle = 'rgba(16,11,8,0.85)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const sx of [-w / 2 + 24, w / 2 - 24]) { ctx.moveTo(sx, 2); ctx.lineTo(sx * 0.8, L.hudH - top); }
  ctx.stroke();
  // plaque
  ctx.fillStyle = 'rgba(14,10,9,0.92)'; rr(ctx, -w / 2, 0, w, h, 8); ctx.fill();
  ctx.strokeStyle = '#4A382C'; ctx.lineWidth = 2; rr(ctx, -w / 2 + 1, 1, w - 2, h - 2, 7); ctx.stroke();
  ctx.fillStyle = '#8A7A68';
  for (const sx of [-w / 2 + 9, w / 2 - 9]) for (const sy of [9, h - 9]) { ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, 7); ctx.fill(); }
  // cadre néon (image), puis le texte en tubes : verre éteint, puis lumière
  const titleY = b.sub ? 39 : 42;
  const frameArt = artReady(ART.neonOn) && artReady(ART.neonOff);
  if (frameArt) drawNeonFrame(ctx, -w / 2 + 7, 7, w - 14, h - 14, b.tone, lit);
  const tubes = (color, pass) => {
    ctx.fillStyle = color; ctx.font = `400 ${size}px ${FONT_P}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(b.title).normalize('NFC'), 0, titleY);
  };
  tubes(mixHex(col, '#2B201B', 0.72), 0);
  if (lit > 0) {
    ctx.save();
    ctx.globalAlpha *= lit;
    ctx.shadowColor = col; ctx.shadowBlur = 18 * glow; tubes(col, 1);
    ctx.shadowBlur = 5 * glow; tubes(mixHex(col, '#FFFFFF', 0.6), 2);
    ctx.restore();
  }
  if (b.sub) text(ctx, b.sub, 0, h - 17, 12.5, lit > 0 ? 'rgba(247,235,213,0.92)' : 'rgba(247,235,213,0.55)', { weight: 800 });
  if (b.medal) drawMedal(ctx, b.medal, w / 2 - 30, -16, 40);   // v1.25 : médaille d'Fabien épinglée au coin de l'enseigne
  ctx.restore();
  if (face) { // le visage arrive par la gauche, posé contre l'enseigne
    const k = ease.back(Math.min(1, Math.max(0, u - 0.1) / 0.3)), fw = 104, fh = 130;
    const fx = cx - w / 2 - fw + 18 - (1 - k) * 130, fy = top + h + 10 - fh;
    ctx.save(); ctx.globalAlpha = 1 - out;
    drawCharacterBust(ctx, fx, fy, fw, fh, face.spec, { mood: face.mood });
    ctx.restore();
  }
}

// Cadre néon de ChatGPT (allumé et éteint, sur fond noir). Découpé en neuf pour garder les coins,
// ajouté en lumière ('lighter') pour que le noir disparaisse, et teinté pour les enseignes orange et blanches.
const NEON_SRC = { halo: 35, corner: 55 };   // dans l'image : marge du halo autour du tube, côté d'un coin
const NEON_TINT = new Map();
function neonTinted(img, tone) {
  if (tone === 'rose' || tone === 'faible') return img;
  const key = (img === ART.neonOn ? 'on' : 'off') + tone;
  let c = NEON_TINT.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const p = c.getContext('2d');
    p.drawImage(img, 0, 0);
    p.globalCompositeOperation = 'color'; p.fillStyle = NEON[tone] || NEON.blanc; p.fillRect(0, 0, c.width, c.height);
    if (tone === 'blanc') { p.globalCompositeOperation = 'screen'; p.drawImage(c, 0, 0); }   // le blanc chaud a besoin de plus d'éclat
    NEON_TINT.set(key, c);
  }
  return c;
}
function nineSlice(ctx, img, c, dx, dy, dw, dh, dc) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const sx = [0, c, W - c, W], sy = [0, c, H - c, H];
  const px = [dx, dx + dc, dx + dw - dc, dx + dw], py = [dy, dy + dc, dy + dh - dc, dy + dh];
  for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++)
    ctx.drawImage(img, sx[q], sy[r], sx[q + 1] - sx[q], sy[r + 1] - sy[r], px[q], py[r], px[q + 1] - px[q], py[r + 1] - py[r]);
}
function drawNeonFrame(ctx, x, y, w, h, tone, lit) {
  const k = 0.6, m = NEON_SRC.halo * k, dc = NEON_SRC.corner * k;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  const a = ctx.globalAlpha;
  if (lit < 1) { ctx.globalAlpha = a * (1 - lit); nineSlice(ctx, neonTinted(ART.neonOff, tone), NEON_SRC.corner, x - m, y - m, w + 2 * m, h + 2 * m, dc); }
  if (lit > 0) { ctx.globalAlpha = a * lit; nineSlice(ctx, neonTinted(ART.neonOn, tone), NEON_SRC.corner, x - m, y - m, w + 2 * m, h + 2 * m, dc); }
  ctx.restore();
}

// Cloche de dernière commande (ChatGPT) : la potence est vissée au bord droit de l'écran,
// la cloche pend à son anneau et se balance. ang : balancement, a : opacité.
const BELL = { k: 0.38, armRing: [15, 35], bellRing: [58, 15], drop: 12 };   // repères en pixels des images
function drawBell(ctx, ang, a = 1) {
  const arm = ART.bellArm, bell = ART.bell;
  if (!artReady(arm) || !artReady(bell)) return;   // pas de cloche dessinée en code (décision du 30 octobre)
  const k = BELL.k, aw = arm.naturalWidth * k, ah = arm.naturalHeight * k;
  const ax = 360 + L.padX - aw, ay = L.hudH + 4;
  ctx.save();
  ctx.globalAlpha *= a; ctx.imageSmoothingEnabled = true;
  ctx.save();
  ctx.translate(ax + BELL.armRing[0] * k, ay + (BELL.armRing[1] + BELL.drop) * k); ctx.rotate(ang);
  ctx.drawImage(bell, -BELL.bellRing[0] * k, -BELL.bellRing[1] * k, bell.naturalWidth * k, bell.naturalHeight * k);
  ctx.restore();
  ctx.drawImage(arm, ax, ay, aw, ah);
  ctx.restore();
}

// ── Cartons d'Alex et Hugo (v1.20) : le jeu est figé, le perturbateur débarque en grand ──
// Son nom s'allume en néon, il entre par la gauche sur une bande de sa couleur et lance sa réplique,
// Max réagit à droite, la règle est écrite sur l'ardoise qui passe devant eux comme le comptoir.
// Une seule entrée animée (≈ 0,6 s), puis tout ressort par la droite.
const CARD = {
  alex: { name: 'MICHEL', tag: 'La blague de trop', tone: 'rose', band: ['#F39BB1', '#D7607F', '#9E3B58'], mood: 'proud', maxMood: 'oops', line: 'Et là, le coach… ★#@!' },
  hugo: { name: 'FABIEN', tag: 'La visite client', tone: 'orange', band: ['#5C93CF', '#2F5F99', '#1C3B63'], mood: 'focus', maxMood: 'panic', line: 'Visite client, on assure !' },
  // v1.26 : bande ambrée comme une IPA
  jeremie: { name: 'MARIE', tag: 'Le contrôle qualité', tone: 'blanc', band: ['#C98B5E', '#8E5A36', '#5A3520'], mood: 'idle', maxMood: 'sweat', line: 'Contrôle qualité !' },
};
const CARD_H = 470;   // du haut du nom au bas de l'ardoise
function cardTop() { return Math.max(L.hudH + 6, Math.round((L.H - CARD_H - 40) * 0.5)); }
function drawCut(ctx, g, cfg, cut, now) {
  const t = cut.t, K = CARD[cut.kind], alex = cut.kind === 'alex', jer = cut.kind === 'jeremie';
  const outK = !g.hold && g.freeze < 0.25 ? 1 - g.freeze / 0.25 : 0;
  const ph = (a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  ctx.fillStyle = `rgba(20,15,12,${0.86 * Math.min(1, t / 0.15) * (1 - outK)})`; ctx.fillRect(-40, 0, 440, L.H);
  const top = cardTop(), stageBot = top + 300, slateY = top + 290, slateH = 150;
  ctx.save(); ctx.translate(outK * 420, 0);

  // Bande de couleur en biais derrière les personnages (Alex rose, Hugo bleu nuit comme sa casquette)
  const bk = ease.out(ph(0, 0.26));
  if (bk > 0) {
    const [hi, mid, lo] = K.band, y0 = top + 150, y1 = top + 266, sk = 34;
    ctx.save();
    ctx.beginPath(); ctx.rect(-40, 0, 440 * bk, L.H); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-40, y0 + sk); ctx.lineTo(400, y0 - sk); ctx.lineTo(400, y1 - sk); ctx.lineTo(-40, y1 + sk); ctx.closePath();
    ctx.fillStyle = mid; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = hi;
    ctx.beginPath(); ctx.moveTo(-40, y0 + sk + 2); ctx.lineTo(400, y0 - sk + 2); ctx.stroke();
    ctx.strokeStyle = lo; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-40, y1 + sk - 3); ctx.lineTo(400, y1 - sk - 3); ctx.stroke();
    ctx.restore();
  }

  // Le perturbateur en grand, Max qui encaisse à droite
  const inA = ease.back(ph(0.06, 0.4)), inM = ease.back(ph(0.16, 0.5));
  const cw = 168, chh = 210, mw = 122, mh = 152;
  const pose = alex ? ART.cardAlex : jer ? ART.cardJeremie : ART.cardHugo;
  if (artReady(pose)) { // v1.21 : pose dessinée pour le carton, tournée vers Max
    const ph2 = 212, pw = pose.naturalWidth * ph2 / pose.naturalHeight;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(pose, 6 - (1 - inA) * 260, stageBot - ph2, pw, ph2);
    ctx.restore();
  } else if (jer) { // v1.26 : en attendant sa pose, son buste (ou la silhouette provisoire) en grand
    const c = drawJeremieSprite(ctx, 8 + cw / 2 - (1 - inA) * 250, stageBot, cw, Math.round(cw * 224 / 192), 'idle');
    if (c && c.ghost) text(ctx, '?', 8 + cw / 2 - (1 - inA) * 250, stageBot - 120, 64, C.cremeD, { pixel: true });
  } else drawCharacterBust(ctx, 8 - (1 - inA) * 250, stageBot - chh, cw, chh, alex ? ALEX_SPEC : HUGO_SPEC, { mood: K.mood });
  drawCharacterBust(ctx, 228 + (1 - inM) * 250, stageBot - mh, mw, mh, MAX_SPEC, { mood: K.maxMood, tipsy: alex ? 1 : 0 });

  // Sa réplique, au-dessus de Max, la pointe vers lui
  const bp = ease.back(ph(0.42, 0.58));
  if (bp > 0) {
    ctx.font = `800 14px ${FONT_T}`;
    const tw = ctx.measureText(K.line).width, bw = tw + 26, bh = 32, bx = 344 - bw, by = top + 104;
    ctx.save();
    ctx.translate(bx, by + bh); ctx.scale(bp, bp); ctx.translate(-bx, -(by + bh));
    ctx.fillStyle = C.creme; rr(ctx, bx, by, bw, bh, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx + 8, by + bh - 9); ctx.lineTo(bx - 14, by + bh + 12); ctx.lineTo(bx + 24, by + bh - 1); ctx.fill();
    text(ctx, K.line, bx + bw / 2, by + 21, 14, C.ink, { weight: 800 });
    ctx.restore();
  }

  // Le nom en néon, qui s'allume en grésillant, et le surnom
  const col = NEON[K.tone], lit = neonLevel({ tone: K.tone }, t - 0.2), glow = view.dpr * view.s;
  const nameY = top + 54;
  const tubes = (c) => { ctx.fillStyle = c; ctx.font = `400 72px ${FONT_P}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(K.name, 180, nameY); };
  ctx.save(); ctx.globalAlpha *= Math.min(1, t / 0.12);
  tubes(mixHex(col, '#2B201B', 0.72));
  if (lit > 0) {
    ctx.globalAlpha *= lit;
    ctx.shadowColor = col; ctx.shadowBlur = 22 * glow; tubes(col);
    ctx.shadowBlur = 6 * glow; tubes(mixHex(col, '#FFFFFF', 0.55));
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= ph(0.28, 0.45);
  text(ctx, K.tag, 180, top + 84, 16, C.creme, { weight: 800 });
  ctx.restore();

  // L'ardoise de la règle, devant les bustes comme le comptoir
  const sk = ease.out(ph(0.24, 0.5)), sy = slateY + (1 - sk) * 70;
  ctx.save(); ctx.globalAlpha *= sk;
  if (artReady(ART.ardoise)) { ctx.imageSmoothingEnabled = true; nineSlice(ctx, ART.ardoise, 46, 14, sy, 332, slateH, 16); }
  else { ctx.fillStyle = '#2B2C2C'; rr(ctx, 14, sy, 332, slateH, 6); ctx.fill(); }
  const mult = String(cfg.alexMult).replace('.', ',');
  if (alex && cfg.alexMode === 'inversion') {
    text(ctx, 'SERS L’INVERSE', 180, sy + 50, 36, C.creme, { pixel: true });
    for (const [a, b, x] of [['ipa', 'stout', 105], ['spritz', 'shot', 255]]) {
      drawGlass(ctx, a, x - 34, sy + 106, 1.25, 1);
      drawUIIcon(ctx, 'swap', x - 12, sy + 76, 24);
      drawGlass(ctx, b, x + 34, sy + 106, 1.25, 1);
    }
    text(ctx, `Points ×${mult} pendant ${cfg.alexDuration} secondes`, 180, sy + 131, 13, C.cremeD, { weight: 800 });
  } else if (alex) {
    text(ctx, 'POSTES À L’ENVERS', 180, sy + 54, 34, C.creme, { pixel: true });
    text(ctx, 'Les bulles, elles, disent vrai.', 180, sy + 88, 15, C.creme, { weight: 800 });
    text(ctx, `Points ×${mult} pendant ${cfg.alexDuration} secondes`, 180, sy + 128, 13, C.cremeD, { weight: 800 });
  } else if (jer) { // v1.26 : la règle du contrôle qualité
    drawGlass(ctx, 'ipa', 46, sy + 66, 1.15, 1);
    drawUIIcon(ctx, 'star', 290, sy + 20, 36);
    text(ctx, 'UN CHOCOLAT', 180, sy + 44, 34, C.creme, { pixel: true });
    text(ctx, 'PARFAIT', 180, sy + 80, 34, C.gold, { pixel: true });
    text(ctx, 'Versé devant elle, dans la zone dorée.', 180, sy + 106, 14, C.creme, { weight: 800 });
    text(ctx, `Approuvé : points ×${String(cfg.jeremieMult).replace('.', ',')} sur ${cfg.jeremieBoost} clients`, 180, sy + 131, 13, C.cremeD, { weight: 800 });
  } else {
    const n = String(g.hugo.target);
    ctx.font = `400 92px ${FONT_P}`; const nw = ctx.measureText(n).width;
    ctx.font = `400 38px ${FONT_P}`; const lw = Math.max(ctx.measureText('BOISSONS').width, 112);
    const x0 = 180 - (nw + 14 + lw) / 2;
    text(ctx, n, x0, sy + 102, 92, C.gold, { pixel: true, align: 'left' });
    text(ctx, 'BOISSONS', x0 + nw + 14, sy + 66, 38, C.creme, { pixel: true, align: 'left' });
    text(ctx, `en ${cfg.hugoDuration} secondes`, x0 + nw + 15, sy + 92, 15, C.creme, { weight: 800, align: 'left' });
    // v1.25 : les trois paliers sous la demande, avec les médailles du classement
    ctx.font = `800 14px ${FONT_T}`;
    const parts = [[3, 'Or'], [2, 'Argent'], [1, 'Bronze']].map(([k, w]) => { const s = `${w} ${g.hugo.tiers[k - 1]}`; return { k, s, w: ctx.measureText(s).width + 25 }; });
    let mx = 180 - (parts.reduce((a, p) => a + p.w, 0) + 16 * (parts.length - 1)) / 2;
    for (const p of parts) { drawMedal(ctx, p.k, mx, sy + 116, 21); text(ctx, p.s, mx + 25, sy + 132, 14, C.creme, { weight: 800, align: 'left' }); mx += p.w + 16; }
  }
  ctx.restore();
  ctx.restore();
  if (g.hold && t > HOLD_MIN[cut.kind]) {
    const py = slateY + slateH + 30;
    ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now * 4);
    text(ctx, 'Touche l’écran pour continuer', 180, py, 14, C.creme, { weight: 800 });
    ctx.restore();
  }
}

// ── Rideau métallique (v1.11) : il se lève à l'ouverture, retombe à la fermeture ──
// cover : 0 = levé, 1 = baissé jusqu'en bas de l'écran. Lames et barre : images de ChatGPT (v1.12).
const SHUTTER_T = 0.7;
function shutterDrop(t) {
  const k = Math.min(1, t / SHUTTER_T);
  return k < 0.8 ? Math.pow(k / 0.8, 1.6) : 1 - 0.035 * Math.sin((k - 0.8) / 0.2 * Math.PI);
}
function drawShutter(ctx, cover) {
  if (cover <= 0) return;
  const x0 = -L.padX - 2, w = 360 + 2 * L.padX + 4, top = L.hudH;
  const bottom = top + (L.H - top) * Math.min(1, cover);
  ctx.save();
  if (V.shake > 0) ctx.translate(0, (Math.random() - 0.5) * 6 * V.shake);
  if (cover < 1) { // ombre portée sous la barre
    const sh = ctx.createLinearGradient(0, bottom, 0, bottom + 14);
    sh.addColorStop(0, 'rgba(10,8,6,0.45)'); sh.addColorStop(1, 'rgba(10,8,6,0)');
    ctx.fillStyle = sh; ctx.fillRect(x0, bottom, w, 14);
  }
  if (artReady(ART.shutterTile) && artReady(ART.shutterBar)) { // lames et barre de ChatGPT, répétées depuis le bas
    const tile = ART.shutterTile, bar = ART.shutterBar;
    const th = w * tile.naturalHeight / tile.naturalWidth, bh = w * bar.naturalHeight / bar.naturalWidth;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, top, w, bottom - top); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    for (let y = bottom - bh + 1; y > top; y -= th) ctx.drawImage(tile, x0, y - th, w, th);
    ctx.drawImage(bar, x0, bottom - bh, w, bh);
    ctx.restore(); ctx.restore();
    return;
  }
  ctx.fillStyle = '#4B535C'; ctx.fillRect(x0, top, w, bottom - top);   // images pas encore chargées : simple aplat
  ctx.restore();
}
function drawClosing(ctx, g) {
  drawShutter(ctx, shutterDrop(Math.max(0, V.overT)));
}

function drawZones(ctx) {
  ctx.save();
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = 'rgba(134,217,174,0.9)'; ctx.setLineDash([5, 4]);
    ctx.strokeRect(i * 90 + 1, L.hudH, 88, L.counterBot - L.hudH);
    ctx.strokeStyle = 'rgba(243,155,177,0.9)';
    ctx.strokeRect(i * 90 + 1, L.stTop - 10, 88, L.H - L.stTop + 10);
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(242,179,64,0.9)'; ctx.strokeRect(1, L.counterBot, 358, L.stTop - 10 - L.counterBot);
  text(ctx, 'bandeau : glisser le plateau · toucher un verre = le jeter', 180, L.counterBot + 14, 9.5, C.warn, { weight: 800 });
  text(ctx, 'colonnes clients : servir', 180, L.hudH + 16, 10, C.good, { weight: 800 });
  text(ctx, 'stations : prendre, tirer', 180, L.H - 6, 10, C.rose, { weight: 800 });
  ctx.restore();
}
