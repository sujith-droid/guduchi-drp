import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeFunction } from "@/lib/invokeFunction";
import { registerPushDevice } from "@/hooks/usePushNotifications";
import { isMobileApp, detectPlatform } from "@/lib/platform";

import useBrowserPushState from "@/hooks/useBrowserPushState";
import { browserPushUrl, getBrowserPushState, pushRegistrationMessage } from "@/lib/push-permission";

// Lets a user check from this exact device whether notifications arrive.
// It registers this device first, reports exactly what blocked it if that
// fails, then asks the backend to send one test push to this user only.
export default function TestPushCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { state, refresh } = useBrowserPushState();
  const needsStandalone = state === "embedded" || state === "insecure";
  const report = (message) => setResult({ message, state: getBrowserPushState() });

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      if (!isMobileApp()) {
        const reg = await registerPushDevice({ requestPermission: true });
        if (!reg.ok) {
          report(pushRegistrationMessage(reg.reason));
          return;
        }
      }

      const res = await invokeFunction("sendSelfTestPush", {
        adminToken: localStorage.getItem("admin_session_token"),
      });
      const deviceCount = res.devices || 0;
      if (deviceCount === 0 && !res.native) {
        report("This device is not registered yet. Turn notifications on, then try again.");
      } else if (res.sent > 0) {
        report(`The notification service accepted the test for ${res.sent} registered device${res.sent === 1 ? "" : "s"} (${detectPlatform()}). Acceptance does not confirm it appeared on screen.`);
      } else {
        report("The notification could not be delivered to this device.");
      }
    } catch (e) {
      report(e.message || "Could not send the test notification.");
    } finally {
      refresh();
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <Send className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Check this device</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {needsStandalone ? pushRegistrationMessage(state) : result?.state === state ? result.message : "Send yourself a test notification to confirm alerts reach this device."}
        </p>
      </div>
      {needsStandalone ? (
        <Button size="sm" asChild className="shrink-0">
          <a href={browserPushUrl} target="_blank" rel="noopener noreferrer">Open live app</a>
        </Button>
      ) : (
        <Button size="sm" onClick={run} disabled={busy} className="shrink-0">
          {busy ? "Sending..." : "Test"}
        </Button>
      )}
    </div>
  );
}