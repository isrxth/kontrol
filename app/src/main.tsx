import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { GlassProvider } from "@/components/glassyui/glass-provider"
import { AuthGate } from "@/components/AuthGate"

document.documentElement.style.background = 'transparent';
document.documentElement.style.backgroundColor = 'transparent';
document.body.style.background = 'transparent';
document.body.style.backgroundColor = 'transparent';

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
      <AuthGate>
        <App />
      </AuthGate>
    </div>
  </GlassProvider>,
)
