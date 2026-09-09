import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Send, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";

export default function BulkMessageModal({ open, onClose, patients, doctorEmail }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      const adminToken = localStorage.getItem("admin_session_token");
      base44.functions.invoke("doctorApi", { adminToken, action: "getTemplates" })
        .then((res) => setTemplates((res.data || res).templates || []))
        .catch(() => setTemplates([]));
      setSelectedPatients([]);
      setSelectedTemplate(null);
    }
  }, [open]);

  const togglePatient = (email) => {
    setSelectedPatients((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const selectAll = () => {
    if (selectedPatients.length === patients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(patients.map((p) => p.patient_email));
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate || selectedPatients.length === 0) return;
    setSending(true);
    await Promise.all(
      selectedPatients.map((patientEmail) => {
        const convId = [patientEmail, doctorEmail].sort().join("_");
        return base44.entities.ChatMessage.create({
          sender_email: doctorEmail,
          receiver_email: patientEmail,
          conversation_id: convId,
          message: selectedTemplate.content,
          message_type: "text",
        });
      })
    );
    setSending(false);
    toast.success(`Message sent to ${selectedPatients.length} patient(s)!`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Message Patients</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Template Selection */}
          <div>
            <p className="text-sm font-medium mb-2">Select Template</p>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates available. Create them in the Admin Panel.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedTemplate?.id === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="font-medium text-xs">{t.name}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{t.content}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Patient Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Select Patients</p>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={selectAll}>
                {selectedPatients.length === patients.length ? <Square className="h-3 w-3" /> : <CheckSquare className="h-3 w-3" />}
                {selectedPatients.length === patients.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {patients.map((p) => (
                <div
                  key={p.patient_email}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => togglePatient(p.patient_email)}
                >
                  <Checkbox
                    checked={selectedPatients.includes(p.patient_email)}
                    onCheckedChange={() => togglePatient(p.patient_email)}
                  />
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    {(p.patient_name || p.patient_email)[0]?.toUpperCase()}
                  </div>
                  <Label className="text-sm cursor-pointer flex-1">{p.patient_name || p.patient_email}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {selectedTemplate && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Preview</p>
              <p className="text-sm">{selectedTemplate.content}</p>
            </div>
          )}

          <Button
            className="w-full gap-2"
            onClick={handleSend}
            disabled={sending || !selectedTemplate || selectedPatients.length === 0}
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending..." : `Send to ${selectedPatients.length} Patient${selectedPatients.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}