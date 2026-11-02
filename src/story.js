// ─────────────────────────────────────────────────────────────
// STORY (v1.40) — image 1080 × 1920 du score, à poster en story Instagram en taguant le bar.
// Composée avec les visuels déjà embarqués (salle, ticket, Max qui essuie un verre, cadre néon, bois du comptoir) :
// aucune image en plus dans la page. Dessin et encodage synchrones : le partage part dans le même geste que le toucher
// (Safari refuse la feuille de partage si on attend trop après le toucher).
// Zones sûres d'une story : le haut (≈ 230 px) et le bas (≈ 220 px) sont couverts par Instagram, rien d'important n'y va.
// ─────────────────────────────────────────────────────────────
const STORY = { w: 1080, h: 1920, handle: THEME.insta ? '@' + THEME.insta : '' };
const STORY_TAG = THEME.insta ? 'tague @' + THEME.insta : 'partage ton score';
const STORY_MONO = "'VT323', 'Courier New', monospace";
const STORY_INK = '#2B2622', STORY_SOFT = '#6E655B', STORY_STAMP = '#C9475F', STORY_PAPER = '#F4EEDF';
// Espaces fines du français (toLocaleString) : les polices du jeu ne les ont pas toutes, une espace simple suffit.
const storyNum = (n) => Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
const storyStr = (s) => String(s).normalize('NFC');

// Texte centré avec espacement des lettres (ctx.letterSpacing n'existe pas sur tous les téléphones).
function storySpaced(ctx, s, cx, y, gap) {
  const chars = [...storyStr(s)], ws = chars.map((c) => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  const al = ctx.textAlign; ctx.textAlign = 'left';
  let x = cx - total / 2;
  chars.forEach((c, i) => { ctx.fillText(c, x, y); x += ws[i] + gap; });
  ctx.textAlign = al;
  return total;
}
// Plus grande taille (≤ max) pour que le texte tienne dans la largeur.
function storyFit(ctx, s, max, width, font) {
  let size = max;
  for (; size > 10; size -= 4) { ctx.font = font(size); if (ctx.measureText(storyStr(s)).width <= width) break; }
  return size;
}
function storyCover(ctx, img, W, H) {
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}
function storyDash(ctx, x0, x1, y) {
  ctx.save(); ctx.strokeStyle = 'rgba(43,38,34,0.45)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.restore();
}
// Une ligne de l'addition : libellé, pointillés, valeur.
function storyLine(ctx, label, value, x0, x1, y, size) {
  const l = storyStr(label), v = storyStr(value);
  // v1.43 : sur un ticket étroit, la ligne se resserre plutôt que de faire chevaucher libellé et valeur
  size = storyFit(ctx, l + '  ' + v, size, x1 - x0 - 24, (s) => `400 ${s}px ${STORY_MONO}`);
  ctx.font = `400 ${size}px ${STORY_MONO}`; ctx.fillStyle = STORY_INK; ctx.textBaseline = 'alphabetic';
  const lw = ctx.measureText(l).width, vw = ctx.measureText(v).width;
  ctx.textAlign = 'left'; ctx.fillText(l, x0, y);
  ctx.textAlign = 'right'; ctx.fillText(v, x1, y);
  ctx.fillStyle = 'rgba(43,38,34,0.42)';
  for (let x = x0 + lw + 14; x < x1 - vw - 12; x += 12) ctx.fillRect(x, y - size * 0.18, 4, 4);
}
// Le ticket de ChatGPT, bords dentelés gardés, milieu étiré à la hauteur voulue.
function storyTicket(ctx, x, y, w, h) {
  const img = ART.ticket;
  if (!artReady(img)) { ctx.fillStyle = STORY_PAPER; ctx.fillRect(x, y, w, h); return; }
  const iw = img.naturalWidth, ih = img.naturalHeight, e = 22, de = e * (w / iw);
  ctx.drawImage(img, 0, 0, iw, e, x, y, w, de);
  ctx.drawImage(img, 0, e, iw, ih - 2 * e, x, y + de, w, h - 2 * de);
  ctx.drawImage(img, 0, ih - e, iw, e, x, y + h - de, w, de);
}

// v1.43 : fond dessiné pour la story par ChatGPT (salle, cheval lumineux, Max pouce levé derrière le comptoir).
// Facultatif (build.mjs) : sans lui, l'ancienne composition (salle du jeu, Max qui essuie un verre, comptoir en bois).
const STORY_BG_DATA = '__STORY_BG_DATA__';
const STORY_BG = new Image(); if (STORY_BG_DATA.startsWith('data:')) STORY_BG.src = STORY_BG_DATA;
// Repères de chaque mise en page (pixels de l'image 1080 × 1920). « fond » : titre au-dessus du cheval lumineux,
// ticket sous le cheval à droite, bulle au-dessus de la tête de Max, néon sur le devant du comptoir de l'image.
const STORY_LAYOUT = {
  // ticket : [gauche, largeur, haut, bas maximal] ; néon : [gauche, haut, largeur, hauteur, épaisseur du tube]
  // fond (v1.43, dessin corrigé avec les clients attablés) : le ticket descend sous les tables pour laisser voir la salle animée,
  // posé sur le comptoir à droite ; le néon passe à gauche, sur le devant du comptoir, sous le bras de Max.
  fond: { kicker: 222, logo: 380, logoSize: 200, addr1: 432, addr2: 472, ticket: [584, 470, 975, 1690], bubble: [36, 650, 380, 152], counterTop: 0, neon: [20, 1536, 556, 136, 1.7] },
  salle: { kicker: 282, logo: 470, logoSize: 250, addr1: 562, addr2: 608, ticket: [436, 600, 652, 1464], bubble: [40, 830, 400, 168], counterTop: 1500, neon: [90, 1562, 900, 150, 2] },
};

// info : { score, at, rows: [[libellé, valeur]…], record, rank: [lignes du classement], defi: ligne du défi relevé }
function drawStory(info) {
  const W = STORY.w, H = STORY.h;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

  const bg = artReady(STORY_BG), L = bg ? STORY_LAYOUT.fond : STORY_LAYOUT.salle;
  // ── Fond : le dessin de la story, ou la salle du jeu ; assombri en haut pour le titre ──
  ctx.fillStyle = '#211F1C'; ctx.fillRect(0, 0, W, H);
  let g = ctx.createLinearGradient(0, 0, 0, H);
  if (bg) {
    storyCover(ctx, STORY_BG, W, H);
    g.addColorStop(0, 'rgba(18,12,10,0.62)'); g.addColorStop(0.27, 'rgba(18,12,10,0.22)'); g.addColorStop(0.38, 'rgba(18,12,10,0)'); g.addColorStop(1, 'rgba(18,12,10,0)');
  } else {
    if (artReady(ROOM_DEPTH)) storyCover(ctx, ROOM_DEPTH, W, H);
    g.addColorStop(0, 'rgba(18,12,10,0.8)'); g.addColorStop(0.33, 'rgba(18,12,10,0.55)'); g.addColorStop(0.62, 'rgba(18,12,10,0.3)'); g.addColorStop(1, 'rgba(18,12,10,0.75)');
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // ── Titre, comme l'accueil du jeu ──
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 44px ${FONT_T}`; ctx.fillStyle = '#F0C27E';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10; storySpaced(ctx, THEME.enseigne, W / 2, L.kicker, 15); ctx.shadowBlur = 0;
  ctx.font = `400 ${L.logoSize}px ${FONT_P}`;
  const sh8 = L.logoSize / 11.4;
  for (const [dy, col] of [[2 * sh8, '#3A2414'], [sh8, '#9A5426'], [0, '#F7EBD5']]) { ctx.fillStyle = col; storySpaced(ctx, 'ARCADE', W / 2, L.logo + dy, 8); }
  // v1.41 (Jérémie) : l'adresse du bar sous le titre, pour que la story donne envie de venir
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8;
  ctx.font = `800 38px ${FONT_T}`; ctx.fillStyle = '#F7EBD5';
  ctx.fillText(storyStr(THEME.auComptoir), W / 2, L.addr1);
  ctx.font = `700 34px ${FONT_T}`; ctx.fillStyle = '#F0C27E';
  if (THEME.adresse) ctx.fillText(storyStr(THEME.adresse), W / 2, L.addr2); ctx.shadowBlur = 0;

  // ── Le ticket, à droite, légèrement de travers (avec le fond de la story : juste à droite du pouce de Max) ──
  const [tx, tw, ty, tBottom] = L.ticket, pad = 52, x0 = tx + pad, x1 = tx + tw - pad, cx = tx + tw / 2;
  const rows = info.rows || [], rank = info.rank || [];
  const th = 56 + 44 + 34 + 64 + rows.length * 58 + 34 + 62 + 168 + (info.record ? 112 : 0) + (rank.length + (info.defi ? 1 : 0)) * 52 + 44;
  const fit = Math.min(1, (tBottom - ty) / th);   // un ticket long rétrécit au lieu de passer sur le néon
  ctx.save();
  ctx.translate(cx, ty); ctx.scale(fit, fit); ctx.rotate(0.03); ctx.translate(-cx, -ty);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  storyTicket(ctx, tx, ty, tw, th);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  let y = ty + 56 + 30;
  const d = new Date(info.at || Date.now()), two = (n) => String(n).padStart(2, '0');
  ctx.font = `400 34px ${STORY_MONO}`; ctx.fillStyle = STORY_SOFT; ctx.textAlign = 'center';
  ctx.fillText(storyStr(`Service du ${two(d.getDate())}/${two(d.getMonth() + 1)} · barman : Max`), cx, y);
  y += 34; storyDash(ctx, x0, x1, y);
  y += 64; ctx.font = `400 44px ${STORY_MONO}`; ctx.fillStyle = STORY_INK; storySpaced(ctx, 'L’ADDITION', cx, y, 7);
  for (const [k, v] of rows) { y += 58; storyLine(ctx, k, v, x0, x1, y, 42); }
  y += 34; storyDash(ctx, x0, x1, y);
  y += 62; ctx.font = `400 46px ${STORY_MONO}`; ctx.fillStyle = STORY_INK; storySpaced(ctx, 'TOTAL', cx, y, 12);
  const score = storyNum(info.score);
  const sz = storyFit(ctx, score, 190, tw - 2 * pad, (s) => `400 ${s}px ${FONT_P}`);
  y += 162; ctx.font = `400 ${sz}px ${FONT_P}`; ctx.fillStyle = STORY_INK; ctx.textAlign = 'center'; ctx.fillText(score, cx, y);
  if (info.record) { // tampon « Nouveau record », comme sur l'addition
    y += 92;
    ctx.save(); ctx.translate(cx, y - 22); ctx.rotate(-0.1);
    ctx.font = `400 60px ${FONT_P}`; const label = storyStr('NOUVEAU RECORD !'), lw = ctx.measureText(label).width;
    ctx.globalAlpha = 0.9; ctx.strokeStyle = STORY_STAMP; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.roundRect(-lw / 2 - 26, -48, lw + 52, 88, 8); ctx.stroke();
    ctx.fillStyle = STORY_STAMP; ctx.textAlign = 'center'; ctx.fillText(label, 0, 22);
    ctx.restore();
    y += 20;
  }
  ctx.textAlign = 'center';
  rank.forEach((line, i) => { y += 52; ctx.font = `400 ${i ? 38 : 46}px ${STORY_MONO}`; ctx.fillStyle = i ? STORY_SOFT : STORY_STAMP; ctx.fillText(storyStr(line), cx, y); });
  if (info.defi) { y += 52; ctx.font = `400 44px ${STORY_MONO}`; ctx.fillStyle = STORY_STAMP; ctx.fillText(storyStr(info.defi), cx, y); }
  ctx.restore();

  // ── Max derrière le comptoir, à gauche (déjà dans le dessin de la story), et sa bulle ──
  if (!bg && artReady(ART.maxAccueil)) {
    const mw = 400, mh = mw * ART.maxAccueil.naturalHeight / ART.maxAccueil.naturalWidth;
    ctx.drawImage(ART.maxAccueil, 6, L.counterTop + 46 - mh, mw, mh);
  }
  const [bx, by, bw, bh] = L.bubble;
  ctx.save();
  ctx.shadowColor = 'rgba(20,12,8,0.55)'; ctx.shadowOffsetY = 8; ctx.shadowBlur = 0;
  ctx.fillStyle = '#F7EBD5';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + 150, by + bh - 2); ctx.lineTo(bx + 210, by + bh - 2); ctx.lineTo(bx + 172, by + bh + 46); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#211B13'; ctx.textAlign = 'center';
  const bs = storyFit(ctx, 'Tu me bats ?', 92, bw - 56, (s) => `400 ${s}px ${FONT_P}`);
  ctx.font = `400 ${bs}px ${FONT_P}`; ctx.fillText(storyStr('Tu me bats ?'), bx + bw / 2, by + bh * 0.55);
  const ts = storyFit(ctx, 'Viens jouer au comptoir !', 30, bw - 48, (s) => `800 ${s}px ${FONT_T}`);
  ctx.font = `800 ${ts}px ${FONT_T}`; ctx.fillText(storyStr('Viens jouer au comptoir !'), bx + bw / 2, by + bh * 0.83);

  // ── Comptoir en bois (déjà dans le dessin de la story), sa rive, et l'enseigne néon du compte Instagram ──
  if (!bg) {
    const counterTop = L.counterTop;
    if (artReady(SERVICE_PANEL)) {
      const ph = W * SERVICE_PANEL.naturalHeight / SERVICE_PANEL.naturalWidth;
      for (let yy = counterTop; yy < H; yy += ph) ctx.drawImage(SERVICE_PANEL, 0, yy, W, ph);
    } else { ctx.fillStyle = '#704023'; ctx.fillRect(0, counterTop, W, H - counterTop); }
    ctx.fillStyle = 'rgba(30,18,12,0.42)'; ctx.fillRect(0, counterTop, W, H - counterTop);
    ctx.fillStyle = '#79502F'; ctx.fillRect(0, counterTop, W, 24);
    ctx.fillStyle = '#C99356'; ctx.fillRect(0, counterTop, W, 5);
    ctx.fillStyle = '#493021'; ctx.fillRect(0, counterTop + 19, W, 5);
  }

  // v1.42 (Jérémie : « cadre noir moche ») : plus de plaque autour du tube. Le néon est posé sur le bois,
  // seul l'intérieur du tube est un peu assombri pour que le @ ressorte.
  if (!STORY.handle) return c;   // pas de compte Instagram : pas d'enseigne
  const [sx, sy, sw, sh, nk] = L.neon, ncx = sx + sw / 2, tube = { x: sx + 14, y: sy + 14, w: sw - 28, h: sh - 28 };
  ctx.fillStyle = 'rgba(20,10,12,0.55)'; ctx.beginPath(); ctx.roundRect(tube.x + 8, tube.y + 8, tube.w - 16, tube.h - 16, 22); ctx.fill();
  if (artReady(ART.neonOn)) { ctx.save(); ctx.scale(nk, nk); drawNeonFrame(ctx, tube.x / nk, tube.y / nk, tube.w / nk, tube.h / nk, 'rose', 1); ctx.restore(); }
  const nsz = storyFit(ctx, STORY.handle, 92, sw - 30 - 40 * nk, (s) => `400 ${s}px ${FONT_P}`);
  ctx.font = `400 ${nsz}px ${FONT_P}`; ctx.textAlign = 'center';
  const ny = sy + sh / 2 + nsz * 0.3;
  ctx.fillStyle = mixHex(NEON.rose, '#2B201B', 0.72); ctx.fillText(STORY.handle, ncx, ny);
  ctx.save(); ctx.shadowColor = NEON.rose; ctx.shadowBlur = 17 * nk; ctx.fillStyle = NEON.rose; ctx.fillText(STORY.handle, ncx, ny);
  ctx.shadowBlur = 5 * nk; ctx.fillStyle = mixHex(NEON.rose, '#FFFFFF', 0.6); ctx.fillText(STORY.handle, ncx, ny); ctx.restore();
  return c;
}

// Image JPEG prête à partager (synchrone : toDataURL plutôt que toBlob).
function storyFile(info) {
  const url = drawStory(info).toDataURL('image/jpeg', 0.9);
  const bin = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const name = `${THEME.jeu.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.round(info.score)}.jpg`;
  return { url, name, file: new File([bytes], name, { type: 'image/jpeg' }) };
}
