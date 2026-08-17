# Accessibility checklist for marketplace and lending flows

## Scope

- Marketplace share-purchase flow in the web app.
- Lending supply/borrow flow in the web app.
- Shared modal component used by both flows.

## Verified items

- Modal focuses the first interactive element on open.
- Modal traps keyboard focus while Tab and Shift+Tab are pressed.
- Escape closes the dialog.
- Interactive controls expose screen-reader-friendly names.
- Payment choice controls expose a radio-group pattern with explicit selection state.
- Error and warning states use stronger color contrast and live announcements for assistive technology.
- The investment modal test suite verifies the change in behavior.

## Verification notes

- Component tests were executed with Bun for the marketplace investment modal.
- Axe-based accessibility checks were added for the investment modal flow and are intended to run in the browser test environment once the runtime supports the animation layer cleanly.
