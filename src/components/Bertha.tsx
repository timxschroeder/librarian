// Bertha — the app mascot. A faithful broccoli portrait of Tim's plush toy,
// recolored into the brand forest palette. One body, swappable face + arms.
// See memory/project_bertha_mascot.md for the design rationale.
//
// Usage: <Bertha expression="thinking" size={48} /> — renders an inline SVG,
// no image asset. Decorative by default (aria-hidden); pass a `title` to label it.

export type BerthaExpression = 'happy' | 'delighted' | 'thinking' | 'reading' | 'oops'

interface BerthaProps {
  /** Which mood. Defaults to `happy`. */
  expression?: BerthaExpression
  /** Rendered width in px (height scales with the 120×132 viewBox). Defaults to 96. */
  size?: number
  className?: string
  /** Accessible label. When omitted the SVG is decorative (aria-hidden). */
  title?: string
}

const C = {
  crownDark: '#1A3A1B',
  crownMid: '#2C5F2E',
  crownLight: '#4F8A4E',
  body: '#FAF8F5',
  border: '#DDD5C8',
  ink: '#1A1A1A',
  cheek: '#E0A39E',
  page: '#F0EBE1',
  spine: '#6B1E1E',
  white: '#FFFFFF',
}

// Crown + floret texture + cream body — identical across every expression.
function Crown() {
  return (
    <>
      <g fill={C.crownDark}>
        <circle cx="44" cy="34" r="15" /><circle cx="76" cy="34" r="15" />
        <circle cx="33" cy="50" r="14" /><circle cx="87" cy="50" r="14" />
        <circle cx="60" cy="30" r="16" /><circle cx="60" cy="58" r="15" />
        <circle cx="48" cy="54" r="13" /><circle cx="72" cy="54" r="13" />
      </g>
      <g fill={C.crownMid}>
        <circle cx="60" cy="26" r="16" /><circle cx="44" cy="30" r="15" /><circle cx="76" cy="30" r="15" />
        <circle cx="33" cy="46" r="15" /><circle cx="87" cy="46" r="15" /><circle cx="60" cy="44" r="18" />
        <circle cx="42" cy="52" r="14" /><circle cx="78" cy="52" r="14" /><circle cx="60" cy="54" r="15" />
      </g>
      <g fill={C.crownLight}>
        <circle cx="54" cy="22" r="6" /><circle cx="38" cy="27" r="6" /><circle cx="70" cy="25" r="6" />
        <circle cx="28" cy="43" r="5" /><circle cx="55" cy="40" r="6" /><circle cx="82" cy="43" r="5" />
      </g>
      <g fill="none" stroke={C.crownDark} strokeWidth="1.1" strokeLinecap="round" opacity="0.5">
        <path d="M60 36 L60 54" /><path d="M45 34 L45 50" /><path d="M75 34 L75 50" />
        <path d="M33 44 L34 58" /><path d="M87 44 L86 58" />
      </g>
      <path
        d="M37 66 Q36 59 44 58 L76 58 Q84 59 83 66 L85 98 Q85 120 60 120 Q35 120 35 98 Z"
        fill={C.body}
        stroke={C.border}
        strokeWidth="1.3"
      />
    </>
  )
}

// A cream arm capsule (limb) ending in a green floret "hand".
function Arm({ x1, y1, x2, y2, hx, hy, w = 11 }: { x1: number; y1: number; x2: number; y2: number; hx: number; hy: number; w?: number }) {
  const d = `M${x1} ${y1} L${x2} ${y2}`
  return (
    <>
      <path d={d} stroke={C.border} strokeWidth={w} strokeLinecap="round" />
      <path d={d} stroke={C.body} strokeWidth={w - 2.5} strokeLinecap="round" />
      <circle cx={hx} cy={hy} r="6" fill={C.crownDark} />
      <circle cx={hx} cy={hy} r="4.6" fill={C.crownMid} />
    </>
  )
}

function Face({ expression }: { expression: BerthaExpression }) {
  switch (expression) {
    case 'delighted':
      return (
        <>
          <Arm x1={40} y1={89} x2={27} y2={66} hx={24} hy={62} w={10.5} />
          <Arm x1={80} y1={89} x2={93} y2={66} hx={96} hy={62} w={10.5} />
          <path d="M19 53 l1.4 3 l3 1.4 l-3 1.4 l-1.4 3 l-1.4 -3 l-3 -1.4 l3 -1.4 Z" fill={C.crownLight} />
          <path d="M101 53 l1.4 3 l3 1.4 l-3 1.4 l-1.4 3 l-1.4 -3 l-3 -1.4 l3 -1.4 Z" fill={C.crownLight} />
          <path d="M46 73 Q51 70.5 56 73" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M64 73 Q69 70.5 74 73" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M48 88 Q52 83 56 88" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M64 88 Q68 83 72 88" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="44" cy="93" rx="4.8" ry="3.2" fill={C.cheek} /><ellipse cx="76" cy="93" rx="4.8" ry="3.2" fill={C.cheek} />
          <path d="M54 92 Q60 101 66 92 Z" fill={C.spine} stroke={C.ink} strokeWidth="1.4" />
        </>
      )
    case 'thinking':
      return (
        <>
          <Arm x1={82} y1={90} x2={97} y2={83} hx={101} hy={81} w={10.5} />
          {/* left hand tucked up to the cheek */}
          <path d="M40 92 L51 88" stroke={C.border} strokeWidth="10" strokeLinecap="round" />
          <path d="M40 92 L51 88" stroke={C.body} strokeWidth="7.5" strokeLinecap="round" />
          <circle cx="54" cy="87" r="5.6" fill={C.crownDark} /><circle cx="54.2" cy="86.7" r="4.3" fill={C.crownMid} />
          <circle cx="95" cy="46" r="1.6" fill={C.ink} /><circle cx="100" cy="40" r="2.1" fill={C.ink} /><circle cx="105" cy="33" r="2.6" fill={C.ink} />
          <path d="M46 72 Q51 70 56 73" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M65 76 Q69 74.5 73 76.5" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <ellipse cx="52" cy="85" rx="4.4" ry="5" fill={C.ink} /><ellipse cx="68" cy="85" rx="4.4" ry="5" fill={C.ink} />
          <circle cx="53.6" cy="82.4" r="1.6" fill={C.white} /><circle cx="69.6" cy="82.4" r="1.6" fill={C.white} />
          <ellipse cx="45" cy="90" rx="3.8" ry="2.6" fill={C.cheek} /><ellipse cx="75" cy="90" rx="3.8" ry="2.6" fill={C.cheek} />
        </>
      )
    case 'reading':
      return (
        <>
          <path d="M40 89 L47 99" stroke={C.border} strokeWidth="10" strokeLinecap="round" />
          <path d="M80 89 L73 99" stroke={C.border} strokeWidth="10" strokeLinecap="round" />
          <path d="M40 89 L47 99" stroke={C.body} strokeWidth="7.5" strokeLinecap="round" />
          <path d="M80 89 L73 99" stroke={C.body} strokeWidth="7.5" strokeLinecap="round" />
          <path d="M46 74 Q51 72 56 74" stroke={C.ink} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M64 74 Q69 72 74 74" stroke={C.ink} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M48 84 Q52 88 56 84" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M64 84 Q68 88 72 84" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="45" cy="89" rx="3.8" ry="2.6" fill={C.cheek} /><ellipse cx="75" cy="89" rx="3.8" ry="2.6" fill={C.cheek} />
          <path d="M56 91 Q60 93.5 64 91" stroke={C.ink} strokeWidth="1.7" fill="none" strokeLinecap="round" />
          <path d="M60 100 L46 96 L46 112 L60 116 Z" fill={C.page} stroke={C.border} strokeWidth="1" />
          <path d="M60 100 L74 96 L74 112 L60 116 Z" fill={C.page} stroke={C.border} strokeWidth="1" />
          <path d="M60 100 L60 116" stroke={C.spine} strokeWidth="1.6" />
          <path d="M49 102 L57 104 M49 106 L57 108 M63 104 L71 102 M63 108 L71 106" stroke={C.border} strokeWidth="0.7" />
          <circle cx="47" cy="98" r="5.2" fill={C.crownDark} /><circle cx="73" cy="98" r="5.2" fill={C.crownDark} />
          <circle cx="47" cy="98" r="3.9" fill={C.crownMid} /><circle cx="73" cy="98" r="3.9" fill={C.crownMid} />
        </>
      )
    case 'oops':
      return (
        <>
          <Arm x1={38} y1={89} x2={24} y2={97} hx={20} hy={99} w={10.5} />
          <Arm x1={82} y1={89} x2={96} y2={97} hx={100} hy={99} w={10.5} />
          <path d="M46 71 Q51 68 56 71" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M64 71 Q69 68 74 71" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <ellipse cx="52" cy="86" rx="5.2" ry="6" fill={C.ink} /><ellipse cx="68" cy="86" rx="5.2" ry="6" fill={C.ink} />
          <circle cx="53.9" cy="83.7" r="1.8" fill={C.white} /><circle cx="69.9" cy="83.7" r="1.8" fill={C.white} />
          <ellipse cx="44" cy="92" rx="4.1" ry="2.8" fill={C.cheek} /><ellipse cx="76" cy="92" rx="4.1" ry="2.8" fill={C.cheek} />
          <ellipse cx="60" cy="95" rx="2.7" ry="3.1" fill={C.ink} />
        </>
      )
    case 'happy':
    default:
      return (
        <>
          <Arm x1={38} y1={90} x2={23} y2={83} hx={19} hy={81} />
          <Arm x1={82} y1={90} x2={97} y2={83} hx={101} hy={81} />
          <path d="M47 76 Q51 73.5 55 75.5" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M65 75.5 Q69 73.5 73 76" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <ellipse cx="52" cy="86" rx="4.6" ry="5.3" fill={C.ink} /><ellipse cx="68" cy="86" rx="4.6" ry="5.3" fill={C.ink} />
          <circle cx="53.8" cy="84" r="1.7" fill={C.white} /><circle cx="69.8" cy="84" r="1.7" fill={C.white} />
          <ellipse cx="45" cy="91" rx="4.3" ry="2.9" fill={C.cheek} /><ellipse cx="75" cy="91" rx="4.3" ry="2.9" fill={C.cheek} />
          <path d="M55 92.5 Q60 97.5 65 92.5" stroke={C.ink} strokeWidth="1.9" fill="none" strokeLinecap="round" />
        </>
      )
  }
}

export default function Bertha({ expression = 'happy', size = 96, className, title }: BerthaProps) {
  const decorative = !title
  return (
    <svg
      viewBox="0 0 120 132"
      width={size}
      height={(size * 132) / 120}
      className={className}
      role="img"
      aria-hidden={decorative || undefined}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <Crown />
      <Face expression={expression} />
    </svg>
  )
}
