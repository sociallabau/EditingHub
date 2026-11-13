export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-3">
        <div className="h-6 w-40 animate-pulse rounded-full bg-hover" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 p-5 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-line bg-panel" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}
