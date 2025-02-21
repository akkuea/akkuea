import type { Message } from "ai"

export interface StellarContext {
  network: "testnet" | "mainnet"
  accountId?: string
  transactionHash?: string
}

export interface ChatMessage extends Message {
  context?: StellarContext
}

export interface ChatRequestBody {
  messages: ChatMessage[]
  projectType: "stellar"
  environment: "bun"
  context?: StellarContext
}

