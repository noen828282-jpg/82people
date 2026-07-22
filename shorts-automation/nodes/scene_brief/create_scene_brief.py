import os
import json
import argparse
import sys

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt


def generate_hoya_scene_briefs(product: dict) -> list:
    """영상 연출가 '홍병길' 페르소나를 활용해 호야(아기 포메라니안)의 의상/배경 매핑 및 3막 구조의 씬 연출 브리프를 작성합니다."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    
    script_data = product.get("script_data", {})
    narration = script_data.get("narration", "아기 포메라니안 호야의 일상 이야기")
    title = product.get("name", "호야의 일상")
    category = product.get("category", "general")

    # 포메라니안 마스터 캐릭터 템플릿 (Step 1)
    step1_master = (
        "A tiny baby white Pomeranian, extremely fluffy cloud-like white fur, "
        "large round jet-black eyes, a tiny round black nose, a very short snout, "
        "small triangular ears, and a bright cheerful smile showing a small pink tongue."
    )

    # 3단계 조립 구조로 수동 연출 폴백 정의 (각 씬마다 서로 다른 악세서리 매칭)
    fallback_briefs = [
        {
            "scene_number": 1,
            "visual_description": (
                f"{step1_master} "
                "Wearing tiny round black glasses, looking confused and tilting its head playfully. "
                "Set in a bright, modern, minimalist studio with soft pastel tones, cinematic warm lighting, clean composition, high detail, 8k resolution."
            ),
            "audio_direction": "호야의 깜짝 놀라는 표정에 효과음 배정. '어라? 내 밥그릇이 비어있네?' 내레이션.",
            "duration_seconds": 3.0
        },
        {
            "scene_number": 2,
            "visual_description": (
                f"{step1_master} "
                "Wearing a miniature blue collar with a tiny necktie, looking exhausted and sitting on a desk next to a laptop. "
                "Set in a warm-toned modern workspace studio background, soft volumetric indoor lighting, cinematic depth of field."
            ),
            "audio_direction": "코믹한 시계 째깍거리는 효과음. '대표님이 다이어트하라고 굶기는 게 학계의 정설인가...' 내레이션.",
            "duration_seconds": 9.0
        },
        {
            "scene_number": 3,
            "visual_description": (
                f"{step1_master} "
                "Wearing a tiny yellow bandanna around its neck, sitting playfully on its hind legs and waving one front paw. "
                "Set in a bright studio background with soft golden hour natural sunlight filtering from a window, high detail, 8k resolution."
            ),
            "audio_direction": "경쾌하게 멍! 짖는 소리 효과음. '아래 구독 버튼 안 누르면 밥그릇 안 채워집니다!' 내레이션.",
            "duration_seconds": 3.0
        }
    ]

    if not api_key:
        return fallback_briefs

    system_prompt = (
        "You are 'Hong Byung-gil', the Visual Director for 호야STUDIO (@호야STUDIO).\n"
        "Your task is to translate the given script and concept into a 3-scene video storyboard for Hoya (a baby white Pomeranian).\n"
        "Each scene's visual description MUST be in English and MUST follow the 3-step prompt formula strictly:\n"
        "1. Step 1 (Master Character): Start exactly with: 'A tiny baby white Pomeranian, extremely fluffy cloud-like white fur, large round jet-black eyes, a tiny round black nose, a very short snout, small triangular ears, and a bright cheerful smile showing a small pink tongue.'\n"
        "2. Step 2 (Outfits & Action): Dynamically design the puppy's clothing and pose/action based on the story of the scene. Do NOT use a fixed signature outfit. Choose appropriate accessories and clothes (e.g. chef hat, glasses, bandanna, knit sweater, collar) and describe its actions.\n"
        "3. Step 3 (Background & Quality): Describe the background setting and camera lighting options (e.g. 'Set in a bright, modern, minimalist studio with soft pastel tones, cinematic warm lighting, clean composition, high detail, 8k resolution').\n\n"
        "Return a JSON object containing a \"scene_briefs\" array of exactly 3 objects. Each object must have:\n"
        "- \"scene_number\": integer (1, 2, or 3)\n"
        "- \"visual_description\": the assembled 3-step prompt in English (max 350 characters)\n"
        "- \"audio_direction\": narration, sound effects, and voiceover guidelines in Korean (max 100 characters)\n"
        "- \"duration_seconds\": float (strictly 3.0 for scene 1, 9.0 for scene 2, 3.0 for scene 3)\n\n"
        "Only return JSON."
    )

    user_prompt = json.dumps({
        "title": title,
        "category": category,
        "narration": narration
    }, ensure_ascii=False)

    try:
        result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data={"scene_briefs": fallback_briefs})
        return result.get("scene_briefs", fallback_briefs)
    except Exception as e:
        print(f"[!] GPT 연출 브리프 생성 실패: {e}")
        return fallback_briefs


def main():
    parser = argparse.ArgumentParser(description="호야STUDIO 쇼츠 자동화 - 장면 브리프/연출 생성 노드 [병길]")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            product = json.load(f)
    except Exception as e:
        print(f"Error: JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(product, dict):
        print("ValidationError: 입력 데이터는 객체(Dict) 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    prod_id = product.get("id")
    name = product.get("name", "")

    print(f"[*] 영상 연출가 '홍병길' 에이전트 구동 ➔ '{name}' 아기 포메라니안 동적 코디 비주얼 기획")

    # 씬 연출 브리프 생성
    scene_briefs = generate_hoya_scene_briefs(product)

    # 결과 병합
    output_product = product.copy()
    output_product["scene_briefs"] = scene_briefs

    print("\n================ 🎬 홍병길 기획 장면 연출 브리프 ================")
    print(f"  * 대상 에피소드: {name}")
    print(f"  * 목표 러닝타임: {sum(s['duration_seconds'] for s in scene_briefs)}초")
    for scene in scene_briefs:
        print(f"  [Scene {scene['scene_number']}] ({scene['duration_seconds']}초)")
        print(f"       - 비주얼 연출 프롬프트 (ENG): {scene['visual_description']}")
        print(f"       - 음향/오디오 자막 방향: {scene['audio_direction']}")
    print("============================================================\n")

    # 결과 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 장면 연출 기획서가 저장되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
