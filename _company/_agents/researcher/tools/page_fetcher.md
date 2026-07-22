<!-- version: page_fetcher_v1 -->
# 📖 page_fetcher — 웹페이지 본문 추출

특정 URL의 웹페이지 내용을 텍스트 형식으로 다운로드하여 핵심 본문을 추출합니다. script, style 태그 및 불필요한 공백을 자동 필터링합니다.

## 사용법
터미널 또는 에이전트 실행 태그에서:
```bash
python _company/_agents/researcher/tools/page_fetcher.py "<URL>"
```

## 출력
- 표준 출력(stdout)으로 추출된 본문 텍스트 제공 (최대 8000자 제한으로 컨텍스트 최적화).
- 동일 폴더에 `page_fetcher_content.txt`로 백업 저장.

## 설정 (선택사항 - page_fetcher.json)
- `URL` — 기본 웹사이트 주소
