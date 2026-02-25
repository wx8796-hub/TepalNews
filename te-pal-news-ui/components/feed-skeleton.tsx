/** Server-safe skeleton for feed loading (Suspense fallback). */
export function FeedSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div className="space-y-3" aria-busy="true" aria-label="Loading posts">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-[200px] w-full rounded-lg bg-muted md:h-[280px]" />
                <div className="h-3 w-1/4 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
