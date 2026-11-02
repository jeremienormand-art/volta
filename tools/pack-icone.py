# Icône du jeu (v1.31) : Max fier (atlas de l'équipe, dessin de ChatGPT) sur le rose du néon « C'est ouvert ».
# python3 tools/pack-icone.py → dist/icone-512.png, icone-192.png, icone-180.png (raccourci iPhone), favicon-32.png,
# icone-masquable-192.png et -512.png (Android, v1.33), et dist/manifest.webmanifest.
# Contrôle : test/out/icone_check.png (arrondie comme sur un iPhone, ronde et en goutte comme sur Android).
# Aucun dessin en code : on recadre la case « fier » de Max (colonne 6, ligne 0 de team.webp) et on la pose sur un aplat.
import json, pathlib
from PIL import Image, ImageDraw

root = pathlib.Path(__file__).resolve().parent.parent
dist, out = root / 'dist', root / 'test' / 'out'
out.mkdir(parents=True, exist_ok=True)
FOND = '#F39BB1'   # rose du jeu (C.rose)
NUIT = '#241C19'   # fond du jeu (C.nuit)

team = Image.open(root / 'assets' / 'characters' / 'team.webp').convert('RGBA')
cw, ch = team.width // 9, team.height // 3
case = team.crop((6 * cw, 0, 7 * cw, ch))                    # Max, expression « fier »
buste = case.crop((0, 0, cw, round(ch * 196 / 240)))          # tête et épaules, le bas coupé par le bord

def icone(taille, k=0.86):
    im = Image.new('RGBA', (taille, taille), FOND)
    w = round(taille * k); h = round(buste.height * w / buste.width)
    im.alpha_composite(buste.resize((w, h), Image.LANCZOS), ((taille - w) // 2, taille - h))   # posé sur le bord bas
    return im.convert('RGB')

# Android (v1.33) : sans icône « masquable », Chrome réduit l'icône dans un rond blanc. Version masquable : le rose
# remplit toute l'image (Android la découpe en rond, en goutte ou en carré arrondi) et la tête de Max tient dans le
# cercle central de 80 % que tous les masques gardent ; les épaules descendent jusqu'au bord bas.
def masquable(taille, k=0.72):
    im = Image.new('RGBA', (taille, taille), FOND)
    w = round(taille * k); h = round(case.height * w / case.width)
    im.alpha_composite(case.resize((w, h), Image.LANCZOS), ((taille - w) // 2, taille - h))
    return im.convert('RGB')

for taille in (192, 512):
    masquable(taille).save(dist / f'icone-masquable-{taille}.png', optimize=True)

for taille, nom in [(512, 'icone-512.png'), (192, 'icone-192.png'), (180, 'icone-180.png'), (32, 'favicon-32.png')]:
    icone(taille).save(dist / nom, optimize=True)

# Raccourci sur l'écran d'accueil : le jeu s'ouvre dans le navigateur (display « browser »), pas en appli à part.
# Sur iPhone, une appli à part aurait sa propre mémoire : le joueur y perdrait son nom au classement (clé du téléphone).
(dist / 'manifest.webmanifest').write_text(json.dumps({
    'name': 'Galopins Arcade', 'short_name': 'Galopins', 'lang': 'fr',
    'description': 'Tu es Max derrière le comptoir de Galopins. Deux minutes de service : tu fais mieux ?',
    'start_url': './', 'display': 'browser', 'orientation': 'portrait',
    'background_color': NUIT, 'theme_color': NUIT,
    'icons': [{'src': 'icone-192.png', 'sizes': '192x192', 'type': 'image/png'},
              {'src': 'icone-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
              {'src': 'icone-masquable-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'maskable'},
              {'src': 'icone-masquable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Contrôle : en haut, les tailles côte à côte arrondies comme sur un iPhone ; en bas, la version Android
# découpée en rond, en goutte et en carré arrondi, puis entière avec le cercle sûr de 80 %.
planche = Image.new('RGB', (4 * 256 + 50, 532 + 276), '#FFFFFF')
x = 10
for taille in (512, 192, 180, 32):
    im = icone(taille)
    m = Image.new('L', (taille, taille), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, taille - 1, taille - 1), round(taille * 0.225), fill=255)
    planche.paste(im, (x, 10), m); x += taille + 20
im = masquable(256)
for i, forme in enumerate(('rond', 'goutte', 'carre', 'entier')):
    m = Image.new('L', (256, 256), 0); d = ImageDraw.Draw(m)
    if forme == 'rond': d.ellipse((0, 0, 255, 255), fill=255)
    elif forme == 'goutte': d.rounded_rectangle((0, 0, 255, 255), 110, corners=(True, True, False, True), fill=255)
    elif forme == 'carre': d.rounded_rectangle((0, 0, 255, 255), 58, fill=255)
    else: d.rectangle((0, 0, 255, 255), fill=255)
    planche.paste(im, (10 + i * 266, 542), m)
ImageDraw.Draw(planche).ellipse((10 + 3 * 266 + 26, 542 + 26, 10 + 3 * 266 + 230, 542 + 230), outline='#FFFFFF', width=2)
planche.save(out / 'icone_check.png')
print('dist/icone-512.png, icone-192.png, icone-180.png, favicon-32.png, icone-masquable-192.png, icone-masquable-512.png, manifest.webmanifest')
