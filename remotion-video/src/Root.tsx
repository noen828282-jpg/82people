import "./index.css";
import { Composition, staticFile } from "remotion";
import { ShortsBuilder, VideoData, Clip } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ShortsBuilder"
        component={ShortsBuilder}
        durationInFrames={540} // Default fallback
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoData: {
            clips: [],
            subtitles: []
          }
        }}
        calculateMetadata={async () => {
          try {
            const res = await fetch(staticFile("video_data.json"));
            const data = (await res.json()) as VideoData;
            
            // Calculate total duration in seconds from clips
            let totalDurationSeconds = 0;
            if (data.clips && data.clips.length > 0) {
              totalDurationSeconds = data.clips.reduce((acc: number, clip: Clip) => acc + (Number(clip.duration) || 6.0), 0);
            } else {
              totalDurationSeconds = 18.0;
            }
            
            return {
              durationInFrames: Math.ceil(totalDurationSeconds * 30),
              props: {
                videoData: data
              }
            };
          } catch (e) {
            console.error("Error loading video_data.json, using defaults:", e);
            return {
              durationInFrames: 540,
              props: {
                videoData: {
                  clips: [],
                  subtitles: []
                }
              }
            };
          }
        }}
      />
    </>
  );
};
