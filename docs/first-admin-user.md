# First Admin User Setup (Empty DB)

This project no longer auto-creates demo users. If your database is empty, create the first admin user manually.

## When to use this

Use this guide when:
- A new environment has no users
- Login returns `User not found`
- You want full control and zero seeded/demo data

## Important note about passwords

Current login logic compares `password_hash` as plain text (`passwordHash === input`).
So the value you insert in `password_hash` must be the exact password you plan to type on the login page.

## Option 1: Create first admin with SQL (recommended)

Run this against the same database used by `DATABASE_URL`:

```sql
INSERT INTO users (email, password_hash, name, role, active)
VALUES ('admin@example.com', 'ChangeMeNow-StrongPass123!', 'First Admin', 'organizer', true);
```

If your SQL client requires explicit schema:

```sql
INSERT INTO public.users (email, password_hash, name, role, active)
VALUES ('admin@example.com', 'ChangeMeNow-StrongPass123!', 'First Admin', 'organizer', true);
```

## Option 2: Verify before creating (avoid duplicates)

```sql
SELECT id, email, role, active FROM users ORDER BY id;
```

If `admin@example.com` already exists, update instead:

```sql
UPDATE users
SET password_hash = 'ChangeMeNow-StrongPass123!', role = 'organizer', active = true
WHERE email = 'admin@example.com';
```

## Login after setup

1. Open `/login`
2. Email: `admin@example.com`
3. Password: `ChangeMeNow-StrongPass123!`

## Production safety checklist

- Never keep default/example credentials
- Use a long unique password
- Restrict DB write access to trusted operators
- Keep demo-user auto-seeding disabled

## Future hardening (recommended)

- Replace plain-text password storage with real hashing (e.g. bcrypt/argon2)
- Add a one-time first-user setup flow guarded by env flag
- Add audit logging for bootstrap user creation
