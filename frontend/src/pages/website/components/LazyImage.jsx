import React, { useState } from "react";

/**
 * LazyImage — shows a shimmer skeleton while an image loads, then fades it in.
 * objectPosition defaults to "top" so subjects/faces at the top of portrait images
 * are never cropped when placed in landscape or square containers.
 */
/**
 * objectFit options:
 *  "cover"   — fills the container, crops if needed (default for portrait in tall slots)
 *  "contain" — fits the full image inside the container with no cropping (use for
 *              landscape images placed in grid cells so nothing is cut off)
 * objectPosition — "top" keeps faces/subjects visible in portrait-cropped containers
 */
export default function LazyImage({
  src,
  alt,
  className = "",
  objectPosition = "top",
  objectFit = "cover",
  wrapperClassName = "",
  style = {},
  onError,
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleError = (e) => {
    setLoaded(true);
    setErrored(true);
    if (onError) onError(e);
  };

  const containBg = objectFit === "contain" ? "#f0f4f8" : "transparent";

  return (
    <div
      className={`relative overflow-hidden ${wrapperClassName}`}
      style={{ width: "100%", height: "100%", backgroundColor: containBg }}
    >
      {/* Shimmer skeleton — visible until image loads */}
      {!loaded && (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, #e8e8e8 0%, #f5f5f5 40%, #e8e8e8 80%)",
            backgroundSize: "200% 100%",
            animation: "skeleton-shimmer 1.4s ease-in-out infinite",
          }}
        />
      )}

      {!errored && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={className}
          style={{
            objectFit,
            objectPosition,
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.5s ease",
            width: "100%",
            height: "100%",
            ...style,
          }}
        />
      )}
    </div>
  );
}
