// Firebase web configuration — fill these in from your Firebase project.
// Firebase Console → Project Settings → Your apps → Add app → Web
export const firebaseConfig = {
  apiKey: "AIzaSyCqYbGxLZFU61uDL8C8MjB_xRCYpdr2mqA",
  authDomain: "guduchi-ayurveda-drp.firebaseapp.com",
  projectId: "guduchi-ayurveda-drp",
  storageBucket: "guduchi-ayurveda-drp.firebasestorage.app",
  messagingSenderId: "511099665271",
  appId: "1:511099665271:web:6dd1bb6fa570c88e9f7f72",
  measurementId: "G-3JLF7QJWK2"
};


// Web Push certificate key pair (VAPID key).
// Firebase Console → Messaging → Settings → Web Configuration → Generate key pair
// Copy the PUBLIC key here.
export const firebaseVapidKey = "BJSaILFVZqYtKE_KTNlr9IoKKP9rjWnW_m0bDQ_5f5yUsUWi7bTqmfMw29CrJUrCjdfBGlnzXRmR4jRnpO2SP2M";

// Helper to check if the config has been filled in
export const isFirebaseConfigured = () =>
  firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseVapidKey !== "YOUR_VAPID_PUBLIC_KEY";