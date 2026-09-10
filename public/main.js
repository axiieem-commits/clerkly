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
      const response = await fetch("/api/auth/session");
      if (!response.ok) throw new Error();
      const data = await response.json();
      Auth.currentUser = data.user;
      localStorage.setItem("clerkly_user", JSON.stringify(data.user));
      return true;
    } catch {
      localStorage.removeItem("clerkly_user");
      location.replace("login.html");
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
    const message = document.getElementById("loginMessage");

    toggleButton.addEventListener("click", () => {
      signupMode = !signupMode;
      modeTitle.textContent = signupMode ? "Create your account" : "Welcome back";
      modeHelp.textContent = signupMode ? "Use an email you can access for account confirmation." : "Sign in securely to access your casebook.";
      displayNameField.classList.toggle("hidden", !signupMode);
      displayName.required = signupMode;
      document.getElementById("loginPassword").autocomplete = signupMode ? "new-password" : "current-password";
      submitButton.textContent = signupMode ? "Create account →" : "Sign in →";
      toggleButton.textContent = signupMode ? "Already have an account? Sign in" : "New to Clerkly? Create an account";
      message.textContent = "";
      message.classList.remove("success");
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
          body: JSON.stringify({ email, password, displayName: displayName.value.trim() })
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
    document.getElementById("caseSystemicReview").textContent = item.systemic_review || "Not recorded.";
    document.getElementById("caseMainSystem").textContent = item.main_system || "No system selected";
    document.getElementById("caseSystemProblem").textContent = item.system_problem || "";
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
        Clerkly.updateSystemProblems(savedCase.system_problem || "");
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
    General: ["Fever", "Lethargy / fatigue", "Loss of appetite", "Weight loss", "Other"],
    Cardiovascular: ["Chest pain / angina", "Palpitations", "Tachycardia / bradycardia", "Cyanosis", "Edema", "Other"],
    Respiratory: ["Cough", "Hemoptysis", "Shortness of breath", "Tachypnea", "Stridor", "Wheeze", "Hoarseness", "Other"],
    Gastrointestinal: ["Dysphagia", "Vomiting", "Diarrhea", "Pale / bloody / mucous stool", "Change of bowel habit", "Constipation", "Other"],
    Genitourinary: ["Dysuria", "Polyuria", "Oliguria", "Frequency", "Urgency", "Hematuria", "Nocturia", "Hesitancy", "Incontinence", "Other"],
    Neurological: ["Headache", "Dizziness", "Fits / seizure", "Visual disturbance", "Loss of sensation", "Limb weakness", "Other"],
    Musculoskeletal: ["Arthralgia", "Myalgia", "Muscle weakness", "Joint swelling", "Other"]
  },

  updateSystemProblems(selectedProblem = "") {
    const system = document.getElementById("mainSystem");
    const problem = document.getElementById("systemProblem");
    if (!system || !problem) return;
    const options = Clerkly.systemOptions[system.value] || [];
    problem.disabled = !options.length;
    problem.innerHTML = options.length ? `<option value="">Select a symptom</option>${options.map(value => `<option>${Clerkly.escape(value)}</option>`).join("")}` : '<option value="">Select a main system first</option>';
    if (options.includes(selectedProblem)) problem.value = selectedProblem;
    document.querySelectorAll("[data-system]").forEach(button => button.classList.toggle("active", button.dataset.system === system.value));
  },

  initClerkingGuides() {
    const system = document.getElementById("mainSystem");
    if (!system) return;
    system.addEventListener("change", () => Clerkly.updateSystemProblems());
    document.querySelectorAll("[data-system]").forEach(button => button.addEventListener("click", () => {
      system.value = button.dataset.system;
      Clerkly.updateSystemProblems();
      document.getElementById("systemProblem").focus();
    }));
    document.querySelectorAll("[data-hopi-guide]").forEach(button => button.addEventListener("click", () => {
      const field = document.getElementById("hopiText");
      const prefix = field.value.trim() ? "\n" : "";
      field.value += `${prefix}${button.dataset.hopiGuide}: `;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }));
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
