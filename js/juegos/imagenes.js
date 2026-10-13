// ============================================================
// Ilustraciones propias para el rompecabezas (SVG cuadrado 600×600)
// ============================================================
import { canguro } from './util.js';

const nube = (x, y, s = 1) => `<g fill="#fff" opacity=".95" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="46" ry="22"/><ellipse cx="34" cy="-12" rx="34" ry="24"/><ellipse cx="-30" cy="-6" rx="28" ry="18"/></g>`;
const sol = (x, y) => `<g transform="translate(${x} ${y})"><g stroke="#FFB300" stroke-width="8" stroke-linecap="round">${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="-62" x2="0" y2="-80" transform="rotate(${i * 30})"/>`).join('')}</g><circle r="48" fill="#FFD23F" stroke="#FFB300" stroke-width="6"/></g>`;
const flor = (x, y, c) => `<g transform="translate(${x} ${y})"><line y2="26" stroke="#2E7D32" stroke-width="4"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="0" cy="-9" r="7" fill="${c}" transform="rotate(${a})"/>`).join('')}<circle r="6" fill="#FFD23F"/></g>`;
const llama = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-40" y="-10" width="80" height="40" rx="20" fill="${c}"/><rect x="22" y="-70" width="20" height="70" rx="10" fill="${c}"/>
  <ellipse cx="40" cy="-72" rx="18" ry="12" fill="${c}"/><ellipse cx="30" cy="-90" rx="5" ry="12" fill="${c}"/><ellipse cx="42" cy="-90" rx="5" ry="12" fill="${c}"/>
  <circle cx="44" cy="-74" r="3" fill="#3B2314"/>
  ${[-30, -12, 12, 30].map(l => `<rect x="${l - 4}" y="22" width="9" height="34" rx="4" fill="${c}"/>`).join('')}
  <path d="M-20 -8 h20 v34 h-20z" fill="#E5484D" opacity=".85"/><path d="M-20 0 h20 M-20 12 h20" stroke="#FFD23F" stroke-width="4"/></g>`;

const ESCENAS = {
  'p-campo': () => `
    <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6CC8F2"/><stop offset="1" stop-color="#D6F2FF"/></linearGradient></defs>
    <rect width="600" height="600" fill="url(#c)"/>${sol(480, 110)}${nube(130, 110)}${nube(330, 70, .8)}
    <path d="M0 360 Q150 260 300 330 T600 300 V600 H0Z" fill="#A9DB8A"/><path d="M0 420 Q200 360 400 410 T600 400 V600 H0Z" fill="#7CC456"/>
    <g fill="#E7C089">${Array.from({ length: 13 }, (_, i) => `<rect x="${i * 48 + 6}" y="392" width="12" height="58" rx="4"/>`).join('')}<rect y="404" width="600" height="9" rx="4"/><rect y="428" width="600" height="9" rx="4"/></g>
    <rect x="60" y="250" width="26" height="140" rx="8" fill="#8B5A2B"/><circle cx="73" cy="230" r="62" fill="#3E9B3A"/><circle cx="40" cy="260" r="40" fill="#4CAF50"/><circle cx="110" cy="255" r="44" fill="#4CAF50"/>
    <path d="M0 470 Q300 440 600 470 V600 H0Z" fill="#5FAE3E"/>
    ${flor(150, 500, '#EC4C93')}${flor(200, 530, '#8E5BE8')}${flor(470, 520, '#F28C0F')}${flor(530, 495, '#EC4C93')}
    <svg x="230" y="230" width="190" height="247" viewBox="0 0 200 260">${canguro({ estado: 'saluda' }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`,
  'p-andes': () => `
    <defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FA9E8"/><stop offset="1" stop-color="#CFEBFF"/></linearGradient></defs>
    <rect width="600" height="600" fill="url(#a)"/>${sol(110, 100)}${nube(420, 90)}
    <path d="M-20 380 L130 150 L230 300 L330 120 L470 330 L540 240 L640 380Z" fill="#7C8FA6"/>
    <path d="M130 150 L165 205 L150 200 L130 225 L112 200 L95 205Z M330 120 L372 183 L350 178 L330 205 L308 180 L288 186Z M540 240 L566 280 L540 272 L520 284Z" fill="#fff"/>
    <path d="M0 360 Q160 300 320 350 T600 330 V600 H0Z" fill="#8BC34A"/><path d="M0 430 Q300 380 600 430 V600 H0Z" fill="#689F38"/>
    <ellipse cx="420" cy="455" rx="140" ry="34" fill="#4FC3F7" stroke="#2A9BD6" stroke-width="5"/>
    ${llama(170, 470, 1.15, '#FFF3E0')}${llama(330, 520, .8, '#C49A6C')}
    ${flor(70, 540, '#EC4C93')}${flor(540, 545, '#FFD23F')}`,
  'p-mar': () => `
    <defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB86B"/><stop offset=".55" stop-color="#FFE0A3"/></linearGradient></defs>
    <rect width="600" height="600" fill="url(#m)"/>${sol(300, 250)}${nube(120, 90, .9)}${nube(480, 120)}
    <rect y="270" width="600" height="200" fill="#1E88E5"/>
    <g fill="none" stroke="#90CAF9" stroke-width="6" stroke-linecap="round">${[300, 340, 380, 420].map((y, k) => `<path d="M${20 + k * 30} ${y} q30 -14 60 0 t60 0 M${330 - k * 20} ${y + 14} q30 -14 60 0 t60 0"/>`).join('')}</g>
    <g transform="translate(410 300)"><path d="M-60 40 h120 l-24 30 h-72z" fill="#E5484D"/><rect x="-3" y="-80" width="6" height="120" fill="#5D4037"/><path d="M3 -78 L70 30 H3Z" fill="#fff"/><path d="M-3 -60 L-55 30 H-3Z" fill="#FFD23F"/></g>
    <path d="M0 450 Q300 410 600 450 V600 H0Z" fill="#F7D794"/>
    <g transform="translate(110 360)"><path d="M0 0 Q14 120 -6 210" stroke="#8B5A2B" stroke-width="16" fill="none" stroke-linecap="round"/>
      ${[-70, -30, 10, 50, 100].map(a => `<path d="M0 0 q60 -30 110 20 q-60 -10 -110 -20z" fill="#43A047" transform="rotate(${a})"/>`).join('')}</g>
    <g transform="translate(420 520)"><path d="M-80 0 Q0 -80 80 0Z" fill="#EC4C93"/><path d="M-80 0 Q-40 -50 0 -50 Q-20 -40 -27 0Z" fill="#fff" opacity=".5"/><rect x="-3" y="-50" width="6" height="80" fill="#5D4037"/></g>
    <circle cx="250" cy="540" r="16" fill="#FF7043"/><path d="M234 540 h32" stroke="#fff" stroke-width="4"/>`
};

export function imagenPuzzle(id) {
  const f = ESCENAS[id] || ESCENAS['p-campo'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">${f()}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

// Recorta una foto al centro en un cuadrado de 600 px
export function fotoCuadrada(archivo) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas'); c.width = c.height = 600;
      c.getContext('2d').drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 600, 600);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo abrir esa imagen. Prueba con otra foto.')); };
    img.src = url;
  });
}
