# Cartons d'Alex et Hugo (v1.20) et verdict d'Hugo par médaille (v1.25 : or impeccable, argent, bronze, raté) : captures cartons_* dans test/out/.
# python3 test/cartons.py [largeur hauteur]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
(out / 'page.html').write_text((root / 'dist' / 'galopins-arcade.html').read_text())
W = int(sys.argv[1]) if len(sys.argv) > 1 else 390
H = int(sys.argv[2]) if len(sys.argv) > 2 else 780
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = c.new_page()
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto((out / 'page.html').as_uri()); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.clear(); localStorage.setItem('ga1.cfg2', JSON.stringify({seed:4242, testButtons:true, hints:false, menu:'alex'}))")
    pg.reload(); pg.wait_for_timeout(800)
    pg.click('#bStart'); pg.wait_for_timeout(2500)
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__galopins.game; return {js}; }})()")
    # Alex : il s'installe, on accepte le shot, le carton attend un toucher (premier passage)
    G("g.forceAlex()")
    st = None
    for i in range(80):
        pg.wait_for_timeout(100)
        st = G("(() => { const s = g.seats.find(x => x && x.isAlex); return s ? {seat:s.seat, phase:s.phase} : null })()")
        if st and st['phase'] == 'offer': break
    G(f"g.serve({st['seat']})")
    for i in range(80):
        pg.wait_for_timeout(100)
        if G("!!g.cut"): break
    pg.wait_for_timeout(2200)
    pg.screenshot(path=str(out / f'cartons_alex_{W}.png'))
    print('carton Alex', G("({hold:g.hold, kind:g.cut && g.cut.kind})"))
    G("g.releaseHold()"); pg.wait_for_timeout(4500)
    pg.screenshot(path=str(out / f'cartons_alex_bandeau_{W}.png'))
    # Hugo : carton, puis verdict à chaque palier (demande de 14 : bronze 8, argent 11, or 14)
    for kind, served, errs in [('hugo', 14, 0), ('hugo_argent', 12, 1), ('hugo_bronze', 9, 1), ('hugo_rate', 4, 0)]:
        for i in range(200):
            pg.wait_for_timeout(100)
            if G("g.forceHugo()"): break
        pg.wait_for_timeout(1500)
        if kind == 'hugo':
            pg.screenshot(path=str(out / f'cartons_hugo_{W}.png'))
            print('carton Hugo', G("({hold:g.hold, kind:g.cut && g.cut.kind})"))
        G("g.releaseHold()"); pg.wait_for_timeout(3200)
        G(f"(g.hugo.served = {served}, g.hugo.errors = {errs}, g.hugo.left = 0, g.hugo.end = g.t + 2.0, 0)")
        pg.wait_for_timeout(1000)
        pg.screenshot(path=str(out / f'cartons_{kind}_bandeau_{W}.png'))
        pg.wait_for_timeout(1700)
        pg.screenshot(path=str(out / f'cartons_{kind}_verdict_{W}.png'))
        print('verdict', kind, G("({served:g.stats.hugoServed, tier:g.stats.hugoTier, perfect:g.stats.hugoPerfect, score:g.score})"))
        pg.wait_for_timeout(2500)
    b.close()
print('\n'.join(errors) or 'aucune erreur')
