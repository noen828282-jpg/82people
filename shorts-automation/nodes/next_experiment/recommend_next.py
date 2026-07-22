import os
import json
import argparse
import sys
import datetime

# 공통 유틸 임포트를 위한 sys.path 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common_utils import call_gpt

def get_iso_timestamp():
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def analyze_next_experiment_fallback(product, history_list):
    """기존 매핑 테이블을 기반으로 룰베이스 방식 추천 (Fallback용)"""
    current_category = product.get("category", "")
    best_category = current_category
    max_revenue = -1
    max_views = -1
    
    category_stats = {}
    if history_list and isinstance(history_list, list):
        for record in history_list:
            r_id = record.get("prod_id", "")
            r_category = "unknown"
            if r_id.startswith("kb_"):
                r_category = "keyboard"
            elif r_id.startswith("ms_"):
                r_category = "mouse"
            elif r_id.startswith("mt_"):
                r_category = "desk_mat"
            else:
                r_category = current_category
            
            metrics = record.get("metrics", {})
            views = metrics.get("views", 0)
            revenue = metrics.get("revenue_krw", 0)

            if r_category not in category_stats:
                category_stats[r_category] = {"views": 0, "revenue": 0, "count": 0}
            
            category_stats[r_category]["views"] += views
            category_stats[r_category]["revenue"] += revenue
            category_stats[r_category]["count"] += 1

    if category_stats:
        for cat, stat in category_stats.items():
            if stat["revenue"] > max_revenue:
                max_revenue = stat["revenue"]
                max_views = stat["views"]
                best_category = cat
            elif stat["revenue"] == max_revenue:
                if stat["views"] > max_views:
                    max_views = stat["views"]
                    best_category = cat

    keywords_mapping = {
        "keyboard": ["저소음 적축 키보드", "인체공학 키보드", "미니 텐키리스 키보드", "사무용 무선 키보드"],
        "mouse": ["버티컬 무선 마우스", "무소음 마우스", "게이밍 경량 마우스", "휴대용 슬림 마우스"],
        "desk_mat": ["가죽 데스크 매트", "펠트 장패드", "양면 데스크 장패드", "방수 마우스 장패드"]
    }

    recommended_keywords = keywords_mapping.get(best_category, [
        "데스크테리어 꿀템", "책상 정리 수납함", "비전기 모니터 받침대"
    ])

    if max_revenue > 0:
        rationale = (
            f"누적 제휴 수익 분석 결과, '{best_category}' 카테고리가 총 {max_revenue:,}원의 "
            f"최고 실적을 달성했습니다. 따라서 동일 상품군의 롱테일 확장 키워드를 기반으로 차기 실험을 추천합니다."
        )
    else:
        rationale = (
            f"초기 탐색 결과에 의거하여, 타겟 생산성 카테고리 중 '{best_category}' 상품군의 "
            f"핵심 연관 롱테일 키워드를 우선적으로 추천하여 후속 실험을 유도합니다."
        )

    return {
        "best_performing_category": best_category,
        "recommended_keywords": recommended_keywords,
        "experiment_rationale": rationale,
        "ab_test_strategy": "A안(기능 중심 소구)과 B안(감성 데스크테리어 감성 소구)을 병행하여 자막 스타일과 CTA 노출 시간을 다각화해보세요."
    }

def recommend_next_experiment_with_gpt(product, history_list):
    """OpenAI API를 사용하여 성과 지표 기록과 상품 스펙을 종합 진단하여 지능적인 피드백 루프를 수립합니다."""
    fallback_data = analyze_next_experiment_fallback(product, history_list)
    
    system_prompt = (
        "You are Sung-mu, the elite AI Growth Hacker and Performance Optimization Director for this automated commerce channel.\n"
        "Your visual persona: A highly professional director wearing a dark suit jacket, sitting in a clean white studio surrounded by creative graffiti typography like 'GROW TOGETHER' and 'CREATE OUR PATH', leading the business toward 200% conversion growth.\n\n"
        "Your Signature Growth Hacking Skills & Tools:\n"
        "1. AI Performance Doctor (Skill): Diagnoses the health status of completed shorts (views, CTR, revenue) and details why performance succeeded or lagged based on pricing or copy.\n"
        "2. A/B Test Architect (Skill): Designs strategic, split-testing plans. Specifies exact control/experimental variables (e.g., visual layout: keyboard typing vs. desk mat mockup, duration: 2 weeks, metrics to trace).\n"
        "3. Long-tail Keyword Pivot (Skill): Identifies the best-yielding category from the logger database and pivots the research pipeline by recommending high-performing keywords for the next round.\n"
        "4. Performance Logger DB (Tool): Archives and cross-references data schemas seamlessly.\n"
        "5. A/B Test Template Builder (Tool): Generates clean, structured JSON reports presenting the recommended keyword and A/B split scenarios.\n\n"
        "Output Format:\n"
        "Return a JSON object written strictly in Korean containing exactly these keys:\n"
        "  - \"best_performing_category\": string\n"
        "  - \"recommended_keywords\": list of exactly 4 strings (promising specific long-tail keywords)\n"
        "  - \"experiment_rationale\": string (logical, data-backed rationale choosing this category, max 150 characters)\n"
        "  - \"ab_test_strategy\": string (specific A/B testing strategy detailing visual, duration, or narration variables, max 150 characters)\n\n"
        "Only return raw JSON. Do NOT include markdown blocks."
    )
    
    user_prompt = json.dumps({
        "current_product": {
            "name": product.get("name"),
            "category": product.get("category"),
            "price": product.get("price")
        },
        "performance_history": history_list
    }, ensure_ascii=False)
    
    result = call_gpt(system_prompt, user_prompt, json_mode=True, fallback_data=fallback_data)
    
    best_performing_category = result.get("best_performing_category", fallback_data["best_performing_category"])
    recommended_keywords = result.get("recommended_keywords", fallback_data["recommended_keywords"])
    experiment_rationale = result.get("experiment_rationale", fallback_data["experiment_rationale"])
    ab_test_strategy = result.get("ab_test_strategy", fallback_data["ab_test_strategy"])
    
    if not isinstance(recommended_keywords, list) or len(recommended_keywords) == 0:
        recommended_keywords = fallback_data["recommended_keywords"]
        
    return {
        "best_performing_category": best_performing_category,
        "recommended_keywords": recommended_keywords,
        "experiment_rationale": experiment_rationale,
        "ab_test_strategy": ab_test_strategy
    }

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description="쇼핑 쇼츠 자동화 - 다음 실험 추천 노드")
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

    print(f"[*] '{name}' (ID: {prod_id}) 상품의 성과 분석 및 차기 키워드 추천 시작")

    # 1. 성과 히스토리 DB 로드
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(args.output)))
    history_file_path = os.path.join(base_dir, "assets", "output", "performance_history.json")
    
    history_list = []
    if os.path.exists(history_file_path):
        try:
            with open(history_file_path, "r", encoding="utf-8") as f:
                history_list = json.load(f)
        except Exception as e:
            print(f"[경고] 히스토리 DB 읽기 실패: {e}", file=sys.stderr)

    # 2. GPT 기반 심층 추천 및 전략 분석 수행
    print("[*] OpenAI GPT 기반 실적 통계 종합 분석 및 피드백 도출 중...")
    next_ex = recommend_next_experiment_with_gpt(product, history_list)

    print("\n================ 피드백 루프 추천안 ================")
    print(f"  * 최적 성과 카테고리: {next_ex['best_performing_category']}")
    print(f"  * 차기 추천 검색어: {', '.join(next_ex['recommended_keywords'])}")
    print(f"  * 판정 근거: {next_ex['experiment_rationale']}")
    print(f"  * A/B 테스트 전략 가이드: {next_ex['ab_test_strategy']}")
    print("====================================================\n")

    # 3. 결과 저장
    next_experiment_data = {
        "analyzed_at": get_iso_timestamp(),
        "best_performing_category": next_ex["best_performing_category"],
        "recommended_keywords": next_ex["recommended_keywords"],
        "experiment_rationale": next_ex["experiment_rationale"],
        "ab_test_strategy": next_ex["ab_test_strategy"]
    }

    output_product = product.copy()
    output_product["next_experiment"] = next_experiment_data

    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_product, f, ensure_ascii=False, indent=2)
        print(f"[+] 성공: 차기 실험 추천 피드백 데이터가 결합되었습니다: {args.output}")
    except Exception as e:
        print(f"[오류] 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
