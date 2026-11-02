"""Découpe les visuels de ChatGPT en images prêtes pour le jeu.
Sources : assets/sources/ (fond vert, voir LIRE-MOI.md). Sorties : assets/characters/ et assets/ui/ (WebP).
Usage, depuis la racine du dépôt : python3 tools/pack-chatgpt.py [dossier de sortie]   (par défaut : assets/)
Ensuite : node build.mjs."""
import os, sys
import numpy as np
from PIL import Image

SRC = 'assets/sources/'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'assets/'
for d in ('characters', 'ui'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
save = lambda im, path, q=90: im.save(os.path.join(OUT, path), 'WEBP', quality=q, method=6)


def fonce_cadre(im):
    """v1.48 : cadre en bois de l'ardoise des cartons ramené au ton du comptoir (l'orange vif tranchait).
    Seuls les pixels colorés (le bois) sont touchés, l'ardoise grise et la transparence restent telles quelles."""
    a = np.array(im).astype(np.float32); rgb = a[..., :3]
    mx = rgb.max(-1); mn = rgb.min(-1); sat = (mx - mn) / np.maximum(mx, 1)
    k = np.clip((sat - 0.22) / 0.16, 0, 1)[..., None]                    # 0 sur l'ardoise grise, 1 sur le bois
    noyer = rgb * 0.56 * 0.82 + np.array([62, 36, 20], np.float32) * 0.18  # plus sombre, un peu moins saturé
    a[..., :3] = rgb * (1 - k) + noyer * k
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def key_green(path):
    """Fond vert → transparence, sans liseré vert. Le vert de ChatGPT varie d'une planche à l'autre (#02FA2D à #02FA5B) :
    on le mesure sur les bords de l'image, on retire sa part dans les pixels de contour, puis on dé-verdit légèrement."""
    a = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    edge = np.concatenate([a[:8].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])   # pas le bas : les bustes le touchent
    bg = np.median(edge, 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)
    hi = bg[1] - max(bg[0], bg[2]) - 15
    al = 1 - np.clip((d - 40) / (hi - 40), 0, 1)
    am = np.maximum(al, 1e-3)[..., None]
    F = np.clip((a - (1 - al)[..., None] * bg) / am, 0, 255)
    F[..., 1] = np.minimum(F[..., 1], np.maximum(F[..., 0], F[..., 2]) + 18)
    out = np.dstack([F, al * 255]).astype(np.uint8)
    out[al < 0.02] = 0
    return Image.fromarray(out, 'RGBA')


def bbox(im, th=128, minrow=20):
    """Cadre du buste : plus longue suite de lignes pleines (ignore les bouts d'un buste voisin qui dépassent dans la case)."""
    a = np.array(im.getchannel('A')) > th
    rc = a.sum(1) > minrow
    best = (0, 0); start = None
    for y, v in enumerate(list(rc) + [False]):
        if v and start is None: start = y
        if not v and start is not None:
            if y - start > best[1] - best[0]: best = (start, y)
            start = None
    y0, y1 = best
    xs = np.where(a[y0:y1].any(0))[0]
    return xs.min(), y0, xs.max() + 1, y1


def head_cx(im, bb, frac=0.35):
    """Centre horizontal de la tête (haut du buste) : sert d'ancre, une main ou une montre ne décale rien."""
    a = np.array(im.getchannel('A')) > 128
    x0, y0, x1, y1 = bb; yh = y0 + int((y1 - y0) * frac)
    ys, xs = np.where(a[y0:yh, x0:x1])
    return x0 + xs.mean()


def cells(im, cols, rows):
    W, H = im.size; cw, ch = W / cols, H / rows
    return [im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))) for r in range(rows) for c in range(cols)]


def split(im, cols, rows):
    """Comme cells, mais coupe au milieu des vides entre les personnages (une planche n'est jamais parfaitement régulière)."""
    a = np.array(im.getchannel('A')) > 40
    def cuts(profile, n, size):
        runs, start = [], None
        for i, v in enumerate(list(profile) + [99]):   # une colonne avec 3 pixels parasites au plus compte comme vide
            if v <= 3 and start is None: start = i
            if v > 3 and start is not None:
                if start > 0 and i < size: runs.append((i - start, (start + i) // 2))
                start = None
        mids = sorted(m for _, m in sorted(runs, reverse=True)[:n - 1])
        return [0] + mids + [size]
    ys = cuts(a.sum(1), rows, im.height)
    out = []
    for r in range(rows):
        band = im.crop((0, ys[r], im.width, ys[r + 1]))
        xs = cuts((np.array(band.getchannel('A')) > 40).sum(0), cols, im.width)
        out += [band.crop((xs[c], 0, xs[c + 1], band.height)) for c in range(cols)]
    return out


CW, CH = 192, 240   # case de l'atlas de l'équipe


def place(cellims, target_h=230):
    """Même échelle pour toutes les expressions d'un personnage (calée sur la première), tête centrée, buste posé en bas."""
    bbs = [bbox(c) for c in cellims]
    x0, y0, x1, y1 = bbs[0]
    s = target_h / (y1 - y0)
    if (x1 - x0) * s > CW * 1.14: s = CW * 1.14 / (x1 - x0)
    outs = []
    for c, bb in zip(cellims, bbs):
        sc = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
        cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        dx, dy = round(CW / 2 - head_cx(c, bb) * s), round(CH + 2 - bb[3] * s)
        if dx >= 0 and dy >= 0: cell.alpha_composite(sc, (dx, dy))
        else: cell.paste(sc, (dx, dy), sc)
        outs.append(cell)
    return outs


# Équipe : ligne 0 Max (9 expressions), ligne 1 Alex (3), ligne 2 Hugo (4), dans le style des clients (v1.21 – v1.22).
# Ordre de l'atlas, lu par teamCell (src/portraits.js) :
#   Max  : neutre, content, stressé, blasé, oups, triste, fier, pompette, concentré
#   Alex : neutre, rigolard (il tend un shot), vexé (bras croisés)
#   Hugo : neutre bras croisés, autoritaire (montre), fier (pouce), déçu (main sur le front)
# Les planches de ChatGPT ne suivent pas toujours l'ordre demandé : on remet chaque case à sa place (numéros de lecture).
MAX_ORDER = [0, 2, 5, 7, 4, 6, 3, 8, 1]      # planche : neutre, concentré, content / fier, oups, stressé / triste, blasé, pompette
mx = place([split(key_green(SRC + 'max-expressions.png'), 3, 3)[i] for i in MAX_ORDER])
ax = place(split(key_green(SRC + 'alex-expressions.png'), 3, 1))
hx = place(split(key_green(SRC + 'hugo-expressions.png'), 2, 2))
team = Image.new('RGBA', (CW * 9, CH * 3), (0, 0, 0, 0))
for row, busts in enumerate((mx, ax, hx)):
    for i, c in enumerate(busts): team.alpha_composite(c, (i * CW, row * CH))
save(team, 'characters/team.webp')

# Max qui essuie un verre (accueil), dessiné jusqu'à la taille : on coupe le bas (caché par le comptoir)
# pour garder le format de la case d'accueil (≈ 0,78).
mf = key_green(SRC + 'max-accueil.png'); mf = mf.crop(bbox(mf, 20))
mf = mf.crop((0, 0, mf.width, min(mf.height, round(mf.width / 0.78))))
save(mf.resize((360, round(mf.height * 360 / mf.width)), Image.LANCZOS), 'characters/max-accueil.webp')

# Poses des cartons d'Alex et Hugo : recadrées sur la silhouette, 440 px de haut (nettes jusqu'à ~220 px affichés en écran ×2).
# v1.26 : Jérémie aussi, dès que sa pose est dans assets/sources/ (facultative tant que ChatGPT ne l'a pas dessinée)
for name in ('alex', 'hugo') + (('jeremie',) if os.path.exists(SRC + 'jeremie-carton.png') else ()):
    part = key_green(SRC + f'{name}-carton.png'); part = part.crop(bbox(part, 20))
    save(part.resize((round(part.width * 440 / part.height), 440), Image.LANCZOS), f'characters/card-{name}.webp')

# Néon : même recadrage pour allumé et éteint (tube + 70 px de halo), puis moitié de la taille
on = Image.open(SRC + 'neon-allume.png').convert('RGB'); off = Image.open(SRC + 'neon-eteint.png').convert('RGB')
ys, xs = np.where(np.array(on.convert('L')) > 170)
m = 70; crop = (max(0, xs.min() - m), max(0, ys.min() - m), min(on.width, xs.max() + 1 + m), min(on.height, ys.max() + 1 + m))
for name, img in (('ui/neon-on.webp', on), ('ui/neon-off.webp', off)):
    c = img.crop(crop); save(c.resize((round(c.width * 0.5), round(c.height * 0.5)), Image.LANCZOS), name, 88)

# Cloche et potence : séparées au milieu du plus grand vide entre les deux objets
cm = Image.open(SRC + 'cloche.png').convert('RGBA')
colsum = (np.array(cm.getchannel('A')) > 40).sum(0); xs = np.where(colsum > 0)[0]
best = None; run = []
for x in range(xs.min(), xs.max()):
    if colsum[x] == 0: run.append(x)
    else:
        if run and (best is None or len(run) > len(best)): best = run
        run = []
cut = (best[0] + best[-1]) // 2
bell = cm.crop((0, 0, cut, cm.height)); arm = cm.crop((cut, 0, cm.width, cm.height))
bell = bell.crop(bbox(bell, 20)); arm = arm.crop(bbox(arm, 20))
kb = 170 / arm.width
save(arm.resize((170, round(arm.height * kb)), Image.LANCZOS), 'ui/bell-arm.webp')
save(bell.resize((round(bell.width * kb), round(bell.height * kb)), Image.LANCZOS), 'ui/bell.webp')

# Rideau : tuile de trois lames (d'un joint à l'autre, embouts arrondis retirés) et barre du bas
rl = Image.open(SRC + 'rideau-lames.png').convert('RGBA'); rl = rl.crop(bbox(rl, 40))
tile = rl.crop((40, 73, rl.width - 40, 322))           # joints mesurés à 73 et 322 px (période de 83 px)
save(tile.resize((1000, round(tile.height * 1000 / tile.width)), Image.LANCZOS).convert('RGB'), 'ui/shutter-tile.webp', 86)
rb = Image.open(SRC + 'rideau-bas.png').convert('RGBA'); rb = rb.crop(bbox(rb, 40)); rb = rb.crop((40, 0, rb.width - 40, rb.height))
save(rb.resize((1000, round(rb.height * 1000 / rb.width)), Image.LANCZOS), 'ui/shutter-bar.webp', 86)

# Ticket de caisse et ardoise (utilisés en border-image : dents de 22 px, cadre de bois de 46 px)
t = Image.open(SRC + 'ticket.png').convert('RGBA'); t = t.crop(bbox(t, 20))
save(t.resize((400, round(t.height * 400 / t.width)), Image.LANCZOS), 'ui/ticket.webp', 88)
ar = Image.open(SRC + 'ardoise.png').convert('RGBA'); ar = ar.crop(bbox(ar, 20))
save(fonce_cadre(ar.resize((560, round(ar.height * 560 / ar.width)), Image.LANCZOS)), 'ui/ardoise.webp', 88)

# Craie (chope, étoile, flèche, cœur) : plus utilisée depuis la v1.45 (ardoises accrochées retirées), découpe désactivée.
if False:
  cr = np.array(Image.open(SRC + 'craie.png').convert('RGB')).astype(np.float32)
  alc = np.clip((np.minimum(cr[..., 0], cr[..., 2]) - 25) / (200 - 25), 0, 1)
  chalk = Image.fromarray(np.dstack([np.full(alc.shape, 245), np.full(alc.shape, 242), np.full(alc.shape, 232), alc * 255]).astype(np.uint8), 'RGBA')
  atlas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
  for i, c in enumerate(cells(chalk, 2, 2)):
      c = c.crop(bbox(c, 60)); s = min(120 / c.width, 120 / c.height); c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
      atlas.alpha_composite(c, ((i % 2) * 128 + (128 - c.width) // 2, (i // 2) * 128 + (128 - c.height) // 2))
  save(atlas, 'ui/chalk.webp')
print('Visuels découpés dans', OUT)
