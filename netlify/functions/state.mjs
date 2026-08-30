// 进度存储。Netlify Blobs 是站点自带的键值存储，不用另外开数据库。
//
// GET  /api/state  -> 当前进度（还没有就返回 null）
// PUT  /api/state  -> 写入；带的 seq 比服务器旧就返回 409 + 服务器版本
// DELETE /api/state -> 清空（全部重置用）
//
// 如果在 Netlify 后台设了环境变量 BB_KEY，则每个请求都要带
// x-bb-key 头（或 ?k=...）才放行。不设就是任何人拿到网址都能改。

import { getStore } from "@netlify/blobs";

const KEY = "state";

function json(body, status) {
  return new Response(JSON.stringify(body === undefined ? null : body), {
    status: status || 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function denied(req) {
  const want = process.env.BB_KEY;
  if (!want) return false;
  const got =
    req.headers.get("x-bb-key") || new URL(req.url).searchParams.get("k") || "";
  return got !== want;
}

export default async (req) => {
  if (denied(req)) return json({ error: "bad key" }, 401);

  const store = getStore({ name: "beyblade", consistency: "strong" });

  if (req.method === "GET") {
    return json(await store.get(KEY, { type: "json" }));
  }

  if (req.method === "PUT" || req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "bad body" }, 400);
    }
    // 乐观并发：seq 只增不减，落后的写入被拒绝并拿回服务器版本。
    const cur = await store.get(KEY, { type: "json" });
    if (cur && (cur.seq | 0) > (body.seq | 0)) return json(cur, 409);
    await store.setJSON(KEY, body);
    return json({ ok: true, seq: body.seq | 0 });
  }

  if (req.method === "DELETE") {
    await store.delete(KEY);
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/state" };
