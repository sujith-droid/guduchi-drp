/**
 * Default onboarding messages used as fallback when no per-coach messages are configured.
 * {patient_name} and {doctor_name} placeholders are replaced at send time.
 */
const DEFAULT_ONBOARDING_MESSAGES: string[] = [
  "Welcome to Guduchi DRP, {patient_name}! I'm {doctor_name}, your Health Coach. I'll be guiding you through your diabetes reversal journey. 🌿",
  "Here's what to expect:\n• Daily blood sugar tracking in the Logbook\n• Regular progress reviews\n• Personalized diet & lifestyle guidance\n• Ongoing support via this chat",
  "To get started, please:\n1. Log your blood sugar readings today in the Logbook\n2. Fill in your profile details (weight, step count)\n3. Feel free to share any questions or concerns here anytime",
  "Remember — small daily steps lead to big results. I'm here to help you every step of the way. Let's begin! 💪",
];

/**
 * Replaces placeholders in a message with patient/doctor names.
 */
export function personalizeMessage(
  template: string,
  patientName: string,
  doctorName: string
): string {
  return template
    .replace(/\{patient_name\}/gi, patientName)
    .replace(/\{doctor_name\}/gi, doctorName);
}

/**
 * Sends onboarding messages from a Health Coach to a patient.
 * If per-coach messages are configured in the OnboardingMessage entity, uses those.
 * Otherwise falls back to DEFAULT_ONBOARDING_MESSAGES.
 * Returns the number of messages sent.
 */
export async function sendOnboardingMessages(
  base44: any,
  patientEmail: string,
  doctorEmail: string,
  patientName: string,
  doctorName: string
): Promise<number> {
  // Fetch per-coach onboarding messages, ordered by sequence
  let customMessages: string[] = [];
  try {
    const records = await base44.asServiceRole.entities.OnboardingMessage.filter(
      { doctor_email: doctorEmail },
      "sequence",
      50
    );
    if (records && records.length > 0) {
      customMessages = records
        .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0))
        .map((r: any) => r.content);
    }
  } catch (e) {
    // Entity might not exist yet — fall back to defaults
    console.error("Failed to fetch onboarding messages:", e);
  }

  const templates = customMessages.length > 0 ? customMessages : DEFAULT_ONBOARDING_MESSAGES;
  const convId = [patientEmail, doctorEmail].sort().join("_");
  const messages = templates.map((template) =>
    personalizeMessage(template, patientName, doctorName)
  );

  // Retry bulkCreate up to 3 times to handle transient errors
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await base44.asServiceRole.entities.ChatMessage.bulkCreate(
        messages.map((message) => ({
          sender_email: doctorEmail,
          receiver_email: patientEmail,
          conversation_id: convId,
          message,
          message_type: "text",
        }))
      );
      return messages.length;
    } catch (e) {
      lastError = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  // All retries failed — notify admins so they can manually retry
  try {
    const adminUsers = await base44.asServiceRole.entities.User.filter({ role: "admin" });
    const adminEmails = adminUsers.map((u: any) => u.email).filter(Boolean);
    await base44.asServiceRole.entities.Notification.bulkCreate(
      adminEmails.map((email: string) => ({
        user_email: email,
        title: "Onboarding messages failed",
        message: `Onboarding messages failed to send to ${patientName} (${patientEmail}) from ${doctorName}. Please assign them again or send manually.`,
        type: "alert",
        related_patient_email: patientEmail,
      }))
    );
  } catch {
    // If even the notification fails, log it — nothing more we can do
    console.error("Failed to send onboarding messages and admin notification:", lastError);
  }
  throw lastError;
}