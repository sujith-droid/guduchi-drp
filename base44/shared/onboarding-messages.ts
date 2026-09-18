/**
 * Defines the default onboarding message sequence sent to a patient
 * immediately after being assigned to a Health Coach.
 * Each message is sent from the Health Coach to the patient in the chat.
 * {patient_name} and {doctor_name} placeholders are replaced at send time.
 */
export const ONBOARDING_MESSAGES: string[] = [
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
 * Sends the onboarding message batch from a Health Coach to a patient.
 * Returns the number of messages sent.
 */
export async function sendOnboardingMessages(
  base44: any,
  patientEmail: string,
  doctorEmail: string,
  patientName: string,
  doctorName: string
): Promise<number> {
  const convId = [patientEmail, doctorEmail].sort().join("_");
  const messages = ONBOARDING_MESSAGES.map((template) =>
    personalizeMessage(template, patientName, doctorName)
  );

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
}