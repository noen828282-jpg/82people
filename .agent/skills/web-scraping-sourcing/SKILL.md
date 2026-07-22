---
name: web-scraping-product-sourcing
description: 웹 스크래핑과 상품 소싱에 특화된 스킬. shorts-automation의 Node 1(상품 수집)과 Node 3(경쟁자 분석) 작업 시 활성화. Firecrawl, BeautifulSoup, httpx 패턴 포함.
---

# 🕷️ Web Scraping & Product Sourcing Skill

> Source: VoltAgent/awesome-agent-skills → firecrawl/firecrawl-build 스킬 기반
> shorts-automation의 상품 수집/경쟁 분석에 최적화

## Goal
**실제 판매 중인 상품**을 신뢰할 수 있는 소스에서 수집하고, 경쟁자 콘텐츠를 분석하는 것.

---

## Phase 1: 상품 수집 (Node 1)

### 신뢰할 수 있는 소싱 방법

```python
import httpx
from bs4 import BeautifulSoup

async def scrape_product_page(url: str) -> dict | None:
    """상품 페이지에서 핵심 정보를 추출합니다.
    
    Args:
        url: 상품 페이지 URL (쿠팡, 아마존 등)
    
    Returns:
        상품 정보 딕셔너리 또는 None
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, follow_redirects=True)
            response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        return {
            "name": extract_product_name(soup),
            "price": extract_price(soup),
            "rating": extract_rating(soup),
            "review_count": extract_review_count(soup),
            "image_urls": extract_images(soup),
            "source_url": url,
            "scraped_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"스크래핑 실패: {url} - {e}")
        return None
```

### 상품 검증 (가짜 상품 방지)

```python
def validate_product(product: dict) -> tuple[bool, str]:
    """수집된 상품이 실제 판매 중인지 검증합니다."""
    checks = [
        (product.get("price", 0) > 0, "가격이 0 이하"),
        (product.get("name", "").strip() != "", "상품명 없음"),
        (product.get("source_url", "").startswith("http"), "유효하지 않은 URL"),
        (product.get("review_count", 0) >= 5, "리뷰 5개 미만"),
    ]
    
    for passed, reason in checks:
        if not passed:
            return False, f"검증 실패: {reason}"
    
    return True, "검증 통과"
```

---

## Phase 2: 경쟁자 분석 (Node 3)

### YouTube 쇼츠 경쟁 분석

```python
async def analyze_competitor_shorts(keyword: str, max_results: int = 10) -> list[dict]:
    """키워드로 경쟁 쇼츠를 검색하고 패턴을 분석합니다."""
    # YouTube Data API 또는 스크래핑으로 검색
    results = await search_youtube_shorts(keyword, max_results)
    
    patterns = []
    for video in results:
        patterns.append({
            "title": video["title"],
            "view_count": video["view_count"],
            "duration": video["duration"],
            "hook_style": classify_hook(video["title"]),
            "cta_type": detect_cta(video),
            "thumbnail_style": analyze_thumbnail(video["thumbnail_url"])
        })
    
    return patterns
```

---

## 윤리적 스크래핑 규칙

1. **robots.txt 준수**: 스크래핑 전 항상 확인
2. **Rate Limiting**: 요청 간 최소 1-2초 대기
3. **User-Agent 명시**: 봇임을 숨기지 않음
4. **저작권 존중**: 이미지/텍스트 무단 복제 금지
5. **API 우선**: 공식 API가 있으면 스크래핑 대신 API 사용

```python
import asyncio

async def polite_scrape(urls: list[str], delay: float = 1.5) -> list[dict]:
    """예의 바른 스크래핑 - 요청 간 딜레이 적용."""
    results = []
    for url in urls:
        result = await scrape_product_page(url)
        if result:
            results.append(result)
        await asyncio.sleep(delay)  # 서버 부담 최소화
    return results
```
