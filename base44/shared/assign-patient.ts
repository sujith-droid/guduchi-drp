// Shared patient → Health Coach assignment logic. Used by both the admin
// panel (adminAction "assign") and the Health Coach dashboard
// (doctorApi "assignPatient") so the rules, notifications and onboarding
// messages stay identical no matter who assigns.

import { sendOnboardingMessages } from './onboarding-messages.ts';

export async function assignPatientToCoach(base44, {
  patientEmail,
  doctorEmail,
  assignedByLabel = 'the admin',
  skipDoctorNotification = false,
}) {
  const entities = base44.asServiceRole.entities;

  const existing = await entities.PatientDoctorAssignment.filter({
    patient_email: patientEmail,
    status: 'active',
  });
  const existingItems = existing?.items || existing || [];
  if (existingItems.length >= 3) {
    return { error: 'A patient can only be assigned to a maximum of 3 Health Coaches.' };
  }
  if (existingItems.some((a) => a.doctor_email === doctorEmail)) {
    return { error: 'This patient is already assigned to this Health Coach.' };
  }

  const patientUsers = await entities.User.filter({ email: patientEmail });
  const doctorUsers = await entities.User.filter({ email: doctorEmail });
  const patient = (patientUsers?.items || patientUsers || [])[0];
  const doctor = (doctorUsers?.items || doctorUsers || [])[0];

  // Staff accounts (Doctors, Health Coaches, admins) are never patients.
  if (patient && ['doctor', 'viewer', 'admin', 'subadmin'].includes(patient.role)) {
    return { error: 'Doctors and Health Coaches cannot be assigned as patients.' };
  }

  await entities.PatientDoctorAssignment.create({
    patient_email: patientEmail,
    doctor_email: doctorEmail,
    patient_name: patient?.display_name || patient?.full_name || patientEmail,
    doctor_name: doctor?.display_name || doctor?.full_name || doctorEmail,
    status: 'active',
  });

  const patientDisplayName = patient?.display_name || patient?.full_name || patientEmail;
  const doctorDisplayName = doctor?.display_name || doctor?.full_name || doctorEmail;
  // Read-only Doctors (viewer role) are notified as Doctors, everyone else as Health Coaches.
  const doctorLabel = doctor?.role === 'viewer' ? 'Doctor' : 'Health Coach';

  if (!skipDoctorNotification) {
    await entities.Notification.create({
      user_email: doctorEmail,
      title: 'New Patient Assigned',
      message: `${patientDisplayName} has been assigned to you by ${assignedByLabel}.`,
      type: 'info',
      related_patient_email: patientEmail,
    });
  }
  await entities.Notification.create({
    user_email: patientEmail,
    title: `${doctorLabel} Assigned`,
    message: `${doctorDisplayName} has been assigned as your ${doctorLabel}.`,
    type: 'info',
  });

  try {
    await sendOnboardingMessages(
      base44,
      patientEmail,
      doctorEmail,
      patientDisplayName,
      doctorDisplayName
    );
  } catch (e) {
    return {
      success: true,
      warning: 'Patient assigned, but onboarding messages could not be sent. Please send them manually from the chat.',
    };
  }

  return { success: true };
}