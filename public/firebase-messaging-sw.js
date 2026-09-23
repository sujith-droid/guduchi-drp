// Firebase Cloud Messaging Service Worker
// Handles background push notifications for the web app.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCqYbGxLZFU61uDL8C8MjB_xRCYpdr2mqA",
  authDomain: "guduchi-ayurveda-drp.firebaseapp.com",
  projectId: "guduchi-ayurveda-drp",
  storageBucket: "guduchi-ayurveda-drp.firebasestorage.app",
  messagingSenderId: "511099665271",
  appId: "1:511099665271:web:6dd1bb6fa570c88e9f7f72",
});

const messaging = firebase.messaging();

// Background message handler — shows a notification when a push arrives
// and the app is not in the foreground.
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "Guduchi DRP";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icon.png",
    data: payload.data || {},
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler — focus existing tab or open new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/chat';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
