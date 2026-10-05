import type { Kit } from '../config/cosmetics';

const INK = '#1d1a4f';

/** Camiseta dibujada en SVG con el diseño real del equipo (rayas, banda, diagonal, vivos o lisa). */
export function kitIcon(k: Kit, size = 46): string {
  const id = `k-${k.id}`;
  const body = 'M19 10 L19 55 L45 55 L45 10 Z';
  let pattern = '';
  switch (k.pattern) {
    case 'stripes':
      for (let x = 21; x < 45; x += 7) pattern += `<rect x="${x}" y="8" width="3.6" height="48" fill="${k.accent}"/>`;
      break;
    case 'band':
      pattern = `<rect x="18" y="29" width="28" height="11" fill="${k.accent}"/>`;
      break;
    case 'sash':
      pattern = `<polygon points="19,14 28,12 45,46 45,55 36,55 19,22" fill="${k.accent}"/>`;
      break;
    case 'trim':
      pattern = `<rect x="18" y="49" width="28" height="4" fill="${k.accent}"/><rect x="18" y="10" width="28" height="3" fill="${k.accent}"/>`;
      break;
    default:
      pattern = `<rect x="18" y="47" width="28" height="8" fill="rgba(0,0,0,0.08)"/>`;
  }
  const trim = k.pattern === 'solid' ? k.number : k.accent;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs>
    <path d="M20 8 L7 16 L11 29 L19 26 L19 55 L45 55 L45 26 L53 29 L57 16 L44 8 C41 14 23 14 20 8 Z" fill="${k.base}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <g clip-path="url(#${id})">${pattern}</g>
    <path d="M20 8 L7 16 L11 29 L19 26 L19 14 Z" fill="${k.sleeve}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M44 8 L57 16 L53 29 L45 26 L45 14 Z" fill="${k.sleeve}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M24 9 C28 16 36 16 40 9" fill="none" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>
    <path d="M24 9 C28 16 36 16 40 9" fill="none" stroke="${INK}" stroke-width="0.9" stroke-linecap="round" opacity="0.5"/>
    <path d="M23 20 L23 50" stroke="#fff" stroke-opacity="0.18" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

/** Mechón de pelo del color elegido (para la pestaña y las opciones de color). */
export function hairColorIcon(hex: string, size = 44): string {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
    <path d="M10 44 C6 22 22 8 36 10 C50 12 60 26 55 46 C52 36 45 31 36 32 C27 33 19 38 10 44 Z" fill="${hex}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="M20 26 C26 18 36 16 44 20" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M14 44 C26 38 40 36 52 44" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}
