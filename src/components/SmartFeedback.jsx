import { motion } from "framer-motion";
import { Flame, TrendingDown, Award } from "lucide-react";

const feedbackItems = [
  {
    condition: (log, prevLog) => log?.step_count >= 10000,
    icon: Flame,
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
    message: "🔥 Amazing! You hit 10K steps today. Your body is healing.",
  },
  {
    condition: (log, prevLog) => {
      if (!prevLog || !log) return false;
      const curr = (log.fasting_sugar || 999) + (log.post_breakfast_sugar || 999) + (log.post_dinner_sugar || 999);
      const prev = (prevLog.fasting_sugar || 999) + (prevLog.post_breakfast_sugar || 999) + (prevLog.post_dinner_sugar || 999);
      return curr < prev && curr < 2900;
    },
    icon: TrendingDown,
    color: "text-primary",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    message: "📉 Great progress! Your sugar levels are dropping. Keep going.",
  },
];

export default function SmartFeedback({ currentLog, previousLog, hba1cImproved }) {
  const activeFeedback = feedbackItems.filter((item) =>
    item.condition(currentLog, previousLog)
  );

  if (hba1cImproved) {
    activeFeedback.push({
      icon: Award,
      color: "text-purple-500",
      bg: "bg-purple-50",
      border: "border-purple-200",
      message: "🌟 Big win! Your HbA1c has improved — you're reversing diabetes.",
    });
  }

  if (activeFeedback.length === 0) return null;

  return (
    <div className="space-y-3">
      {activeFeedback.map((fb, i) => {
        const Icon = fb.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className={`flex items-start gap-3 p-4 rounded-xl border ${fb.bg} ${fb.border}`}
          >
            <Icon className={`h-5 w-5 mt-0.5 ${fb.color} flex-shrink-0`} />
            <p className="text-sm font-medium text-foreground">{fb.message}</p>
          </motion.div>
        );
      })}
    </div>
  );
}