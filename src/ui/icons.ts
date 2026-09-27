// Hand-built SVG icons in the game's chunky, outlined candy style.
const S = (inner: string, vb = '0 0 32 32') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

const INK = '#2b1740';

export const ICON = {
  goo: S(`<defs><radialGradient id="gg" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#eaffc0"/><stop offset=".45" stop-color="#8ef05a"/><stop offset="1" stop-color="#2fae3a"/></radialGradient></defs>
    <path d="M16 3 C16 3 6 14 6 20 a10 10 0 0 0 20 0 C26 14 16 3 16 3Z" fill="url(#gg)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <ellipse cx="12" cy="18" rx="2.6" ry="3.8" fill="#fff" opacity=".85" transform="rotate(20 12 18)"/>`),
  gem: S(`<defs><linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc2f0"/><stop offset=".5" stop-color="#ff5fb8"/><stop offset="1" stop-color="#c02a8a"/></linearGradient></defs>
    <path d="M9 5 h14 l6 8 -13 15 L3 13Z" fill="url(#gm)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M3 13 h26 M11 5 l-2 8 7 15 7-15 -2-8" fill="none" stroke="${INK}" stroke-width="1.4" opacity=".45"/>
    <path d="M10 8 l-2 4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`),
  gear: S(`<path d="M16 4l2.5 3 3.8-1 .6 3.9 3.6 1.5-1.6 3.6L27 18l-3.4 2 .1 3.9-3.9.3L18 28l-2-.8-2 .8-1.8-3.8-3.9-.3.1-3.9L5 18l2.1-3-1.6-3.6 3.6-1.5.6-3.9 3.8 1z" fill="#d7dcf5" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="16" cy="16" r="4.2" fill="#8a8fb8" stroke="${INK}" stroke-width="2.2"/>`),
  chest: S(`<defs><linearGradient id="ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc47a"/><stop offset="1" stop-color="#c9772e"/></linearGradient></defs>
    <path d="M4 14 h24 v12 a2 2 0 0 1-2 2 H6 a2 2 0 0 1-2-2Z" fill="url(#ch)" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M4 14 v-2 a8 7 0 0 1 8-7 h8 a8 7 0 0 1 8 7 v2Z" fill="#ffb35c" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M4 14 h24" stroke="${INK}" stroke-width="2.3"/><rect x="13" y="12" width="6" height="7" rx="1.5" fill="#ffe45c" stroke="${INK}" stroke-width="2"/>`),
  tv: S(`<rect x="3" y="7" width="26" height="19" rx="5" fill="#8a5cff" stroke="${INK}" stroke-width="2.3"/><path d="M13 12 v9 l8-4.5z" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 3 l5 4 5-4" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
  play: S(`<circle cx="16" cy="16" r="12" fill="#fff" opacity=".25"/><path d="M12 9 v14 l12-7z" fill="#fff"/>`),
  book: S(`<path d="M5 6 a3 3 0 0 1 3-3 h17 v22 H8 a3 3 0 0 0-3 3Z" fill="#5ec8ff" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><path d="M5 28 a3 3 0 0 1 3-3 h17 v4 H8 a3 3 0 0 1-3-1" fill="#fff" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><circle cx="15" cy="13" r="4.5" fill="#a8ffc4" stroke="${INK}" stroke-width="2"/>`),
  up: S(`<path d="M16 4 L28 17 h-7 v11 h-10 V17 H4Z" fill="#7dff9a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M13 20 v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`),
  bag: S(`<path d="M6 11 h20 l-2 17 H8Z" fill="#ffb35c" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><path d="M11 11 v-2 a5 5 0 0 1 10 0 v2" fill="none" stroke="${INK}" stroke-width="2.3"/><path d="M16 16 l1.4 2.8 3 .4-2.2 2.1.5 3-2.7-1.4-2.7 1.4.5-3-2.2-2.1 3-.4z" fill="#fff" />`),
  home: S(`<path d="M4 15 L16 4 28 15 v12 a1 1 0 0 1-1 1 H5 a1 1 0 0 1-1-1Z" fill="#a8ffc4" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><rect x="12" y="18" width="8" height="10" rx="2" fill="#ffb35c" stroke="${INK}" stroke-width="2"/>`),
  close: S(`<path d="M9 9 L23 23 M23 9 L9 23" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`),
  gift: S(`<rect x="5" y="13" width="22" height="15" rx="2" fill="#ff5fa2" stroke="${INK}" stroke-width="2.3"/><rect x="3" y="9" width="26" height="6" rx="2" fill="#ff8fc0" stroke="${INK}" stroke-width="2.3"/><path d="M16 9 v19" stroke="#ffe45c" stroke-width="4"/><path d="M16 9 c-3-6-10-5-8-1 2 3 8 1 8 1 c3-6 10-5 8-1 -2 3-8 1-8 1" fill="#ffe45c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`),
  calendar: S(`<rect x="4" y="6" width="24" height="22" rx="4" fill="#fff" stroke="${INK}" stroke-width="2.3"/><path d="M4 12 h24 v-2 a4 4 0 0 0-4-4 H8 a4 4 0 0 0-4 4Z" fill="#ff5fa2" stroke="${INK}" stroke-width="2.3"/><path d="M10 3 v6 M22 3 v6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M16 15 l1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="#ffcf3d" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`),
  bolt: S(`<path d="M18 3 L6 18 h8 l-2 11 L26 13 h-8z" fill="#ffe45c" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>`),
  lock: S(`<rect x="7" y="14" width="18" height="14" rx="3" fill="#b8b0d8" stroke="${INK}" stroke-width="2.3"/><path d="M11 14 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="${INK}" stroke-width="2.3"/>`),
  check: S(`<path d="M7 17 l6 6 L25 9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  ribbon: S(`<path d="M11 18 L7 29 l5-2 3 4 3-9 M21 18 l4 11-5-2-3 4-3-9" fill="#5ec8ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="13" r="9" fill="#ffcf3d" stroke="${INK}" stroke-width="2.3"/><circle cx="16" cy="13" r="5" fill="#fff3a0" stroke="${INK}" stroke-width="1.6"/>`),
  egg: S(`<path d="M16 3 C23 3 26 14 26 19 a10 9 0 0 1-20 0 C6 14 9 3 16 3Z" fill="#fff6ea" stroke="${INK}" stroke-width="2.3"/><circle cx="12" cy="13" r="2.4" fill="#5be08c"/><circle cx="20" cy="19" r="3" fill="#5be08c"/><circle cx="13" cy="23" r="1.8" fill="#5be08c"/>`),
  sound: S(`<path d="M5 12 h5 l7-6 v20 l-7-6 H5Z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M21 11 a6 6 0 0 1 0 10 M24 7 a11 11 0 0 1 0 18" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`),
  music: S(`<path d="M12 23 V7 l14-3 v16" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="9" cy="23" r="4" fill="#ff8fc0" stroke="${INK}" stroke-width="2.2"/><circle cx="23" cy="20" r="4" fill="#ff8fc0" stroke="${INK}" stroke-width="2.2"/>`),
  phone: S(`<rect x="9" y="3" width="14" height="26" rx="3" fill="#fff" stroke="${INK}" stroke-width="2.2"/><path d="M4 11 v10 M28 11 v10" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`),
  sparkle: S(`<path d="M16 2 C17 11 21 15 30 16 C21 17 17 21 16 30 C15 21 11 17 2 16 C11 15 15 11 16 2Z" fill="#fff3a0" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`),
  hat: S(`<path d="M8 24 h16 l-3-14 a5 5 0 0 0-10 0Z" fill="#8a5cff" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><ellipse cx="16" cy="24" rx="12" ry="3.5" fill="#6a3fd6" stroke="${INK}" stroke-width="2.3"/><rect x="10.5" y="18" width="11" height="3" fill="#ffcf3d"/>`),
  paint: S(`<path d="M16 4 a12 11 0 1 0 0 22 c2 0 2-3 0-4 -2-2 0-5 3-5 h4 a5 5 0 0 0 5-5 C28 7 22 4 16 4Z" fill="#fff6ea" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><circle cx="10" cy="12" r="2.3" fill="#ff5fa2"/><circle cx="15" cy="8.5" r="2.3" fill="#ffcf3d"/><circle cx="21" cy="10" r="2.3" fill="#5ec8ff"/><circle cx="9" cy="18" r="2.3" fill="#7dff9a"/>`),
  noads: S(`<circle cx="16" cy="16" r="12" fill="#fff" stroke="${INK}" stroke-width="2.3"/><text x="16" y="20" font-size="10" font-family="Fredoka,sans-serif" font-weight="700" text-anchor="middle" fill="${INK}">AD</text><path d="M7.5 7.5 L24.5 24.5" stroke="#ff4d6d" stroke-width="3.2" stroke-linecap="round"/>`),
  crown: S(`<path d="M4 24 L3 9 l7 6 6-10 6 10 7-6-1 15Z" fill="#ffcf3d" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><rect x="4" y="24" width="24" height="4" rx="1" fill="#f0a800" stroke="${INK}" stroke-width="2.3"/>`),
  info: S(`<circle cx="16" cy="16" r="12" fill="#5ec8ff" stroke="${INK}" stroke-width="2.3"/><path d="M16 14 v8" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="16" cy="10" r="2" fill="#fff"/>`),
  berry: S(`<path d="M16 9 c-3-5-8-5-10-2 3 1 6 2 10 2 c3-4 7-5 10-3-2 2-6 3-10 3" fill="#5cc94b" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="11" cy="18" r="6" fill="#ff4d7a" stroke="${INK}" stroke-width="2.2"/><circle cx="21" cy="18" r="6" fill="#ff4d7a" stroke="${INK}" stroke-width="2.2"/><circle cx="16" cy="24" r="6" fill="#ff6b92" stroke="${INK}" stroke-width="2.2"/>
    <circle cx="9" cy="16" r="1.6" fill="#fff" opacity=".9"/><circle cx="19" cy="16" r="1.6" fill="#fff" opacity=".9"/><circle cx="14" cy="22" r="1.6" fill="#fff" opacity=".9"/>`),
  jelly: S(`<path d="M10 7 C4 9 4 17 8 22 C12 27 20 28 24 24 C28 20 28 12 23 9 C19 6 14 5 10 7Z" fill="#b894ff" stroke="${INK}" stroke-width="2.3" transform="rotate(-25 16 16)"/>
    <ellipse cx="12" cy="12" rx="3" ry="1.8" fill="#fff" opacity=".85" transform="rotate(-35 12 12)"/><circle cx="20" cy="19" r="1.4" fill="#fff" opacity=".6"/>`),
  apple: S(`<path d="M16 9 C10 5 4 9 5 17 C6 25 11 29 16 27 C21 29 26 25 27 17 C28 9 22 5 16 9Z" fill="#ffc400" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M16 9 q1-4 3-6" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M17 6 c3-3 7-2 8 0 -3 2-6 2-8 0Z" fill="#5cc94b" stroke="${INK}" stroke-width="1.6"/>
    <ellipse cx="10" cy="14" rx="2" ry="3.4" fill="#fff" opacity=".85" transform="rotate(20 10 14)"/>`),
  hand: S(`<path d="M9 17 V9 a2 2 0 0 1 4 0 v6 V6 a2 2 0 0 1 4 0 v9 V8 a2 2 0 0 1 4 0 v8 v-4 a2 2 0 0 1 4 0 v8 c0 5-4 9-9 9 h-1 c-4 0-6-2-8-5 l-3-5 a2 2 0 0 1 3-2Z" fill="#ffd9b8" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 3 c1-2 4-1 3 1 l-3 3 -3-3 c-1-2 2-3 3-1Z" fill="#ff5f8f" stroke="${INK}" stroke-width="1.2"/>`),
  ticket: S(`<path d="M3 10 a2 2 0 0 1 2-2 h22 a2 2 0 0 1 2 2 v3 a3 3 0 0 0 0 6 v3 a2 2 0 0 1-2 2 H5 a2 2 0 0 1-2-2 v-3 a3 3 0 0 0 0-6Z" fill="#ffd23f" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M11 9 v14" stroke="${INK}" stroke-width="1.6" stroke-dasharray="2 2"/><path d="M19 12.5 l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" fill="#ff5fa2" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`),
  game: S(`<path d="M8 10 h16 a6 6 0 0 1 6 6 v3 a5 5 0 0 1-9 3 l-1-1 h-8 l-1 1 a5 5 0 0 1-9-3 v-3 a6 6 0 0 1 6-6Z" fill="#5ec8ff" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><path d="M10 14 v6 M7 17 h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="21" cy="15.5" r="1.8" fill="#ff5fa2"/><circle cx="24.5" cy="19" r="1.8" fill="#ffd23f"/>`),
  fence: S(`<path d="M3 13 h26 M3 21 h26" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M3 13 h26 M3 21 h26" stroke="#e0a060" stroke-width="3.6" stroke-linecap="round"/>
    ${[6, 16, 26].map((x) => `<path d="M${x - 3} 28 V8 l3-4 3 4 v20Z" fill="#f2b872" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>`).join('')}`),
  sunny: S(`<g stroke="${INK}" stroke-width="2.2" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<path d="M${16 + Math.cos(a) * 10} ${16 + Math.sin(a) * 10} L${16 + Math.cos(a) * 14} ${16 + Math.sin(a) * 14}"/>`; }).join('')}</g><circle cx="16" cy="16" r="7.5" fill="#ffd23f" stroke="${INK}" stroke-width="2.3"/>`),
  cloudy: S(`<circle cx="21" cy="11" r="5.5" fill="#ffd23f" stroke="${INK}" stroke-width="2"/><path d="M8 26 a5 5 0 0 1 0-10 a7 7 0 0 1 13-2 a5.5 5.5 0 0 1 3 12Z" fill="#fff" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>`),
  rain: S(`<path d="M8 19 a5 5 0 0 1 0-10 a7 7 0 0 1 13-2 a5.5 5.5 0 0 1 3 12Z" fill="#dfe8ff" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><path d="M10 23 l-2 5 M16 23 l-2 5 M22 23 l-2 5" stroke="#3a8bff" stroke-width="2.6" stroke-linecap="round"/>`),
  storm: S(`<path d="M8 19 a5 5 0 0 1 0-10 a7 7 0 0 1 13-2 a5.5 5.5 0 0 1 3 12Z" fill="#9aa6c8" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/><path d="M17 17 l-5 7 h4 l-2 6 7-9 h-4 l2-4z" fill="#ffe45c" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`),
  snow: S(`<g stroke="${INK}" stroke-width="2.4" stroke-linecap="round"><path d="M16 3 v26 M4.7 9.5 l22.6 13 M4.7 22.5 l22.6-13"/></g><g stroke="#9fdcff" stroke-width="1.2" stroke-linecap="round"><path d="M16 3 v26 M4.7 9.5 l22.6 13 M4.7 22.5 l22.6-13"/></g><circle cx="16" cy="16" r="3.4" fill="#fff" stroke="${INK}" stroke-width="2"/>`),
  windy: S(`<path d="M3 11 h15 a4 4 0 1 0-4-4 M3 17 h22 a4 4 0 1 1-4 4 M3 23 h10" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M24 6 c3 0 4 3 2 5 -2-1-3-3-2-5Z" fill="#7ee06a" stroke="${INK}" stroke-width="1.4"/>`),
  rainbow: S(`${['#ff5d6c', '#ffb35c', '#ffe45c', '#7ee06a', '#5ec8ff', '#9a6bff'].map((c, i) => `<path d="M${3 + i * 1.8} 25 a${13 - i * 1.8} ${13 - i * 1.8} 0 0 1 ${26 - i * 3.6} 0" fill="none" stroke="${c}" stroke-width="2"/>`).join('')}<path d="M2 25 a14 14 0 0 1 28 0" fill="none" stroke="${INK}" stroke-width="1.6"/><ellipse cx="6" cy="26" rx="5" ry="3" fill="#fff" stroke="${INK}" stroke-width="1.8"/><ellipse cx="26" cy="26" rx="5" ry="3" fill="#fff" stroke="${INK}" stroke-width="1.8"/>`),
};

export type IconName = keyof typeof ICON;
let uid = 0;
/** Gradient ids are made unique per instance so hidden copies never break visible ones. */
export const icon = (n: IconName, cls = '') => {
  const k = ++uid;
  const svg = ICON[n].replace(/id="(\w+)"/g, `id="$1_${k}"`).replace(/url\(#(\w+)\)/g, `url(#$1_${k})`);
  return `<span class="ico ${cls}">${svg}</span>`;
};
