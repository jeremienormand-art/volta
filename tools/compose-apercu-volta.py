"""Illustration d'aperçu des liens de Volta (3 novembre 2026), composée à partir des visuels du jeu, sans ChatGPT :
la salle de Volta (assets/sources/salle-profonde.png) en paysage, Michel, Marie, Etienne et Fabien derrière le comptoir sombre.
Usage : python3 tools/compose-apercu-volta.py → assets/sources/apercu.png (1536 × 1024), puis python3 tools/pack-apercu.py."""
import numpy as np
from PIL import Image, ImageFilter, ImageOps
W, H, TOP = 1536, 1024, 770          # TOP : haut du comptoir
salle = Image.open('assets/sources/salle-profonde.png').convert('RGB')
sw, sh = salle.size; ch = round(sw * H / W); y0 = 330
fond = salle.crop((0, y0, sw, y0 + ch)).resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.2))
fond = Image.fromarray((np.array(fond).astype(np.float32) * 0.72).astype(np.uint8)).convert('RGBA')

def pose(path, h, cx, flip=False, dim=1.0):
    im = Image.open(path).convert('RGBA')
    if flip: im = ImageOps.mirror(im)
    im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    if dim < 1:
        a = np.array(im).astype(np.float32); a[..., :3] *= dim; im = Image.fromarray(a.astype(np.uint8))
    fond.alpha_composite(im, (round(cx - im.width / 2), TOP + 150 - h))

pose('assets/characters/card-jeremie.webp', 560, 560, dim=0.9)            # Marie, en retrait
pose('assets/characters/card-alex.webp', 640, 270)                         # Michel et sa blague
pose('assets/characters/card-hugo.webp', 640, 1270, flip=True)             # Fabien et sa montre, tourné vers le centre
pose('assets/characters/max-accueil.webp', 700, 840)                       # Etienne au centre

bois = Image.open('assets/ui/service-wood.webp').convert('RGBA')
bois = bois.resize((W, round(bois.height * W / bois.width)), Image.LANCZOS)
for y in range(TOP, H, bois.height): fond.alpha_composite(bois, (0, y))
px = np.array(fond); px[TOP:TOP + 14, :, :3] = (0xB9, 0x80, 0x3F); px[TOP:TOP + 4, :, :3] = (0xE2, 0xAE, 0x62); px[TOP + 14:TOP + 18, :, :3] = (0x2A, 0x20, 0x1B)
Image.fromarray(px).convert('RGB').save('assets/sources/apercu.png')
print('assets/sources/apercu.png', W, 'x', H)
