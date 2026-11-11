import { useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { invokeFunction } from "@/lib/invokeFunction";
import { firebaseConfig, firebaseVapidKey, isFirebaseConfigured } from "@/lib/firebase-config";
import { detectPlatform } from "@/lib/platform";
import { useAuth } from "@/lib/AuthContext";
import { getBrowserPushState, requestBrowserPushPermission } from "@/lib/push-permission";
import useBrowserPushState from "@/hooks/useBrowserPushState";

let messagingInstance = null;

function getMessagingApp() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Registers this browser for push notifications and stores the FCM token.
 * The service worker and permission request are done here so the same flow
 * works from the automatic hook and from the "Turn on notifications" button.
 */
export async function registerPushDevice({ requestPermission = false } = {}) {
  const state = requestPermission ? await requestBrowserPushPermission() : getBrowserPushState();
  if (state !== "granted") {
    const reason = ["default", "denied"].includes(state) ? `permission_${state}` : state;
    return { ok: false, reason };
  }
  if (!isFirebaseConfigured()) return { ok: false, reason: "not_configured" };

  let registration = null;
  try {
    registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  } catch (e) {
    console.error("Service worker registration failed", e);
    return { ok: false, reason: "service_worker" };
  }

  const token = await getToken(getMessagingApp(), {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration: registration,
  }).catch((e) => {
    console.error("FCM getToken failed", e);
    return null;
  });
  if (!token) return { ok: false, reason: "token" };

  try {
    await invokeFunction("pushNotification", {
      adminToken: localStorage.getItem("admin_session_token"),
      action: "registerToken",
      token,
      platform: detectPlatform(),
    });
    return { ok: true, reason: null };
  } catch (e) {
    console.error("Push token storage failed:", e);
    return { ok: false, reason: "store" };
  }
}

/**
 * Shows an OS notification for a push that arrives while the app tab is
 * focused. FCM only displays notifications automatically when the page is
 * in the background, so without this a user watching the app sees nothing.
 */
async function showForegroundNotification(payload) {
  const title = payload.notification?.title || payload.data?.title || "Guduchi DRP";
  const body = payload.notification?.body || payload.data?.body || "";
  if (!title) return;
  const options = {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: payload.data?.tag || "guduchi-message",
    data: { url: payload.data?.url || "/" },
  };
  try {
    const registration = await navigator.serviceWorker.getRegistration("/") ||
      await navigator.serviceWorker.getRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
    } else if (Notification.permission === "granted") {
      new Notification(title, options);
    }
  } catch (e) {
    console.error("Foreground notification display failed", e);
  }
}

/**
 * Registers the current user's device for Firebase Cloud Messaging push
 * notifications, and displays pushes that arrive while the app is focused.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const { state } = useBrowserPushState();

  useEffect(() => {
    if (!user || !isFirebaseConfigured() || state !== "granted") return;
    // Register an existing grant silently; only buttons request permission.
    registerPushDevice().catch((e) => console.error("Push registration failed", e));

    let unsub = null;
    try {
      unsub = onMessage(getMessagingApp(), showForegroundNotification);
    } catch (e) {
      console.error("Push onMessage setup failed", e);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [user, state]);
}