/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import { afterEach, describe, expect, it, mock } from "bun:test";
import type { ImgHTMLAttributes } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PropertyInfo } from "@akkuea/shared";
import { PROPERTY_IMAGE_PLACEHOLDER } from "@/components/marketplace/marketplace.utils";

mock.module("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => <img {...props} alt={props.alt ?? ""} />,
}));

const { PropertyImage } = await import("../PropertyImage");

const FIRST_IMAGE = "https://images.unsplash.com/photo-first?w=800";
const OTHER_IMAGE = "https://images.unsplash.com/photo-other?w=800";

function buildProperty(images: string[]): PropertyInfo {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "Lagos Marina Towers",
    description: "Premium residential asset with audited legal documentation.",
    propertyType: "residential",
    location: {
      address: "12 Admiralty Way",
      city: "Lagos",
      country: "Nigeria",
    },
    totalValue: "1000000",
    totalShares: 1000,
    availableShares: 500,
    pricePerShare: "100",
    images,
    documents: [],
    verified: true,
    listedAt: "2024-01-01T00:00:00.000Z",
    owner: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
  };
}

function getImage(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector("img");
  if (!image) {
    throw new Error("PropertyImage did not render an <img>");
  }
  return image;
}

describe("PropertyImage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the property's first image with the given alt text", () => {
    const { container } = render(
      <PropertyImage
        property={buildProperty([FIRST_IMAGE, OTHER_IMAGE])}
        alt="Lagos Marina Towers"
        width={80}
        height={80}
      />,
    );

    const image = getImage(container);
    expect(image.getAttribute("src")).toBe(FIRST_IMAGE);
    expect(image.getAttribute("alt")).toBe("Lagos Marina Towers");
  });

  it("renders the placeholder when the property has no images", () => {
    const { container } = render(
      <PropertyImage property={buildProperty([])} alt="No images" fill />,
    );

    expect(getImage(container).getAttribute("src")).toBe(
      PROPERTY_IMAGE_PLACEHOLDER,
    );
  });

  it("switches to the placeholder when the image fails to load", () => {
    const { container } = render(
      <PropertyImage
        property={buildProperty([FIRST_IMAGE])}
        alt="Broken image"
        fill
      />,
    );

    fireEvent.error(getImage(container));

    expect(getImage(container).getAttribute("src")).toBe(
      PROPERTY_IMAGE_PLACEHOLDER,
    );
  });

  it("stays on the placeholder when the placeholder itself fails", () => {
    const onError = mock(() => {});
    const { container } = render(
      <PropertyImage
        property={buildProperty([FIRST_IMAGE])}
        alt="Broken image"
        fill
        onError={onError}
      />,
    );

    fireEvent.error(getImage(container));
    fireEvent.error(getImage(container));
    fireEvent.error(getImage(container));

    expect(getImage(container).getAttribute("src")).toBe(
      PROPERTY_IMAGE_PLACEHOLDER,
    );
    expect(onError).toHaveBeenCalledTimes(3);
  });

  it("tries a new image again after an earlier one failed", () => {
    const { container, rerender } = render(
      <PropertyImage
        property={buildProperty([FIRST_IMAGE])}
        alt="Property"
        fill
      />,
    );

    fireEvent.error(getImage(container));
    expect(getImage(container).getAttribute("src")).toBe(
      PROPERTY_IMAGE_PLACEHOLDER,
    );

    rerender(
      <PropertyImage
        property={buildProperty([OTHER_IMAGE])}
        alt="Property"
        fill
      />,
    );

    expect(getImage(container).getAttribute("src")).toBe(OTHER_IMAGE);
  });
});
