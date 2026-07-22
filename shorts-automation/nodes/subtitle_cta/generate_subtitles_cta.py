import os
import json
import argparse
import sys

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt

def format_timestamp(seconds: float) -> str:
    """초 단위를 SRT 타임스탬프 포맷(HH:MM:SS,mmm)으로 변환합니다."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int(round((seconds - int(seconds)) * 1000))
    
    # 밀리초가 1000이 되는 반올림 예외 처리
    if milliseconds == 1000:
        secs += 1
        milliseconds = 0
        if secs == 60:
            minutes += 1
            secs = 0
            if minutes == 60:
                hours += 1
                minutes = 0

    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"

def generate_cta_copies_with_gpt(product):
    """OpenAI API를 사용하여 댓글창 클릭을 강력하게 유도하는 CTA 추천 카피 3종을 생성합니다."""
    fallback_copies = [
        "지금 아래 첫 번째 고정 댓글 링크에서 최저가 제휴 링크를 확인해 보세요! 👇",
        f"영상 속 {product.get('name', '제품')} 상세 정보는 첫 댓글에서! ✨",
        "소개된 꿀템 최저가 구매 링크는 댓글에 있어요 👇"
    ]
    
    fallback_data = {
        "cta_copies": fallback_copies
    }
    
    system_prompt = (
        "You are an elite conversion rate optimizer (CRO) and YouTube marketing specialist.\n"
        "Your task is to write 3 highly addictive, click-inducing Call-to-Action (CTA) phrases in Korean.\n"
        "These phrases will display on screen to drive immediate clicks on the affiliate link pinned in the first comment.\n\n"
        "Conversion Rules:\n"
        "1. Focus on dramatic K-lifestyle enhancement, curiosity, or value (e.g., '책상 감성 3배 높여준 첫댓글 좌표 👇', '품절되기 전 2만원대 꿀템 링크 확인 ✨', '이 퀄리티 실화? 좌표는 첫댓글 고정 📢').\n"
        "2. Keep it punchy, trendy, and under 40 characters (including spaces) for instant readability.\n"
        "3. Write strictly in Korean and use visual pointers like emojis (👇, ✨, 📢, 📦, 🛒).\n"
        "4. Make the click feel low-friction and high-value.\n"
        "5. Output a JSON object with exactly the following key:\n"
        "   - \"cta_copies\": A list of 3 strings representing the recommended CTA copy suggestions.\n\n"
        "Only return JSON."
    )
    
    user_prompt = json.dumps({
        "product_name": product.get("name"),
        "category": product.get("category"),
        "description": product.get("description"),
        "script": product.get("script", {}).get("overall_script", "")
    }, ensure_ascii=False)
    
    result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data=fallback_data)
    
    cta_copies = result.get("cta_copies", fallback_copies)
    if not isinstance(cta_copies, list) or len(cta_copies) < 3:
        cta_copies = fallback_copies
        
    return cta_copies

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 자막 및 CTA 생성 노드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    # 입력 파일 확인
    if not os.path.exists(args.input):
        print(f"[오류] 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            product = json.load(f)
    except Exception as e:
        print(f"[오류] JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(product, dict):
        print("[오류] 입력 데이터는 단일 상품 정보 객체(Dict) 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    prod_id = product.get("id")
    name = product.get("name", "")
    scene_briefs = product.get("scene_briefs", [])
    script_data = product.get("script", {})
    if product.get("sourcing_method") == "hoya_studio_concept":
        disclosure = "천재견 호야의 신나는 일상! 구독과 좋아요 부탁드려요 🐶"
    else:
        disclosure = product.get("disclosure", "본 영상은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.")

    print(f"[*] '{name}' (ID: {prod_id}) 상품의 SRT 자막 및 CTA 오버레이 생성 시작")

    scenes_script = script_data.get("scenes_script", [])
    if not scene_briefs or not scenes_script:
        print("[오류] 자막을 생성하기 위한 장면 기획서나 대본 데이터가 부족합니다.", file=sys.stderr)
        sys.exit(1)

    # 1. SRT 자막 내용 빌드 및 타임라인 계산 (룰베이스 유지)
    srt_lines = []
    current_time = 0.0

    # 빠른 조회를 위해 씬 대본 매핑
    script_map = {item["scene_number"]: item["narration"] for item in scenes_script}

    for idx, brief in enumerate(scene_briefs):
        scene_num = brief.get("scene_number")
        duration = brief.get("duration_seconds", 0.0)
        narration = script_map.get(scene_num, "")

        start_time = current_time
        end_time = current_time + duration
        current_time = end_time

        start_str = format_timestamp(start_time)
        end_str = format_timestamp(end_time)

        # SRT 블록 추가
        srt_lines.append(str(idx + 1))
        srt_lines.append(f"{start_str} --> {end_str}")
        srt_lines.append(narration)
        srt_lines.append("")  # 블록 간 빈 줄

    srt_content = "\n".join(srt_lines)

    # 2. 물리 SRT 파일 저장
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(args.output)))
    assets_dir = os.path.join(base_dir, "assets", "output")
    os.makedirs(assets_dir, exist_ok=True)

    srt_file_name = f"{prod_id}.srt"
    srt_file_path = os.path.join(assets_dir, srt_file_name)

    try:
        with open(srt_file_path, "w", encoding="utf-8") as f:
            f.write(srt_content)
        print(f"  -> [완료] SRT 물리 자막 파일 생성 성공: {srt_file_path}")
    except Exception as e:
        print(f"[오류] SRT 자막 파일 쓰기 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 3. GPT 기반 CTA 카피라이팅 추천 생성
    print("[*] OpenAI GPT 기반 고전환율 댓글 유도용 CTA 카피 생성 중...")
    cta_copies = generate_cta_copies_with_gpt(product)
    primary_cta = cta_copies[0]

    # 마지막 씬 정보 추출 (화살표 지칭용)
    last_scene = scene_briefs[-1]
    last_scene_num = last_scene.get("scene_number")
    last_scene_duration = last_scene.get("duration_seconds", 3.0)
    
    total_duration = current_time
    last_scene_start = total_duration - last_scene_duration

    cta_overlay = {
        "disclosure_banner": {
            "text": disclosure,
            "position_y_percent": 85,
            "font_size_px": 24,
            "background_color": "rgba(0,0,0,0.6)",
            "font_color": "#ffffff",
            "display_mode": "always_visible"
        },
        "recommended_cta_copies": cta_copies,
        "selected_cta_text": primary_cta,
        "arrow_animation": {
            "scene_number": last_scene_num,
            "position_x_percent": 80,
            "position_y_percent": 70,
            "animation_type": "bouncing",
            "start_seconds": round(last_scene_start, 2),
            "end_seconds": round(total_duration, 2),
            "target_element": "comment_link"
        }
    }
    
    print("\n================ 생성된 고전환 CTA 카피 후보 ================")
    for idx, cta in enumerate(cta_copies, 1):
        indicator = "★ 선택됨" if idx == 1 else "  대기"
        print(f"  [{idx}안] {indicator} : {cta}")
    print("============================================================\n")

    # 4. 결과 병합 및 저장
    output_product = product.copy()
    output_product["subtitle_file_path"] = srt_file_path
    output_product["cta_overlay"] = cta_overlay

    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 자막 및 CTA 데이터가 결합되었습니다: {args.output}")
    except Exception as e:
        print(f"[오류] 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
