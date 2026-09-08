type Note = { title?: string; presentation?: string; learning?: string };

function topic(note: Note) {
  const text = `${note.title} ${note.presentation}`.toLowerCase();
  if (text.includes("dengue")) return "dengue";
  if (text.includes("tuberculosis") || /\btb\b/.test(text)) return "tb";
  if (text.includes("gastro") || text.includes("food") || text.includes("diarr")) return "gastro";
  return "general";
}

export async function POST(request: Request) {
  const { prompt = "", caseNote = {} } = await request.json() as { prompt?: string; caseNote?: Note };
  const intent = prompt.toLowerCase();
  const name = caseNote.title || "this presentation";
  const safety = "\n\nSafety check: use this as a learning scaffold only. Reassess the actual patient, follow your hospital’s protocol, and involve your clinical supervisor—immediately if the patient is unstable.";
  let answer: string;

  if (intent.includes("quiz") || intent.includes("question") || intent.includes("viva")) {
    answer = `Let’s start with question 1 of 5:\n\nWhat three features in ${name} would make you escalate care immediately, and what would you do first?\n\nAfter you answer, I can challenge your reasoning and give the next question.`;
  } else if (intent.includes("clerk") || intent.includes("history")) {
    answer = `Clerk ${name} in five passes:\n\n1. Opening: presenting complaint, timeline, severity and the patient’s main concern.\n2. Focused history: symptom evolution, relevant exposures, contacts, travel, medication and comorbidities.\n3. Red flags: bleeding, breathlessness, altered consciousness, poor intake or urine output, syncope and rapid deterioration.\n4. Examination: ABCDE first if unwell, then hydration/perfusion, relevant system exam and repeat observations.\n5. Close: concise problem representation, prioritized differentials, investigation plan and disposition.` + safety;
  } else if (intent.includes("differential")) {
    answer = `Build the differential by syndrome, then rank it:\n\n• Most likely: does ${name} explain the time course and key findings?\n• Dangerous alternatives: sepsis, shock, significant bleeding, acute surgical pathology or CNS involvement as relevant.\n• Common mimics: other viral or bacterial infections, medication effects and non-infectious inflammatory causes.\n\nFor each, write one supporting feature, one feature against it, and one test or bedside finding that would change your ranking.` + safety;
  } else if (intent.includes("manage") || intent.includes("plan") || intent.includes("procedure")) {
    answer = `A safe student-level framework:\n\n1. Assess ABCDE and call for help early if unstable.\n2. Repeat observations; assess perfusion, hydration, mental state and urine output.\n3. Establish appropriate monitoring/access under supervision.\n4. Request targeted investigations based on the syndrome and local pathway.\n5. Treat immediate threats, review response, document and communicate clearly.\n6. Confirm disposition and safety-netting with the responsible clinician.` + safety;
  } else {
    const guides: Record<string,string> = {
      dengue: "For dengue, focus your reasoning on illness day, warning signs, haemodynamic status, fluid balance and trends rather than a single platelet value. Severe abdominal pain, persistent vomiting, bleeding, rapid breathing, lethargy/restlessness, thirst or pale/cold skin need urgent review. Avoid aspirin and ibuprofen because of bleeding risk.",
      tb: "For suspected pulmonary TB, begin with infection-control precautions and local notification pathways. Clarify cough duration, constitutional symptoms, exposure, HIV/immune risk and previous TB treatment. WHO recommends approved rapid diagnostic tests as the initial diagnostic approach in people with TB symptoms.",
      gastro: "For acute foodborne illness, clarify onset, shared meals, travel, sick contacts, stool features and risk group. Assess dehydration first. Bloody diarrhoea, persistent symptoms, high fever, inability to keep fluids down or signs of dehydration warrant medical review.",
      general: "Start by turning the case into a one-sentence problem representation: patient group + time course + main syndrome + severity + key context. Then list your most likely diagnosis, dangerous alternatives and the finding that would change management today.",
    };
    answer = guides[topic(caseNote)] + "\n\nWhat part would you like to practise next: clerking, differentials, investigations, management, or viva questions?" + safety;
  }
  return Response.json({ answer });
}
