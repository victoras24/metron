# .NET server, TypeScript clients

The Server (API, ingestion, background jobs) is ASP.NET Core orchestrated with .NET Aspire; the Dashboard is Vite + React + TypeScript + TanStack; the Claude Code plugin must be TypeScript. This matches the Team's existing stack (C#/.NET backend, React/TS frontend) so colleagues can maintain it. TS types are generated from the Server's OpenAPI spec to keep both languages in sync. Next.js rejected: no SEO/SSR need behind a login, and it would duplicate the backend.
