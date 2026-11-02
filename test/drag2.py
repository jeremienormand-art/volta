# Glisser direct depuis la station (spritz) jusqu'au client, puis toucher-toucher, puis commande double.
import pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
body = (root / 'dist' / 'galopins-arcade.html').read_text()
(out / 'page.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>')
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={'width': 390, 'height': 780}, device_scale_factor=2).new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto((out / 'page.html').as_uri()); pg.wait_for_timeout(400)
    pg.evaluate("localStorage.clear(); localStorage.setItem('ga1.cfg2', JSON.stringify({seed:4242, prep:'simple', alexOn:false, hugoOn:false}))"); pg.reload(); pg.wait_for_timeout(500)
    pg.click('#bStart'); pg.wait_for_timeout(1500)
    lp = lambda x, y: pg.evaluate(f"(() => {{ const f = document.getElementById('frame').getBoundingClientRect(); const s = f.width/360; return [f.left + {x}*s, f.top + {y}*s]; }})()")
    Hh = pg.evaluate("(() => { const f = document.getElementById('frame').getBoundingClientRect(); return f.height/(f.width/360); })()")
    stY = Hh - 24 - 75
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__galopins.game; return {js}; }})()")
    pos = {'ipa': 45, 'stout': 135, 'spritz': 225, 'shot': 315}
    served = 0
    for step in range(40):
        seats = G("g.seats.map(s => s && !s.isAlex && s.phase === 'wait' ? s.orders.filter(o=>!o.done).map(o=>o.drink) : null)")
        target = next(((i, d) for i, d in enumerate(seats) if d), None)
        if not target:
            pg.wait_for_timeout(300); continue
        i, needs = target
        if len(needs) == 1 and step % 2 == 0:
            # glisser direct depuis la station
            x, y = lp(pos[needs[0]], stY); pg.mouse.move(x, y); pg.mouse.down()
            cx, cy = lp(45 + 90 * i, 240); pg.mouse.move(cx, cy, steps=8)
            if step < 3: pg.screenshot(path=str(out / 'drag2_direct.png'))
            pg.mouse.up()
        else:
            for d in needs: pg.mouse.click(*lp(pos[d], stY)); pg.wait_for_timeout(60)
            if len(needs) > 1: pg.screenshot(path=str(out / 'drag2_double.png'))
            pg.mouse.click(*lp(45 + 90 * i, 240))
        pg.wait_for_timeout(250)
        if G("g.t") > 70: break
    print(G("({score:g.score, drinks:g.stats.drinks, errors:g.stats.errors, left:g.stats.left, tray:g.tray.length})"))
    b.close()
print('\n'.join(errors) or 'aucune erreur')
