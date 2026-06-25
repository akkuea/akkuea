# Integrate 3D Gaussian Splatting Viewer for Property Previews

## Context

Real estate investment decisions depend heavily on the investor's ability to visualize and understand the physical property. Current real estate platforms offer flat photos and, at best, 360-degree panoramas. 3D Gaussian Splatting is a rendering technique that produces photorealistic, navigable 3D scenes from ordinary photos or video. Unlike traditional 3D modeling, it requires no specialized hardware to capture and runs in a standard browser via WebGL.

For Akkuea, this creates a meaningful differentiation: investors can virtually walk through a property before committing capital, directly from within the investment platform, without leaving the page. No other tokenized real estate platform offers this experience.

## What Needs to Be Done

Integrate a browser-compatible Gaussian Splatting viewer into the webapp. Create a property detail view that loads a `.splat` file and renders the scene interactively. Implement the capture and processing pipeline in documentation so property owners understand how to generate `.splat` files from their properties. Optimize the loading experience with progressive streaming and a loading state that prevents blank screens during initial load.

## Acceptance Criteria

- A `PropertyViewer3D` component renders `.splat` files in the browser using WebGL.
- The viewer is integrated into the property detail or marketplace page.
- The component loads with a `next/dynamic` import to avoid SSR issues.
- A loading skeleton is shown while the splat file streams.
- The viewer degrades gracefully when the user's GPU cannot handle the rendering load.
- Performance is acceptable on mid-range hardware: no unrecoverable frame drops on desktop.
- The capture and processing pipeline is documented for property owners.
- All CI workflows pass on the submitted pull request.

## Files to Create or Modify

Create `apps/webapp/src/components/property/PropertyViewer3D.tsx`. Integrate it into the marketplace property detail modal or a dedicated property page. Create `docs/guides/property-3d-capture.md` documenting the capture pipeline.

## Quality Standard

Performance is a first-class requirement for this issue. Test the viewer on a mid-range laptop, not just a developer machine with a high-end GPU. Implement progressive loading so the first visual feedback appears quickly even before the full splat is loaded. All CI workflows must pass.
