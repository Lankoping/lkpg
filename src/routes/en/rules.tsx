import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ArrowLeft, ShieldAlert, MessageSquareText } from 'lucide-react'

export const Route = createFileRoute('/en/rules')({
  component: RulesPage,
})

function RulesPage() {
  const eventRules = [
    'No alcohol or drugs. Bringing, using, or selling narcotics or intoxicants during the event is not allowed.',
    'Zero tolerance for harassment. No hate, threats, discrimination, bullying, or sexual harassment. Respect personal boundaries.',
    'Be kind and considerate. Keep a good tone both on-site and online (for example in Discord).',
    'Follow organizer instructions. If an organizer gives instructions, they apply immediately.',
    'Take care of the venue. No vandalism. Keep your area clean and use trash bins.',
    'Respect other people\'s equipment. Do not touch other setups without permission.',
    'Safety first. Keep aisles and emergency exits clear. Route cables safely.',
    'Sound levels. Use headphones while gaming. Speakers only with organizer approval.',
    'Photo and video. Ask before filming or photographing others. Respect a no.',
    'Consequences. Rule violations can lead to warnings, suspension, or contact with police in serious incidents.',
  ]

  const discordRules = [
    'Same rules as on-site. Zero tolerance for harassment, hate, threats, and discrimination.',
    'Use the right channel. Keep messages and voice chat in the correct channels.',
    'No spoilers or NSFW. No sexual content, gore, or other inappropriate material.',
    'No spam. No mass pings, flooding, disruptive soundboard usage, or repeated disruptive memes.',
    'No advertising without approval. Do not promote servers, streams, or products unless approved.',
    'Respect privacy. Do not share personal data, IP addresses, doxxing, or private chats.',
    'No ticket/role bypassing. Attempts to bypass access controls can lead to suspension.',
    'Moderators have final say. The mod team may remove content, mute, kick, or ban when needed.',
  ]

  return (
    <div className="rules-root">
      <div className="rules-grid" />
      <div className="rules-grain" />

      <motion.div
        className="rules-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Link to="/en" className="back-button">
          <ArrowLeft size={18} />
          <span>Back</span>
        </Link>

        <header className="rules-header">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            Rules & Guidelines
          </motion.h1>
          <p>For everyone\'s comfort and safety at Lanköping.se</p>
        </header>

        <div className="rules-sections">
          <motion.section
            className="rules-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2>
              <ShieldAlert className="section-icon" />
              Event Rules
            </h2>
            <ul className="rules-list">
              {eventRules.map((rule, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                >
                  <span className="rule-number">{i + 1}</span>
                  <p>{rule}</p>
                </motion.li>
              ))}
            </ul>
          </motion.section>

          <motion.section
            className="rules-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2>
              <MessageSquareText className="section-icon" />
              Discord Rules
            </h2>
            <ul className="rules-list">
              {discordRules.map((rule, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                >
                  <span className="rule-number">{i + 1}</span>
                  <p>{rule}</p>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        </div>

        <footer className="rules-footer">
          <p>© 2026 Lanköping.se — See you at the event.</p>
        </footer>
      </motion.div>

      <style>{`
        .rules-root {
          position: relative;
          min-height: 100vh;
          width: 100%;
          background: #100E0C;
          color: #F0E8D8;
          font-family: 'DM Sans', sans-serif;
          padding: 40px 20px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .rules-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(240,232,216,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(240,232,216,0.03) 1px, transparent 1px);
          background-size: 64px 64px;
          pointer-events: none;
          z-index: 1;
        }

        .rules-grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.045;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 180px;
          z-index: 2;
        }

        .rules-container {
          position: relative;
          z-index: 10;
          max-width: 900px;
          margin: 0 auto;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #C04A2A;
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 40px;
          transition: transform 0.2s ease;
        }

        .back-button:hover {
          transform: translateX(-5px);
        }

        .rules-header {
          margin-bottom: 60px;
        }

        .rules-header h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 64px;
          color: #C04A2A;
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }

        .rules-header p {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-size: 20px;
          color: rgba(240, 232, 216, 0.7);
        }

        .rules-sections {
          display: grid;
          gap: 60px;
        }

        .rules-section h2 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 32px;
          color: #F0E8D8;
          margin-bottom: 30px;
          border-bottom: 1px solid rgba(192, 74, 42, 0.3);
          padding-bottom: 12px;
        }

        .section-icon {
          color: #C04A2A;
        }

        .rules-list {
          list-style: none;
          padding: 0;
          display: grid;
          gap: 20px;
        }

        .rules-list li {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          background: rgba(192, 74, 42, 0.03);
          padding: 16px;
          border-left: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .rules-list li:hover {
          background: rgba(192, 74, 42, 0.07);
          border-left: 2px solid #C04A2A;
          transform: translateX(5px);
        }

        .rule-number {
          background: #C04A2A;
          color: #100E0C;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .rules-list p {
          margin: 0;
          line-height: 1.6;
          font-size: 16px;
          color: rgba(240, 232, 216, 0.9);
        }

        .rules-footer {
          margin-top: 80px;
          text-align: center;
          padding-bottom: 40px;
          font-size: 14px;
          color: rgba(240, 232, 216, 0.4);
        }

        @media (max-width: 640px) {
          .rules-header h1 { font-size: 48px; }
          .rules-section h2 { font-size: 28px; }
        }
      `}</style>
    </div>
  )
}
