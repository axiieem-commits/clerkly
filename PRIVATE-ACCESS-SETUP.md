# Deploy private access and encrypted identifiers

Complete steps 1–3 BEFORE pushing this version to GitHub (Vercel auto-deploys).

1. In Supabase SQL Editor, run `supabase/migrations/004_private_access_encrypted_identifiers.sql`. It requires exactly two users on first run and freezes their IDs in `allowed_users`. Existing owner-only policies continue to keep their records separate. Re-running does not enroll new accounts.
2. In Supabase Authentication settings, disable new user signups. This also prevents signup directly through Supabase rather than the website.
3. Generate a secret in your own terminal:

   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

   Add the result to Vercel project Settings → Environment Variables as `PATIENT_DATA_ENCRYPTION_KEY` for Production (and any Preview using this database). Add it to your local `.env` for local testing. Never put it in GitHub, frontend code, or a chat. Save a backup in your password manager; do not replace it after encrypting records without migrating those records.
4. Push this version to GitHub and wait for Vercel deployment.
5. Sign in with each existing account. Add a test case with fictional Name/MRN, save, reopen Edit / add info, and export its PDF. In Supabase the `patient_identifiers_encrypted` column should contain a `v1.` ciphertext, never plaintext. Each user should see only their own cases.

Names and MRNs entered previously were temporary and cannot be recovered: enter them once and save again. The export dialog changes the PDF only; edit the case to persist corrections.

Encryption uses AES-256-GCM with a fresh nonce and binds each ciphertext to its owner and case ID. The server decrypts for an authorized owner's single-case request. Lists and the library omit identifiers; the assistant endpoint uses an allowlist that excludes them. HTTPS protects transmission. Exported PDFs contain readable identifiers, so protect the saved files.

The encryption key resides on Vercel, separately from the ciphertext in Supabase. This protects database copies but is not end-to-end encryption: someone with both the key and database can decrypt. These changes alone do not establish institutional approval for storing patient identifiers.
