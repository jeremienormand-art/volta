# v1.60 : écran d'attente du chargement, écran « Tourne ton téléphone », zones de toucher son/pause. Captures v160_* dans test/out/.
# python3 test/v160.py [largeur hauteur]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
(out / 'page.html').write_text((root / 'dist' / 'galopins-arcade.html').read_text())
W = int(sys.argv[1]) if len(sys.argv) > 1 else 375
H = int(sys.argv[2]) if len(sys.argv) > 2 else 667
url = (out / 'page.html').as_uri(); fails = []; errors = []
def ok(cond, label):
    print(('ok    ' if cond else 'ÉCHEC ') + label)
    if not cond: fails.append(label)
with sync_playwright() as p:
    b = p.chromium.launch()
    # Pendant le chargement, le code du jeu n'est pas encore là : on le simule en coupant JavaScript.
    c = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, java_script_enabled=False)
    pg = c.new_page(); pg.goto(url); pg.wait_for_timeout(500)
    ok(pg.locator('#boot .boot-t').is_visible(), 'écran d’attente visible avant le code du jeu')
    pg.screenshot(path=str(out / f'v160_attente_{W}.png')); c.close()
    c = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = c.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(1200)
    ok(pg.evaluate("!document.getElementById('boot')"), 'écran d’attente retiré une fois le jeu prêt')
    ok(pg.evaluate("document.getElementById('rot').hidden"), 'pas d’écran « tourne » en portrait')
    pg.evaluate("localStorage.setItem('ga1.cfg2', JSON.stringify({hints:false}))"); pg.reload(); pg.wait_for_timeout(700)
    pg.click('#bStart'); pg.wait_for_timeout(2500)
    box = pg.locator('#bPause').bounding_box(); s = pg.evaluate("parseFloat(document.getElementById('frame').style.getPropertyValue('--s'))")
    ok(box['width'] >= 44 * s - 0.5 and box['height'] >= 44 * s - 0.5, f"zone de toucher de la pause : {box['width']:.0f} × {box['height']:.0f} px")
    pg.set_viewport_size({'width': H, 'height': W}); pg.wait_for_timeout(500)
    ok(pg.evaluate("!document.getElementById('rot').hidden"), 'téléphone couché : « Tourne ton téléphone »')
    ok(pg.evaluate("!document.getElementById('sPause').hidden"), 'la partie est mise en pause')
    pg.screenshot(path=str(out / f'v160_couche_{W}.png'))
    pg.set_viewport_size({'width': W, 'height': H}); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.getElementById('rot').hidden"), 'retour en portrait : l’écran disparaît, la pause reste')
    # Clavier ouvert en portrait (la page devient plus large que haute) : pas d'écran « tourne »
    pg.set_viewport_size({'width': W, 'height': 300}); pg.wait_for_timeout(300)
    pg.evaluate("Object.defineProperty(screen.orientation, 'type', {get: () => 'portrait-primary'}); window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.getElementById('rot').hidden"), 'clavier ouvert en portrait : pas d’écran « tourne »')
    b.close()
print('\n'.join(errors) or 'aucune erreur')
print(f'RÉSULTAT : {len(fails)} échec(s)')
sys.exit(1 if fails or errors else 0)
