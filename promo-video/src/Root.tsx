import { Composition } from "remotion";
import { GitHumanPromo } from "./GitHumanPromo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="GitHumanPromo"
      component={GitHumanPromo}
      durationInFrames={600}
      fps={30}
      width={1080}
      height={1080}
    />
  );
};
