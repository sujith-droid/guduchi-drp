import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { target_email } = body;

        if (!target_email) {
            return Response.json({ phone: null });
        }

        const asPatient = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({ 
            patient_email: user.email, 
            doctor_email: target_email, 
            status: "active" 
        });
        
        const asDoctor = await base44.asServiceRole.entities.PatientDoctorAssignment.filter({ 
            doctor_email: user.email, 
            patient_email: target_email, 
            status: "active" 
        });
        
        if (asPatient.length === 0 && asDoctor.length === 0 && user.role !== 'admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email: target_email });
        return Response.json({ phone: users.length > 0 ? users[0].phone : null });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});