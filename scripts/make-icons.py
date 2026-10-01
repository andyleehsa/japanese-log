#!/usr/bin/env python3
"""Draw simple opaque app icons (no third-party libraries)."""

import struct
import zlib
from pathlib import Path

INDIGO = (36, 48, 86)
CREAM = (246, 241, 231)
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "icons"


def inside_round_rect(px, py, x0, y0, x1, y1, radius):
    if px < x0 or px > x1 or py < y0 or py > y1:
        return False
    cx = x0 + radius if px < x0 + radius else (x1 - radius if px > x1 - radius else None)
    cy = y0 + radius if py < y0 + radius else (y1 - radius if py > y1 - radius else None)
    if cx is None or cy is None:
        return True
    dx = px - cx
    dy = py - cy
    return dx * dx + dy * dy <= radius * radius


def render(size):
    pixels = bytearray(size * size * 3)
    # Full-bleed indigo. The mark sits inside the center 66% so maskable icons crop safely.
    margin = size * 0.17
    radius = size * 0.08
    x0, y0 = margin, margin
    x1, y1 = size - margin, size - margin
    stroke = max(2, round(size * 0.055))
    mark = size * 0.34
    left = (size - mark) / 2
    top = (size - mark) / 2
    right = left + mark
    bottom = top + mark

    def fill(x, y, color):
        if x < 0 or y < 0 or x >= size or y >= size:
            return
        i = (y * size + x) * 3
        pixels[i] = color[0]
        pixels[i + 1] = color[1]
        pixels[i + 2] = color[2]

    def in_bar(px, py, bx0, by0, bx1, by1):
        return bx0 <= px <= bx1 and by0 <= py <= by1

    mid_y = (top + bottom) / 2
    bars = [
        (left, top, left + stroke, bottom),
        (right - stroke, top, right, bottom),
        (left, top, right, top + stroke),
        (left, mid_y - stroke / 2, right, mid_y + stroke / 2),
        (left, bottom - stroke, right, bottom),
    ]

    for y in range(size):
        for x in range(size):
            px = x + 0.5
            py = y + 0.5
            color = INDIGO
            if inside_round_rect(px, py, x0, y0, x1, y1, radius):
                color = CREAM
                for bar in bars:
                    if in_bar(px, py, *bar):
                        color = INDIGO
                        break
            fill(x, y, color)
    return pixels


def write_png(path, size, rgb):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = bytearray()
    stride = size * 3
    for y in range(size):
        raw.append(0)
        start = y * stride
        raw.extend(rgb[start:start + stride])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        32: OUT_DIR / "icon-32.png",
        180: OUT_DIR / "apple-touch-icon.png",
        192: OUT_DIR / "icon-192.png",
        512: OUT_DIR / "icon-512.png",
    }
    for size, path in outputs.items():
        write_png(path, size, render(size))
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
