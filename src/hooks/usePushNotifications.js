import { useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { base44 } from "@/api/base44Client";
import { firebaseConfig, firebaseVapidKey, isFirebaseConfigured } from "@/lib/firebase-config";
import { detectPlatform } from "@/lib/platform";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

let messagingInstance = null;

/**
 * Registers the current user's device for Firebase Cloud Messaging push
 * notifications. Call once per authenticated session (e.g. in Layout).
 *
 * Key points:
 * - The FCM token is fetched WITHOUT requiring notification permission to be
 *   "granted". Permission is only needed to DISPLAY notifications, not to
 *   receive push. Gating getToken() on permission meant users who hadn't
 *   tapped "Allow" never got a token, so no DeviceToken was stored.
 * - Works on browsers AND native app WebViews that support service workers.
 *   If the WebView lacks service-worker support, the check below skips
 *   gracefully; the server-side SendPushNotification integration still
 *   reaches the native app.
 */
export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const registerToken = async () => {
      try {
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        messagingInstance = getMessaging(app);

        // Register the service worker FIRST so getToken can find it.
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        // Get the FCM token WITHOUT gating on notification permission.
        // Firebase can issue a token even before the user grants display
        // permission — push delivery works; only the visible notification
        // requires the grant.
        let token = null;
        try {
          token = await getToken(messagingInstance, {
            vapidKey: firebaseVapidKey,
            serviceWorkerRegistration: registration,
          });
        } catch (e) {
          console.error("FCM getToken failed", e);
        }

        // If no token yet, request permission then retry — some browsers
        // only issue a token after the user has interacted with the
        // permission prompt.
        if (!token && "Notification" in window) {
          try {
            const perm = await Notification.requestPermission();
            if (perm === "granted") {
              token = await getToken(messagingInstance, {
                vapidKey: firebaseVapidKey,
                serviceWorkerRegistration: registration,
              });
            }
          } catch (e) {
            console.error("Permission/token retry failed", e);
          }
        }

        if (cancelled || !token) return;

        const adminToken = localStorage.getItem("admin_session_token");
        const platform = detectPlatform();
        await base44.functions.invoke("pushNotification", {
          adminToken,
          action: "registerToken",
          token,
          platform,
        });
      } catch (e) {
        console.error("Push token registration failed", e);
      }
    };

    registerToken();

    // Foreground message → toast
    try {
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      messagingInstance = getMessaging(app);
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
      return () => { cancelled = true; unsub(); };
    } catch (e) {
      console.error("Push onMessage setup failed", e);
    }

    return () => { cancelled = true; };
  }, [user]);
}