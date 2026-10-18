# Hosting: laptop, then Azure free account, then portable exit

Nobody funds the pilot, so cost is the driver. v0.1 runs on the author's laptop. The Team pilot runs on an Azure free account (12 months: Postgres Flexible Server B1ms + 32 GB, Container Apps monthly free grant, Static Web Apps free) with a $5 budget alert. After 12 months: company-funded if the pilot succeeded, else move to a ~€4–5/month VPS (Hetzner). Everything is standard containers + standard Postgres so the move is a config change.

## Considered Options

- Supabase / Neon free: 0.5 GB storage, fills in weeks; Supabase pauses after 7 idle days.
- Oracle Always Free: free forever but allowance silently cut in June 2026, idle reclamation, capacity errors. Too unreliable for a Team tool.
- Google Cloud e2-micro: 1 GB RAM, too small for Postgres + .NET + OTel Collector.
- AWS free plan: credits for 6 months, then the account closes.
- Hetzner from day one: cheapest paid option, kept as the exit.

## Consequences

The pilot holds Team Prompts in a personal cloud account; requires the Team lead's approval.
