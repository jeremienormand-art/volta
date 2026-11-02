# Captures d'écran et partie scriptée dans Chromium headless (viewport téléphone).
import sys, pathlib, time
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
body = (root / 'dist' / 'galopins-arcade.html').read_text()
page_html = ('<!doctype html><html><head><meta charset="utf-8">'
             '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
             '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}'
             'body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>'
             '</head><body>' + body + '</body></html>')
out = root / 'test' / 'out'
out.mkdir(exist_ok=True)
(out / 'page.html').write_text(page_html)

W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (390, 780)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto((out / 'page.html').as_uri())
    pg.wait_for_timeout(900)
    pg.screenshot(path=str(out / f'01_title_{W}.png'))
    # partie : réglages de test pour forcer les événements
    pg.evaluate("localStorage.setItem('ga1.cfg2', JSON.stringify({testButtons:true, seed:4242}))")
    pg.reload(); pg.wait_for_timeout(700)
    pg.click('#bStart')
    pg.wait_for_timeout(1600)
    pg.screenshot(path=str(out / f'02_first_{W}.png'))
    # convertit coordonnées logiques -> écran
    def lp(x, y):
        return pg.evaluate(f"(() => {{ const f = document.getElementById('frame').getBoundingClientRect(); const s = f.width/360; return [f.left + {x}*s, f.top + {y}*s]; }})()")
    Hh = pg.evaluate("(() => { const f = document.getElementById('frame').getBoundingClientRect(); return f.height/(f.width/360); })()")
    stY = Hh - 24 - 75
    # maintien sur l'IPA (station 0) pendant ~0,55 s, capture pendant le tirage
    x, y = lp(45, stY)
    pg.mouse.move(x, y); pg.mouse.down()
    pg.wait_for_timeout(380)
    pg.screenshot(path=str(out / f'03_pull_{W}.png'))
    pg.wait_for_timeout(170)
    pg.mouse.up()
    pg.wait_for_timeout(120)
    pg.screenshot(path=str(out / f'04_inhand_{W}.png'))
    # sert le client : trouve la place occupée
    seat = pg.evaluate("0")
    for s in range(4):
        xx, yy = lp(45 + 90 * s, 200)
        pg.mouse.click(xx, yy)
    pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'05_served_{W}.png'))
    pg.wait_for_timeout(3000)
    pg.screenshot(path=str(out / f'06_later_{W}.png'))
    # Alex
    pg.click('#bTestA')
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out / f'07_alexcut_{W}.png'))
    pg.wait_for_timeout(1700)
    pg.screenshot(path=str(out / f'08_alexfx_{W}.png'))
    pg.wait_for_timeout(11500)
    pg.click('#bTestH')
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(out / f'09_hugocut_{W}.png'))
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(out / f'10_hugorush_{W}.png'))
    pg.click('#bPause')
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'11_pause_{W}.png'))
    pg.click('#bPausePanel')
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'12_panel_{W}.png'), full_page=False)
    b.close()
print('\n'.join(errors) or 'aucune erreur console')
