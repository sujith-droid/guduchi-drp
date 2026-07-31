import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, AlertCircle, Loader2, QrCode, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export default function JoinDoctor() {
  const urlParams = new URLSearchParams(window.location.search);
  const doctorEmailFromUrl = urlParams.get("doctor");

  // loading | form | done | already | full | error
  const [status, setStatus] = useState(doctorEmailFromUrl ? "loading" : "form");
  const [doctorName, setDoctorName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (doctorEmailFromUrl) {
      handleAssign(doctorEmailFromUrl);
    }
  }, []);

  const handleAssign = async (doctorEmail) => {
    try {
      setDoctorName(doctorEmail);
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      const me = await base44.auth.me();

      // Check existing assignments
      const existing = await base44.entities.PatientDoctorAssignment.filter({
        patient_email: me.email,
        doctor_email: doctorEmail,
        status: "active",
      });

      if (existing.length > 0) {
        setStatus("already");
        return;
      }

      // Check max 3 limit
      const myAssignments = await base44.entities.PatientDoctorAssignment.filter({
        patient_email: me.email,
        status: "active",
      });

      if (myAssignments.length >= 3) {
        setStatus("full");
        return;
      }

      await base44.entities.PatientDoctorAssignment.create({
        patient_email: me.email,
        doctor_email: doctorEmail,
        patient_name: me.full_name || me.email,
        doctor_name: doctorEmail,
        status: "active",
      });

      // Notify doctor of new patient
      await base44.entities.Notification.create({
        user_email: doctorEmail,
        title: "New Patient Joined",
        message: `${me.full_name || me.email} has joined your care via QR code.`,
        type: "info",
        related_patient_email: me.email,
      }).catch(() => {});
      await base44.integrations.Core.SendEmail({
        to: doctorEmail,
        subject: "New Patient Joined Your Care",
        body: `Hello,\n\n${me.full_name || me.email} has scanned your QR code and joined your care on the Guduchi Diabetes Reversal Program.\n\nLog in to your dashboard to view their profile.\n\n— Guduchi Health Team`,
      }).catch(() => {});

      // Send the onboarding welcome chat message (uses doctor's "Welcome" template)
      await base44.functions.invoke("sendWelcomeMessage", {
        data: {
          patient_email: me.email,
          doctor_email: doctorEmail,
          patient_name: me.full_name || me.email,
          doctor_name: doctorEmail,
        },
      }).catch(() => {});

      // Notify patient
      await base44.entities.Notification.create({
        user_email: me.email,
        title: "Welcome to the Program!",
        message: `You have been successfully connected to Dr. ${doctorEmail}. Your diabetes reversal journey begins now!`,
        type: "achievement",
      }).catch(() => {});
      await base44.integrations.Core.SendEmail({
        to: me.email,
        subject: "Welcome to Guduchi Diabetes Reversal Program!",
        body: `Hello ${me.full_name || ""},\n\nYou have been successfully connected to Dr. ${doctorEmail}.\n\nStart logging your daily health metrics and track your progress toward reversing diabetes!\n\n— Guduchi Health Team`,
      }).catch(() => {});

      setStatus("done");
    } catch (e) {
      setStatus("error");
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const email = manualEmail.trim();
    if (!email) return;
    setSubmitting(true);
    handleAssign(email);
  };

  const goHome = () => { window.location.href = "/"; };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="bg-card border border-border rounded-2xl shadow-lg p-8 max-w-sm w-full flex flex-col items-center gap-5 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="font-heading font-semibold text-lg">Connecting you to your doctor…</p>
          </>
        )}

        {status === "form" && (
          <>
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-heading font-bold text-xl">Link to Your Doctor</p>
              <p className="text-sm text-muted-foreground mt-1">
                Scan your doctor's QR code with your phone camera, or enter their email below to connect.
              </p>
            </div>
            <form onSubmit={handleManualSubmit} className="w-full space-y-3 text-left">
              <div>
                <Label>Doctor's Email</Label>
                <Input
                  type="email"
                  placeholder="doctor@example.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={submitting || !manualEmail.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {submitting ? "Connecting…" : "Connect to Doctor"}
              </Button>
            </form>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to Dashboard</Link>
          </>
        )}

        {status === "done" && (
          <>
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <p className="font-heading font-bold text-xl text-emerald-700">You're connected!</p>
            <p className="text-sm text-muted-foreground">You have been successfully assigned to Dr. {doctorName}.</p>
            <Button className="w-full" onClick={goHome}>Go to Dashboard</Button>
          </>
        )}

        {status === "already" && (
          <>
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-blue-500" />
            </div>
            <p className="font-heading font-bold text-xl">Already Connected</p>
            <p className="text-sm text-muted-foreground">You are already assigned to Dr. {doctorName}.</p>
            <Button className="w-full" onClick={goHome}>Go to Dashboard</Button>
          </>
        )}

        {status === "full" && (
          <>
            <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-orange-500" />
            </div>
            <p className="font-heading font-bold text-xl">Limit Reached</p>
            <p className="text-sm text-muted-foreground">You can only be assigned to a maximum of 3 doctors.</p>
            <Button className="w-full" onClick={goHome}>Go to Dashboard</Button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <p className="font-heading font-bold text-xl">Something went wrong</p>
            <p className="text-sm text-muted-foreground">We couldn't connect you. Please check the email and try again.</p>
            <div className="w-full flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={() => { setStatus("form"); setSubmitting(false); }}>Try Again</Button>
              <Button className="w-full" onClick={goHome}>Go to Dashboard</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}