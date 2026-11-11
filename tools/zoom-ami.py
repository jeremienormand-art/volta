"""v1.17 (Volta) : grossit une bande d'ami déjà au format client (cases de 96 × 112) autour du bas de chaque case.
Pour Anaïs, dessinée avec les clients de base de Galopins, plus petite que les autres amis (visage ~75 px contre ~92) :
  python3 tools/zoom-ami.py assets/sources/anais.webp assets/characters/anais.webp 1.14 3
(source : la bande d'origine, gardée telle quelle ; dernier argument : nombre d'expressions)."""
import sys
from PIL import Image
src, out, k, n = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGBA'); CW, CH = 96, 112
strip = Image.new('RGBA', (CW, CH * n), (0, 0, 0, 0))
for i in range(n):
    big = im.crop((0, i * CH, CW, (i + 1) * CH)).resize((round(CW * k), round(CH * k)), Image.LANCZOS)
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); cell.paste(big, (round((CW - big.width) / 2), CH - big.height), big)
    strip.alpha_composite(cell, (0, i * CH))
strip.save(out, 'WEBP', lossless=True, method=6)
print(out, strip.size)
