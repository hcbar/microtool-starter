"""Check exact embedded WASM hash from pinned Mediabunny source checkout."""
import base64
import hashlib
import re
import sys
from pathlib import Path

UPSTREAM_COMMIT = "cce92cb0f131f522295dc0797962fb1f5d3c1f44"
WASM_SHA256 = "a680e507e9d91f1a4dcd6f846b9b94ff1fec7e19ff44e803358c218ddbe446a6"

def validate(path):
    data = Path(path).read_bytes()
    match = re.search(rb'(AGFzbQ[A-Za-z0-9+/=]{100,})', data)
    if not match:
        raise ValueError("embedded wasm unavailable")
    wasm = base64.b64decode(match.group(1), validate=True)
    if wasm[:4] != bytes([0, 97, 115, 109]):
        raise ValueError("invalid WASM signature")
    actual = hashlib.sha256(wasm).hexdigest()
    if actual != WASM_SHA256:
        raise ValueError("WASM hash does not match pinned provenance")
    print(f"PASS upstream={UPSTREAM_COMMIT} sha256={actual} bytes={len(wasm)}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python check-pinned-wasm.py /path/to/build/lame.js")
    validate(sys.argv[1])
