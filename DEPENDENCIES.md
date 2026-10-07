# Dependencies

No product dependency was added beyond the generated Sites starter. The implementation intentionally uses the platform `fetch`, Web Speech, Web Share, Service Worker, and session storage APIs to keep the surface small.

| Package | Purpose | License |
| --- | --- | --- |
| Next.js / React | Application and UI runtime | MIT |
| vinext / Vite | Cloudflare-compatible build pipeline | MIT |
| Tailwind CSS | Starter CSS processing (`@import` only) | MIT |
| Wrangler / Cloudflare Vite plugin | Local Worker runtime and deployment bundle | MIT / Apache-2.0 |
| Drizzle | Starter database capability; not used for resident data | Apache-2.0 |

Resident profiles are not written to a database. The Drizzle starter files remain only for hosting compatibility and can be removed if the platform template no longer requires them.
