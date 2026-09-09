import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Save, QrCode, Stethoscope, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [branch, setBranch] = useState("");
  const [assignedDoctors, setAssignedDoctors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;
    setPhone(user.phone || "");
    setAge(user.age ? String(user.age) : "");
    setGender(user.gender || "");
    setAddress(user.address || "");
    setBranch(user.branch || "");
    if (user.role === "patient") {
      base44.entities.PatientDoctorAssignment.filter({ patient_email: user.email, status: "active" })
        .then(setAssignedDoctors)
        .catch(() => {});
    }
    setLoading(false);
  }, [user]);

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      // Delete all user data
      await Promise.all([
        base44.entities.DailyLog.filter({ patient_email: user.email }).then(async (records) => {
          for (const r of records) await base44.entities.DailyLog.delete(r.id);
        }),
        base44.entities.HbA1cRecord.filter({ patient_email: user.email }).then(async (records) => {
          for (const r of records) await base44.entities.HbA1cRecord.delete(r.id);
        }),
        base44.entities.PatientDoctorAssignment.filter({ patient_email: user.email }).then(async (records) => {
          for (const r of records) await base44.entities.PatientDoctorAssignment.delete(r.id);
        }),
        base44.entities.PatientDoctorAssignment.filter({ doctor_email: user.email }).then(async (records) => {
          for (const r of records) await base44.entities.PatientDoctorAssignment.delete(r.id);
        }),
        base44.entities.ChatMessage.filter({ sender_email: user.email }).then(async (records) => {
          for (const r of records) await base44.entities.ChatMessage.delete(r.id);
        }),
        base44.entities.Notification.filter({ user_email: user.email }).then(async (records) => {
          for (const r of records) await base44.entities.Notification.delete(r.id);
        }),
      ]);
      // Notify admin
      await base44.integrations.Core.SendEmail({
        to: "sujith@guduchiayurveda.com",
        subject: "Account Deletion Request",
        body: `User ${user.full_name || ""} (${user.email}) has deleted all their health data and is requesting complete account removal. Please remove their login account from the system.`,
      });
      toast.success("Your data has been deleted and a removal request has been sent to the administrator.", { duration: 6000 });
    } catch (e) {
      toast.error("Failed to delete account data. Please try again.");
    }
    setDeletingAccount(false);
  };

  const handleSave = async () => {
    if (!phone.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke("updateProfile", {
        email: user.email,
        phone: phone.trim(),
        address: address.trim(),
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        branch: branch || undefined,
      });
      toast.success("Profile updated!");
    } catch (e) {
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const roleLabel = user?.role === "doctor" ? "Doctor" : user?.role === "admin" ? "Admin" : "Patient";

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <User className="h-6 w-6" /> My Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information</p>
      </motion.div>

      {/* Identity Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {user?.full_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-lg font-semibold font-heading">{user?.full_name || "User"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize">{roleLabel}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* QR Code for Doctors */}
      {user?.role === "doctor" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" /> Your Patient Join QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <p className="text-xs text-muted-foreground text-center">Patients scan this QR to get automatically assigned to you.</p>
            <QRCodeSVG
              value={`${window.location.origin}/join?doctor=${encodeURIComponent(user.email)}`}
              size={200}
              includeMargin
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join?doctor=${encodeURIComponent(user.email)}`)}
            >
              Copy Link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Editable Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> Contact & Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Mobile Number <span className="text-destructive">*</span></Label>
            <Input
              type="tel"
              placeholder="e.g., +91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {user?.role === "doctor"
                ? "Patients will use this number to call you directly."
                : "Your doctor will use this number to call you directly."}
            </p>
          </div>

          <div>
            <Label>Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              type="text"
              placeholder="e.g., 12 MG Road, Chennai"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Age <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              type="number"
              placeholder="e.g., 45"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1"
            />
          </div>

          {user?.role === "doctor" && (
            <div>
              <Label>Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select branch..." />
                </SelectTrigger>
                <SelectContent>
                  {["Bengaluru", "Udupi", "Hyderabad", "Chennai", "Kolkata", "Hubballi", "Kalaburgi", "Ahmedabad"].map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Gender <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignedDoctors.some((a) => a.patient_id) && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-muted-foreground">Patient ID</p>
              <p className="font-mono font-semibold text-sm text-primary">{assignedDoctors.find((a) => a.patient_id)?.patient_id}</p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> Delete Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This will permanently delete all your health data, logs, and messages. A deletion request will also be automatically sent to the administrator to remove your login account.
          </p>
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-xs text-destructive space-y-1">
            <p className="font-semibold">What gets deleted immediately:</p>
            <ul className="list-disc list-inside space-y-0.5 text-destructive/80">
              <li>All daily health logs</li>
              <li>HbA1c records</li>
              <li>Chat messages</li>
              <li>Doctor assignments</li>
            </ul>
            <p className="font-semibold mt-2">What requires admin action:</p>
            <p className="text-destructive/80">Your login account — the administrator will be notified automatically.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={deletingAccount}>
                {deletingAccount ? "Deleting & Notifying Admin..." : "Delete My Account Data"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your health logs, HbA1c records, chat messages, and doctor assignments — and send a deletion request to the administrator. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                  Yes, delete & notify admin
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Assigned Doctors (patients only) */}
      {user?.role === "patient" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" /> Assigned Doctors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignedDoctors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No doctors assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {assignedDoctors.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                      {(a.doctor_name || a.doctor_email)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Dr. {a.doctor_name || a.doctor_email}</p>
                      <p className="text-xs text-muted-foreground">{a.doctor_email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}