// Firebase Cloud Messaging service worker for background push notifications.
// Runs in the browser's background even when the app tab is closed.
// Uses Firebase compat builds loaded from the gstatic CDN because service
// workers cannot use the app's ES module bundler.

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCqYbGxLZFU61uDL8C8MjB_xRCYpdr2mqA",
  authDomain: "guduchi-ayurveda-drp.firebaseapp.com",
  projectId: "guduchi-ayurveda-drp",
  storageBucket: "guduchi-ayurveda-drp.firebasestorage.app",
  messagingSenderId: "511099665271",
  appId: "1:511099665271:web:6dd1bb6fa570c88e9f7f72",
  measurementId: "G-3JLF7QJWK2"
});

const messaging = firebase.messaging();

// Show a notification when a push arrives in the background.
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const url = payload.data?.url || "/";

  const notificationTitle = title || "Guduchi DRP";
  const notificationOptions = {
    body: body || "",
    icon: icon || "https://base44.com/logo_v2.svg",
    badge: "https://base44.com/logo_v2.svg",
    data: { url },
    tag: "guduchi-notification",
    renotify: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open/focus the app and navigate to the URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
