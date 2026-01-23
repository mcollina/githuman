import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["latin"],
});

export const IntroScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const taglineOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineY = interpolate(frame, [25, 45], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
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
          gap: 40,
        }}
      >
        <div
          style={{
            transform: `scale(${logoScale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
          }}
        >
          <Img
            src={staticFile("logo.svg")}
            style={{
              width: 200,
              height: 200,
            }}
          />
          <span
            style={{
              fontSize: 120,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            GitHuman
          </span>
        </div>

        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            fontSize: 56,
            fontWeight: 700,
            background: "linear-gradient(90deg, #06d6d6 0%, #a855f7 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          Review AI Code
          <br />
          Before Commit
        </div>

        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 36,
            color: "#94a3b8",
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          The human checkpoint
        </div>
      </div>
    </AbsoluteFill>
  );
};
