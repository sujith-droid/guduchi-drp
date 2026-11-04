import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Check } from "lucide-react";
import MobileSelect from "@/components/MobileSelect";
import { invokeFunction } from "@/lib/invokeFunction";
import { toast } from "sonner";

/**
 * Lets a Health Coach assign a patient to a doctor (Health Coach).
 * Loads patients/doctors on open and posts through doctorApi "assignPatient",
 * which applies the same rules as the admin panel assignment.
 */
export default function AssignPatientDialog({ open, onClose, onAssigned }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const adminToken = localStorage.getItem("admin_session_token");
        const data = await invokeFunction("doctorApi", { adminToken, action: "getAssignOptions" });
        if (cancelled) return;
        setDoctors(data.doctors || []);
        setPatients(data.patients || []);
        setAssignments(data.assignments || []);
      } catch (e) {
        toast.error(e?.message || "Couldn't load patients. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const coachesFor = (email) => assignments.filter((a) => a.patient_email === email);

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

  const handleAssign = async () => {
    if (!selectedPatient || !selectedDoctor) return;
    setSaving(true);
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      const data = await invokeFunction("doctorApi", {
        adminToken,
        action: "assignPatient",
        patientEmail: selectedPatient,
        doctorEmail: selectedDoctor,
      });
      if (data?.warning) toast.warning(data.warning);
      else toast.success("Patient assigned to doctor.");
      setSelectedPatient("");
      setSelectedDoctor("");
      setSearch("");
      onAssigned?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Failed to assign patient.");
    } finally {
      setSaving(false);
    }
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
                                    {doctors.find((d) => d.email === c.doctor_email)?.name || c.doctor_email}
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

          <div>
            <Label>Assign to doctor</Label>
            <MobileSelect
              value={selectedDoctor}
              onValueChange={setSelectedDoctor}
              options={doctors.map((d) => ({ value: d.email, label: d.name }))}
              placeholder="Select doctor..."
              triggerClassName="mt-1"
            />
          </div>

          <Button onClick={handleAssign} className="w-full gap-2" disabled={!selectedPatient || !selectedDoctor || saving}>
            <Check className="h-4 w-4" /> {saving ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}