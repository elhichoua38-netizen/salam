/*
  دالة البث: يرسل إليها بوت التلغرام (بالسر المشترك) الرسالة،
  فترسلها إشعاراً لكل الأجهزة المشتركة بالصفحة.
*/
const webpush = require("web-push");
const { getStore } = require("@netlify/blobs");

const STORE = "push-subs";
const KEY = "all";
const MAX_MESSAGE = 2000;

function respond(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return respond(405, { ok: false, error: "POST فقط" });

  // حماية: البث يُقبل فقط من البوت (بشرط السر المشترك)
  const secret = event.headers["x-broadcast-secret"];
  if (!secret || secret !== process.env.BROADCAST_SECRET) {
    return respond(403, { ok: false, error: "غير مصرح" });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    return respond(500, { ok: false, error: "مفاتيح VAPID غير مضبوطة" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return respond(400, { ok: false, error: "بيانات غير صالحة" });
  }

  const message = String(body.message || "").trim().slice(0, MAX_MESSAGE);
  if (!message) return respond(400, { ok: false, error: "رسالة فارغة" });

  const store = await getStore({ name: STORE });
  const item = await store.get(KEY, { type: "json" });
  const subs = Array.isArray(item) ? item : [];

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    title: "📢 رسالة جديدة",
    body: message,
    url: "/",
  });

  let sent = 0;
  let failed = 0;
  const removedEndpoints = [];

  await Promise.all(
    subs.map(async (sub) => {
      if (!sub || !sub.endpoint) return;
      const pushSub = {
        endpoint: sub.endpoint,
        keys: sub.keys || {},
      };
      try {
        await webpush.sendNotification(pushSub, payload, { TTL: 3600 });
        sent++;
      } catch (err) {
        failed++;
        // 404 / 410 = الجهاز لم يعد مسجلاً → نحذفه من القائمة
        if (err.statusCode === 404 || err.statusCode === 410) {
          removedEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (removedEndpoints.length > 0) {
    const remaining = subs.filter((s) => !removedEndpoints.includes(s.endpoint));
    await store.setJSON(KEY, remaining);
  }

  return respond(200, { ok: true, sent, failed, removed: removedEndpoints.length });
};
