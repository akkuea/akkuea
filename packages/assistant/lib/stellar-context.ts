import StellarSdk from "stellar-sdk"
import type { StellarContext } from "./types"

export async function getStellarContext(message: string): Promise<string> {
  // Basic context for now - can be enhanced with vector DB later
  const baseContext = `
    Stellar Development Context:
    - Network: Testnet/Mainnet support
    - SDK: stellar-sdk with TypeScript
    - Runtime: Bun
    - Framework: Next.js
    - State Management: Zustand
    
    Common Stellar Patterns:
    - Always check account existence
    - Use proper error handling
    - Implement proper transaction submission
    - Handle asset precision correctly
    - Use proper key pair management
    
    Best Practices:
    - Use TypeScript for type safety
    - Implement proper error boundaries
    - Use proper state management
    - Follow Stellar SEPs when applicable
    - Use proper testing
  `

  return baseContext
}

export function createStellarHelper(context: StellarContext) {
  const server = new StellarSdk.Server(
    context.network === "testnet" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org",
  )

  return {
    server,
    sdk: StellarSdk,
    async getAccountDetails(accountId: string) {
      try {
        return await server.loadAccount(accountId)
      } catch (error) {
        console.error("Error loading account:", error)
        throw new Error("Failed to load account details")
      }
    },
    async getTransactionDetails(hash: string) {
      try {
        return await server.transactions().transaction(hash).call()
      } catch (error) {
        console.error("Error loading transaction:", error)
        throw new Error("Failed to load transaction details")
      }
    },
  }
}

