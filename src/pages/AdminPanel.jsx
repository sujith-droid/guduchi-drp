import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MobileSelect from "@/components/MobileSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, UserPlus, Link2, Trash2, FileText, Plus, MessageSquareText, Phone, Search, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isPatientRole, isAdminRole, isSubadminRole, isAdminOrSubadmin, isViewerRole } from "@/lib/roles";

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
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleteUserName, setDeleteUserName] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const { user: currentUser } = useAuth();

  const isSubadmin = isSubadminRole(currentUser?.role);
  const isFullAdmin = isAdminRole(currentUser?.role) || currentUser?.email?.includes("sujith@guduchiayurveda");

  useEffect(() => {
    if (!currentUser) return;
    if (!isFullAdmin && !isSubadmin) {
      setLoading(false);
      return;
    }
    loadData();
  }, [currentUser]);

  const [loadError, setLoadError] = useState(false);

  const loadData = async () => {
    try {
      setLoadError(false);
      const adminToken = localStorage.getItem("admin_session_token");
      const res = await base44.functions.invoke("adminGetData", { adminToken });
      const d = res.data || res || {};
      setUsers(d.users || []);
      setAssignments(d.assignments || []);
      setTemplates(d.templates || []);
    } catch (e) {
      console.error("Failed to load admin data", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const doctors = users.filter((u) => u.role === "doctor" || isViewerRole(u.role)).map((d) => ({ ...d, display_name: d.display_name || d.full_name }));
  const patients = users.filter((u) => isPatientRole(u.role));
  const unassignedPatients = patients.filter((p) => !assignments.some((a) => a.patient_email === p.email));

  const filteredUsers = userSearch.trim()
    ? users.filter((u) => {
        const q = userSearch.toLowerCase().trim();
        return (
          (u.email || "").toLowerCase().includes(q) ||
          (u.full_name || "").toLowerCase().includes(q) ||
          (u.display_name || "").toLowerCase().includes(q) ||
          (u.phone || "").toLowerCase().includes(q)
        );
      })
    : users;

  const assignPatient = async () => {
    if (!selectedPatient || !selectedDoctor) return;
    const patientAssignments = assignments.filter((a) => a.patient_email === selectedPatient);
    if (patientAssignments.length >= 3) {
      toast.error("A patient can only be assigned to a maximum of 3 Health Coaches.");
      return;
    }
    const alreadyAssigned = patientAssignments.some((a) => a.doctor_email === selectedDoctor);
    if (alreadyAssigned) {
      toast.error("This patient is already assigned to this Health Coach.");
      return;
    }
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      const res = await base44.functions.invoke("adminAction", {
        adminToken, action: "assign",
        patientEmail: selectedPatient, doctorEmail: selectedDoctor,
      });
      const data = res.data || res;
      if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success("Patient assigned to Health Coach!");
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Failed to assign.");
      return;
    }
    setAssignDialog(false);
    setSelectedPatient("");
    setSelectedDoctor("");
    loadData();
  };

  const addTemplate = async () => {
    if (!newTplName.trim() || !newTplContent.trim()) return;
    setSavingTpl(true);
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      await base44.functions.invoke("adminAction", {
        adminToken, action: "addTemplate",
        name: newTplName.trim(), content: newTplContent.trim(),
      });
      setNewTplName("");
      setNewTplContent("");
      toast.success("Template added!");
      await loadData();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to add template.");
    } finally {
      setSavingTpl(false);
    }
  };

  const deleteTemplate = async (id) => {
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      await base44.functions.invoke("adminAction", { adminToken, action: "deleteTemplate", id });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to delete template.");
    }
  };

  const changeUserRole = async (userId, newRole) => {
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      await base44.functions.invoke("adminAction", { adminToken, action: "updateRole", userId, newRole });
      toast.success(`Role updated to ${newRole}`);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to update role.");
    }
  };

  const deleteUser = async () => {
    if (!deleteUserId) return;
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      await base44.functions.invoke("adminAction", { adminToken, action: "deleteUser", userId: deleteUserId });
      toast.success("User deleted successfully");
      setDeleteUserId(null);
      setDeleteUserName("");
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to delete user.");
    }
  };

  const removeAssignment = async (id) => {
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      await base44.functions.invoke("adminAction", { adminToken, action: "removeAssignment", id });
      toast.success("Assignment removed");
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to remove assignment.");
    }
  };

  const updateProgram = async (id, program_duration) => {
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      await base44.functions.invoke("adminAction", { adminToken, action: "updateProgram", id, program_duration });
      toast.success("Program updated");
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to update program.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isFullAdmin && !isSubadmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Shield className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only admins can access this panel.</p>
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
            <Button className="gap-2" aria-label="Assign patient to Health Coach">
              <Link2 className="h-4 w-4" /> Assign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Patient to Health Coach</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Patient</Label>
                <MobileSelect
                  value={selectedPatient}
                  onValueChange={setSelectedPatient}
                  options={patients.map((p) => ({ value: p.email, label: p.phone ? `${p.display_name || p.full_name || p.email} (${p.phone})` : (p.display_name || p.full_name || p.email) }))}
                  placeholder="Select patient..."
                  triggerClassName="mt-1"
                />
              </div>
              <div>
                <Label>Health Coach</Label>
                <MobileSelect
                  value={selectedDoctor}
                  onValueChange={setSelectedDoctor}
                  options={doctors.map((d) => ({ value: d.email, label: d.full_name || d.email }))}
                  placeholder="Select Health Coach..."
                  triggerClassName="mt-1"
                />
              </div>
              <Button onClick={assignPatient} className="w-full" disabled={!selectedPatient || !selectedDoctor}>
                Assign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <p className="text-xs text-muted-foreground">Health Coaches</p>
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

      {/* Unassigned Patients */}
      {unassignedPatients.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Unassigned Patients ({unassignedPatients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {unassignedPatients.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium">{p.display_name || p.full_name || p.email}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="text-xs text-primary hover:underline mt-0.5 inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {p.phone}
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  className="gap-2"
                  aria-label={`Assign ${p.display_name || p.full_name || p.email} to a Health Coach`}
                  onClick={() => {
                    setSelectedPatient(p.email);
                    setSelectedDoctor("");
                    setAssignDialog(true);
                  }}
                >
                  <Link2 className="h-4 w-4" /> Assign
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
      )}

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
                      <p className="text-xs text-muted-foreground">→ {a.doctor_name || a.doctor_email}</p>
                      {(() => {
                        const pt = users.find((u) => u.email === a.patient_email);
                        const phone = pt?.phone;
                        return phone ? (
                          <a href={`tel:${phone}`} className="text-xs text-primary hover:underline mt-0.5 inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {phone}
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isFullAdmin && (
                    <>
                    <MobileSelect
                      value={a.program_duration || ""}
                      onValueChange={(val) => updateProgram(a.id, val)}
                      options={[
                        { value: "1 month", label: "1 Month" },
                        { value: "3 months", label: "3 Months" },
                        { value: "6 months", label: "6 Months" },
                        { value: "9 months", label: "9 Months" },
                      ]}
                      placeholder="Program"
                      triggerClassName="w-28 h-7 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove assignment"
                      onClick={() => removeAssignment(a.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Templates — full admin only */}
      {isFullAdmin && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Message Templates (Health Coaches Only)
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
                  <Button variant="ghost" size="icon" aria-label="Delete template" onClick={() => deleteTemplate(t.id)} className="text-destructive hover:text-destructive flex-shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Coach-wise Patients List link */}
      <Card>
        <CardContent className="p-4">
          <Link to="/coach-patients" className="flex items-center justify-between w-full" aria-label="View patients by Health Coach">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Patients by Health Coach</p>
                <p className="text-xs text-muted-foreground">View patients assigned to each coach</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Onboarding Messages link — full admin only */}
      {isFullAdmin && (
      <Card>
        <CardContent className="p-4">
          <Link to="/onboarding-messages" className="flex items-center justify-between w-full" aria-label="Manage Onboarding Messages">
            <div className="flex items-center gap-3">
              <MessageSquareText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Onboarding Messages</p>
                <p className="text-xs text-muted-foreground">Per Health Coach</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
      )}

        {/* Users List — full admin only */}
        {isFullAdmin && (
        <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users — Manage Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {filteredUsers.length === 0 && userSearch.trim() ? (
            <p className="text-sm text-muted-foreground text-center py-6">No users match "{userSearch}"</p>
          ) : (
          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{u.display_name || u.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {u.phone && (
                    <a href={`tel:${u.phone}`} className="text-xs text-primary hover:underline mt-0.5 inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {u.phone}
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Joined: {u.created_date ? new Date(u.created_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <MobileSelect
                    value={isPatientRole(u.role) ? "patient" : (isViewerRole(u.role) ? "viewer" : u.role)}
                    onValueChange={(val) => changeUserRole(u.id, val)}
                    options={[
                      { value: "patient", label: "Patient" },
                      { value: "doctor", label: "Health Coach" },
                      { value: "viewer", label: "Doctor" },
                      { value: "subadmin", label: "Subadmin" },
                      { value: "admin", label: "Admin" },
                    ]}
                    placeholder="Select role"
                    triggerClassName="w-28 h-7 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete user"
                    className="text-destructive hover:text-destructive h-7 w-7"
                    onClick={() => { setDeleteUserId(u.id); setDeleteUserName(u.full_name || u.email); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            </div>
            )}
            </CardContent>
            </Card>
            )}

            {/* Delete User Confirmation — full admin only */}
      {isFullAdmin && (
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
      )}
    </div>
  );
}