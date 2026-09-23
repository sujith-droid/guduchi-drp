// Firebase web configuration — fill these in from your Firebase project.
// Firebase Console → Project Settings → Your apps → Add app → Web
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Web Push certificate key pair (VAPID key).
// Firebase Console → Messaging → Settings → Web Configuration → Generate key pair
// Copy the PUBLIC key here.
export const firebaseVapidKey = "YOUR_VAPID_PUBLIC_KEY";

// Helper to check if the config has been filled in
export const isFirebaseConfigured = () =>
  firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseVapidKey !== "YOUR_VAPID_PUBLIC_KEY";