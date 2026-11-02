# Défi entre potes (v1.24) : python3 test/defi.py [largeur hauteur]
# Classement simulé (API remplacée dans la page). Vérifie : défi annoncé dans la bulle de Max, Rejouer et
# « Défier un pote » visibles sans défiler, verdict sur l'addition, texte et lien partagés (repli « Lien copié ! »),
# bulle « défi relevé » au retour à l'accueil. Captures defi_* dans test/out/.
import sys, os, re, json, threading, http.server, functools
from playwright.sync_api import sync_playwright

W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (280, 568)
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

def finish(p, score):
    p.click('#bStart'); p.wait_for_timeout(1700)
    p.evaluate("(s) => { const g = window.__galopins.game; g.cfg.hints = false; g.score = s; g.t = g.cfg.duration - 0.02; }", score)
    p.locator('#sEnd').wait_for(state='visible'); p.wait_for_timeout(1500)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True,
                        permissions=['clipboard-read', 'clipboard-write'])
    p = ctx.new_page(); errs = []; p.on('pageerror', lambda e: errs.append(str(e)))
    p.route('**/api/**', api)
    p.goto(BASE + '?defi=21000&de=Nico')
    p.evaluate("() => localStorage.setItem('ga1.rankName', 'Jérémie')"); p.reload(); p.wait_for_timeout(500)
    bulle = p.inner_text('.t-say')
    assert 'Nico te défie' in bulle and p.locator('#tRankLead').is_hidden(), bulle
    p.screenshot(path=f'{OUT}/defi_accueil.png')

    # Partie perdue contre le défi, puis gagnée
    finish(p, 18000)
    assert 'manque' in p.inner_text('#eDefi'), p.inner_text('#eDefi')
    p.click('#bReplay'); p.wait_for_timeout(300)
    p.evaluate("() => { const g = window.__galopins.game; g.cfg.hints = false; g.score = 22450; g.t = g.cfg.duration - 0.02; }")
    p.locator('#sEnd').wait_for(state='visible'); p.wait_for_timeout(1500)
    assert 'avance' in p.inner_text('#eDefi'), p.inner_text('#eDefi')
    score = int(re.sub(r'\D', '', p.inner_text('#eScore')))
    for bid in ('bReplay', 'bShare'):
        inside = p.evaluate("(id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }", bid)
        assert inside, bid + ' caché sans défiler'
    p.screenshot(path=f'{OUT}/defi_fin.png')

    # Sans feuille de partage (ordinateur, ou bloquée) : le message est copié
    p.evaluate("() => { navigator.share = undefined; }")
    p.click('#bShare'); p.wait_for_timeout(200)
    assert p.inner_text('#bShareL') == 'Lien copié !', p.inner_text('#bShareL')
    copie = p.evaluate("() => navigator.clipboard.readText()")
    assert 'relevé le défi de Nico' in copie and '4e de la semaine' in copie, copie
    assert f'workers.dev/?defi={score}&de=J%C3%A9r%C3%A9mie' in copie, copie
    print('Message copié :', copie)

    # Avec la feuille de partage du téléphone
    p.evaluate("() => { window.__partage = null; navigator.share = async (d) => { window.__partage = d; }; }")
    p.click('#bShare'); p.wait_for_timeout(200)
    d = p.evaluate("() => window.__partage")
    assert d and d['url'].endswith(f'?defi={score}&de=J%C3%A9r%C3%A9mie') and 'Tu me bats' in d['text'], d

    p.evaluate("() => { const s = document.getElementById('sEnd'); s.scrollTop = s.scrollHeight; }"); p.wait_for_timeout(200)
    p.screenshot(path=f'{OUT}/defi_fin_bas.png')
    p.click('#bEndMenu'); p.wait_for_timeout(300)
    assert 'relevé' in p.inner_text('.t-say'), p.inner_text('.t-say')
    assert not errs, errs
    print('Défi OK', W, H)
    b.close()
