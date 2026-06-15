# 🔒 Security & Authorization Spec

## 🛡️ Database Access & Row Level Security (RLS)
- **RLS Enabled:** All tables in Neon PostgreSQL are protected under RLS policies.
- **Anonymous Access:** Read-only access to active clues for current calendar day.
- **Audit Logs:** Schema modifications and write operations require super-admin scopes.

---

## 🚫 Abuse & Bot Mitigation
- **Rate Limiting:** Capped at 30 requests per minute per IP for guess submissions.
- **Bot Detection:** Cloudflare Turnstile protection for new user registrations and global leaderboard submissions.
- **Input Sanitization:** Regex-based validation on all incoming query inputs to protect against SQL injections.
