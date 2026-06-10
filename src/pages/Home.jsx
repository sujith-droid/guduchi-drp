import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import PatientDashboard from "./PatientDashboard";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === "doctor" || user?.role === "admin") {
      navigate("/doctor", { replace: true });
    }
  }, [user, navigate]);

  // Show patient dashboard for patients/non-doctors
  if (user?.role !== "doctor") {
    return <PatientDashboard />;
  }

  return null;
}