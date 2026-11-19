import { useEffect, useState } from 'react';

export function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const cb = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, []);
  return mobile;
}
