// Detects whether the app is running inside a native mobile app WebView
// (Base44 mobile build) or in a regular browser, and returns the platform
// identifier used for push-token registration.
export function detectPlatform() {
  const ua = navigator.userAgent || "";

  // iOS WKWebView — contains iPhone/iPad but NOT "Safari" (Safari in-app
  // browsers also lack it, but a true browser tab has it).
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\/[\d.]/.test(ua)) {
    return "ios";
  }

  // Android WebView — Chrome on Android has "Safari" in the UA (historical),
  // but Android System WebView / app WebViews contain "wv" or "AndroidWebView".
  if (/Android/.test(ua) && /wv\)|AndroidWebView|; wv/.test(ua)) {
    return "android";
  }

  return "web";
}

export function isMobileApp() {
  return detectPlatform() !== "web";
}