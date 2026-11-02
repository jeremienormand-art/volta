# Vérifie les gestes : tirage puis glisser vers le client, toucher-toucher, glisser depuis une station.
import pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 780}, device_scale_factor=2)
    pg = c.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto((out / 'page.html').as_uri())
    pg.evaluate("localStorage.setItem('ga1.cfg2', JSON.stringify({seed:4242}))"); pg.reload(); pg.wait_for_timeout(400)
    pg.click('#bStart'); pg.wait_for_timeout(1800)
    def lp(x, y):
        return pg.evaluate(f"(() => {{ const f = document.getElementById('frame').getBoundingClientRect(); const s = f.width/360; return [f.left + {x}*s, f.top + {y}*s]; }})()")
    info = lambda: pg.evaluate("(() => { const g = window.__galopins.game; return {score:g.score, drinks:g.stats.drinks, hand:g.hand, perfect:g.stats.perfect, seats:g.seats.map(s => s && !s.isAlex ? s.orders.map(o=>o.drink).join('+') : null)} })()")
    st = info(); print('début', st)
    H = pg.evaluate("(() => { const f = document.getElementById('frame').getBoundingClientRect(); return f.height/(f.width/360); })()")
    stY = H - 24 - 75
    seat = next(i for i, s in enumerate(st['seats']) if s)
    # 1. maintien sur l'IPA puis glisser vers le client sans relâcher
    x, y = lp(45, stY); pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(560)
    tx, ty = lp(45 + 90 * seat, 230)
    pg.mouse.move(x, y - 60, steps=3); pg.mouse.move(tx, ty, steps=6)
    pg.screenshot(path=str(out / 'input_drag.png'))
    pg.mouse.up(); pg.wait_for_timeout(200)
    print('après tirage + glisser', info())
    pg.wait_for_timeout(1500)
    st = info(); print(st)
    # 2. spritz : toucher la station puis toucher le client
    for i, s in enumerate(st['seats']):
        if s == 'spritz':
            pg.mouse.click(*lp(225, stY)); pg.wait_for_timeout(80); pg.mouse.click(*lp(45 + 90 * i, 200)); break
    pg.wait_for_timeout(200); print('après spritz', info())
    b.close()
print('\n'.join(errors) or 'aucune erreur')
