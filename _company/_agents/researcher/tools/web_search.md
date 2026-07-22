<!-- version: web_search_v1 -->
# 🔍 web_search — DuckDuckGo 웹 검색

웹에서 실시간으로 키워드를 검색하여 관련 링크와 초안 정보를 수집합니다.

## 사용법
터미널 또는 에이전트 실행 태그에서:
```bash
python _company/_agents/researcher/tools/web_search.py "<검색어>"
```

## 출력
- 표준 출력(stdout)으로 마크다운 검색 결과(제목, URL, 요약 설명) 제공.
- 동일 폴더에 `web_search_results.md`로 결과 자동 백업.

## 설정 (선택사항 - web_search.json)
- `QUERY` — 기본 검색어
