import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { GlassProvider } from "@/components/glassyui/glass-provider"

// Ensure no browser canvas default paints over the WebGL background,
// even when color-scheme:dark is active on the html element.
document.documentElement.style.background = 'transparent';
document.documentElement.style.backgroundColor = 'transparent';
document.body.style.background = 'transparent';
document.body.style.backgroundColor = 'transparent';

// Track the last input modality so focus rings can stay keyboard-only. Radix
// triggers (e.g. the dock tabs) receive focus programmatically on pointer-down,
// which makes Chromium match :focus-visible for mouse clicks too.
document.documentElement.dataset.input = 'pointer';
window.addEventListener(
  'pointerdown',
  () => {
    document.documentElement.dataset.input = 'pointer';
  },
  { capture: true },
);
window.addEventListener(
  'keydown',
  (event) => {
    if (event.key === 'Tab' || event.key.startsWith('Arrow') || event.key === 'Enter' || event.key === ' ') {
      document.documentElement.dataset.input = 'keyboard';
    }
  },
  { capture: true },
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme="dark">
    <div data-lg-theme="dark" className="min-h-screen">
      <App />
    </div>
  </GlassProvider>,
)