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

## 🎨 Styling

This project uses Tailwind CSS for styling. The configuration can be found in `tailwind.config.ts`.

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
