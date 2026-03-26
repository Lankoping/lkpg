-- CMS Tables Migration
-- Creates tables for managing site content dynamically

-- Site Settings (key-value store for global config)
CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Hero Content (homepage hero section)
CREATE TABLE IF NOT EXISTS hero_content (
  id SERIAL PRIMARY KEY,
  eyebrow TEXT NOT NULL,
  eyebrow_en TEXT,
  headline TEXT NOT NULL,
  headline_en TEXT,
  tagline TEXT NOT NULL,
  tagline_en TEXT,
  description TEXT NOT NULL,
  description_en TEXT,
  primary_button_text TEXT NOT NULL,
  primary_button_text_en TEXT,
  primary_button_link TEXT NOT NULL,
  secondary_button_text TEXT,
  secondary_button_text_en TEXT,
  secondary_button_link TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Info Sections (feature boxes on homepage)
CREATE TABLE IF NOT EXISTS info_sections (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT NOT NULL,
  description_en TEXT,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  role_en TEXT,
  description TEXT NOT NULL,
  description_en TEXT,
  icon TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Pages (rules, privacy, discord-rules, etc.)
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_en TEXT,
  subtitle TEXT,
  subtitle_en TEXT,
  content JSONB NOT NULL,
  content_en JSONB,
  is_published BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Navigation Items
CREATE TABLE IF NOT EXISTS navigation_items (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  label_en TEXT,
  href TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  parent_id INTEGER REFERENCES navigation_items(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_info_sections_sort ON info_sections(sort_order);
CREATE INDEX IF NOT EXISTS idx_team_members_sort ON team_members(sort_order);
CREATE INDEX IF NOT EXISTS idx_navigation_items_sort ON navigation_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
