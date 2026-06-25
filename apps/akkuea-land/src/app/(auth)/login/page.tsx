export const metadata = {
  title: "Login | Akkuea Land",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-land-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-land-surface border border-land-border rounded-2xl p-8 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-land-fg">Akkuea Land</h1>
          <p className="text-land-fg-muted text-sm mt-1">
            Connect your Stellar wallet to play
          </p>
        </div>
        <button
          className="w-full py-3 rounded-xl bg-land-accent text-land-bg font-bold text-sm hover:opacity-90 transition-opacity"
          type="button"
        >
          Connect Wallet
        </button>
        <p className="text-center text-xs text-land-fg-subtle">
          Powered by Pollar · Stellar Network
        </p>
      </div>
    </div>
  );
}
