# Parcours v2 : tirage, plateau, glisser, plateau plein, scènes Alex et Hugo expliquées.
import pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
body = (root / 'dist' / 'galopins-arcade.html').read_text()
(out / 'page.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>')
errors = []
W, H = 390, 780
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2)
    pg = c.new_page()
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto((out / 'page.html').as_uri()); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.clear(); localStorage.setItem('ga1.cfg2', JSON.stringify({seed:4242, testButtons:true, slowmo:0.6}))")
    pg.reload(); pg.wait_for_timeout(600)
    pg.screenshot(path=str(out / 'v2_00_title.png'))
    pg.click('#bStart'); pg.wait_for_timeout(1700)
    lp = lambda x, y: pg.evaluate(f"(() => {{ const f = document.getElementById('frame').getBoundingClientRect(); const s = f.width/360; return [f.left + {x}*s, f.top + {y}*s]; }})()")
    Hh = pg.evaluate("(() => { const f = document.getElementById('frame').getBoundingClientRect(); return f.height/(f.width/360); })()")
    stY = Hh - 24 - 75
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__galopins.game; return {js}; }})()")
    print('sièges', G("g.seats.map(s => s && s.orders.map(o=>o.drink).join('+'))"))
    # 1. tirage de l'IPA : capture dans la zone parfaite
    x, y = lp(45, stY); pg.mouse.move(x, y); pg.mouse.down()
    for i in range(60):
        pg.wait_for_timeout(20)
        f = G("g.st.ipa.fill")
        if f >= 0.88: break
    pg.screenshot(path=str(out / 'v2_01_pull_zone.png'))
    pg.mouse.up(); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / 'v2_02_perfect.png'))
    print('plateau', G("g.tray"))
    pg.wait_for_timeout(900)
    pg.screenshot(path=str(out / 'v2_03_hint.png'))
    # 2. glisser le plateau vers le client
    seat = G("g.seats.findIndex(s => s && !s.isAlex)")
    tx, ty = lp(280, Hh - 24 - 150 - 4 - 30)
    cx, cy = lp(45 + 90 * seat, 240)
    pg.mouse.move(tx, ty); pg.mouse.down(); pg.mouse.move(tx, ty - 40, steps=4); pg.mouse.move(cx, cy, steps=8)
    pg.screenshot(path=str(out / 'v2_04_drag.png'))
    pg.mouse.up(); pg.wait_for_timeout(200)
    print('servi ?', G("({score:g.score, drinks:g.stats.drinks, tray:g.tray.length})"))
    # 3. plateau : spritz + shot + spritz puis plateau plein
    for sx in (225, 315, 225):
        pg.mouse.click(*lp(sx, stY)); pg.wait_for_timeout(120)
    pg.mouse.click(*lp(315, stY)); pg.wait_for_timeout(120)
    pg.screenshot(path=str(out / 'v2_05_trayfull.png'))
    print('plateau plein', G("g.tray.map(x=>x.drink)"))
    # jeter un verre en touchant le plateau
    pg.mouse.click(*lp(280 + 34, Hh - 24 - 150 - 4 - 30)); pg.wait_for_timeout(150)
    print('après jet', G("g.tray.map(x=>x.drink)"))
    # 4. Alex au choix, première fois
    pg.click('#bTestA')
    for i in range(40):
        pg.wait_for_timeout(150)
        st = G("(() => { const s = g.seats.find(x => x && x.isAlex); return s ? {seat:s.seat, phase:s.phase} : null })()")
        if st and st['phase'] == 'offer': break
    pg.screenshot(path=str(out / 'v2_06_alex_offer.png'))
    ax, ay = lp(45 + 90 * st['seat'], 250); pg.mouse.click(ax, ay)
    pg.wait_for_timeout(3500)
    pg.screenshot(path=str(out / 'v2_07_alex_card.png'))
    print('hold alex', G("({hold:g.hold, freeze:g.freeze})"))
    pg.mouse.click(*lp(180, 300)); pg.wait_for_timeout(900)
    pg.screenshot(path=str(out / 'v2_08_alex_fx.png'))
    print('après tap', G("({hold:g.hold, alex:g.alex.state})"))
    # 5. Hugo, première fois
    pg.wait_for_timeout(21000)
    ok = G("g.forceHugo()")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(out / 'v2_09_hugo_card.png'))
    print('hugo', ok, G("({hold:g.hold, state:g.hugo.state})"))
    pg.mouse.click(*lp(180, 300)); pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out / 'v2_10_hugo_rush.png'))
    b.close()
print('\n'.join(errors) or 'aucune erreur')
