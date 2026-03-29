# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 |  | architecture | Monorepo structure for DeliSign project | Keep existing structure: mobile/ (Expo/RN), web/ (Next.js), supabase/ (schema), stitch/ (Figma exports) | Preserving existing multi-directory structure avoids migration risk and matches multi-agent workflow. | Yes | agent |
| D002 |  | architecture | Tech stack for DeliSign platform | Mobile: React Native 0.83 + Expo 55 + NativeWind + Zustand + TanStack Query. Web: Next.js 14 + Tailwind + Zustand + Recharts. Backend: Supabase (PostgreSQL + Auth + RLS + Storage + Realtime). | Already established in the codebase with package.json dependencies. Stack is modern and well-suited for the last-mile delivery SaaS use case. | Yes | agent |
