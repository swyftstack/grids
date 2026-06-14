import { useEffect, useState } from 'react';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { isModifier } from './platform';

/** Track whether the `.dark` theme class is currently applied to <html>. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.classList.contains('dark')));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/** Apply the resolved colour theme to <html>, tracking the OS preference in `system` mode. */
export function useThemeEffect(): void {
  const theme = useSettings((s) => s.settings.appearance.theme);
  const reduceMotion = useSettings((s) => s.settings.appearance.reduceMotion);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
    };
    apply();
    if (theme === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--sg-motion', reduceMotion ? '0' : '1');
  }, [reduceMotion]);
}

/**
 * Wire global keyboard shortcuts:
 *   ⌘/Ctrl+K        → the search (tables, columns, data)
 *   ⌘/Ctrl+Shift+P  → the command palette (switch databases, run commands)
 */
export function useGlobalHotkeys(): void {
  const { toggleCommandPalette, openSearch } = useUi();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isModifier(e) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        toggleCommandPalette();
      } else if (isModifier(e) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleCommandPalette, openSearch]);
}
