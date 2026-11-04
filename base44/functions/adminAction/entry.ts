import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';
import { assignPatientToCoach } from '../../shared/assign-patient.ts';
import { validateAdminToken } from '../../shared/admin-session.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { adminToken, action, ...payload } = body;

    const session = await validateAdminToken(base44, adminToken);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = session.role;
    const isAdmin = role === 'admin' || role === 'subadmin';
    if (!isAdmin) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Subadmins can only assign patients to health coaches — no other actions.
    if (role === "subadmin" && action !== "assign") {
      return Response.json({ error: "Subadmins can only assign patients to Health Coaches." }, { status: 403 });
    }

    // OTP-authenticated admins have an AdminSession UUID, not a platform token,
    // so all entity operations must go through the service role.
    const entities = base44.asServiceRole.entities;

    switch (action) {
      case 'assign': {
        const { patientEmail, doctorEmail } = payload;
        if (!patientEmail || !doctorEmail) {
          return Response.json({ error: 'patientEmail and doctorEmail are required' }, { status: 400 });
        }
        const result = await assignPatientToCoach(base44, { patientEmail, doctorEmail });
        if (result.error) {
          return Response.json({ error: result.error }, { status: 400 });
        }
        return Response.json(result);
      }
      case 'addTemplate': {
        const { name, content } = payload;
        if (!name || !content) {
          return Response.json({ error: 'Template name and content are required' }, { status: 400 });
        }
        await entities.MessageTemplate.create({ name, content });
        return Response.json({ success: true });
      }
      case 'deleteTemplate': {
        if (!payload.id) return Response.json({ error: 'id is required' }, { status: 400 });
        await entities.MessageTemplate.delete(payload.id);
        return Response.json({ success: true });
      }
      case 'addOnboardingMessage': {
        const { doctorEmail, doctorName, content, sequence } = payload;
        if (!doctorEmail || !content) {
          return Response.json({ error: 'doctorEmail and content are required' }, { status: 400 });
        }
        await entities.OnboardingMessage.create({
          doctor_email: doctorEmail,
          doctor_name: doctorName || doctorEmail,
          content,
          sequence: sequence || 1,
        });
        return Response.json({ success: true });
      }
      case 'deleteOnboardingMessage': {
        if (!payload.id) return Response.json({ error: 'id is required' }, { status: 400 });
        await entities.OnboardingMessage.delete(payload.id);
        return Response.json({ success: true });
      }
      case 'removeAssignment': {
        if (!payload.id) return Response.json({ error: 'id is required' }, { status: 400 });
        await entities.PatientDoctorAssignment.update(payload.id, { status: 'inactive' });
        return Response.json({ success: true });
      }
      case 'updateProgram': {
        if (!payload.id) return Response.json({ error: 'id is required' }, { status: 400 });
        await entities.PatientDoctorAssignment.update(payload.id, { program_duration: payload.program_duration });
        return Response.json({ success: true });
      }
      case 'updateRole': {
        if (!payload.userId || !payload.newRole) {
          return Response.json({ error: 'userId and newRole are required' }, { status: 400 });
        }
        await entities.User.update(payload.userId, { role: payload.newRole });
        // Anyone made Doctor / Health Coach / admin becomes staff — deactivate
        // any patient assignment they still have so they stay separate from
        // the patient lists.
        if (['doctor', 'viewer', 'admin', 'subadmin'].includes(payload.newRole)) {
          try {
            const found = await entities.User.filter({ id: payload.userId });
            const updated = (found?.items || found || [])[0];
            if (updated?.email) {
              await entities.PatientDoctorAssignment.updateMany(
                { patient_email: updated.email, status: 'active' },
                { $set: { status: 'inactive' } }
              );
            }
          } catch (e) {
            console.error('Could not clear patient assignments for promoted user:', e);
          }
        }
        return Response.json({ success: true });
      }
      case 'updateUserName': {
        if (!payload.userId || !payload.fullName) {
          return Response.json({ error: 'userId and fullName are required' }, { status: 400 });
        }
        const updateData = { display_name: payload.fullName };
        if (payload.city) updateData.city = payload.city;
        await entities.User.update(payload.userId, updateData);
        try {
          const assignments = await entities.PatientDoctorAssignment.filter({ doctor_email: payload.doctorEmail });
          const assignItems = (assignments.items || assignments);
          for (const a of assignItems) {
            if (a.doctor_name !== payload.fullName) {
              await entities.PatientDoctorAssignment.update(a.id, { doctor_name: payload.fullName });
            }
          }
        } catch (e) {
          console.error('Could not sync doctor_name to assignments:', e);
        }
        return Response.json({ success: true });
      }
      case 'deleteUser': {
        if (!payload.userId) return Response.json({ error: 'userId is required' }, { status: 400 });
        await entities.User.delete(payload.userId);
        return Response.json({ success: true });
      }
      case 'logout': {
        // Can't query AdminSession without asServiceRole — just return success.
        // The client-side logout clears localStorage and redirects.
        return Response.json({ success: true });
      }
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}