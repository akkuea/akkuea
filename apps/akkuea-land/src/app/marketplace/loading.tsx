export default function MarketplaceLoading() {
  return (
    <div className="min-h-screen bg-land-bg flex flex-col">
      <div className="h-14 bg-land-surface border-b border-land-border animate-shimmer" />
      <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl bg-land-surface animate-shimmer"
          />
        ))}
      </div>
    </div>
  );
}
