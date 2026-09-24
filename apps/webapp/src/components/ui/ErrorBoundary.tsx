"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { PageErrorFallback } from "./PageErrorFallback";
import { captureError } from "@akkuea/shared";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI. Defaults to `<PageErrorFallback />`. */
  fallback?: ReactNode;
  /** Callback invoked when the user clicks "Try again" (e.g., to refetch data). */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Reusable class-based error boundary.
 *
 * React error boundaries **must** be class components - hooks cannot catch
 * render-time errors. Wrap any subtree with `<ErrorBoundary>` to prevent a
 * single component crash from tearing down the entire page.
 *
 * Errors are logged to `console.error` so they remain visible in devtools
 * without being exposed to users.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, {
      componentStack: info.componentStack ?? undefined,
      context: "webapp-error-boundary",
    });
  }

  resetErrorBoundary = (): void => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <PageErrorFallback onReset={this.resetErrorBoundary} />;
    }
    return this.props.children;
  }
}
