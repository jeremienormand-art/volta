"""Comptoir de Volta (3 novembre 2026, choisi par Jérémie et Anaïs : « c'est mieux sombre ») : plan de travail sombre,
rebord en bois clair (couleurs du rebord dans src/render.js, src/style.css et src/story.js).
Part du bois de Galopins (assets/sources/comptoir-bois.webp) : moins saturé, assombri, légèrement chaud.
Usage, depuis la racine du dépôt :
  python3 tools/pack-comptoir.py   → assets/ui/service-wood.webp"""
import numpy as np
from PIL import Image
a = np.array(Image.open('assets/sources/comptoir-bois.webp').convert('RGB')).astype(np.float32)
lum = a.mean(-1, keepdims=True)
dark = (a * 0.35 + lum * 0.65) * 0.42 + np.array([6, 3, 0])
Image.fromarray(np.clip(dark, 0, 255).astype(np.uint8)).save('assets/ui/service-wood.webp', 'WEBP', quality=90)
print('assets/ui/service-wood.webp')
