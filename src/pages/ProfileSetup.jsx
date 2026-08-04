import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Stethoscope, User } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const me = await base44.auth.me();
    setUser(me);
    if (me.age) setAge(String(me.age));
    if (me.gender) setGender(me.gender);
    if (me.phone) setPhone(me.phone);
    if (me.role) setSelectedRole(me.role);
  };

  const handleSave = async () => {
    setSaving(true);
    if (!selectedRole) {
      toast.error("Please select whether you are a Doctor or a Patient.");
      setSaving(false);
      return;
    }

    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Please enter a valid mobile number (at least 10 digits).");
      setSaving(false);
      return;
    }

    const patientId = user.patient_id || `DRP-${Date.now().toString(36).toUpperCase()}`;
    
    await base44.auth.updateMe({
      age: age ? Number(age) : undefined,
      gender: gender || undefined,
      phone: phone || undefined,
      patient_id: patientId,
      profile_complete: true,
      role: selectedRole,
    });

    toast.success("Profile saved!");
    setSaving(false);

    if (selectedRole === "doctor") navigate("/doctor");
    else navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold">Welcome to DiaCare</h1>
          <p className="text-sm text-muted-foreground mt-2">Let's set up your profile</p>
        </div>

        {/* Role Selection */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setSelectedRole("patient")}
            className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
              selectedRole === "patient"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            }`}
          >
            <User className="h-8 w-8" />
            <div className="text-center">
              <p className="font-semibold text-sm">I'm a Patient</p>
              <p className="text-xs opacity-70 mt-0.5">Track my health</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("doctor")}
            className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
              selectedRole === "doctor"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Stethoscope className="h-8 w-8" />
            <div className="text-center">
              <p className="font-semibold text-sm">I'm a Doctor</p>
              <p className="text-xs opacity-70 mt-0.5">Manage my patients</p>
            </div>
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div>
            <Label>Name</Label>
            <Input value={user?.full_name || ""} disabled className="mt-1 opacity-60" />
          </div>
          <div>
            <Label>Mobile Number <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g., +91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
              type="tel"
            />
            <p className="text-xs text-muted-foreground mt-1">Required for calls between patients and doctors</p>
          </div>
          <div>
            <Label>Age (optional)</Label>
            <Input
              type="number"
              placeholder="e.g., 45"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Gender (optional)</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {user?.patient_id && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Patient ID</p>
              <p className="font-mono font-semibold text-sm">{user.patient_id}</p>
            </div>
          )}

          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}