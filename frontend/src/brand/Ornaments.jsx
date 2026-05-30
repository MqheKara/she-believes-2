// Brand ornaments authored to the DESIGN.md §8 spec (Lucide 1.75 stroke
// language, pink/gold/violet by surface). Self-contained inline SVGs.

export function FloralGarland({ size = 220, color = "var(--sb-pink)", className = "" }) {
  // A symmetric horizontal garland: center bloom + flanking leaves & buds.
  return (
    <svg width={size} height={size * 0.28} viewBox="0 0 440 124" fill="none"
      className={className} aria-hidden="true">
      <g stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
        {/* stems */}
        <path d="M220 70 C 170 70 140 50 96 54" />
        <path d="M220 70 C 270 70 300 50 344 54" />
        {/* left leaves */}
        <path d="M150 62 c -10 -14 -28 -16 -40 -8 c 12 8 30 6 40 8 Z" fill={color} fillOpacity="0.12" />
        <path d="M120 60 c -8 -12 -24 -13 -34 -6 c 10 7 26 5 34 6 Z" fill={color} fillOpacity="0.12" />
        {/* right leaves */}
        <path d="M290 62 c 10 -14 28 -16 40 -8 c -12 8 -30 6 -40 8 Z" fill={color} fillOpacity="0.12" />
        <path d="M320 60 c 8 -12 24 -13 34 -6 c -10 7 -26 5 -34 6 Z" fill={color} fillOpacity="0.12" />
        {/* side buds */}
        <circle cx="96" cy="54" r="6" fill={color} fillOpacity="0.18" />
        <circle cx="344" cy="54" r="6" fill={color} fillOpacity="0.18" />
      </g>
      {/* center bloom */}
      <g transform="translate(220 64)">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx="0" cy="-20" rx="11" ry="20" fill={color} fillOpacity="0.16"
            stroke={color} strokeWidth="1.75" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="9" fill={color} />
      </g>
    </svg>
  );
}

export function CrownMark({ size = 32, color = "var(--sb-gold)", className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M5 23 L4 11 L11 16 L16 7 L21 16 L28 11 L27 23 Z"
        fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.75"
        strokeLinejoin="round" strokeLinecap="round" />
      <path d="M5 26 L27 26" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" fill={color} />
      <circle cx="4" cy="11" r="1.6" fill={color} />
      <circle cx="28" cy="11" r="1.6" fill={color} />
    </svg>
  );
}

export function Sparkle({ size = 22, color = "var(--sb-pink)", className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 2 C 12.8 8 14 9.2 22 12 C 14 14.8 12.8 16 12 22 C 11.2 16 10 14.8 2 12 C 10 9.2 11.2 8 12 2 Z"
        fill={color} fillOpacity="0.85" />
    </svg>
  );
}

export function SBMonogram({ size = 160, color = "var(--sb-pink)", className = "", opacity = 1 }) {
  // Interlocked S+B inside a soft ring — hero decoration.
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" className={className}
      aria-hidden="true" style={{ opacity }}>
      <circle cx="100" cy="100" r="86" stroke={color} strokeWidth="1.75" strokeOpacity="0.4" />
      <circle cx="100" cy="100" r="74" stroke={color} strokeWidth="1.75" strokeOpacity="0.2" strokeDasharray="2 7" />
      <text x="100" y="128" textAnchor="middle" fontFamily="Playfair Display, serif"
        fontWeight="800" fontSize="96" fill={color} fillOpacity="0.92">S</text>
    </svg>
  );
}

export function Wordmark({ className = "", style = {} }) {
  return (
    <span className={`wordmark ${className}`} style={style}>
      <span className="she">She</span><span className="be">Believes</span>
    </span>
  );
}

export function Favicon() {
  return null;
}
