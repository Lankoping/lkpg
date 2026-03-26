-- Seed script to populate CMS tables with existing content

-- Insert hero content
INSERT INTO hero_content (eyebrow, headline, tagline, description, primary_button_text, primary_button_link, secondary_button_text, secondary_button_link)
VALUES (
  'Välkommen till',
  'Gothenburg LAN',
  'En community-driven LAN party i Göteborg',
  'Slå dig ihop med hundratals andra gamers för en oförglömlig helg fylld av gaming, tävlingar och nya vänner.',
  'Gå med idag',
  '#signup',
  'Läs mer',
  '/om-oss'
)
ON CONFLICT DO NOTHING;

-- Insert info sections
INSERT INTO info_sections (slug, icon, title, description, sort_order, is_active)
VALUES
  ('location', 'map-pin', 'Fantastisk Plats', 'Vi arrangerar LAN-eventen på en dedikerad venue i hjärtat av Göteborg med snabb internet och modern utrustning.', 0, true),
  ('community', 'users', 'Stark Community', 'Är du ny eller veteran? Vår community välkomnar alla nivåer av gamers för en inkluderande och rolig miljö.', 1, true),
  ('lan-party', 'gamepad2', 'Episka LAN-evenemang', 'Från casual gaming till tävlingar, turnéringar och speciella events – det finns något för alla på våra LAN-parties.', 2, true)
ON CONFLICT DO NOTHING;

-- Insert team members
INSERT INTO team_members (name, role, description, icon, sort_order, is_active)
VALUES
  ('Alexander Svensson', 'Grundare & Organisatör', 'Alex grundade Gothenburg LAN 2015 med en passion för gaming och community-building.', 'user', 0, true),
  ('Emma Bergström', 'Eventansvarig', 'Emma säkerställer att varje event är perfekt genomfört med fokus på deltagararnas upplevelse.', 'user', 1, true),
  ('Martin Persson', 'Teknisk Ledare', 'Martin hanterar all teknisk infrastruktur för att garantera en problemfri LAN-upplevelse.', 'user', 2, true),
  ('Sofia Lundqvist', 'Community Manager', 'Sofia bygger och underhåller vår växande community genom engagemang och support.', 'user', 3, true)
ON CONFLICT DO NOTHING;

-- Insert navigation items
INSERT INTO navigation_items (label, href, sort_order, is_active)
VALUES
  ('Hem', '/', 0, true),
  ('Om Oss', '/om-oss', 1, true),
  ('Regler', '/regler', 2, true),
  ('Integritet', '/integritet', 3, true)
ON CONFLICT DO NOTHING;

-- Insert rules page content
INSERT INTO pages (slug, title, subtitle, content, is_published)
VALUES (
  'regler',
  'Regler & Riktlinjer',
  'Se våra regler för en säker och rolig LAN-miljö',
  '[
    {"type": "heading", "title": "Allmänna Regler"},
    {"type": "paragraph", "content": "Vid Gothenburg LAN förväntar vi oss att alla deltagare beter sig respektfullt och ansvarsfult."},
    {"type": "list", "items": ["Ingen mobbning eller trakasserier är tolererat", "Respektera andras egendom", "Följ instruktioner från Event Staffs", "Inget otillåtet innehål eller aktiviteter"]},
    {"type": "heading", "title": "Discord Regler"},
    {"type": "paragraph", "content": "Vår Discord-server är ett samlingspunkt för communityn. Vi förväntar oss samma respekt och god uppförande här."},
    {"type": "list", "items": ["Var artig och respektfull", "Inget spam eller skräppostning", "Håll diskussioner relevant till kanalen", "Rapportera regelöverträdelser till moderatorer"]}
  ]'::json,
  true
)
ON CONFLICT DO NOTHING;

-- Insert privacy page content
INSERT INTO pages (slug, title, subtitle, content, is_published)
VALUES (
  'integritet',
  'Sekretesspolicy',
  'Vi tar din integritet på allvar',
  '[
    {"type": "heading", "title": "Datainsamling"},
    {"type": "paragraph", "content": "Gothenburg LAN samlar in begränsad personlig information endast för att kunna arrangera eventen och kommunicera med deltagarna."},
    {"type": "heading", "title": "Din Data"},
    {"type": "paragraph", "content": "Vi delar aldrig din information med tredje part utan ditt uttryckliga samtycke. Din data är säker hos oss och vi använder industristandardskydd."},
    {"type": "heading", "title": "Kontakta Oss"},
    {"type": "paragraph", "content": "Har du frågor om hur vi hanterar din data? Kontakta oss via vår Discord-server eller skicka ett mejl."}
  ]'::json,
  true
)
ON CONFLICT DO NOTHING;
