"""Volta (6 novembre 2026) : le trophée du classement (case 3 de assets/ui/rank-icons.webp, bouton « Top 10 » de l'accueil)
était une chope de bière. On garde son socle et on pose dessus la tasse de chocolat pleine de l'atlas des boissons, teintée or.
À relancer après tools/pack-rank.py.  Usage : python3 tools/pack-trophee-volta.py"""
import numpy as np
from PIL import Image
atlas = Image.open('assets/ui/rank-icons.webp').convert('RGBA')
cell = np.array(atlas.crop((3 * 128, 0, 4 * 128, 128)))
al = cell[..., 3] > 40
rows = np.where(al.any(1))[0]
base_top = 80   # pied doré et plinthe : rangées 80 à 124 de la case (mesuré sur la chope de Galopins)
new = np.zeros_like(cell); new[base_top:] = cell[base_top:]
mug = Image.open('assets/drinks/drinks.webp').convert('RGBA').crop((0, 0, 192, 256))
bb = mug.getbbox(); mug = mug.crop(bb)
a = np.array(mug).astype(np.float32)
lum = (a[..., :3] @ np.array([0.3, 0.55, 0.15]))[..., None] / 255
gold = np.clip(np.array([70, 40, 8]) + lum * np.array([215, 175, 70]) * 1.15, 0, 255)
a[..., :3] = a[..., :3] * 0.35 + gold * 0.65
mug = Image.fromarray(a.astype(np.uint8))
h = base_top - 2; w = round(mug.width * h / mug.height)
if w > 118: w, h = 118, round(mug.height * 118 / mug.width)
mug = mug.resize((w, h), Image.LANCZOS)
out = Image.fromarray(new); out.alpha_composite(mug, ((128 - w) // 2 + 6, base_top + 3 - h))
atlas.paste(out, (3 * 128, 0)); atlas.save('assets/ui/rank-icons.webp', 'WEBP', quality=90, method=6)
print('trophée : socle à partir de la rangée', base_top, '· tasse', w, 'x', h)
