// Firebase Cloud Messaging service worker.
// Handles background push notifications when the web app is not in focus.
// MUST be served from the root scope ("/") so FCM can find it.
//
// Give the service worker access to Firebase Messaging (compat builds,
// since service workers can't use ES module imports for Firebase).
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// Initialize Firebase with the web app config.
firebase.initializeApp({
  apiKey: "AIzaSyCqYbGxLZFU61uDL8C8MjB_xRCYpdr2mqA",
  authDomain: "guduchi-ayurveda-drp.firebaseapp.com",
  projectId: "guduchi-ayurveda-drp",
  storageBucket: "guduchi-ayurveda-drp.firebasestorage.app",
  messagingSenderId: "511099665271",
  appId: "1:511099665271:web:6dd1bb6fa570c88e9f7f72",
  measurementId: "G-3JLF7QJWK2",
});

const messaging = firebase.messaging();

// Show a notification when a push arrives while the app is in the background.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Guduchi DRP";
  const body = payload.notification?.body || "";
  const url = payload.data?.url || "/chat";

  self.registration.showNotification(title, {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: payload.data?.tag || "guduchi-message",
    data: { url },
  });
});

// Handle notification click — open the app and navigate to the target URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if one is open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Activate the service worker immediately on install.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
