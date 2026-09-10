import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { target_email, adminToken } = body;

        // Validate the session — accept any role (patient, doctor, admin).
        // Mobile-OTP users have an opaque AdminSession token, not a real
        // Base44 platform token, so base44.auth.me() fails for them.
        let currentUser = null;
        if (adminToken) {
            const sessions = await base44.asServiceRole.entities.AdminSession.filter({
                token: adminToken,
                is_active: true,
            });
            if (sessions && sessions.length > 0) {
                const session = sessions[0];
                if (new Date(session.expires_at) >= new Date()) {
                    const users = await base44.asServiceRole.entities.User.filter({ email: session.user_email });
                    currentUser = users?.[0] || null;
                }
            }
        }

        // Fallback: platform email/password auth (builder or invited user)
        if (!currentUser) {
            try { currentUser = await base44.auth.me(); } catch {}
        }

        if (!currentUser) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!target_email) {
            return Response.json({ phone: null });
        }

        const asPatient = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({
            patient_email: currentUser.email,
            doctor_email: target_email,
            status: "active"
        });

        const asDoctor = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({
            doctor_email: currentUser.email,
            patient_email: target_email,
            status: "active"
        });

        if (asPatient.length === 0 && asDoctor.length === 0 && currentUser.role !== 'admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email: target_email });
        return Response.json({ phone: users.length > 0 ? users[0].phone : null });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}