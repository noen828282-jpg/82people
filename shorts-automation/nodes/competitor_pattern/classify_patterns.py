import os
import json
import argparse
import sys

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt


def generate_vlog_script(name: str, description: str) -> dict:
    """대본 작가 '서설아' 페르소나를 사용하여 호야의 성격이 드러나는 귀엽고 재미있는 한국어 쇼츠 대본을 작성합니다."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    
    fallback_script = {
        "title": name,
        "narration": (
            "아니 대표님, 지금 내 밥그릇 비어있는 거 실화냐고요? (갸웃) "
            "내가 3분 전에 분명히 꼬리 흔들면서 신호를 줬는데... (한숨) "
            "다이어트 하라는 깊은 뜻인가? 참나, 의리 지키기 진짜 힘드네!"
        ),
        "bgm_mood": "신나고 다소 코믹한 분위기의 어쿠스틱 비트",
        "sound_effects": ["개 짖는 소리 짧게", "한숨 쉬는 소리"]
    }

    if not api_key:
        return fallback_script

    system_prompt = (
        "You are 'Seo Seol-a', a highly creative and emotional scriptwriter for the YouTube channel 호야STUDIO (@호야STUDIO).\n"
        "Your task is to write a cute, funny, and highly engaging 40-second YouTube Shorts script for Hoya, a speaking Labrador Retriever.\n"
        "Avoid generic AI expressions (like '혁신적인', '놀라운'). Write natural, conversational Korean from Hoya's internal point of view.\n"
        "Return a JSON object with exactly the following keys:\n"
        "- \"title\": the episode title\n"
        "- \"narration\": the main monologue spoken by Hoya (written in natural, humorous Korean, standard polite/cute form)\n"
        "- \"bgm_mood\": description of recommended background music (in Korean)\n"
        "- \"sound_effects\": list of 2 to 3 sound effects to include (in Korean)\n\n"
        "Only return JSON."
    )

    user_prompt = json.dumps({"title": name, "concept": description}, ensure_ascii=False)

    try:
        result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data=fallback_script)
        return result
    except Exception as e:
        print(f"[!] GPT 대본 생성 실패: {e}")
        return fallback_script


def main():
    parser = argparse.ArgumentParser(description="호야STUDIO 쇼츠 자동화 - 대본 카피라이팅 노드 [설아]")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            concept = json.load(f)
    except Exception as e:
        print(f"Error: JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(concept, dict):
        print("ValidationError: 입력 데이터는 단일 객체 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    name = concept.get("name", "")
    desc = concept.get("description", "")

    print(f"[*] 대본 작가 '서설아' 에이전트 구동 ➔ '{name}' 대본 기획 시작")

    # 대본 생성
    script_data = generate_vlog_script(name, desc)

    # 기존 규격(competitor_analysis)과 동기화하여 HTML 깨짐 방지
    competitor_analysis = {
        "patterns": ["1인칭 강아지 독백 상황극", "견공 시점의 유머러스한 해학"],
        "benchmarks": [
            {
                "title": f"[인기] {name} - 강아지 진짜 속마음 대공개",
                "views": 480000,
                "hook_style": "1인칭 대사 후킹",
                "visual_style": "강아지 눈높이 카메라 앵글, 갸웃거리는 클로즈업"
            }
        ]
    }

    output_data = concept.copy()
    output_data["script_data"] = script_data
    output_data["competitor_analysis"] = competitor_analysis

    print("\n================ ✍️ 서설아 작성 완료 대본 ================")
    print(f"  * 에피소드 제목: {script_data['title']}")
    print(f"  * BGM 연출: {script_data['bgm_mood']}")
    print(f"  * 효과음: {', '.join(script_data['sound_effects'])}")
    print(f"  * 내레이션 대본:\n    \"{script_data['narration']}\"")
    print("============================================================\n")

    # 결과 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 대본 기획서가 저장되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
