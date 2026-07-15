# Picom email system

Picom uses Supabase Auth custom SMTP for authentication mail and a separate durable PostgreSQL queue plus Ubuntu SMTP worker for transactional product mail. Both paths use **Picom <info@picom.gg>**. Renderer components never receive SMTP credentials.

See [Final production readiness](./email/FINAL_EMAIL_PRODUCTION_READINESS.md) and [Ubuntu deployment](./email/UBUNTU_EMAIL_DEPLOYMENT.md). Current status is **No-Go** until live SMTP, DNS alignment, Supabase Auth, worker deployment, and deliverability evidence pass.
