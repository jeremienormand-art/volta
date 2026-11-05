# v1.39 : néon Instagram dans la barre du bas. python3 test/insta.py [largeur hauteur]
# Mode test : néon visible sans défiler, toucher → « Merci ! », partie suivante → néon caché, rappel en pied de ticket.
# Mode public (adresse « galopins », horloge accélérée) : pas de ligne des caractéristiques sur l'addition.
import sys, os, json, threading, http.server, functools, pathlib
from playwright.sync_api import sync_playwright

W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (390, 844)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'test', 'out'); os.makedirs(OUT, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, 'dist')))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/galopins-arcade.html'
TOP = [{"nom": "Hugo", "score": 31200}, {"nom": "Alex", "score": 28950}, {"nom": "Nico", "score": 25010}]
def api(route):
    u = route.request.url
    if '/api/classement' in u: body = {"semaine": "2026-10-26", "du": "2026-10-26", "top": TOP, "joueurs": 9}
    elif '/api/partie' in u: body = {"partie": "test"}
    else: body = {"nom": "Jérémie", "rang": 4, "record": True, "meilleur": 22450, "joueurs": 9, "semaine": "2026-10-26",
                  "top": TOP, "tout": {"rang": 7, "record": True, "meilleur": 22450}}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
def insta(route): route.fulfill(status=200, content_type='text/html', body='<p>instagram</p>')
tag = f'{W}'
vis = lambda p, sel: p.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.hidden && e.offsetParent !== null; }})()")
inview = lambda p, sel: p.evaluate(f"(() => {{ const r = document.querySelector('{sel}').getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; }})()")
def finish(p):
    p.click('#bStart' if vis(p, '#bStart') else '#bReplay'); p.wait_for_timeout(1700)
    p.evaluate("() => { const g = window.__galopins.game; g.cfg.hints = false; g.score = 22450; g.drinks = 31; g.t = g.cfg.duration - 0.02; }")
    p.locator('#sEnd').wait_for(state='visible')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    ctx.route('**/*instagram.com/**', insta)
    p = ctx.new_page(); errs = []; p.on('pageerror', lambda e: errs.append(str(e)))
    p.route('**/api/**', api)
    p.goto(BASE); p.evaluate("() => { localStorage.setItem('ga1.rankName', '\"Jérémie\"'); localStorage.removeItem('ga1.insta'); }"); p.reload(); p.wait_for_timeout(500)
    finish(p); p.wait_for_timeout(600)
    p.screenshot(path=f'{OUT}/insta_{tag}_grésille.png')
    p.wait_for_timeout(1600)
    assert vis(p, '#bInsta') and inview(p, '#bInsta'), 'néon pas visible sans défiler'
    assert not vis(p, '#eInsta'), 'pied de ticket en double'
    assert inview(p, '#bReplay') and inview(p, '#bShare'), 'Rejouer / Défier cachés'
    # Volta : plus de ligne des caractéristiques sur l'addition, même en test
    p.screenshot(path=f'{OUT}/insta_{tag}_fin.png')
    with ctx.expect_page() as pop:
        p.click('#bInsta')
    url = pop.value.url; pop.value.close()
    assert 'instagram.com/galopins_patoche' in url, url
    assert p.inner_text('#bInstaL') == 'Merci !', p.inner_text('#bInstaL')
    p.screenshot(path=f'{OUT}/insta_{tag}_merci.png')
    finish(p); p.wait_for_timeout(2000)
    assert not vis(p, '#bInsta'), 'néon encore là après un toucher'
    p.evaluate("() => { const s = document.getElementById('sEnd'); s.scrollTop = s.scrollHeight; }"); p.wait_for_timeout(300)
    assert vis(p, '#eInsta'), 'rappel en pied de ticket absent'
    p.screenshot(path=f'{OUT}/insta_{tag}_suivante.png')
    print('mode test OK', W, H, '· lien', url)
    ctx.close()

    # Mode public : adresse « galopins », partie jouée en accéléré (horloge simulée), personne ne touche l'écran
    html = pathlib.Path(ROOT, 'dist', 'galopins-arcade.html').read_text()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    ctx.route('https://galopins-arcade.test/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html) if '/api/' not in r.request.url else r.fulfill(status=503, content_type='application/json', body='{"erreur":"x","code":"indispo"}'))
    p = ctx.new_page(); p.on('pageerror', lambda e: errs.append(str(e)))
    p.clock.install()
    p.goto('https://galopins-arcade.test/'); p.clock.run_for(800)
    p.evaluate("() => localStorage.setItem('ga1.learn1', JSON.stringify({hold:true,serve:true,tap:true,stout:true}))"); p.reload(); p.clock.run_for(800)
    p.click('#bStart'); p.clock.run_for(500)
    for _ in range(80):
        p.clock.run_for(2000); p.mouse.click(W // 2, int(H * 0.3))
        if vis(p, '#sEnd'): break
    p.clock.run_for(3000)
    assert vis(p, '#sEnd'), 'partie publique pas terminée'
    assert p.locator('#eModes').count() == 0, 'ligne des caractéristiques encore présente'
    assert vis(p, '#bInsta') and inview(p, '#bInsta'), 'public : néon absent'
    p.evaluate("() => { const s = document.getElementById('sEnd'); s.scrollTop = s.scrollHeight; }"); p.clock.run_for(300)
    p.screenshot(path=f'{OUT}/insta_{tag}_public_bas.png')
    print('mode public OK')
    print('erreurs', errs)
    b.close()
