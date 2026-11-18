# Browser smoke test: load dist/index.html, start a campaign, click through prompts
# with a simple policy, capture console errors and screenshots.
import sys, json, time, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[2]
url = (root / 'dist' / 'index.html').as_uri()
camp = sys.argv[1] if len(sys.argv) > 1 else 'US'
steps = int(sys.argv[2]) if len(sys.argv) > 2 else 400
shots = root / 'tests' / 'browser' / 'shots'; shots.mkdir(exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1400, 'height': 1000})
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto(url)
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.screenshot(path=str(shots / f'{camp}_00_setup.png'))
    if camp == 'BR':
        pg.click("button:has-text('British Solo Campaign')")
    pg.click("text=Start campaign")
    n = 0; shot = 1; pkg_shot = False
    titles = []
    while n < steps:
        n += 1
        st = pg.evaluate("G_STATE && G_STATE.over")
        if st: break
        kind = pg.evaluate("G_STATE.prompt && G_STATE.prompt.kind")
        title = pg.evaluate("G_STATE.prompt && G_STATE.prompt.title")
        titles.append(title)
        if n in (1, 2, 3, 5, 8, 12, 20, 30, 45, 60, 90, 120) or kind in ('assign','lineup') and shot < 25:
            pg.screenshot(path=str(shots / f'{camp}_{shot:02d}_{kind}.png'), full_page=False); shot += 1
        if kind == 'info':
            pg.click('#btn-ok')
        elif kind == 'choice':
            btn = pg.query_selector('#proc .opts button.primary') or pg.query_selector('#proc .opts button') or pg.query_selector('#proc .optcard')
            btn.click()
        elif kind == 'select':
            if pg.evaluate("!!G_STATE.prompt.pkg"):
                pg.fill('.banner input[type=number]', '6')
                pg.click("text=Auto-fill")
                if not pkg_shot:
                    pg.screenshot(path=str(shots / f'{camp}_pkg.png')); pkg_shot = True
            pg.click("#proc button.primary")
        elif kind == 'lineup':
            pg.click("#proc button.primary")
        elif kind == 'assign':
            # add one patrol force with the first two ships
            pg.click("text=+ Add Force")
            for k in range(2):
                chips = pg.query_selector_all('.asg-ship:not(.on):not(.taken)')
                if chips: chips[0].click()
            pg.click("text=Confirm assignments")
        else:
            print('unknown', kind); break
        err = pg.evaluate("UI.err")
        if err:
            print('UI error at', title, ':', err); break
    pg.screenshot(path=str(shots / f'{camp}_99_end.png'), full_page=False)
    print('steps', n, 'over', pg.evaluate("G_STATE.over"), 'turn', pg.evaluate("G_STATE.turn"))
    print('errors', errors[:10])
    b.close()
