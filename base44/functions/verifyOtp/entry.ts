import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        if (req.method !== "POST") {
            return Response.json({ error: 'Method not allowed' }, { status: 405 });
        }

        const body = await req.json();
        const { phone, code } = body;

        if (!phone || !code) {
            return Response.json({ error: 'Phone number and OTP code required' }, { status: 400 });
        }

        // 1. MSG91 credentials
        const authKey = Deno.env.get("MSG91_AUTH_KEY");
        if (!authKey) {
            return Response.json({ error: 'MSG91 credentials not configured in server.' }, { status: 500 });
        }

        const mobile = phone.replace(/^\+/, "");

        // 2. Verify the OTP code with MSG91 (authkey goes in the header)
        const verifyUrl = `https://control.msg91.com/api/v5/otp/verify?otp=${encodeURIComponent(code)}&mobile=${encodeURIComponent(mobile)}`;
        const resp = await fetch(verifyUrl, {
            method: "GET",
            headers: {
                "authkey": authKey,
                "accept": "application/json",
            },
        });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || data.type !== "success") {
            return Response.json({ error: data.message || 'Invalid or expired OTP. Please try again.' }, { status: 400 });
        }

        // 3. Find the user
        const users = await base44.asServiceRole.entities.User.filter({ phone });
        if (users.length === 0) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        const user = users[0];

        // 4. Persist the verified phone number so the in-app Call button can
        //    reach this user. Keeps the stored value in sync with the number
        //    actually used at login.
        if (user.phone !== phone) {
            await base44.asServiceRole.entities.User.update(user.id, { phone });
        }

        // 5. Issue a session token.
        // Mobile-OTP login cannot mint a real Base44 session token on this plan,
        // so we issue an opaque AdminSession token for ALL users (validated
        // server-side). This persists in localStorage so the user stays logged
        // in across app restarts until the session expires (90 days).
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        const session = await base44.asServiceRole.entities.AdminSession.create({
            token: crypto.randomUUID(),
            user_id: user.id,
            user_email: user.email,
            role: user.role || "user",
            expires_at: expiresAt,
            is_active: true,
        });

        return Response.json({ success: true, token: session.token, user });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
});