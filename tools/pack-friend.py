"""Planche d'un ami (4 expressions sur une ligne : neutre, content, agacé, furieux) → bande de client 192 × 224 × 4.
Fond vert #00FF00 ou transparent. Les bustes peuvent se toucher : on coupe au creux le plus proche de chaque quart.
Usage, depuis la racine du dépôt : python3 tools/pack-friend.py assets/sources/roxane.png assets/characters/roxane.webp
v1.26 : nombre d'expressions en 3e argument (Jérémie : 5, neutre, goûte, approuve, grimace, pompette) :
  python3 tools/pack-friend.py assets/sources/jeremie.png assets/characters/jeremie.webp 5 0,0,0,-26,0
(4e argument facultatif : décalage horizontal de chaque case en pixels de la case 192, ici pour garder la pinte de la grimace dans le cadre)
Contrôle : test/out/friend_check.png montre l'ami à côté des clients existants, à taille égale.
Puis dans src/portraits.js : ajouter l'image et l'entrée FRIENDS ; dans src/config.js : LOOKS + 2 ; dans build.mjs : la marque."""
import os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1:3]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 4
DX = [int(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 else [0] * N
im = Image.open(src)
rgb = np.array(im.convert('RGB')).astype(np.float32)
corner = rgb[4, 4]
if im.mode != 'RGBA' or (corner[1] > 200 and corner[0] < 90 and corner[2] < 90):   # fond vert : détourage
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = g - np.maximum(r, b)
    al = 1 - np.clip((d - 40) / (200 - 40), 0, 1)
    am = np.maximum(al, 1e-3)
    F = np.clip(np.stack([r / am, (g - (1 - al) * 255) / am, b / am], -1), 0, 255)
    F[..., 1] = np.minimum(F[..., 1], np.maximum(F[..., 0], F[..., 2]) + 18)
    arr = np.dstack([F, al * 255]).astype(np.uint8); arr[al < 0.02] = 0
    im = Image.fromarray(arr, 'RGBA')
else:
    im = im.convert('RGBA')
colsum = (np.array(im.getchannel('A')) > 128).sum(0)
runs = []; start = None
for x, v in enumerate(list(colsum > 5) + [False]):
    if v and start is None: start = x
    if not v and start is not None: runs.append((start, x)); start = None
runs = [r for r in runs if r[1] - r[0] > 100]
if len(runs) == N:
    cuts = [(max(0, a - 2), min(im.width, b + 2)) for a, b in runs]
else:
    W = im.width; v = [0]
    for k in range(1, N):
        c = int(k * W / N); lo, hi = c - 90, c + 90
        v.append(lo + int(np.argmin(colsum[lo:hi])))
    v.append(W); cuts = list(zip(v[:-1], v[1:]))


def bbox(im, th=128, minrow=20):
    a = np.array(im.getchannel('A')) > th; rc = a.sum(1) > minrow
    best = (0, 0); start = None
    for y, v in enumerate(list(rc) + [False]):
        if v and start is None: start = y
        if not v and start is not None:
            if y - start > best[1] - best[0]: best = (start, y)
            start = None
    y0, y1 = best; xs = np.where(a[y0:y1].any(0))[0]
    return xs.min(), y0, xs.max() + 1, y1


def head_cx(im, bb, frac=0.35):
    a = np.array(im.getchannel('A')) > 128; x0, y0, x1, y1 = bb; yh = y0 + int((y1 - y0) * frac)
    ys, xs = np.where(a[y0:yh, x0:x1]); return x0 + xs.mean()


cells = [im.crop((a, 0, b, im.height)) for a, b in cuts]
CW, CH = 192, 224   # double des cases clients 96 × 112
bbs = [bbox(c) for c in cells]; x0, y0, x1, y1 = bbs[0]
s = (CH - 6) / (y1 - y0)
strip = Image.new('RGBA', (CW, CH * N), (0, 0, 0, 0))
for i, (c, bb) in enumerate(zip(cells, bbs)):
    sc = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    cell.paste(sc, (round(CW / 2 - head_cx(c, bb) * s) + DX[i], round(CH + 2 - bb[3] * s)), sc)
    strip.alpha_composite(cell, (0, i * CH))
strip.save(out, 'WEBP', quality=90, method=6)
os.makedirs('test/out', exist_ok=True)
cust = Image.open('assets/characters/customers.webp').convert('RGBA')
cw, ch = cust.width // 4, cust.height // 3
S = Image.new('RGBA', (298 * 5, 336 * max(4, N)), (40, 32, 28, 255))
for r in range(3):
    for c in range(4): S.alpha_composite(cust.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)).resize((288, 336), Image.NEAREST), (c * 298, r * 336))
for r in range(N): S.alpha_composite(strip.crop((0, r * CH, CW, (r + 1) * CH)).resize((288, 336), Image.LANCZOS), (4 * 298, r * 336))
S.convert('RGB').save('test/out/friend_check.png')
print(out, 'coupes', cuts, 'échelle', round(s, 3))
