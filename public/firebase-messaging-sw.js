// Firebase Cloud Messaging background service worker.
// Handles push notifications when the web app is closed/in background.
// Uses Firebase compat SDK via importScripts (service workers cannot use
// bundler imports), matching the firebase-app/messaging v10 used client-side.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCqYbGxLZFU61uDL8C8MjB_xRCYpdr2mqA",
  authDomain: "guduchi-ayurveda-drp.firebaseapp.com",
  projectId: "guduchi-ayurveda-drp",
  storageBucket: "guduchi-ayurveda-drp.firebasestorage.app",
  messagingSenderId: "511099665271",
  appId: "1:511099665271:web:6dd1bb6fa570c88e9f7f72",
  measurementId: "G-3JLF7QJWK2"
});

const APP_ICON = "https://media.base44.com/images/public/6a112438497edb3c33861acd/2d4862fc4_generated_image.png";

const messaging = firebase.messaging();

// Background message handler — shows a notification when a push arrives
// while no client page is in the foreground.
messaging.onBackgroundMessage((payload) => {
  const notif = payload.notification || {};
  const data = payload.data || {};
  const title = notif.title || "Guduchi DRP";
  const body = notif.body || "";
  const url = data.url || "/chat";
  return self.registration.showNotification(title, {
    body,
    icon: APP_ICON,
    badge: APP_ICON,
    tag: data.tag || "guduchi-message",
    data: { url, ...data },
    requireInteraction: false,
  });
});

// Also handle raw push events (some browsers don't trigger
// onBackgroundMessage when a notification payload is present).
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    return;
  }
  const notif = payload.notification || {};
  const data = payload.data || {};
  const title = notif.title || "Guduchi DRP";
  const body = notif.body || "";
  const url = data.url || "/chat";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: APP_ICON,
      badge: APP_ICON,
      tag: data.tag || "guduchi-message",
      data: { url, ...data },
      requireInteraction: false,
    })
  );
});

// Notification click — focus an existing tab and navigate to the target URL,
// or open a new window if none exists.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/chat";
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          return client.navigate(fullUrl).then(() => client.focus());
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});
