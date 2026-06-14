/** Platform helpers for keyboard hints and behaviour. */
export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** The display symbol for the primary modifier key (⌘ on macOS, Ctrl elsewhere). */
export const modSymbol = isMac ? '⌘' : 'Ctrl';

/** True when the platform's primary modifier is held for an event. */
export function isModifier(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}
