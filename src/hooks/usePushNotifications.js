import { useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { base44 } from "@/api/base44Client";
import { firebaseConfig, firebaseVapidKey, isFirebaseConfigured } from "@/lib/firebase-config";
import { detectPlatform, isMobileApp } from "@/lib/platform";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

let messagingInstance = null;

/**
 * Registers the current user's browser for Firebase Cloud Messaging push
 * notifications. Call once per authenticated session (e.g. in Layout).
 * When a message arrives while the app is open, shows a sonner toast.
 */
export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return;
    // Native mobile apps receive push through Base44's SendPushNotification
    // integration (handled server-side); the WebView cannot register a web
    // FCM token, so skip the service-worker flow on mobile.
    if (isMobileApp()) return;
    if (!("serviceWorker" in navigator)) return;

    try {
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      messagingInstance = getMessaging(app);

      // Register the service worker FIRST, then get the FCM token.
      // Without an explicit registration, getToken may fail to find the
      // service worker on some browsers.
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((registration) => {
          return Notification.requestPermission().then((permission) => {
            if (permission !== "granted") return null;
            return getToken(messagingInstance, {
              vapidKey: firebaseVapidKey,
              serviceWorkerRegistration: registration,
            });
          });
        })
        .then((token) => {
          if (!token) return;
          const adminToken = localStorage.getItem("admin_session_token");
          const platform = detectPlatform();
          base44.functions
            .invoke("pushNotification", {
              adminToken,
              action: "registerToken",
              token,
              platform,
            })
            .catch((e) => console.error("Failed to register push token", e));
        })
        .catch((err) => console.error("Push setup error", err));

      // Foreground message → toast
      const unsub = onMessage(messagingInstance, (payload) => {
        const title = payload.notification?.title || "New Message";
        const body = payload.notification?.body || "";
        toast(title, {
          description: body,
          duration: 5000,
          action: payload.data?.url
            ? { label: "View", onClick: () => window.location.assign(payload.data.url) }
            : undefined,
        });
      });

      return () => unsub;
    } catch (e) {
      console.error("Push notification setup failed", e);
    }
  }, [user]);
}