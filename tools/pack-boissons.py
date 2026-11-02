"""Boissons de Volta (ChatGPT, 2 novembre 2026) → atlas du jeu, 4 colonnes × 2 lignes de 192 × 256.
Planche source : 4 objets par ligne, ligne du haut vide, ligne du bas pleine, fond vert.
Colonnes du jeu (ordre des identifiants) : ipa = chocolat, stout = matcha, spritz = expresso, shot = croissant.
Atlas : ligne 0 = plein, ligne 1 = vide (comme l'atlas de Galopins), objets posés sur y = 176, une seule échelle pour tous
(la plus haute boisson fait 128 px, comme l'ancienne pinte). Le verre en verre garde sa transparence (fond vert → alpha, sans liseré vert).
Usage, depuis la racine du dépôt :
  python3 tools/pack-boissons.py assets/sources/boissons-volta.png assets/drinks/drinks.webp
Affiche les repères du chocolat (niveau du liquide) à reporter dans `src/render.js` (CHOCO).
Contrôle : test/out/boissons_check.png."""
import os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1:3]
rgb = np.array(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
d = g - np.maximum(r, b)
al = 1 - np.clip((d - 40) / (200 - 40), 0, 1)
am = np.maximum(al, 1e-3)
F = np.clip(np.stack([r / am, (g - (1 - al) * 255) / am, b / am], -1), 0, 255)
F[..., 1] = np.minimum(F[..., 1], np.maximum(F[..., 0], F[..., 2]) + 18)
arr = np.dstack([F, al * 255]).astype(np.uint8); arr[al < 0.02] = 0
sheet = Image.fromarray(arr, 'RGBA')
A = arr[..., 3] > 128

def runs(v, gap=12, minlen=12):
    idx = np.where(v)[0]; res = []; s = p = None
    for i in idx:
        if s is None: s = p = i
        elif i - p > gap: res.append((s, p + 1)); s = p = i
        else: p = i
    if s is not None: res.append((s, p + 1))
    return [x for x in res if x[1] - x[0] >= minlen]

bands = runs(A.any(1))
assert len(bands) == 2, bands
objs = []   # objs[ligne source][colonne] = boîte
for y0, y1 in bands:
    cols = runs(A[y0:y1].any(0))
    assert len(cols) == 4, cols
    row = []
    for x0, x1 in cols:
        m = A[y0:y1, x0:x1]; ys = np.where(m.any(1))[0]
        row.append((x0, y0 + ys.min(), x1, y0 + ys.max() + 1))
    objs.append(row)

tallest = max(bb[3] - bb[1] for row in objs for bb in row)
k = 128 / tallest
atlas = Image.new('RGBA', (192 * 4, 256 * 2), (0, 0, 0, 0))
for src_row, dst_row in ((1, 0), (0, 1)):            # source : bas = plein → atlas ligne 0 ; haut = vide → ligne 1
    for c, (x0, y0, x1, y1) in enumerate(objs[src_row]):
        im = sheet.crop((x0, y0, x1, y1))
        w, h = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
        im = im.resize((w, h), Image.LANCZOS)
        atlas.alpha_composite(im, (c * 192 + (192 - w) // 2, dst_row * 256 + 176 - h))
atlas.save(out, 'WEBP', lossless=True, method=6)

# Repères du chocolat (colonne 0, plein) : haut et bas du liquide, demi-largeur en haut, en unités du jeu (case / 4, y = 0 au pied)
P = np.array(atlas)[0:256, 0:192].astype(int)
brown = (P[..., 3] > 200) & (P[..., 0] > P[..., 1] + 25) & (P[..., 1] > P[..., 2]) & (P[..., 0] < 200)
ys = np.where(brown.sum(1) > 6)[0]
top, base = ys.min(), ys.max()
xs = np.where(brown[top + 3])[0]
cx = (xs.min() + xs.max()) / 2
print(out, 'échelle', round(k, 3))
print("CHOCO = { top: %.1f, base: %.1f, rx: %.1f, cx: %.1f }" % (top / 4 - 44, base / 4 - 44, (xs.max() - xs.min()) / 8, cx / 4 - 24))

os.makedirs('test/out', exist_ok=True)
chk = Image.new('RGBA', atlas.size, (60, 42, 30, 255)); chk.alpha_composite(atlas)
chk.convert('RGB').save('test/out/boissons_check.png')
