import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Check } from "lucide-react";
import MobileSelect from "@/components/MobileSelect";
import { invokeFunction } from "@/lib/invokeFunction";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

/**
 * Lets a Health Coach assign a patient to a Health Coach and/or a read-only Doctor.
 * Loads patients/staff on open and posts through doctorApi "assignPatient",
 * which applies the same rules as the admin panel assignment.
 */
export default function AssignPatientDialog({ open, onClose, onAssigned }) {
  const { user } = useAuth();
  // A Health Coach always assigns to themselves, so the coach picker is only
  // shown to admins. Doctors (viewers) are read-only and never see this dialog.
  const isCoach = user?.role === "doctor";
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coaches, setCoaches] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedCoach, setSelectedCoach] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");

  useEffect(() => {
    if (!open) return;
    if (isCoach && user?.email) setSelectedCoach(user.email);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const adminToken = localStorage.getItem("admin_session_token");
        const data = await invokeFunction("doctorApi", { adminToken, action: "getAssignOptions" });
        if (cancelled) return;
        setCoaches(data.coaches || []);
        setDoctors(data.doctors || []);
        setPatients(data.patients || []);
        setAssignments(data.assignments || []);
      } catch (e) {
        toast.error(
          e?.status === 401
            ? "Your session has expired. Please log in again."
            : e?.message || "Couldn't load patients. Please try again."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, isCoach, user?.email]);

  const coachesFor = (email) => assignments.filter((a) => a.patient_email === email);

  const staffName = (email) =>
    coaches.find((c) => c.email === email)?.name ||
    doctors.find((d) => d.email === email)?.name ||
    email;

  // Show which staff type each person is, so a Doctor is never mistaken for a Health Coach.
  const staffLabel = (email) => {
    if (coaches.some((c) => c.email === email)) return `${staffName(email)} · Health Coach`;
    if (doctors.some((d) => d.email === email)) return `${staffName(email)} · Doctor`;
    return email;
  };

  const query = search.trim().toLowerCase();
  const matches = !query
    ? []
    : patients
        .filter((p) =>
          p.name.toLowerCase().includes(query) ||
          p.email.toLowerCase().includes(query) ||
          (p.phone || "").toLowerCase().includes(query)
        )
        .slice(0, 8);

  const selectedPatientObj = patients.find((p) => p.email === selectedPatient);

  const targets = [selectedCoach, selectedDoctor].filter(Boolean);

  const handleAssign = async () => {
    if (!selectedPatient || targets.length === 0) return;
    setSaving(true);
    const adminToken = localStorage.getItem("admin_session_token");
    const failures = [];
    let warning = "";
    for (const email of targets) {
      try {
        const data = await invokeFunction("doctorApi", {
          adminToken,
          action: "assignPatient",
          patientEmail: selectedPatient,
          doctorEmail: email,
        });
        if (data?.warning) warning = data.warning;
      } catch (e) {
        failures.push(`${staffLabel(email)}: ${e?.message || "failed"}`);
      }
    }
    setSaving(false);
    if (failures.length > 0) {
      toast.error(failures.join(" · "));
      return;
    }
    if (warning) toast.warning(warning);
    else toast.success(targets.length > 1 ? "Patient assigned to Health Coach and Doctor." : "Patient assigned.");
    setSelectedPatient("");
    setSelectedCoach("");
    setSelectedDoctor("");
    setSearch("");
    onAssigned?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Patient to Doctor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Patient</Label>
            {selectedPatientObj ? (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedPatientObj.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedPatientObj.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPatient("")}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder={loading ? "Loading patients..." : "Search by name, email or phone"}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {query && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {matches.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No patient found.</p>
                    ) : (
                      matches.map((p) => {
                        const coaches = coachesFor(p.email);
                        return (
                          <button
                            key={p.email}
                            type="button"
                            onClick={() => { setSelectedPatient(p.email); setSearch(""); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors min-h-[44px]"
                          >
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                            {coaches.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {coaches.map((c) => (
                                  <Badge key={c.doctor_email} variant="outline" className="text-xs">
                                    {staffLabel(c.doctor_email)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!isCoach && (
            <div>
              <Label>Health Coach</Label>
              <MobileSelect
                value={selectedCoach}
                onValueChange={setSelectedCoach}
                options={coaches.map((c) => ({ value: c.email, label: c.name }))}
                placeholder="Select Health Coach..."
                triggerClassName="mt-1"
              />
            </div>
          )}

          <div>
            <Label>Doctor (read-only)</Label>
            <MobileSelect
              value={selectedDoctor}
              onValueChange={setSelectedDoctor}
              options={doctors.map((d) => ({ value: d.email, label: d.name }))}
              placeholder="Select doctor..."
              triggerClassName="mt-1"
            />
          </div>

          {isCoach && (
            <p className="text-xs text-muted-foreground">
              The patient is added to your own list. You can also share them with a doctor.
            </p>
          )}

          <Button onClick={handleAssign} className="w-full gap-2" disabled={!selectedPatient || targets.length === 0 || saving}>
            <Check className="h-4 w-4" /> {saving ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}