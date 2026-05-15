// scenes-flow.jsx
// Scenes 05-07: Way 2 (Agent Sells), The Loop, Outro

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 05 — WAY 2: AGENT IS A SKILL
// "Mint your strategy. Other agents pay. You earn 90%."
// ─────────────────────────────────────────────────────────────────────────────
function SceneAgentSells() {
  const { localTime: t } = useSprite();

  const codeLines = [
    { text: '// Mint your strategy as a sellable skill', color: '#7FE787' },
    { text: 'const { skillId } = await client.registerSkill({', color: BRAND.paper },
    { text: 'name: "Swing Trader v2",', color: BRAND.lime, indent: 1 },
    { text: 'systemPrompt: SECRET_STRATEGY,', color: '#FFC76A', indent: 1 },
    { text: 'computeProvider: PROVIDER_ADDR,', color: '#A0B8FF', indent: 1 },
    { text: 'model: "deepseek-chat-v3",', color: '#A0B8FF', indent: 1 },
    { text: 'price:     "0.005",  // 0G', color: BRAND.lime, indent: 1 },
    { text: 'priceUSDC: "10000",  // $0.01', color: BRAND.lime, indent: 1 },
    { text: '});', color: BRAND.paper },
    { text: '' },
    { text: '// → ERC-721 minted. Prompt encrypted.', color: '#7FE787' },
    { text: '// → Owner earns 90% of every run.', color: '#7FE787' },
  ];

  const typeProgress = clamp((t - 0.4) / 2.4, 0, 1);
  const mintT   = clamp((t - 2.9) / 0.4, 0, 1);
  const cardT   = clamp((t - 3.2) / 0.6, 0, 1);
  const cardE   = Easing.easeOutBack(cardT);
  const stampT  = clamp((t - 3.8) / 0.5, 0, 1);
  const stampE  = Easing.easeOutBack(stampT);
  const earnT   = clamp((t - 4.3) / 0.5, 0, 1);
  const buyersT = clamp((t - 5.0) / 0.5, 0, 1);
  const tradeT  = clamp((t - 5.8) / 0.5, 0, 1);

  // Continuously running counter once revenue starts
  const revenue = earnT > 0 ? 0 + (1 + (t - 4.3) * 1.7) : 0;
  const runs    = earnT > 0 ? Math.floor(20 + (t - 4.3) * 13) : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={5} opacity={0.10}/>

      <StepHeader num={3} total={5} kicker="WAY 2 — AGENT IS THE PRODUCT"
        title="MINT. ENCRYPT. EARN."
        sub="Wrap your strategy as a skill. The prompt stays encrypted in the TEE — buyers run it but never see it. Every execution streams 90% to the NFT holder."
        t={t} color={BRAND.lime}/>

      <CodeBlock
        x={80} y={560} width={780}
        title="publish-strategy.ts"
        lines={codeLines}
        progress={typeProgress}
        t={t}
      />

      {/* MINT button press indicator */}
      {mintT > 0 && mintT < 1 && (
        <div style={{
          position: 'absolute', left: 470, top: 940,
          transform: `translate(-50%, -50%) scale(${Easing.easeOutBack(mintT)})`,
          background: BRAND.lime, color: BRAND.ink,
          border: `4px solid ${BRAND.ink}`, borderRadius: 999,
          padding: '14px 32px',
          fontFamily: HEAVY, fontSize: 26,
          boxShadow: t > 3.0 && t < 3.2 ? `0 0 0 ${BRAND.ink}` : `5px 5px 0 ${BRAND.ink}`,
          letterSpacing: '0.04em',
          opacity: 1 - clamp((t - 3.2)/0.3, 0, 1),
        }}>
          ⚡ MINT SKILL
        </div>
      )}

      {/* NFT CARD (right side) */}
      {cardT > 0 && (
        <div style={{
          position: 'absolute', left: 1330, top: 620,
          transform: `translate(-50%, -50%) scale(${cardE}) rotate(${(1-cardE) * -8}deg)`,
          opacity: cardT,
        }}>
          <div style={{
            width: 380, height: 460,
            background: BRAND.paper, border: `5px solid ${BRAND.ink}`,
            borderRadius: 22, padding: 18,
            boxShadow: `10px 10px 0 ${BRAND.ink}`,
            position: 'relative',
          }}>
            <div style={{
              width: '100%', height: 200,
              background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.lime})`,
              border: `3px solid ${BRAND.ink}`, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(45deg, transparent 0 12px, rgba(0,0,0,0.08) 12px 14px)',
              }}></div>
              <div style={{
                fontFamily: HEAVY, fontSize: 120, color: BRAND.paper,
                WebkitTextStroke: `3px ${BRAND.ink}`,
                transform: `rotate(${Math.sin(t * 1.2) * 5}deg)`, zIndex: 1,
              }}>📈</div>
              <div style={{
                position: 'absolute', top: 10, right: 10,
                fontFamily: MONO, fontSize: 11, color: BRAND.lime, background: BRAND.ink,
                padding: '4px 10px', borderRadius: 999, letterSpacing: '0.18em', fontWeight: 700,
              }}>#0042</div>
              <div style={{
                position: 'absolute', top: 10, left: 10,
                fontFamily: MONO, fontSize: 11, color: BRAND.ink, background: BRAND.lime,
                padding: '4px 10px', borderRadius: 999, letterSpacing: '0.18em', fontWeight: 700,
                border: `2px solid ${BRAND.ink}`,
              }}>ERC-721</div>
            </div>

            <div style={{ fontFamily: HEAVY, fontSize: 30, color: BRAND.ink, marginTop: 12, lineHeight: 1, letterSpacing: '-0.01em' }}>
              SWING TRADER v2
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.55, marginTop: 4, letterSpacing: '0.16em' }}>
              OWNER · 0x06…5611 · ENCRYPTED PROMPT
            </div>

            <div style={{
              marginTop: 14, paddingTop: 12,
              borderTop: `2px dashed ${BRAND.ink}`,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.22em', fontWeight: 700 }}>RUNS</div>
                <div style={{ fontFamily: HEAVY, fontSize: 26, color: BRAND.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {runs.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: BRAND.ink, opacity: 0.5, letterSpacing: '0.22em', fontWeight: 700 }}>EARNED · 90%</div>
                <div style={{ fontFamily: HEAVY, fontSize: 26, color: BRAND.ink, fontVariantNumeric: 'tabular-nums' }}>
                  ${revenue.toFixed(2)}
                </div>
              </div>
            </div>

            {stampT > 0 && (
              <div style={{
                position: 'absolute', top: -28, left: -34,
                transform: `rotate(-14deg) scale(${stampE})`,
                background: BRAND.lime, color: BRAND.ink,
                border: `4px solid ${BRAND.ink}`, borderRadius: 10,
                padding: '10px 22px',
                fontFamily: HEAVY, fontSize: 30,
                boxShadow: `4px 4px 0 ${BRAND.ink}`,
                letterSpacing: '0.04em',
              }}>MINTED!</div>
            )}
          </div>
        </div>
      )}

      {/* Buyer agents arriving from below */}
      {buyersT > 0 && [
        { x: 1180, y: 990, shape: 'tri',   label: 'AGENT β', color: '#F59E0B', delay: 0.0 },
        { x: 1330, y: 990, shape: 'plus',  label: 'AGENT γ', color: '#22D3EE', delay: 0.2 },
        { x: 1480, y: 990, shape: 'orbit', label: 'AGENT δ', color: '#E879F9', delay: 0.4 },
      ].map((a, i) => {
        const aT = clamp((t - 5.0 - a.delay) / 0.4, 0, 1);
        const aE = Easing.easeOutBack(aT);
        return (
          <div key={i} style={{
            position: 'absolute', left: a.x, top: a.y,
            transform: `translate(-50%, -50%) scale(${aE * 0.55}) translateY(${(1-aE) * 40}px)`,
            opacity: aT,
          }}>
            <AgentBadge x={0} y={0} label={a.label} color={a.color} shape={a.shape} t={t} scale={1}/>
          </div>
        );
      })}

      {/* Revenue coins flying back from buyers to NFT card */}
      {earnT > 0 && Array.from({ length: 6 }).map((_, i) => {
        const loopDur = 1.6;
        const lt = (((t - 4.3) + i * 0.27) % loopDur) / loopDur;
        if (lt < 0) return null;
        const e = lt;
        const x = 1320 + (1330 - 1320) * e;
        const y = 990 + (620 - 990) * e - Math.sin(e * Math.PI) * 140;
        return <Coin key={i} x={x} y={y} rot={e * 540} size={36} label="$"/>;
      })}

      {/* Lifetime revenue counter */}
      {earnT > 0 && (
        <div style={{
          position: 'absolute', right: 1660, top: 320,
          transform: 'translate(-50%, -50%)',
          opacity: earnT,
        }}>
          <div style={{
            background: BRAND.ink, color: BRAND.lime,
            border: `4px solid ${BRAND.lime}`, borderRadius: 20,
            padding: '20px 26px',
            fontFamily: MONO, fontSize: 14,
            letterSpacing: '0.18em', fontWeight: 700,
            boxShadow: `6px 6px 0 ${BRAND.ink}`,
            minWidth: 260, textAlign: 'left',
          }}>
            <div style={{ opacity: 0.7, fontSize: 11, letterSpacing: '0.28em' }}>LIFETIME REVENUE</div>
            <div style={{ fontFamily: HEAVY, fontSize: 56, color: BRAND.lime, marginTop: 4, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              ${revenue.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, letterSpacing: '0.28em', marginTop: 4 }}>USDC.E · STREAMING</div>

            {tradeT > 0 && (
              <div style={{
                marginTop: 14, paddingTop: 12,
                borderTop: `2px dashed ${BRAND.lime}66`,
                opacity: tradeT,
                fontSize: 12, color: BRAND.paper, letterSpacing: '0.18em',
                lineHeight: 1.5,
              }}>
                ⇅ TRANSFER THE NFT<br/>
                <span style={{ color: BRAND.lime }}>↳ THE REVENUE FOLLOWS</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Caption t={t} start={6.4} end={8.4} y={970}>
        🪙 SKILL = TRADEABLE REVENUE STREAM · 90% TO OWNER · 10% PROTOCOL
      </Caption>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 06 — THE LOOP
// "The same agent does both. Pure crypto-native commerce."
// Diagram: TRADING AGENT in middle ↔ left (buys signals) + right (other
// agents pay to run me).
// ─────────────────────────────────────────────────────────────────────────────
function SceneLoop() {
  const { localTime: t } = useSprite();

  const centerT = clamp((t - 0.3) / 0.6, 0, 1);
  const centerE = Easing.easeOutBack(centerT);
  const leftT   = clamp((t - 1.0) / 0.5, 0, 1);
  const leftE   = Easing.easeOutBack(leftT);
  const rightT  = clamp((t - 1.6) / 0.5, 0, 1);
  const rightE  = Easing.easeOutBack(rightT);

  const arrowLeftT  = clamp((t - 2.2) / 0.6, 0, 1);
  const arrowRightT = clamp((t - 2.8) / 0.6, 0, 1);

  const insightFlowT = clamp((t - 3.4) / 1.2, 0, 1);
  const earningFlowT = clamp((t - 4.0) / 1.5, 0, 1);

  const bigT = clamp((t - 5.4) / 0.5, 0, 1);

  // Positions
  const center = { x: 960,  y: 540 };
  const leftP  = { x: 380,  y: 540 };
  const rightP = { x: 1540, y: 540 };

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={2} opacity={0.10}/>

      <StepHeader num={4} total={5} kicker="THE COMBINED PICTURE"
        title="THE LOOP."
        sub="Your agent consumes verified intelligence on one side and IS the verified intelligence on the other. Pure crypto-native agent commerce."
        t={t} color={BRAND.lime}/>

      {/* CENTER — Your trading agent (TEE shell) */}
      <div style={{
        position: 'absolute', left: center.x, top: center.y,
        transform: `translate(-50%, -50%) scale(${centerE})`,
        opacity: centerT, zIndex: 10,
      }}>
        <div style={{
          width: 340, height: 340,
          background: BRAND.ink, border: `6px solid ${BRAND.lime}`,
          borderRadius: 32, boxShadow: `0 0 0 5px ${BRAND.ink}, 12px 12px 0 ${BRAND.ink}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: 20, position: 'relative', overflow: 'hidden',
        }}>
          {/* scanlines */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0,
              top: ((t * 60 + i * 32) % 340),
              height: 1, background: `${BRAND.lime}33`,
            }}></div>
          ))}
          <div style={{
            width: 130, height: 130, borderRadius: 24,
            background: BRAND.paper, border: `4px solid ${BRAND.lime}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: `rotate(${Math.sin(t*1.4) * 6}deg)` }}>
              <g fill={BRAND.blue} stroke={BRAND.ink} strokeWidth="4" strokeLinejoin="round">
                <polygon points="50,8 86,30 86,70 50,92 14,70 14,30"/>
                <circle cx="50" cy="50" r="14" fill={BRAND.ink}/>
                <circle cx="50" cy="50" r="6" fill={BRAND.lime}/>
              </g>
            </svg>
          </div>
          <div style={{
            fontFamily: HEAVY, fontSize: 30, color: BRAND.lime,
            letterSpacing: '-0.01em',
          }}>YOUR AGENT</div>
          <div style={{
            fontFamily: MONO, fontSize: 12, color: BRAND.paper,
            letterSpacing: '0.22em', fontWeight: 700, opacity: 0.85,
          }}>WALLET-NATIVE · IN A TEE</div>
        </div>
      </div>

      {/* LEFT — Consumed skill (CryptoSentiment) */}
      <div style={{
        position: 'absolute', left: leftP.x, top: leftP.y,
        transform: `translate(-50%, -50%) scale(${leftE}) rotate(${(1-leftE) * -8}deg)`,
        opacity: leftT,
      }}>
        <div style={{
          width: 280, height: 320,
          background: BRAND.paper, border: `5px solid ${BRAND.ink}`,
          borderRadius: 20, padding: 16,
          boxShadow: `8px 8px 0 ${BRAND.ink}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{
            flex: 1,
            background: `linear-gradient(135deg, ${BRAND.blueDeep}, ${BRAND.blue})`,
            border: `3px solid ${BRAND.ink}`, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(45deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 12px)',
            }}></div>
            <div style={{
              fontFamily: HEAVY, fontSize: 70, color: BRAND.lime,
              WebkitTextStroke: `2px ${BRAND.ink}`, zIndex: 1,
            }}>📡</div>
            <div style={{
              position: 'absolute', top: 8, right: 8,
              fontFamily: MONO, fontSize: 10, color: BRAND.lime, background: BRAND.ink,
              padding: '3px 8px', borderRadius: 999, letterSpacing: '0.16em', fontWeight: 700,
            }}>#7</div>
          </div>
          <div style={{ fontFamily: HEAVY, fontSize: 22, color: BRAND.ink, letterSpacing: '-0.01em' }}>
            SENTIMENT FEED
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.6 }}>
            BY · 0xA3…F41C
          </div>
        </div>
        <div style={{
          marginTop: 12,
          fontFamily: MONO, fontSize: 13, color: BRAND.lime,
          letterSpacing: '0.22em', fontWeight: 700, textAlign: 'center',
          background: BRAND.ink, padding: '8px 14px', borderRadius: 999,
          border: `2px solid ${BRAND.lime}`,
        }}>YOU BUY · $0.01/CALL</div>
      </div>

      {/* RIGHT — Your minted skill */}
      <div style={{
        position: 'absolute', left: rightP.x, top: rightP.y,
        transform: `translate(-50%, -50%) scale(${rightE}) rotate(${(1-rightE) * 8}deg)`,
        opacity: rightT,
      }}>
        <div style={{
          width: 280, height: 320,
          background: BRAND.paper, border: `5px solid ${BRAND.ink}`,
          borderRadius: 20, padding: 16,
          boxShadow: `8px 8px 0 ${BRAND.ink}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{
            flex: 1,
            background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.lime})`,
            border: `3px solid ${BRAND.ink}`, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(45deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 12px)',
            }}></div>
            <div style={{
              fontFamily: HEAVY, fontSize: 70, color: BRAND.paper,
              WebkitTextStroke: `2px ${BRAND.ink}`, zIndex: 1,
            }}>📈</div>
            <div style={{
              position: 'absolute', top: 8, right: 8,
              fontFamily: MONO, fontSize: 10, color: BRAND.lime, background: BRAND.ink,
              padding: '3px 8px', borderRadius: 999, letterSpacing: '0.16em', fontWeight: 700,
            }}>#42</div>
          </div>
          <div style={{ fontFamily: HEAVY, fontSize: 22, color: BRAND.ink, letterSpacing: '-0.01em' }}>
            SWING TRADER v2
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: BRAND.ink, opacity: 0.6 }}>
            BY · YOU
          </div>
        </div>
        <div style={{
          marginTop: 12,
          fontFamily: MONO, fontSize: 13, color: BRAND.ink,
          letterSpacing: '0.22em', fontWeight: 700, textAlign: 'center',
          background: BRAND.lime, padding: '8px 14px', borderRadius: 999,
          border: `2px solid ${BRAND.ink}`,
        }}>OTHERS PAY YOU · 90%</div>
      </div>

      {/* ARROWS */}
      {/* Left arrow: signal flowing INTO agent */}
      {arrowLeftT > 0 && (
        <Arrow
          from={{ x: leftP.x + 160, y: leftP.y - 20 }}
          to={{ x: center.x - 175, y: center.y - 20 }}
          progress={arrowLeftT}
          color={BRAND.lime}
          width={6}
          label="VERIFIED SIGNAL →"
          labelOffset={-50}
        />
      )}
      {/* Left arrow: payment flowing OUT to skill */}
      {arrowLeftT > 0 && (
        <Arrow
          from={{ x: center.x - 175, y: center.y + 30 }}
          to={{ x: leftP.x + 160, y: leftP.y + 30 }}
          progress={arrowLeftT}
          color={BRAND.paper}
          width={5}
          label="← $0.01 USDC.E"
          labelOffset={50}
          dashed
        />
      )}

      {/* Right arrow: other agents' calls IN */}
      {arrowRightT > 0 && (
        <Arrow
          from={{ x: rightP.x - 160, y: rightP.y - 20 }}
          to={{ x: center.x + 175, y: center.y - 20 }}
          progress={arrowRightT}
          color={BRAND.paper}
          width={5}
          label="← RUN MY SKILL"
          labelOffset={-50}
          dashed
        />
      )}
      {/* Right arrow: 90% earnings flowing back to agent */}
      {arrowRightT > 0 && (
        <Arrow
          from={{ x: center.x + 175, y: center.y + 30 }}
          to={{ x: rightP.x - 160, y: rightP.y + 30 }}
          progress={arrowRightT}
          color={BRAND.lime}
          width={6}
          label="90% EARNINGS →"
          labelOffset={50}
        />
      )}

      {/* Coins flowing left → center (insight cost going OUT) */}
      {insightFlowT > 0 && Array.from({ length: 3 }).map((_, i) => {
        const loopDur = 1.4;
        const lt = (((t - 3.4) + i * 0.45) % loopDur) / loopDur;
        if (lt < 0) return null;
        const x = center.x + (leftP.x - center.x) * lt;
        const y = center.y + 30 - Math.sin(lt * Math.PI) * 25;
        return <Coin key={`out${i}`} x={x} y={y} rot={lt * 540} size={32} label="$"/>;
      })}

      {/* Coins flowing right → center (revenue coming IN, big lime) */}
      {earningFlowT > 0 && Array.from({ length: 5 }).map((_, i) => {
        const loopDur = 1.2;
        const lt = (((t - 4.0) + i * 0.22) % loopDur) / loopDur;
        if (lt < 0) return null;
        const x = rightP.x + (center.x - rightP.x) * lt;
        const y = rightP.y - 20 - Math.sin(lt * Math.PI) * 35;
        return <Coin key={`in${i}`} x={x} y={y} rot={lt * 540} size={40} label="$"/>;
      })}

      {/* The Big Closing Line */}
      {bigT > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 100,
          textAlign: 'center', opacity: bigT,
          transform: `translateY(${(1-bigT) * 20}px)`,
        }}>
          <div style={{
            display: 'inline-block',
            background: BRAND.ink, color: BRAND.lime,
            border: `4px solid ${BRAND.lime}`, borderRadius: 18,
            padding: '18px 36px',
            fontFamily: HEAVY, fontSize: 44,
            letterSpacing: '-0.01em',
            boxShadow: `8px 8px 0 ${BRAND.ink}`,
          }}>
            CONSUME INTELLIGENCE. SELL INTELLIGENCE. SAME AGENT.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 07 — OUTRO
// "Live on 0G mainnet. 5 lines of code."
// ─────────────────────────────────────────────────────────────────────────────
function SceneOutro() {
  const { localTime: t } = useSprite();

  const v       = clamp(t / 0.4, 0, 1);
  const a       = clamp((t - 0.35) / 0.5, 0, 1);
  const o       = clamp((t - 0.7)  / 0.5, 0, 1);
  const bulletsT = clamp((t - 1.1) / 0.5, 0, 1);
  const cta     = clamp((t - 1.6)  / 0.5, 0, 1);

  const wobble = Math.sin(t * 3) * 3;

  const bullets = [
    '🔑 WALLET-NATIVE AUTH',
    '⚡ x402 GASLESS PAY',
    '🛡 TEE-ATTESTED',
    '📜 RECEIPTS ON-CHAIN',
    '📐 SMP-1 OPEN STANDARD',
    '🟢 0G COMPUTE · STORAGE · CHAIN',
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue }}>
      <GridBG t={t} drift={-5} opacity={0.10}/>
      <NoiseDots t={t} count={30} seed={7}/>

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
        }}>● LIVE ON 0G MAINNET</div>
      </div>

      <div style={{ position: 'absolute', top: 170, left: 0, right: 0, textAlign: 'center',
        opacity: v, transform: `translateY(${(1-v) * 30}px)` }}>
        <div style={{
          display: 'inline-block',
          fontFamily: HEAVY, fontSize: 200, color: BRAND.lime,
          WebkitTextStroke: `4px ${BRAND.ink}`,
          letterSpacing: '-0.03em', lineHeight: 0.95,
          textShadow: `10px 10px 0 ${BRAND.ink}`,
        }}>AGENT</div>
      </div>
      <div style={{ position: 'absolute', top: 380, left: 0, right: 0, textAlign: 'center',
        opacity: a, transform: `translateY(${(1-a) * 30}px)` }}>
        <div style={{
          fontFamily: HEAVY, fontSize: 200, color: BRAND.paper,
          WebkitTextStroke: `4px ${BRAND.ink}`,
          letterSpacing: '-0.03em', lineHeight: 0.95,
          textShadow: `10px 10px 0 ${BRAND.ink}`,
        }}>COMMERCE</div>
      </div>
      <div style={{ position: 'absolute', top: 580, left: 0, right: 0, textAlign: 'center',
        opacity: o, transform: `translateY(${(1-o) * 30}px)` }}>
        <div style={{
          display: 'inline-block',
          fontFamily: HEAVY, fontSize: 200, color: BRAND.paper,
          WebkitTextStroke: `4px ${BRAND.ink}`,
          letterSpacing: '-0.03em', lineHeight: 0.95,
          textShadow: `10px 10px 0 ${BRAND.ink}`,
        }}>ON·0G</div>
      </div>

      {/* Live proof — concrete traction strip */}
      <div style={{
        position: 'absolute', bottom: 340, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap',
        opacity: bulletsT, padding: '0 80px',
      }}>
        {[
          { kicker: 'LIVE',     value: 'V3',   sub: 'MAINNET DEPLOYED' },
          { kicker: 'PAY IN',   value: '0G + USDC.E', sub: 'DUAL PRICE PER SKILL' },
          { kicker: 'SPEC',     value: 'SMP-1', sub: 'ANCHORED ON 0G STORAGE' },
        ].map((s, i) => {
          const p = clamp((t - 0.9 - i * 0.12) / 0.4, 0, 1);
          const e = Easing.easeOutBack(p);
          return (
            <div key={i} style={{
              background: BRAND.paper, color: BRAND.ink,
              border: `3px solid ${BRAND.ink}`, borderRadius: 14,
              padding: '12px 22px',
              boxShadow: `5px 5px 0 ${BRAND.ink}`,
              transform: `translateY(${(1-e) * 20}px) scale(${e})`,
              opacity: p, minWidth: 200, textAlign: 'left',
            }}>
              <div style={{ fontFamily: MONO, fontSize: 10, opacity: 0.55, letterSpacing: '0.28em', fontWeight: 700 }}>{s.kicker}</div>
              <div style={{ fontFamily: HEAVY, fontSize: 28, color: BRAND.ink, lineHeight: 1, marginTop: 2 }}>{s.value}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, opacity: 0.55, letterSpacing: '0.22em', marginTop: 4, fontWeight: 700 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', bottom: 220, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap',
        opacity: bulletsT, padding: '0 80px',
      }}>
        {bullets.map((b, i) => {
          const p = clamp((t - 1.1 - i * 0.10) / 0.4, 0, 1);
          const e = Easing.easeOutBack(p);
          return (
            <div key={i} style={{
              background: BRAND.ink, color: BRAND.lime,
              border: `3px solid ${BRAND.lime}`, borderRadius: 12,
              padding: '10px 18px',
              fontFamily: MONO, fontSize: 13, fontWeight: 700,
              letterSpacing: '0.14em',
              boxShadow: `4px 4px 0 ${BRAND.ink}`,
              transform: `translateY(${(1-e) * 20}px) scale(${e})`,
              opacity: p, whiteSpace: 'nowrap',
            }}>{b}</div>
          );
        })}
      </div>

      {cta > 0 && (
        <>
          <div style={{
            position: 'absolute', left: 140, bottom: 100,
            transform: `scale(${Easing.easeOutBack(cta)}) rotate(${-wobble}deg)`,
            opacity: cta,
          }}>
            <div style={{
              background: BRAND.ink, color: BRAND.paper,
              border: `4px solid ${BRAND.lime}`, borderRadius: 18,
              padding: '18px 26px',
              fontFamily: MONO, fontSize: 18,
              letterSpacing: '0.16em', fontWeight: 700,
              boxShadow: `6px 6px 0 ${BRAND.ink}`,
              maxWidth: 360, lineHeight: 1.5,
            }}>
              <div style={{ color: BRAND.lime, fontSize: 12, opacity: 0.85, marginBottom: 6 }}>$ npm i</div>
              <div style={{ fontFamily: HEAVY, fontSize: 28, color: BRAND.lime, letterSpacing: '-0.01em' }}>
                @skillmint/sdk
              </div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                5 LINES OF CODE.<br/>BOTH SIDES OF THE LOOP.
              </div>
            </div>
          </div>

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
              fontFamily: HEAVY, fontSize: 50, color: BRAND.ink,
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
                  <textPath href="#circle">BUILD AGENTS · BUILD AGENTS · BUILD AGENTS · </textPath>
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
  SceneAgentSells, SceneLoop, SceneOutro,
});
