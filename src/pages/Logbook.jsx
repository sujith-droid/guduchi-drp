import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Droplets, Weight, Save, Calendar, ChevronLeft, ChevronRight, CheckCircle2, FileText, Plus } from "lucide-react";
import MobileSelect from "../components/MobileSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import moment from "moment-timezone";
import { motion } from "framer-motion";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../components/PullToRefreshIndicator";
import { useAuth } from "@/lib/AuthContext";
import { isPatientRole } from "@/lib/roles";

export default function Logbook() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [log, setLog] = useState({
    before_food_morning: "",
    before_food_afternoon: "",
    before_food_night: "",
    after_food_morning: "",
    after_food_afternoon: "",
    after_food_night: "",
    random_sugar: "",
    weight: "",
    step_count: "",
    notes: "",
  });
  const [existingLog, setExistingLog] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sugarTiming, setSugarTiming] = useState("morning");
  const [showSuccess, setShowSuccess] = useState(false);
  const [hba1cRecords, setHba1cRecords] = useState([]);
  const [hba1cValue, setHba1cValue] = useState("");
  const [hba1cDate, setHba1cDate] = useState("");
  const [hba1cDialogOpen, setHba1cDialogOpen] = useState(false);
  const [savingHba1c, setSavingHba1c] = useState(false);

  // Route all entity operations through patientApi so OTP-authenticated users
  // (whose AdminSession token isn't a valid Base44 platform token) can read
  // and write their logs. Direct SDK calls fail with 401 for these users.
  const logApi = async (action, payload = {}) => {
    const adminToken = localStorage.getItem("admin_session_token");
    const res = await base44.functions.invoke("patientApi", { adminToken, action, ...payload });
    const data = res.data || res;
    if (data.error) throw new Error(data.error);
    return data;
  };

  useEffect(() => {
    if (user && isPatientRole(user.role)) {
      loadUser();
    } else if (user) {
      setLoading(false);
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    await loadUser();
    await loadLogForDate();
  }, [user, selectedDate]);

  const scrollRef = useRef(null);
  useLayoutEffect(() => {
    scrollRef.current = document.getElementById("main-scroll");
  }, []);
  const { pullDistance, isRefreshing } = usePullToRefresh(handleRefresh, { scrollRef });

  useEffect(() => {
    if (user && isPatientRole(user.role)) loadLogForDate();
  }, [user, selectedDate]);

  const loadUser = async () => {
    try {
      const data = await logApi("getLogs");
      setRecentLogs(data.logs || []);
      setHba1cRecords(data.hba1c || []);
      setHba1cDate(moment().format("YYYY-MM-DD"));
    } catch (e) {
      console.error("Failed to load logs:", e);
      const status = e?.response?.status || e?.status;
      if (status === 401) {
        toast.error("This page is for patients only.");
      } else {
        toast.error("Could not load your logs. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const saveHba1c = async () => {
    if (!hba1cValue) return;
    setSavingHba1c(true);
    try {
      const data = await logApi("saveHba1c", { date: hba1cDate, value: hba1cValue });
      setHba1cRecords(data.hba1c || []);
      setHba1cValue("");
      setHba1cDialogOpen(false);
    } catch (e) {
      console.error("Failed to save HbA1c:", e);
      toast.error("Could not save HbA1c reading.");
    } finally {
      setSavingHba1c(false);
    }
  };

  const loadLogForDate = async () => {
    try {
      const data = await logApi("getLogForDate", { date: selectedDate });
      const existing = data.log;
      if (existing) {
        setExistingLog(existing);
        setLog({
          before_food_morning: existing.before_food_morning || "",
          before_food_afternoon: existing.before_food_afternoon || "",
          before_food_night: existing.before_food_night || "",
          after_food_morning: existing.after_food_morning || "",
          after_food_afternoon: existing.after_food_afternoon || "",
          after_food_night: existing.after_food_night || "",
          random_sugar: existing.random_sugar || "",
          weight: existing.weight || "",
          step_count: existing.step_count || "",
          notes: existing.notes || "",
        });
      } else {
        setExistingLog(null);
        setLog({ before_food_morning: "", before_food_afternoon: "", before_food_night: "", after_food_morning: "", after_food_afternoon: "", after_food_night: "", random_sugar: "", weight: "", step_count: "", notes: "" });
      }
    } catch (e) {
      console.error("Failed to load log for date:", e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const logData = {
      before_food_morning: log.before_food_morning,
      before_food_afternoon: log.before_food_afternoon,
      before_food_night: log.before_food_night,
      after_food_morning: log.after_food_morning,
      after_food_afternoon: log.after_food_afternoon,
      after_food_night: log.after_food_night,
      random_sugar: log.random_sugar,
      weight: log.weight,
      step_count: log.step_count,
      notes: log.notes,
    };

    // Optimistic update — reflect changes in recent logs list immediately
    const optimisticEntry = { ...logData, date: selectedDate, id: existingLog?.id || `optimistic-${Date.now()}`, created_date: new Date().toISOString() };
    setRecentLogs((prev) => {
      const filtered = prev.filter((l) => l.date !== selectedDate);
      return [optimisticEntry, ...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);

    try {
      await logApi("saveLog", { date: selectedDate, logData });
      // Reconcile with server truth after save
      await loadLogForDate();
      const data = await logApi("getLogs");
      setRecentLogs(data.logs || []);
    } catch (e) {
      console.error("Failed to save log:", e);
      toast.error("Could not save your log entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const changeDate = (dir) => {
    const d = moment(selectedDate).add(dir, "days");
    if (d.isAfter(moment())) return;
    setSelectedDate(d.format("YYYY-MM-DD"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isPatientRole(user?.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">Patient area only</p>
        <p className="text-xs text-muted-foreground mt-1">
          The daily logbook is available to patients. Use the admin panel to manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      {/* Success Popup */}
      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-white border border-emerald-200 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <p className="text-lg font-heading font-bold text-emerald-700">Entry Saved!</p>
            <p className="text-sm text-muted-foreground">Your health data has been recorded.</p>
          </div>
        </motion.div>
      )}
      <div className="text-center md:text-left">
        <h1 className="text-2xl font-heading font-bold">Daily Logbook</h1>
        <p className="text-sm text-muted-foreground mt-1">Record your daily health metrics</p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-4 bg-card rounded-xl border border-border p-3">
        <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => changeDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{moment(selectedDate).format("ddd, MMM D, YYYY")}</span>
          </div>
          {selectedDate === moment().format("YYYY-MM-DD") && (
            <span className="text-xs text-primary font-medium">Today</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next day"
          onClick={() => changeDate(1)}
          disabled={selectedDate === moment().format("YYYY-MM-DD")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="sugar" className="space-y-4">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="sugar" className="gap-1 text-xs">
            <Droplets className="h-3 w-3" /> Sugar
          </TabsTrigger>
          <TabsTrigger value="body" className="gap-1 text-xs">
            <Weight className="h-3 w-3" /> Body
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sugar">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Timing Selector */}
            <div>
              <Label className="text-xs text-muted-foreground">Time of Day</Label>
              <MobileSelect
                value={sugarTiming}
                onValueChange={setSugarTiming}
                options={[
                  { value: "morning", label: "Morning" },
                  { value: "afternoon", label: "Afternoon" },
                  { value: "night", label: "Night" },
                ]}
                placeholder="Select time"
                triggerClassName="mt-1"
              />
            </div>

            {/* Before Food */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Before Food</CardTitle>
              </CardHeader>
              <CardContent>
                <Label className="text-xs text-muted-foreground capitalize">{sugarTiming} — mg/dL</Label>
                <Input
                  type="number"
                  placeholder="e.g., 110"
                  value={log[`before_food_${sugarTiming}`]}
                  onChange={(e) => setLog({ ...log, [`before_food_${sugarTiming}`]: e.target.value })}
                  className="mt-1"
                />
              </CardContent>
            </Card>

            {/* After Food */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">After Food</CardTitle>
              </CardHeader>
              <CardContent>
                <Label className="text-xs text-muted-foreground capitalize">{sugarTiming} — mg/dL</Label>
                <Input
                  type="number"
                  placeholder="e.g., 150"
                  value={log[`after_food_${sugarTiming}`]}
                  onChange={(e) => setLog({ ...log, [`after_food_${sugarTiming}`]: e.target.value })}
                  className="mt-1"
                />
              </CardContent>
            </Card>

            {/* Random */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Random</CardTitle>
              </CardHeader>
              <CardContent>
                <Label className="text-xs text-muted-foreground">Random reading — mg/dL</Label>
                <Input
                  type="number"
                  placeholder="e.g., 130"
                  value={log.random_sugar}
                  onChange={(e) => setLog({ ...log, random_sugar: e.target.value })}
                  className="mt-1"
                />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="body">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Body Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Weight — kg</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 72"
                    value={log.weight}
                    onChange={(e) => setLog({ ...log, weight: e.target.value })}
                    className="mt-1"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Step Count</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 8500"
                    value={log.step_count}
                    onChange={(e) => setLog({ ...log, step_count: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    placeholder="Any observations..."
                    value={log.notes}
                    onChange={(e) => setLog({ ...log, notes: e.target.value })}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : existingLog ? "Update Entry" : "Save Entry"}
      </Button>

      {/* HbA1c Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> HbA1c Records
            </CardTitle>
            <Dialog open={hba1cDialogOpen} onOpenChange={setHba1cDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1" aria-label="Add HbA1c reading">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add HbA1c Reading</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={hba1cDate} onChange={(e) => setHba1cDate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>HbA1c Value (%)</Label>
                    <Input type="number" placeholder="e.g., 6.5" value={hba1cValue} onChange={(e) => setHba1cValue(e.target.value)} className="mt-1" step="0.1" />
                  </div>
                  <Button onClick={saveHba1c} className="w-full" disabled={savingHba1c}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {hba1cRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No HbA1c records yet.</p>
          ) : (
            <div className="space-y-2">
              {hba1cRecords.map((rec, i) => (
                <div key={rec.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">{moment(rec.date).format("MMM D, YYYY")}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{rec.value}%</span>
                    {i < hba1cRecords.length - 1 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        rec.value < hba1cRecords[i + 1].value ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}>
                        {rec.value < hba1cRecords[i + 1].value ? "↓" : "↑"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Entries */}
      {recentLogs.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-sm text-muted-foreground">Recent Entries</h3>
          {recentLogs.slice(0, 7).map((entry) => (
            <div
              key={entry.id}
              className="bg-card rounded-lg border border-border p-3 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedDate(entry.date)}
            >
              <div>
                <p className="text-sm font-medium">{moment(entry.date).format("ddd, MMM D")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[
                    (entry.before_food_morning || entry.fasting_sugar) && `BM: ${entry.before_food_morning || entry.fasting_sugar}`,
                    (entry.after_food_morning || entry.post_breakfast_sugar) && `AM: ${entry.after_food_morning || entry.post_breakfast_sugar}`,
                    entry.before_food_night && `BN: ${entry.before_food_night}`,
                    (entry.after_food_night || entry.post_dinner_sugar) && `AN: ${entry.after_food_night || entry.post_dinner_sugar}`,
                    entry.random_sugar && `R: ${entry.random_sugar}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No sugar readings"}
                </p>
              </div>
              {entry.step_count >= 10000 && <span className="text-xs">🔥</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}