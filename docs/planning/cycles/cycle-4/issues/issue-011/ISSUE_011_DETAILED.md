# C4-011: Add Error Boundaries and Graceful Offline Degradation

## Issue Metadata

| Attribute       | Value            |
| --------------- | ---------------- |
| Issue ID        | C4-011           |
| Area            | WEBAPP           |
| Difficulty      | Medium           |
| Labels          | frontend, medium |
| Dependencies    | None             |
| Estimated Lines | 120-200          |

## Overview

React error boundaries are class components that catch JavaScript errors in the component tree below them. They are the React-recommended mechanism for preventing a single broken component from crashing the full page. This issue adds them at the page level and improves offline degradation throughout the app.

## ErrorBoundary Component

Create `apps/webapp/src/components/ui/ErrorBoundary.tsx`. React error boundaries must be class components because they rely on `componentDidCatch` and `getDerivedStateFromError`, which have no hook equivalent.

```typescript
'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback />;
    }
    return this.props.children;
  }
}
```

The default fallback should match the app's visual style: use the `Card` and `Button` primitives from the UI library, show a brief message, and offer a retry action.

## Page-Level Integration

Wrap each page's primary data-dependent section. Do not wrap the `Navbar` or `Footer` because those should always render. The boundary should sit around the content that fetches data.

Example for the marketplace page:

```typescript
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function MarketplacePage() {
  return (
    <>
      <Navbar />
      <ErrorBoundary fallback={<MarketplaceErrorState />}>
        <MarketplaceContent />
      </ErrorBoundary>
      <Footer />
    </>
  );
}
```

Apply this pattern to: marketplace, dashboard, lending, KYC, admin operations, and tokenize pages.

## Page-Specific Error States

Each major page should have a dedicated error state component that is contextually appropriate rather than a generic "something went wrong" message.

For example:

- Marketplace error: "Properties could not be loaded. Check your connection and try again." with a retry button that calls `refetch()`.
- Dashboard error: "Portfolio data is unavailable. Your assets are safe on the blockchain." with a link to Stellar Explorer.
- Lending error: "Lending pool data could not be retrieved. Try again or check the API status."

Avoid technical error messages in the UI. Log the actual error to the console via `componentDidCatch`.

## Offline Degradation for Hooks

The data hooks (`useProperties`, `useLendingPools`, `usePortfolio`) already return an `error` string when a request fails. Ensure each page that uses these hooks renders a consistent, branded error state when `error` is non-null, rather than showing the raw error string inline.

If a hook returns `isLoading: false` and `data: []` with no error, render an appropriate empty state rather than an empty list. For example, the marketplace with zero properties should explain that no properties are currently listed rather than showing a blank grid.

## Verification

Test the error boundary by temporarily throwing an error inside a page component. Confirm the boundary catches it and renders the fallback without crashing the entire app. Test the offline state by disabling the network in browser devtools and navigating to a data-dependent page.

## Definition of Done

- `ErrorBoundary` component exists and is exported from the UI component library.
- Each major page wraps its data-dependent content in an error boundary.
- Each page has a contextually appropriate error fallback.
- Empty states are handled consistently across data-dependent pages.
- All existing tests pass.
- All CI workflows pass on the pull request.
