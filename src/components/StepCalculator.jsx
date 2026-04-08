import { useState } from "react";
import { Footprints, Flame, MapPin, Clock, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

const STEP_LENGTH_M = 0.762; // avg step length in meters
const CALORIES_PER_STEP = 0.04; // approx calories per step

export default function StepCalculator({ todaySteps = 0, goal = 10000 }) {
  const [steps, setSteps] = useState(todaySteps || 0);
  const [manualInput, setManualInput] = useState("");

  const distance = ((steps * STEP_LENGTH_M) / 1000).toFixed(2);
  const calories = Math.round(steps * CALORIES_PER_STEP);
  const duration = Math.round((steps / 100) * 1); // ~100 steps per minute
  const progress = Math.min((steps / goal) * 100, 100);

  const addSteps = () => {
    const val = parseInt(manualInput);
    if (!isNaN(val) && val > 0) {
      setSteps((prev) => prev + val);
      setManualInput("");
    }
  };

  const quickAdd = (amount) => {
    setSteps((prev) => prev + amount);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Footprints className="h-5 w-5 text-primary" /> Step Calculator
        </h3>
        <span className="text-xs text-muted-foreground">
          Goal: {goal.toLocaleString()} steps
        </span>
      </div>

      {/* Progress Ring */}
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 flex-shrink-0">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.64} ${264 - progress * 2.64}`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold font-heading">{steps.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">steps</span>
          </div>
        </div>

        {/* Stats Grid */}
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
              <p className="text-sm font-semibold">{duration}</p>
              <p className="text-[10px] text-muted-foreground">min</p>
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

      {/* Quick Add Buttons */}
      <div className="flex gap-2">
        {[500, 1000, 2000, 5000].map((amt) => (
          <Button
            key={amt}
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => quickAdd(amt)}
          >
            +{amt >= 1000 ? `${amt / 1000}k` : amt}
          </Button>
        ))}
      </div>

      {/* Manual Input */}
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Enter steps..."
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSteps()}
          className="flex-1"
        />
        <Button onClick={addSteps} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {progress >= 100 && (
        <div className="text-center py-2 bg-primary/10 rounded-lg">
          <p className="text-sm font-semibold text-primary">🎉 Goal reached! Great job!</p>
        </div>
      )}
    </motion.div>
  );
}