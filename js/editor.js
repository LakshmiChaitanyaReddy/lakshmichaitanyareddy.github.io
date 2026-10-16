/* Shared portfolio content fields for the hosted editor and GitHub admin. */
(function () {
  "use strict";
  const PF = window.PF;
  function create(getData) {
    const LINK_FIELDS = [
      { key: "label", label: "Label", hint: "e.g. LinkedIn" },
      { key: "url", label: "Address", hint: "https://…" },
      { key: "icon", label: "Logo", type: "icon", advanced: true }
    ];

    const ITEM_FIELDS = [
      { key: "title", label: "Title" },
      { key: "value", label: "Big value", hint: "Stats layout only — e.g. 200K+" },
      { key: "subtitle", label: "Subtitle" },
      { key: "meta", label: "Meta", hint: "Date or right-aligned label" },
      { key: "body", label: "Body", type: "textarea", hint: "**text** renders bold" },
      { key: "bullets", label: "Bullets", type: "lines", hint: "One per line" },
      { key: "tags", label: "Tags", type: "tags" },
      { key: "image", label: "Image", type: "image" },
      { key: "links", label: "Links", type: "objectList", itemLabel: "link", fields: LINK_FIELDS }
    ];

    const SCHEMA = [
      {
        key: "profile", label: "Profile", kind: "object",
        doc: "Your name, headline and how people reach you — the top of your portfolio and resume.",
        fields: [
          { key: "name", label: "Full name", required: true },
          { key: "title", label: "Headline", hint: "The role you do or want next, e.g. “Senior Product Designer”" },
          { key: "shortName", label: "Short name", hint: "Nav brand and page title", advanced: true },
          { key: "brandIcon", label: "Home logo", type: "icon", hint: "Optional uploaded logo, icon or initials. Leave empty to display your short name.", advanced: true },
          { key: "yearsRounding", label: "Experience — how to round it", type: "select", advanced: true,
            optionsFrom: "roundings",
            hint: function () { return PF.fmt.explainTotals(getData().experience, getData().profile); } },
          { key: "experienceYears", label: "Experience — type it in yourself", placeholder: "auto", advanced: true,
            hint: "Leave empty and it's counted from your earliest start date, so it never goes stale. "
                + "Fill it in to override that: just the number — 4.5, ~4.5, 5 — since the copy writes the “+” itself. "
                + "Once set, it stays at whatever you typed." },
          { key: "tagline", label: "Summary", type: "textarea",
            hint: "One or two sentences under your name — who you help and what you're best at." },
          { key: "status", label: "Status badge", hint: "e.g. “Open to new roles”. Blank hides it.", advanced: true },
          { key: "location", label: "Location", hint: "City, Country" },
          { key: "email", label: "Email", check: "email" },
          { key: "phone", label: "Phone" },
          { key: "resumeMode", label: "Resume download button", type: "resume" },
          { key: "siteUrl", label: "Custom site address", hint: "Your public portfolio address, used when sharing the site.", advanced: true },
          { key: "ogImage", label: "Share image", type: "image", advanced: true,
            upload: { maxDim: 1200, mime: "image/jpeg" },
            hint: "Shown when the link is pasted into LinkedIn, Slack or X. 1200×630 works best. Leave it empty rather than naming a file that isn't committed — a missing one shows as a broken preview." },
          { key: "photo", label: "Profile photo", type: "image" },
          { key: "about", label: "About", type: "lines", hint: "A short introduction. One paragraph per line." },
          { key: "aboutTitle", label: "About heading", hint: "Blank renders “About me”", advanced: true },
          { key: "contactHeading", label: "Contact heading", hint: "Blank renders “Let's talk”", advanced: true },
          { key: "contactBlurb", label: "Contact blurb", type: "textarea", hint: "One line under the contact heading; blank uses a sensible default", advanced: true }
        ]
      },
      {
        key: "experience", label: "Experience", kind: "list", itemLabel: "role", idPrefix: "exp",
        doc: "Newest first on your site and resume. Lead each bullet with the result.",
        title: function (it) { return [it.role, it.company].filter(Boolean).join(" · ") || "New role"; },
        summary: function (it) { return [PF.fmt.fmtRange(it.startDate, it.endDate, true), it.location].filter(Boolean).join(" · "); },
        fields: [
          { key: "id", label: "ID", required: true, unique: true, mono: true, hidden: true },
          { key: "company", label: "Company", required: true },
          { key: "role", label: "Role", required: true },
          { key: "startDate", label: "Start", type: "month", required: true, hint: "Year and month (2021-03) or just the year" },
          { key: "endDate", label: "End", type: "month", nullWhenEmpty: true, hint: "Blank = Present" },
          { key: "location", label: "Location" },
          { key: "highlights", label: "What you achieved", type: "lines", hint: "One bullet per line. Lead with the result; add a number if you have one." },
          { key: "summary", label: "Role summary", type: "textarea", advanced: true },
          { key: "tech", label: "Tools used", type: "tags", advanced: true }
        ]
      },
      {
        key: "projects", label: "Projects", kind: "list", itemLabel: "project", idPrefix: "proj",
        doc: "The work you're proud of. A result line and the tools you used make each one credible.",
        title: function (it) { return it.title || "New project"; },
        summary: function (it) { return (it.tech || []).slice(0, 4).join(" · "); },
        fields: [
          { key: "id", label: "ID", required: true, unique: true, mono: true, hidden: true },
          { key: "title", label: "Title", required: true },
          { key: "blurb", label: "One-line description", type: "textarea" },
          { key: "result", label: "Result / impact", type: "textarea", hint: "What changed because of it? A number helps if you have one." },
          { key: "tech", label: "Tools used", type: "tags" },
          { key: "image", label: "Cover image", type: "image" },
          { key: "featured", label: "Feature this project", type: "bool", advanced: true },
          { key: "problem", label: "Problem", type: "textarea", advanced: true },
          { key: "approach", label: "Approach", type: "textarea", advanced: true },
          { key: "links", label: "Links", type: "objectList", itemLabel: "link", fields: LINK_FIELDS, advanced: true }
        ]
      },
      {
        key: "skills", label: "Skills", kind: "list", itemLabel: "category",
        doc: "Group related skills — e.g. Languages, Tools, Leadership. Used on your portfolio and resume.",
        title: function (it) { return it.category || "New category"; },
        summary: function (it) { return (it.items || []).length + " skill" + ((it.items || []).length === 1 ? "" : "s"); },
        fields: [
          { key: "category", label: "Group name", required: true, hint: "e.g. Languages, Tools, Leadership" },
          { key: "items", label: "Skills", type: "tags" },
          { key: "icon", label: "Icon", type: "icon", advanced: true }
        ]
      },
      {
        key: "certifications", label: "Certifications", kind: "list", itemLabel: "certification",
        doc: "Licences and certificates. Leave empty and the section is hidden.",
        title: function (it) { return it.name || "New certification"; },
        summary: function (it) { return [it.issuer, it.year].filter(Boolean).join(" · "); },
        fields: [
          { key: "name", label: "Name", required: true },
          { key: "issuer", label: "Issuer" },
          { key: "year", label: "Year", type: "year" },
          { key: "credentialUrl", label: "Credential link", hint: "Adds a Verify link" },
          { key: "abbr", label: "Short code", hint: "e.g. CSA", advanced: true },
          { key: "icon", label: "Badge icon", type: "icon", advanced: true }
        ]
      },
      {
        key: "education", label: "Education", kind: "list", itemLabel: "qualification",
        doc: "Degrees, diplomas and courses, newest first.",
        title: function (it) { return it.degree || it.institution || "New qualification"; },
        summary: function (it) { return [it.institution !== it.degree && it.institution, it.endYear].filter(Boolean).join(" · "); },
        fields: [
          { key: "degree", label: "Degree", required: true },
          { key: "institution", label: "School", required: true },
          { key: "endYear", label: "Year finished", type: "year", nullWhenEmpty: true, hint: "Blank = still studying" },
          { key: "startYear", label: "Start year", type: "year", hint: "YYYY", advanced: true },
          { key: "detail", label: "Detail", hint: "e.g. First-class honours", advanced: true }
        ]
      }
    ];

    const CUSTOM_SECTION_FIELDS = [
      { key: "id", label: "Anchor id", mono: true, hint: "Used in the URL as #id — blank derives it from the title" },
      { key: "title", label: "Title", required: true },
      { key: "eyebrow", label: "Eyebrow", hint: "Small label above the title" },
      { key: "blurb", label: "Intro", type: "textarea" },
      { key: "layout", label: "Layout", type: "select", optionsFrom: "layouts" },
      { key: "altBackground", label: "Alternate background", type: "bool" },
      { key: "items", label: "Items", type: "objectList", itemLabel: "item", fields: ITEM_FIELDS }
    ];

    return { LINK_FIELDS: LINK_FIELDS, ITEM_FIELDS: ITEM_FIELDS, SCHEMA: SCHEMA, CUSTOM_SECTION_FIELDS: CUSTOM_SECTION_FIELDS };
  }
  PF.provide("editor", { create: create });
})();
