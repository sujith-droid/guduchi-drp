import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check, AlertTriangle, Award, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../components/PullToRefreshIndicator";
import moment from "moment-timezone";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

const typeIcons = {
  reminder: Bell,
  alert: AlertTriangle,
  achievement: Award,
  info: Info,
};

const typeColors = {
  reminder: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  alert: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700",
  achievement: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
  info: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600",
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const adminToken = localStorage.getItem("admin_session_token");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleRefresh = useCallback(async () => { await loadData(); }, []);
  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh(handleRefresh);

  const loadData = async () => {
    try {
      const res = await base44.functions.invoke("notificationsApi", { adminToken, action: "list" });
      const data = res.data || res;
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error("Failed to load notifications", e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notif) => {
    if (notif.is_read) return;
    try { await base44.functions.invoke("notificationsApi", { adminToken, action: "markRead", id: notif.id }); } catch {}
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    try {
      await base44.functions.invoke("notificationsApi", { adminToken, action: "markAllRead", ids: unread.map((n) => n.id) });
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div ref={containerRef} className="space-y-4 pb-20 md:pb-6 overflow-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="flex items-center justify-between">
        <div className="md:text-left">
          <h1 className="text-2xl font-heading font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1 h-11">
            <Check className="h-3 w-3" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif, i) => {
            const Icon = typeIcons[notif.type] || Bell;
            const colorClass = typeColors[notif.type] || typeColors.info;
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => markAsRead(notif)}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  notif.is_read ? "bg-card border-border opacity-60" : `${colorClass}`
                }`}
              >
                <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{notif.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {moment.utc(notif.created_date).fromNow()}
                  </p>
                </div>
                {!notif.is_read && (
                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}