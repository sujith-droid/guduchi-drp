import { useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { base44 } from "@/api/base44Client";
import { firebaseConfig, firebaseVapidKey, isFirebaseConfigured } from "@/lib/firebase-config";
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

    try {
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      messagingInstance = getMessaging(app);

      // Request permission + get FCM token
      Notification.requestPermission().then((permission) => {
        if (permission !== "granted") return;
        getToken(messagingInstance, { vapidKey: firebaseVapidKey })
          .then((token) => {
            if (!token) return;
            const adminToken = localStorage.getItem("admin_session_token");
            base44.functions
              .invoke("pushNotification", {
                adminToken,
                action: "registerToken",
                token,
                platform: "web",
              })
              .catch((e) => console.error("Failed to register push token", e));
          })
          .catch((err) => console.error("FCM token error", err));
      });

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