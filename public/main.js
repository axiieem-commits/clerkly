import imageCompression from "./vendor/browser-image-compression.mjs";

const compressionWorkerUrl = new URL("./vendor/browser-image-compression.js", import.meta.url).href;

async function compressImage(file) {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    libURL: compressionWorkerUrl
  };
  const compressedFile = await imageCompression(file, options);
  console.info("Image compression", {
    originalMB: Number((file.size / 1024 / 1024).toFixed(2)),
    compressedMB: Number((compressedFile.size / 1024 / 1024).toFixed(2))
  });
  return compressedFile;
}

const Auth = {
  currentUser: null,

  profile() {
    return Auth.currentUser || JSON.parse(localStorage.getItem("clerkly_user") || "null");
  },

  async guard() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
      if (response.status === 401) {
        localStorage.removeItem("clerkly_user");
        location.replace("login.html");
        return false;
      }
      if (!response.ok) throw new Error("The server could not verify your session.");
      const data = await response.json();
      Auth.currentUser = data.user;
      localStorage.setItem("clerkly_user", JSON.stringify(data.user));
      return true;
    } catch (error) {
      const main = document.querySelector(".portal-main");
      if (main && !document.getElementById("sessionError")) {
        main.insertAdjacentHTML("afterbegin", '<section class="portal-notice compact-notice session-error" id="sessionError"><span>CONNECTION</span><div><strong>Your login could not be checked.</strong><p>Please refresh the page. You have not been signed out.</p></div></section>');
      }
      console.error(error.message);
      return false;
    }
  },

  initLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return false;
    localStorage.removeItem("clerkly_profile");
    localStorage.removeItem("clerkly_session");
    let signupMode = false;
    const modeTitle = document.getElementById("loginMode");
    const modeHelp = document.getElementById("loginHelp");
    const displayNameField = document.getElementById("displayNameField");
    const displayName = document.getElementById("loginDisplayName");
    const submitButton = document.getElementById("loginSubmit");
    const toggleButton = document.getElementById("loginModeToggle");
    const rememberRow = document.getElementById("rememberRow");
    const forgotButton = document.getElementById("forgotPassword");
    const message = document.getElementById("loginMessage");

    toggleButton.addEventListener("click", () => {
      signupMode = !signupMode;
      modeTitle.textContent = signupMode ? "Create your account" : "Welcome back";
      modeHelp.textContent = signupMode ? "Use an email you can access for account confirmation." : "Sign in securely to access your casebook.";
      displayNameField.classList.toggle("hidden", !signupMode);
      rememberRow.classList.toggle("hidden", signupMode);
      displayName.required = signupMode;
      document.getElementById("loginPassword").autocomplete = signupMode ? "new-password" : "current-password";
      submitButton.textContent = signupMode ? "Create account →" : "Sign in →";
      toggleButton.textContent = signupMode ? "Already have an account? Sign in" : "New to Clerkly? Create an account";
      message.textContent = "";
      message.classList.remove("success");
    });

    forgotButton.addEventListener("click", async () => {
      const email = document.getElementById("loginEmail").value.trim();
      if (!email) {
        message.classList.remove("success");
        message.textContent = "Enter your email address first, then select Forgot password.";
        document.getElementById("loginEmail").focus();
        return;
      }
      forgotButton.disabled = true;
      forgotButton.textContent = "Sending…";
      try {
        const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        message.classList.add("success");
        message.textContent = data.message;
      } catch (error) {
        message.classList.remove("success");
        message.textContent = error.message || "Could not send the recovery email.";
      } finally {
        forgotButton.disabled = false;
        forgotButton.textContent = "Forgot password?";
      }
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      submitButton.disabled = true;
      submitButton.textContent = signupMode ? "Creating account…" : "Signing in…";
      try {
        const response = await fetch(signupMode ? "/api/auth/signup" : "/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName: displayName.value.trim(), rememberMe: !signupMode && document.getElementById("rememberMe").checked })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (data.user) localStorage.setItem("clerkly_user", JSON.stringify(data.user));
        if (signupMode && !data.authenticated) {
          message.classList.add("success");
          message.textContent = data.message;
          return;
        }
        location.href = "index.html";
      } catch (error) {
        message.classList.remove("success");
        message.textContent = error.message || "Could not connect to the account service.";
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = signupMode ? "Create account →" : "Sign in →";
      }
    });
    return true;
  },

  initPasswordReset() {
    const form = document.getElementById("resetPasswordForm");
    if (!form) return false;
    const params = new URLSearchParams(location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const message = document.getElementById("resetMessage");
    const button = document.getElementById("resetSubmit");
    history.replaceState(null, "", location.pathname);
    if (!accessToken || !refreshToken) {
      message.textContent = params.get("error_description") || "This recovery link is invalid or has expired. Request a new link from the sign-in page.";
      button.disabled = true;
    }
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const password = document.getElementById("newPassword").value;
      const confirmation = document.getElementById("confirmPassword").value;
      if (password !== confirmation) {
        message.textContent = "The two passwords do not match.";
        return;
      }
      button.disabled = true;
      button.textContent = "Updating…";
      try {
        const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, refreshToken, password }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        message.classList.add("success");
        message.textContent = data.message;
        setTimeout(() => location.replace("login.html"), 1200);
      } catch (error) {
        message.classList.remove("success");
        message.textContent = error.message || "Could not update your password.";
        button.disabled = false;
        button.textContent = "Update password →";
      }
    });
    return true;
  },

  async logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    localStorage.removeItem("clerkly_user");
    location.href = "login.html";
  }
};

const Clerkly = {
  cases: [],
  selected: null,

  async getCases() {
    try {
      const response = await fetch("/api/cases");
      if (response.status === 401) {
        await Auth.logout();
        return [];
      }
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      return [];
    }
  },

  escape(value) {
    const element = document.createElement("div");
    element.textContent = value || "";
    return element.innerHTML;
  },

  renderTags(value) {
    return String(value || "").split(",").filter(Boolean)
      .map(tag => `<span class="tag">${Clerkly.escape(tag.trim())}</span>`).join("");
  },

  async initCasebook() {
    if (!document.getElementById("caseList")) return;
    Clerkly.cases = await Clerkly.getCases();
    const requestedId = new URLSearchParams(location.search).get("case");
    Clerkly.selected = Clerkly.cases.find(item => String(item.id) === requestedId) || Clerkly.cases[0];
    Clerkly.renderCaseList();
    if (Clerkly.selected) Clerkly.showCase(Clerkly.selected);
    else Clerkly.showEmptyCase();
    document.getElementById("caseSearch").addEventListener("input", Clerkly.renderCaseList);
    document.getElementById("deleteCase").addEventListener("click", Clerkly.deleteSelected);
    document.getElementById("reviewCase").addEventListener("click", Clerkly.markReviewed);
    document.getElementById("printCase").addEventListener("click", Clerkly.printSelectedCase);
  },

  renderCaseList() {
    const query = (document.getElementById("caseSearch")?.value || "").toLowerCase();
    const filtered = Clerkly.cases.filter(item =>
      `${item.title} ${item.posting} ${item.tags}`.toLowerCase().includes(query));
    document.getElementById("caseList").innerHTML = filtered.map(item => `
      <button class="case-item ${Clerkly.selected?.id === item.id ? "active" : ""}" data-id="${item.id}">
        <strong>${Clerkly.escape(item.title)}</strong><small>${Clerkly.escape(item.posting)}</small>${Clerkly.renderTags(item.tags)}
      </button>`).join("") || `<p class="empty-state">No matching cases. Add a new entry or try another search.</p>`;
    document.querySelectorAll(".case-item").forEach(button => button.addEventListener("click", () => {
      Clerkly.selected = Clerkly.cases.find(item => String(item.id) === button.dataset.id);
      Clerkly.renderCaseList();
      Clerkly.showCase(Clerkly.selected);
    }));
  },

  showCase(item) {
    if (!item) return;
    document.getElementById("casePosting").textContent = item.posting;
    document.getElementById("caseTitle").textContent = item.title;
    document.getElementById("caseStatus").textContent = item.status;
    document.getElementById("caseAge").textContent = item.patient_age || "Not recorded";
    document.getElementById("caseGender").textContent = item.patient_gender || "Not recorded";
    document.getElementById("caseRace").textContent = item.patient_race || "Not recorded";
    document.getElementById("caseChiefComplaint").textContent = item.chief_complaint || "Not recorded.";
    document.getElementById("casePresentation").textContent = item.presentation;
    const reviewSelections = Clerkly.parseSystemSelections(item);
    const reviewSummary = Object.entries(reviewSelections).map(([system, symptoms]) => `${system}: ${symptoms.join(", ")}`);
    document.getElementById("caseSystemicReview").textContent = item.systemic_review || "No additional notes.";
    document.getElementById("caseMainSystem").textContent = reviewSummary.length ? `${reviewSummary.length} system${reviewSummary.length === 1 ? "" : "s"} recorded` : "No system selected";
    document.getElementById("caseSystemProblem").textContent = reviewSummary.join(" · ");
    document.getElementById("casePmh").textContent = item.past_medical_history || "Not recorded.";
    document.getElementById("casePsh").textContent = item.past_surgical_history || "Not recorded.";
    document.getElementById("caseDrugHistory").textContent = item.drug_history || "Not recorded.";
    document.getElementById("caseAllergyHistory").textContent = item.allergy_history || "Not recorded.";
    document.getElementById("caseFamilyHistory").textContent = item.family_history || "Not recorded.";
    document.getElementById("caseSocialHistory").textContent = item.social_history || "Not recorded.";
    document.getElementById("caseFindings").textContent = item.findings || "No findings saved yet.";
    document.getElementById("caseProvisionalDiagnosis").textContent = item.provisional_diagnosis || "Not recorded.";
    document.getElementById("caseDifferentials").textContent = item.differential_diagnoses || "Not recorded.";
    document.getElementById("caseInvestigations").textContent = item.investigations || "Not recorded.";
    document.getElementById("caseManagement").textContent = item.management_plan || "Not recorded.";
    document.getElementById("caseLearning").textContent = item.learning;
    document.getElementById("caseSnippets").textContent = item.notes_snippets || "No snippets saved for this case.";
    const imageWrap = document.getElementById("caseImageWrap");
    if (item.case_image) {
      document.getElementById("caseImage").src = item.case_image;
      imageWrap.classList.remove("hidden");
    } else {
      imageWrap.classList.add("hidden");
    }
    document.getElementById("deleteCase").classList.remove("hidden");
    document.getElementById("reviewCase").classList.remove("hidden");
    const editLink = document.getElementById("editCase");
    editLink.classList.remove("hidden");
    editLink.href = `add-case.html?edit=${encodeURIComponent(item.id)}`;
    document.getElementById("printCase").classList.remove("hidden");
    Clerkly.preparePrintSheet(item);
    Clerkly.updateAssistantContext();
  },

  showEmptyCase() {
    document.getElementById("casePosting").textContent = "Casebook";
    document.getElementById("caseTitle").textContent = "No cases saved yet";
    document.getElementById("caseStatus").textContent = "Empty";
    document.getElementById("casePresentation").textContent = "Record your first anonymous case to begin building your clinical casebook.";
    document.getElementById("editCase").classList.add("hidden");
    document.getElementById("reviewCase").classList.add("hidden");
    document.getElementById("deleteCase").classList.add("hidden");
    document.getElementById("printCase").classList.add("hidden");
  },

  preparePrintSheet(item) {
    const numberedLines = value => String(value || "").split(/\n+/).map(line => line.trim()).filter(Boolean).map((line, index) => /^\d+[.)]\s/.test(line) ? line : `${index + 1}. ${line}`).join("\n");
    const values = {
      printWard: item.ward || item.posting,
      printAge: item.patient_age,
      printGender: item.patient_gender,
      printRace: item.patient_race,
      printComplaint: item.chief_complaint,
      printPresentation: item.presentation,
      printHopiSite: item.hopi_site,
      printHopiOnset: item.hopi_onset,
      printHopiCharacter: item.hopi_character,
      printHopiRadiation: item.hopi_radiation,
      printHopiAssociations: item.hopi_associations,
      printHopiTiming: item.hopi_timing,
      printHopiAggravating: item.hopi_aggravating_relief,
      printHopiSeverity: item.hopi_severity,
      printSystemicReview: item.systemic_review,
      printPmh: item.past_medical_history,
      printPsh: item.past_surgical_history,
      printBloodTransfusion: item.past_blood_transfusion,
      printMenstrual: item.menstrual_history,
      printDrug: item.drug_history,
      printAllergy: item.allergy_history,
      printFamilySimilar: item.family_similar_problem || item.family_history,
      printFamilialDisease: item.familial_disease,
      printOccupation: item.occupation,
      printMaritalStatus: item.marital_status,
      printSmoking: item.smoking_history,
      printAlcohol: item.alcohol_history,
      printPromiscuity: item.promiscuity_history,
      printRecreationalDrug: item.recreational_drug_history,
      printTravel: item.travel_history,
      printSocialOther: item.social_other || item.social_history,
      printProvisional: item.provisional_diagnosis,
      printDifferentials: numberedLines(item.differential_diagnoses),
      printInvestigations: numberedLines(item.investigations),
      printManagement: numberedLines(item.management_plan)
    };
    Object.entries(values).forEach(([id, value]) => { document.getElementById(id).textContent = value || ""; });
    document.querySelectorAll("[data-print-system], [data-print-problem]").forEach(element => element.classList.remove("print-selected"));
    Object.entries(Clerkly.parseSystemSelections(item)).forEach(([system, symptoms]) => {
      const selectedSystem = Array.from(document.querySelectorAll("[data-print-system]")).find(element => element.dataset.printSystem === system);
      selectedSystem?.classList.add("print-selected");
      symptoms.forEach(symptom => {
        const selectedProblem = Array.from(selectedSystem?.closest("p")?.querySelectorAll("[data-print-problem]") || []).find(element => element.dataset.printProblem === symptom);
        selectedProblem?.classList.add("print-selected");
      });
    });
  },

  printSelectedCase() {
    if (!Clerkly.selected) return;
    const originalTitle = document.title;
    const safeTitle = String(Clerkly.selected.title || "Clinical case").replace(/[\\/:*?"<>|]/g, "-");
    document.title = `Clerkly - ${safeTitle} - Clerking Sheet`;
    window.addEventListener("afterprint", () => { document.title = originalTitle; }, { once: true });
    window.print();
  },

  async markReviewed() {
    if (!Clerkly.selected) return;
    await fetch(`/api/cases/${Clerkly.selected.id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Reviewed" }) });
    Clerkly.selected.status = "Reviewed";
    Clerkly.showCase(Clerkly.selected);
  },

  async deleteSelected() {
    if (!Clerkly.selected || !confirm("Delete this case permanently?")) return;
    const response = await fetch(`/api/cases/${Clerkly.selected.id}`, { method: "DELETE" });
    if (!response.ok) return alert("The case could not be deleted.");
    Clerkly.cases = Clerkly.cases.filter(item => item.id !== Clerkly.selected.id);
    Clerkly.selected = Clerkly.cases[0];
    Clerkly.renderCaseList();
    if (Clerkly.selected) Clerkly.showCase(Clerkly.selected);
    else Clerkly.showEmptyCase();
  },

  async initAddCase() {
    const form = document.getElementById("caseForm");
    if (!form) return;
    const editId = new URLSearchParams(location.search).get("edit");
    const imageInput = document.getElementById("caseImageInput");
    imageInput.addEventListener("change", () => Clerkly.prepareImage(imageInput.files[0], {
      inputId: "caseImageInput", dataId: "caseImageData", previewId: "imagePreview", helpId: "caseImageHelp"
    }));
    Clerkly.initClerkingGuides();
    if (editId) {
      try {
        const response = await fetch(`/api/cases/${encodeURIComponent(editId)}`);
        const savedCase = await response.json();
        if (!response.ok) throw new Error(savedCase.message || "Could not load this case.");
        Array.from(form.elements).forEach(field => {
          if (field.name && field.name !== "case_image" && field.type !== "file" && savedCase[field.name] !== undefined && savedCase[field.name] !== null) field.value = savedCase[field.name];
        });
        Clerkly.renderSystemSelections(Clerkly.parseSystemSelections(savedCase));
        if (savedCase.case_image) {
          const preview = document.getElementById("imagePreview");
          preview.src = savedCase.case_image;
          preview.classList.remove("hidden");
        }
        document.getElementById("formBreadcrumb").textContent = "Edit case";
        document.getElementById("casePageTitle").textContent = "Update clinical case";
        document.getElementById("caseFormTitle").textContent = "Continue this clerking entry";
        document.getElementById("caseFormSubtitle").textContent = "Add new findings or improve any section, then save your changes.";
        document.getElementById("caseSubmitButton").textContent = "Save changes";
      } catch (error) {
        const notice = document.getElementById("formNotice");
        notice.className = "notice error";
        notice.textContent = error.message;
        notice.style.display = "block";
      }
    }
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const notice = document.getElementById("formNotice");
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const endpoint = editId ? `/api/cases/${encodeURIComponent(editId)}` : "/api/cases";
        const response = await fetch(endpoint, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        notice.className = "notice";
        notice.textContent = editId ? "Changes saved. Returning to your case…" : "Case saved. Returning to your casebook…";
        notice.style.display = "block";
        setTimeout(() => window.location.href = `cases.html?case=${encodeURIComponent(result.id)}`, 800);
      } catch (error) {
        notice.className = "notice error";
        notice.textContent = error.message;
        notice.style.display = "block";
      }
    });
  },

  async prepareImage(file, targets) {
    if (!file) return;
    const help = document.getElementById(targets.helpId);
    const originalHelp = help?.textContent || "";
    try {
      if (help) help.textContent = "Compressing image…";
      const compressed = await compressImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById(targets.dataId).value = reader.result;
        const preview = document.getElementById(targets.previewId);
        preview.src = reader.result;
        preview.classList.remove("hidden");
        if (targets.previewId === "profilePhotoImage") document.getElementById("profilePhotoInitials")?.classList.add("hidden");
        if (help) help.textContent = `Ready to upload · ${(compressed.size / 1024).toFixed(0)} KB after compression.`;
      };
      reader.readAsDataURL(compressed);
    } catch (error) {
      document.getElementById(targets.inputId).value = "";
      if (help) help.textContent = error.message || "Could not compress this image. Try another JPG, PNG or WebP file.";
      setTimeout(() => { if (help && help.textContent.includes("Could not")) help.textContent = originalHelp; }, 5000);
    }
  },

  systemOptions: {
    General: ["Conscious", "Fever", "Lethargy", "LOA", "LOW"],
    Cardiovascular: ["Angina", "Palpitation", "Tachy", "Brady", "Cyanosis", "Edema"],
    Respiratory: ["Cough", "Hemoptysis", "SOB", "Tachypnea", "Stridor", "Wheeze", "Hoarseness"],
    Gastrointestinal: ["Dysphagia", "Vomiting", "Diarrhea", "Pale stool", "Bloody stool", "Mucous stool", "Change of bowel habit", "Constipation"],
    Genitourinary: ["Dysuria", "Polyuria", "Oligouria", "Frequency", "Urgency", "Hematuria", "Sandy", "Nocturia", "Hesitancy", "Incontinence"],
    Neurological: ["Headache", "Dizziness", "Fits", "VD", "GD", "LOS", "Limb weakness"],
    Musculoskeletal: ["Arthralgia", "Myalgia", "Muscle weakness", "Joint swelling"]
  },

  parseSystemSelections(item = {}) {
    const aliases = {
      "Lethargy / fatigue": "Lethargy", "Loss of appetite": "LOA", "Weight loss": "LOW",
      "Chest pain / angina": "Angina", Palpitations: "Palpitation", "Tachycardia / bradycardia": "Tachy",
      "Shortness of breath": "SOB", Oliguria: "Oligouria", "Fits / seizure": "Fits",
      "Visual disturbance": "VD", "Loss of sensation": "LOS", "Pale / bloody / mucous stool": "Pale stool"
    };
    const normalize = selections => Object.fromEntries(Object.entries(selections).map(([system, symptoms]) => [system, (Array.isArray(symptoms) ? symptoms : [symptoms]).map(symptom => aliases[symptom] || symptom).filter(symptom => Clerkly.systemOptions[system]?.includes(symptom))]).filter(([, symptoms]) => symptoms.length));
    try {
      const parsed = JSON.parse(item.systemic_review_selections || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return normalize(parsed);
    } catch (_) {}
    return item.main_system && item.system_problem ? normalize({ [item.main_system]: [item.system_problem] }) : {};
  },

  renderSystemSelections(selections = {}) {
    const container = document.getElementById("systemicReviewSelector");
    if (!container) return;
    container.innerHTML = Object.entries(Clerkly.systemOptions).map(([system, symptoms]) => `<section class="system-review-card"><h3>${Clerkly.escape(system)}</h3><div>${symptoms.map(symptom => `<button type="button" data-review-system="${Clerkly.escape(system)}" data-review-symptom="${Clerkly.escape(symptom)}" class="${selections[system]?.includes(symptom) ? "active" : ""}" aria-pressed="${selections[system]?.includes(symptom) ? "true" : "false"}">${Clerkly.escape(symptom)}</button>`).join("")}</div></section>`).join("");
    Clerkly.syncSystemSelections();
    container.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
      button.classList.toggle("active");
      button.setAttribute("aria-pressed", String(button.classList.contains("active")));
      Clerkly.syncSystemSelections();
    }));
  },

  syncSystemSelections() {
    const selections = {};
    document.querySelectorAll("[data-review-system].active").forEach(button => {
      (selections[button.dataset.reviewSystem] ||= []).push(button.dataset.reviewSymptom);
    });
    const field = document.getElementById("systemicReviewSelections");
    if (field) field.value = JSON.stringify(selections);
    const first = Object.entries(selections)[0];
    const system = document.getElementById("mainSystem");
    const problem = document.getElementById("systemProblem");
    if (system) system.value = first?.[0] || "";
    if (problem) problem.value = first?.[1]?.[0] || "";
  },

  initClerkingGuides() {
    Clerkly.renderSystemSelections();
    const toggle = document.getElementById("toggleHopiGuide");
    toggle?.addEventListener("click", () => {
      const guide = document.getElementById("hopiDetailGrid");
      const hidden = guide.classList.toggle("hidden");
      toggle.textContent = hidden ? "Show guide" : "Hide guide";
      toggle.setAttribute("aria-expanded", String(!hidden));
    });
  },

  async initProfile() {
    const form = document.getElementById("profileForm");
    if (!form) return;
    const notice = document.getElementById("profileNotice");
    const imageInput = document.getElementById("profileImageInput");
    imageInput.addEventListener("change", () => Clerkly.prepareImage(imageInput.files[0], {
      inputId: "profileImageInput", dataId: "profileImageData", previewId: "profilePhotoImage", helpId: "profileImageHelp"
    }));
    try {
      const response = await fetch("/api/profile");
      const profile = await response.json();
      if (!response.ok) throw new Error(profile.message);
      document.getElementById("profileDisplayName").value = profile.displayName || "";
      document.getElementById("profileUsername").value = profile.username || "";
      document.getElementById("profileYear").value = profile.year || "Year 3";
      document.getElementById("profilePosting").value = profile.posting || "Internal Medicine";
      document.getElementById("profileEmail").value = profile.email || "";
      Clerkly.renderProfileCard(profile);
    } catch (error) {
      notice.className = "notice error profile-notice";
      notice.textContent = error.message || "Could not load your profile.";
      notice.style.display = "block";
    }
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = document.getElementById("profileSubmitButton");
      button.disabled = true;
      button.textContent = "Saving…";
      try {
        const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
        const profile = await response.json();
        if (!response.ok) throw new Error(profile.message);
        Auth.currentUser = profile;
        localStorage.setItem("clerkly_user", JSON.stringify(profile));
        Clerkly.renderProfileCard(profile);
        Clerkly.applyProfileUI(profile);
        notice.className = "notice profile-notice";
        notice.textContent = "Profile saved successfully.";
      } catch (error) {
        notice.className = "notice error profile-notice";
        notice.textContent = error.message || "Could not save your profile.";
      } finally {
        notice.style.display = "block";
        button.disabled = false;
        button.textContent = "Save profile";
      }
    });
  },

  renderProfileCard(profile) {
    const name = profile.displayName || "Medical Student";
    document.getElementById("profileCardName").textContent = name;
    document.getElementById("profileCardUsername").textContent = `@${profile.username || "student"}`;
    document.getElementById("profilePhotoInitials").textContent = Clerkly.initials(name);
    document.getElementById("profilePhotoInitials").classList.toggle("hidden", Boolean(profile.avatarUrl));
    if (profile.avatarUrl) {
      const image = document.getElementById("profilePhotoImage");
      image.src = profile.avatarUrl;
      image.classList.remove("hidden");
    }
  },

  initials(name) {
    return String(name || "Medical Student").trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  },

  applyProfileUI(profile = Auth.profile() || {}) {
    const initials = Clerkly.initials(profile.displayName);
    document.querySelectorAll(".avatar").forEach(element => {
      element.textContent = profile.avatarUrl ? "" : initials;
      element.style.backgroundImage = profile.avatarUrl ? `url("${profile.avatarUrl}")` : "";
    });
    const bannerAvatar = document.querySelector(".student-avatar");
    if (bannerAvatar) {
      bannerAvatar.textContent = profile.avatarUrl ? "" : initials;
      bannerAvatar.style.backgroundImage = profile.avatarUrl ? `url("${profile.avatarUrl}")` : "";
      bannerAvatar.style.backgroundSize = "cover";
      bannerAvatar.style.backgroundPosition = "center";
    }
  },

  async initProgress() {
    if (!document.getElementById("totalCases")) return;
    const saved = await Clerkly.getCases();
    document.getElementById("totalCases").textContent = saved.length;
    document.getElementById("reviewedCases").textContent = saved.filter(item => item.status === "Reviewed").length;
    document.getElementById("postingsCount").textContent = new Set(saved.map(item => item.posting)).size;
    const postings = ["Internal Medicine", "Surgery", "Paediatrics", "O&G", "Emergency", "Primary Care"];
    document.getElementById("postingProgress").innerHTML = postings.map(posting => {
      const count = saved.filter(item => item.posting === posting).length;
      const percent = saved.length ? Math.round(count / saved.length * 100) : 0;
      return `<div class="progress-row"><div><strong>${posting}</strong><span>${count} cases</span></div><span class="progress-bar"><i style="width:${percent}%"></i></span></div>`;
    }).join("");
    document.getElementById("reviewList").innerHTML = saved.filter(item => item.status !== "Reviewed").slice(0, 6)
      .map(item => `<li><span>${Clerkly.escape(item.title)}</span><strong>${Clerkly.escape(item.posting)}</strong></li>`).join("") || "<li>Nothing waiting for review.</li>";
  },

  async initDashboard() {
    if (!document.getElementById("dashboardStudentName")) return;
    const profile = Auth.profile() || { displayName: "Medical Student", year: "Year 3", posting: "Internal Medicine" };
    const cases = await Clerkly.getCases();
    const saved = cases;
    const toReview = saved.filter(item => item.status !== "Reviewed");
    document.getElementById("dashboardStudentName").textContent = profile.displayName;
    document.getElementById("dashboardYear").textContent = profile.year;
    document.getElementById("dashboardPosting").textContent = profile.posting;
    Clerkly.applyProfileUI(profile);
    document.getElementById("dashboardDate").textContent = new Intl.DateTimeFormat("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
    document.getElementById("dashboardCaseCount").textContent = saved.length;
    document.getElementById("dashboardReviewCount").textContent = toReview.length;
    document.getElementById("dashboardPostingCount").textContent = new Set(saved.map(item => item.posting)).size;
    document.getElementById("recentCases").innerHTML = saved.slice(0, 4).map(item => `<a href="cases.html?case=${encodeURIComponent(item.id)}"><span><strong>${Clerkly.escape(item.title)}</strong><small>${Clerkly.escape(item.posting)}</small></span><b>→</b></a>`).join("") || `<div class="dashboard-empty">No personal cases yet. <a href="add-case.html">Record your first case</a>.</div>`;
    document.getElementById("reviewQueue").innerHTML = toReview.slice(0, 4).map(item => `<li><span>${Clerkly.escape(item.title)}</span><b>${Clerkly.escape(item.posting)}</b></li>`).join("") || `<li class="dashboard-empty">You are all caught up.</li>`;
  },

  initFloatingAssistant() {
    document.body.insertAdjacentHTML("beforeend", `
      <button class="chat-fab" id="chatFab" aria-label="Open clinical copilot">✦</button>
      <section class="floating-chat" id="floatingChat" aria-label="Clinical copilot">
        <header><div><span class="assistant-orb">✦</span><span><small>CLERKLY AI</small><strong>Clinical copilot</strong></span></div><button id="closeChat" aria-label="Close chat">×</button></header>
        <p class="floating-context">Working from: <strong id="assistantContext">general study mode</strong></p>
        <div class="chat" id="chat"><div class="message"><span>✦</span><p>How can I help you study today?</p></div></div>
        <div class="quick-actions"><button data-prompt="Guide me through clerking this case step by step.">Clerk a case</button><button data-prompt="Build a prioritized differential diagnosis.">Differentials</button><button data-prompt="Create a safe assessment and management framework.">Management</button><button data-prompt="Quiz me with viva questions.">Quiz me</button></div>
        <form class="assistant-form" id="assistantForm"><textarea id="assistantInput" rows="3" placeholder="Ask a clinical learning question…"></textarea><div><span>For learning, not clinical decisions</span><button aria-label="Send">↑</button></div></form>
      </section>`);
    document.getElementById("chatFab").addEventListener("click", () => document.getElementById("floatingChat").classList.add("open"));
    document.getElementById("closeChat").addEventListener("click", () => document.getElementById("floatingChat").classList.remove("open"));
    document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => Clerkly.ask(button.dataset.prompt)));
    document.getElementById("assistantForm").addEventListener("submit", event => {
      event.preventDefault();
      Clerkly.ask(document.getElementById("assistantInput").value);
    });
    Clerkly.updateAssistantContext();
  },

  updateAssistantContext() {
    const context = document.getElementById("assistantContext");
    if (context) context.textContent = Clerkly.selected?.title || "general study mode";
  },

  async ask(prompt) {
    prompt = String(prompt || "").trim();
    if (!prompt) return;
    const chat = document.getElementById("chat");
    chat.insertAdjacentHTML("beforeend", `<div class="message student"><span>AZ</span><p>${Clerkly.escape(prompt)}</p></div>`);
    document.getElementById("assistantInput").value = "";
    const waiting = document.createElement("div");
    waiting.className = "message";
    waiting.innerHTML = "<span>✦</span><p>Thinking through the case…</p>";
    chat.appendChild(waiting);
    chat.scrollTop = chat.scrollHeight;
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, caseData: Clerkly.selected || {} }) });
      const data = await response.json();
      waiting.querySelector("p").textContent = data.answer || data.message;
    } catch {
      waiting.querySelector("p").textContent = "The study assistant is unavailable. Please try again.";
    }
    chat.scrollTop = chat.scrollHeight;
  }
};

window.Auth = Auth;
window.Clerkly = Clerkly;

document.addEventListener("DOMContentLoaded", async () => {
  if (Auth.initPasswordReset()) return;
  if (Auth.initLogin()) return;
  if (!await Auth.guard()) return;
  Clerkly.initCasebook();
  Clerkly.initAddCase();
  Clerkly.initProgress();
  Clerkly.initDashboard();
  Clerkly.initProfile();
  Clerkly.applyProfileUI();
  Clerkly.initFloatingAssistant();
});
