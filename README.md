Lan Foundary is a web-based system for LAN communities and nonprofits. It manages tickets, members, events, funding requests, and sponsor applications without depending on unnecessary external services.

## Environment variables
- `DATABASE_URL` is required.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` are required for email delivery.
- `OPENROUTER_API_KEY` enables the AI support first responder for hosted support tickets.

## First admin on an empty database
- No demo user is created automatically.
- Follow [docs/first-admin-user.md](docs/first-admin-user.md) to create the first admin account manually.

## Key features
Lan Foundary provides the core operational tools needed to run LAN communities:
- Ticket handling for events and check-ins.
- Member and staff management.
- Event planning for LAN hosts and organizers.
- Funding applications and sponsor/perk approval workflows.

## Future work
- Expand the host dashboard with richer funding and perk tracking.
- Add stronger organization-level isolation for multi-tenant deployments.

If you want to discuss licensing or deployment, contact elias@lankoping.se.
