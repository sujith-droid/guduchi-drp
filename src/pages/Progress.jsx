import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SugarChart from "../components/SugarChart";
import WeightStepChart from "../components/WeightStepChart";
import { Droplets, Weight, Footprints, Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

export default function Progress() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [hba1cRecords, setHba1cRecords] = useState([]);
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [hba1cValue, setHba1cValue] = useState("");
  const [hba1cDate, setHba1cDate] = useState(moment().format("YYYY-MM-DD"));
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user) loadLogs();
  }, [user, period]);

  const loadData = async () => {
    const me = await base44.auth.me();
    setUser(me);
    const hba1c = await base44.entities.HbA1cRecord.filter({ patient_email: me.email }, "-date", 10);
    setHba1cRecords(hba1c);
    setLoading(false);
  };

  const loadLogs = async () => {
    const allLogs = await base44.entities.DailyLog.filter(
      { patient_email: user.email },
      "-date",
      Number(period)
    );
    setLogs(allLogs);
  };

  const saveHba1c = async () => {
    if (!hba1cValue) return;
    await base44.entities.HbA1cRecord.create({
      patient_email: user.email,
      date: hba1cDate,
      value: Number(hba1cValue),
    });
    toast.success("HbA1c record saved!");
    setDialogOpen(false);
    setHba1cValue("");
    const hba1c = await base44.entities.HbA1cRecord.filter({ patient_email: user.email }, "-date", 10);
    setHba1cRecords(hba1c);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Progress</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your health journey</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="sugar" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="sugar" className="gap-1 text-xs">
            <Droplets className="h-3 w-3" /> Sugar
          </TabsTrigger>
          <TabsTrigger value="weight" className="gap-1 text-xs">
            <Weight className="h-3 w-3" /> Weight
          </TabsTrigger>
          <TabsTrigger value="steps" className="gap-1 text-xs">
            <Footprints className="h-3 w-3" /> Steps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sugar">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Blood Sugar Levels</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length > 0 ? (
                <SugarChart logs={logs} />
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No data for this period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weight">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weight Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <WeightStepChart logs={logs} dataKey="weight" label="Weight (kg)" color="hsl(var(--chart-2))" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steps">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Step Count</CardTitle>
            </CardHeader>
            <CardContent>
              <WeightStepChart logs={logs} dataKey="step_count" label="Steps" color="hsl(var(--chart-3))" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* HbA1c Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> HbA1c Records
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
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
                    <Input
                      type="date"
                      value={hba1cDate}
                      onChange={(e) => setHba1cDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>HbA1c Value (%)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 6.5"
                      value={hba1cValue}
                      onChange={(e) => setHba1cValue(e.target.value)}
                      className="mt-1"
                      step="0.1"
                    />
                  </div>
                  <Button onClick={saveHba1c} className="w-full">Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {hba1cRecords.length > 0 ? (
            <div className="space-y-2">
              {hba1cRecords.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">{moment(rec.date).format("MMM D, YYYY")}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{rec.value}%</span>
                    {hba1cRecords.indexOf(rec) < hba1cRecords.length - 1 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        rec.value < hba1cRecords[hba1cRecords.indexOf(rec) + 1].value
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {rec.value < hba1cRecords[hba1cRecords.indexOf(rec) + 1].value ? "↓" : "↑"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No HbA1c records yet. Add your latest reading.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}