<!-- version: pdf_generator_v1 -->
# 📄 pdf_generator — 마크다운 to PDF 변환기

지정된 마크다운(.md) 문서를 reportlab 라이브러리를 이용하여 고품질 레이아웃의 PDF 보고서/교재 파일로 자동 빌드합니다.

## 사용법
터미널 또는 에이전트 도구 실행 창에서:
```bash
python _company/_agents/designer/tools/pdf_generator.py --input "<입력 경로>" --output "<출력 경로>" --title "<제목>"
```

## 제공 기능
- 맑은 고딕(Malgun Gothic) 폰트 자동 등록을 통한 한글 깨짐 방지
- `# Heading1`, `## Heading2` 등의 크기별 마크다운 태그 스타일 렌더링
- 볼드체(`**`), 이탤릭체(`*`) 등의 인라인 HTML 변환 지원
- 표지 생성 및 본문 페이지 분리(Page Break)
