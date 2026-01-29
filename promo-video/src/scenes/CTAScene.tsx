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
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["latin"],
});

const { fontFamily: monoFont } = loadMono("normal", {
  weights: ["500"],
  subsets: ["latin"],
});

export const CTAScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const titleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const commandOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const commandY = interpolate(frame, [30, 45], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulsing glow effect
  const glowIntensity = interpolate(
    Math.sin(frame * 0.15),
    [-1, 1],
    [0.4, 1]
  );

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
          gap: 48,
        }}
      >
        <div
          style={{
            transform: `scale(${logoScale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <Img
            src={staticFile("logo.svg")}
            style={{
              width: 140,
              height: 140,
            }}
          />
          <div
            style={{
              opacity: titleOpacity,
              fontSize: 72,
              fontWeight: 900,
              color: "#ffffff",
              textAlign: "center",
            }}
          >
            Try GitHuman
          </div>
        </div>

        <div
          style={{
            opacity: commandOpacity,
            transform: `translateY(${commandY}px)`,
            background: "#0d1117",
            padding: "32px 56px",
            borderRadius: 24,
            border: "3px solid #06d6d6",
            boxShadow: `0 0 ${50 * glowIntensity}px rgba(6, 214, 214, ${0.4 * glowIntensity})`,
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 44,
              color: "#06d6d6",
              fontWeight: 500,
            }}
          >
            npx githuman@latest serve
          </span>
        </div>

        <div
          style={{
            opacity: subtitleOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 36,
              color: "#94a3b8",
              fontWeight: 500,
            }}
          >
            Zero config. Works instantly.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#64748b",
              fontWeight: 400,
            }}
          >
            github.com/matteocollina/githuman
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
