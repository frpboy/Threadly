# 🚀 Deployment Guide

### Vercel Integration
1. Connect target repository to Vercel workspace.
2. Configure Environment Variables in Project Settings:
   - `DATABASE_URL` (Neon PostgreSQL)
   - `NEXTAUTH_SECRET` (JWT Token encoder secret)
3. Deploy branch hooks on `main` push.
