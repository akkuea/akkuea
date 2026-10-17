/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import { afterEach, describe, expect, it, mock } from "bun:test";
import type { ImgHTMLAttributes } from "react";
import { cleanup, render } from "@testing-library/react";
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

// The 3D viewer is only rendered for properties with a splat capture, which
// these cases do not have; stubbing it keeps its WebGL code out of the test.
mock.module("@/components/property/PropertyViewer3D.dynamic", () => ({
  PropertyViewer3DDynamic: () => null,
}));

const { PropertyDetail } = await import("../PropertyDetail");

const property: PropertyInfo = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Lagos Marina Towers",
  description: "Premium residential asset with audited legal documentation.",
  propertyType: "residential",
  location: {
    address: "1 Marina Road",
    city: "Lagos",
    country: "Nigeria",
  },
  totalValue: "2500000",
  totalShares: 25000,
  availableShares: 6250,
  pricePerShare: "100",
  images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
  documents: [],
  verified: true,
  listedAt: "2026-03-20T00:00:00Z",
  owner: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
};

describe("PropertyDetail", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the property's first image", () => {
    const view = render(<PropertyDetail property={property} />);

    expect(view.getByAltText(property.name).getAttribute("src")).toBe(
      property.images[0]!,
    );
  });

  it("shows the placeholder image for a property without images", () => {
    const view = render(
      <PropertyDetail property={{ ...property, images: [] }} />,
    );

    expect(view.getByAltText(property.name).getAttribute("src")).toBe(
      PROPERTY_IMAGE_PLACEHOLDER,
    );
  });
});
