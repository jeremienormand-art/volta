# Story Instagram (v1.40, v1.42) : python3 test/story.py [largeur hauteur]
# Bouton « Ton score en story » sur l'addition → aperçu de l'image 1080 × 1920 avec les trois étapes (Partager, Instagram,
# Story, taguer) ; « Partager » envoie l'image seule (JPEG, sans texte ni lien) à la feuille de partage, « Story prête ! »
# au retour ; sans partage d'image, appui long ou « Télécharger ». Captures story_* et l'image (story_image_*.jpg).
import sys, os, json, base64, threading, http.server, functools
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
    else: body = {"nom": "Jérémie", "rang": 4, "record": True, "meilleur": 33450, "joueurs": 9, "semaine": "2026-10-26",
                  "top": TOP, "tout": {"rang": 7, "record": True, "meilleur": 33450}}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
vis = lambda p, sel: p.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.hidden && e.offsetParent !== null; }})()")
inview = lambda p, sel: p.evaluate(f"(() => {{ const r = document.querySelector('{sel}').getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; }})()")
def finish(p, score, extra=''):
    p.click('#bStart' if vis(p, '#bStart') else '#bReplay'); p.wait_for_timeout(1700)
    p.evaluate("(s) => { const g = window.__galopins.game; g.cfg.hints = false; g.score = s; g.stats.drinks = 41; g.stats.perfect = 17; g.bestCombo = 23; " + extra + " g.t = g.cfg.duration - 0.02; }", score)
    p.locator('#sEnd').wait_for(state='visible'); p.wait_for_timeout(1800)
def save_img(tag):
    url = p.evaluate("() => window.__galopins.story.url")
    with open(f'{OUT}/story_image_{tag}.jpg', 'wb') as f: f.write(base64.b64decode(url.split(',', 1)[1]))

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    p = ctx.new_page(); errs = []; p.on('pageerror', lambda e: errs.append(str(e)))
    p.route('**/api/**', api)
    p.goto(BASE + '?defi=30000&de=Nico'); p.evaluate("() => localStorage.setItem('ga1.rankName', 'Jérémie')"); p.reload(); p.wait_for_timeout(500)

    # 1. Téléphone qui sait partager une image : la feuille de partage reçoit un JPEG 1080 × 1920, sans texte ni lien
    p.evaluate("""() => { window.__shared = null; navigator.canShare = (d) => !!(d && d.files && d.files.length);
      navigator.share = (d) => { window.__shared = { n: d.files.length, type: d.files[0].type, name: d.files[0].name, size: d.files[0].size, text: d.text || null, url: d.url || null }; return Promise.resolve(); }; }""")
    finish(p, 33450, 'g.stats.hugoPlayed = true; g.stats.hugoServed = 12; g.stats.hugoTarget = 14; g.stats.hugoTier = 2;')
    assert vis(p, '#eStory'), 'bouton story absent'
    p.screenshot(path=f'{OUT}/story_{W}_addition.png')
    p.click('#eStory'); p.wait_for_timeout(300)
    assert vis(p, '#sStory') and vis(p, '#sStorySteps') and vis(p, '#sStoryGo') and not vis(p, '#sStoryDl'), 'aperçu avec étapes attendu'
    assert p.evaluate('() => window.__shared') is None, 'partage parti avant « Partager »'
    for sel in ('#sStoryGo', '#sStoryClose'): assert inview(p, sel), sel + ' hors écran'
    p.screenshot(path=f'{OUT}/story_{W}_apercu.png')
    p.click('#sStoryGo'); p.wait_for_timeout(300)
    sh = p.evaluate('() => window.__shared')
    assert not vis(p, '#sStory'), 'aperçu pas refermé après le partage'
    assert sh and sh['n'] == 1 and sh['type'] == 'image/jpeg' and sh['name'] == 'galopins-arcade-33450.jpg' and not sh['text'] and not sh['url'], sh
    assert 'Story prête' in p.text_content('#eStoryL'), p.text_content('#eStoryL')
    dims = p.evaluate("""() => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = window.__galopins.story.url; })""")
    assert dims == [1080, 1920], dims
    save_img('record')
    print('partage OK', sh['size'] // 1024, 'Ko')

    # 2. Sans partage d'image : l'image s'affiche en grand, « Télécharger » et « Fermer »
    p.evaluate("() => { navigator.canShare = undefined; }")
    p.click('#eStory'); p.wait_for_timeout(300)
    assert vis(p, '#sStory') and vis(p, '#sStoryHelp') and not vis(p, '#sStoryGo') and vis(p, '#sStoryDl') and p.get_attribute('#sStoryDl', 'download') == 'galopins-arcade-33450.jpg'
    p.screenshot(path=f'{OUT}/story_{W}_repli.png')
    p.click('#sStoryClose'); p.wait_for_timeout(150)
    assert not vis(p, '#sStory')

    # 3. Partie ordinaire (pas de record, défi raté) : l'image n'a ni tampon ni ligne de défi
    finish(p, 12800, 'g.stats.drinks = 19; g.stats.perfect = 4; g.bestCombo = 7;')
    p.click('#eStory'); p.wait_for_timeout(300)
    save_img('simple')
    p.click('#sStoryClose'); p.wait_for_timeout(150)
    print('repli OK · erreurs', errs)
    assert not errs, errs
    b.close()
