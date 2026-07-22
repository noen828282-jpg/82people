# Node 9: Media Prompt Generation (이미지/영상 프롬프트 생성 노드)

## 1. 개요
* **목적**: 대본 및 각 장면의 비주얼 기획안(`scene_briefs`)을 가공하여, AI 이미지/비디오 생성기(Stable Diffusion, Midjourney, Runway Gen 등)에 전송할 최적화된 고품질의 영어 텍스트 프롬프트를 자동으로 설계합니다.
* **트리거 방식**: 대본 생성 완료 트리거 수신 시 단 건 실행.
* **주요 흐름**: 단일 상품 정보 및 대본/기획서 로드 -> 각 장면의 시각 묘사 분석 -> 영어 번역 및 시각적 디테일(조명, 화질, 카메라 앵글) 보강 -> `media_prompts` 데이터 매핑 -> 결과 저장 및 다음 노드로 전달.

## 2. AI 이미지/영상 프롬프트 작성 가이드라인 (Prompt Guidelines)
생성 AI 모델의 결과물 품질을 향상하기 위해 아래 3대 표준 지침을 준수하여 영어 프롬프트를 생성합니다.

* **영어 표기 원칙**:
  - 대부분의 고성능 이미지/영상 생성 AI는 영문 프롬프트에서 압도적으로 일관적인 품질을 제공하므로, 시각 지침은 반드시 영어로 변환하여 제공합니다.
* **시각적 품질 및 렌더링 스타일 보강**:
  - `photo-realistic`, `highly detailed texture`, `8k resolution`, `cinematic lighting`, `warm cozy room mood` 등의 연출 키워드를 문장 끝에 부착합니다.
* **카메라 구도 및 조명 묘사 의무화**:
  - 씬의 목적에 맞는 카메라 앵글을 명시합니다. (예: `close-up macro shot`, `isometric top-down view`, `low-angle shot`)
  - 명확한 조명 상태를 설정합니다. (예: `soft natural window light`, `moody neon night glow`, `professional studio softbox`)

## 3. 인터페이스 정의
* **입력 데이터**: `input_schema.json` 참조 (대본과 장면 브리프가 완료된 단일 상품 객체)
* **출력 데이터**: `output_schema.json` 참조 (각 장면별 영문 프롬프트 목록 `media_prompts` 가 추가된 단일 상품 객체)

## 4. 실행 방법
```bash
python create_media_prompts.py --input sample_input.json --output output.json
```
