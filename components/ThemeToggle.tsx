"use client";

// Switches between light and dark and remembers the choice on this device.
export function ThemeToggle({ compact }: { compact?: boolean }) {
  function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `jt_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button type="button" onClick={toggle} className={compact ? "btn btn-sm" : "btn btn-sm w-full"} aria-label="Switch between light and dark mode">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
      </svg>
      {compact ? null : "Light / dark"}
    </button>
  );
}
