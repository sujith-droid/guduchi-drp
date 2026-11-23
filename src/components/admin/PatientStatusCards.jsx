import { useState, useEffect } from "react";
import { invokeFunction } from "@/lib/invokeFunction";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Users } from "lucide-react";
import moment from "moment";
import PatientStatusList from "@/components/admin/PatientStatusList";

/**
 * Self-contained patient status summary cards.
 * Fetches assignments + recent logs via doctorApi and computes
 * per-patient status (Improving, Stable, Needs Attention, Inactive, No Data).
 * Clicking a card opens the list of patients in that group.
 */
export default function PatientStatusCards({ staff = [] }) {
  const [groups, setGroups] = useState(null);
  const [openStatus, setOpenStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const adminToken = localStorage.getItem("admin_session_token");
        const data = await invokeFunction("doctorApi", { adminToken, action: "getData" });
        const assignments = data.assignments || [];
        const recentLogs = data.recentLogs || [];
        const patientPhones = data.patientPhones || {};
        const patientNames = data.patientNames || {};

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

        // Assigned staff per patient, split into Health Coaches ("doctor") and Doctors ("viewer").
        const staffByEmail = {};
        for (const u of staff) {
          staffByEmail[u.email] = { name: u.display_name || u.full_name || u.email, role: u.role };
        }
        const assignedStaff = {};
        for (const a of assignments) {
          if (!a.doctor_email) continue;
          const s = assignedStaff[a.patient_email] || { coaches: [], doctors: [] };
          const info = staffByEmail[a.doctor_email];
          const name = info?.name || a.doctor_name || a.doctor_email;
          const bucket = info?.role === "viewer" ? s.doctors : s.coaches;
          if (!bucket.includes(name)) bucket.push(name);
          assignedStaff[a.patient_email] = s;
        }

        const result = { Improving: [], Stable: [], "Needs Attention": [], Inactive: [], "No Data": [] };
        const seen = new Set();
        for (const a of assignments) {
          const email = a.patient_email;
          if (seen.has(email)) continue;
          seen.add(email);
          const latest = (logsMap[email] || [])[0];
          const assigned = assignedStaff[email] || { coaches: [], doctors: [] };
          result[statusOf(email)].push({
            email,
            name: patientNames[email] || a.patient_name || "",
            phone: patientPhones[email] || "",
            lastLogDate: latest ? moment(latest.date).format("DD MMM YYYY") : "",
            coaches: assigned.coaches,
            doctors: assigned.doctors,
          });
        }
        for (const key of Object.keys(result)) {
          result[key].sort((x, y) => (x.name || x.email).localeCompare(y.name || y.email));
        }
        setGroups(result);
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
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const count = groups ? groups[c.label].length : null;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => setOpenStatus(c.label)}
              className="bg-card rounded-xl border border-border p-3 text-center transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={`Show ${c.label} patients`}
            >
              <Icon className={`h-5 w-5 mx-auto mb-1 ${c.color}`} />
              <p className="text-xl font-bold font-heading">{count != null ? count : "—"}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </button>
          );
        })}
      </div>

      <PatientStatusList
        status={openStatus}
        patients={openStatus && groups ? groups[openStatus] : []}
        onClose={() => setOpenStatus(null)}
      />
    </>
  );
}