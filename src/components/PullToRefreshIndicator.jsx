import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

/**
 * Visual indicator for pull-to-refresh.
 * Place this at the very top of the scrollable container.
 */
export default function PullToRefreshIndicator({ pullDistance, isRefreshing, threshold = 72 }) {
  const visible = pullDistance > 0 || isRefreshing;
  const progress = Math.min(pullDistance / threshold, 1);
  const ready = progress >= 1;

  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center pointer-events-none overflow-hidden transition-all"
      style={{ height: isRefreshing ? 48 : pullDistance }}
    >
      <motion.div
        animate={{ rotate: isRefreshing ? 360 : progress * 180 }}
        transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
        className={`h-8 w-8 rounded-full flex items-center justify-center shadow-md transition-colors ${
          ready || isRefreshing
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border text-muted-foreground"
        }`}
        style={{ opacity: Math.max(progress, isRefreshing ? 1 : 0) }}
      >
        <RefreshCw className="h-4 w-4" />
      </motion.div>
    </div>
  );
}