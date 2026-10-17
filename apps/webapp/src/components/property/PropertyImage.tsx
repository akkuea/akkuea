"use client";

import { useState, type SyntheticEvent } from "react";
import Image, { type ImageProps } from "next/image";
import type { PropertyInfo } from "@akkuea/shared";
import {
  getPropertyImage,
  PROPERTY_IMAGE_PLACEHOLDER,
} from "@/components/marketplace/marketplace.utils";

// `property` is also React's RDFa attribute (a string), so it is omitted from
// the image props before being redefined as the property record.
export type PropertyImageProps = Omit<ImageProps, "src" | "property"> & {
  property: PropertyInfo;
};

/**
 * A property's primary image, rendered with next/image. Shows the shared
 * placeholder when the property has no images or its image fails to load.
 */
export function PropertyImage({
  property,
  alt,
  onError,
  ...props
}: PropertyImageProps) {
  const src = getPropertyImage(property);
  // Tracks which src failed rather than a flag, so a new src is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const displaySrc = failedSrc === src ? PROPERTY_IMAGE_PLACEHOLDER : src;

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event);
    // Never retry once the placeholder itself is showing, so it cannot loop.
    if (displaySrc !== PROPERTY_IMAGE_PLACEHOLDER) {
      setFailedSrc(src);
    }
  };

  return <Image {...props} alt={alt} src={displaySrc} onError={handleError} />;
}
