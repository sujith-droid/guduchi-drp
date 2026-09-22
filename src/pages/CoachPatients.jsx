import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import MobileSelect from "@/components/MobileSelect";
import { useAuth } from "@/lib/AuthContext";
import { isAdminRole, isSubadminRole, isPatientRole, isViewerRole } from "@/lib/roles";

export default function CoachPatients() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedCoachFilter, setSelectedCoachFilter] = useState("");
  const [loadError, setLoadError] = useState(false);

  useMemo(() => {
    if (!currentUser) return;
    const isFullAdmin = isAdminRole(currentUser?.role);
    const isSubadmin = isSubadminRole(currentUser?.role);
    if (!isFullAdmin && !isSubadmin) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoadError(false);
        const adminToken = localStorage.getItem("admin_session_token");
        const res = await base44.functions.invoke("adminGetData", { adminToken });
        const d = res.data || res || {};
        setUsers(d.users || []);
        setAssignments(d.assignments || []);
      } catch (e) {
        console.error("Failed to load admin data", e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  const doctors = users
    .filter((u) => u.role === "doctor" || isViewerRole(u.role))
    .map((d) => ({ ...d, display_name: d.display_name || d.full_name }));

  const coachPatients = selectedCoachFilter
    ? assignments.filter((a) => a.doctor_email === selectedCoachFilter)
    : assignments;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isFullAdmin = isAdminRole(currentUser?.role);
  if (!isFullAdmin && !isSubadminRole(currentUser?.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only admins can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} aria-label="Back to Admin Panel">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Patients by Health Coach
          </h1>
          <p className="text-sm text-muted-foreground mt-1">View patients assigned to each Health Coach</p>
        </div>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="font-semibold">Couldn't load data</p>
            <p className="text-sm text-muted-foreground mt-1">Your session may have expired. Please refresh or log in again.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Health Coach Patients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Select Health Coach</Label>
              <MobileSelect
                value={selectedCoachFilter}
                onValueChange={setSelectedCoachFilter}
                options={doctors.map((d) => ({ value: d.email, label: d.display_name || d.full_name || d.email }))}
                placeholder="All Health Coaches"
                triggerClassName="mt-1"
              />
            </div>
            {coachPatients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {selectedCoachFilter ? "No patients assigned to this Health Coach." : "No assignments yet."}
              </p>
            ) : (
              <div className="space-y-2">
                {coachPatients.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium">{a.patient_name || a.patient_email}</p>
                      <p className="text-xs text-muted-foreground">{a.patient_email}</p>
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
                    {!selectedCoachFilter && (
                      <p className="text-xs text-muted-foreground">→ {a.doctor_name || a.doctor_email}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}