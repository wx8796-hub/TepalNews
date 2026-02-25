import { getPublicFeedServer } from "@/lib/get-public-feed-server"
import HomePageClient from "./HomePageClient"

export const revalidate = 300

/** Server component: fetch public feed (no cookies/auth), inject for client hydrate. */
export default async function HomePage() {
  const initialPosts = await getPublicFeedServer()
  const safeJson = JSON.stringify(initialPosts).replace(/<\/script/gi, "<\\/script")
  return (
    <>
      <script
        id="initial-posts"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: safeJson }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var e=document.getElementById("initial-posts");if(e&&e.textContent){try{self.__INITIAL_POSTS__=JSON.parse(e.textContent);}catch(t){}}})();`,
        }}
      />
      <HomePageClient />
    </>
  )
}
