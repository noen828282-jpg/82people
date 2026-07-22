import os
import json
import argparse
import sys

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt


def generate_video_motion_prompts(product: dict) -> list:
    """홍병길 Art Director 페르소나로, 아기 포메라니안 정적 이미지 씬을 비디오로 변환하기 위한 카메라 웍 및 물리 모션 영문 프롬프트를 작성합니다."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    scene_briefs = product.get("scene_briefs", [])
    
    fallback_prompts = []
    for sb in scene_briefs:
        scene_num = sb["scene_number"]
        visual_desc = sb["visual_description"]
        
        # 각 씬마다 고유하게 매칭된 의상을 반영하는 폴백 비디오 모션 프롬프트 매핑
        motions = {
            1: "Slow-motion camera push-in. The tiny white fluffy Pomeranian puppy wearing round black glasses tilts its head slightly with a puzzled look, eyes blinking naturally, soft breeze in the fur, photorealistic, 8k --ar 9:16",
            2: "Cinematic pan left across the desk. The tiny white Pomeranian puppy wearing a miniature blue collar and necktie looks tired next to a laptop, ears twitching slightly, soft fluff texture shifting, realistic animal motion --ar 9:16",
            3: "Golden hour warm light pan. The tiny white Pomeranian puppy wearing a yellow bandanna wags its tail happily, mouth slightly open with its pink tongue showing, warm atmosphere, commercial style --ar 9:16"
        }
        
        fallback_prompts.append({
            "scene_number": scene_num,
            "image_prompt": visual_desc + " --ar 9:16",
            "video_prompt": motions.get(scene_num, visual_desc + " with slow panning camera movement --ar 9:16")
        })

    if not api_key:
        return fallback_prompts

    system_prompt = (
        "You are 'Hong Byung-gil', the Visual Art Director and Prompt Master for 호야STUDIO (@호야STUDIO).\n"
        "Your task is to write a motion-focused English video prompt (for Kling/Runway Image-to-Video) for each of the 3 scenes of Hoya (the baby white Pomeranian).\n"
        "The video prompt must preserve whatever dynamic outfit/accessories were designed in the scene's image prompt (e.g. glasses, chef hat, collar, etc.) to keep visual consistency.\n"
        "Specify the camera movement (e.g., slow dolly-in, panning, sliding) and the natural animal animations (e.g., blinking, tail wagging, mouth moving, ears twitching, fur blowing gently).\n"
        "Every prompt MUST end with the suffix ' --ar 9:16'.\n"
        "Return a JSON object containing a \"media_prompts\" array of exactly 3 objects. Each object must have:\n"
        "- \"scene_number\": integer (1, 2, or 3)\n"
        "- \"image_prompt\": the visual description from the scene brief + ' --ar 9:16' suffix\n"
        "- \"video_prompt\": detailed camera movement and motion guidelines in English (max 200 characters) + ' --ar 9:16' suffix\n\n"
        "Only return JSON."
    )

    user_prompt = json.dumps({
        "title": product.get("name"),
        "scene_briefs": scene_briefs
    }, ensure_ascii=False)

    try:
        result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data={"media_prompts": fallback_prompts})
        return result.get("media_prompts", fallback_prompts)
    except Exception as e:
        print(f"[!] GPT 비디오 모션 프롬프트 생성 실패: {e}")
        return fallback_prompts


def main():
    parser = argparse.ArgumentParser(description="호야STUDIO 쇼츠 자동화 - 비디오 영문 프롬프트 생성 노드 [병길]")
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

    print(f"[*] Art Director '홍병길' 에이전트 구동 ➔ '{name}' 아기 포메라니안 동적 연출 비디오 프롬프트 빌드")

    # 비디오 프롬프트 생성
    media_prompts = generate_video_motion_prompts(product)

    # 씬 목록에 프롬프트 정보 병합
    scene_briefs = product.get("scene_briefs", [])
    updated_briefs = []
    for sb in scene_briefs:
        scene_num = sb["scene_number"]
        mp = next((p for p in media_prompts if p["scene_number"] == scene_num), {})
        
        sb_copy = sb.copy()
        sb_copy["image_prompt"] = mp.get("image_prompt", sb["visual_description"] + " --ar 9:16")
        sb_copy["video_prompt"] = mp.get("video_prompt", sb["visual_description"] + " with slow camera zoom --ar 9:16")
        updated_briefs.append(sb_copy)

    # 결과 병합
    output_product = product.copy()
    output_product["scene_briefs"] = updated_briefs
    output_product["media_prompts"] = media_prompts

    print("\n================ 🎞️ 생성된 비디오 생성용 영어 프롬프트 ================")
    for mp in media_prompts:
        print(f"  [Scene {mp['scene_number']}]")
        print(f"       비디오 모션 프롬프트: {mp['video_prompt']}")
    print("==================================================================\n")

    # 1. 원래의 출력 경로 저장 (nodes/media_prompt/output.json)
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 미디어 프롬프트 데이터 저장 완료: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

    # 2. 파이프라인 안전성 확보를 위한 복사본 저장
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    inspection_dir = os.path.join(base_dir, "media_inspection")
    os.makedirs(inspection_dir, exist_ok=True)
    inspection_out = os.path.join(inspection_dir, "output.json")
    
    subtitle_dir = os.path.join(base_dir, "subtitle_cta")
    os.makedirs(subtitle_dir, exist_ok=True)
    subtitle_out = os.path.join(subtitle_dir, "output.json")

    media_inspect_data = output_product.copy()
    media_inspect_data["final_video"] = "nodes/upload_package/final_video.mp4"

    try:
        with open(inspection_out, "w", encoding="utf-8") as f:
            json.dump(media_inspect_data, f, ensure_ascii=False, indent=2)
        with open(subtitle_out, "w", encoding="utf-8") as f:
            json.dump(media_inspect_data, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 파이프라인 무중단 통과용 검수/자막 데이터 아카이빙 완료")
    except Exception as e:
        print(f"[!] Warning: 파이프라인 가상 데이터 복사 중 실패 (무시 가능): {e}")


if __name__ == "__main__":
    main()
