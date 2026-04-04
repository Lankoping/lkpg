# First Admin User Setup (Empty DB)

This project no longer auto-creates demo users. If your database is empty, create the first admin user manually.

## When to use this

Use this guide when:
- A new environment has no users
- Login returns `User not found`
- You want full control and zero seeded/demo data

## Important note about passwords

Password encryption is enabled.
`password_hash` must contain a generated hash, not plain text.

Generate hash from a password:

```bash
node -e "const { randomBytes, scryptSync } = require('node:crypto'); const pwd='ChangeMeNow-StrongPass123!'; const N=16384,r=8,p=1,k=64; const salt=randomBytes(16).toString('base64'); const maxmem=Math.max(128*N*r+k,64*1024*1024); const digest=scryptSync(pwd,salt,k,{N,r,p,maxmem}).toString('base64'); console.log(`scrypt$${N}$${r}$${p}$${salt}$${digest}`);"
```

Copy the output and use it as `password_hash`.

## Option 1: Create the first admin with SQL (recommended)

Run this against the same database used by `DATABASE_URL`:

```sql
INSERT INTO users (email, password_hash, name, role, active)
VALUES ('admin@example.com', '<PASTE_HASH_HERE>', 'First Admin', 'organizer', true);
```

If your SQL client requires explicit schema:

```sql
INSERT INTO public.users (email, password_hash, name, role, active)
VALUES ('admin@example.com', '<PASTE_HASH_HERE>', 'First Admin', 'organizer', true);
```

## Option 2: Verify before creating (avoid duplicates)

```sql
SELECT id, email, role, active FROM users ORDER BY id;
```

If `admin@example.com` already exists, update instead:

```sql
UPDATE users
SET password_hash = '<PASTE_HASH_HERE>', role = 'organizer', active = true
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

- Add a one-time first-user setup flow guarded by env flag
- Add audit logging for bootstrap user creation
