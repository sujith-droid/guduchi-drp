// Detects whether the app is running inside a native mobile app WebView
// (Base44 mobile build) or in a regular browser, and returns the platform
// identifier used for push-token registration.
// Device-OS detection used for push-token registration.
// Returns "ios" / "android" on phones (browser OR native app WebView),
// "web" on desktop browsers.
export function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}

// True ONLY inside a native Base44 mobile app WebView (where web FCM
// service-worker registration cannot run). Mobile browsers return false.
export function isMobileApp() {
  const ua = navigator.userAgent || "";
  // iOS WKWebView — iPhone/iPad but NOT a full Safari browser match.
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\/[\d.]/.test(ua)) return true;
  // Android WebView — contains "wv" or "AndroidWebView".
  if (/Android/.test(ua) && /wv\)|AndroidWebView|; wv/.test(ua)) return true;
  return false;
}