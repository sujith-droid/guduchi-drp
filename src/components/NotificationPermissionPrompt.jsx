import { useEffect, useState } from "react";
import { Bell, X, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestNotificationPermission } from "@/hooks/usePushNotifications";
import { isMobileApp } from "@/lib/platform";
import { useAuth } from "@/lib/AuthContext";

const DISMISS_KEY = "notif_prompt_dismissed";

/**
 * Banner that prompts the user to enable notifications. The Enable button
 * triggers the permission request from a user gesture (required by Android
 * Chrome / recent browsers, which silently block gestureless requests).
 * Shown only on web (not native mobile app) when permission is "default" and
 * the user hasn't dismissed it.
 */
export default function NotificationPermissionPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || isMobileApp()) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setVisible(true);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    const ok = await requestNotificationPermission();
    setLoading(false);
    setVisible(false);
    if (!ok) localStorage.setItem(DISMISS_KEY, "1");
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  if (!visible) return null;

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
      <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-2">
        <BellRing className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Enable notifications</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Get daily log reminders and alerts from your health coach.
        </p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" onClick={handleEnable} disabled={loading} className="h-9 gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            {loading ? "Enabling..." : "Enable"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-9">
            Not now
          </Button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification prompt"
        className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-muted-foreground hover:bg-accent"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}