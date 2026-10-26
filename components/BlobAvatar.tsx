import type { EyeStyle } from "@/lib/bots";

// Round blob with white eyes, modeled on the Grok Bot splash-screen characters.
export function BlobAvatar({ color, eyes, size = 40 }: { color: string; eyes: EyeStyle; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="blob">
      <path
        d="M50 4c25 0 46 18 46 45 0 26-20 47-46 47S4 76 4 50C4 23 25 4 50 4z"
        fill={color}
      />
      <g fill="#fff" stroke="#fff">
        {eyes === "oval" && (
          <>
            <ellipse cx="37" cy="50" rx="7" ry="11" stroke="none" />
            <ellipse cx="63" cy="50" rx="7" ry="11" stroke="none" />
          </>
        )}
        {eyes === "bar" && (
          <>
            <rect x="31" y="40" width="11" height="24" rx="5.5" stroke="none" />
            <rect x="58" y="38" width="11" height="24" rx="5.5" stroke="none" />
          </>
        )}
        {eyes === "arc" && (
          <>
            <path d="M28 54a9 9 0 0 1 18 0" fill="none" strokeWidth="8" strokeLinecap="round" />
            <path d="M54 54a9 9 0 0 1 18 0" fill="none" strokeWidth="8" strokeLinecap="round" />
          </>
        )}
        {eyes === "dot" && (
          <>
            <circle cx="40" cy="48" r="8" stroke="none" />
            <circle cx="62" cy="44" r="6" stroke="none" />
          </>
        )}
      </g>
    </svg>
  );
}
