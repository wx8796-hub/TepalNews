import type { SupabaseClient } from "@supabase/supabase-js"

const GLOBAL_TITLE = "TePal Global Chat"
const GLOBAL_SLUG = "global"

/**
 * Returns the global conversation id if it exists (SELECT only).
 * Run supabase-chat-migration.sql first so the row exists.
 */
export async function getGlobalConversationId(
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    const { data: bySlug, error: slugErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("slug", GLOBAL_SLUG)
      .maybeSingle()
    if (!slugErr && bySlug?.id) return bySlug.id
  } catch {
    /* slug column may not exist; fall back to type+title */
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("type", "group")
    .eq("title", GLOBAL_TITLE)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return existing?.id ?? null
}

/**
 * Ensures exactly one "TePal Global Chat" (global) conversation exists and returns its id.
 * 1) SELECT by slug or type+title. 2) If missing, INSERT (needs permission or use API).
 */
export async function getOrCreateGlobalConversation(
  supabase: SupabaseClient
): Promise<string | null> {
  const existing = await getGlobalConversationId(supabase)
  if (existing) return existing

  const payload: { type: "group"; title: string; slug?: string } = { type: "group", title: GLOBAL_TITLE }
  try {
    const { data: inserted, error: insertErr } = await supabase
      .from("conversations")
      .insert({ ...payload, slug: GLOBAL_SLUG })
      .select("id")
      .single()
    if (!insertErr && inserted?.id) return inserted.id
  } catch {
    /* slug column may not exist */
  }
  const { data: inserted, error: insertErr } = await supabase
    .from("conversations")
    .insert(payload)
    .select("id")
    .single()

  if (!insertErr && inserted?.id) return inserted.id

  if (process.env.NODE_ENV === "development" && insertErr) {
    console.warn("[chat] getOrCreateGlobalConversation insert failed:", insertErr.message)
  }

  const fallback = await getGlobalConversationId(supabase)
  return fallback
}

export const GLOBAL_CHAT_TITLE = GLOBAL_TITLE
