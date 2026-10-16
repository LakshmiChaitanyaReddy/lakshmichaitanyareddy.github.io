/* ==========================================================================
   looks.js — the customer-facing design choices.

   Three things are kept strictly apart:
     Theme     colours, type, spacing, surfaces     js/themes.js
     Template  page structure and storytelling      js/skeletons.js (+ pack labels)
     Content   the person's own data                data.profile, experience, …

   Eight general looks, one per template (look id === template id), then
   profession looks (chartered accountant, teacher, doctor, nurse, lawyer):
   each is a template with its own theme, resume layout, section names and
   order, so a doctor's portfolio reads "Clinical appointments" and
   "Registrations & licences", not "Experience" and "Certifications".
   Each look is paired with the theme, resume layout and section names that suit it.
   Choosing a look writes ONLY design keys (theme, template, sectionLabels,
   sectionOrder, pdf.template) — never a name, job, project or number.
   `example` names the fictional starter used for gallery thumbnails when the
   customer has no content yet; it is never copied into a real portfolio.

   Loaded by the builder, and by the service through vm (lib/aiContract.js),
   so the AI's allowed template list and the customer's gallery are the same.
   Retired look ids (the pre-2026-10 ten) resolve through ALIASES.
   ========================================================================== */
(function () {
  "use strict";
  const PF = (window.PF = window.PF || {});
  PF.modules = PF.modules || {};
  PF.provide = PF.provide || function (n, api) { PF[n] = api; PF.modules[n] = true; };

  const LOOKS = [
    { id: "clean-recruiter", name: "Clean Recruiter", blurb: "Simple, professional and ATS-friendly: a strong summary, experience first, skills as plain lists.",
      skeleton: "clean-recruiter", theme: "minimal-light", mode: "light", pack: "software-it", resume: "ats", example: "clean-recruiter",
      order: ["about", "experience", "skills", "projects", "education", "certifications"],
      labels: { about: "Summary", experience: "Experience", skills: "Skills", projects: "Projects", education: "Education", certifications: "Certifications" } },
    { id: "technical-terminal", name: "Technical Terminal", blurb: "Command-line inspired for developers: repositories, a stack file and a commit-log career.",
      skeleton: "technical-terminal", theme: "technical-dark", mode: "dark", pack: "software-it", resume: "technical", example: "technical-terminal",
      order: ["projects", "skills", "experience", "about", "certifications", "education"],
      labels: { about: "About", projects: "Projects", skills: "Stack", experience: "Experience", certifications: "Certifications", education: "Education" } },
    { id: "executive-dossier", name: "Executive Dossier", blurb: "A premium leadership profile: at-a-glance panel, selected achievements, career and case studies.",
      skeleton: "executive-dossier", theme: "executive-navy", mode: "light", pack: "product-program", resume: "executive", example: "executive-dossier",
      order: ["about", "experience", "projects", "certifications", "education", "skills"],
      labels: { about: "Profile", experience: "Career", projects: "Selected case studies", certifications: "Credentials", education: "Education", skills: "Areas of expertise" } },
    { id: "product-case-study", name: "Product Case Study", blurb: "Your positioning as the headline and every project told as problem, approach and result.",
      skeleton: "product-case-study", theme: "soft-modern", mode: "light", pack: "design-creative", resume: "modern", example: "product-case-study",
      order: ["projects", "about", "experience", "skills", "education", "certifications"],
      labels: { projects: "Case studies", about: "How I work", experience: "Experience", skills: "Toolkit", education: "Education", certifications: "Certifications" } },
    { id: "academic-cv", name: "Academic CV", blurb: "Research-first CV: identity column, publications as citations, education and appointments by date.",
      skeleton: "academic-cv", theme: "academic-paper", mode: "light", pack: "academia-research", resume: "academic", example: "academic-cv",
      order: ["about", "education", "experience", "projects", "certifications", "skills"],
      labels: { about: "Research", education: "Education", experience: "Appointments", projects: "Research projects", certifications: "Grants & awards", skills: "Methods & tools" } },
    { id: "freelancer-services", name: "Freelancer Services", blurb: "Built to win clients: a clear offer, services, case studies, testimonials and a strong contact call.",
      skeleton: "freelancer-services", theme: "warm-professional", mode: "light", pack: "marketing-sales", resume: "modern", example: "freelancer-services",
      order: ["skills", "projects", "about", "experience", "certifications", "education"],
      labels: { skills: "Services", projects: "Case studies", about: "About", experience: "Background", certifications: "Credentials", education: "Education" } },
    { id: "creative-showcase", name: "Creative Showcase", blurb: "Visual and project-first: poster-size name and a wall of work, with the words kept short.",
      skeleton: "creative-showcase", theme: "bold-gradient", mode: "dark", pack: "design-creative", resume: "modern", example: "creative-showcase",
      order: ["projects", "about", "experience", "skills", "education", "certifications"],
      labels: { projects: "Work", about: "About", experience: "Clients & roles", skills: "Disciplines", education: "Education", certifications: "Recognition" } },
    { id: "data-report", name: "Data Analyst Report", blurb: "Dashboard-style: KPIs and charts built from your own data, with case studies laid out as findings.",
      skeleton: "data-report", theme: "executive-navy", mode: "dark", pack: "data-analytics", resume: "modern", example: "data-report",
      order: ["about", "projects", "skills", "experience", "certifications", "education"],
      labels: { about: "Summary", projects: "Case studies", skills: "Skill coverage", experience: "Career timeline", certifications: "Certifications", education: "Education" } },
    { id: "studio-split", name: "Studio Split", blurb: "A sticky profile panel and a roomy content canvas that turns concise portfolios into an intentional two-column page.",
      skeleton: "studio-split", theme: "apple-glass", mode: "dark", pack: "software-it", resume: "modern", example: "clean-recruiter",
      order: ["about", "skills", "experience", "projects", "education", "certifications"],
      labels: { about: "Profile", skills: "Capabilities", experience: "Experience", projects: "Selected work", education: "Education", certifications: "Credentials" } },
    { id: "modern-ledger", name: "Modern Ledger", blurb: "A broad editorial page with numbered section rails, crisp rules and balanced multi-column content.",
      skeleton: "modern-ledger", theme: "editorial-bw", mode: "dark", pack: "product-program", resume: "classic", example: "executive-dossier",
      order: ["about", "experience", "projects", "skills", "education", "certifications"],
      labels: { about: "Overview", experience: "Career ledger", projects: "Selected work", skills: "Capabilities", education: "Education", certifications: "Credentials" } },
    { id: "engineering-blueprint", group: "it", name: "Engineering Blueprint", blurb: "A sticky engineering profile beside repository-style projects, stack specifications and delivery history.",
      skeleton: "engineering-blueprint", theme: "circuit-cyan", mode: "dark", pack: "software-it", resume: "technical", example: "software-developer",
      order: ["projects", "skills", "experience", "about", "certifications", "education"],
      labels: { projects: "Systems & builds", skills: "Technical specification", experience: "Delivery history", about: "Engineering approach", certifications: "Credentials", education: "Education" } },
    { id: "project-workbench", group: "it", name: "Project Workbench", blurb: "A project-first IT portfolio with a strong introduction and detailed problem-to-result build stories.",
      skeleton: "project-workbench", theme: "graphite-lime", mode: "dark", pack: "software-it", resume: "modern", example: "software-developer",
      order: ["projects", "skills", "experience", "about", "education", "certifications"],
      labels: { projects: "Build log", skills: "Tools & platforms", experience: "Teams & roles", about: "How I build", education: "Education", certifications: "Credentials" } },
    { id: "systems-architect", group: "it", name: "Systems Architect", blurb: "An architecture-led technology profile with decisions, systems delivered and a visual capability map.",
      skeleton: "systems-architect", theme: "executive-navy", mode: "dark", pack: "software-it", resume: "executive", example: "software-developer",
      order: ["about", "projects", "skills", "experience", "certifications", "education"],
      labels: { about: "Architecture perspective", projects: "Systems delivered", skills: "Capability map", experience: "Architecture roles", certifications: "Credentials", education: "Education" } },
    { id: "cloud-operations", group: "it", name: "Cloud Operations", blurb: "Operations board for cloud, platform and DevOps work: deployments, service map and delivery record.",
      skeleton: "cloud-operations", theme: "signal-grid", mode: "dark", pack: "software-it", resume: "technical", example: "software-developer",
      order: ["projects", "skills", "experience", "about", "certifications", "education"],
      labels: { projects: "Deployments", skills: "Service map", experience: "Operating history", about: "Approach", certifications: "Credentials", education: "Education" } },
    { id: "security-brief", group: "it", name: "Security Brief", blurb: "Security and reliability portfolio that presents projects as numbered evidence and outcomes.",
      skeleton: "security-brief", theme: "poster-impact", mode: "dark", pack: "software-it", resume: "ats", example: "software-developer",
      order: ["about", "projects", "skills", "experience", "certifications", "education"],
      labels: { about: "Profile brief", projects: "Evidence & outcomes", skills: "Control areas", experience: "Professional record", certifications: "Credentials", education: "Education" } },

    /* ---- by profession: a structure + theme + wording made for the job ---- */
    { id: "chartered-accountant", group: "profession", retired: true, name: "Chartered Accountant", blurb: "Credentials first, then engagements and advisory results. Precise, calm and built to be trusted with numbers.",
      skeleton: "executive-dossier", theme: "porcelain", mode: "light", pack: "finance-accounting", resume: "executive", example: "chartered-accountant",
      order: ["about", "certifications", "experience", "projects", "education", "skills"],
      labels: { about: "Profile", certifications: "Qualifications & registrations", experience: "Finance engagements", projects: "Advisory & transformation", education: "Education", skills: "Finance expertise" } },
    { id: "teacher-educator", group: "profession", retired: true, name: "Teacher & Educator", blurb: "How you teach, classroom projects told as problem, approach and outcome, and your qualifications. Warm and clear.",
      skeleton: "product-case-study", theme: "sage-calm", mode: "light", pack: "education-teaching", resume: "modern", example: "teacher-educator",
      order: ["about", "projects", "experience", "education", "certifications", "skills"],
      labels: { about: "How I teach", projects: "Classroom projects", experience: "Teaching experience", education: "Education", certifications: "Qualifications & training", skills: "Teaching practice" } },
    { id: "doctor-clinician", group: "profession", retired: true, name: "Doctor & Clinician", blurb: "Clinical appointments, registrations and licences, audit and research. Calm, factual and easy for a panel to scan.",
      skeleton: "academic-cv", theme: "sky-calm", mode: "light", pack: "healthcare-clinical", resume: "academic", example: "doctor-clinician",
      order: ["about", "experience", "certifications", "education", "projects", "skills"],
      labels: { about: "Profile", experience: "Clinical appointments", certifications: "Registrations & licences", education: "Medical education", projects: "Audit, research & service improvement", skills: "Clinical skills" } },
    { id: "nurse-allied-health", group: "profession", retired: true, name: "Nurse & Allied Health", blurb: "Clinical experience, competencies and licences up front, with service improvement work that shows your impact.",
      skeleton: "clean-recruiter", theme: "sky-calm", mode: "light", pack: "healthcare-clinical", resume: "ats", example: "nurse-allied-health",
      order: ["about", "experience", "skills", "certifications", "education", "projects"],
      labels: { about: "Profile", experience: "Clinical experience", skills: "Clinical competencies", certifications: "Licences & certifications", education: "Education", projects: "Service improvement" } },
    { id: "lawyer-counsel", group: "profession", retired: true, name: "Lawyer & Counsel", blurb: "Practice areas, representative matters and admissions, in a restrained serif style that reads as advice you can trust.",
      skeleton: "executive-dossier", theme: "sand-linen", mode: "light", pack: "legal", resume: "classic", example: "lawyer-counsel",
      order: ["about", "projects", "experience", "certifications", "education", "skills"],
      labels: { about: "Profile", projects: "Selected matters", experience: "Career", certifications: "Admissions & credentials", education: "Education", skills: "Practice areas" } }
  ];
  LOOKS.forEach(function (l, i) { l.sort = i + 1; l.group = l.group || "general"; });
  const GALLERY = LOOKS.filter(function (l) { return !l.retired; });

  /* The ten retired looks → the look that replaced each one. */
  const ALIASES = {
    engineer: "technical-terminal", designer: "product-case-study", analyst: "data-report", "new-grad": "clean-recruiter",
    executive: "executive-dossier", freelancer: "freelancer-services", academic: "academic-cv", creative: "creative-showcase",
    professional: "clean-recruiter", clean: "clean-recruiter"
  };

  const INDEX = {};
  LOOKS.forEach(function (l) { INDEX[l.id] = l; });
  function canonical(id) {
    if (typeof id !== "string" || !id) return null;
    if (INDEX[id]) return id;
    return ALIASES[id] && INDEX[ALIASES[id]] ? ALIASES[id] : null;
  }
  function byId(id) { const c = canonical(id); return c ? INDEX[c] : null; }

  /* Tone nudges the theme only; the template follows the goal and role. */
  const TONE_THEMES = { professional: null, bold: "bold-gradient", technical: "technical-dark", executive: "executive-navy", creative: "creative-colorful" };
  const TONE_MODES = { bold: "dark", technical: "dark", executive: "light", creative: "light" };
  /* These two looks are designed as one piece with their theme. */
  const THEME_LOCKED = { "technical-terminal": true, "creative-showcase": true };

  const GOALS = [
    { id: "job", label: "Job search" }, { id: "freelance", label: "Freelance / consulting" },
    { id: "brand", label: "Personal brand" }, { id: "academic", label: "Academic / research" }, { id: "creative", label: "Creative portfolio" }
  ];
  const TONES = [
    { id: "professional", label: "Clean professional" }, { id: "bold", label: "Bold modern" }, { id: "technical", label: "Technical" },
    { id: "executive", label: "Executive" }, { id: "creative", label: "Creative" }
  ];

  /* First match wins, so the order matters: a "Chief Data Officer" is an
     executive before an analyst, a "UX researcher" a designer before an
     academic, and a civil engineer is not a software developer. */
  const ROLE_HINTS = [
    [/\b(ceo|cfo|cto|coo|cmo|cio|ciso|chief|vp|svp|evp|vice president|president|managing director|general manager|head of|partner|executive director|director)\b/i, "executive-dossier"],
    [/\b(professor|lecturer|postdoc|post-doctoral|postdoctoral|ph\.?\s?d|doctoral|faculty)\b/i, "academic-cv"],
    [/\b(student|graduate|intern|new grad|undergrad|bootcamp|apprentice|trainee)\b/i, "clean-recruiter"],
    [/\b(graphic|brand|visual|motion|fashion|interior|textile|game|3d)\s+(designer|artist)\b/i, "creative-showcase"],
    [/\b(designer|ux|ui|product design|interaction|product manager|product owner|product lead|service design)\b/i, "product-case-study"],
    [/\b(data|analyst|analytics|bi|business intelligence|statistic\w*|machine learning|ml|quant\w*)\b/i, "data-report"],
    [/\b(researcher|scientist|research|academic|fellow)\b/i, "academic-cv"],
    [/\b(chartered accountant|accountant|auditor|finance controller|financial controller|bookkeeper|cpa|cma|acca)\b/i, "executive-dossier"],
    [/\b(teacher|tutor|educator|school|classroom|headteacher|head teacher|early years|teaching assistant)\b/i, "product-case-study"],
    [/\b(doctor|physician|surgeon|gp|general practitioner|registrar|clinician|paediatrician|pediatrician|psychiatrist|cardiologist|anaesthetist|anesthesiologist|radiologist|dentist|medical officer)\b/i, "academic-cv"],
    [/\b(nurse|nursing|midwife|paramedic|physio\w*|therapist|pharmacist|radiographer|occupational therapist|dietitian|allied health)\b/i, "clean-recruiter"],
    [/\b(lawyer|attorney|solicitor|barrister|advocate|counsel|paralegal|legal)\b/i, "executive-dossier"],
    [/\b(civil|mechanical|electrical|chemical|structural|process|manufacturing|biomedical)\s+engineer/i, "clean-recruiter"],
    [/\b(security|cybersecurity|soc|security engineer|threat|incident response)\b/i, "security-brief"],
    [/\b(devops|sre|cloud|platform|infrastructure|site reliability)\b/i, "cloud-operations"],
    [/\b(engineer|developer|programmer|software|backend|frontend|full[- ]?stack|solutions architect)\b/i, "technical-terminal"],
    [/\b(artist|photograph\w*|illustrat\w*|film\w*|video\w*|animator|creative|musician|art director|architect|designer)\b/i, "creative-showcase"],
    [/\b(freelance\w*|consultant|independent|self-employed|contractor|founder|owner|studio)\b/i, "freelancer-services"],
    [/\b(nurse|physician|doctor|clinical|therap\w*|pharmac\w*|health\w*|accountant|finance|legal|lawyer|attorney|counsel|hr|people|operations|manager|teacher|educator|sales|marketing|writer)\b/i, "clean-recruiter"]
  ];

  /* recommend({ goal, role, tone }) → a look id. Deterministic, so the offline
     builder and an AI that returns an unknown id land in the same place. */
  function recommend(ctx) {
    ctx = ctx || {};
    if (ctx.goal === "academic") return "academic-cv";
    if (ctx.goal === "freelance") return "freelancer-services";
    const role = String(ctx.role || "");
    for (const [re, id] of ROLE_HINTS) if (re.test(role)) return id;
    if (ctx.goal === "creative") return "creative-showcase";
    if (ctx.tone === "executive") return "executive-dossier";
    if (ctx.tone === "technical") return "technical-terminal";
    if (ctx.tone === "creative") return "creative-showcase";
    if (ctx.goal === "brand") return "product-case-study";
    return "clean-recruiter";
  }

  const BUILTINS = ["about", "skills", "experience", "projects", "certifications", "education"];

  /* The design keys a look owns. Pure: returns a patch, touches nothing. */
  function design(look, tone) {
    const l = typeof look === "string" ? byId(look) : look;
    if (!l) return null;
    const toned = tone && TONE_THEMES[tone] && !THEME_LOCKED[l.id] ? TONE_THEMES[tone] : null;
    const pack = PF.packs && PF.packs.byId ? PF.packs.byId(l.pack) : null;
    const labels = {};
    BUILTINS.forEach(function (k) {
      const v = (l.labels && l.labels[k]) || (pack && pack.labels && pack.labels[k]);
      if (v) labels[k] = v;
    });
    return {
      theme: { preset: toned || l.theme, mode: toned ? (TONE_MODES[tone] || l.mode) : l.mode },
      template: { skeleton: l.skeleton, pack: l.pack, look: l.id },
      sectionOrder: l.order.slice(),
      sectionLabels: labels,
      pdf: { template: l.resume }
    };
  }

  /* apply(data, lookId, tone) — writes design only, in place. Custom colour
     tweaks are cleared because they were tuned for the previous theme; saved
     custom themes are kept. The six built-in section names are reset to the
     look's, so a previous look's names never linger. */
  function apply(data, lookId, tone) {
    const patch = design(lookId, tone);
    if (!patch || !data) return data;
    data.theme = Object.assign({}, data.theme || {}, { preset: patch.theme.preset, mode: patch.theme.mode, vars: {}, fonts: {} });
    data.template = Object.assign({}, data.template || {}, patch.template);
    data.sectionOrder = patch.sectionOrder;
    data.pdf = Object.assign({}, data.pdf || {}, { template: patch.pdf.template });
    data.sectionLabels = Object.assign({}, data.sectionLabels || {}, patch.sectionLabels);
    return data;
  }

  /* The Design screen exposes template and theme as independent choices.
     Keep apply() for onboarding's coordinated starter combinations; use this
     narrower operation when a person explicitly chooses page structure. */
  function applyTemplate(data, lookId) {
    const l = byId(lookId);
    if (!l || !data) return data;
    const patch = design(l);
    data.template = Object.assign({}, data.template || {}, patch.template);
    data.sectionOrder = patch.sectionOrder;
    data.sectionLabels = Object.assign({}, data.sectionLabels || {}, patch.sectionLabels);
    return data;
  }

  /* Which look a document is wearing: its stored look (old ids resolve),
     else the look whose template it uses (old skeleton ids resolve too). */
  function current(data) {
    const t = data && data.template || {};
    const stored = canonical(t.look);
    if (stored) return stored;
    const sk = PF.skeletons && PF.skeletons.canonical ? PF.skeletons.canonical(t.skeleton) : t.skeleton;
    const hit = LOOKS.find(function (l) { return l.skeleton === sk; });
    return hit ? hit.id : null;
  }

  PF.provide("looks", {
    LIST: LOOKS, GALLERY: GALLERY, GOALS: GOALS, TONES: TONES, TONE_THEMES: TONE_THEMES, ALIASES: ALIASES,
    byId: byId, canonical: canonical, recommend: recommend, design: design, apply: apply, applyTemplate: applyTemplate, current: current
  });
})();
