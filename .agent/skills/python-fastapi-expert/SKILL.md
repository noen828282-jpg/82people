---
name: python-fastapi-expert
description: Python/FastAPI 프로젝트에서 코딩 품질을 보장하는 스킬. pytest 테스트, FastAPI 패턴, 에러 핸들링, 타입힌트 등. shorts-automation 같은 Python 프로젝트 작업 시 자동 활성화.
---

# 🐍 Python FastAPI Expert Skill

> Source: VoltAgent/awesome-agent-skills의 pytest-skill, Supabase postgres-best-practices, 카파시 원칙을 동민님 프로젝트에 맞게 커스터마이징

## Goal
shorts-automation 등 Python/FastAPI 프로젝트에서 **프로덕션 수준의 코드 품질**을 보장한다.

---

## Phase 1: 코드 작성 원칙

### Karpathy 4원칙 적용 (Python 버전)
1. **Think Before Coding**: 모호하면 먼저 질문한다. 추측하지 않는다.
2. **Simplicity First**: 최소한의 구현으로 시작. 과도한 추상화 금지.
3. **Surgical Changes**: 변경 범위를 최소화. 관련 없는 코드 건드리지 않음.
4. **Goal-Driven**: 명확한 성공 기준 (테스트 통과, 에러 해결)을 먼저 정의.

### 타입힌트 & Docstring

```python
# ✅ 올바른 패턴
def score_product(product: dict, weights: dict[str, float] | None = None) -> float:
    """상품에 대한 종합 점수를 계산합니다.

    Args:
        product: 상품 정보 딕셔너리. 'name', 'price', 'reviews' 키 필수.
        weights: 각 기준별 가중치. None이면 기본값 사용.

    Returns:
        0.0~100.0 사이의 종합 점수.

    Raises:
        ValueError: product에 필수 키가 없을 때.
    """
```

### 에러 핸들링

```python
# ✅ 외부 API 호출 시 반드시 try/except + 로깅
import logging

logger = logging.getLogger(__name__)

async def fetch_product_data(url: str) -> dict | None:
    """외부 API에서 상품 데이터를 가져옵니다."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        logger.warning(f"타임아웃: {url}")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP 에러 {e.response.status_code}: {url}")
        return None
    except Exception as e:
        logger.error(f"예상치 못한 에러: {e}", exc_info=True)
        return None
```

---

## Phase 2: FastAPI 패턴

### 라우터 구조
```python
# ✅ 라우터 분리
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/v1", tags=["products"])

@router.get("/products/{product_id}")
async def get_product(product_id: int) -> dict:
    """상품 정보를 반환합니다."""
    ...
```

### 응답 모델
```python
from pydantic import BaseModel, Field

class ProductResponse(BaseModel):
    """상품 응답 모델."""
    name: str = Field(..., description="상품명")
    price: float = Field(..., ge=0, description="가격 (원)")
    score: float = Field(default=0.0, ge=0, le=100)
```

---

## Phase 3: 파일 I/O 규칙

shorts-automation에서 특히 중요한 규칙:

```python
# ✅ 항상 encoding 명시 + os.path.join 사용
import os
import json

def load_node_output(base_dir: str, node_name: str) -> dict | None:
    """노드의 output.json을 로드합니다."""
    output_path = os.path.join(base_dir, "nodes", node_name, "output.json")
    
    if not os.path.exists(output_path):
        return None
    
    with open(output_path, "r", encoding="utf-8") as f:
        return json.load(f)
```

---

## Phase 4: 테스트 (pytest)

### 테스트 파일 네이밍
```
tests/
├── test_product_scoring.py
├── test_competitor_pattern.py
└── conftest.py
```

### 테스트 작성 패턴
```python
import pytest

@pytest.fixture
def sample_product() -> dict:
    """테스트용 상품 데이터."""
    return {
        "name": "Test Product",
        "price": 29900,
        "reviews": 150,
        "rating": 4.5
    }

def test_score_product_valid(sample_product: dict) -> None:
    """정상 상품의 스코어링이 0~100 범위인지 확인."""
    score = score_product(sample_product)
    assert 0.0 <= score <= 100.0

def test_score_product_missing_key() -> None:
    """필수 키 누락 시 ValueError 발생 확인."""
    with pytest.raises(ValueError):
        score_product({"name": "Incomplete"})
```

---

## 안티패턴 (금지)

| ❌ 금지 | ✅ 올바른 방법 |
|---------|---------------|
| `open(path, "r")` (encoding 미지정) | `open(path, "r", encoding="utf-8")` |
| `path = "nodes/" + node_name` | `path = os.path.join("nodes", node_name)` |
| `except:` (bare except) | `except SpecificError as e:` |
| 함수에 타입힌트 없음 | `def func(x: str) -> int:` |
| 인라인 매직 넘버 | 상수로 정의: `MAX_RETRIES = 3` |
