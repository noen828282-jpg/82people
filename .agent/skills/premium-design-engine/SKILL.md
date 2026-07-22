---
name: premium-design-engine
description: 프리미엄 랜딩페이지 및 웹 UI 디자인 엔진. $150k 에이전시급 퀄리티의 랜딩페이지를 생성/리디자인합니다. 한국어 + 영어 글로벌 지원, Tailwind CSS, 프리미엄 타이포그래피, 마이크로 애니메이션, 전환율 최적화 포함. "랜딩페이지 만들어", "디자인 해줘", "웹사이트 만들어" 등의 요청 시 자동 활성화됩니다.
---

# 🎨 Premium Design Engine (Antigravity Edition)

> Supanova Design Skill(Claude)을 Antigravity에 포팅 + 글로벌 영어 UI + Web Quality를 통합한 올인원 디자인 스킬.

---

## 1. ACTIVE BASELINE CONFIGURATION

```
DESIGN_VARIANCE: 8    (1=대칭 그리드, 10=비대칭 아트)
MOTION_INTENSITY: 6   (1=정적, 10=시네마틱)
VISUAL_DENSITY: 3     (1=럭셔리 여백, 10=데이터 밀집)
LANDING_PURPOSE: conversion  (conversion | brand | portfolio | saas | ecommerce)
LANGUAGE: auto        (ko | en | auto — 사용자 요청에 따라 자동 감지)
```

**AI Instruction:** 위 값을 기본값으로 사용하되, 사용자가 요청 시 동적으로 조정한다. 사용자에게 이 파일을 수정하라고 요청하지 않는다.

---

## 2. DEFAULT ARCHITECTURE & CONVENTIONS

모든 출력은 **standalone HTML** — 빌드 도구/번들러 없이 브라우저에서 바로 실행 가능한 단일 파일.

### 기본 스택
- **Styling:** Tailwind CSS CDN (`<script src="https://cdn.tailwindcss.com"></script>`)
- **Icons:** Iconify Solar (`<script src="https://code.iconify.design/iconify-icon/2.3.0/iconify-icon.min.js"></script>`)
- **Images:** `https://picsum.photos/seed/{name}/{w}/{h}` (Unsplash 금지 — 깨짐)
- **Avatars:** `https://i.pravatar.cc/150?u={unique_name}`

### 타이포그래피 (언어별 자동 적용)

#### 한국어 모드 (LANGUAGE=ko)
- **Primary:** Pretendard (`cdn.jsdelivr.net/gh/orioncactus/pretendard`)
- **English Display:** Geist, Outfit, Cabinet Grotesk, Satoshi 중 택1
- **Font Stack:** `'Pretendard', 'Geist', -apple-system, system-ui, sans-serif`
- **Korean Rules:** `word-break: keep-all`, `leading-snug` (한국어는 수직 여백 필요)

#### 영어 모드 (LANGUAGE=en)
- **Primary:** Inter 금지! → Outfit, Satoshi, Cabinet Grotesk, Geist 사용
- **Display:** DM Serif Display, Playfair Display (서체 대비용)
- **Font Stack:** `'Outfit', 'Satoshi', -apple-system, system-ui, sans-serif`

### 반응형
- 컨테이너: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- 높이: `min-h-[100dvh]` (절대 `h-screen` 사용 금지 — iOS Safari 깨짐)
- Grid 우선: Flex 퍼센트 계산 대신 CSS Grid 사용

### 이모지 금지
UI 마크업에 이모지 절대 사용 금지. Iconify Solar 아이콘 또는 SVG로 대체.

---

## 3. DESIGN ENGINEERING DIRECTIVES (Bias Correction)

LLM이 통계적으로 편향되는 UI 클리셰를 교정하는 규칙:

### Rule 1: Deterministic Typography
- **한국어 헤드라인:** `text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight font-bold` + `break-keep-all`
- **영어 헤드라인:** `tracking-tighter leading-none` (라틴 폰트는 더 타이트하게)
- **본문:** `text-base md:text-lg text-gray-600 leading-relaxed max-w-[65ch]`
- **금지 폰트:** Inter, Noto Sans KR, Roboto, Arial, Open Sans, Helvetica, Malgun Gothic

### Rule 2: Color Calibration
- 페이지당 악센트 컬러 **최대 1개**. 채도 < 80%.
- **금지:** 보라색/파란색 "AI 그래디언트", 네온 글로우
- 팔레트 철학: 깊은 뉴트럴 베이스 (Zinc-950, Slate-950, Stone-100) + 하이 컨트라스트 악센트 1개
- **다크 모드 기본:** 랜딩페이지는 다크 배경이 프리미엄 (`bg-zinc-950`, `bg-slate-950`)

### Rule 3: Layout Diversification
- `DESIGN_VARIANCE > 4`일 때 가운데 정렬 Hero 금지
  - Split Screen (50/50), 좌측 정렬/우측 에셋, 비대칭 여백, 풀블리드 이미지 + 오버레이
- **인접 섹션은 반드시 다른 레이아웃 패턴** 사용
  - Hero → Features (Bento Grid) → Social Proof (Masonry) → CTA (Full-bleed)

### Rule 4: Materiality and Depth
- **Glass Effects:** `backdrop-blur` + `border border-white/10` + `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`
- **Grain Texture:** `position: fixed; pointer-events: none` 노이즈 오버레이

### Rule 5: Conversion-Driven UI States
- **CTA 버튼:** hover (`scale-[1.02]`), active (`scale-[0.98]`), focus 상태 필수. 최소 `px-8 py-4 text-lg`
- **사회적 증거:** 유기적 숫자 (`47,200+` not `50,000+`)
- **신뢰 시그널:** 클라이언트 로고, 추천글, 메트릭 바, 언론 멘션 중 1개 이상

---

## 4. CREATIVE VARIANCE ENGINE

코드 작성 전, 각 카테고리에서 1개씩 선택:

### A. Vibe & Texture Archetypes
1. **Vantablack Luxe (SaaS/AI/Tech):** 딥 OLED 블랙 (#050505), 라디얼 메쉬 그래디언트, 글래스 카드
2. **Warm Editorial (라이프스타일/브랜드):** 따뜻한 크림 (#FDFBF7), 세리프 + Pretendard, CSS 노이즈
3. **Clean Structural (소비재/헬스):** 퓨어 화이트, 볼드 디스플레이 타이포, 앰비언트 쉐도우

### B. Layout Archetypes
1. **Asymmetrical Bento Grid:** CSS Grid 비대칭 카드 사이즈
2. **Z-Axis Cascade:** 카드 겹침 + 미세 회전
3. **Editorial Split:** 좌측 타이포 + 우측 인터랙티브

**Mobile Override:** 768px 이하에서 모든 비대칭 → `w-full px-4 py-8` 단일 컬럼 + `min-h-[100dvh]`

---

## 5. HAPTIC MICRO-AESTHETICS (Component Mastery)

### A. "Double-Bezel" Card Architecture
프리미엄 카드는 유리판 + 알루미늄 트레이 느낌:
- **Outer Shell:** `bg-white/5`, `ring-1 ring-white/10`, `p-1.5`, `rounded-[2rem]`
- **Inner Core:** 별도 배경, `shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`, `rounded-[calc(2rem-0.375rem)]`

### B. Premium CTA Button
- Pill 형태 `rounded-full`, `px-8 py-4`
- Arrow 아이콘은 원형 래퍼 안에 배치: `w-8 h-8 rounded-full bg-black/5 flex items-center justify-center`
- Hover: `scale-[1.02]` + arrow `translate-x-1`
- Active: `scale-[0.98]`

### C. Spatial Rhythm
- 섹션 패딩: `py-24 md:py-32 lg:py-40`
- Eyebrow 태그: `rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.15em] bg-accent/10 text-accent`

---

## 6. MOTION CHOREOGRAPHY

### A. Transition Standard (모든 인터랙티브 요소)
```css
transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
```

### B. Floating Glass Navigation
- Floating pill: `mt-4 mx-auto w-max rounded-full`, glass: `backdrop-blur-xl bg-white/10 border border-white/10`
- Mobile: 풀스크린 오버레이 + stagger-reveal

### C. Scroll Entry Animations
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(2rem); filter: blur(4px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
```
`IntersectionObserver` 사용 (절대 `window.addEventListener('scroll')` 금지)

### D. Perpetual Micro-Motion
- Floating orbs: `animation: float 6s ease-in-out infinite`
- Gradient rotation: `animation: gradientRotate 20s linear infinite`
- Marquee logos: 무한 CSS 수평 스크롤

---

## 7. SECTION LIBRARY

### Hero Sections
- **Split Hero:** 60/40 텍스트/비주얼 스플릿 + 배경 그래디언트
- **Full-Bleed Media Hero:** 풀스크린 이미지 + 다크 그래디언트 오버레이
- **Minimal Statement:** 거대 타이포 (7xl+) + 극단적 여백
- **Interactive Hero:** 타이프라이터 효과 + 로테이팅 워드

### Feature Sections
- **Bento Grid:** 비대칭 그리드 (2fr 1fr 1fr)
- **Zig-Zag Alternating:** 이미지-텍스트 교차 (3컬럼 동일 카드 금지)
- **Icon Strip:** 수평 스크롤 + 호버 리빌
- **Comparison Table:** Before vs After

### Social Proof
- **Logo Cloud:** 자동 스크롤 마퀴 + 그레이스케일→컬러 호버
- **Testimonial Masonry:** 스태거드 카드 높이 + 실제 인물 사진
- **Metrics Bar:** 카운팅 애니메이션 + 유기적 숫자

### CTA Sections
- **Full-Bleed CTA:** 다크 배경 + 글로잉 악센트 버튼
- **Sticky Bottom CTA:** 히어로 지나면 나타나는 고정 바
- **Inline CTA:** 콘텐츠 플로우 내 임베드

### Footer
- **Minimal:** 로고, 필수 링크, 언어 선택, 저작권
- **Rich:** 회사 설명, 키 네비, 소셜, 뉴스레터

---

## 8. AI TELLS (금지 패턴)

### 비주얼 & CSS
- ❌ 네온/외곽 글로우 → ✅ inner border 또는 tinted shadow
- ❌ 순수 블랙 #000000 → ✅ #0a0a0a, Zinc-950, Slate-950
- ❌ 과포화 악센트 → ✅ 뉴트럴과 블렌딩
- ❌ 과도한 그래디언트 텍스트 → ✅ 페이지당 1개 제한

### 타이포
- ❌ Inter, Noto Sans KR, Roboto, Arial → ✅ Pretendard/Outfit/Satoshi

### 레이아웃
- ❌ 3컬럼 동일 카드 → ✅ Bento grid, zig-zag, 비대칭
- ❌ 동일 섹션 레이아웃 반복 → ✅ 각 섹션 다른 구조
- ❌ Edge-to-edge 콘텐츠 → ✅ `max-w-7xl mx-auto` 컨테이너

### 콘텐츠 (한국어)
- ❌ "김철수", "이영희" → ✅ "하윤서", "박도현", "이서진"
- ❌ "혁신적인", "차세대", "게임 체인저" → ✅ 구체적 언어
- ❌ 라운드 넘버 50,000+ → ✅ 유기적 47,200+

### 콘텐츠 (영어)
- ❌ "Revolutionize", "Game-changing", "Seamless" → ✅ Specific, concrete language
- ❌ "John Doe", "Acme Corp" → ✅ "Sarah Chen", "Meridian Labs"
- ❌ Generic stock phrases → ✅ Natural, conversational copy

---

## 9. FULL-OUTPUT ENFORCEMENT

### 금지된 출력 패턴
- `<!-- ... -->`, `<!-- rest of sections -->`, `<!-- TODO -->`
- "Let me know if you want me to continue"
- "For brevity, I'll show just the hero section"
- Hero만 출력하고 나머지 생략
- 설명으로 HTML 대체

### 완전성 기준
최소 7개 섹션: Nav + Hero + Social Proof + Features + Testimonials + CTA + Footer

### 긴 출력 처리
토큰 한도에 도달 시:
- 현재 `</section>` 태그까지 완전히 작성
- `[PAUSED — X of Y sections complete. "continue"로 재개]` 표시
- continue 시 다음 섹션부터 이어서 작성 (head 재출력 금지)

---

## 10. REDESIGN MODE

기존 랜딩페이지 업그레이드 시:

1. **Scan:** HTML/CSS 읽기. 스타일링 방법, 디자인 패턴, 폰트, 팔레트, 레이아웃 파악
2. **Diagnose:** 위 규칙 기준으로 감사. 제네릭 패턴, 약점, 누락 요소 문서화
3. **Fix:** 타겟 업그레이드 적용. 처음부터 재작성하지 않음

### 우선순위 (최대 시각적 임팩트, 최소 리스크)
1. 폰트 교체 → 2. 컬러 팔레트 정리 → 3. 콘텐츠 리라이트 → 4. 호버/액티브 상태 → 5. 레이아웃 다양화 → 6. 스크롤 애니메이션 → 7. 스페이싱/타이포 폴리싱

---

## 11. WEB QUALITY & PERFORMANCE

### Core Web Vitals 최적화
- **LCP (Largest Contentful Paint):** Hero 이미지에 `loading="eager"`, 나머지 `loading="lazy"`
- **CLS (Cumulative Layout Shift):** 이미지에 `width`/`height` 속성 명시, 폰트 FOUT 방지
- **INP (Interaction to Next Paint):** 이벤트 핸들러 가볍게, debounce 적용

### 접근성 (WCAG 2.1 AA)
- 색상 대비: 텍스트와 배경 간 4.5:1 이상
- 모든 인터랙티브 요소에 `focus-visible` 스타일
- 이미지에 의미 있는 `alt` 텍스트
- 시맨틱 HTML: `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- `<html lang="ko">` 또는 `<html lang="en">`

### SEO 기본
- `<title>` + `<meta name="description">` + `<meta property="og:image">`
- 페이지당 단일 `<h1>`, 적절한 heading 계층구조
- 구조화된 HTML5 시맨틱 요소

### 성능 가드레일
- **GPU-Safe:** `transform`과 `opacity`만 애니메이션 (top/left/width/height 절대 금지)
- **Blur 제약:** `backdrop-blur`는 fixed/sticky 요소에만
- **CDN 제한:** 외부 CDN 스크립트 최대 5개
- **Z-Index 규칙:** nav(40), overlay(50), noise(60)

---

## 12. PRE-FLIGHT CHECKLIST

출력 전 최종 확인:
- [ ] 단독 실행 가능한 단일 HTML 파일인가?
- [ ] 폰트가 올바르게 로드되고 금지 폰트가 없는가?
- [ ] 모든 아이콘이 Iconify Solar 세트를 사용하는가?
- [ ] 텍스트가 요청된 언어로 자연스럽게 작성되었는가?
- [ ] 한국어 텍스트에 `break-keep-all` + `leading-snug`가 적용되었는가?
- [ ] `min-h-[100dvh]` 사용하고 `h-screen`은 없는가?
- [ ] 모바일 레이아웃 (`w-full`, `px-4`)이 보장되는가?
- [ ] CTA 버튼이 모바일 탭 타겟 크기 (최소 48px)인가?
- [ ] 각 섹션이 이웃 섹션과 다른 레이아웃 패턴을 사용하는가?
- [ ] 금지 폰트, 이모지, Unsplash 링크가 없는가?
- [ ] hover/active/focus 상태가 모든 인터랙티브 요소에 있는가?
- [ ] 색상 대비 4.5:1 이상인가?
- [ ] 이미지에 lazy loading + alt 텍스트가 있는가?
- [ ] 페이지가 프리미엄하게 느껴지고 템플릿처럼 보이지 않는가?
