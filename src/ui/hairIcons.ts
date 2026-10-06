import type { HairStyleId } from '../config/cosmetics';

const INK = '#1d1a4f';
const SKIN = '#e3ae86';
const SKIN_SHADE = '#c98d66';

/** Aclara (amount > 0) u oscurece (amount < 0) un color #rrggbb. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Íconos de peinados: cabeza de frente ilustrada (piel, cejas, ojos, hombros) con el corte real
 * en degradé del color de pelo elegido, brillos y mechones. Un SVG por peinado.
 */
export function hairIcon(style: HairStyleId, hex: string, size = 44): string {
  const id = `hg-${style}`;
  const light = shade(hex, 0.28);
  const dark = shade(hex, -0.32);
  const defs = `<defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${hex}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex}" stop-opacity="0.85"/><stop offset="1" stop-color="${SKIN}" stop-opacity="0.0"/></linearGradient>
  </defs>`;
  const fill = `url(#${id})`;
  const line = `stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"`;
  const hl = (d: string, o = 0.5) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="1.7" stroke-linecap="round"/>`;

  // Hombros, cuello, cara con rasgos.
  const base = `
    <path d="M6 64 C6 52 16 47 26 46 L38 46 C48 47 58 52 58 64 Z" fill="#d6e9f8" ${line}/>
    <path d="M27 40 L27 48 C29 51 35 51 37 48 L37 40 Z" fill="${SKIN_SHADE}" ${line}/>
    <ellipse cx="18.8" cy="31" rx="2.3" ry="3.6" fill="${SKIN_SHADE}" ${line}/>
    <ellipse cx="45.2" cy="31" rx="2.3" ry="3.6" fill="${SKIN_SHADE}" ${line}/>
    <path d="M32 14 C41 14 46 22 46 31 C46 40 40 47 32 47 C24 47 18 40 18 31 C18 22 23 14 32 14 Z" fill="${SKIN}" ${line}/>`;
  const faceBits = `
    <path d="M23.5 28.2 Q26.5 26.6 29.5 28" fill="none" stroke="${dark}" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M34.5 28 Q37.5 26.6 40.5 28.2" fill="none" stroke="${dark}" stroke-width="1.7" stroke-linecap="round"/>
    <ellipse cx="26.6" cy="31.2" rx="1.5" ry="1.7" fill="${INK}"/><ellipse cx="37.4" cy="31.2" rx="1.5" ry="1.7" fill="${INK}"/>
    <path d="M32 31.5 L31 36.6 Q32 37.4 33.2 36.6" fill="none" stroke="${SKIN_SHADE}" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M28.6 41 Q32 43 35.4 41" fill="none" stroke="#a9524a" stroke-width="1.6" stroke-linecap="round"/>`;

  let behind = '';
  let front = '';
  switch (style) {
    case 'corto':
      // Corto clásico: volumen arriba y flequillo peinado hacia un costado.
      front = `<path d="M17.5 30 C15.5 14 25 7.5 33 8 C42.5 8.5 49 16 46.5 30 C45.5 25.5 43 22.5 40 21.5 C35 24 27 22.5 22.5 25 C20 26 18.5 27.5 17.5 30 Z" fill="${fill}" ${line}/>
        ${hl('M23 13.5 C27 10.5 34 10 39 12.5')}${hl('M22 19 C25 17 29 16.5 33 17.5', 0.35)}
        <path d="M22.5 25 C27 19.5 35 20 40 21.5" fill="none" stroke="${dark}" stroke-opacity="0.5" stroke-width="1.2"/>`;
      break;
    case 'rapado':
      // Rapado con degradé: casi nada abajo, un poco más arriba.
      front = `<path d="M18.2 29.5 C17.5 17 25 11.5 32 11.5 C39 11.5 46.5 17 45.8 29.5 C44.5 23.5 40 20 32 20 C24 20 19.5 23.5 18.2 29.5 Z" fill="url(#${id}-s)" ${line} stroke-opacity="0.35"/>
        <path d="M20 22 C22 15.5 27 12.5 32 12.5 C37 12.5 42 15.5 44 22 C40 18 24 18 20 22 Z" fill="${hex}" fill-opacity="0.8"/>
        ${hl('M24 15 C28 12.8 36 12.8 40 15', 0.35)}`;
      break;
    case 'melena':
      // Pelo largo hasta los hombros con raya al medio.
      behind = `<path d="M13 31 C10 12 22 6 32 6 C42 6 54 12 51 31 L54 56 L42 56 L41 38 L23 38 L22 56 L10 56 Z" fill="${fill}" ${line}/>`;
      front = `<path d="M17 33 C14.5 15 24 9 32 9 C40 9 49.5 15 47 33 C46.5 27 43 22 35.5 17.5 C34 20.5 29.5 24.5 24.5 25.5 C20.5 27 18 29.5 17 33 Z" fill="${fill}" ${line}/>
        <path d="M32 9.5 C32.6 12 33.5 14 35.5 17.5" fill="none" stroke="${dark}" stroke-opacity="0.6" stroke-width="1.2"/>
        <path d="M17 34 C14.5 44 12 52 11 62 L22 62 C21 52 21 43 22 36 Z" fill="${fill}" ${line}/>
        <path d="M47 34 C49.5 44 52 52 53 62 L42 62 C43 52 43 43 42 36 Z" fill="${fill}" ${line}/>
        ${hl('M21 14.5 C25 10.5 31 9.5 31 9.5', 0.5)}${hl('M14.5 44 L13.5 56', 0.4)}${hl('M49.5 44 L50.5 56', 0.4)}`;
      break;
    case 'cresta':
      // Cresta: laterales rapados y fila central de puntas.
      front = `<path d="M18.2 28 C17.8 18 24 13.5 32 13.5 C40 13.5 46.2 18 45.8 28 C44 23 40.5 21 32 21 C23.5 21 20 23 18.2 28 Z" fill="url(#${id}-s)" ${line} stroke-opacity="0.3"/>
        <path d="M26.2 22.5 L26.8 11 L29.2 14.8 L30 3.2 L32 11.6 L34 3.2 L34.8 14.8 L37.2 11 L37.8 22.5 C34 20.8 30 20.8 26.2 22.5 Z" fill="${fill}" ${line}/>
        ${hl('M30 6 L30.6 14', 0.55)}${hl('M34.5 6 L34.2 13', 0.4)}`;
      break;
    case 'rulos': {
      // Rulos: base corta y mechones rizados arriba.
      const curls = [
        [18, 24, 5.4], [22, 15.5, 6], [30, 11, 6.2], [38, 11.5, 6.2], [45, 16, 6], [47.5, 25, 5.2],
        [26, 17.5, 5.4], [34, 15.5, 6], [41, 19, 5.4], [20.5, 21.5, 4.6], [28.5, 21, 4.4], [36.5, 22, 4.4], [44, 23.5, 4.2],
      ];
      front = curls.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${line}/>`).join('') +
        hl('M24 11.5 C27 9 31 8.5 31 8.5', 0.5) + hl('M37 10 C40 9.5 43 11 44 13', 0.4);
      break;
    }
  }
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${defs}${behind}${base}${faceBits}${front}</svg>`;
}
