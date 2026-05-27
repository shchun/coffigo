// touch-selector.jsx
// Core "Chwazi"-style touch selector: multi-touch fingers → countdown → random winner.
// Exposes <TouchSelector variant="neon|pop|glass|kawaii" /> for use in Android frames.

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ─────────────────────────────────────────────────────────────
// Variant config — each one is a complete visual personality.
// ─────────────────────────────────────────────────────────────
const TS_VARIANTS = {
  neon: {
    name: 'NEON',
    label: 'Neon Cyber',
    tagline: '// TAP TO ENTER',
    cta: 'PLACE YOUR FINGERS',
    countLabel: 'PLAYERS',
    winnerLabel: 'WINNER',
    resetHint: 'TAP ANYWHERE TO RESTART',
    bg: 'radial-gradient(ellipse 70% 50% at 25% 15%, rgba(255,0,212,.22), transparent 70%),' +
        'radial-gradient(ellipse 80% 60% at 80% 90%, rgba(0,255,234,.22), transparent 70%),' +
        'linear-gradient(180deg, #0a0020 0%, #04000f 100%)',
    fg: '#e8e3ff',
    accent: '#00ffea',
    accent2: '#ff00d4',
    titleFont: '"Audiowide", "Orbitron", "JetBrains Mono", monospace',
    bodyFont: '"JetBrains Mono", "Space Mono", monospace',
    colors: ['#00ffea', '#ff00d4', '#fff200', '#00ff88', '#ff6b00', '#a64bff'],
    ring: 'neon',
    chrome: 'cyber',
  },
  pop: {
    name: 'POP',
    label: 'Pop Confetti',
    tagline: '✦ FRIENDS NIGHT ✦',
    cta: 'Fingers in!',
    countLabel: 'PLAYERS',
    winnerLabel: 'WINNER',
    resetHint: 'Tap for another round',
    bg: 'radial-gradient(circle at 20% 10%, #ff6fa0 0%, transparent 50%),' +
        'radial-gradient(circle at 90% 90%, #ffd166 0%, transparent 55%),' +
        'linear-gradient(140deg, #ff5e87 0%, #ff9a3d 50%, #ffd14a 100%)',
    fg: '#2a0033',
    accent: '#2a0033',
    accent2: '#fff',
    titleFont: '"Fraunces", "Baloo 2", system-ui',
    bodyFont: '"Fraunces", system-ui',
    colors: ['#ff2e63', '#7a3cff', '#06d6a0', '#118ab2', '#ff8c00', '#3a0ca3'],
    ring: 'chunky',
    chrome: 'pop',
  },
  glass: {
    name: 'AURORA',
    label: 'Aurora Glass',
    tagline: '· · · GATHER · · ·',
    cta: 'place your fingers',
    countLabel: 'fingers',
    winnerLabel: 'chosen',
    resetHint: 'tap to begin again',
    bg: 'conic-gradient(from 200deg at 70% 30%, #ff7eb3, #ffd57e, #7eddff, #b67eff, #ff7eb3)',
    fg: '#fff',
    accent: '#fff',
    accent2: 'rgba(255,255,255,.7)',
    titleFont: '"Manrope", "Space Grotesk", system-ui',
    bodyFont: '"Manrope", system-ui',
    colors: ['#ffe8f0', '#ffd57e', '#7eddff', '#b67eff', '#7effc8', '#ffb47e'],
    ring: 'glass',
    chrome: 'glass',
  },
  kawaii: {
    name: 'KAWAII',
    label: 'Kawaii Sticker',
    tagline: '★ WHO WILL IT BE ★',
    cta: 'Place your fingers',
    countLabel: 'friends',
    winnerLabel: 'WINNER!!',
    resetHint: 'One more ♥',
    bg: 'radial-gradient(circle at 50% 0%, #ffe4ec 0%, #f0d9ff 55%, #d9efff 100%)',
    fg: '#3d1a3d',
    accent: '#ff5da8',
    accent2: '#3d1a3d',
    titleFont: '"Comfortaa", "Quicksand", system-ui',
    bodyFont: '"Comfortaa", system-ui',
    colors: ['#ff5da8', '#ffb84d', '#fff066', '#7eed7e', '#5dc8ff', '#b56dff'],
    ring: 'sticker',
    chrome: 'kawaii',
  },
};

const COUNTDOWN_MS = 2800;
const RESET_GRACE_MS = 1500; // ignore taps right after the winner reveal (matches the reveal animation)

// ─────────────────────────────────────────────────────────────
// Audio + haptics
// ─────────────────────────────────────────────────────────────
function useAudio() {
  const ctxRef = useRef(null);
  const getCtx = () => {
    if (!ctxRef.current) {
      try { ctxRef.current = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { return null; }
    }
    return ctxRef.current;
  };
  const beep = (freq, dur = 0.08, type = 'sine', vol = 0.12) => {
    const ctx = getCtx(); if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  };
  return {
    pulse: () => beep(620, 0.07, 'triangle', 0.1),
    tick:  (i = 0) => beep(540 + i * 120, 0.06, 'square', 0.08),
    join:  () => beep(880, 0.05, 'sine', 0.08),
    winner: () => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        setTimeout(() => beep(f, 0.4, 'triangle', 0.18), i * 70);
      });
    },
  };
}

const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

// ─────────────────────────────────────────────────────────────
// Pointer ring — variant-specific renderer
// ─────────────────────────────────────────────────────────────
function PointerRing({ p, variant, phase, isWinner, isLoser, countdownProgress, index }) {
  const baseSize = 132;
  const winnerScale = 9;        // dramatic zoom
  const loserScale = 0.05;
  const size = isWinner ? baseSize * winnerScale : (isLoser ? baseSize * loserScale : baseSize);
  const opacity = isLoser ? 0 : 1;

  const wrap = {
    position: 'absolute',
    left: p.x, top: p.y,
    width: size, height: size,
    transform: 'translate(-50%, -50%)',
    transition: isWinner
      ? 'width 1.1s cubic-bezier(.5,0,.1,1), height 1.1s cubic-bezier(.5,0,.1,1), opacity .3s'
      : isLoser
      ? 'width .55s cubic-bezier(.5,0,.5,1), height .55s cubic-bezier(.5,0,.5,1), opacity .55s'
      : 'width .25s cubic-bezier(.2,.7,.2,1), height .25s cubic-bezier(.2,.7,.2,1)',
    opacity,
    pointerEvents: 'none',
    zIndex: isWinner ? 5 : 2,
  };

  const spinSlow  = { animation: `ts-spin ${5 + (index % 3)}s linear infinite` };
  const spinFast  = { animation: `ts-spin ${2.5 + (index % 3) * 0.4}s linear infinite reverse` };
  const breathe   = { animation: 'ts-breathe 1.6s ease-in-out infinite' };

  // Common: countdown ring (drawn under each pointer when counting)
  const Countdown = ({ stroke, glow }) => {
    const r = 44;
    const c = 2 * Math.PI * r;
    return (
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeOpacity="0.18" strokeWidth="3" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - countdownProgress)}
          transform="rotate(-90 50 50)"
          style={{ filter: glow, transition: 'stroke-dashoffset .08s linear' }} />
      </svg>
    );
  };

  if (variant.ring === 'neon') {
    return (
      <div style={wrap}>
        <div style={{ position: 'absolute', inset: -40, borderRadius: '50%',
          background: `radial-gradient(circle, ${p.color}55 0%, transparent 65%)`,
          ...breathe, mixBlendMode: 'screen' }}/>
        <div style={{ position: 'absolute', inset: 0, ...spinSlow }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible',
            filter: `drop-shadow(0 0 8px ${p.color}) drop-shadow(0 0 16px ${p.color}aa)` }}>
            <circle cx="50" cy="50" r="40" fill="none" stroke={p.color} strokeWidth="2.5"
              strokeDasharray="3 5" opacity="0.85" />
            <circle cx="50" cy="50" r="46" fill="none" stroke={p.color} strokeWidth="1" opacity="0.4" />
            <g opacity="0.9">
              {[0, 90, 180, 270].map(a => (
                <rect key={a} x="48" y="2" width="4" height="6" fill={p.color}
                  transform={`rotate(${a} 50 50)`} />
              ))}
            </g>
          </svg>
        </div>
        <div style={{ position: 'absolute', inset: '20%', ...spinFast }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible',
            filter: `drop-shadow(0 0 6px ${p.color})` }}>
            <circle cx="50" cy="50" r="35" fill="none" stroke={p.color} strokeWidth="1.5"
              strokeDasharray="1 4" opacity="0.7" />
          </svg>
        </div>
        <div style={{ position: 'absolute', inset: '38%', borderRadius: '50%',
          background: p.color, boxShadow: `0 0 16px ${p.color}, 0 0 32px ${p.color}aa, inset 0 0 8px #fff` }} />
        {phase === 'counting' && <Countdown stroke={p.color} glow={`drop-shadow(0 0 6px ${p.color})`} />}
      </div>
    );
  }

  if (variant.ring === 'chunky') {
    return (
      <div style={wrap}>
        <div style={{ position: 'absolute', inset: 0, ...spinSlow }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible',
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,.25))' }}>
            <circle cx="50" cy="50" r="44" fill="none" stroke={p.color} strokeWidth="9" />
            <g>
              {Array.from({length: 8}).map((_, i) => {
                const a = (i / 8) * 360;
                return <circle key={i} cx="50" cy="6" r="3" fill={p.color}
                  transform={`rotate(${a} 50 50)`} />;
              })}
            </g>
          </svg>
        </div>
        <div style={{ position: 'absolute', inset: '14%', borderRadius: '50%',
          background: '#fff', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.15)' }} />
        <div style={{ position: 'absolute', inset: '24%', borderRadius: '50%',
          background: p.color,
          boxShadow: `inset 0 6px 0 rgba(255,255,255,.35), inset 0 -8px 0 rgba(0,0,0,.18), 0 4px 12px ${p.color}66` }} />
        {phase === 'counting' && <Countdown stroke="#fff" glow="drop-shadow(0 2px 4px rgba(0,0,0,.25))" />}
      </div>
    );
  }

  if (variant.ring === 'glass') {
    return (
      <div style={wrap}>
        <div style={{ position: 'absolute', inset: -20, borderRadius: '50%',
          background: `radial-gradient(circle, ${p.color}88 0%, transparent 70%)`, ...breathe }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          border: '1.5px solid rgba(255,255,255,.55)',
          boxShadow: 'inset 0 2px 12px rgba(255,255,255,.35), 0 8px 32px rgba(0,0,0,.18)' }} />
        <div style={{ position: 'absolute', inset: 0, ...spinSlow }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="0.6"
              strokeDasharray="0.5 2" />
          </svg>
        </div>
        <div style={{ position: 'absolute', inset: '34%', borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, #fff, ${p.color} 70%)`,
          boxShadow: `0 0 20px ${p.color}, inset 0 -4px 8px rgba(0,0,0,.15), inset 0 4px 6px rgba(255,255,255,.7)` }} />
        {phase === 'counting' && <Countdown stroke="#fff" glow="drop-shadow(0 0 6px rgba(255,255,255,.6))" />}
      </div>
    );
  }

  // sticker / kawaii
  return (
    <div style={wrap}>
      <div style={{ position: 'absolute', inset: 0, ...spinSlow }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* sparkle stars around */}
          {[0, 60, 120, 180, 240, 300].map((a, i) => (
            <g key={a} transform={`rotate(${a} 50 50) translate(0 -42)`} opacity="0.9">
              <path d="M 50 46 L 51.2 49.2 L 54.5 50 L 51.2 50.8 L 50 54 L 48.8 50.8 L 45.5 50 L 48.8 49.2 Z"
                fill={i % 2 === 0 ? '#fff' : variant.accent} />
            </g>
          ))}
        </svg>
      </div>
      {/* solid sticker disc with thick "outline" border */}
      <div style={{ position: 'absolute', inset: '8%', borderRadius: '50%',
        background: p.color,
        border: '4px solid #2a0a2a',
        boxShadow: '4px 4px 0 #2a0a2a, inset 0 -10px 0 rgba(0,0,0,.12), inset 0 8px 0 rgba(255,255,255,.35)' }} />
      {/* cute eyes */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '6%', color: '#2a0a2a' }}>
        <div style={{ display: 'flex', gap: '18%' }}>
          <div style={{ width: '10%', height: '14%', borderRadius: '50%', background: '#2a0a2a',
            boxShadow: 'inset 0 0 0 1px #2a0a2a', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '15%', left: '20%', width: '40%', height: '30%',
              borderRadius: '50%', background: '#fff' }}/>
          </div>
          <div style={{ width: '10%', height: '14%', borderRadius: '50%', background: '#2a0a2a',
            position: 'relative' }}>
            <div style={{ position: 'absolute', top: '15%', left: '20%', width: '40%', height: '30%',
              borderRadius: '50%', background: '#fff' }}/>
          </div>
        </div>
        <div style={{ width: '14%', height: '8%', borderTop: '0 solid transparent',
          borderBottom: '3px solid #2a0a2a', borderRadius: '0 0 50% 50%' }}/>
      </div>
      {phase === 'counting' && <Countdown stroke="#2a0a2a" glow="none" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Confetti / particle burst on winner reveal
// ─────────────────────────────────────────────────────────────
function Confetti({ variant, center, width, height }) {
  const particles = useMemo(() => {
    const N = 90;
    return Array.from({ length: N }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 420;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 80; // bias up
      const rot = Math.random() * 1080 - 540;
      const dur = 1.2 + Math.random() * 1.4;
      const delay = Math.random() * 0.2;
      const size = 6 + Math.random() * 10;
      const color = variant.colors[i % variant.colors.length];
      const shape = i % 3; // 0 rect, 1 circle, 2 strip
      return { dx, dy, rot, dur, delay, size, color, shape, i };
    });
  }, [center?.id]);

  if (!center) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 6 }}>
      {particles.map(p => (
        <div key={p.i} style={{
          position: 'absolute', left: center.x, top: center.y,
          width: p.shape === 2 ? p.size * 0.4 : p.size,
          height: p.shape === 2 ? p.size * 1.4 : p.size,
          background: p.color,
          borderRadius: p.shape === 1 ? '50%' : 2,
          transform: 'translate(-50%, -50%)',
          animation: `ts-burst-${p.i % 12} ${p.dur}s cubic-bezier(.15,.6,.4,1) ${p.delay}s forwards`,
          opacity: 0,
          boxShadow: variant.ring === 'neon' ? `0 0 8px ${p.color}` : '0 2px 4px rgba(0,0,0,.15)',
          '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`,
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HUD / banners
// ─────────────────────────────────────────────────────────────
function HintOverlay({ variant, count }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      pointerEvents: 'none', padding: 24,
      animation: count === 0 ? 'ts-hint-breathe 2.4s ease-in-out infinite' : 'none',
      opacity: count === 0 ? 1 : 0.55,
      transition: 'opacity .35s',
    }}>
      <div style={{
        fontFamily: variant.bodyFont, fontSize: 11, letterSpacing: 4,
        color: variant.fg, opacity: 0.65, marginBottom: 18,
      }}>{variant.tagline}</div>
      <div style={{
        fontFamily: variant.titleFont, fontSize: 38, fontWeight: 700,
        color: variant.fg, lineHeight: 1.05, textShadow: variant.ring === 'neon'
          ? `0 0 16px ${variant.accent}, 0 0 32px ${variant.accent}88`
          : variant.ring === 'glass' ? '0 2px 12px rgba(0,0,0,.25)' : 'none',
      }}>{variant.cta}</div>
      <div style={{ marginTop: 24, display: 'flex', gap: 6, opacity: 0.7 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: variant.fg, opacity: 0.4,
            animation: `ts-dot ${1.4}s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function PlayerCounter({ variant, count, phase }) {
  if (count === 0) return null;
  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
      fontFamily: variant.bodyFont, fontSize: 11, letterSpacing: 2,
      color: variant.fg, opacity: 0.7, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: variant.accent,
        boxShadow: variant.ring === 'neon' ? `0 0 6px ${variant.accent}` : 'none',
        animation: phase === 'counting' ? 'ts-pulse 0.5s ease-in-out infinite' : 'none',
      }} />
      <span>{count} {variant.countLabel}</span>
    </div>
  );
}

function WinnerBanner({ variant }) {
  return (
    <div style={{
      position: 'absolute', top: '12%', left: 0, right: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      pointerEvents: 'none', zIndex: 10, padding: '0 16px',
      animation: 'ts-banner-in .6s cubic-bezier(.2,.8,.3,1.2) .9s both',
    }}>
      <div style={{
        fontFamily: variant.bodyFont, fontSize: 12, letterSpacing: 6,
        color: variant.fg, opacity: 0.8, marginBottom: 8,
      }}>★ ★ ★</div>
      <div style={{
        fontFamily: variant.titleFont,
        // Responsive so wide labels (e.g. NEON's "WINNER" in Audiowide) don't overflow narrow screens.
        fontSize: 'clamp(36px, 13vw, 64px)', fontWeight: 800,
        maxWidth: '100%', whiteSpace: 'nowrap',
        color: variant.fg, lineHeight: 0.95, letterSpacing: -1,
        textShadow: variant.ring === 'neon'
          ? `0 0 20px ${variant.accent}, 0 0 40px ${variant.accent}, 0 4px 0 #000`
          : variant.ring === 'kawaii' ? '4px 4px 0 #2a0a2a'
          : variant.ring === 'pop' ? '0 6px 0 rgba(0,0,0,.15)'
          : '0 4px 20px rgba(0,0,0,.3)',
      }}>{variant.winnerLabel}</div>
    </div>
  );
}

// Fixed-size ring pinned to the winner's original finger spot, so it stays
// readable even as the winner pointer zooms to fill the screen.
function WinnerMarker({ variant, center }) {
  if (!center) return null;
  // Themed accent for the dashed ring on top — but it rides on a high-contrast
  // dark+white base so the marker reads on any background behind it.
  const accent = variant.ring === 'kawaii' ? '#2a0a2a'
    : variant.ring === 'pop' ? '#fff'
    : variant.accent;
  return (
    <div style={{
      position: 'absolute', left: center.x, top: center.y,
      width: 132, height: 132, transform: 'translate(-50%, -50%)',
      pointerEvents: 'none', zIndex: 9,
      animation: 'ts-marker-in .5s cubic-bezier(.2,.8,.3,1.2) 1s both',
    }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        animation: 'ts-marker-pulse 1.4s ease-in-out 1.5s infinite',
      }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.5))' }}>
          {/* Two-color dashed ring: white + dark dashes interlock so one of them
              always contrasts, whatever the background behind the marker is. */}
          <circle cx="50" cy="50" r="46" fill="none" stroke="#fff" strokeWidth="5"
            strokeDasharray="8 8" />
          <circle cx="50" cy="50" r="46" fill="none" stroke="#1a1a1a" strokeWidth="5"
            strokeDasharray="8 8" strokeDashoffset="8" />
          {/* center dot — white halo + themed core */}
          <circle cx="50" cy="50" r="6" fill="#fff" stroke="#1a1a1a" strokeWidth="2" />
          <circle cx="50" cy="50" r="3" fill={accent} />
        </svg>
      </div>
    </div>
  );
}

function ResetHint({ variant }) {
  return (
    <div style={{
      position: 'absolute', bottom: '8%', left: 0, right: 0, textAlign: 'center',
      fontFamily: variant.bodyFont, fontSize: 12, letterSpacing: 1.5,
      color: variant.fg, opacity: 0.7, pointerEvents: 'none', zIndex: 10,
      animation: 'ts-fade-in 0.5s ease 1.4s both, ts-hint-breathe 2s ease-in-out 1.4s infinite',
    }}>{variant.resetHint}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chrome / background ornaments
// ─────────────────────────────────────────────────────────────
function ChromeBackground({ variant, phase }) {
  if (variant.chrome === 'cyber') {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {/* grid */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.18,
          backgroundImage: `linear-gradient(${variant.accent}33 1px, transparent 1px),
            linear-gradient(90deg, ${variant.accent}33 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 60%, #000 30%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 60%, #000 30%, transparent 90%)' }} />
        {/* corner brackets */}
        {[[12, 12, 'tl'], [12, 12, 'tr'], [12, 12, 'bl'], [12, 12, 'br']].map(([_, __, k], i) => (
          <div key={k} style={{
            position: 'absolute',
            ...(k[0] === 't' ? { top: 18 } : { bottom: 18 }),
            ...(k[1] === 'l' ? { left: 18 } : { right: 18 }),
            width: 22, height: 22,
            borderTop: k[0] === 't' ? `2px solid ${variant.accent}` : 'none',
            borderBottom: k[0] === 'b' ? `2px solid ${variant.accent}` : 'none',
            borderLeft: k[1] === 'l' ? `2px solid ${variant.accent}` : 'none',
            borderRight: k[1] === 'r' ? `2px solid ${variant.accent}` : 'none',
            opacity: 0.7,
            filter: `drop-shadow(0 0 4px ${variant.accent})`,
          }} />
        ))}
      </div>
    );
  }
  if (variant.chrome === 'pop') {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {/* squiggles + dots scattered */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}>
          {Array.from({length: 30}).map((_, i) => {
            const x = (i * 137) % 380; const y = (i * 79) % 760;
            const s = 6 + (i % 4) * 3;
            return <circle key={i} cx={x + 10} cy={y + 10} r={s} fill="#fff" />;
          })}
        </svg>
        <svg style={{ position: 'absolute', top: 32, right: 24, width: 80, height: 30, opacity: 0.35 }}
          viewBox="0 0 80 30" fill="none" stroke="#2a0033" strokeWidth="3" strokeLinecap="round">
          <path d="M 4 15 Q 14 4, 24 15 T 44 15 T 64 15 T 78 15" />
        </svg>
      </div>
    );
  }
  if (variant.chrome === 'glass') {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {/* noise / soft grain via radial dots */}
        <div style={{ position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.18) 1px, transparent 1px)',
          backgroundSize: '4px 4px', opacity: 0.5,
          mixBlendMode: 'overlay' }} />
        <div style={{ position: 'absolute', inset: '-30%',
          background: 'radial-gradient(circle, rgba(255,255,255,.3) 0%, transparent 50%)',
          filter: 'blur(40px)', animation: 'ts-orbit 18s linear infinite' }} />
      </div>
    );
  }
  // kawaii — floating hearts/stars/clouds
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {[
        { x: 30, y: 60, c: '#ffb3c1', s: 'heart', sz: 22 },
        { x: 320, y: 80, c: '#bdb2ff', s: 'star', sz: 18 },
        { x: 60, y: 720, c: '#9bf6ff', s: 'star', sz: 14 },
        { x: 300, y: 700, c: '#ffd6a5', s: 'heart', sz: 18 },
        { x: 200, y: 40, c: '#caffbf', s: 'star', sz: 12 },
        { x: 20, y: 380, c: '#fdffb6', s: 'star', sz: 16 },
        { x: 350, y: 420, c: '#ffb3c1', s: 'heart', sz: 14 },
      ].map((d, i) => (
        <div key={i} style={{
          position: 'absolute', left: d.x, top: d.y, width: d.sz, height: d.sz,
          animation: `ts-float ${4 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
        }}>
          {d.s === 'heart' ? (
            <svg viewBox="0 0 24 24" width={d.sz} height={d.sz} fill={d.c}
              style={{ filter: 'drop-shadow(2px 2px 0 #2a0a2a)' }}>
              <path stroke="#2a0a2a" strokeWidth="1.5" d="M12 21s-7-4.5-9.5-9C.5 8.5 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6.5 4.5 4.5 8-2.5 4.5-9.5 9-9.5 9z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width={d.sz} height={d.sz} fill={d.c}
              style={{ filter: 'drop-shadow(2px 2px 0 #2a0a2a)' }}>
              <path stroke="#2a0a2a" strokeWidth="1.5" d="M12 2l2.5 6.5L22 9l-5.5 4.5L18 21l-6-3.5L6 21l1.5-7.5L2 9l7.5-.5L12 2z"/>
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
function TouchSelector({ variant = 'neon' }) {
  const v = TS_VARIANTS[variant];
  const surfaceRef = useRef(null);
  const [pointers, setPointers] = useState({});
  const [phase, setPhase] = useState('idle'); // idle | counting | winner
  const [winnerId, setWinnerId] = useState(null);
  const [progress, setProgress] = useState(0);
  const audio = useAudio();
  const colorIdxRef = useRef(0);
  const pointersRef = useRef({});
  const ignoreRef = useRef(false); // ignore new pointers after winner picked
  const winnerAtRef = useRef(0);   // timestamp of winner reveal (for reset grace period)

  useEffect(() => { pointersRef.current = pointers; }, [pointers]);

  const reset = useCallback(() => {
    setPointers({});
    setPhase('idle');
    setWinnerId(null);
    setProgress(0);
    colorIdxRef.current = 0;
    ignoreRef.current = false;
  }, []);

  // Pointer handlers
  const getXY = (e) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    if (phase === 'winner') {
      // Ignore accidental taps during the reveal; only reset once it settles.
      if (performance.now() - winnerAtRef.current >= RESET_GRACE_MS) reset();
      return;
    }
    if (ignoreRef.current) return;
    try { e.target.setPointerCapture(e.pointerId); } catch {}
    const { x, y } = getXY(e);
    setPointers(prev => {
      if (prev[e.pointerId]) return prev;
      const color = v.colors[colorIdxRef.current % v.colors.length];
      colorIdxRef.current++;
      audio.join();
      vibrate(20);
      return { ...prev, [e.pointerId]: { id: e.pointerId, x, y, color } };
    });
  };
  const onPointerMove = (e) => {
    if (!pointersRef.current[e.pointerId]) return;
    const { x, y } = getXY(e);
    setPointers(prev => prev[e.pointerId]
      ? { ...prev, [e.pointerId]: { ...prev[e.pointerId], x, y } } : prev);
  };
  const onPointerUp = (e) => {
    if (phase === 'winner') return; // don't drop pointers during reveal
    setPointers(prev => {
      if (!prev[e.pointerId]) return prev;
      const { [e.pointerId]: _, ...rest } = prev;
      return rest;
    });
  };

  // Countdown driver — runs when 2+ pointers are present.
  useEffect(() => {
    if (phase === 'winner') return;
    const ids = Object.keys(pointers);
    if (ids.length >= 2) {
      setPhase('counting');
      setProgress(0);
      if (window.track) window.track('game_start', { players: ids.length, variant });
      const start = performance.now();
      let lastTick = -1;
      let raf;
      const step = (now) => {
        const elapsed = now - start;
        const p = Math.min(1, elapsed / COUNTDOWN_MS);
        setProgress(p);
        const tickIdx = Math.floor(p * 4);
        if (tickIdx > lastTick && tickIdx < 4) {
          lastTick = tickIdx;
          audio.tick(tickIdx);
          vibrate(20);
        }
        if (p < 1) {
          raf = requestAnimationFrame(step);
        } else {
          // pick winner
          const curIds = Object.keys(pointersRef.current);
          if (curIds.length >= 2) {
            const w = curIds[Math.floor(Math.random() * curIds.length)];
            ignoreRef.current = true;
            winnerAtRef.current = performance.now();
            setWinnerId(Number(w));
            setPhase('winner');
            if (window.track) window.track('winner_selected', { players: curIds.length, variant });
            audio.winner();
            vibrate([60, 30, 80, 30, 220]);
          }
        }
      };
      raf = requestAnimationFrame(step);
      return () => { if (raf) cancelAnimationFrame(raf); };
    } else {
      if (phase === 'counting') { setPhase('idle'); setProgress(0); }
    }
    // eslint-disable-next-line
  }, [Object.keys(pointers).sort().join(',')]);

  // ─── Demo mode (for desktop / single-pointer environments) ─────
  const demoTimers = useRef([]);
  const runDemo = useCallback(() => {
    if (phase !== 'idle' || Object.keys(pointers).length > 0) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2 + 30;
    const n = 4;
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = Math.min(rect.width, rect.height) * 0.28;
      const x = cx + Math.cos(angle) * r + (Math.random() - 0.5) * 30;
      const y = cy + Math.sin(angle) * r + (Math.random() - 0.5) * 30;
      const id = -1000 - i; // fake pointer ids
      const t = setTimeout(() => {
        setPointers(prev => {
          const color = v.colors[colorIdxRef.current % v.colors.length];
          colorIdxRef.current++;
          audio.join();
          vibrate(15);
          return { ...prev, [id]: { id, x, y, color } };
        });
      }, i * 320);
      demoTimers.current.push(t);
    }
  }, [phase, pointers, v.colors]);

  return (
    <div
      ref={surfaceRef}
      data-comment-anchor={`ts-surface-${variant}`}
      style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        background: v.bg,
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        fontFamily: v.bodyFont,
        cursor: phase === 'winner' ? 'pointer' : 'crosshair',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <ChromeBackground variant={v} phase={phase} />

      <HintOverlay variant={v} count={Object.keys(pointers).length} />
      <PlayerCounter variant={v} count={Object.keys(pointers).length} phase={phase} />

      {/* loser-fade backdrop on winner reveal */}
      {phase === 'winner' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: v.ring === 'neon' ? 'rgba(0,0,0,.55)'
            : v.ring === 'glass' ? 'rgba(0,0,0,.25)'
            : v.ring === 'kawaii' ? 'rgba(255,228,236,.5)'
            : 'rgba(255,255,255,.18)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          animation: 'ts-fade-in .6s ease both', pointerEvents: 'none', zIndex: 1,
        }} />
      )}

      {Object.values(pointers).map((p, i) => (
        <PointerRing key={p.id} p={p} variant={v} phase={phase}
          isWinner={phase === 'winner' && p.id === winnerId}
          isLoser={phase === 'winner' && p.id !== winnerId}
          countdownProgress={progress}
          index={i}
        />
      ))}

      {phase === 'winner' && <Confetti variant={v} center={pointers[winnerId]} />}
      {phase === 'winner' && <WinnerMarker variant={v} center={pointers[winnerId]} />}
      {phase === 'winner' && <WinnerBanner variant={v} />}
      {phase === 'winner' && <ResetHint variant={v} />}

      {/* Demo button (idle only) */}
      {phase === 'idle' && Object.keys(pointers).length === 0 && (
        <button
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); runDemo(); }}
          style={{
            position: 'absolute', bottom: 28, right: 20,
            background: v.ring === 'neon' ? 'rgba(0,255,234,.12)'
              : v.ring === 'glass' ? 'rgba(255,255,255,.18)'
              : v.ring === 'kawaii' ? '#fff'
              : 'rgba(255,255,255,.85)',
            color: v.fg,
            border: v.ring === 'neon' ? `1px solid ${v.accent}`
              : v.ring === 'kawaii' ? '2.5px solid #2a0a2a'
              : 'none',
            borderRadius: v.ring === 'kawaii' ? 16 : 100,
            padding: '9px 14px',
            fontFamily: v.bodyFont, fontSize: 11, letterSpacing: 2, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: v.ring === 'neon' ? `0 0 12px ${v.accent}66, inset 0 0 8px ${v.accent}33`
              : v.ring === 'kawaii' ? '3px 3px 0 #2a0a2a'
              : '0 4px 14px rgba(0,0,0,.18)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            zIndex: 20,
          }}
        >▶ DEMO</button>
      )}
    </div>
  );
}

Object.assign(window, { TouchSelector, TS_VARIANTS });
