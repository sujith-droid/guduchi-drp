import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, MapPin, Stethoscope, Loader2, UserCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function DoctorDirectory() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await base44.functions.invoke("listDoctors", {});
        setDoctors(res?.data?.doctors || res?.doctors || []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = doctors.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [d.full_name, d.specialty, d.city, d.email]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  const connect = (email) => {
    navigate(`/join?doctor=${encodeURIComponent(email)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <AlertCircle className="h-10 w-10 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">Couldn't load doctors. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Find a Doctor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse doctors in the program and connect with one to start your care.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, specialty, or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCircle className="h-12 w-12 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            {doctors.length === 0 ? "No doctors available yet." : "No doctors match your search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((doc) => (
            <div
              key={doc.email}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">Dr. {doc.full_name || doc.email}</p>
                  {doc.specialty && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Stethoscope className="h-3 w-3" /> {doc.specialty}
                    </p>
                  )}
                  {doc.city && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {doc.city}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => connect(doc.email)}
                className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Connect
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}