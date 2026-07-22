import os
import json
import argparse
import sys

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt


# 심의 규정 금지어 및 유형 매핑
BLACKLIST_RULES = {
    "최고": "객관적 근거 없는 최상급 표현",
    "완벽": "품질 또는 성능 보장 과장 표현",
    "100% 보장": "100% 성능 보장 과장 표현",
    "즉시": "즉각적 치료 또는 효과 암시 과장 표현",
    "부작용 없음": "안전성 오인 우려 표현",
    "인체 무해": "안전성 오인 우려 표현",
    "치료": "의학적 효능 또는 의료기기 오인 표현",
    "완치": "의학적 치료 주장 표현"
}

def scan_text_fallback(text):
    """기존 키워드 기반 룰베이스 스캔 (API 장애 시 안전 장치)"""
    detected = []
    reasons = []
    
    for word, category in BLACKLIST_RULES.items():
        if word in text:
            detected.append(word)
            reasons.append(f"'{word}' ({category})")
            
    return detected, reasons

def check_product_regulation(name, description):
    """OpenAI API를 사용하여 표시광고법 위반 및 과장 리스크를 검사합니다."""
    # Fallback 데이터 계산
    det_name, reas_name = scan_text_fallback(name)
    det_desc, reas_desc = scan_text_fallback(description)
    all_det = list(set(det_name + det_desc))
    all_reas = list(set(reas_name + reas_desc))

    fallback_risk = len(all_det) > 0
    fallback_reason = f"금지어 검출: {all_det} ({', '.join(all_reas)})" if fallback_risk else "통과 (특이 리스크 키워드 없음)"

    fallback_data = {
        "risk": fallback_risk,
        "reason": fallback_reason
    }

    system_prompt = (
        "You are an expert regulatory compliance reviewer for South Korean advertisement laws (표시광고법).\n"
        "Analyze the given product name and description, and determine if they contain illegal, false, or exaggerated advertising expressions.\n"
        "Common violations include:\n"
        "- Exaggerated/unproved claims without objective evidence (\"최고\", \"완벽\", \"100% 보장\", \"인체 무해\", \"부작용 없음\")\n"
        "- Implying immediate clinical effect (\"즉시 해결\", \"즉시 완화\")\n"
        "- Implying medical/healing efficiency for non-medical products (\"완치\", \"치료\")\n\n"
        "Return a JSON object with exactly the following keys:\n"
        "- \"risk\": boolean (true if it contains violations, false otherwise)\n"
        "- \"reason\": a string in Korean describing the violations (mentioning exact words and rule categories) or \"통과 (특이 리스크 키워드 없음)\" if clean.\n\n"
        "Only return JSON."
    )

    user_prompt = json.dumps({"name": name, "description": description}, ensure_ascii=False)

    result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data=fallback_data)

    risk = result.get("risk", fallback_risk)
    reason = result.get("reason", fallback_reason)

    if not isinstance(risk, bool):
        risk = fallback_risk

    return risk, reason


def main():
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 규제/표현 리스크 검사 노드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    # 입력 파일 확인
    if not os.path.exists(args.input):
        print(f"Error: 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            products = json.load(f)
    except Exception as e:
        print(f"Error: JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(products, list):
        print("ValidationError: 입력 데이터는 상품 객체들의 배열 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    print(f"[*] 규제/표현 리스크 검증 시작 (대상 상품 수: {len(products)}개)")

    checked_products = []
    flagged_count = 0

    for prod in products:
        name = prod.get("name", "")
        description = prod.get("description", "")
        
        # OpenAI API 심의 수행
        risk, reason = check_product_regulation(name, description)

        checked_prod = prod.copy()
        checked_prod["risk"] = risk
        checked_prod["reason"] = reason
        
        if risk:
            flagged_count += 1
            print(f"[경고] '{name}' (ID: {prod.get('id')}) -> 리스크 검출: {reason}")
        else:
            print(f"[통과] '{name}' (ID: {prod.get('id')}) -> 안전함")

        checked_products.append(checked_prod)

    print("\n================ 규제/표현 리스크 검사 통계 ================")
    print(f"  * 검사 대상 상품 수: {len(products)}개")
    print(f"  * 리스크 경고 상품 수: {flagged_count}개")
    print(f"  * 안전한 상품 수: {len(products) - flagged_count}개")
    print("============================================================\n")

    # 결과 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(checked_products, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 리스크 검증 완료된 결과가 저장되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
