import os
import json
import argparse
import sys

# 모의 제휴 정보 설정
COUPANG_PARTNERS_TAG = "AF12345"
LEGAL_DISCLOSURE = "본 영상은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."

def main():
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 제휴 링크 감사 노드")
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

    print(f"[*] 제휴 링크 생성 및 고지문 검증 시작 (입력 상품 수: {len(products)}개)")

    audited_products = []
    skipped_count = 0

    for prod in products:
        name = prod.get("name", "")
        prod_id = prod.get("id")
        is_risk = prod.get("risk", False)

        # 1. 안전망: risk: true인 상품은 제외
        if is_risk:
            print(f"[필터링] '{name}' (ID: {prod_id}) 상품은 규제 리스크가 있어 제휴 링크 대상에서 제외합니다.")
            skipped_count += 1
            continue

        # 2. 제휴 링크 생성 (Mocking Coupang Partners Link)
        affiliate_url = f"https://link.coupang.com/re/AFFSD?lptag={COUPANG_PARTNERS_TAG}&pageKey={prod_id}"
        
        # 3. 공정위 규격 고지 문구 작성
        disclosure = LEGAL_DISCLOSURE

        audited_prod = prod.copy()
        audited_prod["affiliate_url"] = affiliate_url
        audited_prod["disclosure"] = disclosure

        audited_products.append(audited_prod)
        print(f"[성공] '{name}' (ID: {prod_id}) -> 제휴 링크 매핑 완료 ({affiliate_url})")

    print("\n================ 제휴 링크 감사 통계 ================")
    print(f"  * 입력 상품 수: {len(products)}개")
    print(f"  * 리스크 상품 제외: {skipped_count}개")
    print(f"  * 제휴 링크 생성 성공: {len(audited_products)}개")
    print("=====================================================\n")

    # 결과 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(audited_products, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 제휴 링크 매핑 결과가 저장되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
