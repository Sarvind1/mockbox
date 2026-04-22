"use client";

export function PatternPreview({ id, size = 52 }: { id: string; size?: number }) {
  const s = size;
  switch (id) {
    case "carbon":
      return (
        <svg width={s} height={s} viewBox="0 0 8 8">
          <rect width="8" height="8" fill="#1a1a1a" />
          <rect x="0" y="0" width="4" height="4" fill="#2a2a2a" />
          <rect x="4" y="4" width="4" height="4" fill="#2a2a2a" />
          <rect x="1" y="1" width="2" height="2" fill="#333" />
          <rect x="5" y="5" width="2" height="2" fill="#333" />
        </svg>
      );
    case "brushed":
      return (
        <svg width={s} height={s} viewBox="0 0 8 8">
          <rect width="8" height="8" fill="#888" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={i} x1="0" y1={i} x2="8" y2={i} stroke={i % 2 ? "#9a9a9a" : "#777"} strokeWidth="0.5" />
          ))}
        </svg>
      );
    case "marble":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20">
          <rect width="20" height="20" fill="#f0ede8" />
          <path d="M0 5 Q5 8 10 4 Q15 0 20 6" fill="none" stroke="#c8c0b8" strokeWidth="1.5" />
          <path d="M0 12 Q7 16 12 10 Q17 4 20 14" fill="none" stroke="#b8b0a8" strokeWidth="2" />
        </svg>
      );
    case "snake":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#4a7a3a" />
          <ellipse cx="4" cy="4" rx="3" ry="2" fill="#3a6028" opacity="0.8" />
          <ellipse cx="12" cy="4" rx="3" ry="2" fill="#3a6028" opacity="0.8" />
          <ellipse cx="8" cy="8" rx="3" ry="2" fill="#3a6028" opacity="0.8" />
          <ellipse cx="4" cy="12" rx="3" ry="2" fill="#3a6028" opacity="0.8" />
          <ellipse cx="12" cy="12" rx="3" ry="2" fill="#3a6028" opacity="0.8" />
        </svg>
      );
    case "camo-g":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#3d5a2d" />
          <ellipse cx="4" cy="4" rx="4" ry="3" fill="#2a3d1e" />
          <ellipse cx="12" cy="8" rx="5" ry="3" fill="#4a6b34" />
          <ellipse cx="6" cy="13" rx="4" ry="3" fill="#1f2e14" />
        </svg>
      );
    case "camo-t":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#c4a962" />
          <ellipse cx="4" cy="4" rx="4" ry="3" fill="#8b6914" />
          <ellipse cx="12" cy="8" rx="5" ry="3" fill="#d4b872" />
          <ellipse cx="6" cy="13" rx="4" ry="3" fill="#6b4f10" />
        </svg>
      );
    case "camo-u":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#888" />
          <ellipse cx="4" cy="4" rx="4" ry="3" fill="#555" />
          <ellipse cx="12" cy="8" rx="5" ry="3" fill="#aaa" />
          <ellipse cx="6" cy="13" rx="4" ry="3" fill="#333" />
        </svg>
      );
    case "digi":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#5a6570" />
          <rect x="0" y="0" width="4" height="4" fill="#3a4550" />
          <rect x="8" y="0" width="4" height="4" fill="#3a4550" />
          <rect x="4" y="4" width="4" height="4" fill="#7a8590" />
          <rect x="12" y="4" width="4" height="4" fill="#3a4550" />
          <rect x="0" y="8" width="4" height="4" fill="#7a8590" />
          <rect x="8" y="8" width="4" height="4" fill="#4a5560" />
        </svg>
      );
    case "stripe":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#222" />
          <rect x="0" y="5" width="16" height="3" fill="#e53" />
          <rect x="0" y="9" width="16" height="1.5" fill="#fff" />
        </svg>
      );
    case "check":
      return (
        <svg width={s} height={s} viewBox="0 0 8 8">
          <rect width="8" height="8" fill="#fff" />
          <rect x="0" y="0" width="2" height="2" fill="#000" />
          <rect x="4" y="0" width="2" height="2" fill="#000" />
          <rect x="2" y="2" width="2" height="2" fill="#000" />
          <rect x="6" y="2" width="2" height="2" fill="#000" />
          <rect x="0" y="4" width="2" height="2" fill="#000" />
          <rect x="4" y="4" width="2" height="2" fill="#000" />
          <rect x="2" y="6" width="2" height="2" fill="#000" />
          <rect x="6" y="6" width="2" height="2" fill="#000" />
        </svg>
      );
    case "flames":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#111" />
          <path d="M2 16 Q4 10 3 6 Q6 9 5 4 Q8 8 7 2 Q10 7 9 4 Q12 10 11 14 Q8 11 9 16Z" fill="#f55" />
          <path d="M3 16 Q5 11 4 7 Q7 10 6 5 Q9 9 8 3 Q11 8 10 5 Q13 11 12 15 Q9 12 10 16Z" fill="#fa3" opacity="0.7" />
        </svg>
      );
    case "hex":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20">
          <rect width="20" height="20" fill="#1a1f2e" />
          <polygon points="10,2 16,6 16,14 10,18 4,14 4,6" fill="none" stroke="#4a5570" strokeWidth="0.8" />
        </svg>
      );
    case "circuit":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#0a1a0a" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="#0f0" strokeWidth="0.5" />
          <line x1="8" y1="2" x2="8" y2="14" stroke="#0f0" strokeWidth="0.5" />
          <circle cx="8" cy="8" r="1.5" fill="#0f0" />
          <circle cx="4" cy="4" r="0.8" fill="#0f0" />
        </svg>
      );
    case "wave":
      return (
        <svg width={s} height={s} viewBox="0 0 16 8">
          <rect width="16" height="8" fill="#1a2a4a" />
          <path d="M0 4 Q2 1 4 4 Q6 7 8 4 Q10 1 12 4 Q14 7 16 4" fill="none" stroke="#4a8af4" strokeWidth="1.2" />
        </svg>
      );
    case "dots":
      return (
        <svg width={s} height={s} viewBox="0 0 10 10">
          <rect width="10" height="10" fill="#111" />
          <circle cx="2.5" cy="2.5" r="1" fill="#4a8af4" />
          <circle cx="7.5" cy="2.5" r="1" fill="#4a8af4" />
          <circle cx="2.5" cy="7.5" r="1" fill="#4a8af4" />
          <circle cx="7.5" cy="7.5" r="1" fill="#4a8af4" />
        </svg>
      );
    case "splat":
      return (
        <svg width={s} height={s} viewBox="0 0 20 20">
          <rect width="20" height="20" fill="#111" />
          <circle cx="8" cy="8" r="3" fill="#e53" opacity="0.9" />
          <circle cx="14" cy="5" r="1.5" fill="#e53" opacity="0.7" />
          <circle cx="5" cy="14" r="2" fill="#4a8" opacity="0.8" />
          <circle cx="15" cy="13" r="2.5" fill="#fa3" opacity="0.75" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#2a2a2a" />
        </svg>
      );
  }
}
