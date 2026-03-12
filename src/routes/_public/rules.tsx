import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ShieldAlert, MessageSquareText } from 'lucide-react'

export const Route = createFileRoute('/_public/rules')({
  component: RulesPage,
})

function RulesPage() {
  const eventRules = [
    'Ingen alkohol eller droger. Det är inte tillåtet att ta med, använda eller sälja droger eller andra berusningsmedel under eventet.',
    'Nolltolerans mot trakasserier. Inget hat, hot, diskriminering, mobbning eller sexuella trakasserier. Respektera allas gränser.',
    'Var schysst och visa hänsyn. Håll en trevlig ton, både på plats och online (till exempel i Discord).',
    'Följ arrangörernas instruktioner. Om en arrangör säger till, så gäller det direkt.',
    'Ta hand om lokalen. Ingen skadegörelse. Håll rent efter dig och använd soptunnor.',
    'Respektera andras utrustning. Rör inte andras datorer, skärmar eller kablar utan att fråga.',
    'Säkerhet först. Håll gångar och nödutgångar fria. Dra kablar så att ingen snubblar.',
    'Ljudnivå. Använd hörlurar vid spel. Högtalare endast om arrangörerna godkänner det.',
    'Foto och film. Fråga innan du fotar eller filmar någon. Respektera om någon säger nej.',
    'Konsekvenser. Vid regelbrott kan du få varning, bli avstängd från eventet och vid allvarliga incidenter kan polis kontaktas.',
  ]

  const discordRules = [
    'Samma regler som på plats. Nolltolerans mot trakasserier, hat, hot och diskriminering.',
    'Håll dig till rätt kanal. Skriv i rätt textkanal och håll röstsamtal i rätt voice.',
    'Inga spoilers eller NSFW. Inget sexuellt innehåll, gore eller annat olämpligt material.',
    'Ingen spam. Inga mass-pings, flood, soundboards på max, eller upprepade memes som stör.',
    'Ingen reklam utan OK. Ingen reklam för servrar, streams eller produkter utan att arrangörerna sagt ja.',
    'Respektera integritet. Dela inte personuppgifter, IP-adresser, doxxing eller privata chattar.',
    'Ticket/roller = inga genvägar. Försök inte kringgå roller eller åtkomst. Missbruk kan leda till avstängning.',
    'Mod-teamet har sista ordet. Moddar kan ta bort innehåll, mute:a eller kicka/ban:a vid behov.',
  ]

  return (
    <div className="rules-root">
      <div className="rules-grid" />
      <div className="rules-grain" />

      <div className="rules-container">
        <Link to="/" className="back-button">
          <ArrowLeft size={18} />
          <span>Tillbaka</span>
        </Link>

        <header className="rules-header">
          <h1>Regler & Riktlinjer</h1>
          <p>För allas trivsel och säkerhet under Lanköping.se</p>
        </header>

        <div className="rules-sections">
          <section className="rules-section">
            <h2>
              <ShieldAlert className="section-icon" />
              Event Regler
            </h2>
            <ul className="rules-list">
              {eventRules.map((rule, i) => (
                <li key={i}>
                  <span className="rule-number">{i + 1}</span>
                  <p>{rule}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rules-section">
            <h2>
              <MessageSquareText className="section-icon" />
              Discord Regler
            </h2>
            <ul className="rules-list">
              {discordRules.map((rule, i) => (
                <li key={i}>
                  <span className="rule-number">{i + 1}</span>
                  <p>{rule}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="rules-footer">
          <p>© 2025 Lanköping.se — Vi ses på eventet!</p>
        </footer>
      </div>

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
