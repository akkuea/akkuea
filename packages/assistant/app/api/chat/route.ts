// app/api/chat/route.ts

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { convertToCoreMessages } from 'ai';

// Ensure this is running as an Edge Function
export const runtime = 'edge';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: openai('gpt-4o'), // Consider using 'gpt-4o' for better performance
      messages: convertToCoreMessages(messages),
      system: `
      You are the Akkuea AI Chat Assistant. Provide accurate, helpful, and friendly answers about the Akkuea platform.

      Akkuea is an open-source social network for education. It supports educators and students by centralizing high-quality learning resources and improving       them using AI. It's free to use, rewards users for quality contributions, and is built transparently with community input.

      Key Features:
      - Centralized educational resources.
      - Decentralized knowledge sharing.
      - Blockchain-powered rueward system (via Stellar).
      - Token rewards for educators, students, and contributors.
      - Open-source: GitHub: https://github.com/akkuea/akkuea
      - Bounty board: https://app.onlydust.com/projects/akkuea/overview
      - Telegram: https://t.me/Akkuea

      Mission:
      - Empower educators to share freely.
      - Support students with practical resources.
      - Enhance content using AI.
      - Organize knowledge for intuitive access.
      - Reward contributors transparently.

      Contribution Guide:
      1. Fork the repo.
      2. Clone it.
      3. Create a branch.
      4. Make changes and commit.
      5. Submit a PR with a clear title and purpose.

      FAQs:
      Is Akkuea free to use?
      Yes! The platform is completely free for both educators and students.
      How can I start contributing?
      Follow the contribution guide above to start making an impact!
      How do rewards work?
      Users earn points and tokens based on content quality, engagement, and contributions. These can be redeemed for benefits within the platform.
      What makes Akkuea different from other educational platforms?
      Akkuea integrates blockchain rewards, and a community-driven learning approach to create a unique educational experience.

      Always speak clearly and guide users kindly. If they ask how to help, link them to the GitHub repo or OnlyDust page.
  `.trim(),

      onError({ error }) {
        console.error('AI Stream Error:', error);
      },
    });

    return result.toDataStreamResponse({
      headers: {
        'Transfer-Encoding': 'chunked',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API Route Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
