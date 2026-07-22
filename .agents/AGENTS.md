# 🏢 동민 AI 컴퍼니 — 프로젝트 규칙 (AGENTS.md)

> Antigravity가 매 대화 시작 시 자동으로 읽는 규칙 파일입니다.
> 이 파일 덕분에 매번 프로젝트를 설명할 필요가 없어집니다.

---

## 📂 워크스페이스 구조

```
d:\dongmin ai company\
├── shorts-automation/       ← 🎬 쇼핑 쇼츠 자동화 파이프라인 (핵심 프로젝트)
│   ├── dashboard_server.py  ← FastAPI 대시보드 서버 (668줄)
│   ├── run_pipeline.py      ← 파이프라인 실행기
│   └── nodes/               ← 19개 노드 (상품수집→스코어링→경쟁분석→스크립트→영상→업로드)
├── landing-pages/           ← 💰 수익화 랜딩페이지 (HTML)
├── paypal-deploy/           ← 💳 PayPal 결제 연동
├── remotion-video/          ← 🎥 Remotion 영상 생성
├── .secondbrain/            ← 🧠 지식 관리 시스템 (Wiki/Skills/Raw)
├── .agent/skills/           ← Antigravity 스킬 저장소
├── .claude/skills/          ← Claude 스킬 저장소
└── _company/                ← 회사 내부 문서
```

---

## 🔧 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| **Backend** | Python 3.x, FastAPI | shorts-automation 핵심 |
| **Frontend** | HTML/CSS/JS, React (필요시) | 프리미엄 디자인 필수 |
| **Styling** | Vanilla CSS 우선, TailwindCSS (요청 시만) | 글래스모피즘, 다크모드 |
| **DB** | SQLite (로컬), Firebase (프로덕션) | |
| **결제** | PayPal MCP (PRODUCTION 모드) | 실제 결제 연동됨 ⚠️ |
| **영상** | Remotion, FFmpeg | 쇼츠 자동 생성 |
| **AI** | OpenAI GPT, Google Gemini | API 키 .env에 보관 |

---

## 📏 코딩 규칙

### Python
- **타입힌트 필수**: `def func(name: str) -> dict:`
- **Docstring**: Google 스타일
- **에러 핸들링**: 모든 외부 API 호출에 try/except
- **인코딩**: 파일 읽기/쓰기 시 `encoding="utf-8"` 명시
- **경로**: `os.path.join()` 사용 (하드코딩 금지)

### Frontend
- **언어**: UI 텍스트는 **영어** (글로벌 타겟)
- **디자인**: 프리미엄 퀄리티 (MVP 수준 금지)
  - Google Fonts (Inter, Outfit, Roboto)
  - HSL 기반 세련된 컬러 팔레트
  - 글래스모피즘 + 마이크로 애니메이션
- **반응형**: 모바일 퍼스트

### Git
- **커밋**: Conventional Commits 형식 (`feat:`, `fix:`, `docs:`)
- **브랜치**: `main` 기본

---

## 🎬 shorts-automation 파이프라인 노드 맵

```
Node 1: product_candidate_collection  → 상품 수집 (소싱)
Node 2: product_scoring               → 상품 스코어링/필터링
         ↓ bridge_logic (최상위 1종 선택)
Node 3: competitor_pattern             → 경쟁자 패턴 분석
Node 4: product_refinement             → 상품 정보 정제
Node 5: script_generation              → 쇼츠 대본 생성
Node 6: scene_brief                    → 씬 브리프 작성
Node 7: media_prompt                   → 미디어 프롬프트
Node 8: media_generation_queue         → 미디어 생성 큐
Node 9: media_inspection               → 미디어 검수
Node 10: subtitle_cta                  → 자막/CTA 오버레이
Node 11: video_compilation             → 영상 편집/병합
Node 12: regulation_check              → 규정 검사
Node 13: manual_approval               → 수동 승인 게이트
Node 14: affiliate_link_audit          → 제휴 링크 검증
Node 15: upload_package                → 업로드 패키지
Node 16: performance_logging           → 성과 로깅
Node 17: next_experiment               → 다음 실험 설정
```

---

## ⚡ 토큰 효율 규칙

1. **검색 우선**: 파일 전체를 보지 말고 `grep_search`로 필요한 부분만 찾기
2. **범위 지정 조회**: 큰 파일은 `StartLine/EndLine`으로 필요한 범위만 보기
3. **최소 범위 수정**: `replace_file_content`로 변경할 부분만 수정 (전체 덮어쓰기 금지)
4. **병렬 호출**: 독립적인 작업은 한 번에 여러 도구를 병렬 호출
5. **반복 질문 금지**: 이 파일에 답이 있는 질문은 다시 묻지 않기

---

## 🔑 환경 변수 (.env)

- `OPENAI_API_KEY` — OpenAI API
- `GOOGLE_API_KEY` — Google/Gemini API  
- `PAYPAL_ACCESS_TOKEN` — PayPal (PRODUCTION)
- 기타 키는 `.env` 파일 참조

---

## 📋 자주 하는 작업 패턴

| 작업 | 명령/방법 |
|------|-----------|
| 대시보드 실행 | `python dashboard_server.py` (FastAPI, port 8000) |
| 파이프라인 실행 | `python run_pipeline.py` |
| PayPal 결제 | PayPal MCP 도구 사용 (`create_order`, `create_invoice`) |
| 랜딩페이지 생성 | Premium Design Engine (Claude/Antigravity) |
| 지식 동기화 | `.secondbrain/` → GitHub 동기화 |

---

## ⚠️ 주의사항

- `paypal_debug.txt` (264KB) — 디버그 로그, 컨텍스트에 로드하지 말 것
- `.env` 파일 — 절대 커밋하지 말 것
- PayPal은 **PRODUCTION 모드** — 실제 결제가 발생함
- `node_modules/` — 무시할 것
