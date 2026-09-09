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

        const authKey = Deno.env.get("MSG91_AUTH_KEY");
        if (!authKey) {
            return Response.json({ error: 'MSG91 credentials not configured in server.' }, { status: 500 });
        }

        const mobile = phone.replace(/^\+/, "");

        // Resend the SAME OTP via MSG91's retry endpoint (retrytype=text for SMS).
        // Using retry (instead of re-calling send) avoids generating a new OTP and
        // respects MSG91's resend rate limits.
        const url = `https://control.msg91.com/api/v5/otp/retry?authkey=${encodeURIComponent(authKey)}&retrytype=text&mobile=${encodeURIComponent(mobile)}`;
        const resp = await fetch(url, {
            method: "GET",
            headers: {
                "authkey": authKey,
                "accept": "application/json",
            },
        });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || data.type !== "success") {
            return Response.json({ error: data.message || 'Failed to resend OTP via MSG91.' }, { status: resp.status || 500 });
        }

        return Response.json({ success: true, message: 'OTP resent successfully' });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
});