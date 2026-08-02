# Storybook

This directory contains the Storybook configuration for previewing UI components in isolation.

## Running Storybook

```bash
# From the root:
bun run storybook

# Or from apps/webapp:
cd apps/webapp && bun run storybook
```

This starts Storybook on `http://localhost:6006`.

## Building Storybook

```bash
bun run build-storybook
```

Output goes to `apps/webapp/storybook-static/`.

## Adding a new story

1. Create a file named `ComponentName.stories.ts` next to your component.
2. Import the component and Storybook types:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: "Click me", variant: "primary" },
};
```

3. The story is automatically picked up by the `../src/**/*.stories.@(ts|tsx)` glob.

### Conventions

- Use `title: "UI/ComponentName"` to keep all UI components grouped together.
- Export one `meta` object and one `Story` per variant.
- Use `render` for complex compositions (e.g., Card with Header/Footer).
- Use `args` for simple prop variations.
