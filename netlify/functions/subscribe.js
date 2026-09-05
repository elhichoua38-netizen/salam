/*
  دالة الاشتراك: تحفظ اشتراك إشعارات الزائر في مخزن Netlify Blobs
  عند كل زائر، ثم يستخدمه البث لاحقاً لإرسال الإشعار.
*/
const { getStore } = require("@netlify/blobs");

const TOKEN_PATTERN = /^[0-9a-f]{12}$/;
const STORE = "push-subs";
const KEY = "all";

function respond(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

async function readAll(store) {
  const item = await store.get(KEY, { type: "json" });
  return Array.isArray(item) ? item : [];
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return respond(405, { ok: false, error: "POST فقط" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return respond(400, { ok: false, error: "بيانات غير صالحة" });
  }

  const token = String(body.token || "").trim();
  const subscription = body.subscription || null;
  if (!TOKEN_PATTERN.test(token)) return respond(400, { ok: false, error: "رابط غير صالح" });
  if (!subscription || !subscription.endpoint) return respond(400, { ok: false, error: "اشتراك غير صالح" });

  const store = await getStore({ name: STORE });
  const subs = await readAll(store);

  const action = body.action === "unsubscribe" ? "unsubscribe" : "subscribe";

  if (action === "unsubscribe") {
    const next = subs.filter((s) => s.endpoint !== subscription.endpoint);
    await store.setJSON(KEY, next);
    return respond(200, { ok: true });
  }

  // اشتراك جديد — مع تجنب التكرار حسب endpoint
  const exists = subs.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) {
    subs.push({ token, endpoint: subscription.endpoint, keys: subscription.keys || null, at: Date.now() });
    await store.setJSON(KEY, subs);
  }

  return respond(200, { ok: true });
};
