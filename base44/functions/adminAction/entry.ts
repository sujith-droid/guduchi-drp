import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { validateAdminToken } from '../../shared/admin-session.ts';
import { sendOnboardingMessages } from '../../shared/onboarding-messages.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { adminToken, action, ...payload } = body;
    const session = await validateAdminToken(base44, adminToken);

    // Subadmins can only assign patients to health coaches — no other actions.
    if (session.role === "subadmin" && action !== "assign") {
      return Response.json({ error: "Subadmins can only assign patients to Health Coaches." }, { status: 403 });
    }

    switch (action) {
      case 'assign': {
        const { patientEmail, doctorEmail } = payload;
        if (!patientEmail || !doctorEmail) {
          return Response.json({ error: 'patientEmail and doctorEmail are required' }, { status: 400 });
        }
        const existing = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({
          patient_email: patientEmail,
          status: 'active',
        });
        if (existing.length >= 3) {
          return Response.json({ error: 'A patient can only be assigned to a maximum of 3 Health Coaches.' }, { status: 400 });
        }
        if (existing.some((a) => a.doctor_email === doctorEmail)) {
          return Response.json({ error: 'This patient is already assigned to this Health Coach.' }, { status: 400 });
        }
        const patientUsers = await base44.asServiceRole.entities.User.filter({ email: patientEmail });
        const doctorUsers = await base44.asServiceRole.entities.User.filter({ email: doctorEmail });
        const patient = patientUsers[0];
        const doctor = doctorUsers[0];
        await base44.asServiceRole.entities.PatientDoctorAssignment.create({
          patient_email: patientEmail,
          doctor_email: doctorEmail,
          patient_name: patient?.display_name || patient?.full_name || patientEmail,
          doctor_name: doctor?.display_name || doctor?.full_name || doctorEmail,
          status: 'active',
        });
        const patientDisplayName = patient?.display_name || patient?.full_name || patientEmail;
        const doctorDisplayName = doctor?.display_name || doctor?.full_name || doctorEmail;
        await base44.asServiceRole.entities.Notification.create({
          user_email: doctorEmail,
          title: 'New Patient Assigned',
          message: `${patientDisplayName} has been assigned to you by the admin.`,
          type: 'info',
          related_patient_email: patientEmail,
        });
        await base44.asServiceRole.entities.Notification.create({
          user_email: patientEmail,
          title: 'Health Coach Assigned',
          message: `${doctorDisplayName} has been assigned as your Health Coach.`,
          type: 'info',
        });
        // Send immediate batch of onboarding messages from the Health Coach to the patient
        // Retries internally; if all retries fail, admins get a notification and the
        // error is surfaced in the response so the admin sees it.
        try {
          await sendOnboardingMessages(
            base44,
            patientEmail,
            doctorEmail,
            patientDisplayName,
            doctorDisplayName
          );
        } catch (e) {
          return Response.json({
            success: true,
            warning: `Patient assigned, but onboarding messages could not be sent. Please send them manually from the chat.`,
          });
        }
        return Response.json({ success: true });
      }
      case 'addTemplate': {
        const { name, content } = payload;
        if (!name || !content) {
          return Response.json({ error: 'Template name and content are required' }, { status: 400 });
        }
        await base44.asServiceRole.entities.MessageTemplate.create({ name, content });
        return Response.json({ success: true });
      }
      case 'deleteTemplate': {
        if (!payload.id) return Response.json({ error: 'id is required' }, { status: 400 });
        await base44.asServiceRole.entities.MessageTemplate.delete(payload.id);
        return Response.json({ success: true });
      }
      case 'addOnboardingMessage': {
        const { doctorEmail, doctorName, content, sequence } = payload;
        if (!doctorEmail || !content) {
          return Response.json({ error: 'doctorEmail and content are required' }, { status: 400 });
        }
        await base44.asServiceRole.entities.OnboardingMessage.create({
          doctor_email: doctorEmail,
          doctor_name: doctorName || doctorEmail,
          content,
          sequence: sequence || 1,
        });
        return Response.json({ success: true });
      }
      case 'deleteOnboardingMessage': {
        if (!payload.id) return Response.json({ error: 'id is required' }, { status: 400 });
        await base44.asServiceRole.entities.OnboardingMessage.delete(payload.id);
        return Response.json({ success: true });
      }
      case 'removeAssignment': {
        if (!payload.id) return Response.json({ error: 'id is required' }, { status: 400 });
        await base44.asServiceRole.entities.PatientDoctorAssignment.update(payload.id, { status: 'inactive' });
        return Response.json({ success: true });
      }
      case 'updateProgram': {
        if (!payload.id) return Response.json({ error: 'id is required' }, { status: 400 });
        await base44.asServiceRole.entities.PatientDoctorAssignment.update(payload.id, { program_duration: payload.program_duration });
        return Response.json({ success: true });
      }
      case 'updateRole': {
        if (!payload.userId || !payload.newRole) {
          return Response.json({ error: 'userId and newRole are required' }, { status: 400 });
        }
        await base44.asServiceRole.entities.User.update(payload.userId, { role: payload.newRole });
        return Response.json({ success: true });
      }
      case 'updateUserName': {
        if (!payload.userId || !payload.fullName) {
          return Response.json({ error: 'userId and fullName are required' }, { status: 400 });
        }
        const updateData = { display_name: payload.fullName };
        if (payload.city) updateData.city = payload.city;
        await base44.asServiceRole.entities.User.update(payload.userId, updateData);
        // Sync doctor_name to all their assignments
        try {
          const assignments = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({ doctor_email: payload.doctorEmail });
          for (const a of assignments) {
            if (a.doctor_name !== payload.fullName) {
              await base44.asServiceRole.entities.PatientDoctorAssignment.update(a.id, { doctor_name: payload.fullName });
            }
          }
        } catch (e) {
          console.error('Could not sync doctor_name to assignments:', e);
        }
        return Response.json({ success: true });
      }
      case 'deleteUser': {
        if (!payload.userId) return Response.json({ error: 'userId is required' }, { status: 400 });
        await base44.asServiceRole.entities.User.delete(payload.userId);
        return Response.json({ success: true });
      }
      case 'logout': {
        const sessions = await base44.asServiceRole.entities.AdminSession.filter({ token: adminToken });
        if (sessions[0]) {
          await base44.asServiceRole.entities.AdminSession.update(sessions[0].id, { is_active: false });
        }
        return Response.json({ success: true });
      }
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}