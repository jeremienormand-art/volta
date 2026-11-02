"""Stout en 6 étapes (ChatGPT, 30 octobre 2026) → atlas 6 cases de 192 × 256, comme les boissons du jeu.
Étapes : 1 vide · 2 au tiers, beige laiteux · 3 aux deux tiers · 4 pleine, caramel trouble · 5 repos, le noir monte · 6 parfaite.
Le verre est recalé exactement sur celui de l'atlas des boissons (colonne stout) pour que tout s'aligne en jeu.
Usage, depuis la racine du dépôt :
  python3 tools/pack-stout.py assets/sources/stout-etapes.png assets/drinks/stout-steps.webp
Contrôle : test/out/stout_check.png (les 6 étapes à côté des verres vide et plein actuels)."""
import os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1:3]
rgb = np.array(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
d = g - np.maximum(r, b)
al = 1 - np.clip((d - 40) / (200 - 40), 0, 1)                 # fond vert → transparent
am = np.maximum(al, 1e-3)
F = np.clip(np.stack([r / am, (g - (1 - al) * 255) / am, b / am], -1), 0, 255)
F[..., 1] = np.minimum(F[..., 1], np.maximum(F[..., 0], F[..., 2]) + 18)   # pas de liseré vert
arr = np.dstack([F, al * 255]).astype(np.uint8); arr[al < 0.02] = 0
sheet = Image.fromarray(arr, 'RGBA')

N = 6; cw = sheet.width // N
atlas = np.array(Image.open('assets/drinks/drinks.webp').convert('RGBA'))
ref = atlas[0:256, 192:384, 3] > 128                            # verre de stout plein actuel
ys, xs = np.where(ref); tx0, ty0, tx1, ty1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

out_im = Image.new('RGBA', (192 * N, 256), (0, 0, 0, 0))
for i in range(N):
    cell = sheet.crop((i * cw, 0, (i + 1) * cw, sheet.height))
    a = np.array(cell.getchannel('A')) > 128
    ys, xs = np.where(a); bb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    glass = cell.crop(bb).resize((tx1 - tx0, ty1 - ty0), Image.LANCZOS)
    out_im.alpha_composite(glass, (i * 192 + tx0, ty0))
out_im.save(out, 'WEBP', quality=92, method=6)

os.makedirs('test/out', exist_ok=True)
chk = Image.new('RGBA', (192 * (N + 2), 256), (40, 32, 28, 255))
chk.alpha_composite(Image.fromarray(atlas[256:512, 192:384]), (0, 0))
chk.alpha_composite(Image.fromarray(atlas[0:256, 192:384]), (192, 0))
chk.alpha_composite(out_im, (384, 0))
chk.convert('RGB').save('test/out/stout_check.png')
print(out, 'verre', (tx0, ty0, tx1, ty1))
