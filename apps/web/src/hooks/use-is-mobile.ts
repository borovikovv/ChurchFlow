'use client';

import { useEffect, useState } from 'react';

const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const updateIsMobile = () => setIsMobile(query.matches);

    updateIsMobile();
    query.addEventListener('change', updateIsMobile);

    return () => query.removeEventListener('change', updateIsMobile);
  }, []);

  return isMobile;
}
