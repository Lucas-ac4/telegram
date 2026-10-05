import type { HairStyleId } from '../config/cosmetics';

/**
 * Íconos dibujados de cada peinado (SVG), en el color de pelo elegido.
 * Más claros que un emoji: se ve la forma real del corte.
 */
export function hairIcon(style: HairStyleId, hair: string): string {
  const face = `<circle cx="24" cy="28" r="12.5" fill="#f2b98b" stroke="#1d1a4f" stroke-width="2"/>
    <circle cx="19.5" cy="29" r="1.6" fill="#1d1a4f"/><circle cx="28.5" cy="29" r="1.6" fill="#1d1a4f"/>
    <path d="M20 34 q4 2.5 8 0" stroke="#1d1a4f" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const stroke = 'stroke="#1d1a4f" stroke-width="2" stroke-linejoin="round"';
  let back = '';
  let front = '';
  switch (style) {
    case 'corto':
      front = `<path d="M11.5 27 C11 15 20 12 26 13 C33 13 37.5 18 36.5 27 C33 22 29 20 24 21 C19 21 15 23 11.5 27 Z" fill="${hair}" ${stroke}/>`;
      break;
    case 'rapado':
      front = `<path d="M12 25 C13 17 19 14.5 24 14.5 C29 14.5 35 17 36 25 C31 21.5 17 21.5 12 25 Z" fill="${hair}" opacity="0.75" ${stroke}/>`;
      break;
    case 'melena':
      back = `<path d="M10 28 C9 15 18 11 24 11 C31 11 39 15 38 28 L39 41 L33 41 L33 30 L15 30 L15 41 L9 41 Z" fill="${hair}" ${stroke}/>`;
      front = `<path d="M12 26 C13 17 19 14 24 14 C30 14 35 17 36 26 C31 21 17 21 12 26 Z" fill="${hair}" ${stroke}/>`;
      break;
    case 'cresta':
      front = `<path d="M13 24 C14 19 18 17 21 16.5 L27 16.5 C30 17 34 19 35 24 C31 22 17 22 13 24 Z" fill="${hair}" opacity="0.55" ${stroke}/>
        <path d="M20 19 L19 6 L23 12 L24 3 L26 12 L30 6 L28 19 Z" fill="${hair}" ${stroke}/>`;
      break;
    case 'rulos':
      front = [
        [13, 22], [17, 16], [23, 13], [29, 14], [34, 18], [36, 24], [12, 27], [20, 19], [27, 19],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${hair}" ${stroke}/>`)
        .join('');
      break;
  }
  return `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">${back}${face}${front}</svg>`;
}
