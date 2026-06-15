# 📁 Folder & Directory Architecture

```
threadly/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── page.tsx          # Landing/Home
│       │   ├── daily/            # Core Gameplay Screen
│       │   ├── archive/          # Archive Dashboard
│       │   ├── leaderboard/      # Leaderboards View
│       │   ├── profile/          # User Stats & Customizations
│       │   ├── admin/            # Moderator Portal
│       │   └── api/              # Route handlers / API Gateway
│       ├── components/
│       │   ├── puzzle/           # ClueCard, GuessForm, ResultsCard
│       │   ├── stats/            # StatsModal, ScoreChart
│       │   ├── shared/           # Buttons, Loaders, Layouts
│       │   └── layout/           # Navbar, Footer
│       ├── hooks/                # Custom React Hooks
│       ├── lib/                  # Shared utility libraries (e.g. Neon connection)
│       └── types/                # Typescript typings
├── prisma/ (or database schemas/)                     # Next.js Backend (with Neon PostgreSQL)/Neon config & migrations
├── docs/                         # Spec documentation
└── tests/                        # Playwright and Vitest files
```
