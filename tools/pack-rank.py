"""Visuels du classement (ChatGPT, 30 octobre 2026) → atlas de 7 cases de 128 × 128.
Planche 3 × 3 sur fond vert : médailles or, argent, bronze (ligne 1) ; trophée chope dorée (ligne 2, au centre) ;
couronne et deux branches de laurier à la craie (ligne 3).
Cases de l'atlas : 0 or · 1 argent · 2 bronze · 3 trophée · 4 couronne · 5 laurier gauche · 6 laurier droit.
Usage, depuis la racine du dépôt :
  python3 tools/pack-rank.py assets/sources/classement.png assets/ui/rank-icons.webp
Contrôle : test/out/rank_icons_check.png."""
import os, sys
import numpy as np
from PIL import Image, ImageOps

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

G = sheet.width // 3
CASES = [(0, 0), (1, 0), (2, 0), (1, 1), (0, 2), (1, 2), (2, 2)]   # (colonne, ligne)
C, PAD = 128, 4


def item(col, row):
    cell = sheet.crop((col * G, row * G, (col + 1) * G, (row + 1) * G))
    a = np.array(cell.getchannel('A')) > 60
    ys, xs = np.where(a)
    return cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


items = [item(c, r) for c, r in CASES]
# Les deux lauriers doivent se faire face : la branche gauche s'ouvre vers la droite.
def leans_right(im):  # feuilles plutôt à droite de la tige ?
    a = np.array(im.getchannel('A')) > 60; ys, xs = np.where(a); return xs.mean() > im.width / 2
L, R = items[5], items[6]
if leans_right(L) == leans_right(R): R = ImageOps.mirror(L)
if not leans_right(L): L, R = R, L
items[5], items[6] = L, R

atlas = Image.new('RGBA', (C * len(items), C), (0, 0, 0, 0))
for i, im in enumerate(items):
    s = (C - 2 * PAD) / max(im.width, im.height)
    im2 = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    atlas.alpha_composite(im2, (i * C + (C - im2.width) // 2, (C - im2.height) // 2))
atlas.save(out, 'WEBP', quality=92, method=6)

os.makedirs('test/out', exist_ok=True)
chk = Image.new('RGBA', (atlas.width, C * 2 + 60), (42, 49, 46, 255))
chk.alpha_composite(atlas, (0, 0))
small = Image.new('RGBA', (atlas.width, 60), (244, 238, 223, 255))   # à taille réelle : 24 px, sur le ticket
for i in range(len(items)):
    small.alpha_composite(atlas.crop((i * C, 0, (i + 1) * C, C)).resize((24, 24), Image.LANCZOS), (i * C + 52, 18))
chk.alpha_composite(small, (0, C + 30))
chk.convert('RGB').save('test/out/rank_icons_check.png')
print(out, len(items), 'cases')
