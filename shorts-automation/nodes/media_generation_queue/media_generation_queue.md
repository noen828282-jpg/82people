# Node 10: Media Generation Queue (미디어 생성 큐 노드)

## 1. 개요
* **목적**: 장면별 영문 이미지/비디오 프롬프트를 바탕으로 AI 미디어 생성 API(Stable Diffusion, Runway 등)를 호출하고, 비동기로 렌더링 작업을 관리하는 작업 대기열(Queue) 시스템을 모사합니다.
* **트리거 방식**: 영문 프롬프트 생성 완료 트리거 수신 시 단 건 실행.
* **주요 흐름**: 단일 상품 정보 및 영문 프롬프트 리스트 수신 -> 장면별 비동기 생성 태스크 등록 모사 -> 상태 조회(Polling) 시뮬레이션 -> 로컬 모의 결과 파일 경로(mp4, png) 생성 -> `media_assets` 구조 매핑 -> 결과 저장 및 다음 노드로 전달.

## 2. 비동기 작업 대기열 모사 흐름 (Mock Polling State Machine)
실제 비동기 비디오 생성 API는 요청 후 렌더링 완료까지 수십 초에서 수 분이 소요되므로 다음과 같은 상태 머신을 시뮬레이션합니다.

1. **`SUBMITTED` (제출 완료)**:
   - 각 장면의 프롬프트를 바탕으로 API 요청을 개시하여 모의 작업 ID (`job_sd_001`, `job_rw_001` 등)와 상태 `queued`를 부여받습니다.
2. **`PROCESSING` (렌더링 중)**:
   - Polling 루프를 모사하여 가상의 작업 진행률(0% -> 50% -> 100%)을 상태 로그로 기록합니다.
3. **`COMPLETED` (완료 및 다운로드)**:
   - 작업 완료 후, 로컬 자산 보관 디렉토리(`shorts-automation/assets/output/`)에 모의 파일 경로를 셋업합니다.

## 3. 인터페이스 정의
* **입력 데이터**: `input_schema.json` 참조 (영문 프롬프트 목록 `media_prompts` 가 포함된 단일 상품 객체)
* **출력 데이터**: `output_schema.json` 참조 (생성된 동영상 `videos` 및 이미지 `images` 파일 경로 목록이 결합된 단일 상품 객체)

## 4. 실행 방법
```bash
python media_queue.py --input sample_input.json --output output.json
```
