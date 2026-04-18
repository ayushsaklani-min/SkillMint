// scenes.jsx — SkillMint animated scroll explainer (v2 — more animated + explanatory)
// Brand from SkillMint dashboard: bright blue bg, neon lime accent, white, black.

const BRAND = {
  blue:  '#1A3CFF',
  blueDeep: '#0A1FB8',
  lime:  '#D6FF3D',
  limeDark: '#B8E024',
  ink:   '#000000',
  paper: '#FFFFFF',
  smoke: 'rgba(255,255,255,0.08)',
};
const DISPLAY = "'Arial Black', 'Helvetica Neue', Impact, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

// ── Shared bits ─────────────────────────────────────────────────────────────

function GridBG({ opacity = 0.12, t = 0, drift = 0 }) {
  const off = (t * drift) % 80;
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: `
        linear-gradient(rgba(255,255,255,${opacity}) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,${opacity}) 1px, transparent 1px)
      `,
      backgroundSize: '80px 80px',
      backgroundPosition: `${off}px ${off}px`,
    }}/>
  );
}

function Squiggle({ x, y, rotate = 0, scale = 1, color = BRAND.lime, draw = 1 }) {
  const length = 300;
  const visible = length * draw;
  return (
    <svg width={180 * scale} height={120 * scale} viewBox="0 0 180 120" style={{
      position: 'absolute', left: x, top: y,
      transform: `rotate(${rotate}deg)`,
      transformOrigin: 'top left',
    }}>
      <path d="M10 10 C 50 40, 100 50, 140 90 L 125 82 M 140 90 L 135 72"
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={length} strokeDashoffset={length - visible}/>
    </svg>
  );
}

// Big subtitle caption that slides up from bottom during a range of localTime
function Caption({ t, start, end, children, y = 960 }) {
  const a = clamp((t - start) / 0.3, 0, 1);
  const fadeOut = clamp((t - (end - 0.3)) / 0.3, 0, 1);
  const opacity = Math.min(a, 1 - fadeOut);
  if (opacity <= 0) return null;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: y,
      textAlign: 'center',
      opacity,
      transform: `translateY(${(1-a) * 24}px)`,
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'inline-block',
        background: BRAND.ink, color: BRAND.paper,
        fontFamily: MONO, fontSize: 22, fontWeight: 700,
        letterSpacing: '0.12em',
        padding: '14px 28px', borderRadius: 12,
        border: `3px solid ${BRAND.lime}`,
        boxShadow: `6px 6px 0 ${BRAND.lime}`,
      }}>
        {children}
      </div>
    </div>
  );
}

function StepHeader({ num, title, sub, t }) {
  const a = clamp(t / 0.4, 0, 1);
  const e = Easing.easeOutBack(a);
  return (
    <div style={{ position: 'absolute', top: 50, left: 80, opacity: a }}>
      <div style={{ fontFamily: MONO, fontSize: 18, color: BRAND.paper, letterSpacing: '0.3em' }}>
        STEP {num} / 04
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 130, color: BRAND.lime,
        WebkitTextStroke: `3px ${BRAND.ink}`,
        letterSpacing: '-0.02em', lineHeight: 0.95, marginTop: 4,
        transform: `translateX(${(1-e) * -40}px)`,
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 20, color: BRAND.paper, marginTop: 8,
        maxWidth: 720, lineHeight: 1.3,
        opacity: clamp((t - 0.3) / 0.4, 0, 1),
      }}>
        {sub}
      </div>
    </div>
  );
}

// A character — developer/creator avatar with hoodie, headset, laptop, blinking
function Character({ x, y, label, skin = '#F3C89A', hoodie = BRAND.lime, hair = BRAND.ink, t = 0, scale = 1, variant = 'creator' }) {
  const float = Math.sin(t * 2) * 4;
  const blink = ((t * 0.9) % 3) < 0.12 ? 0.15 : 1;
  const mouth = Math.sin(t * 1.6) > 0.3 ? 'smile' : 'small';
  const armWave = Math.sin(t * 3) * 6;
  const typeT = (t * 4) % 1 < 0.5 ? 0 : 2; // tiny keyboard tap offset

  return (
    <div style={{
      position: 'absolute', left: x, top: y + float,
      transform: `translate(-50%, -100%) scale(${scale})`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <svg width="220" height="260" viewBox="0 0 220 260" style={{
        filter: `drop-shadow(6px 6px 0 ${BRAND.ink})`,
      }}>
        {/* shadow ellipse */}
        <ellipse cx="110" cy="250" rx="70" ry="8" fill={BRAND.ink} opacity="0.25"/>

        {/* Laptop base (in front, lower) */}
        {variant === 'creator' && (
          <g>
            <rect x="46" y="206" width="128" height="14" rx="3" fill={BRAND.ink}/>
            <rect x="50" y="172" width="120" height="38" rx="4" fill="#222" stroke={BRAND.ink} strokeWidth="3"/>
            <rect x="56" y="178" width="108" height="26" rx="2" fill={BRAND.blue}/>
            {/* code lines */}
            <rect x="60" y="182" width="36" height="3" fill={BRAND.lime} opacity={typeT ? 1 : 0.6}/>
            <rect x="60" y="188" width="60" height="3" fill={BRAND.paper} opacity="0.8"/>
            <rect x="60" y="194" width="24" height="3" fill={BRAND.lime} opacity={typeT ? 0.6 : 1}/>
            <rect x="90" y="194" width="48" height="3" fill={BRAND.paper} opacity="0.6"/>
            <rect x="60" y="200" width="40" height="3" fill={BRAND.paper} opacity="0.5"/>
          </g>
        )}

        {/* Body — hoodie */}
        <path d="M 50 230 L 50 150 Q 50 120 110 120 Q 170 120 170 150 L 170 230 Z"
              fill={hoodie} stroke={BRAND.ink} strokeWidth="5"/>
        {/* Hoodie zipper */}
        <line x1="110" y1="140" x2="110" y2="210" stroke={BRAND.ink} strokeWidth="3" strokeDasharray="4 4"/>
        {/* Hoodie strings */}
        <line x1="98" y1="126" x2="94" y2="150" stroke={BRAND.ink} strokeWidth="3" strokeLinecap="round"/>
        <line x1="122" y1="126" x2="126" y2="150" stroke={BRAND.ink} strokeWidth="3" strokeLinecap="round"/>
        <circle cx="94" cy="152" r="3" fill={BRAND.ink}/>
        <circle cx="126" cy="152" r="3" fill={BRAND.ink}/>
        {/* Pocket */}
        <path d="M 70 180 L 150 180 L 140 210 L 80 210 Z" fill="none" stroke={BRAND.ink} strokeWidth="3"/>

        {/* Arms — typing if creator, waving if user */}
        {variant === 'creator' ? (
          <g>
            <rect x="52" y="175" width="28" height="36" rx="10" fill={hoodie} stroke={BRAND.ink} strokeWidth="4"/>
            <rect x="140" y="175" width="28" height="36" rx="10" fill={hoodie} stroke={BRAND.ink} strokeWidth="4"/>
            {/* hands */}
            <circle cx={66 + typeT} cy="214" r="9" fill={skin} stroke={BRAND.ink} strokeWidth="3"/>
            <circle cx={154 - typeT} cy="214" r="9" fill={skin} stroke={BRAND.ink} strokeWidth="3"/>
          </g>
        ) : (
          <g>
            <rect x="34" y="160" width="22" height="56" rx="8" fill={hoodie} stroke={BRAND.ink} strokeWidth="4"
                  transform={`rotate(${-10 + armWave} 45 160)`}/>
            <rect x="164" y="160" width="22" height="56" rx="8" fill={hoodie} stroke={BRAND.ink} strokeWidth="4"
                  transform={`rotate(${10 - armWave} 175 160)`}/>
          </g>
        )}

        {/* Neck */}
        <rect x="98" y="104" width="24" height="20" fill={skin} stroke={BRAND.ink} strokeWidth="4"/>

        {/* Head */}
        <ellipse cx="110" cy="70" rx="44" ry="46" fill={skin} stroke={BRAND.ink} strokeWidth="5"/>

        {/* Hair — messy bangs */}
        <path d="M 66 60 Q 68 28 110 22 Q 150 26 156 56 Q 148 42 130 40 Q 122 50 108 44 Q 94 54 82 44 Q 72 50 66 60 Z"
              fill={hair} stroke={BRAND.ink} strokeWidth="4"/>

        {/* Ears */}
        <ellipse cx="66" cy="72" rx="6" ry="10" fill={skin} stroke={BRAND.ink} strokeWidth="3"/>
        <ellipse cx="154" cy="72" rx="6" ry="10" fill={skin} stroke={BRAND.ink} strokeWidth="3"/>

        {/* Headset/headphones */}
        {variant === 'creator' && (
          <g>
            <path d="M 66 48 Q 110 20 154 48" fill="none" stroke={BRAND.ink} strokeWidth="6" strokeLinecap="round"/>
            <rect x="56" y="62" width="16" height="24" rx="6" fill={BRAND.ink}/>
            <rect x="60" y="66" width="8" height="16" rx="3" fill={BRAND.lime}/>
            <rect x="148" y="62" width="16" height="24" rx="6" fill={BRAND.ink}/>
            <rect x="152" y="66" width="8" height="16" rx="3" fill={BRAND.lime}/>
            {/* mic */}
            <path d="M 72 84 Q 84 98 94 96" fill="none" stroke={BRAND.ink} strokeWidth="4" strokeLinecap="round"/>
            <circle cx="96" cy="96" r="4" fill={BRAND.lime} stroke={BRAND.ink} strokeWidth="2"/>
          </g>
        )}

        {/* Glasses — creator only */}
        {variant === 'creator' && (
          <g>
            <rect x="80" y="60" width="24" height="18" rx="4" fill="rgba(255,255,255,0.35)" stroke={BRAND.ink} strokeWidth="3"/>
            <rect x="116" y="60" width="24" height="18" rx="4" fill="rgba(255,255,255,0.35)" stroke={BRAND.ink} strokeWidth="3"/>
            <line x1="104" y1="69" x2="116" y2="69" stroke={BRAND.ink} strokeWidth="3"/>
            {/* eyes behind glasses */}
            <ellipse cx="92" cy="69" rx="3" ry={3 * blink} fill={BRAND.ink}/>
            <ellipse cx="128" cy="69" rx="3" ry={3 * blink} fill={BRAND.ink}/>
            {/* shine on glasses */}
            <line x1="84" y1="64" x2="90" y2="64" stroke={BRAND.paper} strokeWidth="2" strokeLinecap="round"/>
            <line x1="120" y1="64" x2="126" y2="64" stroke={BRAND.paper} strokeWidth="2" strokeLinecap="round"/>
          </g>
        )}

        {/* Eyes (user variant — no glasses) */}
        {variant !== 'creator' && (
          <g>
            <ellipse cx="92" cy="68" rx="4" ry={4 * blink} fill={BRAND.ink}/>
            <ellipse cx="128" cy="68" rx="4" ry={4 * blink} fill={BRAND.ink}/>
          </g>
        )}

        {/* Eyebrows */}
        <path d="M 82 54 Q 92 50 102 54" stroke={BRAND.ink} strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M 118 54 Q 128 50 138 54" stroke={BRAND.ink} strokeWidth="3" fill="none" strokeLinecap="round"/>

        {/* Mouth */}
        {mouth === 'smile' ? (
          <path d="M 96 92 Q 110 102 124 92" stroke={BRAND.ink} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        ) : (
          <path d="M 100 94 Q 110 98 120 94" stroke={BRAND.ink} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        )}

        {/* Cheek blush */}
        <circle cx="80" cy="88" r="4" fill="#FF9AA2" opacity="0.6"/>
        <circle cx="140" cy="88" r="4" fill="#FF9AA2" opacity="0.6"/>
      </svg>

      {label && <div style={{
        fontFamily: MONO, fontSize: 14, color: BRAND.paper,
        letterSpacing: '0.25em', marginTop: 6,
        background: BRAND.ink, padding: '6px 14px', borderRadius: 999,
        border: `2px solid ${BRAND.lime}`,
      }}>{label}</div>}
    </div>
  );
}

// Flying coin
function Coin({ x, y, rot = 0, size = 40, label = '0G' }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: `translate(-50%,-50%) rotate(${rot}deg)`,
      width: size, height: size, borderRadius: '50%',
      background: BRAND.lime, border: `3px solid ${BRAND.ink}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: DISPLAY, fontSize: size * 0.45, color: BRAND.ink,
      boxShadow: `3px 3px 0 ${BRAND.ink}`,
    }}>{label}</div>
  );
}

function Particles({ t, count = 20, area = [0, 0, 1920, 1080], seed = 0 }) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const rx = ((i * 9301 + seed * 49297) % 233280) / 233280;
    const ry = ((i * 49297 + seed * 9301) % 233280) / 233280;
    const x = area[0] + rx * area[2];
    const baseY = area[1] + ry * area[3];
    const y = baseY + Math.sin(t * 1.5 + i) * 20;
    const a = 0.3 + 0.7 * ((Math.sin(t * 2 + i * 0.7) + 1) / 2);
    items.push(
      <div key={i} style={{
        position: 'absolute', left: x, top: y,
        width: 6, height: 6, borderRadius: '50%',
        background: BRAND.lime, opacity: a,
      }}/>
    );
  }
  return <>{items}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 01 — THE PROBLEM (richer)
// Beat A (0.0–1.4): Everyone is using AI — rain of prompts
// Beat B (1.4–2.6): One output looks suspicious — a "fake" stamp appears
// Beat C (2.6–end): "Who built this? Can you trust it?"
// ─────────────────────────────────────────────────────────────────────────────
function SceneHook() {
  const { localTime: t, duration } = useSprite();

  const prompts = [
    { x: 180, y: 180, text: 'Write me a contract', delay: 0.1, from: 'top' },
    { x: 1380, y: 220, text: 'Summarize this PDF', delay: 0.25, from: 'top' },
    { x: 220, y: 640, text: 'Generate an image', delay: 0.4, from: 'left' },
    { x: 1320, y: 720, text: 'Translate to Spanish', delay: 0.55, from: 'right' },
    { x: 480, y: 340, text: 'Debug my code', delay: 0.7, from: 'top' },
    { x: 1480, y: 480, text: 'Diagnose my symptoms', delay: 0.85, from: 'right' },
  ];

  const boxAppear = Easing.easeOutBack(clamp(t / 0.6, 0, 1));
  const fakeStamp = clamp((t - 2.0) / 0.5, 0, 1);
  const fakeBounce = Easing.easeOutBack(fakeStamp);

  const headlineT = clamp((t - 2.6) / 0.5, 0, 1);
  const lineT = clamp((t - 3.0) / 0.7, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={8}/>
      <Particles t={t} count={30} seed={1}/>

      {/* Header pill */}
      <div style={{
        position: 'absolute', top: 70, left: 0, right: 0,
        textAlign: 'center',
        opacity: clamp(t / 0.3, 0, 1),
      }}>
        <div style={{
          display: 'inline-block',
          background: BRAND.ink, color: BRAND.lime,
          padding: '12px 30px', borderRadius: 999,
          fontFamily: MONO, fontSize: 16, fontWeight: 700,
          letterSpacing: '0.25em',
        }}>
          ● THE AI PROBLEM IN 2026
        </div>
      </div>

      {/* Prompts rain in from their sides */}
      {prompts.map((b, i) => {
        const p = clamp((t - b.delay) / 0.5, 0, 1);
        const e = Easing.easeOutBack(p);
        let dx = 0, dy = 0;
        if (b.from === 'top') dy = -200 * (1 - e);
        if (b.from === 'left') dx = -200 * (1 - e);
        if (b.from === 'right') dx = 200 * (1 - e);
        const float = Math.sin((t + i) * 1.4) * 5;
        return (
          <div key={i} style={{
            position: 'absolute', left: b.x, top: b.y,
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + float}px)) scale(${e})`,
            opacity: p,
            background: BRAND.paper, color: BRAND.ink,
            border: `3px solid ${BRAND.ink}`, borderRadius: 18,
            padding: '14px 22px',
            fontFamily: MONO, fontSize: 18, fontWeight: 700,
            boxShadow: `5px 5px 0 ${BRAND.ink}`,
            whiteSpace: 'nowrap',
          }}>
            {b.text}
          </div>
        );
      })}

      {/* Center: mystery AI box (the output) */}
      <div style={{
        position: 'absolute', left: 960, top: 500,
        transform: `translate(-50%,-50%) scale(${boxAppear})`,
      }}>
        <div style={{
          width: 300, height: 300,
          background: BRAND.ink,
          border: `4px solid ${BRAND.paper}`, borderRadius: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `14px 14px 0 ${BRAND.ink}`,
          position: 'relative',
        }}>
          <div style={{
            fontFamily: DISPLAY, fontSize: 220,
            color: BRAND.lime,
            lineHeight: 1,
            transform: `translateY(${Math.sin(t * 3) * 6}px) rotate(${Math.sin(t * 2) * 4}deg)`,
          }}>?</div>
          {/* antennae */}
          <div style={{ position: 'absolute', top: -28, left: 70, width: 6, height: 34, background: BRAND.lime, borderRadius: 3 }}/>
          <div style={{ position: 'absolute', top: -28, right: 70, width: 6, height: 34, background: BRAND.lime, borderRadius: 3 }}/>
          <div style={{ position: 'absolute', top: -42, left: 62, width: 22, height: 22, borderRadius: '50%', background: BRAND.lime, transform: `scale(${1 + Math.sin(t*4)*0.15})` }}/>
          <div style={{ position: 'absolute', top: -42, right: 62, width: 22, height: 22, borderRadius: '50%', background: BRAND.lime, transform: `scale(${1 + Math.sin(t*4 + 1)*0.15})` }}/>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 14, color: BRAND.paper,
          textAlign: 'center', marginTop: 16,
          letterSpacing: '0.2em',
        }}>
          UNVERIFIED · SOURCE UNKNOWN · MODEL UNKNOWN
        </div>

        {/* FAKE? stamp appears */}
        {fakeStamp > 0 && (
          <div style={{
            position: 'absolute', top: -10, right: -80,
            transform: `rotate(14deg) scale(${fakeBounce})`,
            background: '#FF3B3B', color: BRAND.paper,
            border: `4px solid ${BRAND.ink}`, borderRadius: 10,
            padding: '10px 18px',
            fontFamily: DISPLAY, fontSize: 32,
            boxShadow: `4px 4px 0 ${BRAND.ink}`,
            letterSpacing: '0.05em',
          }}>
            FAKE?
          </div>
        )}
      </div>

      {/* Bottom narrative */}
      <div style={{
        position: 'absolute', bottom: 80, left: 0, right: 0,
        textAlign: 'center', opacity: headlineT,
        transform: `translateY(${(1-headlineT) * 20}px)`,
      }}>
        <div style={{
          fontFamily: DISPLAY, fontSize: 68, color: BRAND.paper,
          letterSpacing: '-0.02em', WebkitTextStroke: `2px ${BRAND.ink}`,
          lineHeight: 1.0,
        }}>
          MILLIONS OF AI OUTPUTS.
        </div>
        <div style={{
          fontFamily: DISPLAY, fontSize: 68, color: BRAND.lime,
          letterSpacing: '-0.02em', WebkitTextStroke: `2px ${BRAND.ink}`,
          lineHeight: 1.0, marginTop: 6,
          opacity: lineT, transform: `translateY(${(1-lineT) * 20}px)`,
        }}>
          ZERO WAY TO TRUST THEM.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 02 — ENTER SKILLMINT (richer intro with stamped logo + tagline build)
// ─────────────────────────────────────────────────────────────────────────────
function SceneLogo() {
  const { localTime: t } = useSprite();

  const whiteout = clamp(t / 0.25, 0, 1);
  const skillT = Easing.easeOutBack(clamp((t - 0.3) / 0.5, 0, 1));
  const mintT = Easing.easeOutBack(clamp((t - 0.6) / 0.5, 0, 1));
  const shock = clamp((t - 0.95) / 0.4, 0, 1);
  const tag1 = clamp((t - 1.4) / 0.5, 0, 1);
  const tag2 = clamp((t - 1.9) / 0.5, 0, 1);
  const tag3 = clamp((t - 2.4) / 0.5, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={-6}/>

      {/* whiteout flash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: BRAND.paper,
        opacity: whiteout * (1 - whiteout) * 4,
      }}/>

      {/* shockwave ring */}
      {shock > 0 && (
        <div style={{
          position: 'absolute', left: 960, top: 440,
          transform: `translate(-50%,-50%) scale(${shock * 3})`,
          width: 300, height: 300, borderRadius: '50%',
          border: `6px solid ${BRAND.lime}`,
          opacity: 1 - shock,
        }}/>
      )}

      {/* Brand mark — transparent logo */}
      <div style={{
        position: 'absolute', left: 960, top: 340,
        transform: `translate(-50%, -50%) scale(${skillT}) rotate(${(1-skillT) * -15}deg)`,
        opacity: skillT,
        width: 440, height: 440,
        filter: `drop-shadow(12px 12px 0 ${BRAND.ink})`,
      }}>
        <img src="/logo.png.png" alt="SkillMint" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
      </div>

      {/* SKILL MINT wordmark below logo */}
      <div style={{
        position: 'absolute', left: 960, top: 640,
        transform: `translate(-50%, 0) scale(${mintT})`,
        opacity: mintT,
        fontFamily: DISPLAY, fontSize: 140, fontWeight: 900,
        letterSpacing: '-0.02em', lineHeight: 1,
        whiteSpace: 'nowrap',
        textShadow: `6px 6px 0 ${BRAND.ink}`,
      }}>
        <span style={{ color: BRAND.paper }}>SKILL</span>
        <span style={{ color: '#20C20E' }}>MINT</span>
      </div>

      {/* Tagline builds word by word */}
      <div style={{
        position: 'absolute', bottom: 160, left: 0, right: 0,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 22, color: BRAND.paper,
          letterSpacing: '0.3em', opacity: tag1,
        }}>
          A MARKETPLACE WHERE EVERY AI SKILL IS
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 110, letterSpacing: '-0.02em', lineHeight: 1.0, marginTop: 12 }}>
          <span style={{
            display: 'inline-block', padding: '0 10px',
            color: BRAND.lime, WebkitTextStroke: `3px ${BRAND.ink}`,
            opacity: tag1, transform: `translateY(${(1-tag1) * 20}px)`,
          }}>#VERIFIED</span>
          <span style={{
            display: 'inline-block', padding: '0 10px',
            color: BRAND.paper, WebkitTextStroke: `3px ${BRAND.ink}`,
            opacity: tag2, transform: `translateY(${(1-tag2) * 20}px)`,
          }}>ON-CHAIN</span>
          <span style={{
            display: 'inline-block', padding: '0 10px',
            color: BRAND.paper, WebkitTextStroke: `3px ${BRAND.ink}`,
            opacity: tag3, transform: `translateY(${(1-tag3) * 20}px)`,
          }}>& OWNED</span>
        </div>
      </div>

      {/* orbiting sparks */}
      {[0,1,2,3,4,5,6,7].map(i => {
        const a = (i / 8) * Math.PI * 2 + t * 0.6;
        const r = 320;
        const x = 960 + Math.cos(a) * r;
        const y = 440 + Math.sin(a) * r;
        return <div key={i} style={{
          position: 'absolute', left: x, top: y,
          width: 14, height: 14, borderRadius: '50%',
          background: BRAND.lime, border: `2px solid ${BRAND.ink}`,
          transform: 'translate(-50%,-50%)',
          opacity: clamp((t - 0.6) / 0.4, 0, 1),
        }}/>;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 03 — EXPLORE (richer, with search bar + filter chips + cursor hover)
// ─────────────────────────────────────────────────────────────────────────────
const SKILLS = [
  { name: 'LEGAL CONTRACT WRITER', tag: '#law',      price: '0.05 0G', exec: 1247 },
  { name: 'CODE AUDITOR',          tag: '#dev',      price: '0.12 0G', exec: 892 },
  { name: 'IMAGE UPSCALER 4K',     tag: '#art',      price: '0.02 0G', exec: 3401 },
  { name: 'MEDICAL TRIAGE BOT',    tag: '#health',   price: '0.08 0G', exec: 214 },
  { name: 'POEM MACHINE',          tag: '#creative', price: '0.01 0G', exec: 5122 },
  { name: 'FINANCIAL ANALYST',     tag: '#finance',  price: '0.20 0G', exec: 76 },
];

function SkillCard({ skill, i, t, hoverIdx }) {
  const delay = 0.3 + i * 0.09;
  const a = clamp((t - delay) / 0.5, 0, 1);
  const ae = Easing.easeOutBack(a);
  const isHover = hoverIdx === i;
  const hoverScale = isHover ? 1.06 : 1;
  const hoverShadow = isHover ? 12 : 6;

  return (
    <div style={{
      opacity: a,
      transform: `translateY(${(1-ae) * 60}px) scale(${(0.8 + ae * 0.2) * hoverScale}) rotate(${(1-ae) * -3}deg)`,
      background: BRAND.paper,
      border: `4px solid ${BRAND.ink}`,
      borderRadius: 16,
      padding: 18,
      boxShadow: `${hoverShadow}px ${hoverShadow}px 0 ${BRAND.ink}`,
      display: 'flex', flexDirection: 'column', gap: 10,
      width: 340, height: 200,
      transition: 'transform 200ms, box-shadow 200ms',
      position: 'relative', overflow: 'visible',
    }}>
      {/* NFT corner ribbon */}
      <div style={{
        position: 'absolute', top: -12, right: -10,
        background: BRAND.ink, color: BRAND.lime,
        border: `3px solid ${BRAND.lime}`,
        borderRadius: 8,
        padding: '4px 10px',
        fontFamily: DISPLAY, fontSize: 14,
        letterSpacing: '0.15em',
        boxShadow: `3px 3px 0 ${BRAND.ink}`,
        transform: 'rotate(6deg)',
      }}>NFT</div>
      {/* Token id */}
      <div style={{
        position: 'absolute', bottom: -10, left: 14,
        background: BRAND.lime, color: BRAND.ink,
        border: `2px solid ${BRAND.ink}`,
        borderRadius: 999,
        padding: '2px 10px',
        fontFamily: MONO, fontSize: 11,
        letterSpacing: '0.18em',
        fontWeight: 800,
      }}>#{String(1024 + i * 137).padStart(4, '0')}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          width: 54, height: 54, borderRadius: 12,
          background: BRAND.blue, border: `3px solid ${BRAND.ink}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: DISPLAY, fontSize: 22, color: BRAND.lime,
        }}>{skill.tag[1].toUpperCase()}</div>
        <div style={{
          fontFamily: MONO, fontSize: 12, color: BRAND.ink,
          background: BRAND.lime, padding: '4px 10px',
          border: `2px solid ${BRAND.ink}`, borderRadius: 999,
          letterSpacing: '0.1em', fontWeight: 700,
        }}>
          {skill.tag}
        </div>
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 22, color: BRAND.ink,
        lineHeight: 1, letterSpacing: '-0.01em',
      }}>
        {skill.name}
      </div>
      <div style={{ flex: 1 }}/>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `2px dashed ${BRAND.ink}`, paddingTop: 8,
      }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: BRAND.ink }}>
          ⚡ {skill.exec.toLocaleString()} runs
        </div>
        <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: BRAND.ink }}>
          {skill.price}
        </div>
      </div>
    </div>
  );
}

function Cursor({ path, time }) {
  let x = path[0].x, y = path[0].y;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i+1];
    if (time >= a.t && time <= b.t) {
      const p = (time - a.t) / (b.t - a.t);
      const e = Easing.easeInOutCubic(p);
      x = a.x + (b.x - a.x) * e;
      y = a.y + (b.y - a.y) * e;
    } else if (time > b.t && i === path.length - 2) {
      x = b.x; y = b.y;
    }
  }
  const opacity = clamp((time - path[0].t + 0.3) / 0.3, 0, 1);
  return (
    <svg width="44" height="44" viewBox="0 0 40 40" style={{
      position: 'absolute', left: x, top: y,
      transform: 'translate(-4px,-4px)',
      opacity, pointerEvents: 'none', zIndex: 10,
      filter: `drop-shadow(3px 3px 0 ${BRAND.ink})`,
    }}>
      <path d="M4 4 L4 28 L11 22 L16 34 L21 32 L16 20 L26 20 Z"
            fill={BRAND.paper} stroke={BRAND.ink} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

function SceneExplore() {
  const { localTime: t } = useSprite();

  const headT = clamp(t / 0.5, 0, 1);
  const searchT = clamp((t - 0.5) / 0.5, 0, 1);
  const typed = 'poem'.slice(0, Math.floor(clamp((t - 0.7) / 0.6, 0, 1) * 4));
  const chipsT = clamp((t - 1.2) / 0.4, 0, 1);

  // Cursor path: comes in → moves to POEM MACHINE card (index 4 in grid)
  const cursorPath = [
    { t: 2.4, x: 1700, y: 950 },
    { t: 3.6, x: 1300, y: 600 },
    { t: 4.8, x: 1300, y: 600 },
  ];

  // Hover card 4 (POEM MACHINE) once cursor arrives
  const hoverIdx = t > 3.6 ? 4 : -1;

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={3}/>

      <StepHeader num="02" title="EXPLORE" sub="Browse a live marketplace of on-chain AI skills. Every one is an NFT you can read, run, or buy." t={t}/>

      {/* Search bar */}
      <div style={{
        position: 'absolute', top: 360, left: 80,
        width: 640, height: 64,
        background: BRAND.paper, border: `4px solid ${BRAND.ink}`,
        borderRadius: 999,
        boxShadow: `5px 5px 0 ${BRAND.ink}`,
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 24px',
        opacity: searchT, transform: `translateY(${(1-searchT) * 20}px)`,
      }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="9" cy="9" r="6" stroke={BRAND.ink} strokeWidth="3"/>
          <line x1="13" y1="13" x2="19" y2="19" stroke={BRAND.ink} strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <div style={{ fontFamily: MONO, fontSize: 22, color: BRAND.ink, fontWeight: 700 }}>
          {typed || 'search skills...'}
          {typed && typed.length < 4 ? '▎' : ''}
        </div>
      </div>

      {/* Filter chips */}
      <div style={{
        position: 'absolute', top: 450, left: 80,
        display: 'flex', gap: 10, flexWrap: 'wrap', width: 640,
        opacity: chipsT,
      }}>
        {['#creative','#dev','#art','#finance','#law','#health'].map((c, i) => (
          <div key={c} style={{
            padding: '8px 16px',
            background: c === '#creative' ? BRAND.lime : BRAND.ink,
            color: c === '#creative' ? BRAND.ink : BRAND.paper,
            border: `2px solid ${BRAND.ink}`,
            borderRadius: 999,
            fontFamily: MONO, fontSize: 14, fontWeight: 700,
            letterSpacing: '0.1em',
            transform: `translateY(${(1 - clamp((t - 1.2 - i*0.06)/0.3, 0, 1)) * 20}px)`,
          }}>{c}</div>
        ))}
      </div>

      {/* Grid of cards */}
      <div style={{
        position: 'absolute', top: 280, right: 80,
        display: 'grid', gridTemplateColumns: 'repeat(2, 340px)', gap: 20,
      }}>
        {SKILLS.map((s, i) => <SkillCard key={i} skill={s} i={i} t={t} hoverIdx={hoverIdx}/>)}
      </div>

      <Cursor path={cursorPath} time={t}/>

      {/* Caption */}
      <Caption t={t} start={3.8} end={5.2}>
        ⚡ 12,952 SKILLS MINTED AS NFTs · OWN · RUN · TRADE
      </Caption>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 04 — EXECUTE (richer: prompt typed, coins escrow, receipt progress)
// ─────────────────────────────────────────────────────────────────────────────
function SceneExecute() {
  const { localTime: t } = useSprite();

  const headT = clamp(t / 0.5, 0, 1);
  const promptText = 'Write a 3-line poem about rain.';
  const promptT = clamp((t - 0.5) / 0.9, 0, 1);
  const typed = promptText.slice(0, Math.floor(promptText.length * promptT));
  const buttonT = clamp((t - 1.5) / 0.3, 0, 1);
  const pressed = t > 1.9 && t < 2.1;

  const coinStart = 2.0, coinEnd = 3.4;
  const numCoins = 7;
  const lockT = clamp((t - 3.4) / 0.5, 0, 1);

  // Processing bar in skill card
  const processT = clamp((t - 3.4) / 1.8, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={4}/>

      <StepHeader num="03" title="EXECUTE" sub="AI agents run the skill. Their fees escrow in a smart contract; the skill executes inside a trusted compute enclave — not some random server." t={t}/>

      {/* AI agents stacked vertically, far left — clear of the prompt card */}
      {[
        { name: 'GPT AGENT',    color: '#10A37F', shape: 'knot',    delay: 0.0 },
        { name: 'CLAUDE AGENT', color: '#D97757', shape: 'sparkle', delay: 0.2 },
        { name: 'GEMINI AGENT', color: '#4285F4', shape: 'star4',   delay: 0.4 },
      ].map((agent, i) => {
        const appearT = clamp((t - agent.delay) / 0.4, 0, 1);
        const e = Easing.easeOutBack(appearT);
        const bob = Math.sin(t * 2 + i * 1.3) * 4;
        const y = 380 + i * 180 + bob;
        const spin = Math.sin(t*1.5 + i) * 6;
        return (
          <div key={agent.name} style={{
            position: 'absolute', left: 160, top: y,
            transform: `translate(-50%, -50%) scale(${e})`,
            opacity: appearT,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            {/* Agent robot badge */}
            <div style={{
              width: 130, height: 130, borderRadius: 28,
              background: BRAND.paper,
              border: `5px solid ${BRAND.ink}`,
              boxShadow: `6px 6px 0 ${BRAND.ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', width: 4, height: 18, background: BRAND.ink }}/>
              <div style={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: agent.color, border: `3px solid ${BRAND.ink}`, boxShadow: `0 0 12px ${agent.color}` }}/>

              {/* Brand-inspired generic SVG glyph (not actual trademarked logos) */}
              <svg width="84" height="84" viewBox="0 0 100 100" style={{ transform: `rotate(${spin}deg)`, filter: `drop-shadow(2px 2px 0 ${BRAND.ink})` }}>
                {agent.shape === 'knot' && (
                  // Generic rosette of overlapping rings
                  <g fill="none" stroke={agent.color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="50" cy="32" r="18"/>
                    <circle cx="68" cy="60" r="18"/>
                    <circle cx="32" cy="60" r="18"/>
                    <path d="M 32 32 L 68 68 M 68 32 L 32 68" opacity="0.35"/>
                  </g>
                )}
                {agent.shape === 'sparkle' && (
                  // 12-ray burst — Claude-style radial sparkle
                  (() => {
                    const rays = 12;
                    const cx = 50, cy = 50;
                    const rOuter = 46, rInner = 12;
                    const petals = [];
                    for (let r = 0; r < rays; r++) {
                      const a = (r / rays) * Math.PI * 2;
                      const wHalf = 0.09; // radians half-width at base
                      const x1 = cx + Math.cos(a - wHalf) * rInner;
                      const y1 = cy + Math.sin(a - wHalf) * rInner;
                      const x2 = cx + Math.cos(a) * rOuter;
                      const y2 = cy + Math.sin(a) * rOuter;
                      const x3 = cx + Math.cos(a + wHalf) * rInner;
                      const y3 = cy + Math.sin(a + wHalf) * rInner;
                      petals.push(`M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} Z`);
                    }
                    return (
                      <g fill={agent.color} stroke={BRAND.ink} strokeWidth="2" strokeLinejoin="round">
                        <circle cx="50" cy="50" r="10" fill={agent.color}/>
                        <path d={petals.join(' ')}/>
                      </g>
                    );
                  })()
                )}
                {agent.shape === 'star4' && (
                  // 4-point concave star with rainbow gradient — Gemini-style
                  <g>
                    <defs>
                      <linearGradient id={`gem-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%"   stopColor="#E94B4B"/>
                        <stop offset="35%"  stopColor="#F5A623"/>
                        <stop offset="65%"  stopColor="#4285F4"/>
                        <stop offset="100%" stopColor="#34A853"/>
                      </linearGradient>
                    </defs>
                    <path d="M 50 6
                             C 52 34, 66 48, 94 50
                             C 66 52, 52 66, 50 94
                             C 48 66, 34 52, 6 50
                             C 34 48, 48 34, 50 6 Z"
                      fill={`url(#gem-grad-${i})`} stroke={BRAND.ink} strokeWidth="3" strokeLinejoin="round"/>
                  </g>
                )}
              </svg>

              <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: BRAND.ink }}/>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: BRAND.ink }}/>
              </div>
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 11, color: BRAND.paper,
              letterSpacing: '0.2em',
              background: BRAND.ink, padding: '4px 10px', borderRadius: 999,
              border: `2px solid ${BRAND.lime}`,
            }}>{agent.name}</div>
          </div>
        );
      })}

      {/* Prompt box */}
      <div style={{
        position: 'absolute', left: 380, top: 580,
        width: 440,
        background: BRAND.paper,
        border: `4px solid ${BRAND.ink}`,
        borderRadius: 18,
        padding: 18,
        boxShadow: `6px 6px 0 ${BRAND.ink}`,
        opacity: clamp(t / 0.3, 0, 1),
      }}>
        <div style={{ fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.2em' }}>
          PROMPT
        </div>
        <div style={{ fontFamily: MONO, fontSize: 20, color: BRAND.ink, marginTop: 4, minHeight: 56, lineHeight: 1.4 }}>
          {typed}{promptT < 1 && promptT > 0 ? '▎' : ''}
        </div>

        {/* Run button */}
        <div style={{
          marginTop: 14,
          display: 'inline-block',
          padding: '12px 24px',
          background: BRAND.lime,
          border: `3px solid ${BRAND.ink}`,
          borderRadius: 999,
          fontFamily: DISPLAY, fontSize: 22, color: BRAND.ink,
          boxShadow: pressed ? `0 0 0 ${BRAND.ink}` : `4px 4px 0 ${BRAND.ink}`,
          transform: pressed ? 'translate(4px,4px)' : 'translate(0,0)',
          opacity: buttonT,
          transition: 'none',
        }}>
          RUN SKILL · 0.01 0G
        </div>
      </div>

      {/* Escrow vault */}
      <div style={{ position: 'absolute', left: 960, top: 620, transform: 'translate(-50%, -50%)' }}>
        <div style={{
          width: 240, height: 240,
          background: BRAND.ink,
          border: `5px solid ${BRAND.lime}`,
          borderRadius: 24,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 0 4px ${BRAND.ink}, 10px 10px 0 ${BRAND.ink}`,
          position: 'relative',
        }}>
          <div style={{ fontSize: 110, transform: `scale(${1 + lockT * 0.1})` }}>🔒</div>
          <div style={{ fontFamily: MONO, fontSize: 14, color: BRAND.lime, letterSpacing: '0.2em', marginTop: 4 }}>
            ESCROW
          </div>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 14, color: BRAND.paper,
          textAlign: 'center', marginTop: 12, letterSpacing: '0.15em',
        }}>
          {lockT > 0 ? 'LOCKED · 0.01 0G' : 'WAITING...'}
        </div>
        {/* Lock shockwave */}
        {lockT > 0 && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 240, height: 240, borderRadius: 24,
            border: `5px solid ${BRAND.lime}`,
            transform: `translate(-50%,-50%) scale(${1 + lockT * 1.2})`,
            opacity: 1 - lockT,
          }}/>
        )}
      </div>

      {/* Skill card + processing */}
      <div style={{ position: 'absolute', right: 140, top: 500 }}>
        <div style={{
          background: BRAND.paper,
          border: `4px solid ${BRAND.ink}`,
          borderRadius: 16,
          padding: 18,
          boxShadow: `6px 6px 0 ${BRAND.ink}`,
          width: 320,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: BRAND.blue, border: `2px solid ${BRAND.ink}`}}/>
            <div style={{ fontFamily: DISPLAY, fontSize: 22, color: BRAND.ink }}>POEM MACHINE</div>
          </div>
          <div style={{
            background: BRAND.lime, border: `2px solid ${BRAND.ink}`,
            borderRadius: 8, padding: 8,
            fontFamily: MONO, fontSize: 11, color: BRAND.ink,
            letterSpacing: '0.15em',
          }}>
            ● TEE COMPUTE · 0G
          </div>
          {/* Processing bar */}
          <div style={{
            marginTop: 12,
            height: 12, background: '#eee',
            border: `2px solid ${BRAND.ink}`, borderRadius: 999,
            overflow: 'hidden',
            opacity: lockT > 0 ? 1 : 0.3,
          }}>
            <div style={{
              height: '100%', width: `${processT * 100}%`,
              background: `repeating-linear-gradient(-45deg, ${BRAND.blue} 0 10px, ${BRAND.blueDeep} 10px 20px)`,
              transition: 'width 50ms',
            }}/>
          </div>
          <div style={{
            marginTop: 6, fontFamily: MONO, fontSize: 11, color: BRAND.ink,
            letterSpacing: '0.15em',
          }}>
            {processT < 1 ? `COMPUTING · ${Math.floor(processT * 100)}%` : 'DONE · OUTPUT READY'}
          </div>
        </div>
      </div>

      {/* Flying coins */}
      {Array.from({ length: numCoins }).map((_, i) => {
        const stagger = i * 0.14;
        const p = clamp((t - coinStart - stagger) / 0.9, 0, 1);
        if (p <= 0 || p >= 1) return null;
        const e = Easing.easeInOutCubic(p);
        const x = 400 + (960 - 400) * e;
        const arc = Math.sin(e * Math.PI) * 140;
        const y = 680 - arc + (620 - 680) * e;
        return <Coin key={i} x={x} y={y} rot={e * 720} size={46}/>;
      })}

      <Caption t={t} start={2.2} end={3.4} y={970}>
        💰 ESCROWED IN A SMART CONTRACT — SKILL RUNS IN A TEE
      </Caption>
      <Caption t={t} start={3.8} end={5.2} y={970}>
        🔐 NO ONE CAN TAMPER WITH THE OUTPUT, NOT EVEN US
      </Caption>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 05 — VERIFY (richer: hash → signature → on-chain receipt with steps)
// ─────────────────────────────────────────────────────────────────────────────
function SceneVerify() {
  const { localTime: t } = useSprite();

  const outT = clamp(t / 0.5, 0, 1);
  const beamT = clamp((t - 1.0) / 1.0, 0, 1);
  const hashT = clamp((t - 1.5) / 0.6, 0, 1);
  const sigT = clamp((t - 2.3) / 0.6, 0, 1);
  const stampT = clamp((t - 2.9) / 0.5, 0, 1);
  const stampE = Easing.easeOutBack(stampT);
  const receiptT = clamp((t - 3.6) / 0.6, 0, 1);

  const outputText = `Silver rain on slate tonight,
silence hums an even light,
puddles catch the morning's flight.`;

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={5}/>

      <StepHeader num="04" title="VERIFY" sub="Receipt + TEE signature stored on 0G Storage; root hash sealed on-chain. Anyone can verify the output — forever, trustlessly." t={t}/>

      {/* Output card (left) */}
      <div style={{
        position: 'absolute', left: 120, top: 480,
        width: 640,
        background: BRAND.paper,
        border: `4px solid ${BRAND.ink}`,
        borderRadius: 18,
        padding: 28,
        boxShadow: `8px 8px 0 ${BRAND.ink}`,
        opacity: outT, transform: `translateY(${(1-outT) * 20}px)`,
      }}>
        <div style={{ fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.2em' }}>
          OUTPUT
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 22, color: BRAND.ink,
          marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-line',
        }}>
          {outputText}
        </div>

        {/* scan beam */}
        {beamT > 0 && beamT < 1 && (
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: `${beamT * 100}%`,
            height: 4, background: BRAND.lime,
            boxShadow: `0 0 20px ${BRAND.lime}, 0 -40px 40px ${BRAND.lime}88`,
          }}/>
        )}

        {stampT > 0 && (
          <div style={{
            position: 'absolute', right: -30, top: -30,
            transform: `rotate(-12deg) scale(${stampE})`,
            background: BRAND.lime, color: BRAND.ink,
            border: `4px solid ${BRAND.ink}`, borderRadius: 999,
            padding: '16px 28px',
            fontFamily: DISPLAY, fontSize: 30,
            boxShadow: `5px 5px 0 ${BRAND.ink}`,
            letterSpacing: '0.05em',
          }}>
            ✓ #VERIFIED
          </div>
        )}
      </div>

      {/* Hash / signature panel */}
      <div style={{
        position: 'absolute', left: 120, top: 810,
        width: 640,
        background: BRAND.ink,
        border: `3px solid ${BRAND.lime}`,
        borderRadius: 14,
        padding: 16,
        opacity: clamp(hashT + sigT, 0, 1),
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 12, color: BRAND.lime,
          letterSpacing: '0.2em', opacity: hashT,
        }}>
          OUTPUT HASH
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 16, color: BRAND.paper,
          marginTop: 4, opacity: hashT,
          wordBreak: 'break-all',
        }}>
          0x{Math.floor(hashT * 999999999).toString(16).padStart(8, '0')}a8f3e9…c2b41d
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 12, color: BRAND.lime,
          letterSpacing: '0.2em', opacity: sigT, marginTop: 8,
        }}>
          TEE SIGNATURE
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 16, color: BRAND.paper,
          marginTop: 4, opacity: sigT, wordBreak: 'break-all',
        }}>
          sig:0x{Math.floor(sigT * 999999999).toString(16).padStart(10, '0')}…99fd02
        </div>
      </div>

      {/* TEE enclave (right) */}
      <div style={{ position: 'absolute', right: 160, top: 440 }}>
        <div style={{
          width: 360, height: 360,
          background: BRAND.ink,
          border: `5px solid ${BRAND.lime}`,
          borderRadius: 24,
          boxShadow: `10px 10px 0 ${BRAND.ink}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* scan lines */}
          {Array.from({length: 8}).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0,
              top: ((t * 80 + i * 45) % 360),
              height: 1, background: `${BRAND.lime}44`,
            }}/>
          ))}
          <div style={{ fontSize: 130, transform: `scale(${1 + Math.sin(t*3)*0.05})` }}>🛡</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 36, color: BRAND.lime, marginTop: -10 }}>
            TEE
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 13, color: BRAND.paper,
            letterSpacing: '0.2em', marginTop: 4,
          }}>
            TRUSTED ENCLAVE
          </div>
        </div>

        {/* Checklist */}
        <div style={{
          marginTop: 16, fontFamily: MONO, fontSize: 15, color: BRAND.paper,
        }}>
          {[
            { label: 'COMPUTE CAPTURED', at: 1.0 },
            { label: 'OUTPUT HASHED', at: 1.8 },
            { label: 'SIGNED BY ENCLAVE', at: 2.6 },
            { label: 'POSTED ON-CHAIN', at: 3.6 },
          ].map((c, i) => {
            const done = t > c.at;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: t > c.at - 0.3 ? 1 : 0.3,
                marginBottom: 4,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: done ? BRAND.lime : BRAND.ink,
                  border: `2px solid ${BRAND.lime}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: BRAND.ink, fontWeight: 900,
                }}>{done ? '✓' : ''}</div>
                <span style={{ letterSpacing: '0.1em' }}>{c.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Receipt chip */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, right: 0,
        textAlign: 'center',
        opacity: receiptT,
        transform: `translateY(${(1-receiptT) * 40}px)`,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          background: BRAND.ink,
          border: `4px solid ${BRAND.lime}`,
          borderRadius: 999,
          padding: '16px 32px',
          fontFamily: MONO, fontSize: 18, color: BRAND.paper,
          letterSpacing: '0.15em',
          boxShadow: `6px 6px 0 ${BRAND.ink}`,
        }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: BRAND.lime,
            animation: 'none', transform: `scale(${1 + Math.sin(t*5)*0.2})` }}/>
          TX 0x9af3…b21c · SETTLED ON 0G GALILEO
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 06 — PUBLISH (richer: build skill → mint → NFT card → revenue loop → tradeable)
// ─────────────────────────────────────────────────────────────────────────────
function ScenePublish() {
  const { localTime: t } = useSprite();

  const devT = clamp(t / 0.3, 0, 1);
  const formT = clamp((t - 0.3) / 0.5, 0, 1);
  const mintBtnT = clamp((t - 1.2) / 0.3, 0, 1);
  const pressed = t > 1.5 && t < 1.7;
  const cardT = clamp((t - 1.7) / 0.6, 0, 1);
  const cardE = Easing.easeOutBack(cardT);
  const mintStampT = clamp((t - 2.3) / 0.5, 0, 1);
  const revenueT = clamp((t - 2.9) / 1.0, 0, 1);
  const tradeT = clamp((t - 4.3) / 0.5, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={6}/>

      <StepHeader num="01" title="PUBLISH" sub="Creator mints the skill as a tradeable ERC-721 NFT. 90% of every execution flows to the owner — transfer it, sell it, the revenue follows." t={t}/>

      {/* Creator — pushed to far left for clear separation */}
      <div style={{ position: 'absolute', left: 120, top: 880, opacity: devT }}>
        <Character x={0} y={0} label="CREATOR" t={t} variant="creator" hoodie={BRAND.lime} hair={BRAND.ink}/>
      </div>

      {/* Skill-build form (shifted right with gap from creator, fades out as NFT card animates in) */}
      {t < 1.9 && (() => {
        const fadeOut = clamp((1.7 - t) / 0.2, 0, 1);
        return (
        <div style={{
          position: 'absolute', left: 520, top: 520,
          width: 420,
          background: BRAND.paper,
          border: `4px solid ${BRAND.ink}`,
          borderRadius: 18,
          padding: 18,
          boxShadow: `6px 6px 0 ${BRAND.ink}`,
          opacity: formT * fadeOut,
          transform: `translateY(${(1-formT) * 30}px) scale(${formT})`,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.2em' }}>NAME</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 24, color: BRAND.ink, marginTop: 2 }}>POEM MACHINE</div>
          <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.2em' }}>PROMPT</div>
          <div style={{ fontFamily: MONO, fontSize: 14, color: BRAND.ink, marginTop: 2,
            background: '#f2f2f2', padding: 8, borderRadius: 6,
            border: `1px solid ${BRAND.ink}`,
          }}>
            "Write a vivid 3-line poem about {"{topic}"}…"
          </div>
          <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.2em' }}>PRICE PER RUN</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 20, color: BRAND.ink, marginTop: 2 }}>0.01 0G</div>

          <div style={{
            marginTop: 14,
            display: 'inline-block',
            padding: '12px 24px',
            background: BRAND.lime,
            border: `3px solid ${BRAND.ink}`,
            borderRadius: 999,
            fontFamily: DISPLAY, fontSize: 22, color: BRAND.ink,
            boxShadow: pressed ? `0 0 0 ${BRAND.ink}` : `4px 4px 0 ${BRAND.ink}`,
            transform: pressed ? 'translate(4px,4px)' : 'translate(0,0)',
            opacity: mintBtnT,
          }}>
            PUBLISH → MINT NFT
          </div>
        </div>
        );
      })()}

      {/* NFT card — shifted right to keep gap from creator */}
      {cardT > 0 && (
        <div style={{
          position: 'absolute', left: 1080, top: 580,
          transform: `translate(-50%, -50%) scale(${cardE}) rotate(${(1-cardE) * -10}deg)`,
          opacity: cardT,
        }}>
          <div style={{
            width: 400, height: 460,
            background: BRAND.paper,
            border: `5px solid ${BRAND.ink}`,
            borderRadius: 22,
            padding: 20,
            boxShadow: `10px 10px 0 ${BRAND.ink}`,
            position: 'relative',
          }}>
            <div style={{
              width: '100%', height: 220,
              background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.lime})`,
              border: `3px solid ${BRAND.ink}`,
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                fontFamily: DISPLAY, fontSize: 120, color: BRAND.paper,
                WebkitTextStroke: `3px ${BRAND.ink}`,
                transform: `rotate(${Math.sin(t * 1.4) * 6}deg)`,
              }}>⚡</div>
              <div style={{
                position: 'absolute', top: 10, right: 10,
                fontFamily: MONO, fontSize: 11,
                background: BRAND.ink, color: BRAND.lime,
                padding: '4px 10px', borderRadius: 999,
                letterSpacing: '0.15em',
              }}>#0001</div>
            </div>

            <div style={{ fontFamily: DISPLAY, fontSize: 30, color: BRAND.ink, marginTop: 14 }}>
              POEM MACHINE
            </div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: BRAND.ink, opacity: 0.6, marginTop: 2 }}>
              OWNER · 0x06…5611
            </div>

            <div style={{
              marginTop: 14, paddingTop: 12,
              borderTop: `2px dashed ${BRAND.ink}`,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.2em' }}>RUNS</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 24, color: BRAND.ink }}>
                  {Math.floor(5122 + revenueT * 127)}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.2em' }}>EARNED</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 24, color: BRAND.ink }}>
                  {(51.22 + revenueT * 1.27).toFixed(2)} 0G
                </div>
              </div>
            </div>

            {mintStampT > 0 && (
              <div style={{
                position: 'absolute', top: -30, left: -30,
                transform: `rotate(-14deg) scale(${Easing.easeOutBack(mintStampT)})`,
                background: BRAND.lime, color: BRAND.ink,
                border: `4px solid ${BRAND.ink}`, borderRadius: 10,
                padding: '10px 22px',
                fontFamily: DISPLAY, fontSize: 30,
                boxShadow: `4px 4px 0 ${BRAND.ink}`,
                letterSpacing: '0.05em',
              }}>
                MINTED!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revenue loop coins */}
      {revenueT > 0 && Array.from({ length: 5 }).map((_, i) => {
        const loopDur = 1.5;
        const localT = ((t - 2.9 + i * 0.32) % loopDur) / loopDur;
        if (localT < 0) return null;
        const e = localT;
        const x = 1080 + (140 - 1080) * e;
        const arc = Math.sin(e * Math.PI) * 180;
        const y = 580 + (820 - 580) * e - arc;
        return <Coin key={i} x={x} y={y} rot={e * 540} size={42}/>;
      })}

      {/* Revenue counter */}
      {revenueT > 0 && (
        <div style={{
          position: 'absolute', right: 120, top: 460,
          background: BRAND.ink, color: BRAND.lime,
          border: `4px solid ${BRAND.lime}`, borderRadius: 20,
          padding: '20px 26px',
          fontFamily: MONO, fontSize: 16,
          letterSpacing: '0.15em',
          boxShadow: `8px 8px 0 ${BRAND.ink}`,
          opacity: revenueT,
          transform: `translateY(${(1-revenueT) * 20}px)`,
          minWidth: 280,
        }}>
          <div style={{ opacity: 0.7, fontSize: 12, letterSpacing: '0.25em' }}>LIFETIME REVENUE</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 58, color: BRAND.lime, marginTop: 6, lineHeight: 1 }}>
            {(51.22 + revenueT * 1.27).toFixed(2)}
          </div>
          <div style={{ fontSize: 12, letterSpacing: '0.3em', marginTop: 4 }}>0G TOKENS</div>

          {/* Tradeable hint */}
          {tradeT > 0 && (
            <div style={{
              marginTop: 14, paddingTop: 12,
              borderTop: `2px dashed ${BRAND.lime}44`,
              opacity: tradeT,
              fontSize: 13, color: BRAND.paper, letterSpacing: '0.2em',
            }}>
              ⇅ OR SELL THE NFT TO A NEW OWNER
            </div>
          )}
        </div>
      )}

      {/* ───── SECONDARY MARKET BEAT ─────
          New buyer makes a bid → card flips to new owner → SOLD stamp → royalty still drips back */}
      {(() => {
        const bidInT   = clamp((t - 5.2) / 0.5, 0, 1);
        const bidE     = Easing.easeOutBack(bidInT);
        const acceptT  = clamp((t - 6.0) / 0.4, 0, 1);
        const soldT    = clamp((t - 6.2) / 0.4, 0, 1);
        const soldE    = Easing.easeOutBack(soldT);
        const newOwnT  = clamp((t - 6.4) / 0.4, 0, 1);
        const royT     = clamp((t - 6.6) / 0.6, 0, 1);

        if (bidInT <= 0) return null;

        return (
          <>
            {/* Incoming bid card, floats up from below */}
            {bidInT > 0 && acceptT < 1 && (
              <div style={{
                position: 'absolute', left: 1360, top: 620,
                transform: `translateY(${(1 - bidE) * 80}px) scale(${bidE})`,
                opacity: bidInT * (1 - acceptT),
                background: BRAND.paper,
                border: `4px solid ${BRAND.ink}`,
                borderRadius: 16,
                padding: 16,
                boxShadow: `6px 6px 0 ${BRAND.ink}`,
                width: 280,
              }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.22em' }}>
                  INCOMING BID
                </div>
                <div style={{ fontFamily: DISPLAY, fontSize: 38, color: BRAND.ink, marginTop: 2, lineHeight: 1 }}>
                  180 <span style={{ fontSize: 22 }}>0G</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.7, marginTop: 6, letterSpacing: '0.15em' }}>
                  FROM · 0xA3…F41C
                </div>
                <div style={{
                  marginTop: 10,
                  display: 'inline-block',
                  padding: '8px 14px',
                  background: BRAND.lime,
                  border: `3px solid ${BRAND.ink}`,
                  borderRadius: 999,
                  fontFamily: DISPLAY, fontSize: 16,
                  boxShadow: `3px 3px 0 ${BRAND.ink}`,
                }}>ACCEPT BID</div>
              </div>
            )}

            {/* NEW OWNER ribbon appears on the NFT card after accept */}
            {newOwnT > 0 && (
              <div style={{
                position: 'absolute', left: 1080, top: 740,
                transform: `translate(-50%, 0) scale(${Easing.easeOutBack(newOwnT)})`,
                opacity: newOwnT,
                background: BRAND.ink, color: BRAND.lime,
                border: `3px solid ${BRAND.lime}`,
                borderRadius: 999,
                padding: '6px 16px',
                fontFamily: MONO, fontSize: 13,
                letterSpacing: '0.2em',
              }}>
                NEW OWNER · 0xA3…F41C
              </div>
            )}

            {/* SOLD stamp on the card */}
            {soldT > 0 && (
              <div style={{
                position: 'absolute', left: 1080, top: 580,
                transform: `translate(-50%, -50%) rotate(10deg) scale(${soldE})`,
                background: '#FF3B3B', color: BRAND.paper,
                border: `5px solid ${BRAND.ink}`, borderRadius: 12,
                padding: '14px 34px',
                fontFamily: DISPLAY, fontSize: 64,
                boxShadow: `6px 6px 0 ${BRAND.ink}`,
                letterSpacing: '0.05em',
                pointerEvents: 'none',
              }}>
                SOLD
              </div>
            )}

            {/* Royalty coins: even after sale, creator still earns a cut */}
            {royT > 0 && Array.from({ length: 4 }).map((_, i) => {
              const loopDur = 1.2;
              const lt = (((t - 6.6) + i * 0.28) % loopDur) / loopDur;
              if (lt < 0) return null;
              const e = lt;
              const x = 1080 + (140 - 1080) * e;
              const arc = Math.sin(e * Math.PI) * 150;
              const y = 580 + (820 - 580) * e - arc;
              return <Coin key={`roy${i}`} x={x} y={y} rot={e * 540} size={36} label="%"/>;
            })}

            {/* Royalty caption */}
            {royT > 0 && (
              <div style={{
                position: 'absolute', left: 140, top: 720,
                transform: 'translate(-50%, 0)',
                background: BRAND.lime, color: BRAND.ink,
                border: `3px solid ${BRAND.ink}`, borderRadius: 12,
                padding: '8px 14px',
                fontFamily: DISPLAY, fontSize: 18,
                boxShadow: `4px 4px 0 ${BRAND.ink}`,
                opacity: royT, whiteSpace: 'nowrap',
              }}>
                +5% ROYALTY FOREVER
              </div>
            )}
          </>
        );
      })()}

      <Caption t={t} start={3.4} end={4.8} y={970}>
        🪙 EVERY RUN = AUTO-PAYMENT TO THE NFT OWNER
      </Caption>
      <Caption t={t} start={5.4} end={7.2} y={970}>
        💱 SKILLS ARE TRADEABLE NFTs — SELL, TRANSFER, COLLECT ROYALTIES
      </Caption>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 07 — OUTRO (richer CTA + feature bullets)
// ─────────────────────────────────────────────────────────────────────────────
function SceneOutro() {
  const { localTime: t } = useSprite();

  const v = clamp(t / 0.4, 0, 1);
  const a = clamp((t - 0.35) / 0.5, 0, 1);
  const o = clamp((t - 0.7) / 0.5, 0, 1);
  const bulletsT = clamp((t - 1.1) / 0.5, 0, 1);
  const cta = clamp((t - 1.6) / 0.5, 0, 1);

  const wobble = Math.sin(t * 3) * 3;

  const bullets = [
    '⚡ RUN VERIFIED AI SKILLS',
    '💰 MONETIZE YOURS AS NFTs',
    '🛡 TEE-ATTESTED, ON-CHAIN',
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={-5}/>
      <Particles t={t} count={30} seed={7}/>

      <div style={{
        position: 'absolute', top: 80, left: 0, right: 0,
        textAlign: 'center', opacity: clamp(t / 0.3, 0, 1),
      }}>
        <div style={{
          display: 'inline-block',
          background: BRAND.ink, color: BRAND.lime,
          padding: '10px 28px', borderRadius: 999,
          fontFamily: MONO, fontSize: 16, fontWeight: 700,
          letterSpacing: '0.25em',
        }}>
          ● LIVE ON 0G GALILEO TESTNET
        </div>
      </div>

      {/* Stacked slogan */}
      <div style={{ position: 'absolute', top: 160, left: 0, right: 0, textAlign: 'center',
        opacity: v, transform: `translateY(${(1-v) * 30}px)` }}>
        <div style={{
          display: 'inline-block',
          fontFamily: DISPLAY, fontSize: 170, color: BRAND.lime,
          WebkitTextStroke: `4px ${BRAND.ink}`,
          letterSpacing: '-0.02em', lineHeight: 1,
        }}>#VERIFIED</div>
      </div>
      <div style={{ position: 'absolute', top: 340, left: 0, right: 0, textAlign: 'center',
        opacity: a, transform: `translateY(${(1-a) * 30}px)` }}>
        <div style={{
          fontFamily: DISPLAY, fontSize: 190, color: BRAND.paper,
          WebkitTextStroke: `4px ${BRAND.ink}`,
          letterSpacing: '-0.03em', lineHeight: 1,
        }}>AI·SKILLS</div>
      </div>
      <div style={{ position: 'absolute', top: 540, left: 0, right: 0, textAlign: 'center',
        opacity: o, transform: `translateY(${(1-o) * 30}px)` }}>
        <div style={{
          fontFamily: DISPLAY, fontSize: 190, color: BRAND.paper,
          WebkitTextStroke: `4px ${BRAND.ink}`,
          letterSpacing: '-0.03em', lineHeight: 1,
        }}>ON CHAIN</div>
      </div>

      {/* Bullet list */}
      <div style={{
        position: 'absolute', bottom: 240, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 24,
        opacity: bulletsT,
      }}>
        {bullets.map((b, i) => {
          const p = clamp((t - 1.1 - i * 0.15) / 0.4, 0, 1);
          const e = Easing.easeOutBack(p);
          return (
            <div key={i} style={{
              background: BRAND.ink, color: BRAND.lime,
              border: `3px solid ${BRAND.lime}`, borderRadius: 12,
              padding: '14px 22px',
              fontFamily: MONO, fontSize: 18, fontWeight: 700,
              letterSpacing: '0.12em',
              boxShadow: `5px 5px 0 ${BRAND.ink}`,
              transform: `translateY(${(1-e) * 20}px) scale(${e})`,
              opacity: p,
            }}>{b}</div>
          );
        })}
      </div>

      {/* CTA */}
      {cta > 0 && (
        <>
          <div style={{
            position: 'absolute', right: 200, bottom: 100,
            transform: `scale(${Easing.easeOutBack(cta)}) rotate(${wobble}deg)`,
            opacity: cta,
          }}>
            <div style={{
              width: 220, height: 220, borderRadius: '50%',
              background: BRAND.lime,
              border: `4px solid ${BRAND.ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: DISPLAY, fontSize: 46, color: BRAND.ink,
              boxShadow: `8px 8px 0 ${BRAND.ink}`,
              position: 'relative',
            }}>
              <div style={{ transform: 'translate(2px, -4px)' }}>↗</div>
              <svg width="220" height="220" style={{
                position: 'absolute', inset: 0,
                animation: 'spin 10s linear infinite',
              }} viewBox="0 0 220 220">
                <defs>
                  <path id="circle" d="M 110,110 m -82,0 a 82,82 0 1,1 164,0 a 82,82 0 1,1 -164,0" />
                </defs>
                <text fill={BRAND.ink} fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="700" letterSpacing="6">
                  <textPath href="#circle">GET STARTED · GET STARTED · GET STARTED · </textPath>
                </text>
              </svg>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, {
  SceneHook, SceneLogo, SceneExplore, SceneExecute, SceneVerify, ScenePublish, SceneOutro,
  BRAND, DISPLAY, MONO, GridBG, Character, Coin,
});
