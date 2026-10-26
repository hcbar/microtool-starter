"""Hash installed spike assets and extract the exact embedded LAME WASM.
Optional argument: upstream build/lame.js fetched from the recorded immutable commit.
This compares bytes; it does not verify attestation signatures or license compliance.
"""
import base64, gzip, hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
def digest(data): return hashlib.sha256(data).hexdigest()
def wasm(data):
    match = re.search(rb'base64Decode\("(AGFzbQ[^\"]+)"\)', data)
    if not match: raise ValueError('embedded WASM not found')
    return base64.b64decode(match[1], validate=True)

assets=[]
for name in ['mediabunny/dist/bundles/mediabunny.min.mjs', '@mediabunny/mp3-encoder/dist/bundles/mediabunny-mp3-encoder.mjs']:
    data=(ROOT/'node_modules'/name).read_bytes()
    assets.append({'path':name,'bytes':len(data),'gzip_bytes':len(gzip.compress(data,mtime=0)),'sha256':digest(data)})
binary=wasm((ROOT/'node_modules/@mediabunny/mp3-encoder/dist/modules/build/lame.js').read_bytes())
# The bundle used in Chromium must contain the same binary as the module build.
bundle=(ROOT/'node_modules'/assets[1]['path']).read_bytes()
assert base64.b64encode(binary) in bundle
result={'assets':assets,'total_bytes':sum(a['bytes'] for a in assets),'total_gzip_bytes':sum(a['gzip_bytes'] for a in assets),'embedded_wasm':{'bytes':len(binary),'sha256':digest(binary)}}
if len(sys.argv)>1:
    upstream=wasm(Path(sys.argv[1]).read_bytes())
    assert binary==upstream, 'upstream WASM differs'
    result['upstream_wasm_matches']=True
print(json.dumps(result,indent=2))
