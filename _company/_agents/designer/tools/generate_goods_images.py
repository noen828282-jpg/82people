#!/usr/bin/env python3
"""Generate Pinterest-Quality Premium Goods Images (A4 150 DPI: 1240 x 1754).
This script automatically downloads cute watercolor educational illustration assets
via Hugging Face Inference API and merges them as high-quality graphic layers
into the Bingo boards and Worksheets to achieve Etsy-level commercial designs.
"""

import os
import sys
import re
import json
import urllib.request
import urllib.parse
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

# Windows 환경에서 유니코드 출력 코덱 에러 방지
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

# 경로 구성
HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_MD = os.path.abspath(os.path.join(HERE, "..", "config.md"))
EDITOR_CONFIG_MD = os.path.abspath(os.path.join(HERE, "..", "..", "editor", "config.md"))

FONTS_DIR = os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Fonts")
FONT_PATH = os.path.join(FONTS_DIR, "malgun.ttf")
FONT_BOLD_PATH = os.path.join(FONTS_DIR, "malgunbd.ttf")

if not os.path.exists(FONT_PATH):
    FONT_PATH = "arial.ttf"
if not os.path.exists(FONT_BOLD_PATH):
    FONT_BOLD_PATH = FONT_PATH

# 1. HuggingFace 토큰 확인
def _resolve_hf_token():
    token = ""
    if os.path.exists(CONFIG_MD):
        try:
            with open(CONFIG_MD, "r", encoding="utf-8") as f:
                txt = f.read()
            m = re.search(r"HUGGING_FACE_HUB_TOKEN\s*[:：=]\s*(hf_[A-Za-z0-9_\-]+)", txt)
            if m: token = m.group(1).strip()
        except Exception:
            pass
            
    if not token and os.path.exists(EDITOR_CONFIG_MD):
        try:
            with open(EDITOR_CONFIG_MD, "r", encoding="utf-8") as f:
                txt = f.read()
            m = re.search(r"HUGGING_FACE_HUB_TOKEN\s*[:：=]\s*(hf_[A-Za-z0-9_\-]+)", txt)
            if m: token = m.group(1).strip()
        except Exception:
            pass
            
    if not token:
        token = os.environ.get("HUGGING_FACE_HUB_TOKEN", "")
        
    return token

# 2. 이미지 에셋 다운로드 헬퍼
def download_clipart(prompt, output_path, token):
    if os.path.exists(output_path):
        return True
        
    # Rate limit 및 서버 통신 에러 대비 대체 퍼블릭 모델 또는 기본 모델 설정
    model_id = "stabilityai/stable-diffusion-xl-base-1.0"
    api_url = f"https://api-inference.huggingface.co/models/{model_id}"
    
    headers = {
        "Content-Type": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    payload = {
        "inputs": prompt,
        "parameters": {
            "negative_prompt": "ugly, blurry, low resolution, dark background, shadow, frame, border, text",
        }
    }
    
    req = urllib.request.Request(
        api_url, 
        data=json.dumps(payload).encode('utf-8'), 
        headers=headers,
        method="POST"
    )
    
    try:
        print(f"📥 Downloading AI Clipart for: '{prompt[:30]}...'")
        with urllib.request.urlopen(req, timeout=60) as response:
            img_data = response.read()
            with open(output_path, "wb") as f:
                f.write(img_data)
            return True
    except Exception as e:
        print(f"⚠️ Failed to download AI asset: {e}. Clipart will fallback to modern graphics.")
        return False

# 에셋 목록 기획
ASSET_PROMPTS = {
    "apple": "cute watercolor red apple, happy cartoon character for kids, white background, isolated, hand drawn, full color",
    "dinosaur": "cute watercolor green baby dinosaur, kids illustration, white background, isolated, colorful",
    "planet": "cute watercolor planet Saturn with rings, happy cartoon character for kids, white background, isolated",
    "books": "cute watercolor stack of colorful books, cartoon kids illustration, white background, isolated",
    "microscope": "cute pastel watercolor science microscope, white background, isolated",
    "cat": "cute fluffy watercolor kitten, sweet cartoon for kids, white background, isolated",
    "rocket": "cute watercolor red rocket ship flying in space, cartoon for kids, white background, isolated",
    "globe": "cute watercolor earth globe, bright shining warm light, cartoon for kids, white background, isolated",
    "pencil": "cute watercolor yellow pencil with smiley face, sweet cartoon for kids, white background, isolated",
    "rainbow": "cute pastel watercolor rainbow with happy fluffy clouds, cartoon for kids, white background, isolated"
}

# 단어와 클립아트 연결 맵핑
WORD_TO_ASSET = {
    "사과": "apple",
    "★ APPLE ★": "apple",
    "공룡": "dinosaur",
    "행성": "planet",
    "우주선": "rocket",
    "현미경": "microscope",
    "고양이": "cat",
    "★ GLOBE ★": "globe",
    "★ SMART ★": "books",
    "★ FUN ★": "rocket",
    "★ FREE ★": "rainbow",
    "연필": "pencil",
    "지구": "globe",
    "책": "books"
}

BINGO_SETS = [
    {
        "title": "과일과 채소 (Fruits & Vegetables)",
        "desc": "교사 가이드: 주변에서 볼 수 있는 맛있고 건강한 과일과 채소 이름들입니다.",
        "words": [
            "사과", "바나나", "포도", "딸기", "오렌지",
            "수박", "참외", "토마토", "당근", "오이",
            "감자", "고구마", "★ FREE ★", "브로콜리", "양파",
            "마늘", "배추", "무우", "고추", "호박",
            "체리", "레몬", "복숭아", "자두", "파인애플"
        ],
        "bonus_word": "★ FREE ★",
        "theme_color": "#10B981",  # 에메랄드 그린
        "bg_gradient": ("#ECFDF5", "#D1FAE5")
    },
    {
        "title": "동물의 왕국 (Animal Kingdom)",
        "desc": "교사 가이드: 육지, 바다, 하늘에 살고 있는 다양한 동물 친구들입니다.",
        "words": [
            "사자", "호랑이", "코끼리", "기린", "얼룩말",
            "원숭이", "판다", "펭귄", "돌고래", "상어",
            "고래", "독수리", "★ SMART ★", "참새", "토끼",
            "다람쥐", "고양이", "강아지", "소", "말",
            "돼지", "양", "닭", "오리", "곰"
        ],
        "bonus_word": "★ SMART ★",
        "theme_color": "#3B82F6",  # 블루
        "bg_gradient": ("#EFF6FF", "#DBEAFE")
    },
    {
        "title": "흥미진진한 우주 (Exciting Space)",
        "desc": "교사 가이드: 밤하늘을 수놓은 별들과 신비로운 우주선, 태양계 행성들입니다.",
        "words": [
            "태양", "지구", "달", "수성", "금성",
            "화성", "목성", "토성", "천왕성", "해왕성",
            "은하수", "블랙홀", "★ FUN ★", "우주선", "인공위성",
            "혜성", "우주인", "망원경", "로켓", "유성우",
            "별자리", "성운", "태양계", "우주정거장", "소행성"
        ],
        "bonus_word": "★ FUN ★",
        "theme_color": "#6366F1",  # 인디고
        "bg_gradient": ("#EEF2FF", "#E0E7FF")
    },
    {
        "title": "과학실 탐험 (Science Lab)",
        "desc": "교사 가이드: 현미경, 돋보기 등 흥미로운 실험실 도구와 과학 개념입니다.",
        "words": [
            "현미경", "돋보기", "비커", "시험관", "스포이트",
            "자석", "나침반", "온도계", "저울", "플라스크",
            "프리즘", "알코올램프", "★ GLOBE ★", "기압계", "중력",
            "에너지", "빛", "소리", "전기", "자석",
            "화석", "원소", "분자", "원자", "세포"
        ],
        "bonus_word": "★ GLOBE ★",
        "theme_color": "#EC4899",  # 핑크
        "bg_gradient": ("#FDF2F8", "#FCE7F3")
    },
    {
        "title": "클래스룸 학습 도구 (Classroom Tools)",
        "desc": "교사 가이드: 매일 학교나 교실에서 사용하는 유용한 학용품과 도구들입니다.",
        "words": [
            "연필", "지우개", "공책", "교과서", "필통",
            "가위", "풀", "색연필", "자", "크레파스",
            "칠판", "분필", "★ FREE ★", "책상", "의자",
            "컴퓨터", "태블릿", "지도", "지구본", "시계",
            "달력", "알림장", "가방", "실내화", "연필깎이"
        ],
        "bonus_word": "★ FREE ★",
        "theme_color": "#F59E0B",  # 앰버
        "bg_gradient": ("#FEF3C7", "#FDE68A")
    }
]

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def draw_gradient_background(draw, size, color1, color2):
    w, h = size
    c1 = hex_to_rgb(color1)
    c2 = hex_to_rgb(color2)
    for y in range(h):
        r = int(c1[0] + (c2[0] - c1[0]) * (y / h))
        g = int(c1[1] + (c2[1] - c1[1]) * (y / h))
        b = int(c1[2] + (c2[2] - c1[2]) * (y / h))
        draw.line([(0, y), (w, y)], fill=(r, g, b))

def draw_text_center(draw, text, x, y, font, color):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
    except AttributeError:
        w, h = draw.textsize(text, font=font)
    draw.text((x - w/2, y - h/2 - 2), text, font=font, fill=color)

def generate_bingo_card(card_data, index, output_path, assets_dir):
    img = Image.new("RGBA", (1240, 1754), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    draw_gradient_background(draw, (1240, 1754), card_data["bg_gradient"][0], card_data["bg_gradient"][1])
    
    font_title = ImageFont.truetype(FONT_BOLD_PATH, 46)
    font_guide = ImageFont.truetype(FONT_PATH, 20)
    font_bingo = ImageFont.truetype(FONT_BOLD_PATH, 68)
    font_cell = ImageFont.truetype(FONT_BOLD_PATH, 24)
    
    draw.rounded_rectangle([60, 60, 1180, 260], radius=30, fill=(255, 255, 255, 255), outline=hex_to_rgb(card_data["theme_color"]), width=4)
    draw_text_center(draw, card_data["title"], 620, 125, font_title, hex_to_rgb(card_data["theme_color"]))
    
    draw.rounded_rectangle([100, 185, 1140, 235], radius=10, fill=hex_to_rgb(card_data["bg_gradient"][0]) + (255,))
    draw_text_center(draw, card_data["desc"], 620, 208, font_guide, (75, 85, 99))
    
    bingo_chars = ["B", "I", "N", "G", "O"]
    col_width = 190
    row_height = 190
    grid_start_x = 145
    grid_start_y = 440
    
    for i, char in enumerate(bingo_chars):
        x = grid_start_x + i * col_width + col_width/2
        y = 360
        draw.ellipse([grid_start_x + i * col_width + 10, 290, grid_start_x + i * col_width + col_width - 10, 410], fill=hex_to_rgb(card_data["theme_color"]))
        draw_text_center(draw, char, x, y, font_bingo, (255, 255, 255, 255))
        
    draw.rounded_rectangle([grid_start_x - 10, grid_start_y - 10, grid_start_x + col_width*5 + 10, grid_start_y + row_height*5 + 10], radius=20, fill=(255, 255, 255, 255), outline=hex_to_rgb(card_data["theme_color"]), width=6)
    
    for r in range(5):
        for c in range(5):
            word_idx = r * 5 + c
            word = card_data["words"][word_idx]
            
            x1 = grid_start_x + c * col_width
            y1 = grid_start_y + r * row_height
            x2 = x1 + col_width
            y2 = y1 + row_height
            
            cell_bg = "#FFFFFF" if (r+c) % 2 == 0 else card_data["bg_gradient"][0]
            if word == card_data["bonus_word"]:
                cell_bg = "#FDE68A"
                
            draw.rounded_rectangle([x1 + 4, y1 + 4, x2 - 4, y2 - 4], radius=15, fill=hex_to_rgb(cell_bg) + (255,))
            draw.rounded_rectangle([x1 + 4, y1 + 4, x2 - 4, y2 - 4], radius=15, outline=(229, 231, 235, 255), width=2)
            
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            
            asset_key = WORD_TO_ASSET.get(word)
            asset_path = os.path.join(assets_dir, f"{asset_key}.png") if asset_key else ""
            
            if asset_path and os.path.exists(asset_path):
                try:
                    asset_img = Image.open(asset_path).convert("RGBA")
                    datas = asset_img.getdata()
                    newData = []
                    for item in datas:
                        if item[0] > 240 and item[1] > 240 and item[2] > 240:
                            newData.append((255, 255, 255, 0))
                        else:
                            newData.append(item)
                    asset_img.putdata(newData)
                    
                    asset_img = asset_img.resize((100, 100), Image.Resampling.LANCZOS)
                    alpha = asset_img.split()[3]
                    alpha = ImageEnhance.Brightness(alpha).enhance(0.7)
                    asset_img.putalpha(alpha)
                    
                    img_x = int(cx - 50)
                    img_y = int(cy - 50 - 15)
                    img.alpha_composite(asset_img, (img_x, img_y))
                    
                    draw_text_center(draw, word.replace("★", "").strip(), cx, cy + 45, font_cell, (31, 41, 55, 255))
                except Exception as e:
                    print(f"⚠️ Error blending image: {e}")
                    draw_text_center(draw, word, cx, cy, font_cell, (31, 41, 55, 255))
            else:
                if word == card_data["bonus_word"]:
                    draw_text_center(draw, "★", cx, cy - 25, font_title, (217, 119, 6, 255))
                    draw_text_center(draw, word.replace("★", "").strip(), cx, cy + 10, font_cell, (217, 119, 6, 255))
                    draw_text_center(draw, "★", cx, cy + 40, font_title, (217, 119, 6, 255))
                else:
                    draw.ellipse([cx - 45, cy - 45, cx + 45, cy + 45], fill=hex_to_rgb(card_data["theme_color"]) + (20,))
                    if len(word) > 4:
                        t1 = word[:3]
                        t2 = word[3:]
                        draw_text_center(draw, t1, cx, cy - 18, font_cell, (31, 41, 55, 255))
                        draw_text_center(draw, t2, cx, cy + 18, font_cell, (31, 41, 55, 255))
                    else:
                        draw_text_center(draw, word, cx, cy, font_cell, (31, 41, 55, 255))
                        
    draw_text_center(draw, "Copyright 2026 dongmin ai company - Smart Quiz & Play", 620, 1680, font_guide, (156, 163, 175, 255))
    
    img.convert("RGB").save(output_path, "PNG")
    print(f"🎨 Saved Premium Bingo Card Image: {output_path}")

def generate_worksheets(output_dir, assets_dir):
    # 1. 30일 매일 독서 챌린지
    img1 = Image.new("RGBA", (1240, 1754), (255, 251, 235, 255))
    draw1 = ImageDraw.Draw(img1)
    
    font_title = ImageFont.truetype(FONT_BOLD_PATH, 42)
    font_subtitle = ImageFont.truetype(FONT_PATH, 20)
    font_card_title = ImageFont.truetype(FONT_BOLD_PATH, 22)
    font_card_content = ImageFont.truetype(FONT_PATH, 16)
    
    draw1.rounded_rectangle([60, 60, 1180, 240], radius=25, fill=(255, 255, 255, 255), outline=(217, 119, 6, 255), width=4)
    draw_text_center(draw1, "🌳 30일 매일 독서 챌린지 🌳", 620, 125, font_title, (217, 119, 6, 255))
    draw_text_center(draw1, "매일 책을 읽고 동그라미 칸을 예쁜 스티커나 색연필로 채워 독서 습관을 키워보세요!", 620, 195, font_subtitle, (120, 53, 4, 255))
    
    books_asset = os.path.join(assets_dir, "books.png")
    if os.path.exists(books_asset):
        try:
            b_img = Image.open(books_asset).convert("RGBA").resize((130, 130), Image.Resampling.LANCZOS)
            img1.alpha_composite(b_img, (1020, 80))
        except Exception: pass
        
    start_x = 90
    start_y = 290
    box_w = 170
    box_h = 210
    gap_x = 10
    gap_y = 15
    
    ch_data = [
        ("1일차", "10분 독서하기"), ("2일차", "좋아하는 책 찾기"), ("3일차", "15분 독서하기"), ("4일차", "소리 내어 읽기"), ("5일차", "주인공 그려보기"), ("6일차", "가족에게 줄거리 말하기"),
        ("7일차", "20분 독서하기"), ("8일차", "새로운 단어 찾기"), ("9일차", "25분 독서하기"), ("10일차", "느낀 점 한 줄 쓰기"), ("11일차", "30분 독서하기"), ("12일차", "동화책 한 권 읽기"),
        ("13일차", "책 속 배경 그리기"), ("14일차", "주인공에게 편지 쓰기"), ("15일차", "상상속 뒷이야기 구상"), ("16일차", "책 표지 직접 그리기"), ("17일차", "친구에게 추천 책 쓰기"), ("18일차", "인물 특징 요약하기"),
        ("19일차", "어려운 문장 필사"), ("20일차", "나만의 미니 북마크"), ("21일차", "책 속 명언 메모"), ("22일차", "새로운 장르 읽기"), ("23일차", "시 읽고 낭송하기"), ("24일차", "동물 나오는 책 읽기"),
        ("25일차", "과학/우주 책 읽기"), ("26일차", "위인전 읽어보기"), ("27일차", "역사 관련 책 읽기"), ("28일차", "부모님과 책 대화"), ("29일차", "나만의 감상 평점 주기"), ("30일차", "도서관 방문 도전")
    ]
    
    for idx, (day, task) in enumerate(ch_data):
        r = idx // 6
        c = idx % 6
        x1 = start_x + c * (box_w + gap_x)
        y1 = start_y + r * (box_h + gap_y)
        x2 = x1 + box_w
        y2 = y1 + box_h
        
        draw1.rounded_rectangle([x1, y1, x2, y2], radius=15, fill=(255, 255, 255, 255), outline=(254, 243, 199, 255), width=2)
        draw1.rounded_rectangle([x1 + 10, y1 + 10, x2 - 10, y1 + 45], radius=8, fill=(254, 243, 199, 255))
        draw_text_center(draw1, day, (x1 + x2)/2, y1 + 28, font_card_title, (217, 119, 6, 255))
        
        if len(task) > 8:
            task1 = task[:6]
            task2 = task[6:]
            draw_text_center(draw1, task1, (x1 + x2)/2, y1 + 80, font_card_content, (75, 85, 99, 255))
            draw_text_center(draw1, task2, (x1 + x2)/2, y1 + 100, font_card_content, (75, 85, 99, 255))
        else:
            draw_text_center(draw1, task, (x1 + x2)/2, y1 + 90, font_card_content, (75, 85, 99, 255))
        
        draw1.ellipse([(x1+x2)/2 - 30, y1 + 130, (x1+x2)/2 + 30, y1 + 190], outline=(217, 119, 6, 255), width=2, fill=(255, 251, 235, 255))
        draw_text_center(draw1, "완료", (x1+x2)/2, y1 + 160, font_card_content, (217, 119, 6, 255))
        
    img1.convert("RGB").save(os.path.join(output_dir, "worksheet_1.png"), "PNG")
    print("🎨 Saved Premium Worksheet 1 Image")
    
    # 2. 마음 쑥쑥 하루 명언 암송 카드 (10선)
    img2 = Image.new("RGBA", (1240, 1754), (236, 253, 245, 255))
    draw2 = ImageDraw.Draw(img2)
    
    draw2.rounded_rectangle([60, 60, 1180, 240], radius=25, fill=(255, 255, 255, 255), outline=(5, 150, 105, 255), width=4)
    draw_text_center(draw2, "🌳 마음 쑥쑥 하루 명언 암송 카드 🌳", 620, 125, font_title, (5, 150, 105, 255))
    draw_text_center(draw2, "하루에 한 문장씩, 나만의 생각과 지혜를 무럭무럭 키우는 한 줄 명언집입니다.", 620, 195, font_subtitle, (6, 95, 70, 255))
    
    globe_asset = os.path.join(assets_dir, "globe.png")
    if os.path.exists(globe_asset):
        try:
            d_img = Image.open(globe_asset).convert("RGBA").resize((130, 130), Image.Resampling.LANCZOS)
            img2.alpha_composite(d_img, (1020, 80))
        except Exception: pass

    verses = [
        ("명언 1", "배움은 미래를 위한 가장 강력한 무기다 - 넬슨 만델라"),
        ("명언 2", "오늘의 독서가 내일의 리더를 만든다 - 마거릿 풀러"),
        ("명언 3", "작은 발걸음이 모여 큰 산을 이룬다 - 한국 속담"),
        ("명언 4", "호기심은 배움의 첫걸음이자 기초다 - 아리스토텔레스"),
        ("명언 5", "실패는 성공으로 가는 과정이자 선물이다 - 아인슈타인"),
        ("명언 6", "항상 긍정적인 마음으로 새로이 도전하라 - 작가 미상"),
        ("명언 7", "서로 돕고 나누며 조화롭게 자라나자 - 교육 격언"),
        ("명언 8", "꿈꿀 수 있다면, 그것을 이룰 수도 있다 - 월트 디즈니"),
        ("명언 9", "지식은 나누고 협력할수록 더욱 배가 된다 - 속담"),
        ("명언 10", "아름다운 지혜로운 세상은 배움에서 시작된다 - 소크라테스")
    ]
    
    card_y = 280
    card_h = 125
    card_gap = 12
    
    font_verse_title = ImageFont.truetype(FONT_BOLD_PATH, 20)
    font_verse_content = ImageFont.truetype(FONT_PATH, 18)
    
    for idx, (addr, text) in enumerate(verses):
        y_pos = card_y + idx * (card_h + card_gap)
        draw2.rounded_rectangle([90, y_pos, 1150, y_pos + card_h], radius=15, fill=(255, 255, 255, 255), outline=(167, 243, 208, 255), width=2)
        draw2.rounded_rectangle([110, y_pos + 15, 330, y_pos + 50], radius=8, fill=(167, 243, 208, 255))
        draw_text_center(draw2, f"{addr}", 220, y_pos + 33, font_verse_title, (6, 95, 70, 255))
        
        draw2.text((120, y_pos + 68), text, font=font_verse_content, fill=(31, 41, 55, 255))
        
        draw2.rounded_rectangle([1000, y_pos + 20, 1130, y_pos + 105], radius=12, fill=(240, 253, 244, 255), outline=(5, 150, 105, 255), width=2)
        draw_text_center(draw2, "암송", 1065, y_pos + 50, font_verse_content, (5, 150, 105, 255))
        draw_text_center(draw2, "[  ] 통과", 1065, y_pos + 80, font_verse_content, (5, 150, 105, 255))
        
    img2.convert("RGB").save(os.path.join(output_dir, "worksheet_2.png"), "PNG")
    print("🎨 Saved Premium Worksheet 2 Image")
    
    # 3. 나의 하루 배움 & 성장 저널
    img3 = Image.new("RGBA", (1240, 1754), (245, 243, 255, 255))
    draw3 = ImageDraw.Draw(img3)
    
    draw3.rounded_rectangle([60, 60, 1180, 240], radius=25, fill=(255, 255, 255, 255), outline=(124, 58, 237, 255), width=4)
    draw_text_center(draw3, "📝 나의 하루 배움 & 성장 저널 📝", 620, 125, font_title, (124, 58, 237, 255))
    draw_text_center(draw3, "오늘 새로 배운 지식, 감사했던 일, 내일의 다짐을 기쁜 마음으로 적어보세요.", 620, 195, font_subtitle, (109, 40, 217, 255))
    
    rainbow_asset = os.path.join(assets_dir, "rainbow.png")
    if os.path.exists(rainbow_asset):
        try:
            a_img = Image.open(rainbow_asset).convert("RGBA").resize((130, 130), Image.Resampling.LANCZOS)
            img3.alpha_composite(a_img, (1020, 80))
        except Exception: pass
 
    days = [("월요일", "#F3E8FF"), ("화요일", "#FFFFFF"), ("수요일", "#F3E8FF"), ("목요일", "#FFFFFF"), ("금요일", "#F3E8FF"), ("토요일", "#FFFFFF"), ("일요일", "#FDE68A")]
    
    start_y = 280
    row_h = 185
    row_gap = 12
    
    font_day = ImageFont.truetype(FONT_BOLD_PATH, 22)
    font_label = ImageFont.truetype(FONT_BOLD_PATH, 16)
    
    for idx, (day, bg_color) in enumerate(days):
        y_pos = start_y + idx * (row_h + row_gap)
        draw3.rounded_rectangle([90, y_pos, 1150, y_pos + row_h], radius=15, fill=hex_to_rgb(bg_color) + (255,), outline=(192, 132, 252, 255), width=2)
        
        draw3.rounded_rectangle([110, y_pos + 15, 230, y_pos + 60], radius=8, fill=hex_to_rgb("#7C3AED") + (255,) if day == "일요일" else hex_to_rgb("#DDD6FE") + (255,))
        draw_text_center(draw3, day, 170, y_pos + 38, font_day, (255, 255, 255, 255) if day == "일요일" else (109, 40, 217, 255))
        
        draw3.text((270, y_pos + 30), "오늘의 배움 :", font=font_label, fill=(109, 40, 217, 255))
        draw3.line([(380, y_pos + 50), (1120, y_pos + 50)], fill=(192, 132, 252, 255), width=1)
        draw3.line([(270, y_pos + 95), (1120, y_pos + 95)], fill=(192, 132, 252, 255), width=1)
        
        draw3.text((270, y_pos + 120), "내일의 다짐 :", font=font_label, fill=(109, 40, 217, 255))
        draw3.line([(380, y_pos + 140), (1120, y_pos + 140)], fill=(192, 132, 252, 255), width=1)
        
    img3.convert("RGB").save(os.path.join(output_dir, "worksheet_3.png"), "PNG")
    print("🎨 Saved Premium Worksheet 3 Image")

def main():
    print("🚀 Starting Premium Graphic Clipart Generation...")
    
    target_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".secondbrain", "10_Wiki", "🛠️ Projects", "SmartQuizPlay"))
    output_dir = os.path.join(target_dir, "temp_images")
    assets_dir = os.path.join(output_dir, "assets")
    
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(assets_dir, exist_ok=True)
    
    hf_token = _resolve_hf_token()
    if not hf_token:
        print("⚠️ Warning: HUGGING_FACE_HUB_TOKEN is missing. Clipart downloading will bypass auth and may hit rate limit.")
    else:
        print("ℹ️ Hugging Face Access Token successfully resolved.")

    for name, prompt in ASSET_PROMPTS.items():
        out_path = os.path.join(assets_dir, f"{name}.png")
        success = download_clipart(prompt, out_path, hf_token)
        if success:
            print(f"✅ Loaded ClipArt: {name}.png")
            
    for idx, card in enumerate(BINGO_SETS):
        filename = f"bingo_{idx+1}.png"
        output_path = os.path.join(output_dir, filename)
        generate_bingo_card(card, idx+1, output_path, assets_dir)
        
    generate_worksheets(output_dir, assets_dir)
    print("✨ All premium graphic images with AI cliparts completed!")

if __name__ == "__main__":
    main()
