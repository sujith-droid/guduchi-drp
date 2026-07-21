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
import { Copy, Check, UserPlus, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Plus-addressing base: the clinic's single inbox that receives every patient's OTP.
// Change this to your clinic's real email (e.g. yourclinic@gmail.com).
const CLINIC_BASE_EMAIL = "sujith@guduchiayurveda.com";

function generatePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let pw = "G";
  for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += "@1";
  return pw;
}

function plusEmailFor(baseEmail, phone) {
  const digits = (phone || "").replace(/\D/g, "");
  const [user, domain] = baseEmail.split("@");
  return `${user}+patient${digits}@${domain}`;
}

export default function CreatePatientModal({ open, onClose, doctor, onCreated }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("form"); // form | otp | done
  const [creds, setCreds] = useState(null); // { email, password }
  const [otp, setOtp] = useState("");
  const [copied, setCopied] = useState(null);

  const reset = () => {
    setName("");
    setPhone("");
    setOtp("");
    setCreds(null);
    setStage("form");
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      toast({ title: "Enter the patient's name", variant: "destructive" });
      return;
    }
    if ((phone || "").replace(/\D/g, "").length < 6) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }

    const email = plusEmailFor(CLINIC_BASE_EMAIL, phone);
    const password = generatePassword();
    setBusy(true);
    try {
      await base44.auth.register({ email, password });
      setCreds({ email, password });
      setStage("otp");
      toast({
        title: "Verification code sent",
        description: `Check ${CLINIC_BASE_EMAIL} for the OTP.`,
      });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Could not register. That phone may already be in use.";
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!creds) return;
    try {
      await base44.auth.resendOtp(creds.email);
      toast({ title: "OTP resent", description: `Check ${CLINIC_BASE_EMAIL}.` });
    } catch (err) {
      toast({ title: "Could not resend OTP", description: err?.message, variant: "destructive" });
    }
  };

  const handleVerify = async () => {
    if ((otp || "").trim().length < 4) {
      toast({ title: "Enter the OTP code", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await base44.auth.verifyOtp({ email: creds.email, otpCode: otp.trim() });
      // Verified — now link the patient to this doctor
      await base44.entities.PatientDoctorAssignment.create({
        patient_email: creds.email,
        doctor_email: doctor.email,
        patient_name: name.trim(),
        doctor_name: doctor.full_name || "",
        status: "active",
      });
      setStage("done");
      onCreated && onCreated();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Invalid or expired code.";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const copy = (key, value) => {
    navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const renderCredsBox = () => (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Login email</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy("email", creds.email)}>
          {copied === "email" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <p className="font-mono text-sm break-all">{creds.email}</p>
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">Password</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy("pw", creds.password)}>
          {copied === "pw" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <p className="font-mono text-sm">{creds.password}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Create Patient Account
          </DialogTitle>
          <DialogDescription>
            The patient's login email is built from your clinic inbox via plus-addressing, so the verification code lands where you can read it.
          </DialogDescription>
        </DialogHeader>

        {stage === "form" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pt-name">Patient name</Label>
              <Input id="pt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-phone">Phone number</Label>
              <Input id="pt-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" inputMode="numeric" />
              <p className="text-xs text-muted-foreground">
                Login email will be:{" "}
                <span className="font-mono">{plusEmailFor(CLINIC_BASE_EMAIL, phone) || "—"}</span>
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button onClick={handleRegister} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Register & send code
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "otp" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p>
                A verification code was sent to <span className="font-medium">{CLINIC_BASE_EMAIL}</span>. Open that inbox, copy the code, and enter it below to verify the patient.
              </p>
            </div>
            {renderCredsBox()}
            <div className="space-y-2">
              <Label htmlFor="pt-otp">Verification code (OTP)</Label>
              <Input id="pt-otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" inputMode="numeric" />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" size="sm" onClick={handleResend} disabled={busy} className="text-primary">
                Resend code
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
                <Button onClick={handleVerify} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Verify & create
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 p-3 text-sm">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                Account verified for {name.trim()}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                Patient can now sign in with these credentials.
              </p>
            </div>
            {renderCredsBox()}
            <DialogFooter>
              <Button onClick={close} className="w-full">Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}