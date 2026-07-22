import os
import json
import argparse
import sys

# 허용된 데스크 및 모바일 생산성 관련 카테고리 목록
ALLOWED_CATEGORIES = {
    "keyboard",          # 키보드
    "mouse",             # 마우스
    "desk-accessory",    # 데스크 액세서리 (데스크매트, 정리함 등)
    "charger",           # 충전기류
    "holder",            # 거치대 (노트북/태블릿 거치대)
    "monitor-stand",     # 모니터 받침대
    "cables"             # 케이블 및 선정리 용품
}

def main():
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 상품 정제 노드")
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
        print("ValidationError: 입력 데이터는 상품 객체들의 배열(List) 형태여야 합니다.", file=sys.stderr)
        sys.exit(1)

    print(f"[*] 상품 정제 프로세스 시작 (입력 상품 수: {len(products)}개)")

    refined_products = []
    seen_ids = set()
    seen_names = set()

    # 필터링 원인 집계용 카운터
    filtering_stats = {
        "duplicate_id": 0,
        "duplicate_name": 0,
        "missing_required_fields": 0,
        "missing_images": 0,
        "short_description": 0,
        "invalid_price": 0,
        "out_of_category": 0
    }

    for idx, prod in enumerate(products):
        product_label = prod.get("name", f"Index {idx}")
        
        # 1. 필수 필드 검증 (id, name, url)
        required_fields = ["id", "name", "url"]
        missing_fields = [f for f in required_fields if f not in prod or not str(prod[f]).strip()]
        if missing_fields:
            print(f"[필터링] '{product_label}': 필수 필드 누락 ({missing_fields})")
            filtering_stats["missing_required_fields"] += 1
            continue

        prod_id = str(prod["id"]).strip()
        prod_name = str(prod["name"]).strip()

        # 2. 중복 ID 제거
        if prod_id in seen_ids:
            print(f"[필터링] '{product_label}': 중복된 ID 상품 감지 (ID: {prod_id})")
            filtering_stats["duplicate_id"] += 1
            continue

        # 3. 중복 상품명 제거 (동일 상품 중복 수집 방지)
        if prod_name in seen_names:
            print(f"[필터링] '{product_label}': 중복된 상품명 감지")
            filtering_stats["duplicate_name"] += 1
            continue

        # 4. 이미지 존재 여부 검증
        images = prod.get("images", [])
        if not isinstance(images, list) or len(images) == 0:
            print(f"[필터링] '{product_label}': 이미지 링크 누락 (쇼츠 생성 불가)")
            filtering_stats["missing_images"] += 1
            continue

        # 5. 상세 설명 글자 수 검증 (최소 10자 이상)
        desc = prod.get("description", "")
        if not isinstance(desc, str) or len(desc.strip()) < 10:
            print(f"[필터링] '{product_label}': 상세 설명 글자 수 부족 (10자 미만, 현재 {len(desc.strip())}자)")
            filtering_stats["short_description"] += 1
            continue

        # 6. 가격 정보 유효성 검증
        price = prod.get("price")
        if price is None or not isinstance(price, int) or price <= 0:
            print(f"[필터링] '{product_label}': 유효하지 않은 가격 정보 ({price})")
            filtering_stats["invalid_price"] += 1
            continue

        # 7. 타겟 카테고리 여부 검증 (데스크·모바일 생산성 관련)
        category = prod.get("category", "").lower().strip()
        if category not in ALLOWED_CATEGORIES:
            print(f"[필터링] '{product_label}': 카테고리 범위 초과 ('{category}')")
            filtering_stats["out_of_category"] += 1
            continue

        # 모든 필터를 통과한 정상 상품 등록
        refined_products.append(prod)
        seen_ids.add(prod_id)
        seen_names.add(prod_name)

    print("\n================ 정제 작업 통계 ================")
    print(f"  * 원본 상품 수: {len(products)}개")
    print(f"  * 중복 ID로 필터링: {filtering_stats['duplicate_id']}개")
    print(f"  * 중복 상품명으로 필터링: {filtering_stats['duplicate_name']}개")
    print(f"  * 필수값 누락으로 필터링: {filtering_stats['missing_required_fields']}개")
    print(f"  * 이미지 누락으로 필터링: {filtering_stats['missing_images']}개")
    print(f"  * 설명 부족으로 필터링: {filtering_stats['short_description']}개")
    print(f"  * 가격 오류로 필터링: {filtering_stats['invalid_price']}개")
    print(f"  * 카테고리 외 상품 필터링: {filtering_stats['out_of_category']}개")
    print(f"  -> 최종 정제 완료 상품 수: {len(refined_products)}개")
    print("================================================\n")

    # 결과 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(refined_products, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 정제 완료된 상품 목록이 저장되었습니다: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
