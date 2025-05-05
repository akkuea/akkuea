import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai/index.mjs"

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    console.log("Chat API called")

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not defined")
      return new Response(
        JSON.stringify({
          error: "OpenAI API key is not configured. Please add your API key to the environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Parse the request body
    const { messages } = await req.json()

    // Log the messages for debugging
    console.log("Messages received:", messages)

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Create the completion
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant specialized in development and programming.",
        },
        ...messages,
      ],
      stream: true,
    })

    // Convert the response to a readable stream
    const stream = OpenAIStream(response)

    // Return the stream as a streaming response
    return new StreamingTextResponse(stream)
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to process your request. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
