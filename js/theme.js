/**
 * Theme module - dark / light mode toggle
 * Persists choice in localStorage; falls back to OS preference.
 */

const STORAGE_KEY = 'bone_theme';

/** Detect the preferred theme (saved > OS > light) */
function getPreferred() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/** Apply a theme to the document */
function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Initialise theme on page load (call early) */
export function initTheme() {
  apply(getPreferred());
}

/** Toggle between dark and light, persist, return new theme */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  apply(next);
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

/** Return current active theme */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}
