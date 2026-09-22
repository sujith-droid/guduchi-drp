import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Users, Plus, Trash2, ArrowLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isAdminRole, isPatientRole, isViewerRole } from "@/lib/roles";

export default function OnboardingMessages() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isFullAdmin = isAdminRole(currentUser?.role) || currentUser?.email?.includes("sujith@guduchiayurveda");

  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [onboardingMessages, setOnboardingMessages] = useState([]);
  const [onboardingDoctors, setOnboardingDoctors] = useState([]);
  const [onboardingContent, setOnboardingContent] = useState("");
  const [onboardingSequence, setOnboardingSequence] = useState(1);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  const toggleOnboardingDoctor = (email) => {
    setOnboardingDoctors((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  useEffect(() => {
    if (!currentUser) return;
    if (!isFullAdmin) {
      setLoading(false);
      return;
    }
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      const res = await base44.functions.invoke("adminGetData", { adminToken });
      const d = res.data || res || {};
      setUsers(d.users || []);
      setAssignments(d.assignments || []);
      setOnboardingMessages(d.onboardingMessages || []);
    } catch (e) {
      console.error("Failed to load onboarding data", e);
      toast.error("Failed to load onboarding messages.");
    } finally {
      setLoading(false);
    }
  };

  const doctors = users
    .filter((u) => u.role === "doctor" || isViewerRole(u.role))
    .map((d) => ({ ...d, display_name: d.display_name || d.full_name }));

  const addOnboardingMessage = async () => {
    if (onboardingDoctors.length === 0 || !onboardingContent.trim()) return;
    setSavingOnboarding(true);
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      for (const email of onboardingDoctors) {
        const doctor = doctors.find((d) => d.email === email);
        await base44.functions.invoke("adminAction", {
          adminToken,
          action: "addOnboardingMessage",
          doctorEmail: email,
          doctorName: doctor?.full_name || email,
          content: onboardingContent.trim(),
          sequence: onboardingSequence,
        });
      }
      setOnboardingDoctors([]);
      setOnboardingContent("");
      setOnboardingSequence(1);
      toast.success(`Onboarding message added to ${onboardingDoctors.length} Health Coach(es)!`);
      await loadData();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to add onboarding message.");
    } finally {
      setSavingOnboarding(false);
    }
  };

  const deleteOnboardingMessage = async (id) => {
    try {
      const adminToken = localStorage.getItem("admin_session_token");
      await base44.functions.invoke("adminAction", { adminToken, action: "deleteOnboardingMessage", id });
      setOnboardingMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success("Onboarding message deleted");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to delete onboarding message.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isFullAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <MessageSquareText className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only admins can manage onboarding messages.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to Admin" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <MessageSquareText className="h-6 w-6 text-primary" /> Onboarding Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Per Health Coach</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" /> Onboarding Messages (Per Health Coach)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">These messages are automatically sent to a patient's chat when they are assigned to a Health Coach. Use {"{patient_name}"} and {"{doctor_name}"} as placeholders.</p>
          <div className="space-y-2">
            <div>
              <Label>Health Coaches ({onboardingDoctors.length} selected)</Label>
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                {doctors.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer min-h-[40px]"
                  >
                    <input
                      type="checkbox"
                      checked={onboardingDoctors.includes(d.email)}
                      onChange={() => toggleOnboardingDoctor(d.email)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm">{(d.display_name || d.full_name) ? `${d.display_name || d.full_name} (${d.email})` : d.email}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-1">
                <Button variant="ghost" size="sm" onClick={() => setOnboardingDoctors(doctors.map((d) => d.email))} className="text-xs h-7">
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOnboardingDoctors([])} className="text-xs h-7">
                  Clear
                </Button>
              </div>
            </div>
            <div>
              <Label>Message (Sequence #{onboardingSequence})</Label>
              <Textarea
                placeholder="Type the onboarding message... Use {patient_name} and {doctor_name}"
                value={onboardingContent}
                onChange={(e) => setOnboardingContent(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Sequence #</Label>
              <Input
                type="number"
                min={1}
                value={onboardingSequence}
                onChange={(e) => setOnboardingSequence(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Button
                onClick={addOnboardingMessage}
                disabled={savingOnboarding || onboardingDoctors.length === 0 || !onboardingContent.trim()}
                className="flex-1 gap-2"
              >
                <Plus className="h-4 w-4" /> Add Onboarding Message
              </Button>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const coachUpdates = [
                    { email: "guduchidrp3@gmail.com", fullName: "Vishnu Priya", city: "Bangalore" },
                    { email: "hublidrp@gmail.com", fullName: "Meghashree", city: "Mysore" },
                    { email: "ahmedabaddrp@gmail.com", fullName: "Hetvi", city: "Ahmedabad" },
                    { email: "drp1udupi@gmail.com", fullName: "Jeshlee", city: "Udupi" },
                    { email: "udupidrp3@gmail.com", fullName: "Arshiya", city: "Udupi" },
                    { email: "drp5guduchi@gmail.com", fullName: "Lokeshwari", city: "Gulbarga" },
                    { email: "guduchidrp6@gmail.com", fullName: "Reethu", city: "Bangalore" },
                    { email: "hyd.guduchi@gmail.com", fullName: "Supraja", city: "Hyderabad" },
                    { email: "guduchidrp4@gmail.com", fullName: "Likitha", city: "Bangalore" },
                    { email: "drp1mangalre@gmail.com", fullName: "Angel", city: "Mangalore" },
                  ];
                  const adminToken = localStorage.getItem("admin_session_token");
                  for (const c of coachUpdates) {
                    const doc = doctors.find((d) => d.email === c.email);
                    if (!doc) continue;
                    try {
                      await base44.functions.invoke("adminAction", {
                        adminToken, action: "updateUserName",
                        userId: doc.id, fullName: c.fullName, city: c.city, doctorEmail: c.email,
                      });
                    } catch (e) { console.error("Failed:", c.email, e); }
                  }
                  toast.success("Health Coach names updated!");
                  await loadData();
                }}
                className="gap-2"
              >
                <Users className="h-4 w-4" /> Sync Coach Names
              </Button>
            </div>
          </div>

          {doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No Health Coaches found</p>
          ) : (
            <div className="space-y-4">
              {doctors.map((doc) => {
                const docMessages = onboardingMessages
                  .filter((m) => m.doctor_email === doc.email)
                  .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                if (docMessages.length === 0) return null;
                return (
                  <div key={doc.id} className="space-y-2">
                    <p className="text-sm font-medium text-primary">{doc.display_name || doc.full_name || doc.email}</p>
                    {docMessages.map((m) => (
                      <div key={m.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg gap-3">
                        <div className="flex-1 min-w-0">
                          <Badge variant="secondary" className="text-xs mb-1">#{m.sequence}</Badge>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-wrap">{m.content}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete onboarding message"
                          onClick={() => deleteOnboardingMessage(m.id)}
                          className="text-destructive hover:text-destructive flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })}
              {onboardingMessages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">No onboarding messages configured. Default messages will be used.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}