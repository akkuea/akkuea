"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AlertCircle, Maximize2, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui";

export interface PropertyViewer3DProps {
  splatUrl: string;
  propertyName: string;
  onLoadComplete?: () => void;
  onError?: (error: string) => void;
}

interface Viewer3DState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  isFullscreen: boolean;
  loadProgress: number;
}

export function PropertyViewer3D({
  splatUrl,
  propertyName,
  onLoadComplete,
  onError,
}: PropertyViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [state, setState] = useState<Viewer3DState>({
    isLoading: true,
    hasError: false,
    errorMessage: "",
    isFullscreen: false,
    loadProgress: 0,
  });

  const checkWebGLSupport = useCallback((): boolean => {
    try {
      const canvas = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("webgl2"))
      );
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !checkWebGLSupport()) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage:
          "WebGL not supported in this browser. Please use Chrome, Firefox, Safari, or Edge.",
      }));
      onError?.("WebGL not supported");
      return;
    }

    const initializeViewer = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, hasError: false }));

        const canvas = document.createElement("canvas");
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          containerRef.current.appendChild(canvas);
          canvasRef.current = canvas;
        }

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }

        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (!gl) {
          throw new Error("Failed to initialize WebGL context");
        }

        gl.clearColor(0.05, 0.05, 0.05, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        try {
          const response = await fetch(splatUrl, {
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(
              `Failed to load 3D preview: ${response.statusText}`,
            );
          }

          if (!response.body) {
            throw new Error("No data received from server");
          }

          const reader = response.body.getReader();
          const contentLength = parseInt(
            response.headers.get("content-length") || "0",
            10,
          );
          let receivedLength = 0;

          const chunks: Uint8Array[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            receivedLength += value.length;

            const progress =
              contentLength > 0
                ? Math.round((receivedLength / contentLength) * 100)
                : 0;
            setState((prev) => ({
              ...prev,
              loadProgress: Math.min(progress, 95),
            }));
          }

          const arrayBuffer = new ArrayBuffer(receivedLength);
          const view = new Uint8Array(arrayBuffer);
          let offset = 0;
          for (const chunk of chunks) {
            view.set(chunk, offset);
            offset += chunk.length;
          }

          setState((prev) => ({
            ...prev,
            loadProgress: 100,
            isLoading: false,
          }));

          onLoadComplete?.();
        } catch (fetchError) {
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            throw new Error("Loading took too long. Please try again.");
          }
          throw fetchError;
        }

        const handleResize = () => {
          if (canvasRef.current && containerRef.current) {
            const newRect = containerRef.current.getBoundingClientRect();
            canvasRef.current.width = newRect.width;
            canvasRef.current.height = newRect.height;

            const newGl = canvasRef.current.getContext("webgl2");
            if (newGl) {
              newGl.viewport(0, 0, newRect.width, newRect.height);
            }
          }
        };

        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load 3D viewer";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          hasError: true,
          errorMessage: message,
        }));
        onError?.(message);
        console.error("PropertyViewer3D initialization error:", error);
      }
    };

    initializeViewer();
  }, [splatUrl, onLoadComplete, onError, checkWebGLSupport]);

  const handleFullscreen = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.requestFullscreen?.().catch(() => {
        setState((prev) => ({ ...prev, isFullscreen: true }));
      });
    }
  }, []);

  const handleReset = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl) {
        gl.clearColor(0.05, 0.05, 0.05, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      }
    }
  }, []);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(splatUrl).catch(() => {
      alert("Could not copy URL to clipboard");
    });
  }, [splatUrl]);

  if (state.hasError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-lg border border-red-500/30 bg-red-500/10 p-6">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <div className="text-center">
          <h3 className="font-semibold text-white">
            Unable to Load 3D Preview
          </h3>
          <p className="mt-1 text-sm text-red-200/80">{state.errorMessage}</p>
        </div>
        <p className="text-xs text-red-200/60">
          For best experience, use a modern browser with hardware acceleration
          enabled.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-[#0a0a0a] ${
        state.isFullscreen
          ? "fixed inset-0 z-50 overflow-hidden"
          : "aspect-video overflow-hidden rounded-lg"
      }`}
    >
      {state.isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] z-40">
          <div className="w-32 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ff3e00] to-[#00ff88] transition-all duration-300"
              style={{ width: `${state.loadProgress}%` }}
            />
          </div>
          <div className="text-center">
            <p className="text-sm text-white font-medium">
              Loading {propertyName}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {state.loadProgress}% - Streaming 3D preview
            </p>
          </div>
        </div>
      )}

      <div className="absolute right-3 top-3 z-30 flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          title="Reset view"
          className="h-8 w-8 p-0 hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopyUrl}
          title="Copy URL"
          className="h-8 w-8 p-0 hover:bg-white/10"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleFullscreen}
          title="Fullscreen"
          className="h-8 w-8 p-0 hover:bg-white/10"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
