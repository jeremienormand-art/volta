# Classement de la semaine, dans Chromium, contre le Worker lancé en local :
#   npx wrangler dev --port 8799 --var MIN_SECONDES:0   (puis, dans un autre terminal)
#   python3 test/classement.py [largeur hauteur]
# Parcours : bouton de l'accueil, écran du top, partie classée jouée par le bot (fin accélérée),
# nom saisi sur l'addition, seconde partie inscrite toute seule, partie de test hors classement.
# Captures `rank_*` dans test/out/.
import sys, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (390, 780)
URL = 'http://127.0.0.1:8799/'
errors = []

def play(pg, name=None):
    pg.click('#bStart')
    pg.evaluate("window.__galopins.auto('bon')")
    pg.wait_for_timeout(2500)
    pg.evaluate("window.__galopins.game.t = 112")   # on saute au dernier palier : la fin arrive en quelques secondes
    for _ in range(60):
        pg.wait_for_timeout(500)
        if pg.evaluate("!document.getElementById('sEnd').hidden"): break
    pg.wait_for_timeout(1200)

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = c.new_page()
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(URL)
    pg.evaluate("localStorage.clear(); localStorage.setItem('ga1.cfg2', JSON.stringify({hints:false}))")
    pg.reload(); pg.wait_for_timeout(1500)
    print('accueil, bouton visible :', pg.is_visible('#bRank'), '|', pg.inner_text('#tRankLead'))
    pg.screenshot(path=str(out / f'rank_title_{W}.png'))
    pg.click('#bRank'); pg.wait_for_timeout(700)
    print('top :', pg.evaluate("[...document.querySelectorAll('#kList li')].map(l => l.innerText.replace(/\\n/g,' ')).slice(0,3)"))
    pg.screenshot(path=str(out / f'rank_board_{W}.png'))
    pg.click('#kTabAll'); pg.wait_for_timeout(800)
    print('tous les temps :', pg.inner_text('#kTitle'), '|', pg.inner_text('#kWeek'), '|', pg.evaluate("[...document.querySelectorAll('#kList li')].map(l => l.innerText.replace(/\\n/g,' ')).slice(0,3)"))
    pg.screenshot(path=str(out / f'rank_board_all_{W}.png'))
    pg.click('#kTabWeek'); pg.wait_for_timeout(500)
    pg.click('#bRankBack'); pg.wait_for_timeout(300)

    # 1re partie : le nom est demandé
    play(pg)
    seed = pg.evaluate("window.__galopins.game.seed")
    print('graine :', seed, '| formulaire visible :', pg.is_visible('#eName'))
    pg.screenshot(path=str(out / f'rank_end_form_{W}.png'))
    pg.click('#eName'); pg.keyboard.type('Jérémie'); pg.click('#eRankGo')
    pg.wait_for_timeout(1500)
    print('après inscription :', pg.inner_text('#eRankMsg').replace('\n', ' / '))
    pg.locator('#eRank').scroll_into_view_if_needed()
    pg.screenshot(path=str(out / f'rank_end_done_{W}.png'))
    pg.click('#eRankAll'); pg.wait_for_timeout(800)
    pg.screenshot(path=str(out / f'rank_board_me_{W}.png'))
    pg.click('#bRankBack'); pg.wait_for_timeout(300)
    print('retour sur l’addition :', pg.is_visible('#sEnd'))

    # 2e partie : inscrite toute seule au même nom
    pg.click('#bEndMenu'); pg.wait_for_timeout(300)
    play(pg); pg.wait_for_timeout(1500)
    print('2e partie :', pg.inner_text('#eRankMsg').replace('\n', ' / '), '| partie différente (v1.27) :', pg.evaluate("window.__galopins.game.seed") != seed)

    # Partie de test (réglages modifiés) : hors classement, bouton pour remettre les réglages
    pg.evaluate("localStorage.setItem('ga1.cfg2', JSON.stringify({hints:false, duration:90}))")
    pg.reload(); pg.wait_for_timeout(1200)
    play(pg)
    print('partie de test :', pg.inner_text('#eRankMsg'), '| bouton réglages :', pg.is_visible('#eRankReset'))
    pg.locator('#eRank').scroll_into_view_if_needed()
    pg.screenshot(path=str(out / f'rank_end_test_{W}.png'))
    b.close()
print('\n'.join(errors) or 'aucune erreur')
