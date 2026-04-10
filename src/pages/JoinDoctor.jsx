import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JoinDoctor() {
  const urlParams = new URLSearchParams(window.location.search);
  const doctorEmail = urlParams.get("doctor");

  const [status, setStatus] = useState("loading"); // loading | already | done | error
  const [doctorName, setDoctorName] = useState("");

  useEffect(() => {
    if (!doctorEmail) { setStatus("error"); return; }
    handleAssign();
  }, []);

  const handleAssign = async () => {
    try {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      const me = await base44.auth.me();

      // Find doctor info from assignments or use email directly
      setDoctorName(doctorEmail);

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

      setStatus("done");
    } catch (e) {
      setStatus("error");
    }
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
            <p className="text-sm text-muted-foreground">Invalid link or you are not logged in.</p>
            <Button className="w-full" onClick={goHome}>Go to Dashboard</Button>
          </>
        )}
      </div>
    </div>
  );
}