import type { CSSProperties } from 'react';
const paths = {
  check: 'M5 12l4 4L19 6', x: 'M6 6l12 12M18 6L6 18', search: 'M21 21l-5-5M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5', undo: 'M3 10h11a6 6 0 0 1 0 12M3 10l5-5M3 10l5 5',
  reset: 'M3 10a9 9 0 1 1 1 8M3 4v6h6', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18', box: 'm3 7 9-5 9 5v10l-9 5-9-5ZM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', edit: 'm15 4 5 5M3 21l4-1L21 6l-5-5L2 15v6Z',
  layers: 'm12 3 10 5-10 5L2 8ZM2 12l10 5 10-5M2 16l10 5 10-5',
  shield: 'm12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6ZM8 12l3 3 5-6',
  chevron: 'm9 5 7 7-7 7', chevronDown: 'm6 9 6 6 6-6', clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  warning: 'm12 3 10 18H2ZM12 9v5M12 17v.5', moon: 'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  copy: 'M9 9h12v12H9ZM15 9V3H3v12h6', leaf: 'M20 3C8 2 2 8 5 15s15 6 15-12ZM4 21 15 10',
  info: 'M12 11v6m0-10v.5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 18, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
