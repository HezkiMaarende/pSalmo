// Uses a disposable fixture account prepared by SQL; never use a real setlist.
// node --env-file=.env tests/reorder-concurrency.cjs email password serviceId
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
async function main() {
  const [email, password, serviceId] = process.argv.slice(2);
  assert(
    email?.endsWith("@psalmo-test.invalid") && password && serviceId,
    "Disposable fixture credentials required",
  );
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, options) =>
          fetch(url, { ...options, signal: AbortSignal.timeout(20000) }),
      },
    },
  );
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  try {
    const list = await client
      .from("setlists")
      .select("id,revision")
      .eq("service_id", serviceId)
      .single();
    if (list.error) throw list.error;
    const items = await client
      .from("setlist_items")
      .select("id,position")
      .eq("setlist_id", list.data.id)
      .order("position");
    if (items.error) throw items.error;
    assert(items.data.length === 3);
    const requests = await Promise.all(
      [0, 1].map(() =>
        client.rpc("move_setlist_item", {
          item_id: items.data[0].id,
          move_direction: "down",
          expected_revision: list.data.revision,
        }),
      ),
    );
    assert.equal(
      requests.filter((r) => !r.error).length,
      1,
      "One concurrent request accepted",
    );
    assert.equal(
      requests.filter((r) => r.error?.code === "PT409" && r.status === 409)
        .length,
      1,
      `One concurrent request conflicted: ${JSON.stringify(requests.map((r) => r.error && { code: r.error.code, message: r.error.message }))}`,
    );
    const final = await client
      .from("setlist_items")
      .select("id,position")
      .eq("setlist_id", list.data.id)
      .order("position");
    if (final.error) throw final.error;
    assert.deepEqual(
      final.data.map((i) => i.id),
      [items.data[1].id, items.data[0].id, items.data[2].id],
    );
    assert.equal(
      new Set(final.data.map((i) => i.position)).size,
      3,
      "Unique complete ordering",
    );
    console.log(
      "PASS: two simultaneous authenticated reorder RPCs; one accepted, one HTTP 409 conflict; complete unique ordering.",
    );
  } finally {
    await client.auth.signOut();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
