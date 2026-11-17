import app from './app.js';

const PORT = process.env.PORT || 3001;

if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Kontrol API running on http://localhost:${PORT}`);
  });
}

export default app;