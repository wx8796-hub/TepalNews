import { Suspense } from "react"
import { FeedSkeleton } from "@/components/feed-skeleton"
import FeedWithInitial from "./FeedWithInitial"

export const revalidate = 300

/** Stream shell immediately; feed loads in background and streams when ready (no 14s blank). */
export default function HomePage() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedWithInitial />
    </Suspense>
  )
}
