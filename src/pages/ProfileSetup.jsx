import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MobileSelect from "@/components/MobileSelect";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, loginWithToken } = useAuth(); // Need loginWithToken to update user in context

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.age) setAge(String(user.age));
      if (user.gender) setGender(user.gender);
    }
  }, [user]);

  const handleSave = async () => {
    if (!age || age < 1 || age > 120) return toast.error("Please enter a valid age.");
    if (!gender) return toast.error("Please select your gender.");

    setSaving(true);
    try {
      const patientId = user.patient_id || `DRP-${Date.now().toString(36).toUpperCase()}`;

      // Save via a service-role backend function so it works regardless of the
      // client session token (phone-OTP login only has a dummy token).
      const res = await base44.functions.invoke("completeProfile", {
        email: user.email,
        age: Number(age),
        gender,
        patient_id: patientId
      });
      const responseData = res?.data || res;

      const newUser = { ...user, ...(responseData?.user || {}), profile_complete: true };
      loginWithToken(null, newUser);

      toast.success("Profile saved!");

      if (newUser.role === "doctor") {
        navigate("/doctor", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err.message || "Failed to save profile";
      toast.error(serverMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20 p-2 overflow-hidden">
            <img src="/logo.png" alt="Logo" className="h-full w-full rounded-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-foreground">Complete Your Profile</h1>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-2">Just a few more details to get started</p>
        </div>

        <div className="bg-white dark:bg-card dark:text-card-foreground p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-border space-y-4">
          <div className="space-y-1.5 text-left">
            <Label className="text-slate-700 dark:text-foreground">Age</Label>
            <Input
              type="number"
              placeholder="e.g. 35"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="text-lg"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <Label className="text-slate-700 dark:text-foreground">Gender</Label>
            <MobileSelect
              value={gender}
              onValueChange={setGender}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
              ]}
              placeholder="Select gender"
              triggerClassName="h-12 text-base"
            />
          </div>

          <Button
            className="w-full h-12 text-base font-semibold mt-4 gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-5 w-5 animate-spin" />}
            {saving ? "Saving Profile..." : "Complete Setup"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}