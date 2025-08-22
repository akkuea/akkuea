# 🌟 Scaffold Stellar - Next.js

This is the web package of the Scaffold Stellar project, built with Next.js and modern web technologies.

## 🚀 Features

- **Modern Stack**: Built with Next.js, React, and TypeScript
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Performance Optimized**: Automatic image and font optimization
- **Developer Experience**: Hot reloading, ESLint, and Prettier integration

## 📁 Project Structure

```
nextjs/
├── public/           # Static assets
├── src/
│   ├── app/         # App router pages and layouts
│   ├── components/  # Reusable React components
│   ├── hooks/       # Custom React hooks
│   ├── styles/      # Global styles and Tailwind config
│   └── types/       # TypeScript type definitions
├── package.json
└── README.md
```

## 🛠 Getting Started

1. Install dependencies:

```bash
bun install
```

2. Run the development server:

```bash
bun run dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser

## 🔧 Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build production bundle
- `bun run start` - Start production server
- `bun run lint` - Run ESLint
- `bun run format` - Format code with Prettier
- `bun run test` - Run tests in watch mode
- `bun run test:run` - Run tests once
- `bun run test:coverage` - Run tests with coverage report
- `bun run test:ui` - Run tests with UI interface

## 🎨 Styling

This project uses Tailwind CSS for styling. The configuration can be found in `tailwind.config.ts`.

## 🧪 Testing

This project uses Vitest with React Testing Library for testing components and utilities.

### Running Tests

```bash
# Run tests in watch mode
bun run test

# Run tests once
bun run test:run

# Run tests with coverage
bun run test:coverage

# Run tests with UI interface
bun run test:ui
```

### Test File Conventions

- Place test files next to the component: `component.test.tsx`
- Or use `__tests__/` directories: `__tests__/component.test.tsx`
- Use `.test.ts(x)` or `.spec.ts(x)` extensions

### Testing Utilities

The testing setup includes:
- **Vitest**: Fast test runner with jsdom environment
- **React Testing Library**: Component testing utilities
- **jest-dom**: Extended DOM assertions
- **User Event**: Realistic user interaction simulation

### Mocking Dependencies

Common Next.js modules are automatically mocked:
- `next/navigation` - Router hooks and navigation functions
- `next/image` - Image component
- `next/link` - Link component

To add custom mocks, create them in `src/test/mocks/` and configure in `vitest.config.ts`.

### Example Test

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## 📚 Best Practices

- Keep components small and focused
- Use TypeScript for type safety
- Follow the Next.js App Router patterns
- Implement responsive design using Tailwind breakpoints
- Use semantic HTML elements
- Optimize images using Next.js Image component

## 🔗 Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [React Documentation](https://react.dev)

## 🤝 Contributing

1. Follow the project structure
2. Maintain type safety with TypeScript
3. Format code using Prettier
4. Test your changes thoroughly
5. Submit a PR with a clear description

## 💡 Tips

- Use the App Router's built-in features for layouts and loading states
- Leverage Next.js's automatic image optimization
- Implement proper error boundaries
- Use React Server Components where appropriate
- Keep accessibility in mind
