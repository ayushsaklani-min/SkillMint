// scenes-story.jsx
// Scenes 01-04: Problem, Brand, Skill Primitive, Way 1 (Agent Buys)

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 01 — THE PROBLEM
// "Every agent is making API calls. Trust nothing."
// ─────────────────────────────────────────────────────────────────────────────
function SceneHook() {
  const { localTime: t } = useSprite();

  // floating prompt boxes raining in
  const prompts = [
    { x: 220,  y: 220, text: '↳ TRADE BTC',          delay: 0.10, from: 'top'   },
    { x: 1500, y: 250, text: '↳ AUDIT CONTRACT',     delay: 0.25, from: 'top'   },
    { x: 280,  y: 640, text: '↳ SENTIMENT SIGNAL',   delay: 0.40, from: 'left'  },
    { x: 1480, y: 700, text: '↳ ROUTE LIQUIDITY',    delay: 0.55, from: 'right' },
    { x: 540,  y: 380, text: '↳ SCORE WALLET',       delay: 0.70, from: 'top'   },
    { x: 1380, y: 460, text: '↳ FORECAST FUNDING',   delay: 0.85, from: 'right' },
  ];

  const boxAppear = Easing.easeOutBack(clamp(t / 0.6, 0, 1));
  const fakeStamp = clamp((t - 2.0) / 0.5, 0, 1);
  const fakeBounce = Easing.easeOutBack(fakeStamp);
  const headlineT = clamp((t - 2.6) / 0.5, 0, 1);
  const lineT = clamp((t - 3.0) / 0.7, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={8} opacity={0.10}/>
      <NoiseDots t={t} count={26} seed={1}/>

      <div style={{
        position: 'absolute', top: 70, left: 0, right: 0,
        textAlign: 'center', opacity: clamp(t / 0.3, 0, 1),
      }}>
        <div style={{
          display: 'inline-block',
          background: BRAND.ink, color: BRAND.lime,
          padding: '12px 30px', borderRadius: 999,
          fontFamily: MONO, fontSize: 16, fontWeight: 700,
          letterSpacing: '0.3em',
          border: `2px solid ${BRAND.lime}`,
        }}>● THE AGENT TRUST PROBLEM</div>
      </div>

      {prompts.map((b, i) => {
        const p = clamp((t - b.delay) / 0.5, 0, 1);
        const e = Easing.easeOutBack(p);
        let dx = 0, dy = 0;
        if (b.from === 'top')   dy = -200 * (1 - e);
        if (b.from === 'left')  dx = -200 * (1 - e);
        if (b.from === 'right') dx =  200 * (1 - e);
        const float = Math.sin((t + i) * 1.3) * 5;
        return (
          <div key={i} style={{
            position: 'absolute', left: b.x, top: b.y,
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + float}px)) scale(${e})`,
            opacity: p,
            background: BRAND.paper, color: BRAND.ink,
            border: `3px solid ${BRAND.ink}`, borderRadius: 14,
            padding: '12px 22px',
            fontFamily: MONO, fontSize: 18, fontWeight: 700,
            boxShadow: `5px 5px 0 ${BRAND.ink}`,
            whiteSpace: 'nowrap', letterSpacing: '0.06em',
          }}>{b.text}</div>
        );
      })}

      {/* center: mystery output box */}
      <div style={{
        position: 'absolute', left: 960, top: 500,
        transform: `translate(-50%,-50%) scale(${boxAppear})`,
      }}>
        <div style={{
          width: 320, height: 320,
          background: BRAND.ink,
          border: `4px solid ${BRAND.paper}`, borderRadius: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `14px 14px 0 ${BRAND.ink}`,
          position: 'relative',
        }}>
          <div style={{
            fontFamily: HEAVY, fontSize: 220,
            color: BRAND.lime, lineHeight: 1,
            transform: `translateY(${Math.sin(t * 3) * 6}px) rotate(${Math.sin(t * 2) * 4}deg)`,
          }}>?</div>
          <div style={{ position: 'absolute', top: -28, left: 80, width: 6, height: 34, background: BRAND.lime, borderRadius: 3 }}></div>
          <div style={{ position: 'absolute', top: -28, right: 80, width: 6, height: 34, background: BRAND.lime, borderRadius: 3 }}></div>
          <div style={{ position: 'absolute', top: -44, left: 72, width: 22, height: 22, borderRadius: '50%', background: BRAND.lime, transform: `scale(${1 + Math.sin(t*4)*0.15})` }}></div>
          <div style={{ position: 'absolute', top: -44, right: 72, width: 22, height: 22, borderRadius: '50%', background: BRAND.lime, transform: `scale(${1 + Math.sin(t*4 + 1)*0.15})` }}></div>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 14, color: BRAND.paper,
          textAlign: 'center', marginTop: 16,
          letterSpacing: '0.22em', fontWeight: 600,
        }}>
          UNVERIFIED · SOURCE UNKNOWN · NO RECEIPT
        </div>

        {fakeStamp > 0 && (
          <div style={{
            position: 'absolute', top: -10, right: -110,
            transform: `rotate(14deg) scale(${fakeBounce})`,
            background: BRAND.red, color: BRAND.paper,
            border: `4px solid ${BRAND.ink}`, borderRadius: 10,
            padding: '12px 22px',
            fontFamily: HEAVY, fontSize: 34,
            boxShadow: `4px 4px 0 ${BRAND.ink}`,
            letterSpacing: '0.04em',
          }}>TRUST ME?</div>
        )}
      </div>

      {/* bottom narrative */}
      <div style={{
        position: 'absolute', bottom: 70, left: 0, right: 0,
        textAlign: 'center', opacity: headlineT,
        transform: `translateY(${(1-headlineT) * 20}px)`,
      }}>
        <div style={{
          fontFamily: HEAVY, fontSize: 72, color: BRAND.paper,
          letterSpacing: '-0.025em', WebkitTextStroke: `2px ${BRAND.ink}`,
          lineHeight: 1.0,
        }}>YOUR AGENT IS MAKING CALLS.</div>
        <div style={{
          fontFamily: HEAVY, fontSize: 72, color: BRAND.lime,
          letterSpacing: '-0.025em', WebkitTextStroke: `2px ${BRAND.ink}`,
          lineHeight: 1.0, marginTop: 8,
          opacity: lineT, transform: `translateY(${(1-lineT) * 20}px)`,
        }}>CAN YOU PROVE IT WAS RIGHT?</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 02 — ENTER SKILLMINT
// ─────────────────────────────────────────────────────────────────────────────
function SceneLogo() {
  const { localTime: t } = useSprite();
  const whiteout = clamp(t / 0.25, 0, 1);
  const skillT = Easing.easeOutBack(clamp((t - 0.3) / 0.5, 0, 1));
  const mintT  = Easing.easeOutBack(clamp((t - 0.6) / 0.5, 0, 1));
  const shock  = clamp((t - 0.95) / 0.4, 0, 1);
  const tag1   = clamp((t - 1.4) / 0.5, 0, 1);
  const tag2   = clamp((t - 1.9) / 0.5, 0, 1);
  const tag3   = clamp((t - 2.4) / 0.5, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={-6} opacity={0.10}/>

      <div style={{
        position: 'absolute', inset: 0,
        background: BRAND.paper,
        opacity: whiteout * (1 - whiteout) * 4,
      }}></div>

      {shock > 0 && (
        <div style={{
          position: 'absolute', left: 960, top: 440,
          transform: `translate(-50%,-50%) scale(${shock * 3})`,
          width: 320, height: 320, borderRadius: '50%',
          border: `6px solid ${BRAND.lime}`,
          opacity: 1 - shock,
        }}></div>
      )}

      <div style={{
        position: 'absolute', left: 960, top: 360,
        transform: `translate(-50%, -50%) scale(${skillT}) rotate(${(1-skillT) * -15}deg)`,
        opacity: skillT,
        width: 440, height: 440,
        filter: `drop-shadow(12px 12px 0 ${BRAND.ink})`,
      }}>
        <img src="/logo.png.png" alt="SkillMint" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
      </div>

      <div style={{
        position: 'absolute', left: 960, top: 660,
        transform: `translate(-50%, 0) scale(${mintT})`,
        opacity: mintT,
        fontFamily: HEAVY, fontSize: 150, fontWeight: 900,
        letterSpacing: '-0.025em', lineHeight: 1,
        whiteSpace: 'nowrap',
        textShadow: `8px 8px 0 ${BRAND.ink}`,
      }}>
        <span style={{ color: BRAND.paper }}>SKILL</span>
        <span style={{ color: BRAND.lime }}>MINT</span>
      </div>

      <div style={{
        position: 'absolute', bottom: 130, left: 0, right: 0,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 22, color: BRAND.paper,
          letterSpacing: '0.3em', opacity: tag1, fontWeight: 600,
        }}>
          AGENT COMMERCE FOR
        </div>
        <div style={{ fontFamily: HEAVY, fontSize: 110, letterSpacing: '-0.025em', lineHeight: 1.0, marginTop: 14 }}>
          <span style={{
            display: 'inline-block', padding: '0 14px',
            color: BRAND.lime, WebkitTextStroke: `3px ${BRAND.ink}`,
            opacity: tag1, transform: `translateY(${(1-tag1) * 20}px)`,
          }}>VERIFIED</span>
          <span style={{
            display: 'inline-block', padding: '0 14px',
            color: BRAND.paper, WebkitTextStroke: `3px ${BRAND.ink}`,
            opacity: tag2, transform: `translateY(${(1-tag2) * 20}px)`,
          }}>SKILLS.</span>
          <span style={{
            display: 'inline-block', padding: '0 14px',
            color: BRAND.paper, WebkitTextStroke: `3px ${BRAND.ink}`,
            opacity: tag3, transform: `translateY(${(1-tag3) * 20}px)`,
          }}>ON-CHAIN.</span>
        </div>
      </div>

      {/* orbiting sparks */}
      {[0,1,2,3,4,5,6,7].map(i => {
        const a = (i / 8) * Math.PI * 2 + t * 0.6;
        const r = 320;
        const x = 960 + Math.cos(a) * r;
        const y = 460 + Math.sin(a) * r;
        return <div key={i} style={{
          position: 'absolute', left: x, top: y,
          width: 14, height: 14, borderRadius: '50%',
          background: BRAND.lime, border: `2px solid ${BRAND.ink}`,
          transform: 'translate(-50%,-50%)',
          opacity: clamp((t - 0.6) / 0.4, 0, 1),
        }}></div>;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 03 — THE PRIMITIVE
// "A skill is an ENCRYPTED PROMPT, locked in a TEE, sold as an NFT."
// Three pieces snap into place around a center NFT card.
// ─────────────────────────────────────────────────────────────────────────────
function ScenePrimitive() {
  const { localTime: t, duration } = useSprite();

  // Beats are front-loaded into the first ~half of the scene so the second
  // half is a "hold" — content stays on screen even at fast pacing.
  const promptT  = clamp((t - 0.3) / 0.5, 0, 1);
  const lockT    = clamp((t - 0.8) / 0.4, 0, 1);
  const cardT    = clamp((t - 1.2) / 0.5, 0, 1);
  const cardE    = Easing.easeOutBack(cardT);
  const teeT     = clamp((t - 1.5) / 0.5, 0, 1);
  const teeE     = Easing.easeOutBack(teeT);
  const priceT   = clamp((t - 2.0) / 0.5, 0, 1);
  const priceE   = Easing.easeOutBack(priceT);
  const equalsT  = clamp((t - 2.5) / 0.4, 0, 1);
  const bracesT  = clamp((t - 2.9) / 0.5, 0, 1);

  // Exit fade — last 0.4s of the scene
  const exitT = clamp((duration - t) / 0.4, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue, opacity: exitT }}>
      <GridBG t={t} drift={4} opacity={0.10}/>

      <StepHeader num={1} total={5} kicker="WHAT IS A SKILL?"
        title="THE PRIMITIVE."
        sub="A skill = a system prompt sealed in a TEE, paired with a price, minted as a tradeable ERC-721. Buyers run it. Only the enclave sees the prompt."
        t={t}/>

      {/* THE EQUATION: prompt + lock + price = NFT */}
      <div style={{ position: 'absolute', top: 600, left: 0, right: 0, display: 'flex',
        justifyContent: 'center', alignItems: 'center', gap: 40, height: 280 }}>

        {/* Prompt card */}
        <div style={{
          width: 280, height: 240,
          background: '#0A0F2E', border: `4px solid ${BRAND.ink}`, borderRadius: 14,
          boxShadow: `6px 6px 0 ${BRAND.ink}`, padding: 14,
          opacity: promptT, transform: `translateY(${(1-promptT) * 30}px) scale(${promptT})`,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: BRAND.lime, letterSpacing: '0.22em', fontWeight: 700 }}>
            ENCRYPTED PROMPT
          </div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: BRAND.paper, marginTop: 10, lineHeight: 1.5, opacity: 0.92 }}>
            <span style={{ color: '#7C9CFF' }}>const</span> sys = <span style={{ color: BRAND.lime }}>"You are a</span><br/>
            <span style={{ color: BRAND.lime }}>{'  '}swing-trading agent.</span><br/>
            <span style={{ color: BRAND.lime }}>{'  '}Given candles, output</span><br/>
            <span style={{ color: BRAND.lime }}>{'  '}BUY/SELL/HOLD..."</span>
          </div>
          <div style={{
            position: 'absolute', bottom: 10, left: 14,
            fontFamily: MONO, fontSize: 10, color: BRAND.lime, opacity: 0.7, letterSpacing: '0.18em',
          }}>🔒 SEALED ON 0G STORAGE</div>
        </div>

        {/* + */}
        <div style={{
          fontFamily: HEAVY, fontSize: 80, color: BRAND.lime,
          WebkitTextStroke: `3px ${BRAND.ink}`, opacity: lockT,
        }}>+</div>

        {/* TEE */}
        <div style={{
          opacity: teeT, transform: `scale(${teeE})`,
        }}>
          <div style={{
            width: 220, height: 240,
            background: BRAND.ink, border: `5px solid ${BRAND.lime}`, borderRadius: 14,
            boxShadow: `0 0 0 4px ${BRAND.ink}, 8px 8px 0 ${BRAND.ink}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden', padding: 12,
          }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute', left: 0, right: 0,
                top: ((t * 80 + i * 30) % 240),
                height: 1, background: `${BRAND.lime}44`,
              }}></div>
            ))}
            <div style={{ fontSize: 90, transform: `scale(${1 + Math.sin(t*3)*0.05})` }}>🛡</div>
            <div style={{ fontFamily: HEAVY, fontSize: 38, color: BRAND.lime, marginTop: -6 }}>
              TEE
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 11, color: BRAND.paper,
              letterSpacing: '0.22em', marginTop: 2, fontWeight: 700,
            }}>0G COMPUTE</div>
          </div>
        </div>

        {/* + */}
        <div style={{
          fontFamily: HEAVY, fontSize: 80, color: BRAND.lime,
          WebkitTextStroke: `3px ${BRAND.ink}`, opacity: priceT,
        }}>+</div>

        {/* Price tag */}
        <div style={{
          opacity: priceT, transform: `scale(${priceE})`,
        }}>
          <div style={{
            width: 220, height: 240,
            background: BRAND.paper, border: `4px solid ${BRAND.ink}`, borderRadius: 14,
            boxShadow: `6px 6px 0 ${BRAND.ink}`, padding: 14,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.22em', fontWeight: 700 }}>
              PRICE PER RUN
            </div>
            <div>
              <div style={{ fontFamily: HEAVY, fontSize: 56, color: BRAND.ink, lineHeight: 1 }}>$0.01</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: BRAND.ink, opacity: 0.7, marginTop: 4 }}>
                USDC.E · gasless
              </div>
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 11, color: BRAND.ink,
              background: BRAND.lime, padding: '4px 8px', borderRadius: 6,
              border: `2px solid ${BRAND.ink}`, letterSpacing: '0.18em',
              fontWeight: 700, display: 'inline-block', alignSelf: 'flex-start',
            }}>OR 0.005 0G</div>
          </div>
        </div>

        {/* = */}
        <div style={{
          fontFamily: HEAVY, fontSize: 100, color: BRAND.lime,
          WebkitTextStroke: `3px ${BRAND.ink}`, opacity: equalsT,
          transform: `scale(${Easing.easeOutBack(equalsT)})`,
        }}>=</div>

        {/* NFT card */}
        <div style={{
          opacity: bracesT, transform: `scale(${Easing.easeOutBack(bracesT)})`,
          width: 240, height: 280, position: 'relative',
        }}>
          <div style={{
            width: '100%', height: '100%',
            background: BRAND.paper, border: `5px solid ${BRAND.ink}`,
            borderRadius: 14, boxShadow: `8px 8px 0 ${BRAND.ink}`,
            padding: 12, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              flex: 1,
              background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.lime})`,
              border: `3px solid ${BRAND.ink}`, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(45deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 12px)',
              }}></div>
              <div style={{
                fontFamily: HEAVY, fontSize: 80, color: BRAND.paper,
                WebkitTextStroke: `3px ${BRAND.ink}`,
                transform: `rotate(${Math.sin(t * 1.4) * 5}deg)`, zIndex: 1,
              }}>⚡</div>
              <div style={{
                position: 'absolute', top: 6, right: 6,
                fontFamily: MONO, fontSize: 9, color: BRAND.lime, background: BRAND.ink,
                padding: '3px 8px', borderRadius: 999, letterSpacing: '0.18em', fontWeight: 700,
              }}>#0007</div>
            </div>
            <div style={{ fontFamily: HEAVY, fontSize: 16, color: BRAND.ink, marginTop: 8, letterSpacing: '-0.01em' }}>
              SWING TRADER v2
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BRAND.ink, opacity: 0.55, marginTop: 2 }}>
              ERC-721 · TRADEABLE
            </div>
          </div>
          {bracesT > 0.6 && (
            <div style={{
              position: 'absolute', top: -22, left: -28,
              transform: `rotate(-12deg) scale(${Easing.easeOutBack(clamp((bracesT - 0.6)/0.4, 0, 1))})`,
              background: BRAND.lime, color: BRAND.ink,
              border: `4px solid ${BRAND.ink}`, borderRadius: 8,
              padding: '8px 14px',
              fontFamily: HEAVY, fontSize: 22,
              boxShadow: `4px 4px 0 ${BRAND.ink}`,
              letterSpacing: '0.05em',
            }}>SKILL #</div>
          )}
        </div>
      </div>

      <Caption t={t} start={3.4} end={duration - 0.2} y={920}>
        🔐 PROMPT NEVER LEAVES THE ENCLAVE — RECEIPTS ANCHOR ON-CHAIN
      </Caption>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 04 — WAY 1: AGENT BUYS
// "Your trading agent needs intelligence. It calls SkillMint."
// ─────────────────────────────────────────────────────────────────────────────
function SceneAgentBuys() {
  const { localTime: t } = useSprite();

  const codeLines = [
    { text: 'import { SkillMintClient } from "@skillmint/sdk";', color: '#A0B8FF' },
    { text: '' },
    { text: 'const client = new SkillMintClient({', color: BRAND.paper },
    { text: 'privateKey: AGENT_KEY,    // wallet = auth', color: '#FFC76A', indent: 1 },
    { text: 'network: "mainnet",', color: '#FFC76A', indent: 1 },
    { text: '});', color: BRAND.paper },
    { text: '' },
    { text: '// ETH drops 5% — agent needs a signal', color: '#7FE787' },
    { text: 'const r = await client.executeX402(', color: BRAND.paper },
    { text: '7, "BTC sentiment + whale flows?"', color: BRAND.lime, indent: 1 },
    { text: ');', color: BRAND.paper },
    { text: '' },
    { text: '// → output, receiptRootHash, settlement', color: '#7FE787' },
    { text: 'if (r.output.includes("Bullish")) buy();', color: BRAND.paper },
    { text: 'else wait();', color: BRAND.paper },
  ];

  // typing progress: 0 → 1 over t = 0.4 → 3.2
  const typeProgress = clamp((t - 0.4) / 2.8, 0, 1);

  // packet flight: 3.4 → 4.4
  const packetT = clamp((t - 3.4) / 1.0, 0, 1);
  const packetE = Easing.easeInOutCubic(packetT);

  // response: 4.6 → 5.4
  const respT = clamp((t - 4.6) / 0.8, 0, 1);
  const respE = Easing.easeOutBack(respT);

  // receipt: 5.6 → 6.4
  const receiptT = clamp((t - 5.6) / 0.8, 0, 1);

  // agent decision: 6.6 → 7.0
  const decideT = clamp((t - 6.6) / 0.5, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={3} opacity={0.10}/>

      <StepHeader num={2} total={5} kicker="WAY 1 — AGENT IS THE BUYER"
        title="AGENT BUYS A SKILL."
        sub="Wallet IS the auth — no API keys. Pay-per-call in USDC.E via x402, gasless. The agent gets a verified output AND a receipt root it can defend in audit."
        t={t}/>

      {/* CODE BLOCK */}
      <CodeBlock
        x={80} y={560} width={780}
        title="trading-agent.ts"
        lines={codeLines}
        progress={typeProgress}
        t={t}
      />

      {/* Trading agent badge (right) */}
      <div style={{
        opacity: clamp((t - 0.2) / 0.4, 0, 1),
        transform: `scale(${Easing.easeOutBack(clamp((t - 0.2) / 0.4, 0, 1))})`,
      }}>
        <AgentBadge x={1380} y={620} label="TRADING AGENT" t={t} shape="hex" color={BRAND.lime}/>
      </div>

      {/* SkillMint hub icon further right */}
      <div style={{
        position: 'absolute', left: 1720, top: 620,
        transform: 'translate(-50%, -50%)',
        opacity: clamp((t - 0.2) / 0.4, 0, 1),
      }}>
        <div style={{
          width: 130, height: 130, borderRadius: 24,
          background: BRAND.ink, border: `5px solid ${BRAND.lime}`,
          boxShadow: `6px 6px 0 ${BRAND.ink}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 56 }}>⚡</div>
          <div style={{
            fontFamily: MONO, fontSize: 9, color: BRAND.lime,
            letterSpacing: '0.22em', fontWeight: 700,
          }}>SKILL #7</div>
        </div>
      </div>

      {/* Packet flying from agent → skill */}
      {packetT > 0 && packetT < 1 && (
        <div style={{
          position: 'absolute',
          left: 1380 + (1720 - 1380) * packetE,
          top: 620 - Math.sin(packetT * Math.PI) * 40,
          transform: 'translate(-50%, -50%)',
        }}>
          <div style={{
            background: BRAND.paper, border: `3px solid ${BRAND.ink}`,
            borderRadius: 10, padding: '8px 14px',
            fontFamily: MONO, fontSize: 13, color: BRAND.ink,
            fontWeight: 700, letterSpacing: '0.1em',
            boxShadow: `3px 3px 0 ${BRAND.ink}`, whiteSpace: 'nowrap',
          }}>
            $0.01 USDC.E
          </div>
        </div>
      )}

      {/* Response card (slides in from right) */}
      {respT > 0 && (
        <div style={{
          position: 'absolute', right: 80, top: 220,
          transform: `translateX(${(1-respE) * 200}px) scale(${respE})`,
          opacity: respT,
        }}>
          <div style={{
            width: 540,
            background: BRAND.paper, border: `4px solid ${BRAND.ink}`, borderRadius: 16,
            boxShadow: `8px 8px 0 ${BRAND.ink}`, padding: 18,
          }}>
            <div style={{
              fontFamily: MONO, fontSize: 11, color: BRAND.ink, opacity: 0.55,
              letterSpacing: '0.22em', fontWeight: 700,
            }}>↩ RESPONSE — VERIFIED OUTPUT</div>
            <div style={{
              fontFamily: HEAVY, fontSize: 30, color: BRAND.ink, marginTop: 6, lineHeight: 1.15,
            }}>
              "BEARISH — whale outflows +30%,<br/>
              ETF outflows. WAIT."
            </div>
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: `2px dashed ${BRAND.ink}`,
              display: 'flex', justifyContent: 'space-between', gap: 12,
              fontFamily: MONO, fontSize: 13, color: BRAND.ink,
            }}>
              <div>
                <div style={{ opacity: 0.55, fontSize: 10, letterSpacing: '0.22em', fontWeight: 700 }}>RECEIPT ROOT</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>0xabc…ef02</div>
              </div>
              <div>
                <div style={{ opacity: 0.55, fontSize: 10, letterSpacing: '0.22em', fontWeight: 700 }}>SETTLED IN</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>320 ms</div>
              </div>
              <div>
                <div style={{ opacity: 0.55, fontSize: 10, letterSpacing: '0.22em', fontWeight: 700 }}>FEE</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>$0.01</div>
              </div>
            </div>
          </div>

          {/* receipt chip below */}
          {receiptT > 0 && (
            <div style={{
              marginTop: 16, opacity: receiptT,
              transform: `translateY(${(1-receiptT) * 16}px)`,
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 12,
                background: BRAND.ink, color: BRAND.paper,
                border: `4px solid ${BRAND.lime}`, borderRadius: 999,
                padding: '12px 24px',
                fontFamily: MONO, fontSize: 14, fontWeight: 700,
                letterSpacing: '0.16em',
                boxShadow: `5px 5px 0 ${BRAND.ink}`,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: BRAND.lime,
                  transform: `scale(${1 + Math.sin(t * 5) * 0.25})`,
                }}></div>
                ANCHORED ON 0G — AUDITABLE FOREVER
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decision callout on the code */}
      {decideT > 0 && (
        <div style={{
          position: 'absolute', left: 320, top: 950,
          transform: `translate(-50%, -50%) rotate(-3deg) scale(${Easing.easeOutBack(decideT)})`,
          background: BRAND.lime, color: BRAND.ink,
          border: `4px solid ${BRAND.ink}`, borderRadius: 12,
          padding: '10px 22px',
          fontFamily: HEAVY, fontSize: 28,
          boxShadow: `5px 5px 0 ${BRAND.ink}`,
          letterSpacing: '0.04em',
        }}>
          → DEFENSIBLE CALL
        </div>
      )}

      <Caption t={t} start={7.2} end={9.0} y={970}>
        💳 NO API KEYS · WALLET-NATIVE · PAY-PER-CALL · RECEIPTS ON-CHAIN
      </Caption>
    </div>
  );
}

Object.assign(window, {
  SceneHook, SceneLogo, ScenePrimitive, SceneAgentBuys,
});
