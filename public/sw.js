/* Service Worker — مسؤول عن استقبال الإشعارات وعرضها حتى لو كان الموقع مغلقاً */
self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* تجاهل */ }

  var title = data.title || "🔔 رسالة جديدة";
  var options = {
    body: data.body || "",
    dir: "rtl",
    lang: "ar",
    tag: "push-" + Date.now(),
    renotify: true,
    data: { url: data.url || "/" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
