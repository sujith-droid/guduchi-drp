import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
    try {
        if (req.method !== "POST") {
            return Response.json({ error: 'Method not allowed' }, { status: 405 });
        }

        const base44 = createClientFromRequest(req);
        const { email, age, gender, patient_id } = await req.json();

        if (!email) {
            return Response.json({ error: 'Email is required' }, { status: 400 });
        }
        if (!age || age < 1 || age > 120) {
            return Response.json({ error: 'Please enter a valid age' }, { status: 400 });
        }
        if (!gender) {
            return Response.json({ error: 'Please select your gender' }, { status: 400 });
        }

        const users = await base44.asServiceRole.entities.User.filter({ email });
        if (users.length === 0) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }
        const user = users[0];

        const pid = patient_id || user.patient_id || `DRP-${Date.now().toString(36).toUpperCase()}`;

        // Persist profile fields via service role so it works even when the
        // client session token is invalid (e.g. phone-OTP login issues a dummy token).
        await base44.asServiceRole.entities.User.update(user.id, {
            age: Number(age),
            gender,
            patient_id: pid,
            profile_complete: true
        });

        return Response.json({
            success: true,
            user: { ...user, age: Number(age), gender, patient_id: pid, profile_complete: true }
        });
    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
});