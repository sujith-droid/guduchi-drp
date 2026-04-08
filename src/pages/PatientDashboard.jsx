import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Droplets, Weight, Footprints, Activity, Plus, ChevronRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatCard from "../components/StatCard";
import SmartFeedback from "../components/SmartFeedback";
import StepCalculator from "../components/StepCalculator";
import SugarChart from "../components/SugarChart";
import moment from "moment";
import { motion } from "framer-motion";

export default function PatientDashboard() {
  const [user, setUser] = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [previousLog, setPreviousLog] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [hba1cImproved, setHba1cImproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignedDoctors, setAssignedDoctors] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);

      const today = moment().format("YYYY-MM-DD");
      const logs = await base44.entities.DailyLog.filter(
        { patient_email: me.email },
        "-date",
        30
      );
      setRecentLogs(logs);

      const todayEntry = logs.find((l) => l.date === today);
      setTodayLog(todayEntry || null);

      const pastEntries = logs.filter((l) => l.date !== today);
      if (pastEntries.length > 0) setPreviousLog(pastEntries[0]);

      // Check HbA1c improvement
      const hba1c = await base44.entities.HbA1cRecord.filter(
        { patient_email: me.email },
        "-date",
        2
      );
      if (hba1c.length >= 2 && hba1c[0].value < hba1c[1].value) {
        setHba1cImproved(true);
      }

      // Load all assigned doctors' phones
      const assignments = await base44.entities.PatientDoctorAssignment.filter({ patient_email: me.email, status: "active" });
      const doctorList = await Promise.all(
        assignments.map(async (a) => {
          let phone = null;
          try {
            const res = await base44.functions.invoke('getUserPhone', { target_email: a.doctor_email });
            phone = res.data.phone || null;
          } catch {}
          return { name: a.doctor_name || a.doctor_email, email: a.doctor_email, phone };
        })
      );
      setAssignedDoctors(doctorList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-heading font-bold">
          {greeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {moment().format("dddd, MMMM D, YYYY")}
        </p>
      </motion.div>

      {/* Smart Feedback */}
      <SmartFeedback currentLog={todayLog} previousLog={previousLog} hba1cImproved={hba1cImproved} />

      {/* Quick Log CTA */}
      {!todayLog && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-primary/10 to-accent p-5 rounded-2xl border border-primary/20"
        >
          <h3 className="font-heading font-semibold text-lg">Log today's readings</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Track your sugar levels, weight, and steps.
          </p>
          <Link to="/logbook">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Entry
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Today's Stats */}
      {todayLog && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Droplets} label="Fasting Sugar" value={todayLog.fasting_sugar} unit="mg/dL" />
          <StatCard icon={Activity} label="Post Breakfast" value={todayLog.post_breakfast_sugar} unit="mg/dL" />
          <StatCard icon={Weight} label="Weight" value={todayLog.weight} unit="kg" />
          <StatCard icon={Footprints} label="Steps" value={todayLog.step_count?.toLocaleString()} />
        </div>
      )}

      {/* Recent Sugar Chart */}
      {recentLogs.length > 1 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold">Blood Sugar Trend</h3>
            <Link to="/progress" className="text-xs text-primary flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <SugarChart logs={recentLogs.slice(0, 7)} height={220} />
        </div>
      )}

      {/* Step Calculator */}
      <StepCalculator todaySteps={todayLog?.step_count || 0} goal={10000} />

      {/* Call Doctors */}
      {assignedDoctors.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Your Care Team</h3>
          {assignedDoctors.map((doc) => (
            doc.phone ? (
              <a key={doc.email} href={`tel:${doc.phone}`}
                className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 hover:bg-emerald-100 transition-colors">
                <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800 text-sm">Dr. {doc.name}</p>
                  <p className="text-xs text-emerald-600">{doc.phone} — tap to dial</p>
                </div>
              </a>
            ) : (
              <div key={doc.email} className="flex items-center gap-3 bg-muted border border-border rounded-xl p-4">
                <div className="h-10 w-10 rounded-full bg-muted-foreground/20 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Dr. {doc.name}</p>
                  <p className="text-xs text-muted-foreground">No phone number added yet</p>
                </div>
              </div>
            )
          ))}
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/logbook">
          <div className="bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-colors">
            <Plus className="h-5 w-5 text-primary mb-2" />
            <p className="text-sm font-medium">Log Entry</p>
            <p className="text-xs text-muted-foreground">Record daily readings</p>
          </div>
        </Link>
        <Link to="/chat">
          <div className="bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-colors">
            <Activity className="h-5 w-5 text-primary mb-2" />
            <p className="text-sm font-medium">Chat Doctor</p>
            <p className="text-xs text-muted-foreground">Ask your doctor</p>
          </div>
        </Link>
      </div>
    </div>
  );
}