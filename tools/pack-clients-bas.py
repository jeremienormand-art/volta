# v1.61 : prolonge le buste des clients de base jusqu'au bas de leur case (assets/characters/customers.webp, 4 × 3 cases de 96 × 112).
# Les dessins s'arrêtaient 3 à 12 px au-dessus du bas : au comptoir, trois clients sur quatre « flottaient » (contour du bas visible),
# alors que les amis, dessinés jusqu'en bas, passent derrière le comptoir. On recopie la dernière ligne du vêtement (celle au-dessus
# du contour) jusqu'au bas de la case : les têtes ne bougent pas, personne ne change de taille. Peut être relancé sans effet.
# python3 tools/pack-clients-bas.py   → réécrit l'atlas (sans perte) et une planche de contrôle test/out/clients_bas_check.png
import pathlib
from PIL import Image
import numpy as np
root = pathlib.Path(__file__).resolve().parent.parent
path = root / 'assets' / 'characters' / 'customers.webp'
CW, CH = 96, 112
src = Image.open(path).convert('RGBA'); a = np.array(src); avant = src.copy()
for r in range(a.shape[0] // CH):
    for c in range(a.shape[1] // CW):
        cell = a[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW]          # vue : on écrit dans l'atlas
        larges = [y for y in range(CH) if (cell[y, :, 3] > 40).sum() > 40]
        bas = max(larges)                                           # dernière ligne large : le contour du bas du buste
        if bas >= CH - 1: continue
        ligne = cell[bas - 1].copy()                                # la ligne du vêtement, juste au-dessus du contour
        cell[bas:CH] = ligne
        print(f'case {r},{c} : buste prolongé de {CH - bas} px')
Image.fromarray(a).save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
out = root / 'test' / 'out'; out.mkdir(parents=True, exist_ok=True)
apres = Image.open(path).convert('RGBA')
planche = Image.new('RGBA', (src.width * 2 + 16, src.height), (60, 40, 30, 255))
planche.alpha_composite(avant, (0, 0)); planche.alpha_composite(apres, (src.width + 16, 0))
planche.resize((planche.width * 2, planche.height * 2), Image.NEAREST).save(out / 'clients_bas_check.png')
