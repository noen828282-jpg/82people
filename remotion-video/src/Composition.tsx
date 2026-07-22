import { AbsoluteFill, Video, Img, Series, staticFile, useCurrentFrame, useVideoConfig, spring } from "remotion";
import React from "react";

export interface Subtitle {
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export interface Clip {
  path: string;     // filename relative to public/
  duration: number; // in seconds
  isMock?: boolean;
  imagePath?: string;
}

export interface VideoData {
  clips: Clip[];
  subtitles: Subtitle[];
}

// 씬별 클립 렌더러 컴포넌트 (Ken Burns 줌인 및 디졸브 페이드인/아웃 구현)
const SceneClip: React.FC<{ clip: Clip; index: number }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationInFrames = Math.ceil((Number(clip.duration) || 6.0) * fps);

  // 1. Ken Burns Effect (1.0배에서 1.08배로 서서히 미세 줌인)
  const scale = 1 + (frame / durationInFrames) * 0.08;

  // 2. Dissolve Transition Effect (시작/끝 9프레임 동안 부드러운 페이딩)
  let opacity = 1;
  if (frame < 9) {
    opacity = frame / 9; // Fade In
  } else if (frame > durationInFrames - 9) {
    opacity = (durationInFrames - frame) / 9; // Fade Out
  }

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    transform: `scale(${scale})`,
    opacity: opacity,
    objectFit: "cover"
  };

  if (clip.isMock && clip.imagePath) {
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
        <Img src={staticFile(clip.imagePath)} style={mediaStyle} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <Video 
        src={staticFile(clip.path)} 
        onError={(err) => {
          console.warn("Video load error: " + clip.path, err);
        }}
        style={mediaStyle}
        objectFit="cover"
      />
    </AbsoluteFill>
  );
};

export const ShortsBuilder: React.FC<{ videoData: VideoData }> = ({ videoData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Find active subtitle
  const activeSubtitle = (videoData?.subtitles || []).find(
    (sub) => currentTime >= sub.start && currentTime < sub.end
  );

  // 자막 내 단어들이 순차적으로 통통 튀며 회전(Tilt) 등장하는 릴스/쇼츠 스타일 렌더러
  const renderHighlightedText = (text: string, activeSubtitleFrame: number) => {
    const words = text.split(" ");
    return words.map((word, i) => {
      // 단어당 2.5프레임씩 딜레이를 주어 순차 팝업 (물 흐르듯 연출)
      const delay = Math.round(i * 2.5);
      const wordFrame = Math.max(0, activeSubtitleFrame - delay);
      
      // 단어 등장용 Spring 바운스 연출 (스프링 반동 극대화)
      const wordScale = spring({
        frame: wordFrame,
        fps,
        config: {
          damping: 10,  // 반동 횟수
          mass: 0.3,    // 질량 가볍게
          stiffness: 160 // 탄성 강하게
        }
      });

      const wordOpacity = wordFrame > 0 ? 1 : 0;
      
      // 강조 키워드 판독
      const isHighlight = 
        word.includes("?") || 
        word.includes("!") || 
        word.includes("매트") || 
        word.includes("클릭") || 
        word.includes("책상") || 
        word.includes("정돈") ||
        word.includes("역전") ||
        word.includes("논슬립") ||
        word.includes("사기임") ||
        word.includes("좌표");

      // 강조 단어는 살짝 삐딱하게 회전(Tilt)하여 개성을 살림
      const rotation = isHighlight ? (i % 2 === 0 ? 4 : -4) : 0;

      return (
        <span 
          key={i} 
          style={{ 
            color: isHighlight ? "#facc15" : "#ffffff", 
            // 쨍한 네온 글로우 텍스트 섀도우
            textShadow: isHighlight 
              ? "0px 0px 14px rgba(250, 204, 21, 0.9), 0px 0px 6px rgba(250, 204, 21, 0.6), 0px 4px 8px rgba(0,0,0,0.95)" 
              : "0px 4px 8px rgba(0,0,0,0.95)",
            marginRight: "12px",
            display: "inline-block",
            transform: `scale(${wordScale}) rotate(${rotation}deg)`,
            opacity: wordOpacity,
            transition: "opacity 0.08s ease"
          }}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* 1. Video Clips Series */}
      {videoData?.clips && videoData.clips.length > 0 ? (
        <Series>
          {videoData.clips.map((clip, idx) => (
            <Series.Sequence key={idx} durationInFrames={Math.ceil((Number(clip.duration) || 6.0) * fps)}>
              <SceneClip clip={clip} index={idx} />
            </Series.Sequence>
          ))}
        </Series>
      ) : (
        <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center", color: "white" }}>
          비디오 클립이 존재하지 않습니다.
        </AbsoluteFill>
      )}

      {/* 2. Subtitle Burn-In Overlay (TikTok Style Animated Box) */}
      {activeSubtitle && (
        <div
          style={{
            position: "absolute",
            bottom: "22%",
            left: "6%",
            right: "6%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.93)", // Very dark slate transparent border box
              padding: "18px 32px",
              borderRadius: "28px",
              border: "2px solid rgba(255, 255, 255, 0.15)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "2.8rem", // Slightly larger
              fontWeight: "900", // Ultra bold
              lineHeight: "1.4",
              textAlign: "center",
              wordBreak: "keep-all",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center"
            }}
          >
            {renderHighlightedText(
              activeSubtitle.text, 
              frame - Math.floor(activeSubtitle.start * fps)
            )}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

