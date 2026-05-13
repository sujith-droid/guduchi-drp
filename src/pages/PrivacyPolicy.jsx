export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6 text-sm text-foreground">
      <h1 className="text-2xl font-heading font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: May 2026</p>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">1. Introduction</h2>
        <p>
          Guduchi Diabetes Reversal Program ("we", "us", or "our") operates this application. This Privacy Policy
          explains how we collect, use, and protect your personal information when you use our app.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">2. Information We Collect</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Personal details: name, email address, age, and gender</li>
          <li>Health data: blood sugar readings, weight, step count, HbA1c records</li>
          <li>Photos and files you voluntarily share in the chat with your care team</li>
          <li>Voice messages you record within the app</li>
          <li>Device motion data (used only for step counting — never stored or transmitted)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">3. Camera & Microphone Permissions</h2>
        <p>
          We request access to your device's camera and microphone solely to allow you to:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Upload food or health-related photos to share with your doctor</li>
          <li>Record and send voice messages to your care team</li>
        </ul>
        <p>We do not use your camera or microphone for any other purpose, and we do not record or store any media without your explicit action.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">4. How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>To provide personalised health tracking and diabetes reversal guidance</li>
          <li>To facilitate communication between patients and their assigned doctors</li>
          <li>To send reminders and health-related notifications</li>
          <li>To generate progress summaries for your care team</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">5. Data Sharing</h2>
        <p>
          Your health data is shared only with your assigned doctor(s) within the program. We do not sell,
          rent, or share your personal information with third parties for marketing purposes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">6. Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your data. All data is transmitted
          over encrypted connections (HTTPS).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">7. Your Rights</h2>
        <p>
          You may request deletion of your account and all associated data at any time from the Profile
          section of the app.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">8. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at:{" "}
          <a href="mailto:support@guduchi.com" className="text-primary underline">support@guduchi.com</a>
        </p>
      </section>
    </div>
  );
}