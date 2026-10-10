import { useEffect, useState } from 'react';

/** Phone-sized layout; keep in sync with the `max-width: 700px` media queries in the CSS. */
export const MOBILE_QUERY = '(max-width: 700px)';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Whether a CSS media query currently matches, updating as the window resizes or rotates. */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return match;
}

export const isMobileNow = () => matches(MOBILE_QUERY);
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
