import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Users } from "lucide-react";
import moment from "moment";

/**
 * Self-contained patient status summary cards.
 * Fetches assignments + recent logs via doctorApi and computes
 * per-patient status counts (Improving, Stable, Needs Attention,
 * Inactive, No Data).
 */
export default function PatientStatusCards() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const adminToken = localStorage.getItem("admin_session_token");
        const res = await base44.functions.invoke("doctorApi", { adminToken, action: "getData" });
        const data = res.data || res;
        const assignments = data.assignments || [];
        const recentLogs = data.recentLogs || [];

        const sevenDaysAgo = moment().subtract(7, "days").format("YYYY-MM-DD");
        const patientEmails = new Set(assignments.map((a) => a.patient_email));
        const logsMap = {};
        for (const log of recentLogs) {
          if (!patientEmails.has(log.patient_email)) continue;
          if (log.date < sevenDaysAgo) continue;
          const email = log.patient_email;
          if (!logsMap[email]) logsMap[email] = [];
          if (logsMap[email].length < 7) logsMap[email].push(log);
        }

        const getGlucoseReading = (log) => {
          const readings = [
            log.before_food_morning, log.after_food_morning,
            log.before_food_afternoon, log.after_food_afternoon,
            log.before_food_night, log.after_food_night,
            log.random_sugar, log.fasting_sugar,
            log.post_breakfast_sugar, log.post_dinner_sugar,
          ].filter((r) => r != null);
          if (readings.length === 0) return null;
          return readings.reduce((a, b) => a + b, 0) / readings.length;
        };

        const statusOf = (email) => {
          const logs = logsMap[email] || [];
          if (logs.length === 0) return "No Data";
          const latest = logs[0];
          const daysSinceUpdate = moment().diff(moment(latest.date), "days");
          if (daysSinceUpdate > 2) return "Inactive";
          if (logs.length >= 2) {
            const avg1 = getGlucoseReading(logs[0]);
            const avg2 = getGlucoseReading(logs[1]);
            if (avg1 != null && avg2 != null) {
              if (avg1 < avg2 - 10) return "Improving";
              if (avg1 > avg2 + 20) return "Needs Attention";
            }
          }
          return "Stable";
        };

        const result = { Improving: 0, Stable: 0, "Needs Attention": 0, Inactive: 0, "No Data": 0 };
        for (const a of assignments) {
          const s = statusOf(a.patient_email);
          result[s]++;
        }
        setCounts(result);
      } catch (e) {
        console.error("PatientStatusCards error:", e);
      }
    })();
  }, []);

  const cards = [
    { label: "Improving", icon: TrendingDown, color: "text-emerald-600" },
    { label: "Stable", icon: Minus, color: "text-blue-600" },
    { label: "Needs Attention", icon: TrendingUp, color: "text-orange-600" },
    { label: "Inactive", icon: AlertCircle, color: "text-red-600" },
    { label: "No Data", icon: Users, color: "text-gray-500" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-card rounded-xl border border-border p-3 text-center">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${c.color}`} />
            <p className="text-xl font-bold font-heading">{counts ? counts[c.label] : "—"}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}