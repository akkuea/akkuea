export async function POST(req: Request) {
  try {
    // Log that we received a request
    console.log('Simple chat API called');

    // Parse the request body
    const body = await req.json();
    console.log('Request body:', body);

    // Return a simple response
    return new Response(
      JSON.stringify({
        id: 'simple-response-1',
        role: 'assistant',
        content: 'This is a simple test response without using the AI SDK.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Simple chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
