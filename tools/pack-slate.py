# Ardoise des stations, du bandeau de Max et des menus (v1.46) : python3 tools/pack-slate.py [style] [sortie]
# Part du grain peint de l'ardoise d'origine (assets/sources/ardoise-stations.png, la station-slate.webp de ChatGPT)
# et du bois du comptoir (assets/ui/service-wood.webp), sans rien dessiner de figuratif :
#   encastree : l'ardoise est enfoncée dans le comptoir (coins arrondis, bord haut dans l'ombre, arête sombre tout autour)
#   cadre     : fin cadre taillé dans le bois du comptoir, biseauté, puis l'ardoise enfoncée dedans
# Même format que l'ancienne (180 × 330, coins dans les 28 px que découpent les menus) ; transparence aux coins.
import sys, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLE = sys.argv[1] if len(sys.argv) > 1 else 'cadre'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'assets', 'ui', 'station-slate.webp')
W, H = 180, 330

src = Image.open(os.path.join(ROOT, 'assets', 'sources', 'ardoise-stations.png')).convert('RGB')
# Grain de l'ardoise sans son liseré gris d'origine (3 px de bord retirés), étiré à la taille finale
slate = np.asarray(src.crop((5, 5, src.width - 5, src.height - 5)).resize((W, H), Image.LANCZOS)).astype(np.float32)
wood = Image.open(os.path.join(ROOT, 'assets', 'ui', 'service-wood.webp')).convert('RGB')

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

def rounded_mask(inset, r):
    """Masque d'un rectangle arrondi (anticrénelé), à `inset` px du bord, rayon r."""
    x0, y0, x1, y1 = inset, inset, W - inset, H - inset
    cx = np.clip(xx + 0.5, x0 + r, x1 - r); cy = np.clip(yy + 0.5, y0 + r, y1 - r)
    d = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
    inside = (xx + 0.5 >= x0) & (xx + 0.5 <= x1) & (yy + 0.5 >= y0) & (yy + 0.5 <= y1)
    return np.clip(r + 0.5 - d, 0, 1) * inside

def edge_dist(inset):
    """Distance au bord du rectangle intérieur, par côté (haut, bas, gauche, droite)."""
    return yy - inset, (H - 1 - inset) - yy, xx - inset, (W - 1 - inset) - xx

def recess(img, inset, depth):
    """Ardoise enfoncée : ombre portée par le bord haut (lumière d'en haut), côtés et bas un peu sombres."""
    t, b, l, r = edge_dist(inset)
    k = np.ones((H, W), np.float32)
    k *= 1 - 0.78 * np.clip(1 - t / depth, 0, 1) ** 1.4          # bord haut dans l'ombre
    k *= 1 - 0.5 * np.clip(1 - l / (depth * 0.6), 0, 1) ** 1.4   # côtés
    k *= 1 - 0.5 * np.clip(1 - r / (depth * 0.6), 0, 1) ** 1.4
    out = img * k[..., None]
    # v1.47 : plus de reflet clair en bas (Jérémie le voyait comme un liseré blanc) ; le bas est juste un peu assombri
    out = out * (1 - 0.3 * np.clip(1 - b / (depth * 0.35), 0, 1) ** 1.4)[..., None]
    rim = np.clip(1 - np.abs(np.minimum(np.minimum(t, b), np.minimum(l, r)) - 0.5) / 1.2, 0, 1)  # arête sombre tout autour
    out = out * (1 - 0.6 * rim[..., None])
    return out

def wood_frame(f):
    """Cadre en bois du comptoir, f px d'épaisseur, coupes d'onglet, biseau éclairé d'en haut à gauche."""
    wd = np.asarray(wood).astype(np.float32)
    strip_h = wd[40:40 + f * 3:3, 30:30 + max(W, H) * 2:2]       # bande de fil horizontal
    strip_h = np.asarray(Image.fromarray(strip_h.astype(np.uint8)).resize((max(W, H), f), Image.LANCZOS)).astype(np.float32)
    strip_v = np.transpose(strip_h, (1, 0, 2))
    frame = np.zeros((H, W, 3), np.float32)
    top = yy < f; bot = yy >= H - f; lef = xx < f; rig = xx >= W - f
    # onglets : chaque pixel appartient au côté dont il est le plus proche
    dt, db, dl, dr = yy, H - 1 - yy, xx, W - 1 - xx
    m = np.minimum(np.minimum(dt, db), np.minimum(dl, dr))
    for side, sel in (('t', (dt == m) & top), ('b', (db == m) & bot & ~((dt == m) & top)),
                      ('l', (dl == m) & lef), ('r', (dr == m) & rig)):
        if side in 'tb':
            rows = (yy[sel] if side == 't' else (H - 1 - yy[sel])).astype(int)
            frame[sel] = strip_h[np.clip(rows, 0, f - 1), xx[sel].astype(int)]
        else:
            cols = (xx[sel] if side == 'l' else (W - 1 - xx[sel])).astype(int)
            frame[sel] = strip_v[yy[sel].astype(int) % strip_v.shape[0], np.clip(cols, 0, f - 1)]
    # biseau : face haute et gauche éclairées, basse et droite dans l'ombre, arête extérieure foncée
    k = np.ones((H, W), np.float32)
    k = np.where((dt == m) & top, 1.18, k); k = np.where((dl == m) & lef, 1.08, k)
    k = np.where((db == m) & bot, 0.72, k); k = np.where((dr == m) & rig, 0.82, k)
    frame *= k[..., None] * 0.9
    frame = frame * (1 - 0.15) + np.array([80, 50, 30], np.float32) * 0.15   # même ton que le comptoir assombri
    outer = np.clip(m / 1.2, 0, 1)                              # arête extérieure sombre (1 px)
    frame = frame * (0.45 + 0.55 * outer[..., None])
    hl = np.clip(1 - np.abs(m - 1.5) / 1.0, 0, 1) * ((dt == m) | (dl == m))  # filet clair sur l'arête haute
    frame = frame * (1 - 0.25 * hl[..., None]) + np.array([214, 168, 108], np.float32) * 0.25 * hl[..., None]
    return frame

if STYLE == 'encastree':
    img = recess(slate, 0, 14)
    alpha = rounded_mask(0, 10)
elif STYLE == 'cadre':
    F = 13
    inner = rounded_mask(F, 5)
    img = wood_frame(F) * (1 - inner[..., None]) + recess(slate, F, 12) * inner[..., None]
    # joint sombre entre le bois et l'ardoise
    t, b, l, r = edge_dist(F)
    joint = np.clip(1 - np.minimum(np.minimum(t, b), np.minimum(l, r)) / 1.5, 0, 1) * inner
    img = img * (1 - 0.6 * joint[..., None])
    alpha = rounded_mask(0, 7)
else:
    raise SystemExit('style inconnu : encastree ou cadre')

rgba = np.dstack([np.clip(img, 0, 255), alpha * 255]).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(OUT, 'WEBP', quality=92, method=6)
print(STYLE, '→', OUT, os.path.getsize(OUT) // 1024, 'Ko')
