'use client'

import { useWallet } from "@/components/auth/hooks/useWallet.hook";
import { useGlobalAuthenticationStore } from "@/components/auth/store/data";
import { useState } from "react";
import { Button } from "@/components/ui/button"

export default function Home() {
  const { handleConnect, handleDisconnect } = useWallet();
  const address = useGlobalAuthenticationStore((state) => state.address);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="row-start-1">
        {address ? (
            <Button onClick={handleDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect}>
              Connect
            </Button>
          )}
      </header>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <p>{address}</p>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
        >
          Footer
        </a>
      </footer>
    </div>
  );
}
