import { useState, useEffect, useCallback, useRef, useLayoutEffect, lazy, Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Code-split recharts-heavy chart components so they load on demand.
const SugarChart = lazy(() => import("../components/SugarChart"));
const WeightStepChart = lazy(() => import("../components/WeightStepChart"));
import { Droplets, Weight, Footprints } from "lucide-react";

import moment from "moment-timezone";
import { useAuth } from "@/lib/AuthContext";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../components/PullToRefreshIndicator";
import MobileSelect from "../components/MobileSelect";

export default function Progress() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleRefresh = useCallback(async () => {
    await loadLogs();
  }, [user, period]);

  const scrollRef = useRef(null);
  useLayoutEffect(() => {
    scrollRef.current = document.getElementById("main-scroll");
  }, []);
  const { pullDistance, isRefreshing } = usePullToRefresh(handleRefresh, { scrollRef });

  useEffect(() => {
    if (user) loadLogs();
  }, [user, period]);

  const loadData = async () => {
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



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="flex items-center justify-between">
        <div className="md:text-left">
          <h1 className="text-2xl font-heading font-bold">Progress</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your health journey</p>
        </div>
        <MobileSelect
          value={period}
          onValueChange={setPeriod}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
          placeholder="Select period"
          triggerClassName="w-28 h-11"
        />
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
                <Suspense fallback={<div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
                  <SugarChart logs={logs} />
                </Suspense>
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
              <Suspense fallback={<div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
                <WeightStepChart logs={logs} dataKey="weight" label="Weight (kg)" color="hsl(var(--chart-2))" />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steps">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Step Count</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
                <WeightStepChart logs={logs} dataKey="step_count" label="Steps" color="hsl(var(--chart-3))" />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}