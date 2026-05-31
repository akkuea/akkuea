export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-land-bg flex flex-col items-center justify-center gap-6 p-8">
      <div className="h-10 w-48 rounded-xl bg-land-surface animate-shimmer" />
      <div className="h-5 w-72 rounded-lg bg-land-surface animate-shimmer" />
      <div className="h-12 w-40 rounded-xl bg-land-surface animate-shimmer" />
    </div>
  );
}
