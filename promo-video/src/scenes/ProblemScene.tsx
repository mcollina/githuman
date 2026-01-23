import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["latin"],
});

export const ProblemScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const subtitleOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const emojiScale = spring({
    frame: frame - 50,
    fps,
    config: { damping: 8, stiffness: 200 },
  });

  const emojiOpacity = interpolate(frame, [50, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
        padding: 60,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
          textAlign: "center",
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${Math.max(0, titleScale)})`,
            fontSize: 72,
            fontWeight: 900,
            color: "#f87171",
            lineHeight: 1.1,
          }}
        >
          PR Review?
        </div>

        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 80,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          Too Late.
        </div>

        <div
          style={{
            opacity: emojiOpacity,
            transform: `scale(${Math.max(0, emojiScale)})`,
            fontSize: 120,
          }}
        >
          😬
        </div>

        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 32,
            color: "#94a3b8",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          By then, you've already committed
          <br />
          to the approach
        </div>
      </div>
    </AbsoluteFill>
  );
};
