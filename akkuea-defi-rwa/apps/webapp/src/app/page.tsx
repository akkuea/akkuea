import Image from "next/image";
import TransactionHistory from "@/components/TransactionHistory";
import { Transaction } from "@real-estate-defi/shared/src/types";

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_1",
    type: "share_purchase",
    amount: 1500,
    from: "GB...",
    to: "GA...",
    timestamp: new Date("2026-04-25T14:30:00Z"),
    txHash: "7b4e9f8a2c1d6e5b4a3f2e1d0c9b8a7f6e5d4c3b2a10987654321fedcba09876",
    status: "confirmed",
  },
  {
    id: "tx_2",
    type: "deposit",
    amount: 5000,
    from: "GB...",
    timestamp: new Date("2026-04-26T00:10:00Z"),
    txHash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    status: "pending",
  },
  {
    id: "tx_3",
    type: "borrow",
    amount: 2500,
    from: "GB...",
    to: "GC...",
    timestamp: new Date("2026-04-24T09:15:00Z"),
    txHash: "f1e2d3c4b5a697887766554433221100aabbccddeeffeeddccbbaa0099887766",
    status: "confirmed",
  },
  {
    id: "tx_4",
    type: "repayment",
    amount: 500,
    from: "GB...",
    to: "GC...",
    timestamp: new Date("2026-04-23T11:45:00Z"),
    txHash: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    status: "failed",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black p-8 sm:p-20">
      <main className="max-w-4xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Akkuea DeFi Dashboard
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400">
              Real-World Asset Tokenization on Stellar
            </p>
          </div>
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={120}
            height={24}
            priority
          />
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-zinc-900 text-white shadow-xl flex flex-col justify-between h-48 border border-zinc-800">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Portfolio Value</span>
              <span className="text-5xl font-mono font-medium">$12,450.00</span>
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <span>↑ 12.5% from last month</span>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-white text-zinc-900 shadow-sm border border-zinc-200 flex flex-col justify-between h-48">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 font-sans">Active Positions</span>
              <span className="text-5xl font-mono font-medium tracking-tighter">08</span>
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <span>Across 3 different asset classes</span>
              </div>
            </div>
          </div>

          <TransactionHistory transactions={MOCK_TRANSACTIONS} />
        </div>
      </main>
    </div>
  );
}
