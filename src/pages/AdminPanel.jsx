import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const ADMIN_EMAIL = "sujith@guduchiayurveda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, UserPlus, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then((me) => {
      setCurrentUser(me);
      if (!me.email?.includes(ADMIN_EMAIL)) {
        setLoading(false);
        return;
      }
      loadData();
    });
  }, []);

  const loadData = async () => {
    const allUsers = await base44.entities.User.list("-created_date", 200);
    setUsers(allUsers);
    const allAssignments = await base44.entities.PatientDoctorAssignment.filter({ status: "active" });
    setAssignments(allAssignments);
    setLoading(false);
  };

  const doctors = users.filter((u) => u.role === "doctor");
  const patients = users.filter((u) => u.role === "patient");

  const assignPatient = async () => {
    if (!selectedPatient || !selectedDoctor) return;
    const patient = users.find((u) => u.email === selectedPatient);
    const doctor = users.find((u) => u.email === selectedDoctor);

    await base44.entities.PatientDoctorAssignment.create({
      patient_email: selectedPatient,
      doctor_email: selectedDoctor,
      patient_name: patient?.full_name || selectedPatient,
      doctor_name: doctor?.full_name || selectedDoctor,
      status: "active",
    });

    toast.success("Patient assigned to doctor!");
    setAssignDialog(false);
    setSelectedPatient("");
    setSelectedDoctor("");
    loadData();
  };

  const changeUserRole = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    toast.success(`Role updated to ${newRole}`);
    loadData();
  };

  const removeAssignment = async (id) => {
    await base44.entities.PatientDoctorAssignment.update(id, { status: "inactive" });
    toast.success("Assignment removed");
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser?.email?.includes(ADMIN_EMAIL)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Shield className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only the admin can access this panel.</p>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAssignment(a.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}