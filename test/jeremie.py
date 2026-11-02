# Contrôle qualité de Jérémie (v1.26) : carton, attente, verdicts (à refaire, à revoir, approuvé, pompette), bandeau du bonus, addition.
# v1.34 : une pinte dorée tirée avant son arrivée est refusée (« stale »), sans être goûtée, et reste sur le plateau.
# v1.35 : pompette, il valide un shot (easter egg) ; captures jer_pompette_shot et jer_pompette_approuve.
# v1.37 : le shot passe avant l'IPA sur le plateau et rapporte +300 (« Roh bon allez, p'tit bonus pour toi ! »).
# python3 test/jeremie.py [largeur hauteur] → captures jer_* dans test/out/
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
    pg.on('console', lambda m: m.type == 'error' and errors.append(f'console: {m.text}'))
    pg.goto((out / 'page.html').as_uri()); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.clear(); localStorage.setItem('ga1.cfg2', JSON.stringify({seed:4242, testButtons:true, hints:false, menu:'alex'}))")
    pg.reload(); pg.wait_for_timeout(800)
    G = lambda js: pg.evaluate(f"(() => {{ const g = window.__galopins.game; return {js}; }})()")
    shot = lambda name: pg.screenshot(path=str(out / f'jer_{name}_{W}.png'))
    def jer():
        return G("(() => { const s = g.seats.find(x => x && x.isJer); return s ? {seat:s.seat, phase:s.phase, tipsy:s.tipsy, tries:s.tries} : null })()")
    def wait_phase(ph, n=80):
        for i in range(n):
            st = jer()
            if st and st['phase'] == ph: return st
            pg.wait_for_timeout(100)
        return jer()
    def give(q, fill, avance=False, drink='ipa'):   # avance : pinte tirée avant l'arrivée de Jérémie
        st = wait_phase('wait')
        at = '0' if avance else '++g.pours'
        G(f"(g.tray.length = 0, g.tray.push({{drink:'{drink}', q:'{q}', fill:{fill}, at:{at}}}), 0)")
        print('  service', q, G(f"g.serve({st['seat']})"))
    def force():
        for i in range(200):
            if G("g.forceJeremie()"): return True
            pg.wait_for_timeout(100)
        return False

    pg.click('#bStart'); pg.wait_for_timeout(2600)
    # 1. premier passage : carton (attend un toucher), puis il attend sa pinte
    print('force', force()); pg.wait_for_timeout(1700)
    shot('carton'); print('carton', G("({hold:g.hold, kind:g.cut && g.cut.kind})"))
    G("g.releaseHold()"); pg.wait_for_timeout(1300)
    wait_phase('wait'); pg.wait_for_timeout(400); shot('attente')
    # pinte dorée tirée d'avance : refusée sans être goûtée, elle reste sur le plateau
    give('perfect', 0.93, avance=True); pg.wait_for_timeout(350); shot('avance')
    print('  après la pinte d’avance :', jer(), '| plateau', G("g.tray.length"))
    # pinte pas parfaite deux fois : à refaire, puis à revoir
    give('ok', 0.72); pg.wait_for_timeout(500); shot('goute')
    wait_phase('reject'); pg.wait_for_timeout(250); shot('a_refaire')
    give('ok', 0.7); wait_phase('reject'); pg.wait_for_timeout(250); shot('a_revoir')
    print('verdicts', G("g.stats.jeremieVerdicts"))
    # 2. second passage : pompette, il valide n'importe quel verre (v1.35) : ici un shot
    for i in range(60):
        if not jer(): break
        pg.wait_for_timeout(100)
    print('force 2', force()); wait_phase('wait'); pg.wait_for_timeout(1200); shot('pompette_attente')
    st = wait_phase('wait'); sc0 = G("g.score")
    G("(g.tray.length = 0, g.tray.push({drink:'ipa', q:'ok', fill:0.7, at:++g.pours}), g.tray.push({drink:'shot', q:'ok', fill:1, at:++g.pours}), 0)")
    print('  service ipa + shot', G(f"g.serve({st['seat']})"), '| reste', G("g.tray.map(t => t.drink)")); pg.wait_for_timeout(500); shot('pompette_shot')
    wait_phase('approve'); pg.wait_for_timeout(250); shot('pompette_approuve')
    print('  easter egg (shot validé) :', G("g.stats.jeremieOdd"), '| bonus du shot :', G("g.score") - sc0, '(attendu 300)')
    pg.wait_for_timeout(2200); shot('bonus')
    print('bonus', G("g.jer.boost"), 'verdicts', G("g.stats.jeremieVerdicts"))
    # 3. nouvelle partie : pinte parfaite, approuvée sobre ; on sert trois clients avec le bonus
    G("(g.t = g.cfg.duration - 0.2, 0)"); pg.wait_for_timeout(3500)
    shot('addition'); print('addition', pg.evaluate("document.getElementById('eStats').innerText.replace(/\\n/g,' | ')"))
    pg.click('#bReplay'); pg.wait_for_timeout(2600)
    print('force 3', force()); pg.wait_for_timeout(2400)   # carton sans attente : déjà vu
    give('perfect', 0.93); wait_phase('approve'); pg.wait_for_timeout(250); shot('approuve')
    print('bonus', G("g.jer.boost"))
    b.close()
print('\n'.join(errors) or 'aucune erreur')
