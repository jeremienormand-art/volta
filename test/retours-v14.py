# Retours de Jonathan (v1.4) : apprentissage en pause, IPA trop vide refusée puis complétée.
# A. Nouveau venu (guidage actif) : pendant chaque consigne, le chrono et la patience ne bougent pas, l'écran est grisé.
#    Il relâche l'IPA trop tôt : le verre part à moitié vide sur le plateau, le client la refuse, il la complète, il sert.
# B. Joueur qui connaît les gestes (plus de guidage) : le temps tourne, une IPA trop vide est refusée de la même façon.
# Usage : python3 test/retours-v14.py [largeur hauteur]  → captures v14_* dans test/out/
import sys, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent; out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
body = (root / 'dist' / 'galopins-arcade.html').read_text()
(out / 'page.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>')
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (360, 740)
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
    lp = lambda x, y: pg.evaluate(f"(() => {{ const f = document.getElementById('frame').getBoundingClientRect(); const s = f.width/360; return [f.left + {x}*s, f.top + {y}*s]; }})()")
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__galopins.game; return {js}; }})()")
    coach = lambda: pg.evaluate("window.__galopins.coach")
    shot = lambda name: pg.screenshot(path=str(out / f'v14_{name}_{W}.png'))
    def geo():
        Hh = pg.evaluate("(() => { const f = document.getElementById('frame').getBoundingClientRect(); return f.height/(f.width/360); })()")
        return Hh - 24 - 75, Hh - 24 - 150 - 34
    def hold_ipa(ms=None, until=None, name=None):
        stY, _ = geo(); x, y = lp(45 + 90 * G("g.layout.indexOf('ipa')"), stY)
        if name: G("(g.cfg.slowmo = 0.25, 0)")   # la capture prend du temps : on ralentit pour ne pas dépasser la zone visée
        pg.mouse.move(x, y); pg.mouse.down()
        if ms: pg.wait_for_timeout(ms / (0.25 if name else 1))
        else:
            for i in range(120):
                pg.wait_for_timeout(12)
                if G("g.st.ipa.fill") >= until: break
        if name: shot(name)
        pg.mouse.up(); pg.wait_for_timeout(250)
        if name: G("(g.cfg.slowmo = 1, 0)")
    def drag_tray_to(seat, name=None):
        _, trayY = geo(); x, y = lp(280, trayY); cx, cy = lp(45 + 90 * seat, 250)
        pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y - 40, steps=4); pg.mouse.move(cx, cy, steps=8)
        pg.wait_for_timeout(120); pg.mouse.up(); pg.wait_for_timeout(180)
        if name: shot(name)
    first_seat = lambda: G("g.seats.findIndex(s => s && !s.isAlex)")
    patience = lambda: G("(() => { const s = g.seats.find(s => s && !s.isAlex); return s ? s.patience : null; })()")

    # ── A. nouveau venu ──
    pg.evaluate("localStorage.clear(); localStorage.setItem('ga1.cfg2', JSON.stringify({seed:4242, prep:'tirage'}))")
    pg.reload(); pg.wait_for_timeout(500)
    pg.click('#bStart'); pg.wait_for_timeout(2600)
    st = coach(); t0, p0 = G("g.t"), patience()
    check(st['step'] == 'hold' and st['paused'], f"première consigne « {st['text']} », jeu en pause d'apprentissage")
    pg.wait_for_timeout(4000)
    st = coach(); t1, p1 = G("g.t"), patience(); shot('A1_pause')
    check(abs(t1 - t0) < 0.02, f"chrono arrêté pendant la consigne : {t0:.2f} s → {t1:.2f} s après 4 s")
    check(abs(p1 - p0) < 0.02, f"patience du client figée : {p0:.1f} → {p1:.1f}")
    check(st['spot'] > 0.9, f"reste de l'écran grisé (voile {st['spot']:.2f})")
    # relâche trop tôt
    hold_ipa(ms=180, name='A2_maintiens')
    tray = G("g.tray.map(x => ({q: x.q, fill: +x.fill.toFixed(2)}))")
    check(len(tray) == 1 and tray[0]['q'] == 'low' and 0.15 < tray[0]['fill'] < 0.62, f"relâchée trop tôt : le verre part sur le plateau, niveau réel {tray}")
    st = coach(); shot('A3_trop_vide')
    check(st['step'] == 'hold' and st['text'] == 'Pas assez remplie !', f"le coach reste sur l'IPA : « {st['text']} »")
    check(not coach()['learned'].get('hold'), "le tirage n'est pas encore compté comme appris")
    # il essaie quand même de la servir
    drag_tray_to(first_seat(), 'A4_refus')
    check(G("g.tray.length") == 1 and G("g.stats.drinks") == 0 and G("g.stats.refused") == 1, f"le client refuse, le verre reste sur le plateau (servis {G('g.stats.drinks')}, refus {G('g.stats.refused')})")
    check(G("g.seats.some(s => s && s.complainT > 0)"), "le client dit « Pas assez remplie ! »")
    check(abs(G("g.t") - t0) < 0.05, "toujours en pause pendant la correction")
    # il la complète
    hold_ipa(until=0.9, name='A5_lache')
    tray = G("g.tray.map(x => ({q: x.q, fill: +x.fill.toFixed(2)}))")
    check(len(tray) == 1 and tray[0]['q'] == 'perfect', f"remise sous la tireuse, elle est complétée dans la zone rose : {tray}")
    check(G("g.stats.topUps") == 1, "c'est le même verre (complété, pas un nouveau)")
    pg.wait_for_timeout(500); shot('A6_glisse')
    drag_tray_to(first_seat(), 'A7_servi')
    check(G("g.stats.drinks") == 1 and G("g.stats.perfect") == 1, f"pinte parfaite servie (score {G('g.score')})")
    # entre deux consignes, le temps reprend
    tA = G("g.t")
    for i in range(40):
        pg.wait_for_timeout(100)
        if not coach()['paused']: break
    pg.wait_for_timeout(600)
    check(coach()['paused'] or G("g.t") > tA + 0.3, f"sans consigne, le chrono repart ({tA:.2f} → {G('g.t'):.2f} s)")
    # suite de l'apprentissage : chaque nouvelle consigne remet la pause
    paused_seen, moved_during = 0, False
    for i in range(120):
        pg.wait_for_timeout(100)
        st = coach()
        if st['paused']:
            ta = G("g.t"); pg.wait_for_timeout(400)
            if G("g.t") - ta > 0.02: moved_during = True
            paused_seen += 1
            stY, _ = geo()
            d = G("(() => { const s = g.seats.filter(s => s && !s.isAlex && s.phase !== 'leave').sort((a, b) => a.id - b.id); for (const c of s) for (const o of c.orders) if (!o.done && !g.tray.some(x => x.drink === g.need(o.drink))) return g.need(o.drink); return null; })()")
            if st['step'] in ('tap', 'stoutLaunch', 'stoutReady') and d:
                if paused_seen == 1: shot('A8_consigne_' + st['step'])
                pg.mouse.click(*lp(45 + 90 * G(f"g.layout.indexOf('{d}')"), stY)); pg.wait_for_timeout(150)
        elif G("g.tray.length"):
            seat = G("(() => { const t = g.tray.filter(x => x.q !== 'low').map(x => x.drink); const s = g.seats.find(s => s && !s.isAlex && s.phase === 'wait' && s.orders.some(o => !o.done && t.includes(g.need(o.drink)))); return s ? s.seat : -1; })()")
            if seat >= 0: drag_tray_to(seat)
        l = coach()['learned']
        if l.get('tap') and l.get('stout') and not coach()['paused']: break
    check(paused_seen > 0 and not moved_during, f"spritz et stout : le chrono reste arrêté pendant leurs consignes ({paused_seen} relevés)")
    check(G("g.stats.left") == 0, "personne n'est parti pendant l'apprentissage")
    print('temps d’apprentissage (chrono arrêté) :', round(G("g.stats.learnPause"), 1), 's')

    # ── B. joueur qui connaît les gestes ──
    pg.evaluate("localStorage.setItem('ga1.learn1', JSON.stringify({hold:true, tap:true, stout:true, serve:true}))")
    pg.reload(); pg.wait_for_timeout(500)
    pg.click('#bStart'); pg.wait_for_timeout(2200)
    t0 = G("g.t"); pg.wait_for_timeout(600)
    check(G("g.t") > t0 + 0.3 and not coach()['paused'], f"plus de guidage : le chrono tourne ({t0:.2f} → {G('g.t'):.2f} s)")
    check(coach()['spot'] < 0.05, "plus de voile gris")
    hold_ipa(ms=200)
    tray = G("g.tray.map(x => ({q: x.q, fill: +x.fill.toFixed(2)}))")
    check(len(tray) == 1 and tray[0]['q'] == 'low', f"IPA trop vide sur le plateau : {tray}")
    pg.wait_for_timeout(300); shot('B1_plateau_trop_vide')
    drag_tray_to(first_seat(), 'B2_refus')
    check(G("g.tray.length") == 1 and G("g.stats.refused") == 1 and G("g.stats.drinks") == 0, "refusée, elle reste sur le plateau")
    st = G("g.seats.find(s => s && s.complainT > 0) ? true : false")
    check(st, "le client dit « Pas assez remplie ! »")
    hold_ipa(until=0.7)
    q = G("g.tray.map(x => x.q).join()")
    check(q == 'ok', f"complétée hors zone rose mais assez remplie : acceptable ({q})")
    drag_tray_to(first_seat())
    check(G("g.stats.drinks") == 1 and G("g.stats.ok") == 1, f"pinte suffisamment remplie acceptée (score {G('g.score')})")
    b.close()
print('\n'.join(errors) or 'aucune erreur de page')
print('RÉSULTAT :', 'tout est bon' if not fails and not errors else f'{len(fails)} échec(s)')
sys.exit(1 if fails or errors else 0)
