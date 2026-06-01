export default function MapLoading() {
  return (
    <div className="min-h-screen bg-land-bg flex flex-col">
      {/* Nav skeleton */}
      <div className="h-14 bg-land-surface border-b border-land-border animate-shimmer" />
      {/* Tile grid skeleton */}
      <div className="flex-1 p-6">
        <div className="tile-grid">
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              className="w-[var(--tile-size)] h-[var(--tile-size)] rounded-[var(--tile-radius)] bg-land-surface animate-shimmer"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
