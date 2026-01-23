import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "900"],
  subsets: ["latin"],
});

const features = [
  { title: "Visual Diffs", emoji: "👀", subtitle: "GitHub-like interface" },
  { title: "Inline Comments", emoji: "💬", subtitle: "Add notes on any line" },
  { title: "100% Local", emoji: "🔒", subtitle: "Your data stays private" },
];

export const FeatureShowcase = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Each feature gets ~70 frames
  const featureIndex = Math.min(Math.floor(frame / 70), features.length - 1);
  const featureFrame = frame % 70;

  const feature = features[featureIndex];

  const titleOpacity = interpolate(featureFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleScale = spring({
    frame: featureFrame,
    fps,
    config: { damping: 12 },
  });

  const emojiScale = spring({
    frame: featureFrame - 10,
    fps,
    config: { damping: 8, stiffness: 150 },
  });

  const subtitleOpacity = interpolate(featureFrame, [25, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Screenshot animation
  const screenshotOpacity = interpolate(featureFrame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const screenshotY = interpolate(featureFrame, [30, 45], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const screenshots = ["staged-changes.png", "inline-comments.png", "side-by-side.png"];

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        fontFamily,
        padding: 50,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Feature title area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            paddingTop: 40,
          }}
        >
          <div
            style={{
              opacity: titleOpacity,
              transform: `scale(${Math.max(0, emojiScale)})`,
              fontSize: 100,
            }}
          >
            {feature.emoji}
          </div>
          <div
            style={{
              opacity: titleOpacity,
              transform: `scale(${Math.max(0, titleScale)})`,
              fontSize: 64,
              fontWeight: 900,
              color: "#ffffff",
              textAlign: "center",
            }}
          >
            {feature.title}
          </div>
          <div
            style={{
              opacity: subtitleOpacity,
              fontSize: 36,
              color: "#06d6d6",
              fontWeight: 600,
            }}
          >
            {feature.subtitle}
          </div>
        </div>

        {/* Screenshot */}
        <div
          style={{
            opacity: screenshotOpacity,
            transform: `translateY(${screenshotY}px)`,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "2px solid rgba(255, 255, 255, 0.1)",
            marginBottom: 40,
          }}
        >
          <Img
            src={staticFile(screenshots[featureIndex])}
            style={{
              width: 900,
              height: "auto",
              display: "block",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
