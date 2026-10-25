import struct
import zlib

def fixture_png(width=512, height=512):
    # Deterministic noisy PNG; no Pillow or third-party fixtures required.
    def chunk(tag, payload):
        return struct.pack('>I', len(payload)) + tag + payload + struct.pack('>I', zlib.crc32(tag + payload) & 0xFFFFFFFF)
    pixels = bytearray()
    state = 0xBADC0DE
    for _ in range(height):
        pixels.append(0)
        for _ in range(width * 3):
            state ^= (state << 13) & 0xFFFFFFFF
            state ^= state >> 17
            state ^= (state << 5) & 0xFFFFFFFF
            pixels.append(state & 255)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(pixels), level=6)) + chunk(b'IEND', b''))

