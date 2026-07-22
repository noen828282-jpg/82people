---
name: remotion-video-expert
description: Remotion을 사용한 프로그래밍 방식 영상 생성 스킬. 쇼츠 자동화 영상 편집 시 활성화. remotion-dev 공식 스킬 기반.
---

# 🎬 Remotion Video Expert Skill

> Source: VoltAgent/awesome-agent-skills → remotion-dev/remotion 공식 스킬 기반
> 동민님의 shorts-automation 파이프라인(Node 11: video_compilation)에 최적화

## Goal
React 기반 Remotion 프레임워크로 **유튜브 쇼츠 영상을 프로그래밍 방식으로 생성**한다.

---

## 핵심 개념

### Remotion 프로젝트 구조
```
remotion-video/
├── src/
│   ├── Root.tsx              ← 최상위 컴포넌트
│   ├── Composition.tsx       ← 영상 등록
│   ├── ShortVideo.tsx        ← 쇼츠 메인 컴포넌트
│   ├── components/
│   │   ├── ProductCard.tsx   ← 상품 소개 카드
│   │   ├── TextOverlay.tsx   ← 자막/CTA 오버레이
│   │   └── Transition.tsx    ← 전환 효과
│   └── data/
│       └── input.json        ← 파이프라인에서 받는 데이터
├── public/                   ← 미디어 에셋
├── remotion.config.ts
└── package.json
```

### 쇼츠 스펙
- **해상도**: 1080x1920 (9:16 세로)
- **길이**: 15~60초
- **FPS**: 30
- **출력 형식**: MP4 (H.264)

### 기본 코드 패턴

```tsx
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';

export const ShortVideo: React.FC<{ productData: ProductData }> = ({ productData }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Scene 1: Hook (0~3초) */}
      <Sequence from={0} durationInFrames={3 * fps}>
        <HookScene text={productData.hookText} />
      </Sequence>

      {/* Scene 2: 상품 소개 (3~8초) */}
      <Sequence from={3 * fps} durationInFrames={5 * fps}>
        <ProductShowcase product={productData} />
      </Sequence>

      {/* Scene 3: CTA (마지막 3초) */}
      <Sequence from={durationInFrames - 3 * fps}>
        <CTAOverlay link={productData.affiliateLink} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

---

## shorts-automation 연동

파이프라인 노드와의 연결:
```
Node 7: media_prompt    → 미디어 프롬프트 생성
Node 8: media_generation → 이미지/영상 소스 생성
Node 9: media_inspection → 미디어 품질 검수
Node 10: subtitle_cta   → 자막/CTA 오버레이 데이터
Node 11: video_compilation → ⭐ Remotion으로 최종 영상 합성
```

### 렌더링 명령어
```bash
# 개발 미리보기
npx remotion preview

# 최종 렌더링
npx remotion render src/index.ts ShortVideo out/short.mp4 \
  --props='{"productData": ...}' \
  --width=1080 --height=1920 --fps=30

# 람다 렌더링 (대량 생산)
npx remotion lambda render ...
```

---

## 주의사항

- FFmpeg 경로를 환경변수로 설정 필요 (`FFMPEG_PATH`)
- 한글 폰트를 사용할 때 `@fontsource` 패키지로 번들링
- 이미지/영상 에셋은 `staticFile()`이 아닌 `public/` 폴더에 배치
- 렌더링 시 메모리 부족 주의: `--concurrency=2`로 제한
