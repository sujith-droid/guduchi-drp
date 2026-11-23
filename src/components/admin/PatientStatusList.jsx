import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone } from "lucide-react";

/**
 * Dialog listing the patients behind one status card
 * (Improving, Stable, Needs Attention, Inactive, No Data).
 */
export default function PatientStatusList({ status, patients, onClose }) {
  const open = !!status;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{status} Patients ({patients.length})</DialogTitle>
        </DialogHeader>
        {patients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No patients in this group</p>
        ) : (
          <div className="space-y-2">
            {patients.map((p) => (
              <div key={p.email} className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">{p.name || p.email}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
                {p.phone && (
                  <a
                    href={`tel:${p.phone}`}
                    className="text-xs text-primary hover:underline mt-0.5 inline-flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" /> {p.phone}
                  </a>
                )}
                {p.lastLogDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">Last log: {p.lastLogDate}</p>
                )}
                {p.coaches.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Health Coach: {p.coaches.join(", ")}</p>
                )}
                {p.doctors.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Doctor: {p.doctors.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}