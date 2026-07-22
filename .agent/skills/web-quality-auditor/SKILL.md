---
name: web-quality-auditor
description: 웹 퀄리티 감사 및 최적화 스킬. Core Web Vitals, Lighthouse 점수, WCAG 접근성, SEO를 자동 검사하고 개선합니다. Addy Osmani의 Web Quality Skills에서 영감. 웹사이트 성능 점검, 접근성 체크, SEO 최적화 요청 시 활성화됩니다.
---

# 🔍 Web Quality Auditor Skill

> Addy Osmani (Google) Web Quality Skills 기반. 웹 페이지의 성능, 접근성, SEO를 체계적으로 감사하고 개선합니다.

---

## 1. WHEN TO ACTIVATE

다음 요청 시 자동 활성화:
- "성능 체크해줘", "속도 개선해줘"
- "접근성 검사해줘", "WCAG 체크"
- "SEO 최적화해줘"
- "Lighthouse 점수 올려줘"
- 랜딩페이지/웹사이트 생성 후 품질 검증

---

## 2. CORE WEB VITALS OPTIMIZATION

### LCP (Largest Contentful Paint) — 목표: < 2.5s
| 문제 | 해결 |
|------|------|
| Hero 이미지 로딩 지연 | `<img loading="eager" fetchpriority="high">` 적용 |
| 큰 이미지 파일 | 적절한 크기로 리사이즈, WebP/AVIF 포맷 사용 |
| 렌더 블로킹 CSS/JS | `<script defer>`, `<link rel="preload">` 사용 |
| 웹폰트 블로킹 | `font-display: swap` + `<link rel="preconnect">` |

### CLS (Cumulative Layout Shift) — 목표: < 0.1
| 문제 | 해결 |
|------|------|
| 이미지 크기 미지정 | `width`/`height` 속성 명시 또는 `aspect-ratio` 사용 |
| 동적 콘텐츠 삽입 | 고정 높이 컨테이너 사전 확보 |
| 웹폰트 FOUT | `font-display: swap` + 유사 fallback 폰트 |
| 광고/임베드 | 고정 크기 슬롯 사전 할당 |

### INP (Interaction to Next Paint) — 목표: < 200ms
| 문제 | 해결 |
|------|------|
| 무거운 이벤트 핸들러 | `requestAnimationFrame`으로 분리 |
| 빈번한 리페인트 | `transform`/`opacity`만 애니메이션 |
| 과도한 DOM 크기 | 가상화 또는 컴포넌트 분리 |

---

## 3. ACCESSIBILITY AUDIT (WCAG 2.1 AA)

### 자동 체크 항목

#### 색상 & 대비
- [ ] 일반 텍스트: 배경 대비 **4.5:1** 이상
- [ ] 큰 텍스트 (24px+ 또는 19px+ bold): **3:1** 이상
- [ ] UI 컴포넌트: **3:1** 이상
- [ ] 색상만으로 정보 전달하지 않음 (아이콘/텍스트 보조)

#### 키보드 접근성
- [ ] 모든 인터랙티브 요소에 **Tab으로 도달** 가능
- [ ] `focus-visible` 스타일이 명확히 보임
- [ ] `tabindex` 적절히 사용 (skip navigation 포함)
- [ ] 모달/드롭다운에 **focus trap** 적용

#### 시맨틱 HTML
- [ ] `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<header>` 사용
- [ ] Heading 계층 (`h1` → `h2` → `h3`) 순서 준수, `h1` 1개만
- [ ] `<button>`과 `<a>` 올바르게 구분 (네비게이션 vs 액션)
- [ ] 목록은 `<ul>`/`<ol>` 사용

#### 미디어 & 이미지
- [ ] 모든 `<img>`에 의미 있는 `alt` 텍스트
- [ ] 장식 이미지는 `alt=""` (빈 문자열)
- [ ] 비디오에 자막/캡션 제공
- [ ] `aria-label` 또는 `aria-labelledby` 적절히 사용

#### 폼 & 인풋
- [ ] 모든 입력에 `<label>` 연결 (`for`/`id` 매칭)
- [ ] 에러 메시지가 시각적 + 프로그래매틱하게 전달
- [ ] 필수 필드 표시 (`aria-required="true"`)

---

## 4. SEO CHECKLIST

### 메타 태그 (필수)
```html
<head>
  <title>페이지 제목 — 브랜드 (50-60자)</title>
  <meta name="description" content="설명 (150-160자)">
  <meta property="og:title" content="소셜 공유 제목">
  <meta property="og:description" content="소셜 공유 설명">
  <meta property="og:image" content="https://example.com/og-image.jpg">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://example.com/page">
</head>
```

### 구조
- [ ] 페이지당 `<h1>` 1개
- [ ] Heading 계층 순서 지킴
- [ ] `<html lang="ko">` 또는 `<html lang="en">`
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- [ ] 시맨틱 마크업 사용

### 콘텐츠
- [ ] 타이틀에 핵심 키워드 포함
- [ ] 메타 디스크립션에 CTA 포함
- [ ] 이미지에 descriptive `alt` 텍스트
- [ ] 내부 링크 구조 적절

---

## 5. PERFORMANCE AUDIT TEMPLATE

웹 페이지 감사 시 이 형식으로 결과를 보고:

```markdown
# 🔍 Web Quality Audit Report

## 페이지: [URL 또는 파일명]

### Core Web Vitals 예상 점수
| 메트릭 | 상태 | 예상값 | 목표 |
|--------|------|--------|------|
| LCP | 🟢/🟡/🔴 | Xs | <2.5s |
| CLS | 🟢/🟡/🔴 | X | <0.1 |
| INP | 🟢/🟡/🔴 | Xms | <200ms |

### 접근성
- 대비 비율: 🟢/🟡/🔴
- 키보드 접근: 🟢/🟡/🔴
- 시맨틱 HTML: 🟢/🟡/🔴

### SEO
- 메타 태그: 🟢/🟡/🔴
- 구조: 🟢/🟡/🔴

### 개선 우선순위
1. [가장 임팩트 큰 개선사항]
2. [두 번째]
3. [세 번째]
```

---

## 6. QUICK FIX RECIPES

### Font Loading 최적화
```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preload" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css">
<style>
  @font-face {
    font-family: 'Pretendard';
    font-display: swap;
  }
</style>
```

### 이미지 최적화
```html
<!-- Hero (Above fold) -->
<img src="hero.webp" alt="설명" width="1200" height="630" loading="eager" fetchpriority="high" decoding="async">

<!-- Below fold -->
<img src="feature.webp" alt="설명" width="600" height="400" loading="lazy" decoding="async">
```

### Skip Navigation
```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded">
  본문으로 건너뛰기
</a>
```

### Focus Styles
```css
*:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```
