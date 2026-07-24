import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, UserPlus, Link2, Trash2, FileText, Plus, QrCode, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState as useQrState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [templates, setTemplates] = useState([]);
  const [newTplName, setNewTplName] = useState("");
  const [newTplContent, setNewTplContent] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [qrDoctor, setQrDoctor] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleteUserName, setDeleteUserName] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then((me) => {
      setCurrentUser(me);
      if (me.role !== "admin" && !me.email?.includes("sujith@guduchiayurveda")) {
        setLoading(false);
        return;
      }
      loadData();
    });
  }, []);

  const [loadError, setLoadError] = useState(false);

  const loadData = async () => {
    try {
      setLoadError(false);
      const { data } = await base44.functions.invoke("listUsers", {});
      setUsers(data.users || []);
      const allAssignments = await base44.entities.PatientDoctorAssignment.filter({ status: "active" });
      setAssignments(allAssignments);
      const tmpl = await base44.entities.MessageTemplate.list('-created_date', 100);
      setTemplates(tmpl);
    } catch (e) {
      console.error("Failed to load admin data", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const doctors = users.filter((u) => u.role === "doctor");
  const patients = users.filter((u) => u.role === "patient");

  const assignPatient = async () => {
    if (!selectedPatient || !selectedDoctor) return;
    const patientAssignments = assignments.filter((a) => a.patient_email === selectedPatient);
    if (patientAssignments.length >= 3) {
      toast.error("A patient can only be assigned to a maximum of 3 doctors.");
      return;
    }
    const alreadyAssigned = patientAssignments.some((a) => a.doctor_email === selectedDoctor);
    if (alreadyAssigned) {
      toast.error("This patient is already assigned to this doctor.");
      return;
    }
    const patient = users.find((u) => u.email === selectedPatient);
    const doctor = users.find((u) => u.email === selectedDoctor);
    await base44.entities.PatientDoctorAssignment.create({
      patient_email: selectedPatient,
      doctor_email: selectedDoctor,
      patient_name: patient?.full_name || selectedPatient,
      doctor_name: doctor?.full_name || selectedDoctor,
      status: "active",
    });

    // Notify doctor
    await base44.entities.Notification.create({
      user_email: selectedDoctor,
      title: "New Patient Assigned",
      message: `${patient?.full_name || selectedPatient} has been assigned to you by the admin.`,
      type: "info",
      related_patient_email: selectedPatient,
    });
    // Notify patient
    await base44.entities.Notification.create({
      user_email: selectedPatient,
      title: "Doctor Assigned",
      message: `Dr. ${doctor?.full_name || selectedDoctor} has been assigned as your doctor.`,
      type: "info",
    });

    toast.success("Patient assigned to doctor!");
    setAssignDialog(false);
    setSelectedPatient("");
    setSelectedDoctor("");
    loadData();
  };

  const addTemplate = async () => {
    if (!newTplName.trim() || !newTplContent.trim()) return;
    setSavingTpl(true);
    await base44.entities.MessageTemplate.create({
      name: newTplName.trim(),
      content: newTplContent.trim(),
    });
    setNewTplName("");
    setNewTplContent("");
    setSavingTpl(false);
    toast.success("Template added!");
    const tmpl = await base44.entities.MessageTemplate.list('-created_date', 100);
    setTemplates(tmpl);
  };

  const deleteTemplate = async (id) => {
    await base44.entities.MessageTemplate.delete(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template deleted");
  };

  const changeUserRole = async (userId, newRole) => {
    await base44.functions.invoke("updateUserRole", { userId, newRole });
    toast.success(`Role updated to ${newRole}`);
    loadData();
  };

  const deleteUser = async () => {
    if (!deleteUserId) return;
    await base44.functions.invoke("deleteUser", { userId: deleteUserId });
    toast.success("User deleted successfully");
    setDeleteUserId(null);
    setDeleteUserName("");
    loadData();
  };

  const removeAssignment = async (id) => {
    await base44.entities.PatientDoctorAssignment.update(id, { status: "inactive" });
    toast.success("Assignment removed");
    loadData();
  };

  const updateProgram = async (id, program_duration) => {
    await base44.entities.PatientDoctorAssignment.update(id, { program_duration });
    toast.success("Program updated");
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (currentUser?.role !== "admin" && !currentUser?.email?.includes("sujith@guduchiayurveda")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Shield className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only the admin can access this panel.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Shield className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="font-semibold">Couldn't load admin data</p>
        <p className="text-sm text-muted-foreground">Your session may have expired. Please refresh or log in again.</p>
        <Button variant="outline" onClick={loadData}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Admin Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage users and assignments</p>
        </div>
        <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Link2 className="h-4 w-4" /> Assign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Patient to Doctor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Patient</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.email} value={p.email}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Doctor</Label>
                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select doctor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.email} value={d.email}>
                        {d.full_name || d.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={assignPatient} className="w-full" disabled={!selectedPatient || !selectedDoctor}>
                Assign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold font-heading">{patients.length}</p>
            <p className="text-xs text-muted-foreground">Patients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <UserPlus className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold font-heading">{doctors.length}</p>
            <p className="text-xs text-muted-foreground">Doctors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Link2 className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold font-heading">{assignments.length}</p>
            <p className="text-xs text-muted-foreground">Assignments</p>
          </CardContent>
        </Card>
      </div>

      {/* Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No assignments yet</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{a.patient_name || a.patient_email}</p>
                      <p className="text-xs text-muted-foreground">→ Dr. {a.doctor_name || a.doctor_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={a.program_duration || ""}
                      onValueChange={(val) => updateProgram(a.id, val)}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue placeholder="Program" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 month">1 Month</SelectItem>
                        <SelectItem value="3 months">3 Months</SelectItem>
                        <SelectItem value="6 months">6 Months</SelectItem>
                        <SelectItem value="9 months">9 Months</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAssignment(a.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Doctor QR Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" /> Doctor QR Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Share a doctor's QR code — patients scan it to auto-assign themselves.</p>
          <div className="space-y-2">
            {doctors.map((doc) => {
              const joinUrl = `${window.location.origin}/join?doctor=${encodeURIComponent(doc.email)}`;
              return (
                <div key={doc.id} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-sm">{doc.full_name || doc.email}</p>
                      <p className="text-xs text-muted-foreground">{doc.email}</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setQrDoctor(qrDoctor?.id === doc.id ? null : doc)}>
                      <QrCode className="h-3 w-3" /> {qrDoctor?.id === doc.id ? "Hide" : "Show QR"}
                    </Button>
                  </div>
                  {qrDoctor?.id === doc.id && (
                    <div className="flex flex-col items-center gap-3 pt-3 border-t border-border">
                      <QRCodeSVG value={joinUrl} size={180} includeMargin />
                      <p className="text-xs text-muted-foreground text-center break-all">{joinUrl}</p>
                      <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => navigator.clipboard.writeText(joinUrl)}>
                        Copy Link
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {doctors.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No doctors registered yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Message Templates (Doctors Only)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input placeholder="Template name..." value={newTplName} onChange={(e) => setNewTplName(e.target.value)} />
            <Textarea placeholder="Template message content..." value={newTplContent} onChange={(e) => setNewTplContent(e.target.value)} rows={3} />
            <Button onClick={addTemplate} disabled={savingTpl || !newTplName.trim() || !newTplContent.trim()} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Add Template
            </Button>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No templates yet</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.content}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteTemplate(t.id)} className="text-destructive hover:text-destructive flex-shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users — Manage Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{u.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role || "patient"}
                    onValueChange={(val) => changeUserRole(u.id, val)}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-7 w-7"
                    onClick={() => { setDeleteUserId(u.id); setDeleteUserName(u.full_name || u.email); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => { if (!open) { setDeleteUserId(null); setDeleteUserName(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteUserName}</strong>? This action cannot be undone and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteUserId(null); setDeleteUserName(""); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}