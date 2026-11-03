// Atlas embarqués : équipe, décors, boissons, clients, salle.
// v1.26 : Jérémie, le brasseur (contrôle qualité). Ses dessins sont facultatifs : sans eux, la marque devient une chaîne vide,
// le jeu public n'a pas de Jérémie et le mode test montre une silhouette provisoire.
const JEREMIE_DATA = '__JEREMIE_DATA__', JEREMIE_CARD_DATA = '__CARD_JEREMIE_DATA__';
const JEREMIE_IN_PAGE = JEREMIE_DATA.startsWith('data:');
// Aucun téléchargement : la page dist reste jouable hors ligne.
// Bustes de l'équipe dessinés par ChatGPT dans le style des clients (v1.22). Ligne 0 Max (9), ligne 1 Alex (3), ligne 2 Hugo (4). Cases 192 × 240.
const TEAM = new Image(); TEAM.src = '__TEAM_DATA__';
// Décors des annonces, de la pause et de l'addition (ChatGPT, 30/10).
const ART = {};
for (const [k, v] of Object.entries({
  neonOn: '__NEON_ON_DATA__',
  neonOff: '__NEON_OFF_DATA__',
  bell: '__BELL_DATA__',
  bellArm: '__BELL_ARM_DATA__',
  shutterTile: '__SHUTTER_TILE_DATA__',
  shutterBar: '__SHUTTER_BAR_DATA__',
  ticket: '__TICKET_DATA__',
  ardoise: '__ARDOISE_DATA__',
  maxAccueil: '__MAX_ACCUEIL_DATA__',   // Max qui essuie un verre, à l'accueil
  // v1.21 : poses des cartons (ChatGPT), tournées vers Max ; découpées par tools/pack-chatgpt.py
  cardAlex: '__CARD_ALEX_DATA__',
  cardHugo: '__CARD_HUGO_DATA__',
  cardJeremie: JEREMIE_CARD_DATA,       // v1.26 : pose du carton de Jérémie (vide tant que ChatGPT ne l'a pas dessinée)
})) { ART[k] = new Image(); ART[k].src = v; }
const artReady = (i) => !!(i && i.complete && i.naturalWidth);
const SERVICE_PANEL = new Image(); SERVICE_PANEL.src = '__SERVICE_PANEL_DATA__';
const STATION_PANEL = new Image(); STATION_PANEL.src = '__STATION_PANEL_DATA__';
const UI_ICONS = new Image(); UI_ICONS.src = '__UI_ICONS_DATA__';
const EVENT_PANEL = STATION_PANEL;   // v1.25 : même ardoise, embarquée une seule fois
const SERVING_TRAY = new Image(); SERVING_TRAY.src = '__TRAY_DATA__';
const DRINK_ART = new Image(); DRINK_ART.src = '__DRINK_ART_DATA__';
// v1.18 : la stout en 6 étapes du même verre (vide → tiers laiteux → deux tiers → caramel → repos → parfaite), 6 cases 192 × 256.
const STOUT_STEPS = new Image(); STOUT_STEPS.src = '__STOUT_STEPS_DATA__';
const stoutStepsReady = () => STOUT_STEPS.complete && STOUT_STEPS.naturalWidth > 0;
const ANAIS = new Image(); ANAIS.src = '__ANAIS_DATA__';
// v1.13 : Nico, second serveur du Galopins (ChatGPT). Bande de 4 cases 192 × 224 : neutre, content, agacé, furieux.
const NICO = new Image(); NICO.src = '__NICO_DATA__';
// Amis de l'équipe : une bande verticale par personne. Lignes : neutre, content, agacé, puis furieux si la bande en a 4.
// v1.14 : Roxane (ChatGPT), même format que Nico.
const ROXANE = new Image(); ROXANE.src = '__ROXANE_DATA__';
// v1.15 : Jeremy (ChatGPT), même format.
const JEREMY = new Image(); JEREMY.src = '__JEREMY_DATA__';
// Volta : Elea, cliente de la salle (même format que les amis)
const ELEA = new Image(); ELEA.src = '__ELEA_DATA__';
const NISE = new Image(); NISE.src = '__NISE_DATA__';
// v1.26 : Jérémie, bande verticale de 5 cases 192 × 224 (tools/pack-friend.py … 5) : neutre (carnet), goûte, approuve, grimace, pompette.
const JEREMIE = new Image(); if (JEREMIE_IN_PAGE) JEREMIE.src = JEREMIE_DATA;
const JER_ROWS = 5, JER_ROW = { idle: 0, taste: 1, approve: 2, reject: 3, tipsy: 4 };
const FRIENDS = [{ key: 'anais', img: ANAIS, rows: 3 }, { key: 'nico', img: NICO, rows: 4 }, { key: 'roxane', img: ROXANE, rows: 4 }, { key: 'jeremy', img: JEREMY, rows: 4 }, { key: 'elea', img: ELEA, rows: 4 }, { key: 'nise', img: NISE, rows: 4 }];
function friendOf(look) { return look >= 8 ? FRIENDS[Math.floor((look - 8) / 2) % FRIENDS.length] : null; }
const CUSTOMERS = new Image();
CUSTOMERS.src = '__CUSTOMERS_DATA__';
// v1.19 : salle plus profonde, avec des gens attablés (ChatGPT, 30 octobre). v1.32 : nette partout, accueil et partie
// (retours des testeurs : on préfère voir les clients attablés) ; plus de version floue ni de réglage « salle ».
const ROOM_DEPTH = new Image(); ROOM_DEPTH.src = '__ROOM_DEPTH_DATA__';

const UI_ICON = { clock: 0, hand: 1, star: 2, warn: 3, check: 4, pause: 5, swap: 6, target: 7 };
function drawUIIcon(ctx, name, x, y, w, h = w) {
  if (!UI_ICONS.complete || !UI_ICONS.naturalWidth) return false;
  const i = UI_ICON[name];
  if (i === undefined) return false;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(UI_ICONS, (i % 4) * 128, Math.floor(i / 4) * 128, 128, 128, x, y, w, h);
  ctx.restore(); return true;
}

function customerRow(mood, rows = 3) {
  if (mood === 'happy') return 1;
  if (mood === 'annoyed') return 2;
  if (mood === 'furious' || mood === 'angry') return rows > 3 ? 3 : 2;
  return 0;
}

// Copie assombrie d'une case d'atlas (l'ami en retrait d'une table de potes), gardée en cache.
const SHADED = new Map();
function shadedCell(img, id, sx, sy, sw, sh, k) {
  const key = [id, sx, sy, k].join(':');
  let c = SHADED.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const p = c.getContext('2d');
    p.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    p.globalCompositeOperation = 'source-atop';
    p.fillStyle = `rgba(30,19,14,${k})`; p.fillRect(0, 0, sw, sh);
    SHADED.set(key, c);
  }
  return c;
}
function drawCustomerSprite(ctx, x, by, w, h, look, mood, shade = 0) {
  const f = friendOf(look), img = f ? f.img : CUSTOMERS;
  if (!img.complete || !img.naturalWidth) return false;
  const cols = f ? 1 : 4, rows = f ? f.rows : 3;
  // Le buste entier est dans l’atlas : aucune extension rectangulaire sous le sprite.
  const sw = img.naturalWidth / cols, sh = img.naturalHeight / rows;
  const sx = (f ? 0 : look % 4) * sw, sy = customerRow(mood, rows) * sh;
  const dx = Math.round(x - w / 2), dy = Math.round(by - h);
  ctx.save(); ctx.imageSmoothingEnabled = true;
  if (shade > 0) ctx.drawImage(shadedCell(img, f ? f.key : 'clients', sx, sy, sw, sh, shade), dx, dy, w, h);
  else ctx.drawImage(img, sx, sy, sw, sh, dx, dy, w, h);
  ctx.restore();
  return true;
}


// Case de Jérémie selon son humeur. Sans ses dessins : un client de l'atlas passé au noir (silhouette provisoire, aucun dessin en code).
function jeremieCell(mood) {
  if (artReady(JEREMIE)) { const sw = JEREMIE.naturalWidth, sh = JEREMIE.naturalHeight / JER_ROWS; return { img: JEREMIE, sx: 0, sy: (JER_ROW[mood] || 0) * sh, sw, sh }; }
  if (!artReady(CUSTOMERS)) return null;
  const sw = CUSTOMERS.naturalWidth / 4, sh = CUSTOMERS.naturalHeight / 3;
  return { img: shadedCell(CUSTOMERS, 'clients', sw, 0, sw, sh, 0.94), sx: 0, sy: 0, sw, sh, ghost: true };
}
function drawJeremieSprite(ctx, x, by, w, h, mood) {
  const c = jeremieCell(mood);
  if (!c) return null;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c.img, c.sx, c.sy, c.sw, c.sh, Math.round(x - w / 2), Math.round(by - h), w, h);
  ctx.restore();
  return c;
}
// Visage recadré pour le bandeau (haut de la case, comme drawCharacterFace).
function drawJeremieFace(ctx, x, y, w, h, mood) {
  const c = jeremieCell(mood);
  if (!c) return false;
  const fx = c.sw * 0.14, fy = c.sh * 0.02, fw = c.sw * 0.72, fh = c.sh * 0.66;
  const scale = Math.min(w / fw, h / fh), dw = fw * scale, dh = fh * scale;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c.img, c.sx + fx, c.sy + fy, fw, fh, x + (w - dw) / 2, y + h - dh, dw, dh);
  ctx.restore();
  return true;
}

// Portrait entier : visage, cou et vêtement sont dessinés dans la même image.
// Case de l'atlas selon le personnage et son humeur.
// Max : neutre, content, stressé, blasé, oups, triste, fier, pompette, concentré.
// Alex : neutre, rigolard (il tend un shot), vexé (bras croisés). Hugo : neutre (bras croisés), autoritaire (il tapote sa montre), fier (pouce levé), déçu (main sur le front).
const TEAM_COLS = 9;
function teamCell(spec, st) {
  const m = st.mood || 'idle';
  if (spec.portrait === 0) {
    if (st.tipsy) return 7;
    return ({ happy: 1, cheers: 1, panic: 2, sweat: 2, tired: 3, wary: 3, annoyed: 3, vexed: 3, angry: 3, oops: 4, sad: 5, proud: 6, triumph: 6, hot: 6, focus: 8 })[m] ?? 0;
  }
  if (spec.portrait === 1) return ({ happy: 1, proud: 1, cheers: 1, triumph: 1, vexed: 2, sad: 2, angry: 2, annoyed: 2 })[m] ?? 0;
  return ({ focus: 1, angry: 1, annoyed: 1, panic: 1, proud: 2, happy: 2, triumph: 2, sad: 3, vexed: 3 })[m] ?? 0;
}
function drawCharacterBust(ctx, x, y, w, h, spec, st = {}) {
  if (!artReady(TEAM)) return false;
  const cw = TEAM.naturalWidth / TEAM_COLS, ch = TEAM.naturalHeight / 3;
  // Contenir l'image dans sa zone sans étirer les visages, et poser le buste en bas.
  const scale = Math.min(w / cw, h / ch), dw = cw * scale, dh = ch * scale;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(TEAM, teamCell(spec, st) * cw, spec.portrait * ch, cw, ch, x + (w - dw) / 2, y + h - dh, dw, dh);
  ctx.restore(); return true;
}
// Visage seul (v1.20) : on recadre la case sur la tête pour que l'expression se lise en petit (bandeaux d'Alex et Hugo).
// v1.22 : toute l'équipe est dans le style des clients (tête près du haut de la case) ; Hugo, dessiné plus en pied
// avec un geste par expression, garde aussi le haut de son geste.
const FACE_CROP = [{ x: 22, y: 4, w: 148, h: 185 }, { x: 22, y: 4, w: 148, h: 185 }, { x: 20, y: 6, w: 152, h: 190 }];   // dans une case de 192 × 240
function drawCharacterFace(ctx, x, y, w, h, spec, st = {}) {
  if (!artReady(TEAM)) return false;
  const cw = TEAM.naturalWidth / TEAM_COLS, ch = TEAM.naturalHeight / 3, k = cw / 192, F = FACE_CROP[spec.portrait];
  const sx = teamCell(spec, st) * cw + F.x * k, sy = spec.portrait * ch + F.y * k;
  const scale = Math.min(w / F.w, h / F.h), dw = F.w * scale, dh = F.h * scale;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(TEAM, sx, sy, F.w * k, F.h * k, x + (w - dw) / 2, y + h - dh, dw, dh);
  ctx.restore(); return true;
}
// Découpe en neuf parties : les coins peints gardent leur forme et leur finesse.
function drawMaterialPanel(ctx, img, x, y, w, h) {
  if (!img.complete || !img.naturalWidth) return false;
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const edge = Math.max(1, Math.round(Math.min(sw, sh) * (w / h > 2 ? 0.24 : 0.16)));
  const dst = Math.min(w / h > 2 ? 8 : 11, w / 4, h / 4);
  const sx = [0, edge, sw - edge, sw], sy = [0, edge, sh - edge, sh];
  const dx = [x, x + dst, x + w - dst, x + w], dy = [y, y + dst, y + h - dst, y + h];
  ctx.save(); ctx.imageSmoothingEnabled = true;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    ctx.drawImage(img, sx[c], sy[r], sx[c+1]-sx[c], sy[r+1]-sy[r], dx[c], dy[r], dx[c+1]-dx[c], dy[r+1]-dy[r]);
  ctx.restore(); return true;
}
