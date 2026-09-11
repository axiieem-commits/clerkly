# Deploy Clerkly with GitHub, Supabase and Vercel

Follow these sections in order. You only need the Supabase **Project URL** and **publishable key**. Never place a Supabase secret key or Gemini key in GitHub.

## 1. Create the Supabase backend

1. Go to [Supabase](https://supabase.com/dashboard) and select **New project**.
2. Choose an organization, project name, region and strong database password.
3. Wait for the project to finish preparing.
4. Open **SQL Editor** and select **New query**.
5. Open `supabase/migrations/001_clerkly_schema.sql` from this project, copy the whole file into the SQL Editor, and select **Run**.
6. Open `supabase/migrations/002_profiles_and_system_review.sql`, copy the whole file into a new query, and select **Run**.
7. The scripts create:
   - the `clinical_cases` table;
   - the private student `profiles` table;
   - owner-only Row Level Security policies; and
   - private `case-images` and `profile-images` Storage buckets.
8. Open **Authentication → Providers → Email** and keep Email enabled. Email confirmation is recommended for the deployed site.
9. Open the project's **Connect** dialog or **Settings → API Keys** and copy:
   - Project URL → `SUPABASE_URL`
   - Publishable key beginning with `sb_publishable_` → `SUPABASE_PUBLISHABLE_KEY`

Do not use a secret key in the browser or commit one to Git. Clerkly does not require a secret key because its database and Storage requests use each signed-in user's token plus Row Level Security.

## 2. Test Supabase locally

In the Visual Studio Code terminal, make sure you are inside the Clerkly project. Then run:

```bash
cp .env.example .env
```

Open `.env` and replace the example values:

```env
PORT=3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
GEMINI_API_KEY=
APP_URL=http://localhost:3000
```

The Gemini key is optional. Leave its value empty if you do not have one.

Start the website:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Create an account, confirm the email if Supabase asks you to, sign in, and test creating, editing and deleting one anonymous case.

## 3. Push the project to GitHub

1. Sign in to [GitHub](https://github.com).
2. Create a **new empty repository** named `clerkly`. Do not add another README or `.gitignore` on GitHub.
3. In the Visual Studio Code terminal, run:

```bash
git status
git add .
git commit -m "Prepare Clerkly for Supabase and Vercel"
git remote add origin https://github.com/YOUR-USERNAME/clerkly.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. If Git says that `origin` already exists, check it with `git remote -v` and use this instead:

```bash
git remote set-url origin https://github.com/YOUR-USERNAME/clerkly.git
git push -u origin main
```

Before pushing, confirm `.env` is not listed by `git status`. It is intentionally excluded by `.gitignore`.

## 4. Deploy the GitHub repository on Vercel

1. Sign in to [Vercel](https://vercel.com) using GitHub.
2. Select **Add New → Project**.
3. Find the `clerkly` repository and select **Import**.
4. Leave **Root Directory** at the repository root.
5. Vercel should detect the Express application automatically. Do not set a custom Build Command or Output Directory.
6. Expand **Environment Variables** and add:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `APP_URL` using your final Vercel address, such as `https://clerkly-example.vercel.app`
   - `GEMINI_API_KEY` only if you use Gemini
7. Apply the Supabase variables to Production and Preview deployments.
8. Select **Deploy**.

Vercel will provide an address similar to `https://clerkly-example.vercel.app`.

## 5. Finish the Supabase Auth URLs

After Vercel gives you the final address:

1. Return to Supabase.
2. Open **Authentication → URL Configuration**.
3. Set **Site URL** to your Vercel address, for example `https://clerkly-example.vercel.app`.
4. Add these **Redirect URLs**:
   - `https://clerkly-example.vercel.app/login.html`
   - `https://clerkly-example.vercel.app/reset-password.html`
   - `http://localhost:3000/login.html`
   - `http://localhost:3000/reset-password.html`
5. Save the settings.

When a new user confirms their email, they can return to the login page and sign in.

## 6. Final checks

Test the deployed website in a private/incognito browser window:

1. Create and confirm an account.
2. Sign in and create an anonymous case.
3. Upload a non-identifiable learning image and confirm that the page compresses it before saving.
4. Open Profile, update your student details and upload a profile picture.
5. Sign out, use **Forgot password?**, and test the emailed recovery link.
6. Edit the case, print its clerking sheet and confirm the patient name is a blank handwritten line.
7. Mark it reviewed and then delete it.
8. Sign out and confirm that protected pages return to the login page.
9. Open `https://YOUR-VERCEL-ADDRESS/api/health`; it should report that the database is configured.

Each later push to the `main` branch automatically creates a new Vercel production deployment. Other branches and pull requests receive preview deployments.

## Important privacy boundary

This system is designed for anonymous learning records only. Supabase authentication and Row Level Security protect account access, but they do not turn Clerkly into an approved hospital record system. Do not enter direct or indirect patient identifiers, and follow your institution's policy before storing any clinical material online.
