import React from "react";

// A real file input stretched invisibly over an icon button. The user's tap lands
// directly on the input, so the picker/camera opens reliably on mobile browsers and
// native app WebViews (programmatic .click() on a hidden input often does not).
export default function ChatAttachButton({ label, icon: Icon, accept, capture, disabled, onChange }) {
  const handleChange = (e) => {
    onChange(e);
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  };

  return (
    <label
      className={`relative shrink-0 inline-flex items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] rounded-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <Icon className="h-5 w-5" />
      <input
        type="file"
        aria-label={label}
        accept={accept}
        capture={capture}
        disabled={disabled}
        onChange={handleChange}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
      />
    </label>
  );
}