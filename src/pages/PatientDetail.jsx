import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import MobileSelect from "@/components/MobileSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SugarChart from "../components/SugarChart";
import WeightStepChart from "../components/WeightStepChart";
import StatCard from "../components/StatCard";
import { ArrowLeft, Droplets, Weight, Footprints, Activity, MessageCircle, Phone, IdCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import moment from "moment-timezone";
import { useAuth } from "@/lib/AuthContext";

export default function PatientDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const patientEmail = urlParams.get("email");
  const patientName = urlParams.get("name") || "Patient";

  const [logs, setLogs] = useState([]);
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [patientPhone, setPatientPhone] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [patientIdInput, setPatientIdInput] = useState("");
  const [savingId, setSavingId] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    loadLogs();
    loadPatientPhone();
    loadAssignment();
  }, [period, user]);

  const loadAssignment = async () => {
    const me = user;
    const query = me.role === "admin"
      ? { patient_email: patientEmail, status: "active" }
      : { patient_email: patientEmail, doctor_email: me.email, status: "active" };
    const assignments = await base44.entities.PatientDoctorAssignment.filter(query);
    if (assignments.length > 0) {
      setAssignment(assignments[0]);
      setPatientIdInput(assignments[0].patient_id || "");
    }
  };

  const savePatientId = async () => {
    if (!assignment) return;
    setSavingId(true);
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      await base44.functions.invoke("doctorApi", {
        adminToken, action: "savePatientId",
        assignmentId: assignment.id, patientId: patientIdInput.trim(),
      });
      toast.success("Patient ID saved!");
    } catch (e) {
      toast.error("Failed to save Patient ID");
    } finally {
      setSavingId(false);
    }
  };

  const loadPatientPhone = async () => {
    try {
      const res = await base44.functions.invoke('getUserPhone', { target_email: patientEmail });
      setPatientPhone(res.data.phone || null);
    } catch (e) {
      console.error("Failed to load patient phone", e);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    const data = await base44.entities.DailyLog.filter(
      { patient_email: patientEmail },
      "-date",
      Number(period)
    );
    setLogs(data);
    setLoading(false);
  };

  const latest = logs[0];
  const previous = logs[1];

  const calcTrend = (field) => {
    if (!latest?.[field] || !previous?.[field]) return null;
    const change = ((latest[field] - previous[field]) / previous[field]) * 100;
    return Math.round(change);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/doctor">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-heading font-bold">{patientName}</h1>
            <p className="text-xs text-muted-foreground">{patientEmail}</p>
            {assignment?.patient_id && (
              <span className="text-xs bg-primary/10 text-primary font-mono px-2 py-0.5 rounded-full">ID: {assignment.patient_id}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <MobileSelect
            value={period}
            onValueChange={setPeriod}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
            ]}
            placeholder="Select period"
            triggerClassName="w-24"
          />
          <Link to="/chat">
            <Button size="sm" variant="outline" className="gap-1">
              <MessageCircle className="h-3 w-3" /> Chat
            </Button>
          </Link>
          {patientPhone ? (
            <a href={`tel:${patientPhone}`} aria-label={`Call ${patientName}`}>
              <Button size="sm" className="gap-1 bg-emerald-500 hover:bg-emerald-600">
                <Phone className="h-3 w-3" /> Call
              </Button>
            </a>
          ) : (
            <Button size="sm" variant="outline" disabled className="gap-1 opacity-50" aria-label="No phone number available">
              <Phone className="h-3 w-3" /> No Phone
            </Button>
          )}
        </div>
      </div>

      {/* Patient ID Card for Doctor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <IdCard className="h-4 w-4 text-primary" /> Patient ID
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., GUD-2024-001"
              value={patientIdInput}
              onChange={(e) => setPatientIdInput(e.target.value)}
            />
            <Button onClick={savePatientId} disabled={savingId} className="shrink-0">
              {savingId ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No logs found for this patient.
        </div>
      ) : (
        <>
          {/* Latest Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Droplets}
              label="Fasting Sugar"
              value={latest?.fasting_sugar}
              unit="mg/dL"
              trend={calcTrend("fasting_sugar")}
            />
            <StatCard
              icon={Activity}
              label="Post Breakfast"
              value={latest?.post_breakfast_sugar}
              unit="mg/dL"
              trend={calcTrend("post_breakfast_sugar")}
            />
            <StatCard
              icon={Weight}
              label="Weight"
              value={latest?.weight}
              unit="kg"
              trend={calcTrend("weight")}
            />
            <StatCard
              icon={Footprints}
              label="Steps"
              value={latest?.step_count?.toLocaleString()}
              trend={calcTrend("step_count")}
            />
          </div>

          {/* Sugar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Blood Sugar Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <SugarChart logs={logs} />
            </CardContent>
          </Card>

          {/* Weight Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weight Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <WeightStepChart logs={logs} dataKey="weight" label="Weight (kg)" color="hsl(var(--chart-2))" />
            </CardContent>
          </Card>

          {/* Steps Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Step Count</CardTitle>
            </CardHeader>
            <CardContent>
              <WeightStepChart logs={logs} dataKey="step_count" label="Steps" color="hsl(var(--chart-3))" />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}