import { isMobileApp } from "@/lib/platform";

export const browserPushUrl = "https://guduchi-drp-hub.base44.app/notifications";

// Permission in an embedded preview is not the standalone site's permission.
export function getBrowserPushState() {
  if (typeof window === "undefined") return "unsupported";
  if (isMobileApp()) return "native_app";
  if (window.self !== window.top) return "embedded";
  if (!window.isSecureContext) return "insecure";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission;
}

// Called only from a real button press, never automatically on page load.
export async function requestBrowserPushPermission() {
  const state = getBrowserPushState();
  if (state === "default") return Notification.requestPermission();
  return state;
}

export function pushRegistrationMessage(reason) {
  switch (reason) {
    case "embedded":
      return "Notifications cannot be requested inside this embedded preview. Open the live app in its own browser tab to enable and check alerts.";
    case "insecure":
      return "Browser notifications require a secure page. Open the live app using the button below.";
    case "default":
    case "permission_default":
      return `Notifications are not enabled for ${window.location.hostname} yet. Tap Turn on or Test to request access.`;
    case "denied":
    case "permission_denied":
      return `This browser reports notification access as Blocked for ${window.location.hostname}. The website permission is separate from your phone or computer's notification setting. Check this exact address, then return here to refresh the status.`;
    case "token":
      return "Notifications are allowed, but the browser could not create a push subscription. No test was sent.";
    case "store":
      return "Notifications are allowed, but this device registration could not be saved. No test was sent.";
    case "service_worker":
      return "The browser could not start the background notification service. This is different from a blocked notification permission.";
    case "unsupported":
      return "This browser does not support the features needed for browser push notifications.";
    case "native_app":
      return "This check uses the installed app's notification service, not browser permissions.";
    case "not_configured":
      return "Browser push notification setup is incomplete.";
    default:
      return "Notifications are not set up for this device yet.";
  }
}