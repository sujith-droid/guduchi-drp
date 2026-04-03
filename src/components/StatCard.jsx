import { motion } from "framer-motion";

export default function StatCard({ icon: Icon, label, value, unit, trend, color = "text-primary" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4 flex items-center gap-4"
    >
      <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold font-heading">{value ?? "—"}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>
      {trend && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          trend > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
        }`}>
          {trend > 0 ? "+" : ""}{trend}%
        </span>
      )}
    </motion.div>
  );
}