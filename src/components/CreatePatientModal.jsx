import { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, UserPlus, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const DUMMY_DOMAIN = "guduchi.care";

function generatePassword() {
  // memorable-ish 8-char password
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let pw = "G";
  for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += "@1";
  return pw;
}

function dummyEmailFor(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return `patient_${digits}@${DUMMY_DOMAIN}`;
}

export default function CreatePatientModal({ open, onClose, doctor, onCreated }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // { email, password }
  const [copied, setCopied] = useState(null);

  const reset = () => {
    setName("");
    setPhone("");
    setCreated(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Enter the patient's name", variant: "destructive" });
      return;
    }
    if ((phone || "").replace(/\D/g, "").length < 6) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }

    const email = dummyEmailFor(phone);
    const password = generatePassword();
    setBusy(true);
    try {
      // Register the account (verification is disabled, so it's directly loginable)
      await base44.auth.register({ email, password });

      // Link the patient to this doctor
      await base44.entities.PatientDoctorAssignment.create({
        patient_email: email,
        doctor_email: doctor.email,
        patient_name: name.trim(),
        doctor_name: doctor.full_name || "",
        status: "active",
      });

      setCreated({ email, password });
      onCreated && onCreated();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Could not create the account. That phone may already be registered.";
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const copy = (key, value) => {
    navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Create Patient Account
          </DialogTitle>
          <DialogDescription>
            A dummy email is generated from the patient's phone. Share the email and password below with the patient.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 p-3 text-sm">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                Account created for {name.trim()}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                Patient can now sign in with these credentials.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Login email</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={created.email} className="font-mono text-sm" />
                <Button size="icon" variant="outline" onClick={() => copy("email", created.email)}>
                  {copied === "email" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={created.password} className="font-mono text-sm" />
                <Button size="icon" variant="outline" onClick={() => copy("pw", created.password)}>
                  {copied === "pw" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={close} className="w-full">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pt-name">Patient name</Label>
              <Input
                id="pt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-phone">Phone number</Label>
              <Input
                id="pt-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Login email will be: <span className="font-mono">{dummyEmailFor(phone) || "patient_<phone>@" + DUMMY_DOMAIN}</span>
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}