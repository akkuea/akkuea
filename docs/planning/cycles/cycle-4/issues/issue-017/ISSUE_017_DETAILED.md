# C4-017: Integrate 3D Gaussian Splatting Viewer for Property Previews

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C4-017         |
| Area            | WEBAPP         |
| Difficulty      | High           |
| Labels          | frontend, high |
| Dependencies    | None           |
| Estimated Lines | 200-350        |

## What is Gaussian Splatting

Gaussian Splatting represents a 3D scene as millions of small Gaussian ellipsoids, each with a position, shape, color, and opacity. Unlike mesh-based 3D models, it is generated from photos and renders photorealistically. Unlike NeRF (Neural Radiance Fields), it is fast enough to run in real time in the browser at 30-60 fps via WebGL.

The output of the capture pipeline is a `.splat` file. The viewer in this issue loads and renders that file.

## Recommended Library

Use `@sparkjoy/gaussian-splatting` or `splat` (by antimatter15) as the WebGL renderer. Both are npm-installable and integrate with React via a canvas element. The `@lumaai/luma-web` package is an alternative that integrates with Three.js and provides higher-level scene management.

Recommended choice for this project: `@lumaai/luma-web` if the team has existing Three.js familiarity, or the standalone `splat` package for a lighter integration.

```bash
cd apps/webapp
bun add @lumaai/luma-web
# or
bun add splat
```

Research both options and make a decision based on the current project context. Document the choice in the pull request.

## Component Implementation

Create `apps/webapp/src/components/property/PropertyViewer3D.tsx`. Because this component uses WebGL and accesses browser APIs, it must be a client component and loaded dynamically:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';

interface PropertyViewer3DProps {
  splatUrl: string;
  className?: string;
}

export function PropertyViewer3D({ splatUrl, className }: PropertyViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize the splat viewer here using the chosen library
    // Handle the loading lifecycle: start loading, update isLoading on completion,
    // set error on failure

    return () => {
      // Cleanup: dispose the viewer and release GPU resources
    };
  }, [splatUrl]);

  if (error) {
    return (
      <div className={className}>
        <p>3D preview unavailable for this property.</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && <ViewerSkeleton />}
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
      />
    </div>
  );
}
```

## Dynamic Import Wrapper

Because the viewer uses WebGL and accesses `window`, it cannot run during SSR. Create a separate file that re-exports the component with a dynamic import:

```typescript
// apps/webapp/src/components/property/PropertyViewer3D.dynamic.tsx
import dynamic from 'next/dynamic';

export const PropertyViewer3D = dynamic(
  () =>
    import('./PropertyViewer3D').then((mod) => ({ default: mod.PropertyViewer3D })),
  {
    ssr: false,
    loading: () => <ViewerSkeleton />,
  },
);
```

Import `PropertyViewer3D` from the `.dynamic` file in all page components.

## Performance Considerations

Gaussian Splat files are large (10-100 MB). The following practices are required:

**Progressive streaming**: The `splat` and Luma AI libraries both support streaming, where the scene renders progressively as data arrives rather than waiting for the full download. Ensure streaming is enabled.

**Web Worker for sorting**: Gaussian Splat rendering requires sorting the Gaussians by depth on every camera movement. This is CPU-intensive. Use a Web Worker for the sort step so the main thread remains unblocked. Most libraries do this by default; confirm it is enabled.

**GPU capability detection**: Before loading the splat file, check for WebGL2 support:

```typescript
function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}
```

If WebGL2 is not available, show a high-quality photo fallback instead of attempting to load the viewer.

**Memory cleanup**: The viewer must be disposed when the component unmounts. GPU resources are not garbage collected automatically. Call the library's dispose method in the `useEffect` cleanup function.

## Capture Pipeline Documentation

Create `docs/guides/property-3d-capture.md`. This document is written for property owners, not developers. It should explain:

1. What photos to take: minimum 50-100 photos from different angles and heights, good lighting, no motion blur.
2. Recommended capture tools: Polycam (iOS/Android), Luma AI app (iOS), or DSLR with a turntable.
3. Processing: upload to Luma AI (`lumalabs.ai`) or Polycam Pro to generate the `.splat` file. Processing takes 10-30 minutes depending on photo count.
4. File size expectations and how to provide the file URL to the platform team.
5. Tips for best results: avoid reflective surfaces, ensure every wall and corner is captured.

## Integration with Property Detail

Add the viewer to the marketplace property detail modal or create a dedicated `/property/:id/view` page. The viewer should only appear when a `splatUrl` field is present on the property. Properties without a splat file show the standard photo gallery.

## Definition of Done

- `PropertyViewer3D` renders `.splat` files in the browser.
- The component is loaded with `next/dynamic` and `ssr: false`.
- A loading skeleton is shown during initial load.
- WebGL2 absence degrades gracefully to a photo fallback.
- GPU resources are released on unmount.
- The viewer is accessible from the property detail view.
- `docs/guides/property-3d-capture.md` is created and readable by non-developers.
- All CI workflows pass on the pull request.
