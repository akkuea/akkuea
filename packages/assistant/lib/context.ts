import { createClient } from "@supabase/supabase-js"
import { OpenAIEmbeddings } from "langchain/embeddings/openai"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

const embeddings = new OpenAIEmbeddings()

export async function getContext(query: string) {
  const embedding = await embeddings.embedQuery(query)

  const { data: contexts } = await supabase
    .rpc("match_contexts", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
    })
    .select("content")

  return contexts?.map((c) => c.content).join("\n") || ""
}

