# Development Assistant

An AI-powered development assistant built for the monorepo structure. This assistant is designed to help with a wide range of development-related queries, providing accurate and helpful responses to technical questions.

## Features

- **Development-focused AI**: Specialized in web development, software engineering, and programming best practices
- **Modern UI**: Clean, black theme with turquoise accents
- **Real-time streaming**: Messages stream in real-time as they're generated
- **Error handling**: Robust error handling and validation
- **Responsive design**: Works well on all device sizes

## Technical Implementation

The assistant is built using:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Vercel AI SDK
- OpenAI's GPT-4o model

## Getting Started

1. Ensure you have set up your OpenAI API key in the environment variables:
   \`\`\`
   OPENAI_API_KEY=your_api_key_here
   \`\`\`

2. Run the development server:
   \`\`\`bash
   cd packages/assistant
   npm run dev
   \`\`\`

3. Open [http://localhost:3000](http://localhost:3000) in your browser to see the assistant in action.

## Usage

The assistant can help with:

- Code examples and explanations
- Debugging assistance
- Best practices and patterns
- Framework-specific questions
- General development guidance

Simply type your question in the input field and press Enter or click the send button to get a response.
