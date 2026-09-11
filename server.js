const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const { createPublicClient, createUserClient, supabaseConfig } = require("./db");
const app = express();
const PORT = process.env.PORT || 3000;
const IMAGE_BUCKET = "case-images";
const PROFILE_IMAGE_BUCKET = "profile-images";
const MAX_IMAGE_BYTES = 1024 * 1024;
const REMEMBER_DURATION_MS = 20 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const gemini = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, private");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

const CASE_FIELDS = [
  "title", "posting", "patient_age", "patient_gender", "patient_race",
  "chief_complaint", "presentation", "main_system", "system_problem", "systemic_review", "past_medical_history",
  "past_surgical_history", "drug_history", "allergy_history", "family_history",
  "social_history", "findings", "provisional_diagnosis", "differential_diagnoses",
  "investigations", "management_plan", "notes_snippets", "learning", "tags", "status"
];

function cookieOptions(maxAge) {
  return { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/", ...(Number.isFinite(maxAge) ? { maxAge } : {}) };
}

function setSessionCookies(res, session, rememberUntil = null) {
  const remaining = rememberUntil ? Math.max(0, rememberUntil - Date.now()) : null;
  const accessAge = remaining === null ? null : Math.min((session.expires_in || 3600) * 1000, remaining);
  res.cookie("clerkly_access", session.access_token, cookieOptions(accessAge));
  res.cookie("clerkly_refresh", session.refresh_token, cookieOptions(remaining));
  if (remaining !== null) res.cookie("clerkly_remember_until", String(rememberUntil), cookieOptions(remaining));
  else res.clearCookie("clerkly_remember_until", cookieOptions());
}

function clearSessionCookies(res) {
  const options = { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/" };
  res.clearCookie("clerkly_access", options);
  res.clearCookie("clerkly_refresh", options);
  res.clearCookie("clerkly_remember_until", options);
}

function publicOrigin(req) {
  const configured = String(process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    try { cookies[key] = decodeURIComponent(part.slice(separator + 1).trim()); }
    catch { cookies[key] = part.slice(separator + 1).trim(); }
    return cookies;
  }, {});
}

function safeUser(user, profile = {}) {
  return {
    id: user.id,
    email: user.email,
    displayName: profile.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Medical Student",
    username: profile.username || "",
    year: profile.year_of_study || user.user_metadata?.year || "Year 3",
    posting: profile.posting || user.user_metadata?.posting || "Internal Medicine",
    avatarUrl: profile.avatar_url || ""
  };
}

async function profileForUser(client, user) {
  const { data, error } = await client.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.warn(`Profile lookup skipped: ${error.code || "unknown error"}`);
    return safeUser(user);
  }
  let avatarUrl = "";
  if (data?.avatar_path) {
    const { data: signed } = await client.storage.from(PROFILE_IMAGE_BUCKET).createSignedUrl(data.avatar_path, 3600);
    avatarUrl = signed?.signedUrl || "";
  }
  return safeUser(user, { ...(data || {}), avatar_url: avatarUrl });
}

async function requireUser(req, res, next) {
  try {
    supabaseConfig();
    const cookies = parseCookies(req.headers.cookie);
    let accessToken = cookies.clerkly_access;
    let user = null;

    if (accessToken) {
      const { data } = await createPublicClient().auth.getUser(accessToken);
      user = data.user;
    }

    if (!user && cookies.clerkly_refresh) {
      const rememberUntil = Number(cookies.clerkly_remember_until) || null;
      if (rememberUntil && rememberUntil <= Date.now()) {
        clearSessionCookies(res);
        return res.status(401).json({ message: "Your remembered login has expired. Please sign in again." });
      }
      const { data, error } = await createPublicClient().auth.refreshSession({ refresh_token: cookies.clerkly_refresh });
      if (!error && data.session && data.user) {
        accessToken = data.session.access_token;
        user = data.user;
        setSessionCookies(res, data.session, rememberUntil);
      }
    }

    if (!user || !accessToken) {
      clearSessionCookies(res);
      return res.status(401).json({ message: "Please sign in to continue." });
    }

    req.user = user;
    req.supabase = createUserClient(accessToken);
    next();
  } catch (error) {
    next(error);
  }
}

function normalizeCase(body) {
  const values = {};
  CASE_FIELDS.forEach(field => { values[field] = String(body[field] ?? "").trim(); });
  values.status = values.status === "Reviewed" ? "Reviewed" : "To review";
  return values;
}

function validateCase(values) {
  if (!values.title || !values.posting || !values.presentation || !values.learning) return "Please complete all required fields.";
  if (values.patient_age && (!/^\d{1,3}$/.test(values.patient_age) || Number(values.patient_age) > 120)) return "Enter an age from 0 to 120 years.";
  const text = CASE_FIELDS.map(field => values[field]).join(" ");
  if (/\b(mrn|nric|passport|patient id|patient name|full name|date of birth|dob|home address|phone number|contact number)\b/i.test(text)) return "Remove possible patient identifiers before saving.";
  return null;
}

async function uploadImage(client, userId, dataUrl, bucket = IMAGE_BUCKET) {
  if (!dataUrl) return null;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) throw new Error("Please upload a JPG, PNG or WebP image.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("The compressed image must be smaller than 1 MB.");
  const extension = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(objectPath, bytes, { contentType: `image/${match[1].toLowerCase()}`, upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return objectPath;
}

async function addSignedImage(client, row) {
  if (!row?.case_image_path) return { ...row, case_image: "" };
  const { data, error } = await client.storage.from(IMAGE_BUCKET).createSignedUrl(row.case_image_path, 3600);
  return { ...row, case_image: error ? "" : data.signedUrl };
}

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const displayName = String(req.body.displayName || "").trim();
    if (!email || !displayName || password.length < 8) return res.status(400).json({ message: "Enter your name, email and a password of at least 8 characters." });
    const { data, error } = await createPublicClient().auth.signUp({ email, password, options: { data: { display_name: displayName, year: "Year 3", posting: "Internal Medicine" } } });
    if (error) return res.status(400).json({ message: error.message });
    if (data.session) setSessionCookies(res, data.session);
    res.status(201).json({ authenticated: Boolean(data.session), user: data.user ? safeUser(data.user) : null, message: data.session ? "Account created." : "Check your email to confirm your account, then sign in." });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ message: "Enter your email and password." });
    const { data, error } = await createPublicClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) return res.status(401).json({ message: error?.message || "Sign in failed." });
    const rememberUntil = req.body.rememberMe === true ? Date.now() + REMEMBER_DURATION_MS : null;
    setSessionCookies(res, data.session, rememberUntil);
    res.json({ user: safeUser(data.user) });
  } catch (error) { next(error); }
});

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Enter your email address." });
    const redirectTo = `${publicOrigin(req)}/reset-password.html`;
    const { error } = await createPublicClient().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return res.status(400).json({ message: error.message });
    res.json({ message: "If an account exists for that email, a password reset link has been sent." });
  } catch (error) { next(error); }
});

app.post("/api/auth/reset-password", async (req, res, next) => {
  try {
    const accessToken = String(req.body.accessToken || "");
    const refreshToken = String(req.body.refreshToken || "");
    const password = String(req.body.password || "");
    if (!accessToken || !refreshToken || password.length < 8) return res.status(400).json({ message: "Use a valid recovery link and a password of at least 8 characters." });
    const client = createPublicClient();
    const { error: sessionError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError) return res.status(400).json({ message: "This recovery link is invalid or has expired." });
    const { error } = await client.auth.updateUser({ password });
    if (error) return res.status(400).json({ message: error.message });
    await client.auth.signOut();
    clearSessionCookies(res);
    res.json({ message: "Password updated. Returning to sign in…" });
  } catch (error) { next(error); }
});

app.get("/api/auth/session", requireUser, async (req, res, next) => {
  try { res.json({ user: await profileForUser(req.supabase, req.user) }); }
  catch (error) { next(error); }
});

app.post("/api/auth/logout", (req, res) => {
  clearSessionCookies(res);
  res.json({ message: "Signed out." });
});

app.get("/api/profile", requireUser, async (req, res, next) => {
  try { res.json(await profileForUser(req.supabase, req.user)); }
  catch (error) { next(error); }
});

app.put("/api/profile", requireUser, async (req, res, next) => {
  let uploadedPath = null;
  try {
    const displayName = String(req.body.display_name || "").trim();
    const username = String(req.body.username || "").trim().toLowerCase();
    const yearOfStudy = String(req.body.year_of_study || "").trim();
    const posting = String(req.body.posting || "").trim();
    if (!displayName || !/^[a-z0-9_.-]{3,30}$/.test(username) || !yearOfStudy || !posting) {
      return res.status(400).json({ message: "Enter a name, a valid username, your year of study and current posting." });
    }
    const { data: existing, error: existingError } = await req.supabase.from("profiles").select("avatar_path").eq("user_id", req.user.id).maybeSingle();
    if (existingError) throw existingError;
    uploadedPath = await uploadImage(req.supabase, req.user.id, req.body.profile_image, PROFILE_IMAGE_BUCKET);
    const profileData = { user_id: req.user.id, display_name: displayName, username, year_of_study: yearOfStudy, posting, updated_at: new Date().toISOString() };
    if (uploadedPath) profileData.avatar_path = uploadedPath;
    const { error } = await req.supabase.from("profiles").upsert(profileData, { onConflict: "user_id" });
    if (error) {
      if (error.code === "23505") {
        if (uploadedPath) await req.supabase.storage.from(PROFILE_IMAGE_BUCKET).remove([uploadedPath]);
        uploadedPath = null;
        return res.status(409).json({ message: "That username is already in use. Please choose another." });
      }
      throw error;
    }
    if (uploadedPath && existing?.avatar_path) await req.supabase.storage.from(PROFILE_IMAGE_BUCKET).remove([existing.avatar_path]);
    res.json(await profileForUser(req.supabase, req.user));
  } catch (error) {
    if (uploadedPath) await req.supabase.storage.from(PROFILE_IMAGE_BUCKET).remove([uploadedPath]);
    next(error);
  }
});

app.get("/api/cases", requireUser, async (req, res, next) => {
  try {
    const { data, error } = await req.supabase.from("clinical_cases").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(await Promise.all(data.map(row => addSignedImage(req.supabase, row))));
  } catch (error) { next(error); }
});

app.get("/api/cases/:id", requireUser, async (req, res, next) => {
  try {
    const { data, error } = await req.supabase.from("clinical_cases").select("*").eq("id", req.params.id).single();
    if (error || !data) return res.status(404).json({ message: "Case not found." });
    res.json(await addSignedImage(req.supabase, data));
  } catch (error) { next(error); }
});

app.post("/api/cases", requireUser, async (req, res, next) => {
  let uploadedPath = null;
  try {
    const values = normalizeCase(req.body);
    const validationError = validateCase(values);
    if (validationError) return res.status(400).json({ message: validationError });
    uploadedPath = await uploadImage(req.supabase, req.user.id, req.body.case_image);
    const { data, error } = await req.supabase.from("clinical_cases").insert({ ...values, user_id: req.user.id, case_image_path: uploadedPath }).select("id").single();
    if (error) throw error;
    res.status(201).json({ id: data.id, message: "Case saved successfully." });
  } catch (error) {
    if (uploadedPath) await req.supabase.storage.from(IMAGE_BUCKET).remove([uploadedPath]);
    next(error);
  }
});

app.put("/api/cases/:id", requireUser, async (req, res, next) => {
  let uploadedPath = null;
  try {
    const values = normalizeCase(req.body);
    const validationError = validateCase(values);
    if (validationError) return res.status(400).json({ message: validationError });
    const { data: existing, error: findError } = await req.supabase.from("clinical_cases").select("case_image_path").eq("id", req.params.id).single();
    if (findError || !existing) return res.status(404).json({ message: "Case not found." });
    uploadedPath = await uploadImage(req.supabase, req.user.id, req.body.case_image);
    const update = { ...values, updated_at: new Date().toISOString() };
    if (uploadedPath) update.case_image_path = uploadedPath;
    const { data, error } = await req.supabase.from("clinical_cases").update(update).eq("id", req.params.id).select("id").single();
    if (error) throw error;
    if (uploadedPath && existing.case_image_path) await req.supabase.storage.from(IMAGE_BUCKET).remove([existing.case_image_path]);
    res.json({ id: data.id, message: "Case updated successfully." });
  } catch (error) {
    if (uploadedPath) await req.supabase.storage.from(IMAGE_BUCKET).remove([uploadedPath]);
    next(error);
  }
});

app.put("/api/cases/:id/status", requireUser, async (req, res, next) => {
  try {
    const status = req.body.status === "Reviewed" ? "Reviewed" : "To review";
    const { data, error } = await req.supabase.from("clinical_cases").update({ status, updated_at: new Date().toISOString() }).eq("id", req.params.id).select("id").single();
    if (error || !data) return res.status(404).json({ message: "Case not found." });
    res.json({ message: "Status updated." });
  } catch (error) { next(error); }
});

app.delete("/api/cases/:id", requireUser, async (req, res, next) => {
  try {
    const { data: existing, error: findError } = await req.supabase.from("clinical_cases").select("case_image_path").eq("id", req.params.id).single();
    if (findError || !existing) return res.status(404).json({ message: "Case not found." });
    const { error } = await req.supabase.from("clinical_cases").delete().eq("id", req.params.id);
    if (error) throw error;
    if (existing.case_image_path) await req.supabase.storage.from(IMAGE_BUCKET).remove([existing.case_image_path]);
    res.json({ message: "Case deleted." });
  } catch (error) { next(error); }
});

function guidedAnswer(prompt, caseData) {
  const name = caseData.title || "this case";
  const text = prompt.toLowerCase();
  const safety = "\n\nUse this for learning only. Reassess the real patient, follow local guidelines, and discuss decisions with your clinical supervisor.";
  if (text.includes("quiz") || text.includes("question")) return `Question 1: What are three red flags in ${name} that require immediate escalation, and what would you do first?` + safety;
  if (text.includes("clerk") || text.includes("history")) return `Clerk ${name} systematically:\n1. Anonymous context: age, gender and race only\n2. Chief complaint and HOPI using site, onset, character, radiation, associations, timing, aggravating/relieving factors and severity where relevant\n3. System review: general, cardiovascular, respiratory, gastrointestinal, genitourinary, neurological and musculoskeletal\n4. Past medical/surgical, drug, allergy, family and relevant social history\n5. Examination findings, provisional diagnosis and prioritized differentials\n6. Investigations and a supervisor-reviewed management plan` + safety;
  if (text.includes("differential")) return `For ${name}, list the most likely diagnosis, dangerous alternatives and common mimics. For each one, add a supporting feature, a feature against it and the test or finding that would change your ranking.` + safety;
  return `For ${name}, begin with a one-sentence problem representation: patient group, time course, syndrome, severity and key context. Then identify immediate threats before planning focused investigations and management.` + safety;
}

app.post("/api/assistant", requireUser, async (req, res) => {
  const prompt = String(req.body.prompt || "").trim().slice(0, 4000);
  const caseData = req.body.caseData || {};
  if (!prompt) return res.status(400).json({ message: "Please enter a question." });
  if (!gemini) return res.json({ answer: guidedAnswer(prompt, caseData), mode: "guided" });
  try {
    const response = await gemini.models.generateContent({ model: "gemini-2.5-flash", contents: `You are a clinical education tutor for a third-year medical student. Never replace clinical supervision, prescribe independently, or claim certainty. Protect patient privacy. Use clear structured teaching and flag emergencies.\n\nAnonymous case: ${JSON.stringify(caseData).slice(0, 12000)}\n\nStudent request: ${prompt}` });
    res.json({ answer: response.text, mode: "ai" });
  } catch { res.json({ answer: guidedAnswer(prompt, caseData), mode: "guided" }); }
});

app.get("/", (_req, res) => res.redirect("/index.html"));

app.get("/api/health", (_req, res) => {
  try {
    supabaseConfig();
    res.json({ message: "Clerkly API is ready.", database: "configured" });
  } catch {
    res.status(503).json({ message: "Clerkly API is running, but Supabase is not configured." });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error.message);
  res.status(500).json({ message: isProduction ? "Something went wrong. Please try again." : error.message });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Clerkly is running at http://localhost:${PORT}`));
}

module.exports = app;
