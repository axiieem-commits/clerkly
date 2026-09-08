import { env } from "cloudflare:workers";

const createTable = `CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  posting TEXT NOT NULL,
  presentation TEXT NOT NULL,
  learning TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'To review',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function database() {
  if (!env.DB) throw new Error("Database unavailable");
  await env.DB.prepare(createTable).run();
  return env.DB;
}

export async function GET() {
  try {
    const db = await database();
    const result = await db.prepare("SELECT id, title, posting, presentation, learning, tags, status, created_at AS createdAt FROM cases ORDER BY id DESC").all();
    return Response.json(result.results);
  } catch { return Response.json([]); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, string>;
    const required = ["title", "posting", "presentation", "learning"];
    if (required.some((key) => !body[key]?.trim())) return Response.json({ error: "Please complete every required field." }, { status: 400 });
    const text = Object.values(body).join(" ");
    if (/\b(?:mrn|nric|passport|patient id|date of birth|dob)\b/i.test(text)) return Response.json({ error: "Remove possible patient identifiers before saving." }, { status: 400 });
    const db = await database();
    const result = await db.prepare("INSERT INTO cases (title, posting, presentation, learning, tags, status) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(body.title.trim(), body.posting.trim(), body.presentation.trim(), body.learning.trim(), body.tags?.trim() ?? "", body.status ?? "To review").run();
    return Response.json({ id: result.meta.last_row_id, title: body.title, posting: body.posting, presentation: body.presentation, learning: body.learning, tags: body.tags ?? "", status: body.status ?? "To review", createdAt: "Just now" });
  } catch { return Response.json({ error: "Unable to save this case." }, { status: 500 }); }
}
