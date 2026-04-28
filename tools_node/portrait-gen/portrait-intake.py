#!/usr/bin/env python3
"""
portrait-intake.py
------------------
自動將 AI 生成的武將立繪做去背、Resize、命名、放入遊戲目錄、建立 .meta 檔。

用法：
  python tools_node/portrait-gen/portrait-intake.py <source_image> <general_id>

範例：
  python tools_node/portrait-gen/portrait-intake.py C:/Users/User/Downloads/Male_warrior_Shu_xxx.png sun-quan
"""

import sys
import os
import json
import uuid

# ── 路徑設定 ──────────────────────────────────────────────────────────────────
ROOT       = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR    = os.path.join(ROOT, 'assets', 'resources', 'sprites', 'generals')
TARGET_W   = 512
TARGET_H   = 768

# ── 引數 ────────────────────────────────────────────────────────────────────────
if len(sys.argv) < 3:
    print("Usage: python portrait-intake.py <source_image> <general_id>")
    print("Example: python portrait-intake.py ~/Downloads/warrior.png sun-quan")
    sys.exit(1)

src_path   = sys.argv[1]
general_id = sys.argv[2].strip()
file_id    = general_id.replace('-', '_')
out_png    = os.path.join(OUT_DIR, f"{file_id}_portrait.png")
out_meta   = out_png + '.meta'

if not os.path.isfile(src_path):
    print(f"ERROR: File not found: {src_path}")
    sys.exit(1)

# ── 匯入 ────────────────────────────────────────────────────────────────────────
try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow")
    sys.exit(1)

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False
    print("WARNING: rembg not found, skipping background removal (pip install 'rembg[cpu]')")

# ── 判斷是否需要去背 ──────────────────────────────────────────────────────────
# 檔名含 _pixian_ai 表示已由 pixian.ai 去背，直接跳過
src_basename   = os.path.splitext(os.path.basename(src_path))[0]
already_nobg   = '_pixian_ai' in src_basename

# ── 去背 ────────────────────────────────────────────────────────────────────────
print(f"[1/4] Reading: {src_path}")
with open(src_path, 'rb') as f:
    raw = f.read()

if already_nobg:
    img = Image.open(src_path).convert('RGBA')
    print("[2/4] Skipped background removal (_pixian_ai already processed)")
elif HAS_REMBG:
    print("[2/4] Removing background with rembg AI...")
    raw = rembg_remove(raw)
    img = Image.open(__import__('io').BytesIO(raw)).convert('RGBA')
else:
    img = Image.open(src_path).convert('RGBA')
    print("[2/4] Skipped background removal (rembg not installed)")

print(f"      Original size: {img.size}")

# ── Resize（保留比例，置中）───────────────────────────────────────────────────
print(f"[3/4] Resizing to {TARGET_W}x{TARGET_H}...")
aspect = img.width / img.height
if aspect > TARGET_W / TARGET_H:
    new_w, new_h = TARGET_W, int(TARGET_W / aspect)
else:
    new_w, new_h = int(TARGET_H * aspect), TARGET_H

img_scaled = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (TARGET_W, TARGET_H), (0, 0, 0, 0))
canvas.paste(img_scaled, ((TARGET_W - new_w) // 2, (TARGET_H - new_h) // 2), img_scaled)

# ── 儲存 PNG ──────────────────────────────────────────────────────────────────
os.makedirs(OUT_DIR, exist_ok=True)
canvas.save(out_png, 'PNG')
print(f"      Saved: {out_png}")

# ── 建立 .meta ────────────────────────────────────────────────────────────────
print("[4/4] Writing .meta file...")
meta = {
    "ver": "1.0.8",
    "importer": "image",
    "imported": True,
    "uuid": str(uuid.uuid4()),
    "displayName": "",
    "id": "",
    "name": f"{file_id}_portrait",
    "userData": {
        "type": "sprite-frame"
    },
    "readonly": False,
    "subMetas": {
        "f9941": {
            "ver": "2.0.3",
            "importer": "sprite-frame",
            "imported": True,
            "uuid": str(uuid.uuid4()),
            "displayName": "",
            "id": "f9941",
            "name": "spriteFrame",
            "userData": {
                "pixelsPerUnit": 100,
                "extrude": 1,
                "meshType": 0,
                "pivot": {"x": 0.5, "y": 0.5},
                "offset": {"x": 0, "y": 0},
                "originalSize": {"width": TARGET_W, "height": TARGET_H},
                "trimSize":     {"width": TARGET_W, "height": TARGET_H},
                "trimOffset":   {"x": 0, "y": 0}
            },
            "readonly": False
        }
    }
}

with open(out_meta, 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)

print(f"      Saved: {out_meta}")
print()
print(f"Done! {general_id} -> {out_png}")
print("Remember to Refresh Assets in Cocos Creator!")
