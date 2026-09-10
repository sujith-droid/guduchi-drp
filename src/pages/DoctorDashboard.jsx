import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, Search, Clock, TrendingUp, TrendingDown, Minus, Send } from "lucide-react";
import BulkMessageModal from "../components/BulkMessageModal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import moment from "moment";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [patientLogs, setPatientLogs] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const me = user;

    const isAdmin = me.role === "admin";
    const query = isAdmin ? { status: "active" } : { doctor_email: me.email, status: "active" };
    const assignments = await base44.entities.PatientDoctorAssignment.filter(query);
    setPatients(assignments);

    // Load all recent logs in one batch query, then group by patient
    const recentLogs = await base44.entities.DailyLog.list("-date", 1000);
    const sevenDaysAgo = moment().subtract(7, "days").format("YYYY-MM-DD");
    const logsMap = {};
    for (const log of recentLogs) {
      if (log.date < sevenDaysAgo) continue;
      const email = log.patient_email;
      if (!logsMap[email]) logsMap[email] = [];
      if (logsMap[email].length < 7) logsMap[email].push(log);
    }
    setPatientLogs(logsMap);
    setLoading(false);
  };

  const getStatus = (email) => {
    const logs = patientLogs[email] || [];
    if (logs.length === 0) return { label: "No Data", color: "bg-gray-100 text-gray-600" };
    
    const latest = logs[0];
    const daysSinceUpdate = moment().diff(moment(latest.date), "days");
    if (daysSinceUpdate > 2) return { label: "Inactive", color: "bg-red-100 text-red-700" };

    if (logs.length >= 2) {
      const avg1 = (logs[0].fasting_sugar || 0) + (logs[0].post_breakfast_sugar || 0);
      const avg2 = (logs[1].fasting_sugar || 0) + (logs[1].post_breakfast_sugar || 0);
      if (avg1 < avg2 - 10) return { label: "Improving", color: "bg-emerald-100 text-emerald-700" };
      if (avg1 > avg2 + 20) return { label: "Needs Attention", color: "bg-orange-100 text-orange-700" };
    }
    return { label: "Stable", color: "bg-blue-100 text-blue-700" };
  };

  const getStatusIcon = (label) => {
    if (label === "Improving") return TrendingDown;
    if (label === "Needs Attention") return TrendingUp;
    return Minus;
  };

  const filteredPatients = patients.filter((p) =>
    (p.patient_name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Patient Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {patients.length} patient{patients.length !== 1 ? "s" : ""} assigned
          </p>
        </div>
        <button
          onClick={() => setBulkModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Send className="h-4 w-4" /> Bulk Message
        </button>
      </div>
      <BulkMessageModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        patients={patients}
        doctorEmail={user?.email}
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-3">
        {["Improving", "Stable", "Needs Attention"].map((status) => {
          const count = patients.filter((p) => getStatus(p.patient_email).label === status).length;
          const StatusIcon = getStatusIcon(status);
          return (
            <div key={status} className="bg-card rounded-xl border border-border p-3 text-center">
              <StatusIcon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-bold font-heading">{count}</p>
              <p className="text-[10px] text-muted-foreground">{status}</p>
            </div>
          );
        })}
      </div>

      {/* Patient List */}
      <div className="space-y-2">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? "No patients match your search" : "No patients assigned yet"}</p>
          </div>
        ) : (
          filteredPatients.map((patient, i) => {
            const status = getStatus(patient.patient_email);
            const logs = patientLogs[patient.patient_email] || [];
            const lastLog = logs[0];

            return (
              <motion.div
                key={patient.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/patient-detail?email=${encodeURIComponent(patient.patient_email)}&name=${encodeURIComponent(patient.patient_name || "")}`}
                  className="block bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {(patient.patient_name || "?")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{patient.patient_name || "Unknown"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status.color}`}>
                            {status.label}
                          </Badge>
                          {lastLog && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {moment(lastLog.date).fromNow()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {lastLog?.fasting_sugar && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Fasting</p>
                        <p className="font-bold text-sm">{lastLog.fasting_sugar}</p>
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}