/* ==========================================================================
   skeletons.js — the template (structure) registry.

   A template is page STRUCTURE and storytelling: nav placement, hero
   composition, how each section presents (cards, lists, tables, charts),
   default section order, density and typographic hierarchy. Colour and font
   families stay in js/themes.js; a template never touches section wording
   the customer wrote or which custom sections exist — that's content, or a
   profession pack (js/packs.js, builder-only).

   render.js resolves the active template on every paint() the same way it
   resolves the active theme, so it ships identically to the builder Preview,
   the GitHub Pages export and the hosted /u/:slug page. Each template has
   its own hero and section renderers in render.js (TEMPLATE_VIEWS) and its
   own block in site.html (body[data-skeleton="…"]).

   Fields render.js reads:
     navMode      "top" | "side"          side = vertical rail at ≥960px
     density      "normal" | "dense"
     showStatBand whether the hero carries the computed-figures strip
     order        default section order, used only while the customer has
                  not set data.sectionOrder themselves
     labels       fallback eyebrow/nav labels for the built-ins, used only
                  when data.sectionLabels has no entry of its own
     headings     fallback section headings (same rule)
     contact      fallback footer heading/blurb (profile fields win)
     brand        "first" | "full" | "path" — how the header names the person
     filters      whether Projects gets the technology filter bar

   COMPATIBILITY: sites store a skeleton id. The sixteen retired ids resolve
   through ALIASES; an unknown id falls back to clean-recruiter.
   ========================================================================== */
(function () {
  "use strict";
  const PF = (window.PF = window.PF || {});
  PF.modules = PF.modules || {};
  PF.provide = PF.provide || function (n, api) { PF[n] = api; PF.modules[n] = true; };

  const SKELETONS = [
    {
      careerChart: "default", id: "clean-recruiter", name: "Clean Recruiter",
      blurb: "Calm single column that reads like a well-set resume: strong summary, experience first, skills as plain lists. ATS-friendly and quick to scan.",
      navMode: "top", heroVariant: "recruiter", showStatBand: true, density: "normal", brand: "full", filters: false, sectionContainer: true,
      order: ["about", "experience", "skills", "projects", "education", "certifications"],
      labels: {}, headings: { about: "Summary", experience: "Experience", skills: "Skills", projects: "Selected projects", education: "Education", certifications: "Certifications" },
      sketch: [
        "┌──────────────────────┐",
        "│ Name            nav  │",
        "├──────────────────────┤",
        "│ Name                 │",
        "│ Role · City          │",
        "│ Summary paragraph…   │",
        "│ 4.5 yrs · 5 projects │",
        "├──────────────────────┤",
        "│ EXPERIENCE ───────── │",
        "│ Role, Company   2024 │",
        "│ • achievement        │",
        "│ SKILLS ───────────── │",
        "└──────────────────────┘"
      ]
    },
    {
      careerChart: "default", id: "technical-terminal", name: "Technical Terminal",
      blurb: "Command-line inspired: a file-tree side rail, a terminal-window hero, projects as repositories, skills as a config file and experience as a commit log.",
      navMode: "side", heroVariant: "terminal", showStatBand: true, density: "dense", brand: "path", filters: true,
      order: ["projects", "skills", "experience", "about", "certifications", "education"],
      labels: {}, headings: { projects: "projects/", skills: "stack.yml", experience: "git log --career", about: "README.md", certifications: "certs/", education: "education/" },
      sketch: [
        "┌──────┬───────────────┐",
        "│ ~/   │ ● ● ●  zsh    │",
        "│ ./   │ $ whoami      │",
        "│ proj │ Name — Role   │",
        "│ stack├───────────────┤",
        "│ log  │ [repo] [repo] │",
        "│      │ stack.yml     │",
        "│      │ git log       │",
        "└──────┴───────────────┘"
      ]
    },
    {
      careerChart: "default", id: "executive-dossier", name: "Executive Dossier",
      blurb: "A premium leadership profile: portrait and at-a-glance panel, selected achievements, index-numbered chapters and case studies told as challenge, approach and outcome.",
      navMode: "top", heroVariant: "dossier", showStatBand: false, density: "normal", brand: "full", filters: false,
      order: ["about", "experience", "projects", "certifications", "education", "skills"],
      labels: {}, headings: { about: "Leadership profile", experience: "Career", projects: "Selected case studies", certifications: "Credentials", education: "Education", skills: "Areas of expertise" },
      sketch: [
        "┌──────────────────────┐",
        "│ NAME            nav  │",
        "├────────────┬─────────┤",
        "│ Name       │ PORTRAIT│",
        "│ Leadership │ at a    │",
        "│ summary    │ glance  │",
        "├────┬───────┴─────────┤",
        "│ 01 │ Achievements    │",
        "│ 02 │ Career          │",
        "│ 03 │ Case studies    │",
        "└────┴─────────────────┘"
      ]
    },
    {
      careerChart: "optional", id: "product-case-study", name: "Product Case Study",
      blurb: "Your positioning line is the headline and each project is a full chapter — problem, approach, result — with a numbered case index up front. For designers, PMs and product people.",
      navMode: "top", heroVariant: "statement", showStatBand: false, density: "normal", brand: "first", filters: false,
      order: ["projects", "about", "experience", "skills", "education", "certifications"],
      labels: {}, headings: { projects: "Case studies", about: "How I work", experience: "Experience", skills: "Toolkit", education: "Education", certifications: "Certifications" },
      sketch: [
        "┌──────────────────────┐",
        "│ Name · Role     nav  │",
        "├──────────────────────┤",
        "│ A BIG POSITIONING    │",
        "│ STATEMENT.           │",
        "│ 01 Case · 02 Case    │",
        "├──────────────────────┤",
        "│ 01  Case title       │",
        "│ [      cover       ] │",
        "│ Problem│Approach│Res │",
        "└──────────────────────┘"
      ]
    },
    {
      careerChart: "default", id: "academic-cv", name: "Academic CV",
      blurb: "The classic academic homepage: a sticky identity column with affiliation and links beside a CV — research, publications as numbered citations, education and appointments by date.",
      navMode: "top", heroVariant: "sidebar", showStatBand: false, density: "dense", brand: "full", filters: false, sectionContainer: true,
      order: ["about", "education", "experience", "projects", "certifications", "skills"],
      labels: {}, headings: { about: "Research statement", education: "Education", experience: "Appointments", projects: "Research projects", certifications: "Grants, awards & training", skills: "Methods & tools" },
      par: ["Question", "Method", "Outcome"],
      sketch: [
        "┌───────┬──────────────┐",
        "│ PHOTO │ Research     │",
        "│ Name  │ statement…   │",
        "│ Title │ EDUCATION    │",
        "│ Dept  │ 2022 PhD …   │",
        "│ email │ PUBLICATIONS │",
        "│ links │ [1] Title…   │",
        "│       │ [2] Title…   │",
        "└───────┴──────────────┘"
      ]
    },
    {
      id: "freelancer-services", name: "Freelancer Services",
      blurb: "Built to win work: a clear offer and call to action, what you do as service cards (drawn from your skills when you haven't written services), case studies, testimonials and a strong contact band.",
      navMode: "top", heroVariant: "offer", showStatBand: false, density: "normal", brand: "first", filters: false,
      order: ["skills", "projects", "about", "experience", "certifications", "education"],
      labels: { skills: "Services", projects: "Case studies", experience: "Background" },
      headings: { skills: "What I do", projects: "Recent work", about: "About", experience: "Background", certifications: "Credentials", education: "Education" },
      contact: { heading: "Have a project in mind?", blurb: "Tell me what you're working on — I'll reply with how I can help and what it would take." },
      sketch: [
        "┌──────────────────────┐",
        "│ Name     nav [Hire]  │",
        "├──────────┬───────────┤",
        "│ Offer    │ portrait  │",
        "│ [Start a project]    │",
        "├──────────┴───────────┤",
        "│ ▢ service ▢ service  │",
        "│ Case study │ Case    │",
        "│ “Testimonial”        │",
        "│ ███ LET'S TALK ███   │",
        "└──────────────────────┘"
      ]
    },
    {
      id: "creative-showcase", name: "Creative Showcase",
      blurb: "The work is the headline: poster-size name, then an asymmetric wall of projects with big imagery (typographic covers when there's no image), and the words kept short.",
      navMode: "top", heroVariant: "poster", showStatBand: false, density: "normal", brand: "first", filters: true,
      order: ["projects", "about", "experience", "skills", "education", "certifications"],
      labels: { projects: "Work" }, headings: { projects: "Selected work", about: "About", experience: "Clients & roles", skills: "Disciplines", education: "Education", certifications: "Recognition" },
      sketch: [
        "┌──────────────────────┐",
        "│ name            nav  │",
        "│ NAME IN              │",
        "│ POSTER TYPE          │",
        "├──────────────────────┤",
        "│ [   big project    ] │",
        "│ [ proj   ][ proj ]   │",
        "│ [ proj ][  proj    ] │",
        "│ about · clients      │",
        "└──────────────────────┘"
      ]
    },
    {
      careerChart: "default", id: "data-report", name: "Data Analyst Report",
      blurb: "Reads like a well-built dashboard: a KPI strip computed from your own data, a career timeline chart, skill-coverage bars, and case studies laid out as findings.",
      navMode: "top", heroVariant: "report", showStatBand: true, density: "normal", brand: "first", filters: true,
      order: ["about", "projects", "skills", "experience", "certifications", "education"],
      labels: {}, headings: { about: "Executive summary", projects: "Case studies", skills: "Skill coverage", experience: "Career timeline", certifications: "Certifications", education: "Education" },
      sketch: [
        "┌──────────────────────┐",
        "│ REPORT · Name   nav  │",
        "├──────────────────────┤",
        "│ [4.5][5][24][3] KPIs │",
        "│ ▇▇▇▇▇▇   ▇▇▇         │",
        "│    ▇▇▇▇▇▇▇▇ timeline │",
        "├──────────┬───────────┤",
        "│ ▇▇▇▇ SQL │ Finding   │",
        "│ ▇▇ Viz   │ Finding   │",
        "└──────────┴───────────┘"
      ]
    },
    {
      careerChart: "default", id: "studio-split", name: "Studio Split",
      blurb: "A spacious desktop canvas with a sticky profile panel on the left and the portfolio flowing on the right. Especially effective when the content is concise.",
      navMode: "top", heroVariant: "studio", showStatBand: true, density: "normal", brand: "first", filters: false, sectionContainer: true,
      order: ["about", "skills", "experience", "projects", "education", "certifications"],
      labels: {}, headings: { about: "Profile", skills: "Capabilities", experience: "Experience", projects: "Selected work", education: "Education", certifications: "Credentials" },
      sketch: [
        "┌────────┬─────────────┐",
        "│ NAME   │ CAPABILITIES│",
        "│ Role   │ skill groups│",
        "│ contact├─────────────┤",
        "│ status │ EXPERIENCE  │",
        "│        │ role / date │",
        "│ sticky │ work / study│",
        "└────────┴─────────────┘"
      ]
    },
    {
      careerChart: "default", id: "modern-ledger", name: "Modern Ledger",
      blurb: "A clean, edge-to-edge editorial layout with numbered section rails, generous rules and multi-column content that makes full use of large screens.",
      navMode: "top", heroVariant: "ledger", showStatBand: true, density: "normal", brand: "full", filters: false,
      order: ["about", "experience", "projects", "skills", "education", "certifications"],
      labels: {}, headings: { about: "Overview", experience: "Career ledger", projects: "Selected work", skills: "Capabilities", education: "Education", certifications: "Credentials" },
      sketch: [
        "┌──────────────────────┐",
        "│ NAME / ROLE     NAV │",
        "│ statement     stats │",
        "├─────┬────────────────┤",
        "│ 01  │ OVERVIEW       │",
        "├─────┼────────────────┤",
        "│ 02  │ CAREER / WORK   │",
        "└─────┴────────────────┘"
      ]
    },
    {
      careerChart: "default", id: "engineering-blueprint", name: "Engineering Blueprint",
      blurb: "Architecture-first engineering portfolio: an anchored identity rail, repository-style builds and a readable stack specification.",
      navMode: "top", heroVariant: "blueprint", showStatBand: true, density: "dense", brand: "full", filters: true, sectionContainer: true,
      order: ["projects", "skills", "experience", "about", "certifications", "education"],
      labels: {}, headings: { projects: "Systems & builds", skills: "Technical specification", experience: "Delivery history", about: "Engineering approach", certifications: "Credentials", education: "Education" },
      sketch: ["┌────────┬───────────────┐", "│ PROFILE│ 01 BUILDS     │", "│ Name   │ [repo] [repo] │", "│ Role   ├───────────────┤", "│ stats  │ 02 STACK      │", "│ sticky │ config rows   │", "│        │ 03 HISTORY    │", "└────────┴───────────────┘"]
    },
    {
      careerChart: "optional", id: "project-workbench", name: "Project Workbench",
      blurb: "A product-engineering workbench: prominent positioning, deep problem-to-result project chapters and a compact technical stack.",
      navMode: "top", heroVariant: "workbench", showStatBand: false, density: "normal", brand: "first", filters: false,
      order: ["projects", "skills", "experience", "about", "education", "certifications"],
      labels: {}, headings: { projects: "Build log", skills: "Tools & platforms", experience: "Teams & roles", about: "How I build", education: "Education", certifications: "Credentials" },
      sketch: ["┌────────────────────────┐", "│ NAME       PROJECT NAV │", "├────────────────────────┤", "│ POSITIONING HEADLINE   │", "│ 01 / 02 / 03 PROJECTS │", "├───────┬────────────────┤", "│ INDEX │ PROJECT STORY  │", "│       │ problem → result│", "└───────┴────────────────┘"]
    },
    {
      careerChart: "default", id: "systems-architect", name: "Systems Architect",
      blurb: "A strategy-led technology profile: wide architectural overview, case-study decisions, capability bars and a clear career record.",
      navMode: "top", heroVariant: "architect", showStatBand: false, density: "normal", brand: "full", filters: false,
      order: ["about", "projects", "skills", "experience", "certifications", "education"],
      labels: {}, headings: { about: "Architecture perspective", projects: "Systems delivered", skills: "Capability map", experience: "Architecture roles", certifications: "Credentials", education: "Education" },
      sketch: ["┌────────────────────────┐", "│ NAME       ARCHITECTURE│", "├──────────────┬─────────┤", "│ overview     │ portrait│", "│ approach     │ signals │", "├──────────────┴─────────┤", "│ CASE / DECISION / IMPACT│", "│ CAPABILITY MAP          │", "└────────────────────────┘"]
    },
    {
      careerChart: "default", id: "cloud-operations", name: "Cloud Operations",
      blurb: "An operations board with a compact identity, service map, deployment records and a dated delivery history.",
      navMode: "top", heroVariant: "operations", showStatBand: true, density: "dense", brand: "full", filters: false,
      order: ["projects", "skills", "experience", "about", "certifications", "education"],
      labels: {}, headings: { projects: "Deployments", skills: "Service map", experience: "Operating history", about: "Approach", certifications: "Credentials", education: "Education" },
      sketch: ["┌────────────────────────┐", "│ OPERATIONS / PROFILE   │", "│ Name        live stats │", "├────────────────────────┤", "│ DEPLOY 01 / outcome    │", "│ DEPLOY 02 / outcome    │", "├────────────────────────┤", "│ SERVICE MAP / stack    │", "└────────────────────────┘"]
    },
    {
      careerChart: "default", id: "security-brief", name: "Security Brief",
      blurb: "A high-signal security and reliability brief with numbered evidence, capability rows and a clear record of roles.",
      navMode: "top", heroVariant: "security", showStatBand: false, density: "normal", brand: "full", filters: false,
      order: ["about", "projects", "skills", "experience", "certifications", "education"],
      labels: {}, headings: { about: "Profile brief", projects: "Evidence & outcomes", skills: "Control areas", experience: "Professional record", certifications: "Credentials", education: "Education" },
      sketch: ["┌────────────────────────┐", "│ SECURITY / PROFILE     │", "│ Name     Focus areas   │", "├───────┬────────────────┤", "│ CASE 01│ Evidence      │", "│ CASE 02│ Outcome       │", "├───────┴────────────────┤", "│ CONTROLS / EXPERIENCE  │", "└────────────────────────┘"]
    }
  ];

  /* Every retired structure id → the template with the closest intent. */
  const ALIASES = {
    classic: "clean-recruiter", sidenav: "clean-recruiter", "timeline-led": "clean-recruiter",
    "dense-cv": "clean-recruiter", "center-card": "clean-recruiter",
    terminal: "technical-terminal",
    dossier: "executive-dossier", editorial: "executive-dossier",
    "case-study": "product-case-study", storyboard: "product-case-study",
    "publication-list": "academic-cv",
    "project-board": "freelancer-services",
    "gallery-first": "creative-showcase", poster: "creative-showcase", "split-profile": "creative-showcase", exhibition: "creative-showcase",
    directory: "data-report"
  };
  const FALLBACK = "clean-recruiter";

  const INDEX = {};
  SKELETONS.forEach(function (s) { INDEX[s.id] = s; });

  function canonical(id) {
    if (typeof id !== "string" || !id) return null;
    if (INDEX[id]) return id;
    return ALIASES[id] && INDEX[ALIASES[id]] ? ALIASES[id] : null;
  }
  function byId(id) { return INDEX[canonical(id) || FALLBACK]; }

  /* The "roles over time" chart. A template offers it ("optional") or shows it
     by default ("default"); template.careerChart = true / false is the
     person's choice. Templates that don't list it never draw it. */
  function careerChart(data) {
    const t = (data && data.template) || {};
    const mode = byId(t.skeleton).careerChart;
    /* "default" templates draw it on their own once there are two dated roles
       (one bar tells you nothing); an explicit choice always wins. */
    const dated = ((data && data.experience) || []).filter(function (j) { return /(19|20)\d{2}/.test(String(j && j.startDate || "")); }).length;
    const auto = mode === "default" && t.careerChart !== false && dated >= 2;
    return { supported: !!mode, on: !!mode && (t.careerChart === true || auto), dated: dated };
  }
  function ids() { return SKELETONS.map(function (s) { return s.id; }); }

  PF.provide("skeletons", {
    LIST: SKELETONS,
    ALIASES: ALIASES,
    DEFAULT: FALLBACK,
    canonical: canonical,
    byId: byId,
    careerChart: careerChart,
    ids: ids
  });
})();
