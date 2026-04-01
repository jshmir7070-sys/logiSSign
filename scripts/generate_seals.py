"""
logiSSign 한국 전통 도장(인감) 생성기 — Pillow 기반

[일반 도장] 양각 원형 8가지 서체
[법인 도장] 이중 원 구조 (외곽 원호에 회사명 + ★, 내곽에 직함)

사용법:
  pip install Pillow
  python scripts/generate_seals.py
  python scripts/generate_seals.py --name 홍길동인 --output output/seals
  python scripts/generate_seals.py --type corporate --company "주식회사 로지사인" --title 대표이사인
"""

import os
import sys
import math
import random
import argparse
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow 미설치 → pip install Pillow")
    sys.exit(1)


# ═══════════════════ 설정 ═══════════════════

SEAL_COLOR = (196, 43, 43, 255)       # #C42B2B
SEAL_COLOR_DARK = (154, 31, 31, 255)  # #9A1F1F
SEAL_SIZE = 400

FONT_DIR = "C:/Windows/Fonts"
FONT_MAP = {
    "batang":     os.path.join(FONT_DIR, "batang.ttc"),
    "gulim":      os.path.join(FONT_DIR, "gulim.ttc"),
    "malgun":     os.path.join(FONT_DIR, "malgun.ttf"),
    "malgunbd":   os.path.join(FONT_DIR, "malgunbd.ttf"),
    "ngulim":     os.path.join(FONT_DIR, "NGULIM.TTF"),
    "noto_serif": os.path.join(FONT_DIR, "NotoSerifKR-VF.ttf"),
    "noto_sans":  os.path.join(FONT_DIR, "NotoSansKR-VF.ttf"),
}

# ── 일반 도장 8가지 스타일 ──
PERSONAL_STYLES = [
    {"id": "gibon",   "name": "기본체", "font_key": "batang",     "size_ratio": 0.38, "stroke_passes": 6,  "border_w": 0.035, "gap_ratio": 0.42},
    {"id": "myeongjo","name": "명조체", "font_key": "noto_serif", "size_ratio": 0.36, "stroke_passes": 7,  "border_w": 0.040, "gap_ratio": 0.40},
    {"id": "gothic",  "name": "고딕체", "font_key": "malgunbd",   "size_ratio": 0.35, "stroke_passes": 9,  "border_w": 0.040, "gap_ratio": 0.40},
    {"id": "gulim",   "name": "둥근체", "font_key": "gulim",      "size_ratio": 0.36, "stroke_passes": 6,  "border_w": 0.035, "gap_ratio": 0.42},
    {"id": "heavy",   "name": "중후체", "font_key": "batang",     "size_ratio": 0.34, "stroke_passes": 12, "border_w": 0.050, "gap_ratio": 0.38},
    {"id": "elegant", "name": "세필체", "font_key": "noto_serif", "size_ratio": 0.40, "stroke_passes": 3,  "border_w": 0.025, "gap_ratio": 0.44},
    {"id": "modern",  "name": "모던체", "font_key": "noto_sans",  "size_ratio": 0.35, "stroke_passes": 7,  "border_w": 0.035, "gap_ratio": 0.40, "inner_border": True},
    {"id": "classic", "name": "고전체", "font_key": "batang",     "size_ratio": 0.35, "stroke_passes": 8,  "border_w": 0.030, "gap_ratio": 0.40, "double_border": True},
]

# ── 법인 도장 4가지 스타일 ──
CORPORATE_STYLES = [
    {"id": "corp_batang",  "name": "바탕 법인인감", "font_key": "batang",     "stroke_passes": 7,  "outer_bw": 0.035, "inner_bw": 0.020},
    {"id": "corp_serif",   "name": "명조 법인인감", "font_key": "noto_serif", "stroke_passes": 8,  "outer_bw": 0.040, "inner_bw": 0.022},
    {"id": "corp_gothic",  "name": "고딕 법인인감", "font_key": "malgunbd",   "stroke_passes": 10, "outer_bw": 0.040, "inner_bw": 0.022},
    {"id": "corp_classic", "name": "고전 법인인감", "font_key": "batang",     "stroke_passes": 6,  "outer_bw": 0.030, "inner_bw": 0.018},
]


# ═══════════════════ 폰트 헬퍼 ═══════════════════

def load_font(font_key: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    path = FONT_MAP.get(font_key, "")
    if os.path.exists(path):
        try:
            return ImageFont.truetype(path, size, index=index)
        except Exception:
            pass
    for fb in ["batang", "malgunbd", "noto_serif", "malgun"]:
        fb_path = FONT_MAP.get(fb, "")
        if os.path.exists(fb_path):
            try:
                return ImageFont.truetype(fb_path, size)
            except Exception:
                continue
    return ImageFont.load_default()


# ═══════════════════ 두꺼운 글자 ═══════════════════

def draw_thick_char(draw, char, cx, cy, font, color, passes=6):
    """다중 오프셋으로 두꺼운 전각풍 글자 렌더링."""
    bbox = font.getbbox(char)
    cw = bbox[2] - bbox[0]
    ch = bbox[3] - bbox[1]
    x = cx - cw // 2 - bbox[0]
    y = cy - ch // 2 - bbox[1]
    for dx in range(-passes, passes + 1):
        for dy in range(-passes, passes + 1):
            if dx * dx + dy * dy <= passes * passes:
                draw.text((x + dx, y + dy), char, font=font, fill=color)


def draw_thick_text_centered(draw, text, cx, cy, font, color, passes=6):
    """여러 글자를 중앙 정렬하여 두껍게 렌더링."""
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = cx - tw // 2 - bbox[0]
    y = cy - th // 2 - bbox[1]
    for dx in range(-passes, passes + 1):
        for dy in range(-passes, passes + 1):
            if dx * dx + dy * dy <= passes * passes:
                draw.text((x + dx, y + dy), text, font=font, fill=color)


# ═══════════════════ 원호 텍스트 ═══════════════════

def draw_char_on_arc(image, char, cx, cy, radius, angle_deg, font, color, passes=4):
    """
    원호 위에 글자 하나를 배치 (회전 포함).
    angle_deg: 12시 방향=0, 시계방향 양수
    """
    angle_rad = math.radians(angle_deg - 90)
    tx = cx + radius * math.cos(angle_rad)
    ty = cy + radius * math.sin(angle_rad)

    bbox = font.getbbox(char)
    cw = bbox[2] - bbox[0] + passes * 4
    ch = bbox[3] - bbox[1] + passes * 4

    char_size = max(cw, ch) + passes * 2 + 20
    char_img = Image.new("RGBA", (char_size, char_size), (0, 0, 0, 0))
    char_draw = ImageDraw.Draw(char_img)

    ccx = char_size // 2
    ccy = char_size // 2
    draw_thick_char(char_draw, char, ccx, ccy, font, color, passes)

    rotated = char_img.rotate(-angle_deg, resample=Image.BICUBIC, expand=False)

    paste_x = int(tx - rotated.width / 2)
    paste_y = int(ty - rotated.height / 2)
    image.paste(rotated, (paste_x, paste_y), rotated)


# ═══════════════════ 잉크 질감 ═══════════════════

def add_ink_texture(image, intensity=0.08):
    pixels = image.load()
    w, h = image.size
    cx, cy = w // 2, h // 2
    max_dist = math.sqrt(cx * cx + cy * cy)
    for py in range(h):
        for px in range(w):
            r, g, b, a = pixels[px, py]
            if a > 0:
                n = random.random()
                if n < intensity * 0.5:
                    a = max(0, a - random.randint(40, 140))
                elif n < intensity * 1.0:
                    a = max(0, a - random.randint(10, 50))
                elif n < intensity * 1.8:
                    a = max(0, a - random.randint(0, 15))
                dist = math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / max_dist
                if dist > 0.78 and random.random() < 0.25:
                    a = max(0, a - random.randint(20, 70))
                pixels[px, py] = (r, g, b, a)
    return image


def draw_circle_border(draw, cx, cy, radius, width, color):
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.ellipse(bbox, outline=color, width=width)


# ═══════════════════ 일반 도장 생성 ═══════════════════

def create_personal_seal(text, style, size=SEAL_SIZE):
    image = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    cx, cy = size // 2, size // 2
    margin = int(size * 0.06)
    bw = max(2, int(size * style["border_w"]))
    outer_r = (size // 2) - margin

    draw_circle_border(draw, cx, cy, outer_r, bw, SEAL_COLOR)
    if style.get("double_border"):
        draw_circle_border(draw, cx, cy, outer_r - int(bw * 2), max(1, bw // 2), SEAL_COLOR)
    if style.get("inner_border"):
        draw_circle_border(draw, cx, cy, int((outer_r - bw) * 0.92), max(1, bw // 3), SEAL_COLOR)

    chars = text.replace(" ", "")
    fs = int(size * style["size_ratio"])
    font = load_font(style["font_key"], fs)
    p = style["stroke_passes"]
    inner_r = outer_r - bw
    gap = int(inner_r * style["gap_ratio"])

    if len(chars) == 1:
        big_font = load_font(style["font_key"], int(fs * 1.8))
        draw_thick_char(draw, chars[0], cx, cy, big_font, SEAL_COLOR, p)
    elif len(chars) == 2:
        draw_thick_char(draw, chars[0], cx, cy - gap, font, SEAL_COLOR, p)
        draw_thick_char(draw, chars[1], cx, cy + gap, font, SEAL_COLOR, p)
    elif len(chars) == 3:
        f3 = load_font(style["font_key"], int(fs * 0.9))
        g3 = int(inner_r * style["gap_ratio"] * 0.85)
        draw_thick_char(draw, chars[0], cx, cy - g3, f3, SEAL_COLOR, p)
        draw_thick_char(draw, chars[1], cx - g3, cy + int(g3 * 0.8), f3, SEAL_COLOR, p)
        draw_thick_char(draw, chars[2], cx + g3, cy + int(g3 * 0.8), f3, SEAL_COLOR, p)
    elif len(chars) == 4:
        draw_thick_char(draw, chars[0], cx + gap, cy - gap, font, SEAL_COLOR, p)
        draw_thick_char(draw, chars[1], cx + gap, cy + gap, font, SEAL_COLOR, p)
        draw_thick_char(draw, chars[2], cx - gap, cy - gap, font, SEAL_COLOR, p)
        draw_thick_char(draw, chars[3], cx - gap, cy + gap, font, SEAL_COLOR, p)
    else:
        half = math.ceil(len(chars) / 2)
        f5 = load_font(style["font_key"], int(fs * 0.7))
        col_gap = int(inner_r * 0.35)
        row_gap = int(inner_r * 0.30)
        for i in range(half):
            y_off = (i - (half - 1) / 2) * row_gap
            draw_thick_char(draw, chars[i], cx + col_gap, cy + int(y_off), f5, SEAL_COLOR, p)
        for i in range(half, len(chars)):
            y_off = (i - half - (len(chars) - half - 1) / 2) * row_gap
            draw_thick_char(draw, chars[i], cx - col_gap, cy + int(y_off), f5, SEAL_COLOR, p)

    # 원형 마스크
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r], fill=255)
    image.putalpha(Image.composite(image.getchannel("A"), Image.new("L", (size, size), 0), mask))
    return add_ink_texture(image)


# ═══════════════════ 법인 도장 생성 ═══════════════════

def create_corporate_seal(company_name, center_title, style, size=SEAL_SIZE):
    """
    법인 인감도장 — 이중 원 구조
    바깥 원호: ★ + 회사명 + ★
    안쪽 원: 직함 (대표이사인 등) — 십자 구분선 + 2×2/세로 배치
    """
    image = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    cx, cy = size // 2, size // 2
    margin = int(size * 0.06)

    outer_bw = max(3, int(size * style["outer_bw"]))
    inner_bw = max(2, int(size * style["inner_bw"]))
    outer_r = (size // 2) - margin
    inner_r = int(outer_r * 0.55)

    # ── 1. 이중 원 ──
    draw_circle_border(draw, cx, cy, outer_r, outer_bw, SEAL_COLOR)
    draw_circle_border(draw, cx, cy, inner_r, inner_bw, SEAL_COLOR)

    # ── 2. 외곽 원호에 회사명 배치 ──
    ring_r = (outer_r + inner_r) // 2
    ring_font_size = int((outer_r - inner_r) * 0.55)
    ring_font = load_font(style["font_key"], ring_font_size)
    star_font = load_font(style["font_key"], int(ring_font_size * 0.5))
    passes_ring = max(2, style["stroke_passes"] // 2)

    company_chars = company_name.replace(" ", "")
    total_items = len(company_chars) + 2  # ★ + 글자들 + ★

    # 위쪽 반원 약 170도 범위에 배치
    arc_span = min(170 + len(company_chars) * 3, 300)
    char_step = arc_span / total_items
    start_angle = -(arc_span / 2)

    # ★ 시작
    draw_char_on_arc(image, '★', cx, cy, ring_r,
                     start_angle + char_step * 0.5,
                     star_font, SEAL_COLOR, passes_ring)

    # 회사명 글자들
    for i, ch in enumerate(company_chars):
        angle = start_angle + char_step * (i + 1.5)
        draw_char_on_arc(image, ch, cx, cy, ring_r,
                         angle, ring_font, SEAL_COLOR, passes_ring)

    # ★ 끝
    draw_char_on_arc(image, '★', cx, cy, ring_r,
                     start_angle + char_step * (len(company_chars) + 1.5),
                     star_font, SEAL_COLOR, passes_ring)

    # ── 3. 내곽 원 안에 직함 배치 ──
    draw = ImageDraw.Draw(image)  # paste 후 다시 생성
    title_chars = center_title.replace(" ", "")
    title_fs = int(inner_r * 0.55)
    title_font = load_font(style["font_key"], title_fs)
    tp = style["stroke_passes"]
    usable_ir = inner_r - inner_bw * 2

    if len(title_chars) >= 4:
        # 십자 구분선
        line_w = max(1, inner_bw)
        ext = int(usable_ir * 0.82)
        draw.line([(cx - ext, cy), (cx + ext, cy)], fill=SEAL_COLOR, width=line_w)
        draw.line([(cx, cy - ext), (cx, cy + ext)], fill=SEAL_COLOR, width=line_w)

    if len(title_chars) <= 3:
        fs = int(usable_ir * 0.65)
        tf = load_font(style["font_key"], fs)
        spacing = int(fs * 1.0)
        total_h = len(title_chars) * spacing
        start_y = cy - total_h // 2 + spacing // 2
        for i, ch in enumerate(title_chars):
            draw_thick_char(draw, ch, cx, start_y + i * spacing, tf, SEAL_COLOR, tp)

    elif len(title_chars) == 4:
        # 2×2 그리드 (우상→우하→좌상→좌하 읽기 순서)
        fs = int(usable_ir * 0.52)
        tf = load_font(style["font_key"], fs)
        gx = int(usable_ir * 0.32)
        gy = int(usable_ir * 0.32)
        draw_thick_char(draw, title_chars[0], cx + gx, cy - gy, tf, SEAL_COLOR, tp)
        draw_thick_char(draw, title_chars[1], cx + gx, cy + gy, tf, SEAL_COLOR, tp)
        draw_thick_char(draw, title_chars[2], cx - gx, cy - gy, tf, SEAL_COLOR, tp)
        draw_thick_char(draw, title_chars[3], cx - gx, cy + gy, tf, SEAL_COLOR, tp)

    else:
        # 5자+: 우열 3자 + 좌열 나머지
        fs = int(usable_ir * 0.40)
        tf = load_font(style["font_key"], fs)
        col_gap = int(usable_ir * 0.30)
        spacing = int(fs * 0.95)
        col1 = title_chars[:3]
        start_y1 = cy - spacing
        for i, ch in enumerate(col1):
            draw_thick_char(draw, ch, cx + col_gap, start_y1 + i * spacing, tf, SEAL_COLOR, tp)
        col2 = title_chars[3:]
        start_y2 = cy - int(spacing * (len(col2) - 1) / 2)
        for i, ch in enumerate(col2):
            draw_thick_char(draw, ch, cx - col_gap, start_y2 + i * spacing, tf, SEAL_COLOR, tp)

    # 원형 마스크
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r], fill=255)
    image.putalpha(Image.composite(image.getchannel("A"), Image.new("L", (size, size), 0), mask))
    return add_ink_texture(image)


# ═══════════════════ 미리보기 시트 ═══════════════════

def make_preview_sheet(images_with_labels, output_path, thumb=200, cols=4):
    rows = math.ceil(len(images_with_labels) / cols)
    gap = 10
    sheet_w = cols * thumb + (cols + 1) * gap
    sheet_h = rows * (thumb + 30) + (rows + 1) * gap
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (255, 255, 255, 255))
    try:
        label_font = ImageFont.truetype(FONT_MAP.get("malgun", ""), 14)
    except Exception:
        label_font = ImageFont.load_default()
    sheet_draw = ImageDraw.Draw(sheet)

    for idx, (img, label) in enumerate(images_with_labels):
        col = idx % cols
        row = idx // cols
        x = gap + col * (thumb + gap)
        y = gap + row * (thumb + 30 + gap)
        resized = img.resize((thumb, thumb), Image.LANCZOS)
        sheet.paste(resized, (x, y), resized)
        sheet_draw.text((x + thumb // 2, y + thumb + 4), label,
                        font=label_font, fill=(80, 80, 80, 255), anchor="mt")
    sheet.save(output_path)
    print(f"  미리보기 시트: {output_path}")


# ═══════════════════ 메인 ═══════════════════

def generate_personal_set(name, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n{'═'*50}")
    print(f"  일반 도장 생성 — 이름: {name}")
    print(f"  스타일: {len(PERSONAL_STYLES)}가지 (양각 원형)")
    print(f"{'═'*50}")
    items = []
    for s in PERSONAL_STYLES:
        print(f"  [{s['id']}] {s['name']}...", end=" ")
        img = create_personal_seal(name, s)
        path = os.path.join(output_dir, f"seal_{s['id']}_{name}.png")
        img.save(path)
        items.append((img, s["name"]))
        print(f"✓")
    make_preview_sheet(items, os.path.join(output_dir, f"preview_personal_{name}.png"))


def generate_corporate_set(company, title, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n{'═'*50}")
    print(f"  법인 도장 생성")
    print(f"  회사: {company}")
    print(f"  직함: {title}")
    print(f"  스타일: {len(CORPORATE_STYLES)}가지 (이중원 인감)")
    print(f"{'═'*50}")
    items = []
    for s in CORPORATE_STYLES:
        print(f"  [{s['id']}] {s['name']}...", end=" ")
        img = create_corporate_seal(company, title, s)
        safe_name = company.replace(" ", "")[:6]
        path = os.path.join(output_dir, f"seal_{s['id']}_{safe_name}.png")
        img.save(path)
        items.append((img, s["name"]))
        print(f"✓")
    safe = company.replace(" ", "")[:6]
    make_preview_sheet(items, os.path.join(output_dir, f"preview_corp_{safe}.png"), cols=4)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="logiSSign 한국 전통 도장 생성기")
    parser.add_argument("--type", choices=["personal", "corporate", "both"], default="both")
    parser.add_argument("--name", default="홍길동인", help="일반 도장 이름")
    parser.add_argument("--company", default="주식회사 로지사인", help="법인 회사명")
    parser.add_argument("--title", default="대표이사인", help="법인 직함")
    parser.add_argument("--output", default="output/seals", help="출력 디렉토리")
    args = parser.parse_args()

    if args.type in ("personal", "both"):
        generate_personal_set(args.name, args.output)
    if args.type in ("corporate", "both"):
        generate_corporate_set(args.company, args.title, args.output)

    print(f"\n  완료! → {args.output}/\n")
