import os
import json
import argparse
import sys
import datetime
import random

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt

def get_iso_timestamp():
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def analyze_performance_with_gpt(product, metrics):
    """OpenAI API를 사용하여 수집된 성과 지표(조회수, 클릭율, 매출 등)를 바탕으로 AI 성과 분석 리포트를 작성합니다."""
    fallback_analysis = (
        f"수집 시각 기준 누적 조회수 {metrics['views']:,}회 및 링크 클릭수 {metrics['clicks']:,}회를 기록하였습니다. "
        "정상적으로 성과가 로깅되었습니다."
    )
    
    fallback_data = {
        "performance_analysis": fallback_analysis
    }
    
    system_prompt = (
        "You are an expert YouTube marketing data analyst.\n"
        "Your task is to analyze the performance metrics of a shopping Shorts video and write a concise, logical diagnostic summary.\n\n"
        "Guidelines:\n"
        "1. Write the diagnosis strictly in Korean.\n"
        "2. Keep the analysis concise and sharp (1-2 sentences, max 120 characters).\n"
        "3. Interpret views, CTR (Clicks/Views), and Conversion Rate (Conversions/Clicks).\n"
        "4. Diagnose potential reasons for high/low performance (e.g., pricing, video hook, product appeal).\n"
        "5. Output a JSON object with exactly the following key:\n"
        "   - \"performance_analysis\": The summary commentary text.\n\n"
        "Only return JSON."
    )
    
    user_prompt = json.dumps({
        "product_name": product.get("name"),
        "price": product.get("price"),
        "score": product.get("score"),
        "metrics": metrics
    }, ensure_ascii=False)
    
    result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data=fallback_data)
    
    return result.get("performance_analysis", fallback_analysis)

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 퍼포먼스 지표 로깅 노드")
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
    price = product.get("price", 10000)
    score = product.get("score", 4.0)
    approval_status = product.get("approval_status", {})

    print(f"[*] '{name}' (ID: {prod_id}) 상품의 성과 지표 로깅 시작")

    # 1. 승인 여부 검증
    if not approval_status.get("approved", False):
        print(f"[경고] 본 상품은 수동 검수 단계에서 승인되지 않았습니다. 지표 로깅을 생략합니다.", file=sys.stderr)
        output_product = product.copy()
        output_product["performance_log"] = {
            "logged_at": get_iso_timestamp(),
            "metrics": {
                "views": 0, "likes": 0, "comments": 0, "shares": 0, "clicks": 0, "conversions": 0, "revenue_krw": 0
            },
            "performance_analysis": "수동 승인을 받지 못해 비디오가 미업로드 상태이므로 성과 집계가 생략되었습니다."
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        sys.exit(0)

    # 2. 성과 지표 시뮬레이션 연산
    random.seed()  # 매 실행마다 무작위 값 갱신
    score_weight = float(score) / 4.0

    views = int(random.randint(2000, 15000) * score_weight)
    likes = int(views * random.uniform(0.02, 0.05))
    comments = int(views * random.uniform(0.001, 0.005))
    shares = int(views * random.uniform(0.0005, 0.002))
    
    clicks = int(views * random.uniform(0.015, 0.035))
    conversions = int(clicks * random.uniform(0.006, 0.018))
    
    revenue_krw = int(conversions * (price * 0.03))

    metrics = {
        "views": views,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "clicks": clicks,
        "conversions": conversions,
        "revenue_krw": revenue_krw
    }

    logged_at = get_iso_timestamp()

    # 3. GPT 기반 성과 분석 수행
    print("[*] OpenAI GPT 기반 성과 데이터 심층 진단 진행 중...")
    performance_analysis = analyze_performance_with_gpt(product, metrics)

    # 4. 로컬 히스토리 데이터베이스 파일에 기록 누적
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(args.output)))
    history_file_path = os.path.join(base_dir, "assets", "output", "performance_history.json")
    
    history_list = []
    if os.path.exists(history_file_path):
        try:
            with open(history_file_path, "r", encoding="utf-8") as f:
                history_list = json.load(f)
                if not isinstance(history_list, list):
                    history_list = []
        except Exception as e:
            print(f"[경고] 기존 히스토리 파일 로드 실패(초기화 진행): {e}", file=sys.stderr)

    # 신규 성과 기록 추가
    new_record = {
        "prod_id": prod_id,
        "name": name,
        "logged_at": logged_at,
        "metrics": metrics,
        "performance_analysis": performance_analysis
    }
    history_list.append(new_record)

    try:
        with open(history_file_path, "w", encoding="utf-8") as f:
            json.dump(history_list, f, ensure_ascii=False, indent=2)
        print(f"  -> [완료] 성과 히스토리 DB 누적 기록 완료: {history_file_path}")
    except Exception as e:
        print(f"[오류] 히스토리 DB 쓰기 실패: {e}", file=sys.stderr)
        sys.exit(1)

    print("\n================ 수집 성과 대시보드 ================")
    print(f"  * 누적 조회수: {views:,}회")
    print(f"  * 링크 클릭수: {clicks:,}회 (CTR: {round((clicks/views)*100, 2)}%)")
    print(f"  * 구매 전환수: {conversions:,}건 (CR: {round((conversions/clicks)*100, 2) if clicks > 0 else 0}%)")
    print(f"  * 파트너스 수익: {revenue_krw:,}원")
    print(f"  * AI 지표 진단 의견: {performance_analysis}")
    print("====================================================\n")

    # 5. 결과 저장
    output_product = product.copy()
    output_product["performance_log"] = {
        "logged_at": logged_at,
        "metrics": metrics,
        "performance_analysis": performance_analysis
    }

    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 퍼포먼스 로깅 데이터가 결합되었습니다: {args.output}")
    except Exception as e:
        print(f"[오류] 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
