export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
      <div className="h-8 w-2/3 animate-pulse rounded-full bg-hover" />
      <div className="h-5 w-1/3 animate-pulse rounded-full bg-hover" />
      <div className="h-32 animate-pulse rounded-2xl border border-line bg-panel" />
      <div className="h-32 animate-pulse rounded-2xl border border-line bg-panel" />
    </div>
  );
}
