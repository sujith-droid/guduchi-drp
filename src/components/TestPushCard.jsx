import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeFunction } from "@/lib/invokeFunction";
import { registerPushDevice } from "@/hooks/usePushNotifications";
import { isMobileApp, detectPlatform } from "@/lib/platform";

// Explains, in plain words, why this device could not be registered for push.
function reasonText(reg) {
  switch (reg.reason) {
    case "permission_default":
      return "Notifications are not turned on for this site yet. Tap “Turn on” above, then test again.";
    case "permission_denied":
      return "Notifications are blocked for this site. In Chrome, tap the lock icon in the address bar, open Site settings and allow Notifications.";
    case "token":
      return "Chrome did not give this device a push token. Check that notifications are allowed for this site and that you are online, then try again.";
    case "store":
      return "This device could not be saved for notifications. Check your connection and try again.";
    case "service_worker":
      return "This browser blocked the notification service. Close other tabs of the app and try again.";
    case "unsupported":
      return "This browser cannot show push notifications for the app.";
    case "native_app":
      return "This check is only for browsers. Open the app in Chrome to test browser alerts.";
    default:
      return "Notifications are not set up for this device yet.";
  }
}

// Lets a user check from this exact device whether notifications arrive.
// It registers this device first, reports exactly what blocked it if that
// fails, then asks the backend to send one test push to this user only.
export default function TestPushCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const supported = typeof window !== "undefined" && "Notification" in window;

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      if (!isMobileApp() && supported) {
        if (Notification.permission === "default") await Notification.requestPermission();
        const reg = await registerPushDevice();
        if (!reg.ok) {
          setResult(reasonText(reg));
          return;
        }
      }

      const res = await invokeFunction("sendSelfTestPush", {
        adminToken: localStorage.getItem("admin_session_token"),
      });
      const deviceCount = res.devices || 0;
      if (deviceCount === 0 && !res.native) {
        setResult("This device is not registered yet. Turn notifications on, then try again.");
      } else if (res.sent > 0) {
        setResult(`Test sent to ${res.sent} registered device${res.sent === 1 ? "" : "s"} (${detectPlatform()}). If nothing appears, check that notifications are allowed for this app in your browser and phone settings.`);
      } else {
        setResult("The notification could not be delivered to this device.");
      }
    } catch (e) {
      setResult(e.message || "Could not send the test notification.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <Send className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Check this device</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {result || "Send yourself a test notification to confirm alerts reach this device."}
        </p>
      </div>
      <Button size="sm" onClick={run} disabled={busy} className="shrink-0">
        {busy ? "Sending..." : "Test"}
      </Button>
    </div>
  );
}