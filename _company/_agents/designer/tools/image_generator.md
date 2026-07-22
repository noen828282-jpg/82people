<!-- version: image_generator_v1 -->
# 🎨 image_generator — AI 이미지 생성기

HuggingFace Hub 추론 API를 호출하여 텍스트 프롬프트를 바탕으로 고품질의 책 표지, 본문 삽화, 에셋 이미지를 자동 생성하고 저장합니다.

## 사용법
터미널 또는 에이전트 도구 실행 창에서:
```bash
python _company/_agents/designer/tools/image_generator.py --prompt "<프롬프트>" --output "<저장 경로>" [--model "<모델 ID>"]
```

## 제공 기능
- **FLUX.1 Schnell**: 최신 이미지 생성 모델로, 글자(텍스트) 표현 및 디테일한 비주얼 묘사에 뛰어납니다. (기본값)
- **Stable Diffusion XL**: 전통적인 고화질 아트웍 및 일러스트 생성이 가능합니다.
- 토큰이 설정된 경우 보안 연결을 사용해 빠르게 다운로드하며, 토큰이 없을 경우 공용 API 루트를 사용합니다.
- `_agents/designer/config.md` 또는 `_agents/editor/config.md`에 등록된 `HUGGING_FACE_HUB_TOKEN`을 자동 연동합니다.
