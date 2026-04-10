import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Save, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then((me) => {
      setUser(me);
      setPhone(me.phone || "");
      setAge(me.age ? String(me.age) : "");
      setGender(me.gender || "");
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!phone.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    setSaving(true);
    await base44.auth.updateMe({
      phone: phone.trim(),
      age: age ? Number(age) : undefined,
      gender: gender || undefined,
    });
    toast.success("Profile updated!");
    setSaving(false);
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
            <Label>Age <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              type="number"
              placeholder="e.g., 45"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1"
            />
          </div>

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

          {user?.patient_id && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Patient ID</p>
              <p className="font-mono font-semibold text-sm">{user.patient_id}</p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}