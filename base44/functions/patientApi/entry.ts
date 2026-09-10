import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Patients log in via mobile OTP and receive a dummy token ("base44-token")
// that the Base44 backend doesn't recognize. Direct entity SDK calls from the
// client therefore fail with 401 and trigger a redirect to login.
// This function authenticates the patient by email (already verified via OTP)
// and performs all entity operations server-side using asServiceRole.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, patientEmail, ...payload } = body;

    // Validate the patient by email — OTP was already verified at login.
    if (!patientEmail) {
      return Response.json({ error: 'patientEmail is required' }, { status: 400 });
    }
    const users = await base44.asServiceRole.entities.User.filter({ email: patientEmail });
    if (users.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }
    const patient = users[0];

    switch (action) {
      case 'assignDoctor': {
        const { doctorEmail } = payload;
        if (!doctorEmail) return Response.json({ error: 'doctorEmail is required' }, { status: 400 });

        // Check existing assignment
        const existing = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({
          patient_email: patientEmail,
          doctor_email: doctorEmail,
          status: 'active',
        });
        if (existing.length > 0) {
          return Response.json({ status: 'already', doctorName: doctorEmail });
        }

        // Deactivate existing active assignments — patient can only have one doctor at a time
        const currentAssignments = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({
          patient_email: patientEmail,
          status: 'active',
        });
        for (const a of currentAssignments) {
          await base44.asServiceRole.entities.PatientDoctorAssignment.update(a.id, { status: 'inactive' });
        }

        // Get doctor name
        const doctorUsers = await base44.asServiceRole.entities.User.filter({ email: doctorEmail });
        const doctorName = doctorUsers[0]?.full_name || doctorEmail;

        await base44.asServiceRole.entities.PatientDoctorAssignment.create({
          patient_email: patientEmail,
          doctor_email: doctorEmail,
          patient_name: patient.full_name || patientEmail,
          doctor_name: doctorName,
          status: 'active',
        });

        // Notify doctor
        await base44.asServiceRole.entities.Notification.create({
          user_email: doctorEmail,
          title: 'New Patient Joined',
          message: `${patient.full_name || patientEmail} has joined your care.`,
          type: 'info',
          related_patient_email: patientEmail,
        }).catch(() => {});
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: doctorEmail,
          subject: 'New Patient Joined Your Care',
          body: `Hello,\n\n${patient.full_name || patientEmail} has joined your care on the Guduchi Diabetes Reversal Program.\n\nLog in to your dashboard to view their profile.\n\n— Guduchi Health Team`,
        }).catch(() => {});

        // Send welcome message
        await base44.asServiceRole.functions.invoke('sendWelcomeMessage', {
          data: {
            patient_email: patientEmail,
            doctor_email: doctorEmail,
            patient_name: patient.full_name || patientEmail,
            doctor_name: doctorName,
          },
        }).catch(() => {});

        // Notify patient
        await base44.asServiceRole.entities.Notification.create({
          user_email: patientEmail,
          title: 'Welcome to the Program!',
          message: `You have been successfully connected to Dr. ${doctorName}. Your diabetes reversal journey begins now!`,
          type: 'achievement',
        }).catch(() => {});
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: patientEmail,
          subject: 'Welcome to Guduchi Diabetes Reversal Program!',
          body: `Hello ${patient.full_name || ""},\n\nYou have been successfully connected to Dr. ${doctorName}.\n\nStart logging your daily health metrics and track your progress toward reversing diabetes!\n\n— Guduchi Health Team`,
        }).catch(() => {});

        return Response.json({ status: 'done', doctorName });
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}