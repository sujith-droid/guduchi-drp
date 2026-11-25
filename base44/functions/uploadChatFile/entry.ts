import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { validateAdminToken, validatePatientToken } from '../../shared/admin-session.ts';

// Chat attachments (photos, documents, voice notes) are uploaded here because
// mobile-OTP users hold an opaque AdminSession token that the platform does not
// accept for direct SDK uploads from the browser. We validate that session
// (patient, doctor or admin) and upload with the service role.

const MAX_BYTES = 15 * 1024 * 1024;
// Photos are uploaded to a free image host so chat images keep working when the
// workspace has no integration credits left. Larger files and non-image
// attachments (voice notes, documents) still go through Base44 storage.
const IMGBB_MAX_BYTES = 10 * 1024 * 1024;

async function uploadToImgbb(file: File): Promise<string> {
  const key = secrets.get('IMGBB_API_KEY');
  if (!key) throw new Error('Image host is not configured');

  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }

  const form = new FormData();
  form.append('image', btoa(binary));

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const json = await res.json().catch(() => ({}));
  const url = json?.data?.display_url || json?.data?.url;
  if (!res.ok || !url) {
    throw new Error(json?.error?.message || 'Photo upload failed, please try again');
  }
  return url;
}

// Voice notes are uploaded to Cloudinary when it is configured, because Base44
// file storage needs integration credits that the workspace may have used up.
// Cloudinary accepts audio through its "auto" endpoint and returns a direct URL
// that an <audio> element can play.
async function uploadToCloudinary(file: File): Promise<string> {
  const cloud = secrets.get('CLOUDINARY_CLOUD_NAME');
  const preset = secrets.get('CLOUDINARY_UPLOAD_PRESET');
  if (!cloud || !preset) throw new Error('Voice messages are not available right now');

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/auto/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(90000),
  });
  const json = await res.json().catch(() => ({}));
  const url = json?.secure_url || json?.url;
  if (!res.ok || !url) {
    throw new Error(json?.error?.message || 'Voice message upload failed, please try again');
  }
  return url;
}

function isCloudinaryConfigured(): boolean {
  return Boolean(secrets.get('CLOUDINARY_CLOUD_NAME') && secrets.get('CLOUDINARY_UPLOAD_PRESET'));
}

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

    const isImage = typeof file.type === 'string' && file.type.startsWith('image/');
    if (isImage && file.size <= IMGBB_MAX_BYTES) {
      const file_url = await uploadToImgbb(file);
      return Response.json({ file_url });
    }

    const isAudio = typeof file.type === 'string' && file.type.startsWith('audio/');
    if (isAudio && isCloudinaryConfigured()) {
      const file_url = await uploadToCloudinary(file);
      return Response.json({ file_url });
    }

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
    return Response.json({ file_url });
  } catch (error) {
    return Response.json({ error: error.message || 'Upload failed' }, { status: error.status || 500 });
  }
}