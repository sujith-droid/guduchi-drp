import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        if (req.method !== "POST") {
            return Response.json({ error: 'Method not allowed' }, { status: 405 });
        }

        const body = await req.json();
        const { phone } = body;

        if (!phone) {
            return Response.json({ error: 'Phone number required' }, { status: 400 });
        }

        // 1. Check if user exists in Base44
        const users = await base44.asServiceRole.entities.User.filter({ phone });
        if (users.length === 0) {
            return Response.json({ error: 'No account found with this phone number.' }, { status: 404 });
        }

        // 2. Dev/test bypass: fixed OTP for a specific number (no MSG91 call)
        const isDevPhone = phone.replace(/\D/g, "").endsWith("9110293526");
        if (isDevPhone) {
            return Response.json({ success: true, message: 'OTP sent successfully' });
        }

        // 3. MSG91 credentials from server env
        const authKey = Deno.env.get("MSG91_AUTH_KEY");
        const templateId = Deno.env.get("MSG91_OTP_TEMPLATE_ID");

        if (!authKey || !templateId) {
            return Response.json({ error: 'MSG91 credentials not configured in server.' }, { status: 500 });
        }

        // MSG91 expects the number in international format WITHOUT the leading "+"
        const mobile = phone.replace(/^\+/, "");

        // 3. Send OTP via MSG91 (template_id + mobile + authkey). MSG91 handles OTP
        //    generation, storage, and SMS delivery.
        const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(templateId)}&mobile=${encodeURIComponent(mobile)}&authkey=${encodeURIComponent(authKey)}`;
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "authkey": authKey,
                "content-type": "application/json",
            },
        });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || data.type !== "success") {
            return Response.json({ error: data.message || 'Failed to send OTP via MSG91.' }, { status: resp.status || 500 });
        }

        return Response.json({ success: true, message: data.message || 'OTP sent successfully' });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
});