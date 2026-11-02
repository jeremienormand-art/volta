# Partie complète jouée par le bot dans Chromium, accélérée ×4, avec captures.
import sys, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (390, 780)
cfg = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
cfg.setdefault('slowmo', 4)
tag = sys.argv[4] if len(sys.argv) > 4 else 'full'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = c.new_page()
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto((out / 'page.html').as_uri())
    pg.evaluate(f"localStorage.setItem('ga1.cfg2', JSON.stringify({json.dumps(cfg)}))")
    pg.reload(); pg.wait_for_timeout(500)
    pg.click('#bStart')
    pg.evaluate("window.__galopins.auto('bon')")
    shots = 0
    for i in range(80):
        pg.wait_for_timeout(500)
        st = pg.evaluate("(() => { const g = window.__galopins.game; return g ? {t:g.t, over:g.over, alex:g.alex.state, hugo:g.hugo.state, cut:g.cut && g.cut.kind} : null })()")
        if st and (st['alex'] == 'effect' or st['hugo'] == 'rush' or st['cut']) and shots < 6:
            pg.screenshot(path=str(out / f'{tag}_ev{shots}_{W}.png')); shots += 1
        if i in (20, 40): pg.screenshot(path=str(out / f'{tag}_t{i}_{W}.png'))
        if st and st['over']:
            break
    pg.wait_for_timeout(2200)
    pg.screenshot(path=str(out / f'{tag}_end_{W}.png'))
    res = pg.evaluate("(() => { const g = window.__galopins.game; return {score:g.score, stats:g.stats, combo:g.bestCombo} })()")
    print(json.dumps(res))
    b.close()
print('\n'.join(errors) or 'aucune erreur')
