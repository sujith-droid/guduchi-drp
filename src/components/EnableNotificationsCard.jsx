import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerPushDevice } from "@/hooks/usePushNotifications";
import { isMobileApp } from "@/lib/platform";

// Prompt shown on the Alerts page when this browser has not granted
// notification permission. Browsers only honour a permission request that
// follows a real tap, so the user has to press this button.
export default function EnableNotificationsCard() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState(supported ? Notification.permission : "unsupported");
  const [busy, setBusy] = useState(false);

  if (!supported || isMobileApp() || permission === "granted") return null;

  const enable = async () => {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        const registered = await registerPushDevice();
        if (registered) toast.success("Notifications are on for this device.");
        else toast.error("Permission granted, but this device could not be registered. Please try again.");
      } else {
        toast.error("Notifications are blocked. Allow them for this site in your browser settings.");
      }
    } catch {
      toast.error("Could not turn on notifications.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
      <BellRing className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {permission === "denied" ? "Notifications are blocked" : "Turn on notifications"}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {permission === "denied"
            ? "Allow notifications for this site in your browser settings to get alerts on this device."
            : "Get an alert on this device when a new message or reminder arrives."}
        </p>
      </div>
      {permission !== "denied" && (
        <Button size="sm" onClick={enable} disabled={busy} className="shrink-0">
          {busy ? "Turning on..." : "Turn on"}
        </Button>
      )}
    </div>
  );
}