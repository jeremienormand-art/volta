# Mode public (v1.25) : la page servie depuis une adresse « galopins » (interceptée) cache le panneau, les boutons A/H
# et le bot, et ignore les réglages de jeu enregistrés (seul le confort reste) ; la même adresse avec ?test rend tout.
# python3 test/public.py → captures public_* dans test/out/.
import pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'dist' / 'galopins-arcade.html').read_text()
out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 375, 'height': 667}, device_scale_factor=2, has_touch=True, is_mobile=True)
    c.route('https://galopins-arcade.test/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html) if '/api/' not in r.request.url else r.fulfill(status=503, content_type='application/json', body='{"erreur":"x","code":"indispo"}'))
    pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('https://galopins-arcade.test/'); pg.wait_for_timeout(400)
    # un vieux téléphone qui avait enregistré tous les réglages (dont l'ancienne demande d'Hugo) et un mode simple
    pg.evaluate("localStorage.setItem('ga1.cfg2', JSON.stringify({sound:false, prep:'simple', hugoTargetTirage:10, salle:'ancien', testButtons:true}))")
    pg.reload(); pg.wait_for_timeout(700)
    vis = lambda sel: pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.hidden && e.offsetParent !== null; }})()")
    r = {'engrenage': vis('#bTitlePanel'), 'hook': pg.evaluate("typeof window.__galopins")}
    pg.screenshot(path=str(out/'public_accueil.png'))
    pg.click('#bStart'); pg.wait_for_timeout(1200)
    r['boutonsAH'] = vis('#bTestA') or vis('#bTestH')
    pg.click('#bPause'); pg.wait_for_timeout(300)
    r['pause_reglages'] = vis('#bPausePanel')
    pg.screenshot(path=str(out/'public_pause.png'))
    r['son'] = pg.evaluate("JSON.parse(localStorage.getItem('ga1.cfg2'))")
    pg.click('#bQuit'); pg.wait_for_timeout(300)
    c.close()
    # même adresse avec ?test : tout revient
    c = b.new_context(viewport={'width': 375, 'height': 667}, device_scale_factor=2, has_touch=True, is_mobile=True)
    c.route('https://galopins-arcade.test/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html) if '/api/' not in r.request.url else r.fulfill(status=503, content_type='application/json', body='{}'))
    pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('https://galopins-arcade.test/?test'); pg.wait_for_timeout(300)
    pg.evaluate("localStorage.setItem('ga1.cfg2', JSON.stringify({prep:'simple', hugoTargetTirage:10}))"); pg.reload(); pg.wait_for_timeout(600)
    r2 = {'engrenage': vis('#bTitlePanel'), 'hook': pg.evaluate("typeof window.__galopins")}
    pg.click('#bStart'); pg.wait_for_timeout(800)
    r2['prep'] = pg.evaluate("window.__galopins.game.cfg.prep"); r2['hugo'] = pg.evaluate("window.__galopins.game.hugo.tiers")
    print('PUBLIC', json.dumps(r, ensure_ascii=False)); print('TEST  ', json.dumps(r2, ensure_ascii=False))
    b.close()
print('\n'.join(errs) or 'aucune erreur')
