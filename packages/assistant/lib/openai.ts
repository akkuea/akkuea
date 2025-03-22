import { OpenAIClient } from "ai"

export const openai = new OpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: "https://api.openai.com/v1",
})

