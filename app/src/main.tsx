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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme="dark">
    <div data-lg-theme="dark" className="min-h-screen">
      <App />
    </div>
  </GlassProvider>,
)