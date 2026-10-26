// The NovaBot mark: a four-point star flaring out of a warm glow (a "nova") on a dark tile.
// Kept as one SVG string so the favicon, the home-screen icon and the in-app logo stay identical.
export const NOVA_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="nova-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FFE7A3"/>
      <stop offset="0.35" stop-color="#FF9F43" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#FF5A3C" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="#111114"/>
  <circle cx="32" cy="32" r="24" fill="url(#nova-glow)"/>
  <path d="M32 7 C33.6 24.5 39.5 30.4 57 32 C39.5 33.6 33.6 39.5 32 57 C30.4 39.5 24.5 33.6 7 32 C24.5 30.4 30.4 24.5 32 7 Z" fill="#FFFFFF"/>
  <path d="M48.5 10 C49 14.2 50.3 15.5 54.5 16 C50.3 16.5 49 17.8 48.5 22 C48 17.8 46.7 16.5 42.5 16 C46.7 15.5 48 14.2 48.5 10 Z" fill="#FFD27A"/>
</svg>`;
