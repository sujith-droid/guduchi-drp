import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, Mail, Phone, Users } from "lucide-react";
import { motion } from "framer-motion";

/**
 * One doctor with their assigned patients, expandable to the patient list.
 */
export default function DoctorCard({ doctor, patients }) {
  const [expanded, setExpanded] = useState(false);
  const name = doctor.display_name || doctor.full_name || doctor.email;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            <a
              href={`mailto:${doctor.email}`}
              className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 max-w-full truncate"
            >
              <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{doctor.email}</span>
            </a>
            {doctor.phone && (
              <a
                href={`tel:${doctor.phone}`}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                <Phone className="h-3 w-3" /> {doctor.phone}
              </a>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {patients.length} patient{patients.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {patients.length === 0 ? (
          <p className="text-xs text-muted-foreground">No patients assigned yet.</p>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between gap-2"
              aria-label={`${expanded ? "Hide" : "Show"} patients assigned to ${name}`}
              onClick={() => setExpanded((v) => !v)}
            >
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" /> {expanded ? "Hide patients" : "Show patients"}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>

            {expanded && (
              <div className="space-y-2">
                {patients.map(({ assignment, patient }) => (
                  <motion.div
                    key={assignment.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start justify-between gap-3 p-2.5 bg-muted/50 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {patient?.display_name || patient?.full_name || assignment.patient_name || assignment.patient_email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{assignment.patient_email}</p>
                      {patient?.phone && (
                        <a
                          href={`tel:${patient.phone}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="h-3 w-3" /> {patient.phone}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {assignment.program_duration && (
                        <Badge variant="outline" className="text-xs">{assignment.program_duration}</Badge>
                      )}
                      {assignment.patient_id && (
                        <span className="text-xs text-muted-foreground">ID: {assignment.patient_id}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}