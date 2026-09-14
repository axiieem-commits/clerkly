# Clerkly

Clerkly is an anonymous clinical learning casebook for medical students. It uses plain HTML/CSS/JavaScript for the interface, Express for the API, Supabase for accounts/database/private image storage, and is ready for Vercel.

## Which file controls what?

```text
public/
├── login.html       → Supabase email sign-up and sign-in page
├── reset-password.html → Password recovery page opened from Supabase email
├── index.html       → Dashboard after sign-in
├── cases.html       → Casebook details, edit and delete actions
├── add-case.html    → Structured clerking form for adding/updating a case
├── library.html     → Clinical learning reference page
├── progress.html    → Learning statistics and review queue
├── profile.html     → Profile picture and student detail management
├── vendor/          → Local browser image-compression files
├── Style.css        → Appearance of every page
└── main.js          → Browser interactions and API calls

server.js            → Express authentication, cases, images and AI API
db.js                → Creates authenticated Supabase clients
supabase/migrations/
├── 001_clerkly_schema.sql → Original case database, RLS and Storage setup
└── 002_profiles_and_system_review.sql → Profiles and structured review upgrade
.env.example         → Safe example of required environment variables
package.json         → Packages and start commands
DEPLOYMENT.md        → GitHub, Supabase and Vercel walkthrough
```

## Local setup

1. Create a Supabase project.
2. Run every SQL file in `supabase/migrations` in number order in the SQL Editor.
3. Copy `.env.example` to `.env` and enter your Supabase Project URL and publishable key.
4. Optionally add `GEMINI_API_KEY` for flexible AI responses.
5. Run `npm install`.
6. Run `npm run dev`.
7. Open `http://localhost:3000`.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete beginner-friendly deployment process.

## Security and patient privacy

- Every API route for cases requires a Supabase account session.
- Authentication tokens are kept in HTTP-only, same-site cookies. “Remember me” keeps them for up to 20 days; otherwise they are browser-session cookies.
- Database Row Level Security limits users to their own cases.
- Case and profile images are compressed in the browser, then stored in private buckets with expiring signed links.
- The server rejects several common direct-identifier labels.
- Printed clerking sheets contain a blank name line for handwriting only; Clerkly never collects or stores that name.
- Never store patient names, registration numbers, dates of birth, addresses, contact details, exact dates or identifiable photographs.

Clerkly is a learning notebook, not an electronic health record or a substitute for clinical supervision.
