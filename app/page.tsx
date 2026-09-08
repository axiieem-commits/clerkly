"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CaseNote = {
  id: number;
  title: string;
  posting: string;
  presentation: string;
  learning: string;
  tags: string;
  status: string;
  createdAt: string;
};

type AssistantMessage = { role: "user" | "assistant"; text: string };

const seedCases: CaseNote[] = [
  { id: -1, title: "Dengue with warning signs", posting: "Internal Medicine", presentation: "Day 4 fever, persistent vomiting and abdominal tenderness. Falling platelets with a rising haematocrit.", learning: "The critical phase can begin as fever settles. Reassess perfusion, urine output and warning signs; escalate early and follow local fluid protocols.", tags: "Dengue, Infectious disease", status: "Reviewed", createdAt: "Today" },
  { id: -2, title: "Pulmonary tuberculosis", posting: "Respiratory", presentation: "Prolonged cough, weight loss, night sweats and household exposure.", learning: "Start with infection-control precautions, assess severity and risk factors, and use an approved rapid diagnostic test per local protocol.", tags: "TB, Respiratory", status: "To review", createdAt: "Yesterday" },
  { id: -3, title: "Acute gastroenteritis", posting: "Emergency", presentation: "Vomiting and watery diarrhoea after a shared meal; clinically mildly dehydrated.", learning: "Clarify the exposure timeline, assess hydration and red flags, and consider whether an outbreak needs notification.", tags: "Foodborne illness, GI", status: "Reviewed", createdAt: "3 days ago" },
];

const prompts = [
  { icon: "✦", label: "Clerk this case", text: "Guide me through clerking this case step by step." },
  { icon: "◇", label: "Build differentials", text: "Build a prioritized differential diagnosis and tell me what discriminates each possibility." },
  { icon: "☑", label: "Plan management", text: "Create a safe assessment and management checklist for this presentation." },
  { icon: "?", label: "Quiz me", text: "Create 5 viva-style questions, one at a time, about this case." },
];

export default function Home() {
  const [cases, setCases] = useState<CaseNote[]>(seedCases);
  const [selectedId, setSelectedId] = useState(-1);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: "assistant", text: "Hi Azieem — I’m ready to help you reason through today’s case. I’ll keep the discussion educational, flag red-alert features, and remind you when local protocols or senior review come first." },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/cases").then((r) => r.ok ? r.json() : []).then((saved: CaseNote[]) => {
      if (saved.length) setCases([...saved, ...seedCases]);
    }).catch(() => undefined);
  }, []);

  const filtered = useMemo(() => cases.filter((item) =>
    `${item.title} ${item.posting} ${item.tags}`.toLowerCase().includes(query.toLowerCase())), [cases, query]);
  const active = cases.find((item) => item.id === selectedId) ?? cases[0];

  async function askAssistant(text = draft) {
    const prompt = text.trim();
    if (!prompt || loading) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, caseNote: active }) });
      const data = await response.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "I couldn’t reach the study guide just now. Your case notes are still safe—please try again." }]);
    } finally { setLoading(false); }
  }

  async function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    const response = await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) {
      const note = await response.json();
      setCases((items) => [note, ...items]);
      setSelectedId(note.id);
      setShowForm(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Clerkly home"><span className="brand-mark">C</span><span>clerkly<span className="brand-dot">.</span></span></a>
        <nav className="primary-nav" aria-label="Primary"><a className="active" href="#cases">Casebook</a><a href="#library">Library</a><a href="#progress">Progress</a></nav>
        <div className="top-actions"><button className="icon-button" aria-label="Search" onClick={() => document.querySelector<HTMLInputElement>("#case-search")?.focus()}>⌕</button><button className="avatar" aria-label="Profile">AZ</button></div>
      </header>

      <section className="workspace" id="top">
        <aside className="sidebar" id="cases">
          <div className="sidebar-heading"><div><span className="eyebrow">YEAR 3 · CLINICAL</span><h1>My casebook</h1></div><button className="add-button" onClick={() => setShowForm(true)} aria-label="Add new case">+</button></div>
          <label className="search"><span>⌕</span><input id="case-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your cases" /></label>
          <div className="filters"><button className="selected">All cases <b>{cases.length}</b></button><button>To review <b>{cases.filter(c => c.status === "To review").length}</b></button></div>
          <div className="case-list">
            {filtered.map((item) => <button key={item.id} className={`case-row ${active?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}>
              <span className="case-top"><strong>{item.title}</strong><time>{item.createdAt}</time></span>
              <span className="case-posting">{item.posting}</span>
              <span className="tag-line">{item.tags.split(",").slice(0,2).map(t => <i key={t}>{t.trim()}</i>)}</span>
            </button>)}
          </div>
          <div className="privacy-note"><span>⌾</span><p><strong>Protect patient privacy</strong>Never enter names, IDs, exact dates of birth or identifiable details.</p></div>
        </aside>

        <section className="case-detail">
          <div className="detail-top"><div><p className="breadcrumb">{active.posting} <span>/</span> Case note</p><h2>{active.title}</h2><div className="meta"><span className="status">● {active.status}</span><span>Last edited {active.createdAt.toLowerCase()}</span></div></div><button className="more" aria-label="More options">•••</button></div>
          <article className="note-card summary-card"><div className="card-label"><span className="mini-icon peach">▤</span><span>CASE SNAPSHOT</span></div><p>{active.presentation}</p></article>
          <div className="two-up">
            <article className="note-card"><div className="card-label"><span className="mini-icon blue">⌁</span><span>KEY FINDINGS</span></div><ul><li>Clarify timeline and evolution</li><li>Record relevant positives and negatives</li><li>Assess observations and hydration/perfusion</li></ul></article>
            <article className="note-card"><div className="card-label"><span className="mini-icon green">↗</span><span>WHAT I LEARNT</span></div><p>{active.learning}</p></article>
          </div>
          <section className="clinical-thinking"><div className="section-title"><div><span className="eyebrow">STRUCTURED REASONING</span><h3>Clinical thinking</h3></div><button onClick={() => askAssistant("Build a prioritized differential diagnosis for this case.")}>Ask AI to expand ↗</button></div>
            <div className="thinking-grid"><div><span className="number">01</span><h4>Problem representation</h4><p>Summarize age group, time course, syndrome, severity and key context in one sentence.</p></div><div><span className="number">02</span><h4>Working diagnosis</h4><p>{active.title}, pending confirmation and senior review.</p></div><div><span className="number">03</span><h4>Must-not-miss</h4><p>Shock, respiratory compromise, major bleeding, altered consciousness or rapid deterioration.</p></div></div>
          </section>
          <footer className="source-strip"><span>Evidence links</span><a href="https://www.who.int/news-room/questions-and-answers/item/dengue-and-severe-dengue" target="_blank">WHO Dengue</a><a href="https://www.who.int/en/news-room/fact-sheets/detail/tuberculosis" target="_blank">WHO TB</a><a href="https://www.cdc.gov/food-safety/signs-symptoms/index.html" target="_blank">CDC Food Safety</a></footer>
        </section>

        <aside className={`assistant ${assistantOpen ? "" : "collapsed"}`}>
          <div className="assistant-head"><div className="ai-orb">✦</div><div><span className="eyebrow">CLERKLY AI</span><h3>Clinical copilot</h3></div><button onClick={() => setAssistantOpen(!assistantOpen)} aria-label="Toggle assistant">{assistantOpen ? "→" : "←"}</button></div>
          {assistantOpen && <><div className="context-pill"><span>Working from</span><strong>{active.title}</strong></div>
          <div className="chat-log">{messages.map((m, i) => <div key={i} className={`message ${m.role}`}><span>{m.role === "assistant" ? "✦" : "AZ"}</span><p>{m.text}</p></div>)}{loading && <div className="message assistant-message"><span>✦</span><p className="typing">Thinking through the case…</p></div>}</div>
          <div className="quick-prompts">{prompts.map((p) => <button key={p.label} onClick={() => askAssistant(p.text)}><span>{p.icon}</span>{p.label}</button>)}</div>
          <form className="ask-box" onSubmit={(e) => { e.preventDefault(); askAssistant(); }}><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about this case…" rows={3}/><div><span>For learning, not clinical decisions</span><button type="submit" aria-label="Send">↑</button></div></form>
          <p className="ai-disclaimer">Verify with local guidelines and your clinical supervisor.</p></>}
        </aside>
      </section>

      {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><section className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NEW LEARNING ENTRY</span><h2>Add a case</h2></div><button onClick={() => setShowForm(false)}>×</button></div><div className="safety-banner">Keep it anonymous—describe the learning, never the patient.</div><form onSubmit={saveCase}><label>Case title<input name="title" required placeholder="e.g. Community-acquired pneumonia" /></label><label>Posting<select name="posting" defaultValue="Internal Medicine"><option>Internal Medicine</option><option>Surgery</option><option>Paediatrics</option><option>O&G</option><option>Emergency</option><option>Primary Care</option></select></label><label>Clinical presentation<textarea name="presentation" required rows={3} placeholder="Anonymous summary, symptoms, signs and relevant results" /></label><label>What I learnt<textarea name="learning" required rows={3} placeholder="Your key takeaway or knowledge gap" /></label><label>Tags<input name="tags" placeholder="e.g. Respiratory, Infection" /></label><input type="hidden" name="status" value="To review"/><button className="save-button" type="submit">Save to casebook</button></form></section></div>}
    </main>
  );
}
