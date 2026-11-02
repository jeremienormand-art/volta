# Anti-triche de bout en bout (v1.30), dans Chromium, contre le Worker lancé en local :
#   npx wrangler dev --port 8799 --var MIN_SECONDES:0   (puis, dans un autre terminal)
#   python3 test/rejeu.py
# 1. Partie classée jouée honnêtement par le bot, guidage du premier service compris (≈ 2 min 30 réelles) :
#    le Worker la rejoue à l'identique (« ok »).
# 2. Partie suivante dont le score est gonflé en route vers le serveur : le rejeu le voit (« ecart »).
# 3. Un autre téléphone qui prend le même nom : refusé (« nom-pris »), le formulaire revient.
# Le bilan /api/rejeu est affiché à la fin. Captures `rejeu_*` dans test/out/.
import pathlib, json, re, time
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
URL = 'http://127.0.0.1:8799/'
NOM = 'Testeur%d' % (int(time.time()) % 1000)
errors = []

def statut(pg, partie):
    return pg.evaluate(f"fetch('/api/rejeu').then(r => r.text())")

def play(pg, honnete=True):
    pg.click('#bStart')
    pg.evaluate("window.__galopins.auto('bon')")
    if not honnete:
        pg.wait_for_timeout(2500)
        pg.evaluate("window.__galopins.game.t = 112")
    for _ in range(400):
        pg.wait_for_timeout(500)
        if pg.evaluate("!document.getElementById('sEnd').hidden"): break
    pg.wait_for_timeout(1500)
    return pg.evaluate("(() => { const g = window.__galopins.game; return { score: g.score, pas: g.n, gestes: g.log.length, apprentissage: Math.round(g.stats.learnPause) }; })()")

with sync_playwright() as p:
    b = p.chromium.launch()
    # Téléphone 1 : premier lancement (guidage actif, scènes expliquées), partie honnête
    c = b.new_context(viewport={'width': 390, 'height': 780}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = c.new_page()
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1500)
    print('1. partie honnête :', play(pg))
    pg.click('#eName'); pg.keyboard.type(NOM); pg.click('#eRankGo'); pg.wait_for_timeout(2500)
    print('   inscription :', pg.inner_text('#eRankMsg').replace('\n', ' / '))
    pg.wait_for_timeout(1500)

    # 2. score gonflé en route : la requête est modifiée avant d'arriver au Worker
    def gonfle(route):
        body = json.loads(route.request.post_data)
        body['score'] += 3000
        route.continue_(post_data=json.dumps(body))
    pg.route('**/api/score', gonfle)
    pg.click('#bEndMenu'); pg.wait_for_timeout(400)
    print('2. partie au score gonflé :', play(pg))
    pg.wait_for_timeout(2500)
    print('   inscription :', pg.inner_text('#eRankMsg').replace('\n', ' / '))
    pg.unroute('**/api/score')
    pg.screenshot(path=str(out / 'rejeu_addition.png'))

    # 3. autre téléphone, même nom
    c2 = b.new_context(viewport={'width': 390, 'height': 780}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg2 = c2.new_page()
    pg2.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg2.goto(URL); pg2.evaluate("localStorage.clear(); localStorage.setItem('ga1.cfg2', JSON.stringify({hints:false}))"); pg2.reload(); pg2.wait_for_timeout(1500)
    play(pg2, honnete=False)
    pg2.click('#eName'); pg2.keyboard.type(NOM); pg2.click('#eRankGo'); pg2.wait_for_timeout(2500)
    print('3. même nom sur un autre téléphone :', pg2.inner_text('#eRankMsg'), '| formulaire revenu :', pg2.is_visible('#eName'))
    pg2.locator('#eRank').scroll_into_view_if_needed()
    pg2.screenshot(path=str(out / 'rejeu_nom_pris.png'))

    pg.wait_for_timeout(2000)
    print()
    print(pg.evaluate("fetch('/api/rejeu').then(r => r.text())"))
    b.close()
print('\n'.join(errors) or 'aucune erreur')
