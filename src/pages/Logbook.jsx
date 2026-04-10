import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Droplets, Weight, Footprints, Save, Calendar, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";
import { motion } from "framer-motion";

export default function Logbook() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [log, setLog] = useState({
    fasting_sugar: "",
    post_breakfast_sugar: "",
    post_dinner_sugar: "",
    weight: "",
    step_count: "",
    notes: "",
  });
  const [existingLog, setExistingLog] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) loadLogForDate();
  }, [user, selectedDate]);

  const loadUser = async () => {
    const me = await base44.auth.me();
    setUser(me);
    const logs = await base44.entities.DailyLog.filter({ patient_email: me.email }, "-date", 14);
    setRecentLogs(logs);
    setLoading(false);
  };

  const loadLogForDate = async () => {
    const logs = await base44.entities.DailyLog.filter({ patient_email: user.email, date: selectedDate });
    if (logs.length > 0) {
      const existing = logs[0];
      setExistingLog(existing);
      setLog({
        fasting_sugar: existing.fasting_sugar || "",
        post_breakfast_sugar: existing.post_breakfast_sugar || "",
        post_dinner_sugar: existing.post_dinner_sugar || "",
        weight: existing.weight || "",
        step_count: existing.step_count || "",
        notes: existing.notes || "",
      });
    } else {
      setExistingLog(null);
      setLog({ fasting_sugar: "", post_breakfast_sugar: "", post_dinner_sugar: "", weight: "", step_count: "", notes: "" });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const data = {
      patient_email: user.email,
      date: selectedDate,
      fasting_sugar: log.fasting_sugar ? Number(log.fasting_sugar) : undefined,
      post_breakfast_sugar: log.post_breakfast_sugar ? Number(log.post_breakfast_sugar) : undefined,
      post_dinner_sugar: log.post_dinner_sugar ? Number(log.post_dinner_sugar) : undefined,
      weight: log.weight ? Number(log.weight) : undefined,
      step_count: log.step_count ? Number(log.step_count) : undefined,
      notes: log.notes || undefined,
    };

    if (existingLog) {
      await base44.entities.DailyLog.update(existingLog.id, data);
    } else {
      await base44.entities.DailyLog.create(data);
    }
    setSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
    loadLogForDate();
    const logs = await base44.entities.DailyLog.filter({ patient_email: user.email }, "-date", 14);
    setRecentLogs(logs);
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

  return (
    <div className="space-y-6 pb-20 md:pb-6">
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
      <div>
        <h1 className="text-2xl font-heading font-bold">Daily Logbook</h1>
        <p className="text-sm text-muted-foreground mt-1">Record your daily health metrics</p>
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-4 bg-card rounded-xl border border-border p-3">
        <Button variant="ghost" size="icon" onClick={() => changeDate(-1)}>
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
          onClick={() => changeDate(1)}
          disabled={selectedDate === moment().format("YYYY-MM-DD")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="sugar" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="sugar" className="gap-1 text-xs">
            <Droplets className="h-3 w-3" /> Sugar
          </TabsTrigger>
          <TabsTrigger value="body" className="gap-1 text-xs">
            <Weight className="h-3 w-3" /> Body
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1 text-xs">
            <Footprints className="h-3 w-3" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sugar">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Blood Sugar Readings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Fasting (Morning) — mg/dL</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 110"
                    value={log.fasting_sugar}
                    onChange={(e) => setLog({ ...log, fasting_sugar: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Post Breakfast — mg/dL</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 150"
                    value={log.post_breakfast_sugar}
                    onChange={(e) => setLog({ ...log, post_breakfast_sugar: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Post Dinner — mg/dL</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 140"
                    value={log.post_dinner_sugar}
                    onChange={(e) => setLog({ ...log, post_dinner_sugar: e.target.value })}
                    className="mt-1"
                  />
                </div>
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
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="activity">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    entry.fasting_sugar && `F: ${entry.fasting_sugar}`,
                    entry.post_breakfast_sugar && `PB: ${entry.post_breakfast_sugar}`,
                    entry.post_dinner_sugar && `PD: ${entry.post_dinner_sugar}`,
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