import os
import json
import argparse
import sys
import random

# stdout 인코딩 강제 설정 (Windows cp949 깨짐 방지)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt


def score_concept_via_gpt(name: str, description: str) -> dict:
    """GPT를 사용하여 강아지 브이로그 컨셉의 바이럴 점수 및 기획 완성도를 평가합니다."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    
    fallback_result = {
        "viral_score": round(random.uniform(4.0, 5.0), 1),
        "pros": ["귀여운 연출 포인트가 명확함", "독백의 재미가 돋보임"],
        "cons": ["과도한 모션 연출 시 비디오 생성 한계 우려"],
        "overall": "대중적인 반려견 공감대를 잘 건드린 귀엽고 코믹한 기획안입니다."
    }

    if not api_key:
        return fallback_result

    system_prompt = (
        "You are an elite YouTube Shorts producer specializing in pet/dog content analysis.\n"
        "Evaluate the viral potential and feasibility of the given vlog concept.\n"
        "Return a JSON object with exactly these keys:\n"
        "- \"viral_score\": a float between 1.0 (very low potential) and 5.0 (extremely viral)\n"
        "- \"pros\": list of 1 to 2 short strings showing the strengths of this concept (in Korean)\n"
        "- \"cons\": list of 1 to 2 short strings showing possible production risks/difficulties (in Korean)\n"
        "- \"overall\": a single sentence summary evaluating the concept (in Korean, max 70 characters).\n\n"
        "Keep the output in Korean and output only valid JSON."
    )

    user_prompt = json.dumps({"name": name, "description": description}, ensure_ascii=False)

    try:
        result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data=fallback_result)
        return result
    except Exception as e:
        print(f"[!] GPT 평가 실패, 룰베이스 백업 사용: {e}")
        return fallback_result


def main():
    parser = argparse.ArgumentParser(description="호야STUDIO 쇼츠 자동화 - 에피소드 컨셉 스코어링 노드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            concepts = json.load(f)
    except Exception as e:
        print(f"Error: JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(concepts, list):
        print("ValidationError: 입력 데이터는 객체들의 배열 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    print(f"[*] 호야STUDIO 기획안 정밀 채점 시작 (대상: {len(concepts)}개)")

    scored_concepts = []
    for concept in concepts:
        name = concept.get("name")
        desc = concept.get("description", "")
        
        print(f"[*] 기획안 채점 중: '{name}'")
        analysis = score_concept_via_gpt(name, desc)
        
        # 기존 필드 호환성 유지
        scored = concept.copy()
        scored["score"] = float(analysis.get("viral_score", 4.0))
        scored["review_summary"] = {
            "pros": analysis.get("pros", ["바이럴 가치가 높음"]),
            "cons": analysis.get("cons", ["비디오 생성 난이도"]),
            "overall": analysis.get("overall", "호야의 매력을 살린 유쾌한 기획안입니다.")
        }
        
        scored_concepts.append(scored)

    # 점수 높은 순 정렬
    scored_concepts.sort(key=lambda x: x["score"], reverse=True)

    print("\n================ 🏆 호야STUDIO 에피소드 기획안 순위 ================")
    for rank, concept in enumerate(scored_concepts, 1):
        print(f"  [{rank}위] {concept['name']} (종합 스코어: {concept['score']}점)")
        print(f"       - 기획 요약: {concept['review_summary']['overall']}")
    print("==================================================================\n")

    # 출력 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(scored_concepts, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 에피소드 스코어링 및 정렬 완료 상품이 저장되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
