import pathlib, json, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for (W, H, mob) in [(390, 780, True), (1280, 720, False)]:
        c = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2 if mob else 1, has_touch=mob, is_mobile=mob)
        pg = c.new_page()
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.goto((out / 'page.html').as_uri())
        pg.evaluate("localStorage.setItem('ga1.cfg2', JSON.stringify({alexMode:'inversion', alexShot:'choix', testButtons:true, seed:4242, hints:false}))")
        pg.reload(); pg.wait_for_timeout(500)
        pg.click('#bStart'); pg.evaluate("window.__galopins.auto('bon')")
        pg.wait_for_timeout(5000)
        pg.evaluate("window.__galopins.game.forceAlex()")
        found = None
        for i in range(30):
            pg.wait_for_timeout(200)
            st = pg.evaluate("(() => { const g = window.__galopins.game; const s = g.seats.find(x => x && x.isAlex); return s ? {seat:s.seat, phase:s.phase} : null })()")
            if st and st['phase'] == 'offer': found = st; break
        pg.screenshot(path=str(out / f'alex_offer_{W}.png'))
        if found:
            pg.evaluate(f"window.__galopins.game.serve({found['seat']})")
            pg.wait_for_timeout(2600)
            pg.screenshot(path=str(out / f'alex_inv_{W}.png'))
        c.close()
    b.close()
print('\n'.join(errors) or 'aucune erreur')
