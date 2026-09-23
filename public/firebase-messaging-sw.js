// Firebase Messaging Service Worker for background push notifications.
// Fill in the firebaseConfig below with your project values (same as src/lib/firebase-config.js).
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCqYbGxLZFU61uDL8C8MjB_xRCYpdr2mqA",
  authDomain: "guduchi-ayurveda-drp.firebaseapp.com",
  projectId: "guduchi-ayurveda-drp",
  storageBucket: "guduchi-ayurveda-drp.firebasestorage.app",
  messagingSenderId: "511099665271",
  appId: "1:511099665271:web:6dd1bb6fa570c88e9f7f72",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New Message";
  const body = payload.notification?.body || "";
  self.registration.showNotification(title, {
    body,
    icon: "/icon.png",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/chat";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        const client = clientList[0];
        client.focus();
        client.navigate(targetUrl);
      } else {
        clients.openWindow(targetUrl);
      }
    })
  );
});
