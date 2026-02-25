import { getPublicFeedServer } from "@/lib/get-public-feed-server"
import HomePageClient from "./HomePageClient"

/** Async server component: fetches feed then streams script + client. Used inside Suspense. */
export default async function FeedWithInitial() {
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
          __html: `(function(){var e=document.getElementById("initial-posts");if(e&&e.textContent){try{var d=JSON.parse(e.textContent);self.__INITIAL_POSTS__=d;if(Array.isArray(d)&&d.length>0)window.dispatchEvent(new CustomEvent("initial-posts",{detail:d}));}catch(t){}}})();`,
        }}
      />
      <HomePageClient />
    </>
  )
}
