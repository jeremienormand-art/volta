# Image d'aperçu des liens partagés (v1.24) : python3 tools/pack-apercu.py [haut]
# Source : assets/sources/apercu.png (illustration de ChatGPT, paysage 3:2, sans texte).
# Recadre en 1200 × 630 (toute la largeur ; « haut » = première ligne gardée, en fraction de la hauteur,
# 0,107 par défaut : garde l'enseigne, la pinte entière et le comptoir), puis pose sur le comptoir le titre
# et le défi avec la police du jeu (Jersey 10), rendus par Chromium pour avoir le même dessin qu'en jeu.
# Sorties : dist/apercu.jpg (servie par Cloudflare, déclarée en og:image) et test/out/apercu_check.png.
import sys, os, io, base64
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'sources', 'apercu.png')
OUT = os.path.join(ROOT, 'dist', 'apercu.jpg')
CHECK = os.path.join(ROOT, 'test', 'out', 'apercu_check.png')
W, H = 1200, 630
haut = float(sys.argv[1].replace(',', '.')) if len(sys.argv) > 1 else 0.107

im = Image.open(SRC).convert('RGB')
sw, sh = im.size
ch = round(sw * H / W)
y0 = max(0, min(sh - ch, round(sh * haut)))
fond = im.crop((0, y0, sw, y0 + ch)).resize((W, H), Image.LANCZOS)
buf = io.BytesIO(); fond.save(buf, 'PNG')
fond64 = base64.b64encode(buf.getvalue()).decode()
font64 = base64.b64encode(open(os.path.join(ROOT, 'assets', 'fonts', 'jersey-10.woff2'), 'rb').read()).decode()

page = f"""<!doctype html><meta charset="utf-8"><style>
@font-face {{ font-family: 'Jersey 10'; src: url(data:font/woff2;base64,{font64}) format('woff2'); }}
html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; }}
body {{ position: relative; background: url(data:image/png;base64,{fond64}) 0 0 / {W}px {H}px no-repeat; font-family: 'Jersey 10', sans-serif; }}
/* Bandeau sombre en bas : le comptoir reste visible, le texte se lit en tout petit */
body::after {{ content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 120px; background: linear-gradient(rgba(20,12,8,0), rgba(20,12,8,0.55) 55%, rgba(20,12,8,0.7)); }}
.t {{ position: absolute; z-index: 1; bottom: 18px; margin: 0; line-height: 0.8; text-transform: uppercase; white-space: nowrap; }}
/* Même dessin que « ARCADE » sur l'accueil du jeu */
.logo {{ left: 34px; font-size: 66px; letter-spacing: 0.03em; color: #F7EBD5; text-shadow: 0 3px 0 #9A5426, 0 6px 0 #3A2414, 0 8px 18px rgba(0,0,0,0.7); }}
/* Le défi en néon rose, comme l'enseigne « C'est ouvert » */
.defi {{ right: 34px; font-size: 66px; letter-spacing: 0.04em; color: #FFE3EA; text-shadow: 0 0 2px #F39BB1, 0 0 10px #F39BB1, 0 0 22px rgba(243,155,177,0.8), 0 4px 0 #4A2230; }}
</style>
<p class="t logo">Galopins Arcade</p>
<p class="t defi">Tu me bats ?</p>"""

os.makedirs(os.path.dirname(CHECK), exist_ok=True)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page(viewport={'width': W, 'height': H})
    p.set_content(page); p.evaluate("document.fonts.ready"); p.wait_for_timeout(200)
    png = p.screenshot()
    b.close()
img = Image.open(io.BytesIO(png)).convert('RGB')
img.save(CHECK)
img.save(OUT, 'JPEG', quality=86, optimize=True, progressive=True)
print(f'{OUT} : {W} × {H}, {os.path.getsize(OUT) // 1024} Ko (source {sw} × {sh}, recadrée à partir de la ligne {y0})')
