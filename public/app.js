(function () {
  "use strict";

  /* ==========================================================
     مفتاح VAPID العام (public) — آمن وضعه هنا في الصفحة.
     المفتاح الخاص Private يُحفظ سراً في متغيرات Netlify فقط.
     ========================================================== */
  var VAPID_PUBLIC_KEY =
    "BLdpNcSxU1eDre5JcgA0n6aex6ozWH76vs2CnV5b0InZkZF3Wa45D4K36ykc5Ucy-pRHL46eTD-BCtGk9gJA2zU";

  var params = new URLSearchParams(window.location.search);
  var token = (params.get("c") || "").trim();

  var enableBtn = document.getElementById("enableBtn");
  var statusEl = document.getElementById("status");

  function show(text, cls) {
    statusEl.hidden = false;
    statusEl.textContent = text;
    statusEl.className = cls || "";
  }

  // تحويل المفتاح من base64url إلى Uint8Array (ما يتطلبه المتصفح)
  function urlBase64ToUint8Array(base64) {
    var padding = "=".repeat((4 - (base64.length % 4)) % 4);
    var raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function supported() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function serverCall(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  }

  /* إرسال الاشتراك الحالي إلى الخادم ليُحفظ */
  function saveSubscription(subscription) {
    return serverCall("/.netlify/functions/subscribe", {
      action: "subscribe",
      token: token,
      subscription: subscription.toJSON(),
    });
  }

  function updateState() {
    if (!supported()) {
      enableBtn.hidden = true;
      show(
        "⚠️ متصفحك لا يدعم إشعارات الويب (Web Push). جرّب متصفح Chrome أو Edge أو Firefox على موبايلك أو حاسوبك.",
        "err"
      );
      return;
    }
    if (!/^[0-9a-f]{12}$/.test(token)) {
      enableBtn.hidden = true;
      show(
        "⚠️ رابط غير صالح. اطلب رابطاً جديداً من صاحب الصفحة.",
        "err"
      );
      return;
    }
    if (Notification.permission === "granted") {
      enableBtn.hidden = true;
      show(
        "✅ أنت مشترك بالفعل في الإشعارات.\n\nستصلك أي رسالة يرسلها صاحب الصفحة هنا على موبايلك.",
        "ok"
      );
      return;
    }
    if (Notification.permission === "denied") {
      enableBtn.hidden = true;
      show(
        "🚫 حظرت الإشعارات لهذا الموقع سابقاً.\nافتح إعدادات الموقع في متصفحك (أيقونة القفل بجانب الرابط) وفعّل «الإشعارات» ثم أعد فتح الصفحة.",
        "warn"
      );
      return;
    }
    enableBtn.hidden = false;
  }

  enableBtn.addEventListener("click", async function () {
    enableBtn.disabled = true;
    try {
      var permission = await Notification.requestPermission();
      if (permission !== "granted") {
        updateState();
        return;
      }
      show("⏳ جارٍ تفعيل الإشعارات...", "ok");

      var reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      var subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      var data = await saveSubscription(subscription);
      if (data && data.ok) {
        updateState();
      } else {
        show("😔 تعذّر حفظ الاشتراك في الخادم، حاول مجدداً بعد قليل.", "err");
        enableBtn.hidden = false;
      }
    } catch (err) {
      console.error(err);
      show("😔 حدث خطأ أثناء التفعيل. تأكد من اتصالك وحاول مجدداً.", "err");
      enableBtn.hidden = false;
    } finally {
      enableBtn.disabled = false;
    }
  });

  updateState();
})();
