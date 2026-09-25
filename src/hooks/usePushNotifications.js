import { useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { base44 } from "@/api/base44Client";
import { firebaseConfig, firebaseVapidKey, isFirebaseConfigured } from "@/lib/firebase-config";
import { detectPlatform, isMobileApp } from "@/lib/platform";
import { useAuth } from "@/lib/AuthContext";

let messagingInstance = null;

function getMessagingInstance() {
  if (!isFirebaseConfigured()) return null;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Fetches the FCM token (only if notification permission is already granted)
 * and stores it server-side. Safe to call repeatedly.
 */
export async function registerPushToken() {
  if (!isFirebaseConfigured() || isMobileApp()) return false;
  if (!("serviceWorker" in navigator)) return false;
  if ("Notification" in window && Notification.permission !== "granted") return false;

  try {
    const messaging = getMessagingInstance();
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      console.warn("Push: no FCM token obtained");
      return false;
    }

    const adminToken = localStorage.getItem("admin_session_token");
    const platform = detectPlatform();
    await base44.functions.invoke("pushNotification", {
      adminToken,
      action: "registerToken",
      token,
      platform,
    });
    console.log("Push token registered:", platform);
    return true;
  } catch (e) {
    console.error("Push registration failed", e);
    return false;
  }
}

/**
 * Requests notification permission (MUST be called from a user gesture on
 * Android Chrome / recent browsers, otherwise the prompt is silently
 * blocked). On grant, registers the push token.
 */
export async function requestNotificationPermission() {
  if (!isFirebaseConfigured() || isMobileApp()) return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    return await registerPushToken();
  }
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      return await registerPushToken();
    }
    return false;
  } catch (e) {
    console.error("Notification permission request failed", e);
    return false;
  }
}

/**
 * Hook: auto-registers the push token when permission is already granted,
 * and sets up the foreground message handler. Does NOT auto-request
 * permission (Android Chrome blocks gestureless requests); the
 * NotificationPermissionPrompt component triggers that from a tap.
 */
export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isFirebaseConfigured() || isMobileApp()) return;
    if (!("serviceWorker" in navigator)) return;

    // Only auto-register if the user already granted permission previously.
    if ("Notification" in window && Notification.permission === "granted") {
      registerPushToken();
    }

    // Foreground message handler
    try {
      const messaging = getMessagingInstance();
      const unsub = onMessage(messaging, (payload) => {
        console.log("FCM foreground message:", payload);
      });
      return () => unsub();
    } catch (e) {
      console.error("Push onMessage setup failed", e);
    }
  }, [user]);
}