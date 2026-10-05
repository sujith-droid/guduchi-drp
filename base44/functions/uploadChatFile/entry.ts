import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { validateAdminToken, validatePatientToken } from '../../shared/admin-session.ts';

// Chat attachments (photos, documents, voice notes) are uploaded here because
// mobile-OTP users hold an opaque AdminSession token that the platform does not
// accept for direct SDK uploads from the browser. We validate that session
// (patient, doctor or admin) and upload with the service role.

const MAX_BYTES = 15 * 1024 * 1024;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const form = await req.formData();
    const adminToken = form.get('adminToken');
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return Response.json({ error: 'file is required' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'File is too large (max 15 MB)' }, { status: 413 });
    }

    const token = typeof adminToken === 'string' ? adminToken : undefined;
    try {
      await validatePatientToken(base44, token);
    } catch (_e) {
      await validateAdminToken(base44, token);
    }

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
    return Response.json({ file_url });
  } catch (error) {
    return Response.json({ error: error.message || 'Upload failed' }, { status: error.status || 500 });
  }
}