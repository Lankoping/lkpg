-- Clean up existing CMS data and re-seed with correct Lanköping content

-- Delete existing data
DELETE FROM hero_content;
DELETE FROM info_sections;
DELETE FROM team_members;
DELETE FROM pages;

-- Insert hero content with English translations
INSERT INTO hero_content (eyebrow, eyebrow_en, headline, headline_en, tagline, tagline_en, description, description_en, primary_button_text, primary_button_text_en, primary_button_link, secondary_button_text, secondary_button_text_en, secondary_button_link)
VALUES (
  'LAN-Event i Norrkoping',
  'LAN Event in Norrkoping',
  'Lanköping',
  'Lanköping',
  'Gaming Community',
  'Gaming Community',
  'Vi bygger en gemenskap för gamers i Ostergotland. Snart öppnar vi dörrar till vårt första event.',
  'We are building a community for gamers in Ostergotland. Soon we open doors to our first event.',
  'Gå med i Discord',
  'Join Discord',
  'https://discord.gg/h8wuaqyBwT',
  'YouTube',
  'YouTube',
  'https://www.youtube.com/@LANKPNG'
);

-- Insert info sections with English translations
INSERT INTO info_sections (slug, icon, title, title_en, description, description_en, sort_order, is_active)
VALUES
  ('location', 'map-pin', 'Norrkoping', 'Norrkoping', 
   'Vårt första event kommer att hållas i Norrkoping, Ostergotland med modern utrustning och snabbt internet.', 
   'Our first event will be held in Norrkoping, Ostergotland with modern equipment and fast internet.', 
   0, true),
  ('community', 'users', 'Gemenskap', 'Community',
   'En plats för gamers att träffas, tävla och ha kul tillsammans i en inkluderande miljö.', 
   'A place for gamers to meet, compete and have fun together in an inclusive environment.', 
   1, true),
  ('lan-party', 'gamepad2', 'LAN-Party', 'LAN Party',
   'Ta med din dator och njut av en helg fylld med gaming, tävlingar och nya vänner.', 
   'Bring your computer and enjoy a weekend full of gaming, competitions and new friends.', 
   2, true);

-- Insert team members with English translations
INSERT INTO team_members (name, role, role_en, description, description_en, icon, sort_order, is_active)
VALUES
  ('Alexander Svensson', 'Grundare & Organisatör', 'Founder & Organizer', 
   'Alex grundade Lanköping LAN med en passion för gaming och community-building.', 
   'Alex founded Lanköping LAN with a passion for gaming and community building.', 
   'crown', 0, true),
  ('Emma Bergström', 'Eventansvarig', 'Event Manager', 
   'Emma säkerställer att varje event är perfekt genomfört med fokus på deltagararnas upplevelse.', 
   'Emma ensures that every event is perfectly executed with focus on participants experience.', 
   'user', 1, true),
  ('Martin Persson', 'Teknisk Ledare', 'Technical Lead', 
   'Martin hanterar all teknisk infrastruktur för att garantera en problemfri LAN-upplevelse.', 
   'Martin handles all technical infrastructure to ensure a problem-free LAN experience.', 
   'code', 2, true),
  ('Sofia Lundqvist', 'Community Manager', 'Community Manager', 
   'Sofia bygger och underhåller vår växande community genom engagemang och support.', 
   'Sofia builds and maintains our growing community through engagement and support.', 
   'heart', 3, true);

-- Insert pages with English translations
INSERT INTO pages (slug, title, title_en, subtitle, subtitle_en, content, content_en, is_published)
VALUES (
  'regler',
  'Regler & Riktlinjer',
  'Rules & Guidelines',
  'Se våra regler för en säker och rolig LAN-miljö',
  'See our rules for a safe and fun LAN environment',
  '[
    {"type": "heading", "title": "Allmänna Regler"},
    {"type": "paragraph", "content": "Vid Lanköping LAN förväntar vi oss att alla deltagare beter sig respektfullt och ansvarsfult."},
    {"type": "list", "items": ["Ingen mobbning eller trakasserier är tolererat", "Respektera andras egendom", "Följ instruktioner från Event Staffs", "Inget otillåtet innehål eller aktiviteter"]},
    {"type": "heading", "title": "Discord Regler"},
    {"type": "paragraph", "content": "Vår Discord-server är ett samlingspunkt för communityn. Vi förväntar oss samma respekt och god uppförande här."},
    {"type": "list", "items": ["Var artig och respektfull", "Inget spam eller skräppostning", "Håll diskussioner relevant till kanalen", "Rapportera regelöverträdelser till moderatorer"]}
  ]'::json,
  '[
    {"type": "heading", "title": "General Rules"},
    {"type": "paragraph", "content": "At Lanköping LAN we expect all participants to behave respectfully and responsibly."},
    {"type": "list", "items": ["No bullying or harassment is tolerated", "Respect others property", "Follow instructions from Event Staff", "No illegal content or activities"]},
    {"type": "heading", "title": "Discord Rules"},
    {"type": "paragraph", "content": "Our Discord server is a meeting point for the community. We expect the same respect and good conduct here."},
    {"type": "list", "items": ["Be polite and respectful", "No spam or flooding", "Keep discussions relevant to the channel", "Report rule violations to moderators"]}
  ]'::json,
  true
),
(
  'integritet',
  'Sekretesspolicy',
  'Privacy Policy',
  'Vi tar din integritet på allvar',
  'We take your privacy seriously',
  '[
    {"type": "heading", "title": "Datainsamling"},
    {"type": "paragraph", "content": "Lanköping LAN samlar in begränsad personlig information endast för att kunna arrangera eventen och kommunicera med deltagarna."},
    {"type": "heading", "title": "Din Data"},
    {"type": "paragraph", "content": "Vi delar aldrig din information med tredje part utan ditt uttryckliga samtycke. Din data är säker hos oss och vi använder industristandardskydd."},
    {"type": "heading", "title": "Kontakta Oss"},
    {"type": "paragraph", "content": "Har du frågor om hur vi hanterar din data? Kontakta oss via vår Discord-server eller skicka ett mejl."}
  ]'::json,
  '[
    {"type": "heading", "title": "Data Collection"},
    {"type": "paragraph", "content": "Lanköping LAN collects limited personal information only to arrange events and communicate with participants."},
    {"type": "heading", "title": "Your Data"},
    {"type": "paragraph", "content": "We never share your information with third parties without your explicit consent. Your data is safe with us and we use industry standard protection."},
    {"type": "heading", "title": "Contact Us"},
    {"type": "paragraph", "content": "Do you have questions about how we handle your data? Contact us via our Discord server or send an email."}
  ]'::json,
  true
);
