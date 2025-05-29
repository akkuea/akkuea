export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  )
}
