import { getImageProps } from "next/image";

/**
 * The robot form's stand-in for the scene (D-016): the orb as the intro
 * leaves it, captured from the build (`tools/capture-still.mjs`), in the
 * canvas's own slot (fixed, behind the page). Switched by orientation.
 * Nothing WebGL is fetched for it.
 */
export const SceneStill = () => {
  const common = { alt: "", sizes: "100vw", quality: 80 };
  const {
    props: { srcSet: desktop },
  } = getImageProps({
    ...common,
    src: "/vesper/assets/scene-still-desktop.webp",
    width: 1440,
    height: 900,
  });
  const { props: mobile } = getImageProps({
    ...common,
    src: "/vesper/assets/scene-still-mobile.webp",
    width: 824,
    height: 1830,
    fetchPriority: "high",
  });

  return (
    <picture>
      <source media="(min-aspect-ratio: 1/1)" srcSet={desktop} sizes="100vw" />
      <img
        {...mobile}
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 block h-full w-full bg-black object-cover"
      />
    </picture>
  );
};
