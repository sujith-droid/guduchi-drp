import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check, AlertTriangle, Award, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import moment from "moment";
import { motion } from "framer-motion";

const typeIcons = {
  reminder: Bell,
  alert: AlertTriangle,
  achievement: Award,
  info: Info,
};

const typeColors = {
  reminder: "bg-blue-50 text-blue-600 border-blue-200",
  alert: "bg-red-50 text-red-600 border-red-200",
  achievement: "bg-emerald-50 text-emerald-600 border-emerald-200",
  info: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function Notifications() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const me = await base44.auth.me();
    setUser(me);
    const notifs = await base44.entities.Notification.filter(
      { user_email: me.email },
      "-created_date",
      50
    );
    setNotifications(notifs);
    setLoading(false);
  };

  const markAsRead = async (notif) => {
    if (notif.is_read) return;
    await base44.entities.Notification.update(notif.id, { is_read: true });
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    for (const n of unread) {
      await base44.entities.Notification.update(n.id, { is_read: true });
    }
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
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1">
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
                    {moment(notif.created_date).fromNow()}
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