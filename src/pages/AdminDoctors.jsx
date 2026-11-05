import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Stethoscope, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invokeFunction } from "@/lib/invokeFunction";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import DoctorCard from "@/components/admin/DoctorCard";
import { useAuth } from "@/lib/AuthContext";
import { isAdminRole, isSubadminRole, isViewerRole } from "@/lib/roles";

export default function AdminDoctors() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState(false);

  const isFullAdmin = isAdminRole(currentUser?.role);
  const isSubadmin = isSubadminRole(currentUser?.role);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    if (!isFullAdmin && !isSubadmin) {
      setLoading(false);
      return;
    }
    try {
      setLoadError(false);
      const adminToken = localStorage.getItem("admin_session_token");
      const d = (await invokeFunction("adminGetData", { adminToken })) || {};
      setUsers(d.users || []);
      setAssignments(d.assignments || []);
    } catch (e) {
      console.error("Failed to load admin data", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isFullAdmin, isSubadmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const scrollRef = useRef(null);
  useLayoutEffect(() => {
    scrollRef.current = document.getElementById("main-scroll");
  }, []);
  const { pullDistance, isRefreshing } = usePullToRefresh(handleRefresh, { scrollRef });

  // Doctors are the read-only "viewer" role; Health Coaches ("doctor" role) have
  // their own page at /coach-patients.
  const doctorsWithPatients = useMemo(() => {
    const staffEmails = new Set(
      users
        .filter(
          (u) =>
            u.role === "doctor" ||
            isViewerRole(u.role) ||
            isAdminRole(u.role) ||
            isSubadminRole(u.role)
        )
        .map((u) => u.email)
    );
    const byEmail = new Map(users.map((u) => [u.email, u]));

    return users
      .filter((u) => isViewerRole(u.role))
      .map((doctor) => ({
        doctor: { ...doctor, display_name: doctor.display_name || doctor.full_name },
        patients: assignments
          .filter((a) => a.doctor_email === doctor.email && !staffEmails.has(a.patient_email))
          .map((a) => ({ assignment: a, patient: byEmail.get(a.patient_email) })),
      }))
      .sort((x, y) =>
        (x.doctor.display_name || x.doctor.email || "").localeCompare(
          y.doctor.display_name || y.doctor.email || ""
        )
      );
  }, [users, assignments]);

  const query = search.trim().toLowerCase();
  const visibleDoctors = query
    ? doctorsWithPatients.filter(
        ({ doctor, patients }) =>
          (doctor.display_name || "").toLowerCase().includes(query) ||
          (doctor.email || "").toLowerCase().includes(query) ||
          (doctor.phone || "").toLowerCase().includes(query) ||
          patients.some(
            (p) =>
              (p.assignment.patient_name || "").toLowerCase().includes(query) ||
              (p.assignment.patient_email || "").toLowerCase().includes(query) ||
              (p.patient?.phone || "").toLowerCase().includes(query)
          )
      )
    : doctorsWithPatients;

  const totalAssigned = doctorsWithPatients.reduce((n, d) => n + d.patients.length, 0);

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
        <Stethoscope className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only admins can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} aria-label="Back to Admin Panel">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6" /> Doctors
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {doctorsWithPatients.length} doctor{doctorsWithPatients.length === 1 ? "" : "s"} · {totalAssigned} patient
            {totalAssigned === 1 ? "" : "s"} assigned
          </p>
        </div>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <p className="font-semibold">Couldn't load data</p>
            <p className="text-sm text-muted-foreground">Your session may have expired. Please try again.</p>
            <Button variant="outline" onClick={loadData}>Retry</Button>
          </CardContent>
        </Card>
      ) : doctorsWithPatients.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No doctors found. Assign the Doctor role to a user in the Admin Panel.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search doctor or patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {visibleDoctors.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No matches for "{search}".</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleDoctors.map(({ doctor, patients }) => (
                <DoctorCard key={doctor.id} doctor={doctor} patients={patients} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}