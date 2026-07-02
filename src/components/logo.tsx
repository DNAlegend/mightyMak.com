// The MightyMak mark: an "M" built from pixels, with a couple of pixels
// drifting off the top — content assembling itself, one pixel at a time.
// Animation-studio energy; reads crisply from favicon size up.

const PIXEL = 5;
const GAP = 1;
const MARGIN = 5.5;

/** 5×5 grid cells forming the M. */
const CELLS: Array<[number, number]> = [
  [0, 0], [4, 0],
  [0, 1], [1, 1], [3, 1], [4, 1],
  [0, 2], [2, 2], [4, 2],
  [0, 3], [4, 3],
  [0, 4], [4, 4],
];

const at = (n: number) => MARGIN + n * (PIXEL + GAP);

export function LogoMark({
  size = 36,
  animated = true,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="mm-px" x1="5" y1="35" x2="35" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c6cff" />
          <stop offset="0.55" stopColor="#c05dff" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>

      {/* tile */}
      <rect width="40" height="40" rx="10" fill="#0d0d15" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="none" stroke="rgba(255,255,255,0.1)" />

      {/* the pixel M */}
      <g fill="url(#mm-px)">
        {CELLS.map(([c, r]) => (
          <rect key={`${c}-${r}`} x={at(c)} y={at(r)} width={PIXEL} height={PIXEL} rx="1.4" />
        ))}
      </g>

      {/* pixels drifting off the mark */}
      <g fill="#2dd4bf">
        <rect x="23.6" y="1.6" width="3.2" height="3.2" rx="1">
          {animated && (
            <>
              <animate attributeName="opacity" values="0.35;1;0.35" dur="2.6s" repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="translate" values="0 0;0 -1.2;0 0" dur="2.6s" repeatCount="indefinite" />
            </>
          )}
        </rect>
      </g>
      <g fill="#ff5d8f">
        <rect x="17.8" y="0.9" width="2.2" height="2.2" rx="0.8">
          {animated && (
            <>
              <animate attributeName="opacity" values="0.9;0.25;0.9" dur="3.4s" repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="translate" values="0 0;0 -0.9;0 0" dur="3.4s" repeatCount="indefinite" />
            </>
          )}
        </rect>
      </g>
    </svg>
  );
}
