import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Users, Code, Crown } from 'lucide-react'

export const Route = createFileRoute('/en/team')({
  component: TeamPage,
})

function TeamPage() {
  const teamMembers = [
    {
      name: 'Nauticalis',
      role: 'Organizer',
      desc: 'Leads the vision and coordinates the Lanköping work.',
      icon: <Crown size={24} className="section-icon" />,
    },
    {
      name: 'El4s',
      role: 'Organizer',
      desc: 'Main architect behind the code and website platform.',
      icon: <Code size={24} className="section-icon" />,
    },
  ]

  return (
    <div className="rules-root">
      <div className="rules-grid" />
      <div className="rules-grain" />

      <div className="rules-container">
        <Link to="/en" className="back-button">
          <ArrowLeft size={18} />
          <span>Back</span>
        </Link>

        <header className="rules-header">
          <h1>Team</h1>
          <p>Who are we behind Lanköping?</p>
        </header>

        <div className="rules-sections">
          <section className="rules-section">
            <h2>
              <Users className="section-icon" />
              A two-person passion
            </h2>
            <p className="mb-6 opacity-80 border-b border-white/5 pb-4">
              Lanköping is built by a small but dedicated team that loves creating digital experiences.
            </p>

            <ul className="rules-list">
              {teamMembers.map((member, i) => (
                <li key={i}>
                  <div className="rule-number">{member.icon}</div>
                  <div>
                    <p style={{ color: '#C04A2A', fontWeight: 'bold', fontSize: '18px', marginBottom: '2px', fontFamily: 'Bebas Neue', letterSpacing: '0.05em' }}>
                      {member.name}
                    </p>
                    <p style={{ fontSize: '14px', color: 'rgba(240, 232, 216, 0.6)', marginBottom: '8px', textTransform: 'uppercase' }}>
                      {member.role}
                    </p>
                    <p style={{ fontSize: '15px' }}>{member.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="rules-footer">
          <p>© 2026 Lanköping.se — Built with love by el4s & nauticalis.</p>
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
        .rules-grid { position: fixed; inset: 0; background-image: linear-gradient(rgba(240,232,216,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(240,232,216,0.03) 1px, transparent 1px); background-size: 64px 64px; pointer-events: none; z-index: 1; }
        .rules-grain { position: fixed; inset: 0; pointer-events: none; opacity: 0.045; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); background-size: 180px; z-index: 2; }
        .rules-container { position: relative; z-index: 10; max-width: 900px; margin: 0 auto; }
        .back-button { display: inline-flex; align-items: center; gap: 8px; color: #C04A2A; text-decoration: none; font-weight: 500; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 40px; transition: transform 0.2s ease; }
        .back-button:hover { transform: translateX(-5px); }
        .rules-header { margin-bottom: 60px; }
        .rules-header h1 { font-family: 'Bebas Neue', sans-serif; font-size: 64px; color: #C04A2A; margin-bottom: 8px; letter-spacing: 0.02em; }
        .rules-header p { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 20px; color: rgba(240, 232, 216, 0.7); }
        .rules-sections { display: grid; gap: 60px; }
        .rules-section h2 { display: flex; align-items: center; gap: 12px; font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #F0E8D8; margin-bottom: 30px; border-bottom: 1px solid rgba(192, 74, 42, 0.3); padding-bottom: 12px; }
        .section-icon { color: #C04A2A; }
        .rules-list { list-style: none; padding: 0; display: grid; gap: 20px; }
        .rules-list li { display: flex; gap: 16px; align-items: flex-start; background: rgba(192, 74, 42, 0.03); padding: 24px; border-left: 2px solid transparent; transition: all 0.2s ease; }
        .rules-list li:hover { background: rgba(192, 74, 42, 0.07); border-left: 2px solid #C04A2A; transform: translateX(5px); }
        .rule-number { background: transparent; color: #C04A2A; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .rules-footer { margin-top: 80px; text-align: center; padding-bottom: 40px; font-size: 14px; color: rgba(240, 232, 216, 0.4); }
        .mb-6 { margin-bottom: 1.5rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
      `}</style>
    </div>
  )
}
