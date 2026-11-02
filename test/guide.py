# Premier service guidé, joué comme un nouveau venu qui ne connaît pas le jeu.
# Il hésite, rate son premier tirage, touche le plateau au lieu de glisser, puis suit les consignes du coach.
# Usage : python3 test/guide.py [largeur hauteur] [tirage|simple]  → captures guide_* dans test/out/
import sys, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
body = (root / 'dist' / 'galopins-arcade.html').read_text()
(out / 'page.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>')
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (320, 568)
prep = sys.argv[3] if len(sys.argv) > 3 else 'tirage'
tag = f'guide_{prep}_{W}'
errors, fails = [], []
def check(ok, msg):
    print(('ok   ' if ok else 'ÉCHEC'), msg)
    if not ok: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2)
    pg = c.new_page()
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto((out / 'page.html').as_uri()); pg.wait_for_timeout(300)
    pg.evaluate(f"localStorage.clear(); localStorage.setItem('ga1.cfg2', JSON.stringify({{seed:4242, prep:'{prep}'}}))")
    pg.reload(); pg.wait_for_timeout(500)
    lp = lambda x, y: pg.evaluate(f"(() => {{ const f = document.getElementById('frame').getBoundingClientRect(); const s = f.width/360; return [f.left + {x}*s, f.top + {y}*s]; }})()")
    Hh = pg.evaluate("(() => { const f = document.getElementById('frame').getBoundingClientRect(); return f.height/(f.width/360); })()")
    stY = Hh - 24 - 75                     # milieu des stations
    trayY = Hh - 24 - 150 - 34             # verres posés sur le plateau
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__galopins.game; return {js}; }})()")
    coach = lambda: pg.evaluate("window.__galopins.coach")
    station = lambda d: lp(45 + 90 * G(f"g.layout.indexOf('{d}')"), stY)
    shot = lambda name: pg.screenshot(path=str(out / f'{tag}_{name}.png'))
    def drag_tray_to(seat, name=None):
        x, y = lp(280, trayY); cx, cy = lp(45 + 90 * seat, 250)
        pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y - 40, steps=4); pg.mouse.move(cx, cy, steps=8)
        pg.wait_for_timeout(260); st = coach()
        if name: shot(name)
        pg.mouse.up(); pg.wait_for_timeout(150)
        return st

    pg.click('#bStart'); pg.wait_for_timeout(2600)
    first = 'hold' if prep == 'tirage' else 'tap'
    st = coach(); shot('01_debut')
    check(st['step'] == first, f"au début, le coach montre « {st['text']} » ({st['step']})")
    # 1. il hésite huit secondes : la consigne reste, personne d'autre n'arrive
    pg.wait_for_timeout(8000)
    st = coach(); shot('02_hesite')
    check(st['step'] == first, f"après 10 s d'hésitation, la consigne est toujours là : « {st['text']} »")
    check(G("g.spawned") == 1, f"le premier client attend seul (clients arrivés : {G('g.spawned')})")
    if prep == 'tirage':
        # 2. il touche l'IPA au lieu de maintenir
        x, y = station('ipa'); pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(60); pg.mouse.up(); pg.wait_for_timeout(300)
        st = coach(); shot('03_toucher_trop_court')
        check(st['nudge'] == 'cancel' and st['step'] == 'hold', f"toucher trop court : « {st['text']} »")
        pg.wait_for_timeout(2500)
        check(coach()['text'] == st['text'], 'la correction reste affichée')
        # 3. il maintient : la consigne de relâcher apparaît, puis passe au rose dans la zone
        pg.mouse.down(); pg.wait_for_timeout(200)
        st = coach(); shot('04_maintien')
        check(st['step'] == 'release', f"pendant le maintien : « {st['text']} »")
        for i in range(80):
            pg.wait_for_timeout(15)
            if G("g.st.ipa.fill") >= 0.9: break
        st = coach()
        pg.mouse.up()   # relâcher avant la capture : la zone rose ne dure que 0,15 s, une capture lente la fait rater
        check(st['text'] == 'Relâche maintenant !', f"dans la zone rose : « {st['text']} »")
        pg.wait_for_timeout(250); shot('05_zone_rose')
        check(G("g.tray.map(x => x.drink).join()") == 'ipa', f"l'IPA est sur le plateau ({G('g.tray.map(x => x.q).join()')})")
    else:
        x, y = station('ipa'); pg.mouse.click(x, y); pg.wait_for_timeout(250)
        check(G("g.tray.map(x => x.drink).join()") == 'ipa', "l'IPA est sur le plateau")
    # 4. le plateau : la consigne de glisser, avec la main qui montre le geste
    pg.wait_for_timeout(900)
    st = coach(); shot('06_glisse')
    check(st['step'] == 'serve' and st['text'] == 'Glisse le plateau vers le client', f"verre posé : « {st['text']} »")
    # 5. il touche le plateau : le verre n'est pas jeté, la consigne se précise
    pg.mouse.click(*lp(280, trayY)); pg.wait_for_timeout(300)
    st = coach(); shot('07_touche_plateau')
    check(G("g.tray.length") == 1, 'toucher le plateau pendant le guidage ne jette pas le verre')
    check(st['nudge'] == 'tapTray', f"correction : « {st['text']} »")
    # 6. il glisse jusqu'au client
    seat = G("g.seats.findIndex(s => s && !s.isAlex)")
    during = drag_tray_to(seat, '07b_glisser_en_cours')
    check(during['step'] == 'drop', f"pendant le glisser : « {during['text']} »")
    shot('08_servi')
    check(G("g.stats.drinks") == 1 and G("g.stats.left") == 0, f"premier service réussi (score {G('g.score')})")
    check(coach()['learned'].get('serve') is True, 'le glisser est retenu')
    # 7. la suite : chaque nouveau geste est guidé une fois, les gestes connus ne le sont plus
    seen = {}
    for i in range(160):
        pg.wait_for_timeout(100)
        st = coach()
        k = st['step']
        if k and k not in seen:
            seen[k] = st['text']; pg.wait_for_timeout(350); shot(f'09_{k}')
        if k in ('tap', 'stoutLaunch', 'stoutReady'):
            d = G("(() => { const s = g.seats.filter(s => s && !s.isAlex && s.phase !== 'leave').sort((a, b) => a.id - b.id); for (const c of s) for (const o of c.orders) if (!o.done && !g.tray.some(x => x.drink === g.need(o.drink))) return g.need(o.drink); return null; })()")
            if d: pg.mouse.click(*station(d)); pg.wait_for_timeout(150)
        elif k is None and G("g.tray.length"):
            seat = G("(() => { const t = g.tray.map(x => x.drink); const s = g.seats.find(s => s && !s.isAlex && s.phase === 'wait' && s.orders.some(o => !o.done && t.includes(g.need(o.drink)))); return s ? s.seat : -1; })()")
            if seat >= 0: drag_tray_to(seat)
        learned = coach()['learned']
        if learned.get('tap') and (prep == 'simple' or learned.get('stout')): break
    print('consignes vues ensuite :', json.dumps(seen, ensure_ascii=False))
    learned = coach()['learned']
    if prep == 'tirage':
        check('tap' in seen and 'stoutLaunch' in seen and 'stoutReady' in seen, 'spritz puis stout (lancer, reprendre) guidés')
        check(learned.get('stout') and learned.get('tap'), f'gestes retenus : {sorted(k for k, v in learned.items() if v)}')
    else:
        check('stoutLaunch' not in seen and 'hold' not in seen, 'mode simple : pas de consigne de tirage')
    check(G("g.stats.left") == 0, f"aucun client parti pendant l'apprentissage (servis : {G('g.stats.drinks')})")
    # 8. partie suivante : plus de guidage pour les gestes appris
    pg.click('#bPause'); pg.wait_for_timeout(300); shot('10_pause')
    widths = pg.evaluate("[...document.querySelectorAll('#sPause .btns button')].map(b => [b.textContent, b.clientWidth, b.scrollWidth])")
    check(all(sw <= cw for _, cw, sw in widths), f'boutons de la pause sans débordement : {widths}')
    pg.click('#bRestart'); pg.wait_for_timeout(2600)
    st = coach(); shot('11_partie2')
    check(st['step'] is None, f"deuxième partie : plus de guidage ({st['step']})")
    b.close()
print('\n'.join(errors) or 'aucune erreur de page')
print('RÉSULTAT :', 'tout est bon' if not fails and not errors else f'{len(fails)} échec(s)')
sys.exit(1 if fails or errors else 0)
