import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerPushDevice } from "@/hooks/usePushNotifications";
import useBrowserPushState from "@/hooks/useBrowserPushState";
import { pushRegistrationMessage } from "@/lib/push-permission";

// Prompt shown on the Alerts page when this browser has not granted
// notification permission. Browsers only honour a permission request that
// follows a real tap, so the user has to press this button.
export default function EnableNotificationsCard() {
  const { state: permission, refresh } = useBrowserPushState();
  const [busy, setBusy] = useState(false);

  if (!["default", "denied"].includes(permission)) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const registered = await registerPushDevice({ requestPermission: true });
      if (registered.ok) toast.success("Notifications are on for this device.");
      else toast.error(pushRegistrationMessage(registered.reason));
    } catch {
      toast.error("Could not turn on notifications.");
    } finally {
      refresh();
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
      <BellRing className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {permission === "denied" ? "Website notification permission" : "Turn on notifications"}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {pushRegistrationMessage(permission)}
        </p>
      </div>
      <Button size="sm" onClick={enable} disabled={busy} className="shrink-0">
        {busy ? "Checking..." : permission === "denied" ? "Recheck" : "Turn on"}
      </Button>
    </div>
  );
}