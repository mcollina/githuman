import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["latin"],
});

const { fontFamily: monoFont } = loadMono("normal", {
  weights: ["500"],
  subsets: ["latin"],
});

export const SolutionScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const questionOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const answerOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const answerScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  const commandOpacity = interpolate(frame, [45, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const commandY = interpolate(frame, [45, 60], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
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
            opacity: questionOpacity,
            fontSize: 48,
            color: "#94a3b8",
            fontWeight: 500,
          }}
        >
          What if you could review
        </div>

        <div
          style={{
            opacity: answerOpacity,
            transform: `scale(${Math.max(0, answerScale)})`,
            fontSize: 72,
            fontWeight: 900,
            background: "linear-gradient(90deg, #06d6d6 0%, #34d399 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1.2,
          }}
        >
          Before You
          <br />
          Commit?
        </div>

        <div
          style={{
            opacity: commandOpacity,
            transform: `translateY(${commandY}px)`,
            background: "#0d1117",
            padding: "28px 48px",
            borderRadius: 20,
            border: "3px solid #06d6d6",
            boxShadow: "0 0 40px rgba(6, 214, 214, 0.3)",
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 40,
              color: "#06d6d6",
              fontWeight: 500,
            }}
          >
            npx githuman serve
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
