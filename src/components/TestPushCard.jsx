import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeFunction } from "@/lib/invokeFunction";
import { registerPushDevice } from "@/hooks/usePushNotifications";
import { isMobileApp } from "@/lib/platform";

// Lets a user check from this exact device whether notifications arrive.
// It refreshes this device's push token first, then asks the backend to send
// one test push to this user only, and reports what happened.
export default function TestPushCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const supported = typeof window !== "undefined" && "Notification" in window;

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      const inNativeApp = isMobileApp();

      if (!inNativeApp && supported) {
        if (Notification.permission === "default") await Notification.requestPermission();
        if (Notification.permission === "denied") {
          setResult("Notifications are blocked for this site. Allow them in your browser settings, then try again.");
          return;
        }
        await registerPushDevice();
      }

      const res = await invokeFunction("sendSelfTestPush", { adminToken });
      const deviceCount = res.devices || 0;
      if (deviceCount === 0 && !res.native) {
        setResult("This device is not registered yet. Turn notifications on, then try again.");
      } else if (res.sent > 0 || res.native) {
        setResult("Test sent. If nothing appears, allow notifications for this app in your phone or browser settings.");
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