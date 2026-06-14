import { useEffect, useState } from 'react';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Landing } from './pages/Landing';
import { THEME_KEY } from './lib/brand';

export function App() {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);

  return (
    <div id="top" className="min-h-screen">
      <Nav dark={dark} onToggleTheme={() => setDark((d) => !d)} />
      <Landing />
      <Footer />
    </div>
  );
}
