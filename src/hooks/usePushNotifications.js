import { useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { base44 } from "@/api/base44Client";
import { firebaseConfig, firebaseVapidKey, isFirebaseConfigured } from "@/lib/firebase-config";
import { detectPlatform, isMobileApp } from "@/lib/platform";
import { useAuth } from "@/lib/AuthContext";

let messagingInstance = null;

/**
 * Registers the current user's device for Firebase Cloud Messaging push
 * notifications. Uses the standard Firebase pattern:
 *   1. Register the service worker
 *   2. Request notification permission (required by some browsers before a
 *      push subscription/token can be created)
 *   3. Get the FCM token
 *   4. Store it via the pushNotification backend function
 */
export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return;
    // Inside the native mobile app WebView, web FCM cannot run (no service
    // worker, no permission popup). The native Base44 mobile build registers
    // the device token itself via the platform's native push integration.
    if (isMobileApp()) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const registerToken = async () => {
      try {
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        messagingInstance = getMessaging(app);

        // 1. Register the service worker.
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );
        // Wait for the SW to be fully active.
        await navigator.serviceWorker.ready;

        // 2. Request notification permission. Some browsers (Edge, Safari,
        // Chrome-on-iOS) will NOT issue an FCM token until the user has
        // granted display permission. If already granted or denied, this
        // resolves immediately without a prompt.
        if ("Notification" in window && Notification.permission === "default") {
          try {
            await Notification.requestPermission();
          } catch (e) {
            console.error("Notification permission request failed", e);
          }
        }

        // 3. Get the FCM token.
        let token = null;
        try {
          token = await getToken(messagingInstance, {
            vapidKey: firebaseVapidKey,
            serviceWorkerRegistration: registration,
          });
        } catch (e) {
          console.error("FCM getToken failed", e);
        }

        if (cancelled || !token) {
          console.warn("Push: no FCM token obtained");
          return;
        }

        // 4. Store the token server-side.
        const adminToken = localStorage.getItem("admin_session_token");
        const platform = detectPlatform();
        try {
          const res = await base44.functions.invoke("pushNotification", {
            adminToken,
            action: "registerToken",
            token,
            platform,
          });
          console.log("Push token registered:", platform, res?.data || res);
        } catch (e) {
          console.error("Push token storage failed:", e);
        }
      } catch (e) {
        console.error("Push registration failed", e);
      }
    };

    registerToken();

    // Foreground message handler
    try {
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      messagingInstance = getMessaging(app);
      const unsub = onMessage(messagingInstance, (payload) => {
        console.log("FCM foreground message:", payload);
      });
      return () => { cancelled = true; unsub(); };
    } catch (e) {
      console.error("Push onMessage setup failed", e);
    }

    return () => { cancelled = true; };
  }, [user]);
}