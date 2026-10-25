"""Real-browser functional smoke. Requires Python Playwright and Chromium.

Install for local use: py -m pip install playwright==1.57.0
                     py -m playwright install chromium
Run: py tests/browser-smoke.py
"""
import os
import socket
import subprocess
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HOST = 'http://127.0.0.1:4173'


from browser_smoke_fixture import fixture_png


def wait_port():
    for _ in range(80):
        try:
            with socket.create_connection(('127.0.0.1', 4173), timeout=0.15):
                return
        except OSError:
            time.sleep(.1)
    raise RuntimeError('Local preview did not start')


def main():
    env = dict(os.environ, DEPLOY_TARGET='preview')
    with subprocess.Popen(['node', 'scripts/dev.mjs'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE) as server:
        try:
            wait_port()
            with sync_playwright() as p:
                executable = os.getenv('CHROMIUM_PATH')
                browser = p.chromium.launch(executable_path=executable or None, args=['--no-sandbox'])
                try:
                    browser_requests = []
                    for lang, path in [('en','/'),('pt','/pt/'),('es','/es/')]:
                        page = browser.new_page(viewport={'width':390,'height':844})
                        page.on('request', lambda req: browser_requests.append(req.url))
                        response = page.goto(HOST + path)
                        assert response.status == 200, (lang,response.status)
                        assert page.locator('html').get_attribute('lang').startswith(lang)
                        assert page.locator('meta[name="robots"]').get_attribute('content') == 'noindex,nofollow'
                        assert page.locator('#tool-form').is_visible()
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'horizontal overflow: {lang}'
                        page.close()
                    page = browser.new_page(accept_downloads=True)
                    page.on('request', lambda req: browser_requests.append(req.url))
                    page.goto(HOST)
                    png = fixture_png()
                    assert len(png) > 16*1024
                    page.locator('#file').set_input_files({'name':'test.png','mimeType':'image/png','buffer':png})
                    page.locator('#target').fill('16')
                    page.locator('button[type=submit]').click()
                    page.locator('#download').wait_for(state='visible',timeout=30000)
                    assert '→' in page.locator('#result').inner_text()
                    with page.expect_download() as download_info:
                        page.locator('#download').click()
                    saved = download_info.value
                    assert saved.suggested_filename.endswith('.jpg')
                    path = saved.path()
                    out = Path(path).read_bytes()
                    assert out.startswith(b'\xff\xd8')
                    assert len(out) <= 16*1024, f'JPEG exceeded requested 16 KiB: {len(out)}'
                    # Force a delayed decode, invalidate with input change, reject late publication.
                    page.evaluate('''() => { const old = window.createImageBitmap; window.createImageBitmap = (...args) => new Promise((resolve,reject) => setTimeout(() => old(...args).then(resolve,reject), 400)); }''')
                    page.locator('#target').fill('1')
                    page.locator('button[type=submit]').click()
                    page.locator('#target').fill('2')
                    page.wait_for_timeout(750)
                    assert page.locator('#download').is_hidden(), 'stale download was published after target change'
                    assert page.locator('#status').inner_text() == ''
                    assert not any(not url.startswith(HOST) for url in browser_requests), browser_requests
                    print('Browser smoke OK: en/pt/es mobile, JPEG download, target limit, cancellation, zero external requests')
                finally:
                    browser.close()
        finally:
            server.terminate()
            try: server.wait(timeout=5)
            except subprocess.TimeoutExpired: server.kill()


if __name__ == '__main__':
    main()
