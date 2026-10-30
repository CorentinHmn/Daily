import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import './styles/app.css';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';
import { applyBackdrop, applyGlass, savedBackdrop, savedGlass } from './ui/backdrop';

// This device's last background photo and glass from the first frame (the person's choice is applied again once known).
applyBackdrop(savedBackdrop());
applyGlass(savedGlass());

// Installed app (iPhone home screen): looks for a new version at start, on every return to the app and every hour;
// autoUpdate then reloads the page once the new version has taken over (otherwise the old one stayed until the app
// was closed for good).
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine) void reg.update();
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, 60 * 60 * 1000);
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
