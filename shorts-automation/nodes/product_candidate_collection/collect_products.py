import os
import json
import argparse
import sys
import urllib.request
import urllib.parse
import urllib.error
import random

# stdout 인코딩 강제 설정 (Windows cp949 깨짐 방지)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


def call_openai_gpt(prompt: str) -> str:
    """OpenAI API를 호출하여 결과를 반환합니다. 실패 시 빈 문자열을 반환합니다."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("[!] Warning: OPENAI_API_KEY가 설정되어 있지 않습니다. 로컬 생성 모드로 전환합니다.")
        return ""

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    data = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "너는 반려견 유튜브 채널 호야STUDIO (@호야STUDIO)의 수석 기획자 '김진식'이다. 대표인 김동민을 보좌하여 최신 펫 브이로그 트렌드에 맞는 대본 기획 아이디어를 도출한다."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.8
    }

    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode("utf-8"), 
            headers=headers, 
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            return resp_data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[!] OpenAI API 호출 실패: {e}")
        return ""


def generate_local_concepts(keyword: str, limit: int) -> list:
    """API 호출 실패 시 로컬에서 생성할 수 있는 백업 아이디어 목록을 제공합니다."""
    templates = [
        {
            "name": f"'{keyword}' 에디션: 간식 가방 지키는 천재 리트리버 호야",
            "description": "주인이 간식 가방을 열어두고 자리를 비우자, 호야가 침 흘리면서도 의리를 지키며 가방을 지키는 1인칭 독백 상황극.",
            "category": "vlog"
        },
        {
            "name": f"'{keyword}' 에디션: 목욕하기 싫은 댕댕이의 최후",
            "description": "욕실 문이 열리자마자 딴청 피우고 소파 밑에 숨어보지만, 결국 연행되어 목욕하며 억울해하는 말하는 호야의 브이로그.",
            "category": "comedy"
        },
        {
            "name": f"'{keyword}' 에디션: 산책 가자는 말에 호야의 번역기 작동",
            "description": "주인이 '산책'이라는 단어를 꺼내자마자 귀가 쫑긋해지며 마음속으로 흥분한 호야가 꼬리 헬리콥터를 돌리는 리액션 연출.",
            "category": "lifestyle"
        },
        {
            "name": f"'{keyword}' 에디션: 주인이 홈트레이닝 할 때 방해 공작",
            "description": "대표님이 매트 깔고 요가나 푸시업을 할 때 호야가 얼굴을 핥거나 밑으로 기어들어 가며 훈수 두는 귀여운 코미디 연출.",
            "category": "comedy"
        },
        {
            "name": f"'{keyword}' 에디션: 대표님의 잔소리를 듣는 척하는 방법",
            "description": "어질러진 휴지를 보고 주인이 잔소리할 때, 귀를 닫고 하품을 하거나 눈동자만 굴리며 딴생각하는 능청스러운 호야의 생각.",
            "category": "comedy"
        }
    ]
    random.shuffle(templates)
    return templates[:limit]


def collect_vlog_topics(keyword: str, limit: int) -> list:
    """주어진 트렌드 키워드를 활용해 호야STUDIO용 에피소드 소재를 수집/생성합니다."""
    prompt = f"""
    반려견 트렌드 키워드인 '{keyword}'를 반영하여, 래브라도 리트리버 '호야'가 주인공인 재미있고 공감 가는 쇼츠/릴스 에피소드 기획안을 {limit}개 작성해줘.
    결과는 반드시 JSON 형식으로만 응답해줘. 다른 설명이나 텍스트 없이 오직 JSON 배열만 출력해야 해.

    [JSON 형식 예시]
    [
      {{
        "name": "기획안 제목 (예: 주인의 홈트를 방해하는 천재견 호야)",
        "description": "기획 상세 연출 설명 및 스토리라인 훅(Hook)",
        "category": "comedy/vlog/lifestyle 중 택1"
      }}
    ]
    """
    
    gpt_response = call_openai_gpt(prompt)
    
    concepts = []
    if gpt_response:
        # 응답에서 JSON만 추출
        try:
            # ```json ... ``` 또는 일반 텍스트에서 배열 매칭
            json_str = gpt_response
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            concepts = json.loads(json_str.strip())
        except Exception as e:
            print(f"[!] JSON 파싱 오류, 로컬 생성으로 대체: {e}")
            concepts = []

    if not concepts:
        concepts = generate_local_concepts(keyword, limit)

    # 파이프라인 데이터 규격에 맞추어 정제
    processed_products = []
    for idx, c in enumerate(concepts, 1):
        concept_id = f"hoya_concept_{int(time.time())}_{idx}"
        processed_products.append({
            "id": concept_id,
            "name": c.get("name", f"호야STUDIO 기획안 {idx}"),
            "url": "https://www.youtube.com/@호야STUDIO",
            "price": 0,  # 기존 스키마 호환
            "rating": round(random.uniform(4.8, 5.0), 2),
            "review_count": random.randint(50, 300),
            "sourcing_method": "hoya_studio_concept",
            "description": c.get("description", "리트리버 호야의 흥미진진한 일상 이야기"),
            "category": c.get("category", "general")
        })

    return processed_products


import time

def main():
    parser = argparse.ArgumentParser(description="호야STUDIO 쇼츠 자동화 - 에피소드 소재/컨셉 수집 노드")
    parser.add_argument("--input", required=True, help="입력 JSON 파일 경로")
    parser.add_argument("--output", required=True, help="출력 JSON 파일 경로")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: 입력 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            input_data = json.load(f)
    except Exception as e:
        print(f"Error: JSON 입력 파일 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    keywords = input_data.get("keywords", ["반려견 일상"])
    limit = input_data.get("limit", 5)

    print(f"[*] ===== 호야STUDIO 소재 기획 수집 시작 =====")
    print(f"[*] 입력 주제어: {keywords}")
    print(f"[*] 기획 수량 제한: {limit}개")

    results = []
    for keyword in keywords:
        print(f"\n{'-'*50}")
        print(f"[*] '{keyword}' 주제 기반 AI 기획 분석 중...")
        print(f"{'-'*50}")
        crawled = collect_vlog_topics(keyword, limit)
        results.extend(crawled)

    if not results:
        print("[FAIL] 수집된 에피소드 소재가 없습니다.", file=sys.stderr)
        sys.exit(1)

    # 결과 유효성 검증
    for prod in results:
        for required_field in ["id", "name", "url"]:
            if required_field not in prod or not prod[required_field]:
                print(f"Error: 필수 필드 '{required_field}' 누락: {prod}", file=sys.stderr)
                sys.exit(1)

    # 요약 출력
    print(f"\n{'='*60}")
    print(f"[OK] 총 {len(results)}개 호야STUDIO 에피소드 기획안 작성 성공!")
    print(f"{'='*60}")
    for idx, prod in enumerate(results, 1):
        print(f"  [{idx}] {prod['name']}")
        print(f"      설명: {prod['description'][:80]}...")
        print(f"      분류: {prod['category']} | 평점(기대치): {prod['rating']}")

    # 출력 파일 저장
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n[+] 성공: 기획안 {len(results)}개 메타데이터 저장 완료: {args.output}")
    except Exception as e:
        print(f"Error: 결과 파일 저장 실패: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
