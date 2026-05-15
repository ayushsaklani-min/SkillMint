// scenes-shared.jsx
// Brand tokens, primitives, and shared scene helpers for the SkillMint
// agent-commerce explainer.
//
// Loaded BEFORE the scene files. Exports everything to window so the rest
// of the Babel scripts can read it.

const BRAND = {
  blue:     '#1A3CFF',
  blueDeep: '#0A1FB8',
  blueInk:  '#08125C',
  lime:     '#D6FF3D',
  limeDark: '#B8E024',
  ink:      '#000000',
  paper:    '#FFFFFF',
  red:      '#FF3B3B',
  green:    '#22C55E',
};

const DISPLAY = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const HEAVY   = "'Arial Black', 'Helvetica Neue', Impact, sans-serif";
const MONO    = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

// ── Background: subtle dot/grid that drifts with time ───────────────────────
function GridBG({ opacity = 0.10, t = 0, drift = 6 }) {
  const off = (t * drift) % 80;
  return (
    <div className="grid-bg" style={{
      position: 'absolute', inset: 0,
      backgroundImage: `
        linear-gradient(rgba(255,255,255,${opacity}) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,${opacity}) 1px, transparent 1px)
      `,
      backgroundSize: '80px 80px',
      backgroundPosition: `${off}px ${off}px`,
      pointerEvents: 'none',
    }}></div>
  );
}

function NoiseDots({ t = 0, count = 24, seed = 0 }) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const rx = ((i * 9301 + seed * 49297) % 233280) / 233280;
    const ry = ((i * 49297 + seed * 9301) % 233280) / 233280;
    const x = rx * 1920;
    const y = ry * 1080 + Math.sin(t * 1.4 + i) * 18;
    const a = 0.25 + 0.65 * ((Math.sin(t * 1.8 + i * 0.7) + 1) / 2);
    items.push(
      <div key={i} style={{
        position: 'absolute', left: x, top: y,
        width: 6, height: 6, borderRadius: '50%',
        background: BRAND.lime, opacity: a,
        boxShadow: `0 0 12px ${BRAND.lime}66`,
      }}></div>
    );
  }
  return <>{items}</>;
}

// ── Step header pinned top-left of each big scene ───────────────────────────
function StepHeader({ num, total = 5, kicker, title, sub, t, color = BRAND.lime }) {
  const a = clamp(t / 0.4, 0, 1);
  const e = Easing.easeOutBack(a);
  return (
    <div style={{ position: 'absolute', top: 60, left: 80, opacity: a, right: 80 }}>
      <div style={{
        fontFamily: MONO, fontSize: 16, color: BRAND.paper, letterSpacing: '0.32em',
        display: 'flex', gap: 14, alignItems: 'center',
      }}>
        <span style={{
          background: BRAND.ink, color: color,
          padding: '6px 14px', borderRadius: 999,
          border: `2px solid ${color}`,
        }}>● {String(num).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        <span style={{ opacity: 0.85 }}>{kicker}</span>
      </div>
      <div style={{
        fontFamily: HEAVY, fontSize: 110, color: color,
        WebkitTextStroke: `3px ${BRAND.ink}`,
        letterSpacing: '-0.03em', lineHeight: 0.92, marginTop: 12,
        transform: `translateX(${(1-e) * -40}px)`,
        textShadow: `8px 8px 0 ${BRAND.ink}`,
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 19, color: BRAND.paper, marginTop: 16,
        maxWidth: 820, lineHeight: 1.4, fontWeight: 500,
        opacity: clamp((t - 0.3) / 0.4, 0, 1),
      }}>
        {sub}
      </div>
    </div>
  );
}

// ── Caption pill (lower third) ──────────────────────────────────────────────
function Caption({ t, start, end, children, y = 960, color = BRAND.lime }) {
  const a = clamp((t - start) / 0.3, 0, 1);
  const fadeOut = clamp((t - (end - 0.3)) / 0.3, 0, 1);
  const opacity = Math.min(a, 1 - fadeOut);
  if (opacity <= 0) return null;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: y,
      textAlign: 'center', opacity,
      transform: `translateY(${(1-a) * 24}px)`,
      pointerEvents: 'none', zIndex: 30,
    }}>
      <div style={{
        display: 'inline-block',
        background: BRAND.ink, color: BRAND.paper,
        fontFamily: MONO, fontSize: 20, fontWeight: 700,
        letterSpacing: '0.18em',
        padding: '14px 30px', borderRadius: 999,
        border: `3px solid ${color}`,
        boxShadow: `6px 6px 0 ${color}`,
      }}>{children}</div>
    </div>
  );
}

// ── Coin sprite ─────────────────────────────────────────────────────────────
function Coin({ x, y, rot = 0, size = 44, label = '0G', accent }) {
  const fill = accent || BRAND.lime;
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: `translate(-50%,-50%) rotate(${rot}deg)`,
      width: size, height: size, borderRadius: '50%',
      background: fill, border: `3px solid ${BRAND.ink}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: HEAVY, fontSize: size * 0.4, color: BRAND.ink,
      boxShadow: `3px 3px 0 ${BRAND.ink}`,
      zIndex: 20,
    }}>{label}</div>
  );
}

// ── Code block with progressive reveal ──────────────────────────────────────
// `lines` is an array of {text, color?, indent?} or strings. `progress` ∈ [0,1]
// reveals one line at a time. Optional `caret` puts a blinking caret on the
// currently-typing line.
function CodeBlock({ x, y, width = 640, lines, progress = 1, title = '@skillmint/sdk', caret = true, t = 0 }) {
  const visibleLines = Math.floor(progress * lines.length);
  const partialFrac = (progress * lines.length) - visibleLines;
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width,
      background: '#0A0F2E',
      border: `4px solid ${BRAND.ink}`,
      borderRadius: 14,
      boxShadow: `8px 8px 0 ${BRAND.ink}`,
      overflow: 'hidden',
      fontFamily: MONO,
    }}>
      {/* title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: BRAND.ink, padding: '10px 16px',
        borderBottom: `2px solid ${BRAND.lime}`,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57', border: `1px solid ${BRAND.ink}` }}></div>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E', border: `1px solid ${BRAND.ink}` }}></div>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840', border: `1px solid ${BRAND.ink}` }}></div>
        </div>
        <div style={{
          fontSize: 13, color: BRAND.lime, letterSpacing: '0.18em', fontWeight: 700,
          marginLeft: 6,
        }}>{title}</div>
      </div>

      {/* body */}
      <div style={{ padding: '18px 22px', minHeight: 60 }}>
        {lines.map((raw, i) => {
          const line = typeof raw === 'string' ? { text: raw } : raw;
          const visible = i < visibleLines;
          const isTyping = i === visibleLines && partialFrac > 0;
          if (!visible && !isTyping) {
            return <div key={i} style={{ height: 24 }}></div>;
          }
          const text = isTyping ? line.text.slice(0, Math.ceil(line.text.length * partialFrac)) : line.text;
          return (
            <div key={i} style={{
              fontFamily: MONO, fontSize: 16, lineHeight: '24px',
              color: line.color || BRAND.paper,
              paddingLeft: (line.indent || 0) * 16,
              whiteSpace: 'pre',
              opacity: visible ? 1 : 0.95,
            }}>
              {text}{isTyping && caret && (Math.sin(t * 8) > 0 ? '▎' : ' ')}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Generic agent badge (no real brands) ────────────────────────────────────
// shape: 'hex' | 'tri' | 'plus' | 'orbit' | 'gem'
function AgentBadge({ x, y, label = 'AGENT', color = BRAND.lime, shape = 'hex', t = 0, scale = 1 }) {
  const bob = Math.sin(t * 2 + (x + y) * 0.001) * 4;
  const spin = Math.sin(t * 1.4 + (x - y) * 0.001) * 6;
  return (
    <div style={{
      position: 'absolute', left: x, top: y + bob,
      transform: `translate(-50%, -50%) scale(${scale})`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 140, height: 140, borderRadius: 24,
        background: BRAND.paper,
        border: `5px solid ${BRAND.ink}`,
        boxShadow: `6px 6px 0 ${BRAND.ink}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* antenna */}
        <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', width: 4, height: 20, background: BRAND.ink }}></div>
        <div style={{
          position: 'absolute', top: -28, left: '50%',
          transform: `translateX(-50%) scale(${1 + Math.sin(t * 5) * 0.18})`,
          width: 16, height: 16, borderRadius: '50%',
          background: color, border: `3px solid ${BRAND.ink}`,
          boxShadow: `0 0 14px ${color}`,
        }}></div>

        <svg width="90" height="90" viewBox="0 0 100 100"
             style={{ transform: `rotate(${spin}deg)`, filter: `drop-shadow(2px 2px 0 ${BRAND.ink})` }}>
          {shape === 'hex' && (
            <g fill={color} stroke={BRAND.ink} strokeWidth="4" strokeLinejoin="round">
              <polygon points="50,8 86,30 86,70 50,92 14,70 14,30"/>
              <circle cx="50" cy="50" r="12" fill={BRAND.ink}/>
            </g>
          )}
          {shape === 'tri' && (
            <g fill={color} stroke={BRAND.ink} strokeWidth="4" strokeLinejoin="round">
              <polygon points="50,10 90,82 10,82"/>
              <rect x="42" y="50" width="16" height="22" fill={BRAND.ink}/>
            </g>
          )}
          {shape === 'plus' && (
            <g fill={color} stroke={BRAND.ink} strokeWidth="4" strokeLinejoin="round">
              <rect x="38" y="10" width="24" height="80" rx="6"/>
              <rect x="10" y="38" width="80" height="24" rx="6"/>
              <circle cx="50" cy="50" r="9" fill={BRAND.ink}/>
            </g>
          )}
          {shape === 'orbit' && (
            <g fill="none" stroke={BRAND.ink} strokeWidth="4">
              <circle cx="50" cy="50" r="38" fill={color}/>
              <ellipse cx="50" cy="50" rx="44" ry="14" transform="rotate(-30 50 50)"/>
              <circle cx="50" cy="50" r="9" fill={BRAND.ink}/>
            </g>
          )}
          {shape === 'gem' && (
            <g fill={color} stroke={BRAND.ink} strokeWidth="4" strokeLinejoin="round">
              <polygon points="50,8 86,40 50,92 14,40"/>
              <line x1="14" y1="40" x2="86" y2="40"/>
              <line x1="50" y1="8" x2="50" y2="92"/>
            </g>
          )}
        </svg>

        {/* mouth dots */}
        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: BRAND.ink }}></div>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: BRAND.ink }}></div>
        </div>
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 12, color: BRAND.paper,
        letterSpacing: '0.22em', fontWeight: 700,
        background: BRAND.ink, padding: '5px 12px', borderRadius: 999,
        border: `2px solid ${color}`,
      }}>{label}</div>
    </div>
  );
}

// ── Cursor arrow (for click moments) ────────────────────────────────────────
function Cursor({ x, y, opacity = 1, click = 0 }) {
  return (
    <svg width="44" height="44" viewBox="0 0 40 40" style={{
      position: 'absolute', left: x, top: y,
      transform: `translate(-4px,-4px) scale(${1 - click * 0.2})`,
      opacity, pointerEvents: 'none', zIndex: 50,
      filter: `drop-shadow(3px 3px 0 ${BRAND.ink})`,
    }}>
      {click > 0 && (
        <circle cx="6" cy="6" r={4 + click * 16} fill="none"
          stroke={BRAND.lime} strokeWidth="3" opacity={1 - click}/>
      )}
      <path d="M4 4 L4 28 L11 22 L16 34 L21 32 L16 20 L26 20 Z"
            fill={BRAND.paper} stroke={BRAND.ink} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Receipt chip used in several scenes ─────────────────────────────────────
function ReceiptChip({ x, y, opacity = 1, scale = 1, txHash = '0x9af3…b21c', label = 'SETTLED ON 0G MAINNET', t = 0 }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: `translate(-50%, -50%) scale(${scale})`,
      opacity,
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 14,
        background: BRAND.ink, color: BRAND.paper,
        border: `4px solid ${BRAND.lime}`, borderRadius: 999,
        padding: '14px 28px',
        fontFamily: MONO, fontSize: 17, fontWeight: 700,
        letterSpacing: '0.16em',
        boxShadow: `6px 6px 0 ${BRAND.ink}`,
        whiteSpace: 'nowrap',
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: BRAND.lime,
          transform: `scale(${1 + Math.sin(t * 5) * 0.25})`,
        }}></div>
        TX {txHash} · {label}
      </div>
    </div>
  );
}

// ── NFT card primitive ──────────────────────────────────────────────────────
function NFTCard({ x, y, scale = 1, opacity = 1, t = 0, accent = BRAND.lime, name = 'SKILL', tokenId = '#0001', stats = [['RUNS', '5,122'], ['EARNED', '51.22']], glyph = '⚡', rotate = 0 }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
      opacity,
    }}>
      <div style={{
        width: 380, height: 440,
        background: BRAND.paper,
        border: `5px solid ${BRAND.ink}`,
        borderRadius: 22,
        padding: 18,
        boxShadow: `10px 10px 0 ${BRAND.ink}`,
        position: 'relative',
      }}>
        <div style={{
          width: '100%', height: 220,
          background: `linear-gradient(135deg, ${BRAND.blue}, ${accent})`,
          border: `3px solid ${BRAND.ink}`,
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* diagonal stripes overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `repeating-linear-gradient(45deg, transparent 0 12px, rgba(0,0,0,0.08) 12px 14px)`,
          }}></div>
          <div style={{
            fontFamily: HEAVY, fontSize: 130, color: BRAND.paper,
            WebkitTextStroke: `3px ${BRAND.ink}`,
            transform: `rotate(${Math.sin(t * 1.4) * 5}deg)`,
            position: 'relative', zIndex: 1,
          }}>{glyph}</div>
          <div style={{
            position: 'absolute', top: 10, right: 10,
            fontFamily: MONO, fontSize: 11,
            background: BRAND.ink, color: accent,
            padding: '4px 10px', borderRadius: 999,
            letterSpacing: '0.18em', fontWeight: 700,
          }}>{tokenId}</div>
          <div style={{
            position: 'absolute', top: 10, left: 10,
            fontFamily: MONO, fontSize: 11,
            background: accent, color: BRAND.ink,
            padding: '4px 10px', borderRadius: 999,
            letterSpacing: '0.18em', fontWeight: 700,
            border: `2px solid ${BRAND.ink}`,
          }}>ERC-721</div>
        </div>

        <div style={{ fontFamily: HEAVY, fontSize: 28, color: BRAND.ink, marginTop: 14, lineHeight: 1, letterSpacing: '-0.01em' }}>
          {name}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: BRAND.ink, opacity: 0.55, marginTop: 4 }}>
          ENCRYPTED · TEE-ONLY · ON 0G STORAGE
        </div>

        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: `2px dashed ${BRAND.ink}`,
          display: 'flex', justifyContent: 'space-between',
        }}>
          {stats.map(([k, v], i) => (
            <div key={i}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.22em' }}>{k}</div>
              <div style={{ fontFamily: HEAVY, fontSize: 24, color: BRAND.ink }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Arrow drawer (animated line from A to B) ────────────────────────────────
function Arrow({ from, to, progress = 1, color = BRAND.lime, width = 6, label, labelOffset = 0, dashed = false, arrowhead = true }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const cur = { x: from.x + dx * progress, y: from.y + dy * progress };
  return (
    <svg style={{
      position: 'absolute', left: 0, top: 0, width: 1920, height: 1080,
      pointerEvents: 'none', zIndex: 5,
    }}>
      <line x1={from.x} y1={from.y} x2={cur.x} y2={cur.y}
        stroke={color} strokeWidth={width}
        strokeDasharray={dashed ? '14 10' : 'none'}
        strokeLinecap="round"/>
      {arrowhead && progress > 0.92 && (
        <polygon
          points={`${cur.x},${cur.y} ${cur.x - ux * 22 - uy * 14},${cur.y - uy * 22 + ux * 14} ${cur.x - ux * 22 + uy * 14},${cur.y - uy * 22 - ux * 14}`}
          fill={color} stroke={BRAND.ink} strokeWidth="2"/>
      )}
      {label && progress > 0.5 && (
        <g>
          <rect
            x={(from.x + to.x) / 2 - 130}
            y={(from.y + to.y) / 2 - 22 + labelOffset}
            width="260" height="36" rx="18"
            fill={BRAND.ink} stroke={color} strokeWidth="2"/>
          <text
            x={(from.x + to.x) / 2}
            y={(from.y + to.y) / 2 + 3 + labelOffset}
            fill={color} fontFamily="JetBrains Mono, monospace" fontSize="14"
            fontWeight="700" letterSpacing="3" textAnchor="middle">
            {label}
          </text>
        </g>
      )}
    </svg>
  );
}

// ── Big numeric counter that rolls up ───────────────────────────────────────
function Counter({ x, y, from = 0, to = 100, progress = 1, suffix = '', prefix = '', fontSize = 110, color = BRAND.lime, decimals = 0 }) {
  const v = from + (to - from) * Easing.easeOutCubic(progress);
  const text = decimals > 0 ? v.toFixed(decimals) : Math.floor(v).toLocaleString();
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: 'translate(-50%, -50%)',
      fontFamily: HEAVY, fontSize, color,
      WebkitTextStroke: `3px ${BRAND.ink}`,
      letterSpacing: '-0.02em',
      textShadow: `6px 6px 0 ${BRAND.ink}`,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    }}>
      {prefix}{text}{suffix}
    </div>
  );
}

Object.assign(window, {
  BRAND, DISPLAY, HEAVY, MONO,
  GridBG, NoiseDots,
  StepHeader, Caption, Coin, CodeBlock,
  AgentBadge, Cursor, ReceiptChip, NFTCard,
  Arrow, Counter,
});
