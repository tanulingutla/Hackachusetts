// Animated line sketch of endurance sports: a cyclist, a runner, and a swimmer.
// Original artwork. Each figure is drawn in its own local frame (ground at y = 0) and placed with
// a translate. Joints rotate about their pivots, and motion is CSS only.
// Motion stops for users who prefer reduced motion.

function spokes(cx, cy, r) {
  const lines = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    lines.push(<line key={k} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} />);
  }
  return lines;
}

// Repeating wave: one 60 unit period, so shifting by 60 loops seamlessly.
function waveD(y, startX, periods) {
  let d = `M${startX} ${y}`;
  for (let i = 0; i < periods; i++) d += " q15 -9 30 0 q15 9 30 0";
  return d;
}

export default function SportsSketch({
  viewBox = "0 110 1200 270",
  preserveAspectRatio = "xMidYMid meet",
  className = "sports-sketch",
}) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      role="img"
      aria-label="Sketch of a cyclist, a runner, and a swimmer in motion"
    >
      <title>Cyclist, runner, and swimmer in motion</title>
      <defs>
        <filter id="sk-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="4" />
        </filter>
        <clipPath id="sk-water-clip">
          <rect x="640" y="326" width="560" height="40" />
        </clipPath>
      </defs>

      {/* Ground and water */}
      <g fill="none" stroke="#282828" strokeWidth="2" strokeLinecap="round" opacity="0.35">
        <path d="M0 340 H1200" />
      </g>
      <g clipPath="url(#sk-water-clip)" fill="none" stroke="#282828" strokeWidth="2.5" strokeLinecap="round">
        <g className="sk-drift">
          <path d={waveD(338, 540, 12)} strokeOpacity="0.5" />
          <path d={waveD(354, 540, 12)} strokeOpacity="0.3" />
        </g>
      </g>

      <g
        filter="url(#sk-wobble)"
        fill="none"
        stroke="#282828"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Cyclist. Local ground at y = 0, placed at x = 120. */}
        <g transform="translate(120 340)">
          <g className="sk-spin" style={{ transformOrigin: "55px -55px" }}>
            <circle cx="55" cy="-55" r="55" />
            {spokes(55, -55, 55)}
            <circle cx="55" cy="-55" r="4" />
          </g>
          <g className="sk-spin" style={{ transformOrigin: "205px -55px" }}>
            <circle cx="205" cy="-55" r="55" />
            {spokes(205, -55, 55)}
            <circle cx="205" cy="-55" r="4" />
          </g>
          <path d="M55 -55 L110 -140 M55 -55 L130 -55 M130 -55 L110 -140 M110 -140 L185 -140 M130 -55 L185 -140 M185 -140 L205 -55 M95 -147 L127 -147 M185 -140 L195 -165 L209 -167" />
          <g className="sk-spin" style={{ transformOrigin: "130px -55px" }}>
            <path d="M130 -55 L148 -55 M130 -55 L112 -55" />
          </g>
        </g>

        {/* Runner. Feet at the ground line, placed at x = 560. */}
        <g transform="translate(560 340)">
          <g className="sk-bob">
            <circle cx="30" cy="-200" r="15" />
            <path d="M28 -184 L18 -100" />

            {/* Front leg: knee drives forward */}
            <g className="sk-thigh-a" style={{ transformOrigin: "18px -100px" }}>
              <path d="M18 -100 L44 -70" />
              <g className="sk-shin-a" style={{ transformOrigin: "44px -70px" }}>
                <path d="M44 -70 L36 -30 M36 -30 L50 -28" />
              </g>
            </g>

            {/* Back leg: extended behind, pushing off */}
            <g className="sk-thigh-b" style={{ transformOrigin: "18px -100px" }}>
              <path d="M18 -100 L2 -62" />
              <g className="sk-shin-b" style={{ transformOrigin: "2px -62px" }}>
                <path d="M2 -62 L-14 -22 M-14 -22 L-26 -18" />
              </g>
            </g>

            {/* Arms: forward arm and back arm, elbows bent */}
            <g className="sk-arm-a" style={{ transformOrigin: "28px -178px" }}>
              <path d="M28 -178 L46 -152 L36 -134" />
            </g>
            <g className="sk-arm-b" style={{ transformOrigin: "28px -178px" }}>
              <path d="M28 -178 L12 -158 L2 -170" />
            </g>
          </g>
        </g>

        {/* Swimmer. Waterline at y = 0, placed at x = 960. Freestyle: head breathing, arm recovering. */}
        <g transform="translate(960 332)">
          <path d="M-50 -8 L38 -6" />
          <g className="sk-kick" style={{ transformOrigin: "-50px -8px" }}>
            <path d="M-50 -8 L-70 -20" />
          </g>
          <circle cx="50" cy="-14" r="11" />
          <g className="sk-swim-arm" style={{ transformOrigin: "30px -10px" }}>
            <path d="M30 -10 L12 -40 L-6 -30" />
          </g>
        </g>
      </g>

      {/* Heart-rate trace in brand pink across the bottom */}
      <path
        className="sk-pulse"
        d="M0 368 H380 l12 0 l8 -26 l10 46 l8 -28 l8 8 H1200"
        fill="none"
        stroke="#ff0083"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
