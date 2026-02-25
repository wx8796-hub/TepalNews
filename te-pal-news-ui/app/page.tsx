import HomePageClient from "./HomePageClient"

/** No server-side Supabase: instant TTFB. Feed loads from Edge API (/api/public-posts). */
export default function HomePage() {
  return <HomePageClient />
}
