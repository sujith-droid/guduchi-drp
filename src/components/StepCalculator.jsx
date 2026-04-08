import { useState, useEffect, useRef } from "react";
import { Footprints, Flame, MapPin, Clock, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const STEP_LENGTH_M = 0.762;
const CALORIES_PER_STEP = 0.04;
const STEP_THRESHOLD = 12; // acceleration magnitude threshold
const STEP_COOLDOWN_MS = 400; // minimum ms between steps

export default function StepCalculator({ todaySteps = 0, goal = 10000 }) {
  const [steps, setSteps] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [permitted, setPermitted] = useState(null); // null=unknown, true=yes, false=no
  const [elapsed, setElapsed] = useState(0);
  const lastStepTime = useRef(0);
  const timerRef = useRef(null);
  const stepsRef = useRef(0);

  const distance = ((steps * STEP_LENGTH_M) / 1000).toFixed(2);
  const calories = Math.round(steps * CALORIES_PER_STEP);
  const progress = Math.min(((steps + todaySteps) / goal) * 100, 100);
  const totalSteps = steps + todaySteps;

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  const handleMotion = (event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    const now = Date.now();
    if (magnitude > STEP_THRESHOLD && now - lastStepTime.current > STEP_COOLDOWN_MS) {
      lastStepTime.current = now;
      stepsRef.current += 1;
      setSteps(stepsRef.current);
    }
  };

  const startTracking = async () => {
    // iOS requires permission for DeviceMotionEvent
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== "granted") {
          setPermitted(false);
          return;
        }
      } catch {
        setPermitted(false);
        return;
      }
    }
    setPermitted(true);
    setIsTracking(true);
    setElapsed(0);
    stepsRef.current = 0;
    setSteps(0);
    window.addEventListener("devicemotion", handleMotion);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stopTracking = () => {
    setIsTracking(false);
    window.removeEventListener("devicemotion", handleMotion);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Footprints className="h-5 w-5 text-primary" /> Step Counter
        </h3>
        <span className="text-xs text-muted-foreground">
          Daily goal: {goal.toLocaleString()}
        </span>
      </div>

      {/* Progress Ring */}
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 flex-shrink-0">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={isTracking ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.64} ${264 - progress * 2.64}`}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold font-heading leading-none">{totalSteps.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">/ {goal.toLocaleString()}</span>
            {isTracking && (
              <span className="text-[10px] text-primary font-semibold mt-0.5 animate-pulse">LIVE</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{calories}</p>
              <p className="text-[10px] text-muted-foreground">kcal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{distance}</p>
              <p className="text-[10px] text-muted-foreground">km</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{formatTime(elapsed)}</p>
              <p className="text-[10px] text-muted-foreground">time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
              <Footprints className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{Math.round(progress)}%</p>
              <p className="text-[10px] text-muted-foreground">of goal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Session steps */}
      {isTracking && (
        <div className="text-center py-2 bg-primary/10 rounded-lg">
          <p className="text-sm text-primary font-medium">
            +{steps.toLocaleString()} steps this session
          </p>
        </div>
      )}

      {/* Permission denied message */}
      {permitted === false && (
        <div className="text-center py-2 bg-destructive/10 rounded-lg">
          <p className="text-xs text-destructive">Motion sensor permission denied. Please allow access in browser settings.</p>
        </div>
      )}

      {/* Control Button */}
      {!isTracking ? (
        <Button onClick={startTracking} className="w-full gap-2">
          <Play className="h-4 w-4" /> Start Counting Steps
        </Button>
      ) : (
        <Button onClick={stopTracking} variant="destructive" className="w-full gap-2">
          <Square className="h-4 w-4" /> Stop
        </Button>
      )}

      {progress >= 100 && (
        <div className="text-center py-2 bg-primary/10 rounded-lg">
          <p className="text-sm font-semibold text-primary">🎉 Daily goal reached! Great job!</p>
        </div>
      )}
    </motion.div>
  );
}