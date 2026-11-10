// Shown at once while a page loads, so a click never looks like it did nothing.
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="mb-2 h-7 w-40 rounded-lg bg-line" />
      <div className="mb-6 h-4 w-24 rounded bg-line" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <div key={i} className="card h-20" />)}
      </div>
    </div>
  );
}
