/* ==========================================================================
   packs.js — profession packs. Builder-only: never shipped to site.html,
   never read by render.js at paint time.

   A pack is a PRESENTATION-layer starting point, applied once when the user
   clicks "Apply" in the builder's Template tab (js/app.js):
     labels          — renames for the six built-in section headings
                        (the canonical data — experience[], projects[], etc.
                        — never changes; only what render.js calls it does)
     extraSections   — EMPTY custom sections pushed into data.sections[], using
                        the existing layout ids from js/layouts.js (their
                        sample items are never copied into real content)
     sectionOrder / hiddenSections — sane defaults for this profession

   Applying a pack never overwrites something the user already set: a label
   already in data.sectionLabels is left alone, a section id that already
   exists is skipped, and sectionOrder/hiddenSections are only seeded if
   still empty. Re-applying the same pack, or switching between packs, is
   always safe to click again.

   ADDING A PACK: append one object to PACKS. Nothing else to touch.
   ========================================================================== */
(function () {
  "use strict";
  const PF = (window.PF = window.PF || {});
  PF.modules = PF.modules || {};
  PF.provide = PF.provide || function (n, api) { PF[n] = api; PF.modules[n] = true; };

  const PACKS = [
    {
      id: "software-it", name: "Software & IT", category: "Software & IT",
      blurb: "Experience · Projects · Skills · Certifications · Education — today's default.",
      labels: { about: "About", skills: "Skills", experience: "Experience", projects: "Projects", certifications: "Certifications", education: "Education" },
      extraSections: [], sectionOrder: [], hiddenSections: []
    },
    {
      id: "qa-test", name: "QA & Test", category: "Software & IT",
      blurb: "Experience · Test Strategy · Automation Frameworks · Releases Shipped · Tooling · Certifications",
      labels: { about: "About", skills: "Tooling", experience: "Experience", projects: "Automation Frameworks", certifications: "Certifications", education: "Education" },
      extraSections: [
        { id: "test-strategy", title: "Test Strategy", eyebrow: "Approach", layout: "prose",
          items: [{ title: "How I approach coverage", body: "Describe your test strategy — risk-based prioritisation, coverage targets, shift-left practices." }] },
        { id: "releases-shipped", title: "Releases Shipped", eyebrow: "Track record", layout: "list",
          items: [{ title: "Release name", meta: "YYYY-MM", subtitle: "Product / team", body: "What you tested and signed off." }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "data-analytics", name: "Data & Analytics", category: "Software & IT",
      blurb: "Experience · Models & Pipelines · Dashboards · Experiments · Stack · Education",
      labels: { about: "About", skills: "Stack", experience: "Experience", projects: "Models & Pipelines", certifications: "Certifications", education: "Education" },
      extraSections: [
        { id: "dashboards", title: "Dashboards", eyebrow: "Delivered", layout: "gallery",
          items: [{ title: "Dashboard name", body: "Who used it and what decision it drove." }] },
        { id: "experiments", title: "Experiments", eyebrow: "A/B & causal", layout: "stats",
          items: [{ value: "+0%", title: "Metric moved", body: "One line on the experiment." }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "academia-research", name: "Academia & Research", category: "Academia & Research",
      blurb: "Appointments · Publications · Grants & Funding · Teaching · Conferences · Peer Review · Affiliations",
      labels: { about: "About", skills: "Affiliations", experience: "Appointments", projects: "Research Projects", certifications: "Grants & Funding", education: "Education" },
      extraSections: [
        { id: "publications", title: "Publications", eyebrow: "Peer-reviewed", layout: "list",
          items: [{ title: "Paper title", meta: "Year", subtitle: "Venue / journal", body: "Co-authors and one-line contribution." }] },
        { id: "teaching", title: "Teaching", eyebrow: "Courses", layout: "list",
          items: [{ title: "Course name", meta: "Term", subtitle: "Level", body: "Enrolment and role." }] },
        { id: "conferences", title: "Conferences", eyebrow: "Talks & panels", layout: "list",
          items: [{ title: "Talk title", meta: "Year", subtitle: "Conference" }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "science-lab", name: "Science & Lab", category: "Science",
      blurb: "Positions · Research Areas · Publications · Techniques & Instruments · Grants · Education",
      labels: { about: "About", skills: "Techniques & Instruments", experience: "Positions", projects: "Research Areas", certifications: "Grants", education: "Education" },
      extraSections: [
        { id: "publications", title: "Publications", eyebrow: "Peer-reviewed", layout: "list",
          items: [{ title: "Paper title", meta: "Year", subtitle: "Venue / journal" }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "healthcare-clinical", name: "Healthcare & Clinical", category: "Healthcare",
      blurb: "Clinical Appointments · Fellowships · Procedures & Competencies · Publications · Licences · Memberships",
      labels: { about: "About", skills: "Procedures & Competencies", experience: "Clinical Appointments", projects: "Fellowships", certifications: "Licences", education: "Education" },
      extraSections: [
        { id: "memberships", title: "Memberships", eyebrow: "Professional bodies", layout: "table",
          items: [{ title: "Body", body: "Membership grade / status" }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "finance-accounting", name: "Finance & Accounting (CA/CPA)", category: "Finance & Accounting",
      blurb: "Engagements · Audit & Assurance · Advisory · Clients & Industries · Qualifications · Regulatory & Compliance",
      labels: { about: "About", skills: "Clients & Industries", experience: "Engagements", projects: "Advisory", certifications: "Qualifications", education: "Education" },
      extraSections: [
        { id: "audit-assurance", title: "Audit & Assurance", eyebrow: "Practice", layout: "list",
          items: [{ title: "Engagement type", meta: "Year", subtitle: "Client industry", body: "Scope and outcome." }] },
        { id: "regulatory-compliance", title: "Regulatory & Compliance", eyebrow: "Frameworks", layout: "table",
          items: [{ title: "Framework", body: "Your role / certification." }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "legal", name: "Legal", category: "Legal",
      blurb: "Practice Areas · Notable Matters · Bar Admissions · Publications · Speaking",
      labels: { about: "About", skills: "Practice Areas", experience: "Experience", projects: "Notable Matters", certifications: "Bar Admissions", education: "Education" },
      extraSections: [
        { id: "speaking", title: "Speaking", eyebrow: "Talks & panels", layout: "list",
          items: [{ title: "Talk title", meta: "Year", subtitle: "Event" }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "design-creative", name: "Design & Creative", category: "Design & Creative",
      blurb: "Selected Work · Case Studies · Exhibitions · Clients · Tools & Craft",
      labels: { about: "About", skills: "Tools & Craft", experience: "Experience", projects: "Selected Work", certifications: "Recognition", education: "Education" },
      extraSections: [
        { id: "exhibitions", title: "Exhibitions", eyebrow: "Shown", layout: "gallery",
          items: [{ title: "Exhibition name", meta: "Year", body: "Venue / city." }] },
        { id: "clients", title: "Clients", eyebrow: "Worked with", layout: "table",
          items: [{ title: "Client", body: "Nature of the engagement." }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "education-teaching", name: "Education & Teaching", category: "Education",
      blurb: "Courses Taught · Curriculum Developed · Student Outcomes · Credentials · Professional Development",
      labels: { about: "About", skills: "Professional Development", experience: "Courses Taught", projects: "Curriculum Developed", certifications: "Credentials", education: "Education" },
      extraSections: [
        { id: "student-outcomes", title: "Student Outcomes", eyebrow: "Impact", layout: "stats",
          items: [{ value: "0%", title: "Metric", body: "e.g. pass rate, growth score." }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "marketing-sales", name: "Marketing & Sales", category: "Marketing & Sales",
      blurb: "Campaigns · Channels · Results · Brands · Tools",
      labels: { about: "About", skills: "Tools", experience: "Experience", projects: "Campaigns", certifications: "Certifications", education: "Education" },
      extraSections: [
        { id: "results", title: "Results", eyebrow: "Impact", layout: "stats",
          items: [{ value: "+0%", title: "Metric moved", body: "e.g. pipeline, conversion, revenue." }] },
        { id: "brands", title: "Brands", eyebrow: "Worked with", layout: "table",
          items: [{ title: "Brand", body: "Nature of the engagement." }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "trades-services", name: "Trades & Services", category: "Trades & Services",
      blurb: "Projects · Licences · Safety Certifications · Service Areas · Testimonials",
      labels: { about: "About", skills: "Service Areas", experience: "Experience", projects: "Projects", certifications: "Licences", education: "Training" },
      extraSections: [
        { id: "safety-certifications", title: "Safety Certifications", eyebrow: "Compliance", layout: "table",
          items: [{ title: "Certification", body: "Issuer and expiry." }] },
        { id: "testimonials", title: "Testimonials", eyebrow: "From clients", layout: "quotes",
          items: [{ body: "Quote from a satisfied client.", title: "Client name" }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "product-program", name: "Product & Program", category: "Software & IT",
      blurb: "Products Shipped · Outcomes · Stakeholders · Frameworks · Certifications",
      labels: { about: "About", skills: "Frameworks", experience: "Experience", projects: "Products Shipped", certifications: "Certifications", education: "Education" },
      extraSections: [
        { id: "outcomes", title: "Outcomes", eyebrow: "Impact", layout: "stats",
          items: [{ value: "+0%", title: "Metric moved", body: "e.g. activation, retention, revenue." }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "hr-people", name: "HR & People", category: "Software & IT",
      blurb: "Programs · Hiring & Retention Results · Policies · Certifications",
      labels: { about: "About", skills: "Policies", experience: "Programs", projects: "Initiatives", certifications: "Certifications", education: "Education" },
      extraSections: [
        { id: "hiring-retention-results", title: "Hiring & Retention Results", eyebrow: "Impact", layout: "stats",
          items: [{ value: "+0%", title: "Metric moved", body: "e.g. time-to-hire, attrition." }] }
      ],
      sectionOrder: [], hiddenSections: []
    },
    {
      id: "architecture-civil", name: "Architecture & Civil", category: "Trades & Services",
      blurb: "Built Work · Drawings & Models · Licences · Codes & Standards · Awards",
      labels: { about: "About", skills: "Codes & Standards", experience: "Experience", projects: "Built Work", certifications: "Licences", education: "Education" },
      extraSections: [
        { id: "drawings-models", title: "Drawings & Models", eyebrow: "Portfolio", layout: "gallery",
          items: [{ title: "Project name", body: "Drawing / model type." }] },
        { id: "awards", title: "Awards", eyebrow: "Recognition", layout: "list",
          items: [{ title: "Award name", meta: "Year", subtitle: "Issuing body" }] }
      ],
      sectionOrder: [], hiddenSections: []
    }
  ];

  const CATEGORIES = [
    "Software & IT", "Academia & Research", "Healthcare", "Finance & Accounting", "Legal",
    "Design & Creative", "Education", "Trades & Services", "Science", "Marketing & Sales"
  ];

  const INDEX = {};
  PACKS.forEach(function (p) { INDEX[p.id] = p; });

  function byId(id) { return INDEX[id] || null; }

  /* Applies a pack's labels/extraSections/order defaults onto a data.json
     document IN PLACE, never overwriting anything the user already set.
     Safe to call more than once (idempotent) and safe to call after
     switching packs (never clobbers a different pack's additions). */
  function apply(pack, d) {
    if (!pack || !d) return;
    d.sectionLabels = d.sectionLabels && typeof d.sectionLabels === "object" ? d.sectionLabels : {};
    const previous = d.template && d.template.pack ? byId(d.template.pack) : null;
    Object.keys(pack.labels || {}).forEach(function (id) {
      if (!d.sectionLabels[id] || (previous && d.sectionLabels[id] === previous.labels[id])) d.sectionLabels[id] = pack.labels[id];
    });

    d.sections = Array.isArray(d.sections) ? d.sections : [];
    const existingIds = {};
    d.sections.forEach(function (s) { if (s && s.id) existingIds[s.id] = true; });
    (pack.extraSections || []).forEach(function (sec) {
      if (existingIds[sec.id]) return;
      /* The pack's sample items are writing prompts, not content: the real
         portfolio gets the named, empty section (hidden until filled). */
      const copy = JSON.parse(JSON.stringify(sec));
      copy.items = [];
      d.sections.push(copy);
      existingIds[sec.id] = true;
    });

    if ((!Array.isArray(d.sectionOrder) || !d.sectionOrder.length) && (pack.sectionOrder || []).length) {
      d.sectionOrder = pack.sectionOrder.slice();
    }
    if ((!Array.isArray(d.hiddenSections) || !d.hiddenSections.length) && (pack.hiddenSections || []).length) {
      d.hiddenSections = pack.hiddenSections.slice();
    }

    d.template = d.template && typeof d.template === "object" ? d.template : {};
    d.template.pack = pack.id;
  }

  PF.provide("packs", {
    LIST: PACKS,
    CATEGORIES: CATEGORIES,
    byId: byId,
    apply: apply
  });
})();
