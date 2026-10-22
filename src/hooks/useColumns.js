import { useEffect, useState } from 'react';

const pick = (bps) => {
  for (const [minWidth, cols] of bps) {
    if (window.matchMedia(`(min-width: ${minWidth}px)`).matches) return cols;
  }
  return bps[bps.length - 1][1];
};

/** Number of columns for the current viewport. `bps` = [[minWidth, cols], …] widest first. */
export function useColumns(bps = [[1100, 4], [700, 3], [0, 2]]) {
  const [cols, setCols] = useState(() => (typeof window === 'undefined' ? bps[0][1] : pick(bps)));
  useEffect(() => {
    const onResize = () => setCols(pick(bps));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return cols;
}
