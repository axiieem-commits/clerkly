# Clerkly

Clerkly is an anonymous clinical learning casebook for medical students. It uses plain HTML/CSS/JavaScript for the interface, Express for the API, Supabase for accounts/database/private image storage, and is ready for Vercel.

## Which file controls what?

```text
public/
├── login.html       → Supabase email sign-up and sign-in page
├── index.html       → Dashboard after sign-in
├── cases.html       → Casebook details, edit and delete actions
├── add-case.html    → Structured clerking form for adding/updating a case
├── library.html     → Clinical learning reference page
├── progress.html    → Learning statistics and review queue
├── Style.css        → Appearance of every page
└── main.js          → Browser interactions and API calls

server.js            → Express authentication, cases, images and AI API
db.js                → Creates authenticated Supabase clients
supabase/migrations/
└── 001_clerkly_schema.sql → Database, RLS and private Storage setup
.env.example         → Safe example of required environment variables
package.json         → Packages and start commands
DEPLOYMENT.md        → GitHub, Supabase and Vercel walkthrough
```

## Local setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_clerkly_schema.sql` in its SQL Editor.
3. Copy `.env.example` to `.env` and enter your Supabase Project URL and publishable key.
4. Optionally add `GEMINI_API_KEY` for flexible AI responses.
5. Run `npm install`.
6. Run `npm run dev`.
7. Open `http://localhost:3000`.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete beginner-friendly deployment process.

## Security and patient privacy

- Every API route for cases requires a Supabase account session.
- Authentication tokens are kept in HTTP-only, same-site cookies.
- Database Row Level Security limits users to their own cases.
- Case images use a private Storage bucket and expiring signed links.
- The server rejects several common direct-identifier labels.
- Never store patient names, registration numbers, dates of birth, addresses, contact details, exact dates or identifiable photographs.

Clerkly is a learning notebook, not an electronic health record or a substitute for clinical supervision.
