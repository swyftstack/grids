import { useEffect, useState } from 'react';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Landing } from './pages/Landing';
import { Downloads } from './pages/Downloads';
import { Releases } from './pages/Releases';
import { Changelog } from './pages/Changelog';
import { THEME_KEY } from './lib/brand';
import { useRoute } from './lib/router';

export function App() {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  const route = useRoute();

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
      {route === 'downloads' ? (
        <Downloads />
      ) : route === 'releases' ? (
        <Releases />
      ) : route === 'changelog' ? (
        <Changelog />
      ) : (
        <Landing />
      )}
      <Footer />
    </div>
  );
}
