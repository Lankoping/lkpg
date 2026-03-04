'use client'

import { motion } from 'motion/react'

export function ComingSoon() {
  return (
    <div className="cs-root">
      {/* Industrial grid overlay */}
      <div className="cs-grid" />

      {/* River light bleed */}
      <div className="cs-river-glow" />

      {/* Animated Floating Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="cs-particle"
          initial={{ 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            opacity: 0 
          }}
          animate={{ 
            y: [null, "-20%"],
            opacity: [0, 0.3, 0],
            scale: [0.8, 1.2, 0.8]
          }}
          transition={{ 
            duration: 10 + i * 2, 
            repeat: Infinity, 
            ease: "linear",
            delay: i * 1.5
          }}
          style={{
            left: (i * 15) + "%",
            width: (2 + i % 3) + "px",
            height: (2 + i % 3) + "px",
          }}
        />
      ))}

      {/* Scanning Laser Line */}
      <motion.div 
        className="cs-scanner"
        animate={{ top: ["-10%", "110%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* Brick texture band */}
      <div className="cs-brick-band" />

      {/* Noise grain */}
      <div className="cs-grain" />

      {/* Corner marks */}
      <div className="cs-corner cs-corner-tl" />
      <div className="cs-corner cs-corner-tr" />
      <div className="cs-corner cs-corner-bl" />
      <div className="cs-corner cs-corner-br" />

      <div className="cs-content">
        {/* City marker */}
        <motion.div
          className="cs-eyebrow"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            duration: 1.2, 
            ease: [0.16, 1, 0.3, 1], 
            delay: 0.2 
          }}
        >
          <span className="cs-marker-line" />
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            NORRKÖPING
          </motion.span>
          <span className="cs-marker-line" />
        </motion.div>

        {/* Logo - Debug simplified */}
        <div
          className="cs-logo-wrap"
          style={{ opacity: 1, transform: 'none' }}
        >
          <span className="cs-logo-l">L</span>
          <span className="cs-logo-rest">ANKOPING</span>
          <span className="cs-logo-se">.SE</span>
        </div>

        {/* Industrial rule */}
        <motion.div
          className="cs-rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
        />

        {/* Headline - Debug simplified */}
        <h1
          className="cs-headline"
          style={{ opacity: 1, transform: 'none' }}
        >
          Snart
        </h1>

        {/* Sub-headline - Debug simplified */}
        <p
          className="cs-sub"
          style={{ opacity: 1, transform: 'none' }}
        >
          Vi håller fortfarande på med de sista detaljerna.
        </p>

        {/* City tags - Debug simplified */}
        <div
          className="cs-tags"
          style={{ opacity: 1 }}
        >
          <span className="cs-tag">Norrköping</span>
          <span className="cs-tag-sep">×</span>
          <span className="cs-tag">Östergötland</span>
          <span className="cs-tag-sep">×</span>
          <span className="cs-tag">Sverige</span>
        </div>

        {/* Rules Buttons - Debug simplified */}
        <div
          className="cs-btn-group"
          style={{ opacity: 1, transform: 'none' }}
        >
          <a href="/rules" className="cs-rules-btn">Läs Regler</a>
          <a href="/team" className="cs-rules-btn">Teamet</a>
          <a href="/privacy" className="cs-rules-btn">Dina Uppgifter</a>
        </div>

        {/* Socials - Debug with regular div */}
        <div 
            className="cs-socials"
            style={{ opacity: 1, transition: 'opacity 1s ease 1.35s' }}
        >
            <a href="https://discord.gg/h8wuaqyBwT" target="_blank" rel="noopener noreferrer" className="cs-social-link">Discord</a>
            <span className="cs-social-sep">•</span>
            <a href="https://www.youtube.com/@LANKPNG" target="_blank" rel="noopener noreferrer" className="cs-social-link">Youtube</a>
        </div>

        {/* Footer */}
        <motion.footer
          className="cs-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
        >
          <span>© 2026 Lankoping.se</span>
          <span className="cs-footer-sep">—</span>
          <span>Alla rättigheter förbehållna</span>
        </motion.footer>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,300;1,300&display=swap');

        :root {
          --cs-bg: #100E0C;
          --cs-brick: #7A2B1E;
          --cs-rust: #C04A2A;
          --cs-rust-dim: rgba(192, 74, 42, 0.18);
          --cs-rust-faint: rgba(192, 74, 42, 0.07);
          --cs-river: #1A3045;
          --cs-river-glow: rgba(30, 70, 110, 0.22);
          --cs-cream: #F0E8D8;
          --cs-cream-dim: rgba(240, 232, 216, 0.5);
          --cs-cream-faint: rgba(240, 232, 216, 0.1);
          --cs-font-display: 'Bebas Neue', sans-serif;
          --cs-font-serif: 'Cormorant Garamond', serif;
          --cs-font-body: 'DM Sans', sans-serif;
        }

        .cs-root {
          position: relative;
          min-height: 100vh;
          width: 100%;
          background: var(--cs-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: var(--cs-font-body);
          color: var(--cs-cream);
        }

        /* Particles */
        .cs-particle {
          position: absolute;
          background: var(--cs-rust);
          border-radius: 50%;
          filter: blur(1px);
          pointer-events: none;
          z-index: 1;
        }

        /* Scanning Laser */
        .cs-scanner {
          position: absolute;
          left: 0;
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--cs-rust-dim), transparent);
          box-shadow: 0 0 15px var(--cs-rust-faint);
          opacity: 0.3;
          pointer-events: none;
          z-index: 2;
        }

        /* Industrial grid */
        .cs-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(240,232,216,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(240,232,216,0.03) 1px, transparent 1px);
          background-size: 64px 64px;
          pointer-events: none;
        }

        /* River glow — bottom left */
        .cs-river-glow {
          position: absolute;
          bottom: -80px;
          left: -100px;
          width: 700px;
          height: 400px;
          background: radial-gradient(ellipse at center, var(--cs-river-glow) 0%, transparent 70%);
          filter: blur(60px);
          pointer-events: none;
          animation: riverPulse 9s ease-in-out infinite;
        }
        @keyframes riverPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        /* Brick texture band — diagonal strip */
        .cs-brick-band {
          position: absolute;
          top: 0;
          right: 0;
          width: 320px;
          height: 100%;
          background: repeating-linear-gradient(
            0deg,
            var(--cs-rust-faint) 0px,
            var(--cs-rust-faint) 18px,
            transparent 18px,
            transparent 38px
          );
          clip-path: polygon(30% 0, 100% 0, 100% 100%, 0% 100%);
          pointer-events: none;
        }

        /* Grain */
        .cs-grain {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.045;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 180px;
        }

        /* Corner crosshair marks */
        .cs-corner {
          position: absolute;
          width: 20px;
          height: 20px;
          pointer-events: none;
          opacity: 0.4;
        }
        .cs-corner::before,
        .cs-corner::after {
          content: '';
          position: absolute;
          background: var(--cs-rust);
        }
        .cs-corner::before { width: 1px; height: 100%; }
        .cs-corner::after  { width: 100%; height: 1px; }
        .cs-corner-tl { top: 28px; left: 28px; }
        .cs-corner-tr { top: 28px; right: 28px; }
        .cs-corner-tr::before { left: auto; right: 0; }
        .cs-corner-bl { bottom: 28px; left: 28px; }
        .cs-corner-bl::before { top: auto; bottom: 0; }
        .cs-corner-br { bottom: 28px; right: 28px; }
        .cs-corner-br::before { top: auto; bottom: 0; left: auto; right: 0; }
        .cs-corner-br::after { top: auto; bottom: 0; }

        /* Content */
        .cs-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 64px 24px;
          max-width: 860px;
          width: 100%;
        }

        /* Eyebrow */
        .cs-eyebrow {
          display: flex;
          align-items: center;
          gap: 14px;
          font-family: var(--cs-font-body);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--cs-rust);
          margin-bottom: 36px;
        }
        .cs-marker-line {
          display: inline-block;
          width: 40px;
          height: 1px;
          background: var(--cs-rust);
          opacity: 0.6;
        }

        /* Logo */
        .cs-logo-wrap {
          display: flex;
          align-items: baseline;
          gap: 0;
          margin-bottom: 24px;
          line-height: 1;
        }
        .cs-logo-l {
          font-family: var(--cs-font-display);
          font-size: clamp(72px, 12vw, 140px);
          color: var(--cs-rust);
          line-height: 0.9;
          letter-spacing: -0.01em;
        }
        .cs-logo-rest {
          font-family: var(--cs-font-display);
          font-size: clamp(72px, 12vw, 140px);
          color: var(--cs-cream);
          line-height: 0.9;
          letter-spacing: -0.01em;
        }
        .cs-logo-se {
          font-family: var(--cs-font-display);
          font-size: clamp(32px, 5.5vw, 64px);
          color: var(--cs-cream-dim);
          line-height: 0.9;
          align-self: flex-end;
          padding-bottom: 6px;
          letter-spacing: 0.04em;
        }

        /* Industrial rule */
        .cs-rule {
          width: 100%;
          max-width: 600px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--cs-rust) 30%, var(--cs-rust) 70%, transparent);
          margin-bottom: 40px;
          transform-origin: left;
        }

        /* Headline */
        .cs-headline {
          font-family: var(--cs-font-serif);
          font-size: clamp(96px, 20vw, 220px);
          font-weight: 300;
          font-style: italic;
          color: var(--cs-cream);
          line-height: 0.82;
          letter-spacing: -0.03em;
          margin: 0 0 28px 0;
          background: linear-gradient(160deg, var(--cs-cream) 50%, rgba(240,232,216,0.55) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Sub */
        .cs-sub {
          font-family: var(--cs-font-body);
          font-size: clamp(13px, 1.8vw, 16px);
          font-weight: 300;
          color: var(--cs-cream-dim);
          letter-spacing: 0.06em;
          line-height: 2;
          margin-bottom: 52px;
          max-width: 400px;
          text-transform: uppercase;
        }

        /* City tags */
        .cs-tags {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 64px;
        }
        .cs-tag {
          font-family: var(--cs-font-body);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--cs-cream);
          border: 1px solid rgba(240,232,216,0.15);
          padding: 6px 14px;
          background: rgba(240,232,216,0.04);
        }
        .cs-tag-sep {
          font-family: var(--cs-font-display);
          font-size: 18px;
          color: var(--cs-rust);
          opacity: 0.7;
        }

        .cs-rules-btn {
          display: inline-block;
          padding: 12px 32px;
          border: 1px solid var(--cs-rust);
          color: var(--cs-rust);
          font-family: var(--cs-font-body);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          text-decoration: none;
          transition: all 0.3s ease;
          background: transparent;
          margin-bottom: 20px;
        }

        .cs-rules-btn:hover {
          background: var(--cs-rust);
          color: var(--cs-bg);
          box-shadow: 0 0 20px rgba(192, 74, 42, 0.2);
          transform: translateY(-2px);
        }

        .cs-btn-group {
          display: flex;
          gap: 16px;
          margin-top: 24px;
          margin-bottom: 20px;
        }

        /* Socials */
        .cs-socials {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }
        .cs-social-link {
          font-family: var(--cs-font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--cs-rust);
          text-decoration: none;
          transition: color 0.3s ease;
          position: relative;
        }
        .cs-social-link:hover {
          color: var(--cs-cream);
        }
        .cs-social-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 100%;
          height: 1px;
          background: var(--cs-rust);
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 0.3s ease;
        }
        .cs-social-link:hover::after {
          transform: scaleX(1);
          transform-origin: left;
        }
        .cs-social-sep {
          color: var(--cs-rust);
          opacity: 0.5;
          font-size: 10px;
        }

        /* Footer */
        .cs-footer {
          display: flex;
          align-items: center;
          gap: 14px;
          font-family: var(--cs-font-body);
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(240, 232, 216, 0.2);
        }
        .cs-footer-sep {
          color: var(--cs-rust);
          opacity: 0.5;
        }

        @media (max-width: 520px) {
          .cs-brick-band { display: none; }
          .cs-tags { flex-direction: column; gap: 10px; }
          .cs-tag-sep { display: none; }
        }
      `}</style>
    </div>
  )
}
