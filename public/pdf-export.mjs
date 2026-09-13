const A4_LANDSCAPE = [841.89, 595.28];
const SYSTEMS = {
  General: ["Conscious", "Fever", "Lethargy", "LOA", "LOW"],
  Cardiovascular: ["Angina", "Palpitation", "Tachy", "Brady", "Cyanosis", "Edema"],
  Respiratory: ["Cough", "Hemoptysis", "SOB", "Tachypnea", "Stridor", "Wheeze", "Hoarseness"],
  Gastrointestinal: ["Dysphagia", "Vomiting", "Diarrhea", "Pale stool", "Bloody stool", "Mucous stool", "Change of bowel habit", "Constipation"],
  Genitourinary: ["Dysuria", "Polyuria", "Oligouria", "Frequency", "Urgency", "Hematuria", "Sandy", "Nocturia", "Hesitancy", "Incontinence"],
  Neurological: ["Headache", "Dizziness", "Fits", "VD", "GD", "LOS", "Limb weakness"],
  Musculoskeletal: ["Arthralgia", "Myalgia", "Muscle weakness", "Joint swelling"]
};
const SYSTEM_LABELS = { Cardiovascular: "CVS", Gastrointestinal: "GIT", Neurological: "CNS" };

function clean(value) {
  return String(value || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?");
}

function safeFilename(value) {
  return clean(value || "Clinical case").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

function wrapText(text, font, size, width) {
  const paragraphs = clean(text).split(/\r?\n/);
  const lines = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = "";
    for (const originalWord of words) {
      let word = originalWord;
      while (font.widthOfTextAtSize(word, size) > width && word.length > 1) {
        let splitAt = word.length - 1;
        while (splitAt > 1 && font.widthOfTextAtSize(word.slice(0, splitAt) + "-", size) > width) splitAt -= 1;
        const piece = word.slice(0, splitAt) + "-";
        if (line) lines.push(line);
        lines.push(piece);
        line = "";
        word = word.slice(splitAt);
      }
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fittedLines(text, font, width, height, maxSize = 7.5, minSize = 3.4) {
  let size = maxSize;
  let lines = wrapText(text, font, size, width);
  while (size > minSize && lines.length * size * 1.18 > height) {
    size = Math.max(minSize, size - 0.25);
    lines = wrapText(text, font, size, width);
  }
  if (lines.length * size * 1.12 > height && lines.length) {
    size = Math.max(2.4, height / (lines.length * 1.12));
    lines = wrapText(text, font, size, width);
  }
  return { lines, size, lineHeight: size * 1.12 };
}

function numbered(value) {
  return clean(value).split(/\n+/).map(line => line.trim()).filter(Boolean)
    .map((line, index) => /^\d+[.)]\s/.test(line) ? line : `${index + 1}. ${line}`).join("\n");
}

export async function buildClerkingPdf(caseItem, identifiers = {}, selections = {}, suppliedPdfLib) {
  const pdfLib = suppliedPdfLib || await import("./vendor/pdf-lib/pdf-lib.esm.min.js");
  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4_LANDSCAPE);
  const [pageWidth, pageHeight] = A4_LANDSCAPE;
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.05, 0.05, 0.05);
  const grey = rgb(0.35, 0.35, 0.35);
  const margin = 18;
  const gap = 8;
  const columnWidth = (pageWidth - margin * 2 - gap) / 2;
  const rowHeight = (pageHeight - margin * 2 - gap) / 2;
  const panel = (x, top, width = columnWidth, height = rowHeight) => {
    page.drawRectangle({ x, y: pageHeight - top - height, width, height, borderColor: black, borderWidth: 1 });
  };
  const yAt = top => pageHeight - top;
  const text = (value, x, top, options = {}) => {
    const font = options.font || normal;
    const size = options.size || 7.2;
    page.drawText(clean(value), { x, y: yAt(top) - size, size, font, color: options.color || black });
  };
  const line = (x1, top, x2, thickness = 0.45) => page.drawLine({ start: { x: x1, y: yAt(top) }, end: { x: x2, y: yAt(top) }, thickness, color: grey });
  const fitted = (value, x, top, width, height, options = {}) => {
    const font = options.font || normal;
    const fit = fittedLines(value, font, width, height, options.maxSize || 7.3, options.minSize || 3.4);
    fit.lines.forEach((entry, index) => text(entry, x, top + index * fit.lineHeight, { font, size: fit.size }));
    return fit;
  };
  const labelLine = (label, value, x, top, width, options = {}) => {
    const size = options.size || 7.1;
    text(label, x, top, { font: bold, size });
    const labelWidth = bold.widthOfTextAtSize(clean(label), size) + 4;
    line(x + labelWidth, top + size + 2, x + width);
    fitted(value, x + labelWidth + 2, top, width - labelWidth - 3, options.height || 11, { maxSize: size, minSize: 3.6 });
  };
  const notesColumn = (x, top, width, height, notesWidth = 104) => {
    const divider = x + width - notesWidth;
    page.drawLine({ start: { x: divider, y: yAt(top) }, end: { x: divider, y: yAt(top + height) }, thickness: 1, color: black });
    text("NOTES", divider + notesWidth / 2 - 17, top + 12, { size: 8.4 });
    return divider;
  };

  const left = margin;
  const right = margin + columnWidth + gap;
  const topRow = margin;
  const bottomRow = margin + rowHeight + gap;
  panel(left, topRow);
  panel(right, topRow);
  panel(left, bottomRow);
  panel(right, bottomRow);

  // Patient information and HOPI.
  const patientRight = notesColumn(left, topRow, columnWidth, rowHeight);
  const px = left + 12;
  const pw = patientRight - px - 10;
  labelLine("WARD:", caseItem.ward || caseItem.posting, px, topRow + 11, pw);
  text("PATIENT'S INFO:", px, topRow + 27, { font: bold, size: 9.5 });
  labelLine("Name:", identifiers.name, px, topRow + 45, pw);
  labelLine("MRN:", identifiers.mrn, px, topRow + 58, pw);
  labelLine("Age:", caseItem.patient_age, px, topRow + 71, pw);
  labelLine("Gender:", caseItem.patient_gender, px, topRow + 84, pw);
  labelLine("Race:", caseItem.patient_race, px, topRow + 97, pw);
  labelLine("c/o:", caseItem.chief_complaint, px, topRow + 116, pw, { height: 13 });
  text("HOPI:", px, topRow + 134, { font: bold, size: 7.2 });
  const hopiX = px + 28;
  fitted(caseItem.presentation, hopiX, topRow + 133, pw - 28, 42, { maxSize: 6.8, minSize: 3.2 });
  line(hopiX, topRow + 178, px + pw);
  const hopiRows = [
    ["- Site", caseItem.hopi_site], ["- Onset", caseItem.hopi_onset],
    ["- Characteristics", caseItem.hopi_character], ["- Radiation", caseItem.hopi_radiation],
    ["- Associations", caseItem.hopi_associations], ["- Time", caseItem.hopi_timing],
    ["- Exacerbating/Alleviating factors", caseItem.hopi_aggravating_relief], ["- Severity", caseItem.hopi_severity]
  ];
  hopiRows.forEach(([label, value], index) => labelLine(label, value, px, topRow + 181 + index * 10.2, pw, { size: 6.2, height: 9 }));

  // Systemic review with selected systems and symptoms underlined.
  const sx = right + 10;
  const sw = columnWidth - 20;
  text("SYSTEMIC REVIEW", sx, topRow + 12, { font: bold, size: 9.5 });
  const systemHeights = { General: 23, Cardiovascular: 25, Respiratory: 29, Gastrointestinal: 37, Genitourinary: 39, Neurological: 28, Musculoskeletal: 28 };
  let systemTop = topRow + 35;
  Object.entries(SYSTEMS).forEach(([system, symptoms]) => {
    const selected = new Set(selections[system] || []);
    const customSymptoms = [...selected].filter(symptom => /^Other:\s*\S/i.test(symptom));
    const label = SYSTEM_LABELS[system] || system;
    const labelSize = 7.1;
    text(label, sx, systemTop, { font: bold, size: labelSize });
    if (selected.size) line(sx, systemTop + labelSize + 1, sx + bold.widthOfTextAtSize(label, labelSize), 0.8);
    const valueX = sx + 80;
    const maxX = sx + sw;
    let cursorX = valueX;
    let cursorTop = systemTop;
    symptoms.forEach((symptom, index) => {
      const suffix = index < symptoms.length - 1 ? " /" : "";
      const token = clean(symptom);
      const font = selected.has(symptom) ? bold : normal;
      const tokenWidth = font.widthOfTextAtSize(token, labelSize);
      const suffixWidth = normal.widthOfTextAtSize(suffix + " ", labelSize);
      if (cursorX + tokenWidth + suffixWidth > maxX && cursorX > valueX) {
        cursorX = valueX;
        cursorTop += 9.2;
      }
      text(token, cursorX, cursorTop, { font, size: labelSize });
      if (selected.has(symptom)) line(cursorX, cursorTop + labelSize + 1, cursorX + tokenWidth, 0.8);
      cursorX += tokenWidth;
      text(suffix, cursorX, cursorTop, { size: labelSize });
      cursorX += suffixWidth;
    });
    if (customSymptoms.length) {
      const customTop = cursorTop + 9.2;
      const customHeight = Math.max(5, systemTop + systemHeights[system] - customTop - 5);
      const fit = fittedLines(customSymptoms.join("; "), bold, maxX - valueX, customHeight, 6.2, 2.8);
      fit.lines.forEach((entry, index) => {
        const entryTop = customTop + index * fit.lineHeight;
        text(entry, valueX, entryTop, { font: bold, size: fit.size });
        line(valueX, entryTop + fit.size + 1, valueX + bold.widthOfTextAtSize(entry, fit.size), 0.8);
      });
    }
    line(valueX, systemTop + systemHeights[system] - 4, maxX);
    systemTop += systemHeights[system];
  });
  fitted(caseItem.systemic_review, sx, systemTop + 1, sw, topRow + rowHeight - systemTop - 10, { maxSize: 6.7, minSize: 3.2 });

  // Past, family and social histories.
  const hx = left + 10;
  const hw = columnWidth - 20;
  const historyRows = [
    ["PMH (MIJTHREADS):", caseItem.past_medical_history], ["PSHx:", caseItem.past_surgical_history],
    ["Past blood transfuse:", caseItem.past_blood_transfusion], ["Menstrual hx:", caseItem.menstrual_history],
    ["Drug hx:", caseItem.drug_history], ["Allergy hx:", caseItem.allergy_history]
  ];
  historyRows.forEach(([label, value], index) => labelLine(label, value, hx, bottomRow + 12 + index * 20, hw, { size: 7, height: 16 }));
  text("Family history:", hx, bottomRow + 136, { font: bold, size: 7.3 });
  labelLine("Similar problem:", caseItem.family_similar_problem || caseItem.family_history, hx, bottomRow + 150, hw, { size: 6.8, height: 12 });
  labelLine("Familial disease: DM / malignancy /", caseItem.familial_disease, hx, bottomRow + 164, hw, { size: 6.6, height: 12 });
  text("Social hx:", hx, bottomRow + 184, { font: bold, size: 7.3 });
  const socialLeft = hx;
  const socialRight = hx + hw / 2 + 8;
  const socialWidth = hw / 2 - 8;
  [["Occupation:", caseItem.occupation], ["Smoker: Y / N", caseItem.smoking_history], ["Promiscuity: Y / N", caseItem.promiscuity_history], ["Travel: Y / N", caseItem.travel_history]]
    .forEach(([label, value], index) => labelLine(label, value, socialLeft, bottomRow + 199 + index * 15, socialWidth, { size: 6.3, height: 11 }));
  [["Status: M / S / D /", caseItem.marital_status], ["Alcoholic: Y / N", caseItem.alcohol_history], ["Drug: Y / N", caseItem.recreational_drug_history], ["Others:", caseItem.social_other || caseItem.social_history]]
    .forEach(([label, value], index) => labelLine(label, value, socialRight, bottomRow + 199 + index * 15, socialWidth, { size: 6.3, height: 11 }));

  // Diagnosis, investigations and management.
  const assessmentRight = notesColumn(right, bottomRow, columnWidth, rowHeight);
  const ax = right + 12;
  const aw = assessmentRight - ax - 10;
  labelLine("Provisional dx:", caseItem.provisional_diagnosis, ax, bottomRow + 13, aw, { size: 7.2, height: 15 });
  const assessmentBlocks = [
    ["Ddx:", numbered(caseItem.differential_diagnoses), 42, 55],
    ["Ix:", numbered(caseItem.investigations), 104, 68],
    ["Mx/Tx:", numbered(caseItem.management_plan), 179, 73]
  ];
  assessmentBlocks.forEach(([label, value, offset, height]) => {
    text(label, ax, bottomRow + offset, { font: bold, size: 7.4 });
    fitted(value, ax, bottomRow + offset + 12, aw, height - 13, { maxSize: 7, minSize: 3.1 });
    line(ax, bottomRow + offset + height, ax + aw);
  });

  pdf.setTitle(`Clerkly - ${safeFilename(caseItem.title)} - Clerking Sheet`);
  pdf.setAuthor("Clerkly");
  pdf.setSubject("Clinical clerking learning sheet");
  pdf.setCreator("Clerkly client-side PDF export");
  return pdf.save();
}

export function openPdfPreviewWindow() {
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isiOS ? window.open("", "_blank") : null;
}

export async function exportClerkingPdf(caseItem, identifiers, selections, previewWindow = null) {
  const bytes = await buildClerkingPdf(caseItem, identifiers, selections);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const filename = `Clerkly - ${safeFilename(caseItem.title)} - Clerking Sheet.pdf`;
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.href = url;
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
