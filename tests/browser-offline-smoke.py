"""Sandbox-only fallback: real Chromium file compressor with inline source, no HTTP.

Does not replace the CI HTTP browser integration test. Useful in restricted
browser sandboxes that return ERR_BLOCKED_BY_ADMINISTRATOR to every navigation.
"""
import os
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_smoke_fixture import fixture_png

ROOT=Path(__file__).resolve().parents[1]

def main():
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH') or None, args=['--no-sandbox'])
        try:
            image=(ROOT/'src/image.js').read_text().replace('export async function compressImageToTarget', 'async function compressImageToTarget')
            app=(ROOT/'src/app.js').read_text().replace("import { compressImageToTarget } from './image.js';", '')
            for locale, route in [('en','index.html'),('pt','pt/index.html'),('es','es/index.html')]:
                page=b.new_page(viewport={'width':390,'height':844},accept_downloads=True)
                html=(ROOT/'dist'/route).read_text()
                html=html.replace('<script type="module" src="/assets/app.js"></script>','').replace('<link rel="stylesheet" href="/assets/style.css">','')
                page.set_content(html)
                page.add_style_tag(content=(ROOT/'src/style.css').read_text())
                page.add_script_tag(content=image)
                page.add_script_tag(content=app)
                page.evaluate('''() => { window.__revokedURLs = []; const f = URL.revokeObjectURL; URL.revokeObjectURL = u => { window.__revokedURLs.push(u); return f.call(URL,u); }; }''')
                assert page.locator('meta[name="robots"]').get_attribute('content')=='noindex,nofollow'
                assert page.locator('html').get_attribute('lang').startswith(locale)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                if locale=='en':
                    file=fixture_png()
                    page.locator('#file').set_input_files({'name':'test.png','mimeType':'image/png','buffer':file})
                    page.locator('#target').fill('16')
                    page.locator('button').click()
                    page.locator('#download').wait_for(state='visible',timeout=30000)
                    with page.expect_download() as info:page.locator('#download').click()
                    out=Path(info.value.path()).read_bytes()
                    assert out[:2]==b'\xff\xd8' and len(out)<=16384,(out[:2],len(out))
                    # Previously a fake, small JPEG bypassed the decoder entirely.
                    page.locator('#file').set_input_files({'name':'fake.jpg','mimeType':'image/jpeg','buffer':b'not a jpeg'})
                    assert page.evaluate('window.__revokedURLs.length') >= 1, 'prior Blob URL not revoked'
                    page.locator('button').click()
                    page.locator('#status').get_by_text('Could not process',exact=False).wait_for(timeout=10000)
                    assert page.locator('#download').is_hidden()
                    page.locator('#file').set_input_files({'name':'small.jpg','mimeType':'image/jpeg','buffer':out})
                    page.locator('#target').fill('128')
                    page.locator('button').click()
                    page.locator('#download').wait_for(state='visible',timeout=30000)
                    with page.expect_download() as info2:page.locator('#download').click()
                    out2=Path(info2.value.path()).read_bytes()
                    assert out2[:2]==b'\xff\xd8',out2[:2]
                    page.locator('#file').set_input_files({'name':'test.png','mimeType':'image/png','buffer':file})
                    # Hold native decode and change input before completion: no stale download.
                    page.evaluate('''() => {const original=window.createImageBitmap;window.createImageBitmap=(...a)=>new Promise((ok,bad)=>setTimeout(()=>original(...a).then(ok,bad),450));}''')
                    page.locator('#target').fill('1')
                    page.locator('button').click()
                    page.locator('#target').fill('2')
                    page.wait_for_timeout(900)
                    assert page.locator('#download').is_hidden()
                    assert page.locator('#status').inner_text()==''
                    print(f'Chromium offline: actual JPEG generated ({len(out)} bytes), stale result suppressed')
                page.close()
            print('Chromium offline smoke: 3 locales and responsive layout OK; no HTTP/navigation tested')
        finally:b.close()

if __name__=='__main__':main()
