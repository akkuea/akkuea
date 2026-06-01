export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-land-bg flex flex-col">
      <div className="h-14 bg-land-surface border-b border-land-border animate-shimmer" />
      <div className="flex-1 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-land-surface animate-shimmer" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-land-surface animate-shimmer" />
      </div>
    </div>
  );
}
