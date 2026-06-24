"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "@/components/layout";
import { Button, Card, Input } from "@/components/ui";
import { useGameWallet } from "@/components/auth/hooks";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItem } from "@/lib/animations";

function sanitizeCallbackUrl(value: string | null): string {
  if (!value) return "/dashboard";
  if (value.startsWith("/")) return value;
  return "/dashboard";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => sanitizeCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams],
  );
  const { isConnected, isConnecting, authError, login } = useGameWallet();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "google" | "email" | "freighter" | null
  >(null);

  useEffect(() => {
    if (isConnected) {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, isConnected, router]);

  const visiblePendingAction = isConnecting ? pendingAction : null;

  const handleGoogle = () => {
    setEmailError(null);
    setPendingAction("google");
    login({ provider: "google" });
  };

  const handleEmail = () => {
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError(null);
    setPendingAction("email");
    login({ provider: "email", email: email.trim() });
  };

  const handleFreighter = () => {
    setEmailError(null);
    setPendingAction("freighter");
    login({ provider: "freighter" });
  };

  const errorMessage = emailError ?? authError;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,62,0,0.14),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(0,255,136,0.1),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <motion.section
            variants={staggerItem}
            className="flex flex-col justify-center gap-6"
          >
            <BrandLogo href="/" className="w-fit" />

            <div className="max-w-xl space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#262626] bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-neutral-300">
                <Sparkles className="h-3.5 w-3.5 text-[#ff3e00]" />
                Play first, wallets second
              </p>

              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Jump into Akkuea without a setup detour.
              </h1>

              <p className="max-w-lg text-sm leading-6 text-neutral-400 sm:text-base">
                Sign in with the account you already use, get a wallet in the
                background, and start exploring properties in seconds.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Shield,
                  title: "Fast access",
                  text: "No setup or fees before you can move.",
                },
                {
                  icon: CheckCircle2,
                  title: "Easy recovery",
                  text: "Use Google or email to return anytime.",
                },
                {
                  icon: Wallet,
                  title: "Freighter ready",
                  text: "Keep your own Stellar wallet if you want it.",
                },
              ].map((item) => (
                <Card
                  key={item.title}
                  className="border-white/5 bg-white/[0.03] p-4"
                >
                  <item.icon className="mb-3 h-5 w-5 text-[#ff3e00]" />
                  <h2 className="mb-1 text-sm font-medium text-white">
                    {item.title}
                  </h2>
                  <p className="text-xs leading-5 text-neutral-500">
                    {item.text}
                  </p>
                </Card>
              ))}
            </div>
          </motion.section>

          <motion.section
            variants={staggerItem}
            className="flex items-center justify-center"
          >
            <Card
              variant="gradient"
              className="w-full max-w-md border-white/10 p-6 shadow-2xl shadow-black/40 sm:p-8"
            >
              <div className="mb-6 space-y-2">
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                  Sign in
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Choose how you want to continue.
                </h2>
                <p className="text-sm leading-6 text-neutral-400">
                  We’ll keep the experience smooth and take care of the rest.
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  variant="primary"
                  size="lg"
                  className={cn(
                    "w-full justify-start border border-white/10 bg-white text-black hover:bg-neutral-200",
                    visiblePendingAction === "google" && "opacity-80",
                  )}
                  onClick={handleGoogle}
                  isLoading={visiblePendingAction === "google"}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  Continue with Google
                </Button>

                <div className="rounded-2xl border border-[#262626] bg-[#0a0a0a]/90 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#ff3e00]/10 text-[#ff3e00]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">
                        Email code
                      </h3>
                      <p className="text-xs leading-5 text-neutral-500">
                        We’ll send a one-time code to your inbox.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Input
                      label="Email address"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      error={emailError ?? undefined}
                    />
                    <Button
                      variant="accent"
                      size="lg"
                      className="w-full"
                      onClick={handleEmail}
                      isLoading={visiblePendingAction === "email"}
                      leftIcon={<ArrowRight className="h-4 w-4" />}
                    >
                      Send code
                    </Button>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="lg"
                  className={cn(
                    "w-full justify-start border-[#404040] bg-transparent text-white hover:bg-white/5",
                    visiblePendingAction === "freighter" && "opacity-80",
                  )}
                  onClick={handleFreighter}
                  isLoading={visiblePendingAction === "freighter"}
                  leftIcon={<Wallet className="h-4 w-4" />}
                >
                  Connect Freighter
                </Button>
              </div>

              {errorMessage ? (
                <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {errorMessage}
                </div>
              ) : null}

              <p className="mt-5 text-xs leading-5 text-neutral-500">
                By continuing, you’ll return to the game where you left off.
              </p>
            </Card>
          </motion.section>
        </motion.div>
      </div>
    </main>
  );
}
