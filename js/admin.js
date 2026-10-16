/* ==========================================================================
   admin.js — boots admin.html.

   Reads data.json from the GitHub Contents API, edits it, commits it back,
   uploads images, builds themes and exports the resume in eight formats.

   The token lives in one variable for the life of the tab: never
   localStorage, never a cookie, never the URL, never the committed file.
   ========================================================================== */
(function () {
  "use strict";

  const PF = window.PF;
  const REQUIRED = ["core", "icons", "themes", "skeletons", "packs", "looks", "layouts", "resume", "editor"];

  function bootFailure(missing) {
    const host = document.getElementById("connect-view") || document.body;
    const panel = document.createElement("div");
    panel.className = "notice err";
    panel.setAttribute("role", "alert");
    panel.textContent = "These script files didn't load, so the editor can't start: " +
      missing.map(function (m) { return (PF && PF.FILE_OF && PF.FILE_OF[m]) || ("js/" + m + ".js"); }).join(", ") +
      ". Commit them next to admin.html and reload.";
    host.insertBefore(panel, host.firstChild);
  }

  if (!PF || !PF.need) { bootFailure(["core"]); return; }
  const missingMods = PF.need(REQUIRED);
  if (missingMods.length) { bootFailure(missingMods); return; }

  const D = PF.dom, F = PF.fmt, TH = PF.themes, ICONS = PF.icons, RES = PF.resume;
  const el = D.el, has = D.has, clear = D.clear, arr = D.arr;

  /* ====================================================================
     STATE
     ==================================================================== */
  let TOKEN = null;
  let repo = { owner: "", name: "", branch: "main", path: "data.json" };
  let sha = null;
  let data = normalise({});
  let savedSnapshot = "";
  let activeTab = "profile";
  let previewReady = false;
  let themePreviewReady = false;
  let themePreviewDevice = "desktop";
  let themeThumbObserver = null;
  let previewView = "site";
  let editMode = "dark";
  let applyThemeHere = false;

  const API = "https://api.github.com";
  const ASSET_DIR = "assets";
  const MAX_IMAGE_DIM = 1600;

  function normalise(raw) {
    const d = raw && typeof raw === "object" ? raw : {};
    const t = d.theme && typeof d.theme === "object" ? d.theme : {};
    const tv = t.vars && typeof t.vars === "object" ? t.vars : {};
    const p = d.pdf && typeof d.pdf === "object" ? d.pdf : {};
    const obj = function (v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
    const list = function (v) { return Array.isArray(v) ? v : []; };
    /* Maintenance saves retain both current settings and future extensions. */
    const out = Object.assign({}, d, {
      theme: Object.assign({}, t, {
        preset: typeof t.preset === "string" && t.preset ? t.preset : "minimal-light",
        mode: t.mode === "light" ? "light" : "dark",
        variation: ["standard", "framed", "open", "poster"].indexOf(t.variation) !== -1 ? t.variation : "standard",
        iconAnimation: typeof t.iconAnimation === "string" ? t.iconAnimation : "lift",
        fonts: obj(t.fonts),
        vars: { common: obj(tv.common), dark: obj(tv.dark), light: obj(tv.light) },
        customThemes: list(t.customThemes).length ? list(t.customThemes) : list(t.templates)
      }),
      template: Object.assign({ skeleton: "clean-recruiter", pack: null, look: "" }, obj(d.template)),
      pdf: Object.assign({}, p, {
        template: typeof p.template === "string" && p.template ? p.template : "compact",
        paper: p.paper === "letter" ? "letter" : "a4",
        exclude: list(p.exclude),
        pages: p.pages === "1" || p.pages === "2" ? p.pages : "auto",
        includeVisual: p.includeVisual === true
      }),
      sectionLabels: obj(d.sectionLabels),
      sectionOrder: list(d.sectionOrder),
      hiddenSections: list(d.hiddenSections),
      sections: list(d.sections),
      profile: obj(d.profile),
      experience: list(d.experience),
      projects: list(d.projects),
      skills: list(d.skills),
      certifications: list(d.certifications),
      education: list(d.education)
    });
    delete out.theme.templates;
    if (!out.profile.resumeMode && out.profile.resumeDownload && ["off", "file", "generated"].indexOf(out.profile.resumeDownload.mode) !== -1) {
      out.profile.resumeMode = out.profile.resumeDownload.mode;
      delete out.profile.resumeDownload;
    }
    [["experience", "exp"], ["projects", "proj"]].forEach(function (pair) {
      const used = {};
      out[pair[0]].forEach(function (it) { if (it && it.id) used[it.id] = true; });
      let n = 1;
      out[pair[0]].forEach(function (it) {
        if (!it || it.id) return;
        while (used[pair[1] + "-" + n]) n++;
        it.id = pair[1] + "-" + n; used[it.id] = true;
      });
    });
    return out;
  }

  const serialise = function () { return JSON.stringify(data, null, 2) + "\n"; };
  const isDirty = function () { return serialise() !== savedSnapshot; };

  /* Resume styles are needed here too, for the image exporters. */
  (function () {
    if (document.getElementById("resume-css")) return;
    const style = el("style", { id: "resume-css" });
    style.textContent = RES.css();
    document.head.appendChild(style);
  })();

  /* ====================================================================
     SCHEMA
     ==================================================================== */
  const contentFields = PF.editor.create(function () { return data; });
  const LINK_FIELDS = contentFields.LINK_FIELDS, ITEM_FIELDS = contentFields.ITEM_FIELDS;
  const SCHEMA = contentFields.SCHEMA, CUSTOM_SECTION_FIELDS = contentFields.CUSTOM_SECTION_FIELDS;

  const TABS = SCHEMA.concat([
    { key: "links", label: "Links", kind: "links" },
    { key: "sections", label: "Sections", kind: "sections" },
    { key: "theme", label: "Design", kind: "theme" },
    { key: "resume", label: "Resume", kind: "resume" },
    { key: "preview", label: "Preview", kind: "preview" }
  ]);

  let uidN = 0;
  const uid = function () { return "f" + (++uidN); };

  /* ====================================================================
     GITHUB
     ==================================================================== */
  function ghHeaders() {
    return {
      "Authorization": "Bearer " + TOKEN,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }
  const contentsUrl = function (p) {
    return API + "/repos/" + encodeURIComponent(repo.owner) + "/" + encodeURIComponent(repo.name) +
      "/contents/" + String(p).split("/").map(encodeURIComponent).join("/");
  };

  function describeHttpError(status, body) {
    const msg = (body && body.message) || "";
    if (status === 401) return "401 — the token was rejected. Check you pasted it whole and that it hasn't expired.";
    if (status === 403) return "403 — the token is valid but not allowed here. Give it Contents: Read and write on this repository. (" + msg + ")";
    if (status === 404) return "404 — no such repo, branch or file for this token. Check owner/repo/branch/path.";
    if (status === 409) return "409 — the file changed on GitHub since you loaded it.";
    if (status === 422) return "422 — GitHub rejected the write. " + msg;
    return status + " — " + (msg || "unexpected response from GitHub.");
  }

  function ghFetch(url, options) {
    return fetch(url, options).then(function (res) {
      return res.text().then(function (body) {
        let json = null;
        try { json = body ? JSON.parse(body) : null; } catch (e) { /* not JSON */ }
        return { ok: res.ok, status: res.status, json: json, raw: body };
      });
    });
  }

  function fetchFile() {
    const url = contentsUrl(repo.path) + "?ref=" + encodeURIComponent(repo.branch) + "&t=" + Date.now();
    return ghFetch(url, { headers: ghHeaders(), cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error(describeHttpError(res.status, res.json));
      if (!res.json || typeof res.json.content !== "string" || res.json.content === "") {
        throw new Error("GitHub returned no file content — is " + repo.path + " a file, and under 1 MB?");
      }
      let parsed;
      try { parsed = JSON.parse(PF.b64.decode(res.json.content)); }
      catch (e) { throw new Error(repo.path + " is not valid JSON — " + e.message); }
      return { data: normalise(parsed), sha: res.json.sha };
    });
  }

  function putFile(path, message, base64, currentSha) {
    const body = { message: message, content: base64, branch: repo.branch };
    if (currentSha) body.sha = currentSha;
    return ghFetch(contentsUrl(path), {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, ghHeaders()),
      body: JSON.stringify(body)
    });
  }

  function shaOf(path) {
    return ghFetch(contentsUrl(path) + "?ref=" + encodeURIComponent(repo.branch), { headers: ghHeaders() })
      .then(function (res) { return res.ok && res.json ? res.json.sha : null; })
      .catch(function () { return null; });
  }

  /* ====================================================================
     UPLOADS — downscaled in-browser so an 8 MB phone photo doesn't end
     up in git history for ever. SVGs pass through untouched.
     ==================================================================== */
  function safeName(name, ext) {
    const base = String(name || "image").replace(/\.[^.]+$/, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "image";
    return base + "." + ext;
  }

  const EXT_OF = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
  const FORMAT_OF = { "image/webp": "WebP", "image/jpeg": "JPEG", "image/png": "PNG" };

  /* opts: { maxDim, mime }. A number is still accepted as maxDim.
     `mime` matters for the share image: WebP is smaller, but the LinkedIn and
     X crawlers don't all decode it, so that one field asks for JPEG. */
  function opts2(opts) {
    return typeof opts === "number" ? { maxDim: opts } : (opts || {});
  }

  function processImage(file, opts) {
    const o = opts2(opts);
    const maxDim = o.maxDim || MAX_IMAGE_DIM;
    const prefer = EXT_OF[o.mime] ? o.mime : "image/webp";
    return new Promise(function (resolve, reject) {
      const isVector = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
      const isGif = /gif/i.test(file.type);
      if (isVector || isGif) return resolve({ blob: file, name: safeName(file.name, isVector ? "svg" : "gif") });

      const canvas = document.createElement("canvas");
      let ctx = null;
      try { ctx = canvas.getContext ? canvas.getContext("2d") : null; } catch (e) { ctx = null; }
      if (!ctx || typeof canvas.toBlob !== "function" || !window.URL || !window.URL.createObjectURL) {
        return resolve({ blob: file, name: safeName(file.name, (file.name.split(".").pop() || "png").toLowerCase()) });
      }

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        const longest = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const scale = Math.min(1, maxDim / (longest || 1));
        if (scale === 1 && file.size < 250 * 1024) {
          return resolve({ blob: file, name: safeName(file.name, (file.name.split(".").pop() || "png").toLowerCase()) });
        }
        canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (blob) resolve({ blob: blob, name: safeName(file.name, EXT_OF[prefer]) });
          else canvas.toBlob(function (jpg) {
            if (jpg) resolve({ blob: jpg, name: safeName(file.name, "jpg") });
            else reject(new Error("The browser couldn't re-encode that image."));
          }, "image/jpeg", 0.85);
        }, prefer, 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("That doesn't look like an image the browser can read."));
      };
      img.src = url;
    });
  }

  function uploadAsset(file, status, opts) {
    if (!TOKEN) return Promise.reject(new Error("Connect to the repository first."));
    status("Preparing " + file.name + "…", "");
    return processImage(file, opts).then(function (out) {
      if (out.blob.size > 1.5 * 1024 * 1024) {
        throw new Error("Still " + Math.round(out.blob.size / 1024) + " KB after resizing. Try a smaller image.");
      }
      const path = ASSET_DIR + "/" + out.name;
      status("Uploading " + path + " (" + Math.round(out.blob.size / 1024) + " KB)…", "");
      return out.blob.arrayBuffer()
        .then(function (buf) { return PF.b64.bytes(new Uint8Array(buf)); })
        .then(function (b64) {
          return shaOf(path).then(function (existing) {
            return putFile(path, (existing ? "Replace " : "Upload ") + path, b64, existing);
          });
        })
        .then(function (res) {
          if (!res.ok) throw new Error(describeHttpError(res.status, res.json));
          return path;
        });
    });
  }

  function uploadResume(file, status) {
    if (!TOKEN) return Promise.reject(new Error("Connect to the repository first."));
    if (!file || !/\.(pdf|docx)$/i.test(file.name || "")) {
      return Promise.reject(new Error("Choose a PDF or Word (.docx) file."));
    }
    if (file.size > 2.5 * 1024 * 1024) return Promise.reject(new Error("Resume files can be up to 2.5 MB. Export a smaller copy and try again."));
    const ext = file.name.split(".").pop().toLowerCase();
    const path = ASSET_DIR + "/" + safeName(file.name, ext);
    status("Uploading " + path + " (" + Math.max(1, Math.round(file.size / 1024)) + " KB)…", "");
    return file.arrayBuffer()
      .then(function (buf) { return PF.b64.bytes(new Uint8Array(buf)); })
      .then(function (b64) {
        return shaOf(path).then(function (existing) {
          return putFile(path, (existing ? "Replace " : "Upload ") + path, b64, existing);
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error(describeHttpError(res.status, res.json));
        return path;
      });
  }

  /* ====================================================================
     FIELD CONTROLS
     ==================================================================== */
  function readValue(obj, f) {
    const v = obj[f.key];
    if (f.type === "lines" || f.type === "tags") return Array.isArray(v) ? v : [];
    if (f.type === "bool") return v === true;
    return v == null ? "" : String(v);
  }

  function writeValue(obj, f, raw) {
    if (f.type === "lines") obj[f.key] = String(raw).split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    else if (f.type === "bool") obj[f.key] = raw === true;
    else {
      const s = String(raw).trim();
      obj[f.key] = s === "" && f.nullWhenEmpty ? null : s;
    }
    touched();
  }

  function tagInput(obj, f) {
    const box = el("div", { class: "tag-box" });
    const input = el("input", { type: "text", id: uid(), placeholder: "Type and press Enter", "aria-label": "Add to " + (f.label || f.key) });
    function draw() {
      clear(box);
      readValue(obj, f).forEach(function (tag, i) {
        box.appendChild(el("span", { class: "tag" }, tag,
          el("button", { type: "button", "aria-label": "Remove " + tag, text: "×",
            onclick: function () { obj[f.key].splice(i, 1); touched(); draw(); input.focus(); } })));
      });
      box.appendChild(input);
    }
    function commit() {
      const parts = input.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!parts.length) return;
      if (!Array.isArray(obj[f.key])) obj[f.key] = [];
      parts.forEach(function (p) { if (obj[f.key].indexOf(p) === -1) obj[f.key].push(p); });
      input.value = "";
      touched(); draw(); input.focus();
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
      else if (e.key === "Backspace" && input.value === "" && (obj[f.key] || []).length) {
        obj[f.key].pop(); touched(); draw(); input.focus();
      }
    });
    input.addEventListener("blur", commit);
    draw();
    return el("div", { class: "field" },
      el("label", { for: input.id, text: f.label || f.key }), box,
      f.hint && el("span", { class: "hint", text: f.hint }));
  }

  /* An image field never writes an empty { src, alt } just for rendering —
     building a form must not dirty the file. */
  function imageField(obj, f) {
    const stored = obj[f.key];
    const val = (stored && typeof stored === "object" && !Array.isArray(stored))
      ? { src: stored.src || "", alt: stored.alt || "" }
      : { src: typeof stored === "string" ? stored : "", alt: "" };

    function commitVal() {
      if (has(val.src)) obj[f.key] = { src: val.src, alt: val.alt || "" };
      else delete obj[f.key];
      touched();
    }

    const thumb = el("span", { class: "img-thumb" });
    const pathLine = el("p", { class: "img-path" });
    const status = el("p", { class: "img-status", role: "status", "aria-live": "polite" });
    const fileInput = el("input", { type: "file", accept: "image/*", class: "visually-hidden", id: uid() });
    const altId = uid();
    const altInput = el("input", { type: "text", id: altId, placeholder: "Describe the image for screen readers" });
    altInput.value = val.alt || "";
    altInput.addEventListener("input", function () { val.alt = altInput.value; commitVal(); });
    const urlId = uid();
    const urlInput = el("input", { type: "text", id: urlId, placeholder: "…or paste an image URL" });
    urlInput.value = /^https?:/i.test(val.src) ? val.src : "";
    urlInput.addEventListener("input", function () { val.src = urlInput.value.trim(); commitVal(); draw(); });

    function say(msg, kind) { status.textContent = msg || ""; status.className = "img-status" + (kind ? " " + kind : ""); }
    function draw() {
      clear(thumb);
      if (has(val.src)) {
        thumb.appendChild(el("img", { src: val.src, alt: "" }));
        pathLine.textContent = val.src;
      } else {
        thumb.appendChild(el("span", { text: "none" }));
        pathLine.textContent = "No image set";
      }
    }

    const up = opts2(f.upload);
    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      uploadAsset(file, say, up).then(function (path) {
        val.src = path; urlInput.value = "";
        commitVal(); draw();
        say("Committed " + path + ". Add alt text below.", "ok");
      }).catch(function (err) { say(String(err.message || err), "err"); })
        .then(function () { fileInput.value = ""; });
    });

    draw();
    return el("div", { class: "field" },
      el("label", { for: fileInput.id, text: f.label || f.key }),
      el("div", { class: "img-field" },
        el("div", { class: "img-row" }, thumb,
          el("div", { class: "img-side" }, pathLine,
            el("div", { class: "img-buttons" },
              el("label", { class: "btn btn-ghost btn-sm", for: fileInput.id }, "Upload…"),
              fileInput,
              el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () {
                val.src = ""; val.alt = ""; altInput.value = ""; urlInput.value = "";
                commitVal(); draw(); say("Cleared. The file stays in the repo.", "");
              } }, "Remove")))),
        status,
        el("div", { class: "field", style: "margin:.6rem 0 0" }, el("label", { for: urlId, text: "Image URL" }), urlInput),
        el("div", { class: "field", style: "margin:.6rem 0 0" }, el("label", { for: altId, text: "Alt text" }), altInput)),
      el("span", { class: "hint", text: "Uploads are resized to " + (up.maxDim || MAX_IMAGE_DIM) + "px"
        + " and re-encoded to " + (FORMAT_OF[up.mime] || "WebP")
        + ", then committed to " + ASSET_DIR + "/ as their own commit." }),
      has(f.hint) && el("span", { class: "hint", text: f.hint }));
  }

  function resumeField(obj, f) {
    const wrap = el("div", { class: "field resume-field", id: "resume-field" });
    const mode = function () { return obj.resumeMode || (obj.resumeDownload && obj.resumeDownload.mode) || (has(obj.resumeUrl) ? "file" : "off"); };
    function setMode(value) { obj.resumeMode = value; delete obj.resumeDownload; touched(); draw(); }
    function draw() {
      clear(wrap);
      const status = el("p", { class: "img-status", role: "status", "aria-live": "polite" });
      const say = function (text, kind) { status.textContent = text || ""; status.className = "img-status" + (kind ? " " + kind : ""); };
      wrap.appendChild(el("p", { class: "sub-label", text: f.label }));
      wrap.appendChild(el("p", { class: "hint", text: "Choose whether visitors see a Download Resume button. Upload a file, then Save to GitHub to update the live site." }));
      const modes = [["off", "No button"], ["file", "My own resume file"]];
      if (mode() === "generated") modes.push(["generated", "Built from my portfolio (published PDF)"]);
      wrap.appendChild(el("div", { class: "resume-modes", role: "radiogroup", "aria-label": "Resume download button" }, modes.map(function (choice) {
        const id = uid(), input = el("input", { type: "radio", name: "resume-mode", id: id, value: choice[0] });
        input.checked = mode() === choice[0];
        input.addEventListener("change", function () { if (input.checked) setMode(choice[0]); });
        return el("div", { class: "resume-mode" + (input.checked ? " is-on" : "") }, input, el("label", { for: id, text: choice[1] }));
      })));
      if (mode() === "off") return;
      if (mode() === "generated") {
        wrap.appendChild(el("p", { class: "notice info", text: "Your last published PDF remains available. GitHub Pages cannot rebuild it automatically. To refresh it after editing, save a PDF from the Resume tab and upload it here." }));
        wrap.appendChild(el("button", { type: "button", class: "btn btn-ghost btn-sm", text: "Open resume layout and export", onclick: function () { selectTab("resume"); } }));
      }
      const fileInput = el("input", { type: "file", id: uid(), accept: ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document", class: "visually-hidden" });
      const have = has(obj.resumeUrl);
      wrap.appendChild(el("p", { class: "img-path", id: "resume-file-name", text: have ? obj.resumeName || obj.resumeUrl : "No file attached yet" }));
      fileInput.addEventListener("change", function () {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        uploadResume(file, say).then(function (filePath) {
          obj.resumeUrl = filePath; obj.resumeName = file.name; obj.resumeMode = "file"; delete obj.resumeDownload;
          touched(); draw();
          wrap.appendChild(el("p", { class: "img-status ok", role: "status", text: "Uploaded " + file.name + ". Press Save to GitHub to connect it to the live site." }));
        }).catch(function (err) { say(String(err.message || err), "err"); })
          .then(function () { fileInput.value = ""; });
      });
      wrap.appendChild(el("div", { class: "img-buttons" },
        el("label", { class: "btn btn-ghost btn-sm", for: fileInput.id }, have ? "Replace file…" : "Choose a PDF or Word file…"), fileInput,
        have ? el("a", { class: "btn btn-ghost btn-sm", href: obj.resumeUrl, target: "_blank", rel: "noopener noreferrer", text: "Open current ↗" }) : null,
        have ? el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Remove", onclick: function () {
          obj.resumeUrl = ""; obj.resumeName = ""; obj.resumeMode = "off"; delete obj.resumeDownload; touched(); draw();
          wrap.appendChild(el("p", { class: "hint", text: "Save to remove the button. The uploaded file stays in your repository." }));
        } }) : null));
      wrap.appendChild(status);
      const urlId = uid(), link = el("input", { type: "text", id: urlId, value: obj.resumeUrl || "", placeholder: "https://example.com/resume.pdf" });
      link.addEventListener("input", function () {
        obj.resumeUrl = link.value.trim(); obj.resumeName = ""; obj.resumeMode = "file"; delete obj.resumeDownload; touched();
      });
      wrap.appendChild(el("details", { class: "more-options" }, el("summary", { text: "Or link to a file you already host" }),
        el("label", { for: urlId, text: "Resume file address" }), link));
      wrap.appendChild(el("p", { class: "hint", text: "PDF or Word (.docx), up to 2.5 MB." }));
    }
    draw();
    return wrap;
  }

  /* ── Logo / icon picker: brand mark, Lucide name, URL, upload,
        monogram or raw SVG. Writes a single string. ────────────────── */
  function iconKindOf(value) {
    const v = String(value || "").trim();
    if (!v) return "none";
    if (v.slice(0, 4).toLowerCase() === "<svg") return "svg";
    if (v.slice(0, 9).toLowerCase() === "monogram:") return "monogram";
    if (/^https?:/i.test(v)) return "url";
    if (/\.(svg|png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(v)) return "upload";
    if (ICONS.BRANDS[v.toLowerCase()] || ICONS.ALIASES[v.toLowerCase()]) return "brand";
    return "lucide";
  }

  function iconField(obj, f) {
    const wrap = el("div", { class: "field" });
    const preview = el("span", { class: "icon-preview", "aria-hidden": "true" });
    const status = el("p", { class: "img-status", role: "status", "aria-live": "polite" });
    const body = el("div", { class: "icon-body" });
    const kindId = uid();

    const KINDS = [
      ["brand", "Brand mark (built in)"],
      ["lucide", "Lucide icon name"],
      ["url", "Image URL"],
      ["upload", "Upload a logo"],
      ["monogram", "Letters in a box"],
      ["svg", "Paste SVG markup"],
      ["none", "No icon"]
    ];

    const kindSel = el("select", { id: kindId });
    KINDS.forEach(function (k) { kindSel.appendChild(el("option", { value: k[0], text: k[1] })); });
    kindSel.value = iconKindOf(obj[f.key]);

    function set(value) {
      const v = String(value || "").trim();
      if (v) obj[f.key] = v; else delete obj[f.key];
      touched();
      drawPreview();
    }

    function drawPreview() {
      clear(preview);
      const node = ICONS.resolve(obj[f.key], { anim: "none" });
      if (node) preview.appendChild(node);
      else preview.appendChild(el("span", { class: "icon-none", text: "—" }));
      ICONS.paint();
    }

    function drawBody() {
      clear(body);
      const kind = kindSel.value;
      const current = String(obj[f.key] || "");

      if (kind === "brand") {
        const sel = el("select", { id: uid(), "aria-label": "Brand mark" });
        sel.appendChild(el("option", { value: "", text: "— pick a brand —" }));
        ICONS.brandNames().forEach(function (nm) {
          sel.appendChild(el("option", { value: nm, text: (ICONS.BRANDS[nm].label || nm) + (ICONS.BRANDS[nm].mono ? " (letters)" : "") }));
        });
        sel.value = ICONS.BRANDS[current.toLowerCase()] ? current.toLowerCase() : "";
        sel.addEventListener("change", function () { set(sel.value); });
        body.appendChild(sel);
        body.appendChild(el("span", { class: "hint", text: "Shipped inline — no CDN, works offline. Brands without an exact mark render as lettered squares." }));

      } else if (kind === "lucide") {
        const inp = el("input", { type: "text", id: uid(), placeholder: "globe", "aria-label": "Lucide icon name" });
        inp.value = iconKindOf(current) === "lucide" ? current : "";
        inp.addEventListener("input", function () { set(inp.value); });
        body.appendChild(inp);
        body.appendChild(el("span", { class: "hint" }, "Any name from ",
          el("a", { href: "https://lucide.dev/icons", target: "_blank", rel: "noopener noreferrer", text: "lucide.dev/icons" }),
          ". Lucide has no brand logos — use Brand mark for those."));

      } else if (kind === "url") {
        const inp = el("input", { type: "text", id: uid(), placeholder: "https://example.com/logo.svg", "aria-label": "Image URL" });
        inp.value = /^https?:/i.test(current) ? current : "";
        inp.addEventListener("input", function () { set(inp.value); });
        body.appendChild(inp);
        body.appendChild(el("span", { class: "hint", text: "Loaded from that host at page load. A dead link shows nothing." }));

      } else if (kind === "upload") {
        const fileInput = el("input", { type: "file", accept: "image/*", class: "visually-hidden", id: uid() });
        const pathLine = el("p", { class: "img-path", text: current || "Nothing uploaded yet" });
        fileInput.addEventListener("change", function () {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;
          uploadAsset(file, function (m, k) { status.textContent = m; status.className = "img-status" + (k ? " " + k : ""); }, 256)
            .then(function (path) {
              set(path);
              pathLine.textContent = path;
              status.textContent = "Committed " + path;
              status.className = "img-status ok";
            })
            .catch(function (err) { status.textContent = String(err.message || err); status.className = "img-status err"; })
            .then(function () { fileInput.value = ""; });
        });
        body.appendChild(el("label", { class: "btn btn-ghost btn-sm", for: fileInput.id }, "Choose a file…"));
        body.appendChild(fileInput);
        body.appendChild(pathLine);
        body.appendChild(el("span", { class: "hint", text: "Resized to 256px and committed to " + ASSET_DIR + "/." }));

      } else if (kind === "monogram") {
        const inp = el("input", { type: "text", id: uid(), maxlength: "3", placeholder: "SN", "aria-label": "Monogram letters" });
        inp.value = current.slice(0, 9).toLowerCase() === "monogram:" ? current.slice(9) : "";
        inp.addEventListener("input", function () {
          const v = inp.value.trim();
          set(v ? "monogram:" + v.toUpperCase() : "");
        });
        body.appendChild(inp);
        body.appendChild(el("span", { class: "hint", text: "One to three letters in a rounded square — a deliberate placeholder rather than a wrong logo." }));

      } else if (kind === "svg") {
        const ta = el("textarea", { id: uid(), rows: 3, spellcheck: "false", placeholder: "<svg viewBox=\"0 0 24 24\">…</svg>", "aria-label": "SVG markup" });
        ta.value = current.slice(0, 4).toLowerCase() === "<svg" ? current : "";
        ta.addEventListener("input", function () { set(ta.value); });
        body.appendChild(ta);
        body.appendChild(el("span", { class: "hint", text: "Scripts, event handlers and javascript: URLs are stripped before it renders." }));

      } else {
        set("");
        body.appendChild(el("span", { class: "hint", text: "This link will render without an icon." }));
      }
      drawPreview();
    }

    kindSel.addEventListener("change", drawBody);
    D.append(wrap, [
      el("label", { for: kindId, text: f.label || f.key }),
      el("div", { class: "icon-field" },
        el("div", { class: "icon-head" }, preview, kindSel),
        body, status)
    ]);
    drawBody();
    return wrap;
  }

  /* A hint can be a string or a function of the data. Function hints are
     repainted on every edit (see touched()), so "renders as 4.5" stays true
     while you're typing in the field above it. Cleared by buildTabs(). */
  let LIVE_HINTS = [];

  function hintNode(f, obj) {
    if (!has(f.hint) && typeof f.hint !== "function") return null;
    const node = el("span", { class: "hint" });
    const paint = function () {
      node.textContent = typeof f.hint === "function" ? String(f.hint(obj) || "") : f.hint;
    };
    paint();
    if (typeof f.hint === "function") LIVE_HINTS.push({ node: node, paint: paint });
    return node;
  }

  /* Rows get torn down and rebuilt constantly — drop the closures whose node
     has left the document rather than letting them pile up for the session. */
  function repaintHints() {
    LIVE_HINTS = LIVE_HINTS.filter(function (h) { return h.node.isConnected !== false; });
    LIVE_HINTS.forEach(function (h) {
      try { h.paint(); } catch (e) { /* a hint must never break an edit */ }
    });
  }

  function selectField(obj, f) {
    const id = uid();
    const opts = f.optionsFrom === "layouts"
      ? PF.layouts.customer().map(function (l) { return { value: l.id, label: l.name + " — " + l.blurb }; })
      : f.optionsFrom === "roundings"
      ? PF.fmt.ROUNDINGS.map(function (r) { return { value: r.id, label: r.name + " (e.g. " + r.example + ") — " + r.blurb }; })
      : (f.options || []).map(function (o) { return typeof o === "string" ? { value: o, label: o } : o; });
    const sel = el("select", { id: id });
    opts.forEach(function (o) { sel.appendChild(el("option", { value: o.value, text: o.label })); });
    sel.value = readValue(obj, f) || (opts[0] && opts[0].value) || "";
    sel.addEventListener("change", function () { obj[f.key] = sel.value; touched(); });
    return el("div", { class: "field" },
      el("label", { for: id, text: f.label || f.key }), sel, hintNode(f, obj));
  }

  function fieldRow(obj, f, onTitleChange) {
    if (f.type === "tags") return tagInput(obj, f);
    if (f.type === "image") return imageField(obj, f);
    if (f.type === "resume") return resumeField(obj, f);
    if (f.type === "icon") return iconField(obj, f);
    if (f.type === "select") return selectField(obj, f);

    if (f.type === "objectList") {
      if (!Array.isArray(obj[f.key])) obj[f.key] = [];
      return el("div", { style: "margin-bottom:.9rem" },
        el("p", { class: "sub-label", style: "margin:0 0 .4rem", text: f.label || f.key }),
        listEditor(function () { return obj[f.key]; }, {
          fields: f.fields, itemLabel: f.itemLabel || "item", nested: true,
          title: function (it) { return it.title || it.label || it.value || it.url || ("New " + (f.itemLabel || "item")); }
        }));
    }

    const id = uid();
    if (f.type === "bool") {
      const box = el("input", { type: "checkbox", id: id });
      box.checked = readValue(obj, f) === true;
      box.addEventListener("change", function () { writeValue(obj, f, box.checked); });
      return el("div", { class: "field-inline" }, box, el("label", { for: id, text: f.label || f.key }));
    }

    const multiline = f.type === "textarea" || f.type === "lines";
    let input;
    if (multiline) {
      input = el("textarea", { id: id, rows: f.type === "lines" ? 5 : 3 });
      input.value = f.type === "lines" ? readValue(obj, f).join("\n") : readValue(obj, f);
    } else if (f.type === "month") {
      input = el("input", { type: "text", id: id, placeholder: "2021-03", inputmode: "numeric", autocomplete: "off" });
      input.value = readValue(obj, f);
    } else {
      input = el("input", { type: "text", id: id, placeholder: f.placeholder || null });
      input.value = readValue(obj, f);
    }
    input.addEventListener("input", function () {
      writeValue(obj, f, input.value);
      if (onTitleChange) onTitleChange();
    });
    return el("div", { class: "field" + (f.mono ? " mono" : "") },
      el("label", { for: id, text: (f.label || f.key) + (f.required ? " *" : "") }),
      input, hintNode(f, obj));
  }

  const WIDE = { textarea: 1, lines: 1, tags: 1, objectList: 1, image: 1, select: 1, icon: 1, resume: 1 };
  function fieldGroups(item, fields, retitle) {
    const layout = function (list) {
      const out = [];
      let bucket = [];
      const flush = function () {
        if (!bucket.length) return;
        out.push(el("div", { class: "field-grid cols-2" }, bucket));
        bucket = [];
      };
      list.forEach(function (f) {
        if (WIDE[f.type]) { flush(); out.push(fieldRow(item, f, retitle)); }
        else bucket.push(fieldRow(item, f, retitle));
      });
      flush();
      return out;
    };
    const visible = fields.filter(function (f) { return !f.hidden; });
    const basic = visible.filter(function (f) { return !f.advanced; });
    const extra = visible.filter(function (f) { return f.advanced; });
    const out = layout(basic);
    if (extra.length) out.push(el("details", { class: "more-options" }, el("summary", { text: "More options" }), layout(extra)));
    return out;
  }

  /* ====================================================================
     LIST EDITOR
     ==================================================================== */
  function blankItem(spec) {
    const item = {};
    spec.fields.forEach(function (f) {
      if (f.type === "lines" || f.type === "tags" || f.type === "objectList") item[f.key] = [];
      else if (f.type !== "bool" && f.type !== "image" && f.type !== "icon") item[f.key] = "";
    });
    if (spec.idPrefix && "id" in item) item.id = makeId(spec);
    return item;
  }

  function makeId(spec) {
    const list = spec.getList ? spec.getList() : [];
    const used = {};
    list.forEach(function (it) { if (it && it.id) used[it.id] = true; });
    let n = list.length + 1;
    let candidate = spec.idPrefix + "-" + n;
    while (used[candidate]) { n++; candidate = spec.idPrefix + "-" + n; }
    return candidate;
  }

  function toolBtn(glyph, label, disabled, onClick, extraClass) {
    return el("button", {
      type: "button", class: "tool-btn" + (extraClass ? " " + extraClass : ""),
      title: label, "aria-label": label, disabled: disabled || null,
      onclick: onClick, text: glyph
    });
  }

  /* Dragging is armed only while the handle is held, so text selection in
     the inputs keeps working. Every listener is scoped to the card. */
  function wireDrag(card, handle, host, state, onDrop) {
    handle.addEventListener("mousedown", function () { card.draggable = true; });
    handle.addEventListener("touchstart", function () { card.draggable = true; }, { passive: true });
    handle.addEventListener("mouseup", function () { card.draggable = false; });
    card.addEventListener("mousedown", function (e) {
      if (!e.target.closest(".drag-handle")) card.draggable = false;
    });
    card.addEventListener("dragstart", function (e) {
      state.dragging = true;
      card.classList.add("is-dragging");
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.dataset.index || ""); }
    });
    card.addEventListener("dragend", function () {
      card.classList.remove("is-dragging");
      card.draggable = false;
      if (!state.dragging) return;
      state.dragging = false;
      onDrop();
    });
    card.addEventListener("dragover", function (e) {
      if (!state.dragging) return;
      e.preventDefault();
      const dragged = host.querySelector(".is-dragging");
      if (!dragged || dragged === card) return;
      const box = card.getBoundingClientRect();
      const after = (e.clientY - box.top) > box.height / 2;
      host.insertBefore(dragged, after ? card.nextSibling : card);
    });
  }

  function listEditor(getList, spec) {
    spec.getList = getList;
    const host = el("div", { class: "item-list" });
    const wrapper = el("div", null, host);
    const state = { dragging: false };

    function reorderFromDom() {
      const order = Array.prototype.slice.call(host.querySelectorAll(":scope > .item-card"))
        .map(function (n) { return +n.dataset.index; });
      const list = getList();
      const next = order.map(function (i) { return list[i]; });
      list.length = 0;
      next.forEach(function (it) { list.push(it); });
      touched();
      build();
    }

    function build(focusIndex) {
      const list = getList();
      clear(host);
      if (!list.length) host.appendChild(el("p", { class: "empty", text: spec.empty || "Nothing here yet — add your first " + spec.itemLabel + "." }));

      list.forEach(function (item, i) {
        const titleEl = el("h3", { class: "item-title", text: spec.title ? spec.title(item) : spec.itemLabel + " " + (i + 1) });
        const subEl = spec.summary ? el("span", { class: "item-sub", text: spec.summary(item) || "" }) : null;
        const retitle = spec.title ? function () { titleEl.textContent = spec.title(item); if (subEl) subEl.textContent = spec.summary(item) || ""; } : null;
        const card = el("article", { class: "item-card" + (spec.nested ? " nested" : ""), "data-index": i });
        /* Top-level lists read as a tidy list of cards; one opens at a time
           to edit, so the first thing you see is your content, not a form. */
        const collapsible = !spec.nested;
        const open = !collapsible || i === focusIndex;
        if (collapsible) card.classList.toggle("is-collapsed", !open);
        const handle = toolBtn("⠿", "Drag to reorder " + (spec.title ? spec.title(item) : spec.itemLabel), false, null, "drag-handle");
        wireDrag(card, handle, host, state, reorderFromDom);

        const body = el("div", { class: "item-body", hidden: !open }, fieldGroups(item, spec.fields, retitle));
        const toggle = collapsible && el("button", { type: "button", class: "btn btn-ghost btn-sm item-edit", "aria-expanded": String(open), text: open ? "Done" : "Edit",
          onclick: function () {
            const nowOpen = body.hidden;
            body.hidden = !nowOpen; card.classList.toggle("is-collapsed", !nowOpen);
            this.textContent = nowOpen ? "Done" : "Edit"; this.setAttribute("aria-expanded", String(nowOpen));
            if (nowOpen) { const first = body.querySelector("input, textarea"); if (first) first.focus(); }
          } });
        card.appendChild(el("header", { class: "item-head" },
          handle,
          el("div", { class: "item-heading" }, titleEl, subEl),
          el("div", { class: "item-tools" },
            toggle,
            toolBtn("↑", "Move up", i === 0, function () { swap(list, i, i - 1); touched(); build(i - 1); }),
            toolBtn("↓", "Move down", i === list.length - 1, function () { swap(list, i, i + 1); touched(); build(i + 1); }),
            toolBtn("✕", "Delete", false, function () {
              if (!window.confirm("Delete this entry? Nothing is committed until you save.")) return;
              list.splice(i, 1); touched(); build();
            }, "danger"))));
        card.appendChild(body);
        host.appendChild(card);
      });

      if (typeof focusIndex === "number") {
        const cards = host.querySelectorAll(":scope > .item-card");
        const card = cards[Math.max(0, Math.min(focusIndex, cards.length - 1))];
        const first = card && card.querySelector("input, textarea");
        if (first) first.focus();
      }
      refreshCounts();
    }

    wrapper.appendChild(el("button", {
      type: "button", class: "btn btn-ghost btn-block", text: "+ Add " + spec.itemLabel,
      onclick: function () { getList().push(blankItem(spec)); touched(); build(getList().length - 1); }
    }));
    build();
    return wrapper;
  }

  function swap(list, a, b) {
    if (b < 0 || b >= list.length) return;
    const t = list[a]; list[a] = list[b]; list[b] = t;
  }

  /* ====================================================================
     SECTIONS PANEL
     ==================================================================== */
  function knownSections() {
    const out = [];
    const add = function (id, label, kind) { out.push({ id: id, label: label, kind: kind }); };
    if (has(data.profile.about)) add("about", "About", "built-in");
    if (data.skills.length) add("skills", "Skills", "built-in");
    if (data.experience.length) add("experience", "Experience", "built-in");
    if (data.projects.length) add("projects", "Projects", "built-in");
    if (data.certifications.length) add("certifications", "Certifications", "built-in");
    if (data.education.length) add("education", "Education", "built-in");
    const used = {};
    out.forEach(function (s) { used[s.id] = true; });
    data.sections.forEach(function (sec) {
      let id = F.slug(sec.id || sec.title);
      while (used[id]) id = id + "-x";
      used[id] = true;
      add(id, sec.title || "Untitled section", "custom");
    });
    return out;
  }

  function orderedSections() {
    const known = knownSections();
    const order = (data.sectionOrder.length ? data.sectionOrder : PF.skeletons.byId(data.template.skeleton).order).map(String);
    return known.map(function (s, i) { return { s: s, i: i }; })
      .sort(function (a, b) {
        const ra = order.indexOf(a.s.id), rb = order.indexOf(b.s.id);
        return ((ra === -1 ? 9999 : ra) - (rb === -1 ? 9999 : rb)) || (a.i - b.i);
      })
      .map(function (x) { return x.s; });
  }

  function buildSectionsPanel(panel) {
    clear(panel);
    panel.appendChild(el("div", { class: "panel-head" }, el("h2", { text: "Sections" })));
    panel.appendChild(el("p", { class: "section-doc", text:
      "Drag to change the order sections appear on the site, or hide one without deleting its content. " +
      "A section with no content never renders, whatever the order says. Contact is always the footer." }));

    const orderHost = el("div");
    const state = { dragging: false };

    function readOrderFromDom() {
      data.sectionOrder = Array.prototype.slice.call(orderHost.querySelectorAll(":scope > .order-row"))
        .map(function (n) { return n.dataset.id; });
      touched(); drawOrder();
    }

    function moveInOrder(id, delta) {
      const ids = orderedSections().map(function (s) { return s.id; });
      const at = ids.indexOf(id);
      if (at === -1) return;
      const to = at + delta;
      if (to < 0 || to >= ids.length) return;
      const t = ids[at]; ids[at] = ids[to]; ids[to] = t;
      data.sectionOrder = ids;
      touched(); drawOrder();
    }

    function drawOrder() {
      clear(orderHost);
      const list = orderedSections();
      if (!list.length) {
        orderHost.appendChild(el("p", { class: "empty", text: "No sections have content yet." }));
        return;
      }
      list.forEach(function (s, i) {
        const hidden = data.hiddenSections.indexOf(s.id) !== -1;
        const row = el("div", { class: "order-row" + (hidden ? " is-hidden" : ""), "data-id": s.id, "data-index": i });
        const handle = toolBtn("⠿", "Drag to reorder " + s.label, false, null, "drag-handle");
        wireDrag(row, handle, orderHost, state, readOrderFromDom);
        row.appendChild(handle);
        row.appendChild(el("span", { class: "item-idx", text: String(i + 1).padStart(2, "0") }));
        const name = el("input", { class: "order-name", value: data.sectionLabels[s.id] || s.label, "aria-label": "Rename " + s.label });
        name.addEventListener("change", function () {
          if (s.kind === "custom") {
            const index = knownSections().filter(function (item) { return item.kind === "custom"; }).findIndex(function (item) { return item.id === s.id; });
            if (index !== -1) {
              const sec = data.sections[index];
              if (!sec.id) sec.id = s.id;
              sec.title = name.value.trim() || s.label;
            }
          } else {
            if (name.value.trim()) data.sectionLabels[s.id] = name.value.trim();
            else delete data.sectionLabels[s.id];
          }
          touched();
        });
        row.appendChild(name);
        row.appendChild(el("span", { class: "order-kind", text: s.kind }));
        row.appendChild(el("div", { class: "item-tools" },
          toolBtn("↑", "Move up", i === 0, function () { moveInOrder(s.id, -1); }),
          toolBtn("↓", "Move down", i === list.length - 1, function () { moveInOrder(s.id, 1); }),
          el("button", {
            type: "button", class: "tool-btn", "aria-pressed": String(!hidden),
            title: hidden ? "Show on the site" : "Hide from the site",
            "aria-label": (hidden ? "Show " : "Hide ") + s.label,
            text: hidden ? "Hidden" : "Shown",
            onclick: function () {
              const at = data.hiddenSections.indexOf(s.id);
              if (at === -1) data.hiddenSections.push(s.id); else data.hiddenSections.splice(at, 1);
              touched(); drawOrder();
            }
          })));
        orderHost.appendChild(row);
      });
      orderHost.appendChild(el("div", { class: "order-row order-fixed" },
        el("span", { class: "item-idx", text: "──" }),
        el("span", { class: "order-name", text: "Contact" }),
        el("span", { class: "order-kind", text: "footer · always last" })));
    }

    drawOrder();
    panel.appendChild(orderHost);

    panel.appendChild(el("p", { class: "sub-head", text: "Custom sections" }));
    panel.appendChild(el("p", { class: "section-doc", text:
      "Anything the built-ins don't cover: talks, publications, awards, metrics, recommendations, a gallery. " +
      "Pick one of the " + PF.layouts.customer().length + " layouts and the site renders it — no markup to write." }));
    panel.appendChild(el("div", { class: "layout-legend" }, PF.layouts.customer().map(function (l) {
      return el("span", { class: "legend-chip", title: l.blurb, text: l.name });
    })));
    panel.appendChild(listEditor(function () { return data.sections; }, {
      fields: CUSTOM_SECTION_FIELDS, itemLabel: "section",
      title: function (it) { return it.title || "New section"; }
    }));
  }

  /* ====================================================================
     THEME PANEL
     ==================================================================== */
  const resolvedTheme = function () { return TH.resolveTheme(data.theme); };

  function applyThemeToEditor() {
    TH.applyTheme(document, resolvedTheme(), editMode);
    document.documentElement.setAttribute("data-theme", editMode);
  }
  function resetEditorTheme() {
    TH.clearTheme(document);
    document.documentElement.setAttribute("data-theme", "dark");
  }

  function fitThemeThumbnails(panel) {
    if (themeThumbObserver) themeThumbObserver.disconnect();
    const fit = function (host) {
      const frame = host.querySelector("iframe"), scale = host.clientWidth / 1440;
      if (!frame || !scale) return;
      frame.style.height = Math.ceil(host.clientHeight / scale) + "px";
      frame.style.transform = "scale(" + scale + ")";
    };
    const hosts = Array.from(panel.querySelectorAll(".theme-site-thumb"));
    hosts.forEach(fit);
    if (window.ResizeObserver) {
      themeThumbObserver = new ResizeObserver(function (entries) { entries.forEach(function (entry) { fit(entry.target); }); });
      hosts.forEach(function (host) { themeThumbObserver.observe(host); });
    }
  }

  function buildThemePanel(panel) {
    clear(panel);
    panel.appendChild(el("div", { class: "panel-head" }, el("h2", { text: "Design" })));
    panel.appendChild(el("p", { class: "section-doc", text:
      "Template controls the page structure and storytelling. Theme controls colours, typography, surfaces and atmosphere. Choose them independently; neither changes your content." }));

    const deviceSwitch = el("div", { class: "mode-switch", role: "group", "aria-label": "Theme preview size" },
      [["desktop", "Desktop"], ["mobile", "Mobile"]].map(function (d) {
        return el("button", { type: "button", "aria-pressed": String(themePreviewDevice === d[0]), text: d[1],
          onclick: function () { themePreviewDevice = d[0]; buildThemePanel(panel); } });
      }));
    const themeFrame = el("iframe", { class: "theme-live-frame", id: "theme-live-frame",
      title: "Actual portfolio preview using the selected theme", src: "site.html?preview=1" });
    panel.appendChild(el("div", { class: "theme-live-shell" },
      el("div", { class: "preview-bar" },
        el("strong", { text: "Your portfolio with this theme" }), deviceSwitch,
        el("span", { class: "hint", id: "theme-preview-hint", text: "Loading the real site preview…" })),
      el("div", { class: "theme-live-frame-wrap" + (themePreviewDevice === "mobile" ? " is-mobile" : "") }, themeFrame)));
    themePreviewReady = false;

    panel.appendChild(el("h3", { class: "sub-head", text: "1 · Page template" }));
    panel.appendChild(el("p", { class: "section-doc", text: "Templates rearrange the hero, navigation and every section. These previews use your current content." }));
    const lookGallery = el("div", { class: "theme-gallery" });
    const currentLook = PF.looks.current(data);
    const selectedLook = PF.looks.byId(currentLook);
    (selectedLook && selectedLook.retired ? PF.looks.GALLERY.concat([selectedLook]) : PF.looks.GALLERY).forEach(function (look) {
      lookGallery.appendChild(el("button", {
        type: "button", class: "theme-card", "aria-pressed": String(currentLook === look.id),
        onclick: function () { PF.looks.applyTemplate(data, look.id); touched(); buildThemePanel(panel); }
      },
        el("span", { class: "theme-site-thumb" },
          el("iframe", { loading: "lazy", tabindex: "-1", "aria-hidden": "true", "data-look-preview": look.id, src: "site.html?preview=1", title: "" }),
          el("span", { class: "theme-loading", text: "Rendering page structure…" })),
        el("span", { class: "theme-body" },
          el("strong", { text: look.name }),
          el("span", { text: look.blurb }),
          el("span", { class: "theme-fonts", text: look.retired ? "Previous template · still supported" : "Page structure" }),
          currentLook === look.id ? el("span", { class: "theme-selected", text: "● selected" }) : null)));
    });
    panel.appendChild(lookGallery);

    const chart = PF.skeletons.careerChart(data);
    if (chart.supported) {
      const id = uid(), box = el("input", { type: "checkbox", id: id });
      box.checked = chart.on;
      box.addEventListener("change", function () { data.template.careerChart = box.checked; touched(); buildThemePanel(panel); });
      panel.appendChild(el("div", { class: "field-inline career-chart-toggle" }, box,
        el("label", { for: id, text: "Show a career timeline chart (your roles over time) above your experience" })));
      if (chart.on && !chart.dated) panel.appendChild(el("p", { class: "notice warn", text: "Add start dates under Experience so the timeline can show your roles." }));
    }

    panel.appendChild(el("h3", { class: "sub-head", text: "2 · Visual theme" }));
    panel.appendChild(el("p", { class: "section-doc", text: "Themes keep the selected structure but change its complete visual language in both dark and light modes." }));

    const gallery = el("div", { class: "theme-gallery" });
    function previewStyle(t) {
      const r = TH.resolveTheme({ preset: t.id, fonts: {}, vars: { common: {}, dark: {}, light: {} }, customThemes: data.theme.customThemes });
      const v = Object.assign({}, r.vars.common || {}, r.vars[editMode] || {});
      const get = function (key, fallback) { return v[key] == null || v[key] === "" ? fallback : v[key]; };
      return [
        "--pm-accent:" + get("--accent", "#5cc8a8"),
        "--pm-bg:" + get("--bg", "#11151b"),
        "--pm-surface:" + get("--surface", "#18202a"),
        "--pm-text:" + get("--text", "#eef2f7"),
        "--pm-mid:" + get("--text-mid", "#b6c0cc"),
        "--pm-dim:" + get("--text-dim", "#7f8b99"),
        "--pm-border:" + get("--border", "#283341"),
        "--pm-border-2:" + get("--border-2", "#3a4858"),
        "--pm-radius:" + get("--radius-sm", "8px"),
        "--pm-button-radius:" + get("--button-radius", get("--radius-sm", "8px")),
        "--pm-card-border:" + get("--card-border-width", "1px"),
        "--pm-shadow:" + get("--card-shadow", "none"),
        "background:" + get("--bg", "#11151b")
      ].join(";");
    }
    function drawGallery() {
      clear(gallery);
      const selectedId = resolvedTheme().id;
      const selectedTheme = TH.themeById(selectedId, data.theme.customThemes);
      const builtIns = selectedTheme && selectedTheme.retired ? TH.GALLERY.concat([selectedTheme]) : TH.GALLERY;
      data.theme.customThemes.concat(builtIns).forEach(function (t) {
        const isCustom = data.theme.customThemes.indexOf(t) !== -1;
        const selected = selectedId === t.id;
        gallery.appendChild(el("button", {
          type: "button", class: "theme-card", "aria-pressed": String(selected),
          onclick: function () { choosePreset(t.id); }
        },
          el("span", { class: "theme-site-thumb", style: previewStyle(t) },
            el("iframe", { loading: "lazy", tabindex: "-1", "aria-hidden": "true",
              "data-theme-preview": t.id, src: "site.html?preview=1", title: "" }),
            el("span", { class: "theme-loading", text: "Rendering real portfolio…" })),
          el("span", { class: "theme-body" },
            el("strong", { text: t.name + (isCustom ? " (yours)" : "") }),
            el("span", { text: t.blurb || "Custom template." }),
            el("span", { class: "theme-fonts", text: [t.fonts && t.fonts.display, t.fonts && t.fonts.body].filter(Boolean).join(" / ") }),
            selected ? el("span", { class: "theme-selected", text: "● selected" }) : null)));
      });
    }

    function choosePreset(id) {
      const hasTweaks = ["common", "dark", "light"].some(function (k) { return Object.keys(data.theme.vars[k]).length; });
      if (hasTweaks && !window.confirm("Switching theme discards your colour tweaks. Your chosen fonts and page treatment stay. Continue?")) return;
      data.theme.preset = id;
      data.theme.vars = { common: {}, dark: {}, light: {} };
      touched();
      if (applyThemeHere) applyThemeToEditor();
      buildThemePanel(panel);
    }

    drawGallery();
    panel.appendChild(gallery);

    panel.appendChild(el("h3", { class: "sub-head", text: "3 · Page treatment" }));
    panel.appendChild(el("p", { class: "section-doc", text: "Mix any visual theme with a different composition. This changes framing, spacing and emphasis without changing your content or page template." }));
    panel.appendChild(el("div", { class: "mode-switch", role: "group", "aria-label": "Page treatment" },
      [["standard", "Standard"], ["framed", "Framed"], ["open", "Open"], ["poster", "Poster"]].map(function (v) {
        return el("button", { type: "button", "aria-pressed": String((data.theme.variation || "standard") === v[0]), text: v[1],
          onclick: function () { data.theme.variation = v[0]; touched(); buildThemePanel(panel); } });
      })));

    /* mode + apply-here */
    const modeSwitch = el("div", { class: "mode-switch", role: "group", "aria-label": "Which mode you're editing" },
      ["dark", "light"].map(function (m) {
        return el("button", {
          type: "button", "aria-pressed": String(editMode === m), text: m === "dark" ? "Dark" : "Light",
          onclick: function () {
            editMode = m; data.theme.mode = m; touched();
            if (applyThemeHere) applyThemeToEditor();
            buildThemePanel(panel);
          }
        });
      }));

    const applyHere = el("input", { type: "checkbox", id: "apply-here" });
    applyHere.checked = applyThemeHere;
    applyHere.addEventListener("change", function () {
      applyThemeHere = applyHere.checked;
      if (applyThemeHere) applyThemeToEditor(); else resetEditorTheme();
    });

    panel.appendChild(el("div", { class: "theme-bar" },
      el("span", { class: "sub-label", text: "Editing" }), modeSwitch,
      el("span", { class: "field-inline", style: "margin:0" }, applyHere,
        el("label", { for: "apply-here", text: "Preview theme in this editor" })),
      el("span", { style: "flex:1" }),
      el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () {
        if (!window.confirm("Reset every tweak back to the " + TH.themeById(data.theme.preset, data.theme.customThemes).name + " theme?")) return;
        data.theme.vars = { common: {}, dark: {}, light: {} };
        data.theme.fonts = {};
        touched(); if (applyThemeHere) applyThemeToEditor(); buildThemePanel(panel);
      } }, "Reset tweaks")));

    const resolved = resolvedTheme();

    /* fonts */
    const fontGroup = el("div", { class: "var-group" }, el("h3", { text: "Fonts" }),
      el("p", { text: "Loaded from Google Fonts at runtime. Only the three families you pick are requested." }));
    [["display", "Headings"], ["body", "Body"], ["mono", "Mono / labels"]].forEach(function (pair) {
      const role = pair[0], id = uid();
      const sel = el("select", { id: id });
      const kinds = { display: ["sans", "serif", "mono"], body: ["sans", "serif"], mono: ["mono"] }[role];
      kinds.forEach(function (kind) {
        const group = el("optgroup", { label: kind });
        Object.keys(TH.FONTS).forEach(function (name) {
          if (TH.FONTS[name].kind !== kind) return;
          group.appendChild(el("option", { value: name, text: name }));
        });
        if (group.childNodes.length) sel.appendChild(group);
      });
      sel.value = resolved.fonts[role] || "";
      sel.addEventListener("change", function () {
        data.theme.fonts[role] = sel.value;
        touched();
        if (applyThemeHere) applyThemeToEditor();
      });
      const reset = el("button", {
        class: "var-reset", type: "button", title: "Reset to the template's font", text: "↺",
        hidden: !data.theme.fonts[role],
        onclick: function () { delete data.theme.fonts[role]; touched(); buildThemePanel(panel); }
      });
      fontGroup.appendChild(el("div", { class: "var-row" },
        el("label", { for: id, text: pair[1] }), el("span", { class: "var-ctl" }, sel, reset)));
    });
    panel.appendChild(fontGroup);

    /* logo animation */
    const animGroup = el("div", { class: "var-group" }, el("h3", { text: "Logo animation" }),
      el("p", { text: "Applies to every icon and logo on the site. Disabled automatically for visitors who ask for reduced motion." }));
    const animHost = el("div", { class: "anim-grid" });
    ICONS.ANIMATIONS.forEach(function (a) {
      const selected = (data.theme.iconAnimation || "lift") === a.id;
      const demo = ICONS.resolve("github", { anim: a.id });
      animHost.appendChild(el("button", {
        type: "button", class: "anim-card", "aria-pressed": String(selected),
        onclick: function () { data.theme.iconAnimation = a.id; touched(); buildThemePanel(panel); }
      }, el("span", { class: "anim-demo" }, demo), el("strong", { text: a.name }), el("span", { text: a.blurb })));
    });
    animGroup.appendChild(animHost);
    panel.appendChild(animGroup);

    /* token groups */
    TH.VAR_GROUPS.forEach(function (group) {
      const box = el("div", { class: "var-group" },
        el("h3", { text: group.group + (group.scope === "mode" ? " · " + editMode : "") }),
        group.note ? el("p", { text: group.note }) : null);

      group.vars.forEach(function (spec) {
        const scope = group.scope === "mode" ? editMode : "common";
        const current = String(resolved.vars[scope][spec.key] != null ? resolved.vars[scope][spec.key] : "");
        const overridden = Object.prototype.hasOwnProperty.call(data.theme.vars[scope], spec.key);
        const id = uid();

        const resetBtn = el("button", {
          class: "var-reset", type: "button", title: "Reset to the template value", text: "↺", hidden: !overridden,
          onclick: function () { delete data.theme.vars[scope][spec.key]; touched(); buildThemePanel(panel); }
        });

        function setVar(value) {
          data.theme.vars[scope][spec.key] = value;
          resetBtn.hidden = false;
          touched();
          if (applyThemeHere) applyThemeToEditor();
        }

        let control;
        if (spec.type === "color") {
          const swatch = el("input", { type: "color", id: id, "aria-label": spec.label + " colour picker" });
          const hex = el("input", { type: "text", "aria-label": spec.label + " hex value", spellcheck: "false" });
          swatch.value = /^#[0-9a-f]{6}$/i.test(current) ? current.toLowerCase() : "#000000";
          hex.value = current;
          swatch.addEventListener("input", function () { hex.value = swatch.value; setVar(swatch.value); });
          hex.addEventListener("input", function () {
            const v = hex.value.trim();
            if (/^#[0-9a-f]{3,8}$/i.test(v)) {
              if (/^#[0-9a-f]{6}$/i.test(v)) swatch.value = v;
              setVar(v);
            }
          });
          control = el("span", { class: "var-ctl" }, swatch, hex, resetBtn);

        } else if (spec.type === "px" || spec.type === "ratio" || spec.type === "em") {
          const num = parseFloat(current) || 0;
          const range = el("input", { type: "range", id: id, min: spec.min, max: spec.max, step: spec.step, "aria-label": spec.label });
          range.value = String(Math.min(spec.max, Math.max(spec.min, num)));
          const unit = spec.type === "px" ? "px" : (spec.type === "em" ? "em" : "");
          const out = el("output", { text: current });
          range.addEventListener("input", function () {
            const v = range.value + unit;
            out.textContent = v;
            setVar(v);
          });
          control = el("span", { class: "var-ctl" }, range, out, resetBtn);

        } else if (spec.type === "select") {
          const sel = el("select", { id: id, "aria-label": spec.label });
          spec.options.forEach(function (o) { sel.appendChild(el("option", { value: o, text: o })); });
          sel.value = current;
          sel.addEventListener("change", function () { setVar(sel.value); });
          control = el("span", { class: "var-ctl" }, sel, resetBtn);

        } else {
          const t = el("input", { type: "text", id: id, "aria-label": spec.label, spellcheck: "false" });
          t.value = current;
          t.addEventListener("input", function () { setVar(t.value); });
          control = el("span", { class: "var-ctl" }, t, resetBtn);
        }

        box.appendChild(el("div", { class: "var-row" }, el("label", { for: id, text: spec.label }), control));
      });
      panel.appendChild(box);
    });

    /* save as template */
    const nameId = uid();
    const nameInput = el("input", { type: "text", id: nameId, placeholder: "e.g. My dark theme" });
    const saveTplMsg = el("p", { class: "save-msg", role: "status", "aria-live": "polite" });

    panel.appendChild(el("div", { class: "var-group" },
      el("h3", { text: "Save as a custom theme" }),
      el("p", { text: "Freezes the current colours, fonts, shape and type as a reusable theme stored in data.json." }),
      el("div", { class: "var-row" },
        el("label", { for: nameId, text: "Theme name" }),
        el("span", { class: "var-ctl" }, nameInput,
          el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () {
            const name = nameInput.value.trim();
            if (!name) { saveTplMsg.textContent = "Give the template a name first."; saveTplMsg.className = "save-msg err"; return; }
            const r = resolvedTheme();
            const taken = {};
            data.theme.customThemes.concat(TH.THEMES).forEach(function (t) { taken[t.id] = true; });
            let id = "custom-" + F.slug(name), n = 2;
            while (taken[id]) { id = "custom-" + F.slug(name) + "-" + n; n++; }
            data.theme.customThemes.push({
              id: id, name: name, blurb: "Your saved theme.",
              fonts: { display: r.fonts.display, body: r.fonts.body, mono: r.fonts.mono },
              vars: { common: Object.assign({}, r.vars.common), dark: Object.assign({}, r.vars.dark), light: Object.assign({}, r.vars.light) }
            });
            data.theme.preset = id;
            data.theme.vars = { common: {}, dark: {}, light: {} };
            data.theme.fonts = {};
            touched();
            if (applyThemeHere) applyThemeToEditor();
            buildThemePanel(panel);
          } }, "Save theme"))),
      saveTplMsg,
      data.theme.customThemes.length
        ? el("div", null, el("p", { class: "sub-label", style: "margin:.8rem 0 .4rem", text: "Your themes" }),
            data.theme.customThemes.map(function (t, i) {
              return el("div", { class: "order-row" },
                el("span", { class: "order-name", text: t.name }),
                el("span", { class: "order-kind", text: t.id }),
                toolBtn("✕", "Delete theme " + t.name, false, function () {
                  if (!window.confirm("Delete the theme “" + t.name + "”?")) return;
                  data.theme.customThemes.splice(i, 1);
                  if (data.theme.preset === t.id) data.theme.preset = "minimal-light";
                  touched(); if (applyThemeHere) applyThemeToEditor(); buildThemePanel(panel);
                }, "danger"));
            }))
        : null));
    fitThemeThumbnails(panel);
    ICONS.paint();
  }

  /* ====================================================================
     RESUME / EXPORT PANEL
     ==================================================================== */
  function buildResumePanel(panel) {
    clear(panel);
    panel.appendChild(el("div", { class: "panel-head" }, el("h2", { text: "Resume" })));
    panel.appendChild(el("p", { class: "section-doc", text:
      "Your content, re-laid-out as a resume and exported in whichever format is being asked for. " +
      "Everything here is generated from data.json — there is no second copy of your history to keep in sync." }));

    const msg = el("p", { class: "save-msg", id: "export-msg", role: "status", "aria-live": "polite" });

    /* templates */
    panel.appendChild(el("p", { class: "sub-head", text: "Layout" }));
    const resumeCard = function (t) {
      return el("button", {
        type: "button", class: "pdf-card", "aria-pressed": String(data.pdf.template === t.id),
        onclick: function () {
          data.pdf.template = t.id; touched(); buildResumePanel(panel);
          if (previewView === "resume") sendPreview();
        }
      },
        el("strong", { text: t.name }),
        el("span", { text: t.blurb }),
        t.sketch ? el("pre", { class: "pdf-sketch", text: t.sketch.join("\n") }) : null);
    };
    panel.appendChild(el("div", { class: "pdf-grid resume-templates" }, RES.TEMPLATES.filter(function (t) { return t.featured; }).map(resumeCard)));
    const otherLayouts = RES.TEMPLATES.filter(function (t) { return !t.featured; });
    panel.appendChild(el("details", { class: "more-options", open: otherLayouts.some(function (t) { return t.id === data.pdf.template; }) },
      el("summary", { text: "More layouts (" + otherLayouts.length + ")" }), el("div", { class: "pdf-grid" }, otherLayouts.map(resumeCard))));

    panel.appendChild(el("h3", { class: "sub-head", text: "Length" }));
    panel.appendChild(el("div", { class: "mode-switch", role: "group", "aria-label": "Resume length" },
      [["auto", "Fit content"], ["1", "One page"], ["2", "Two pages"]].map(function (choice) {
        return el("button", { type: "button", "aria-pressed": String(data.pdf.pages === choice[0]), text: choice[1],
          onclick: function () { data.pdf.pages = choice[0]; touched(); buildResumePanel(panel); } });
      })));
    panel.appendChild(el("p", { class: "hint", text: "One page tightens spacing and keeps the strongest bullets of older roles. Fit content lets your history decide." }));

    /* paper + exclusions */
    const paperId = uid();
    const paper = el("select", { id: paperId });
    [["a4", "A4 (210 × 297 mm)"], ["letter", "US Letter (8.5 × 11 in)"]].forEach(function (p) {
      paper.appendChild(el("option", { value: p[0], text: p[1] }));
    });
    paper.value = data.pdf.paper;
    paper.addEventListener("change", function () { data.pdf.paper = paper.value; touched(); });
    panel.appendChild(el("div", { class: "field", style: "max-width:22rem" },
      el("label", { for: paperId, text: "Paper size" }), paper));

    panel.appendChild(el("p", { class: "sub-head", text: "Leave out of the resume" }));
    const secs = knownSections();
    panel.appendChild(el("div", { class: "exclude-grid" }, secs.length ? secs.map(function (s) {
      const id = uid();
      const box = el("input", { type: "checkbox", id: id });
      box.checked = data.pdf.exclude.indexOf(s.id) !== -1;
      box.addEventListener("change", function () {
        const at = data.pdf.exclude.indexOf(s.id);
        if (box.checked && at === -1) data.pdf.exclude.push(s.id);
        if (!box.checked && at !== -1) data.pdf.exclude.splice(at, 1);
        touched();
      });
      return el("div", { class: "field-inline" }, box, el("label", { for: id, text: s.label }));
    }) : el("p", { class: "empty", text: "No sections with content yet." })));

    const visualId = uid(), visual = el("input", { type: "checkbox", id: visualId });
    visual.checked = data.pdf.includeVisual;
    visual.addEventListener("change", function () { data.pdf.includeVisual = visual.checked; touched(); });
    panel.appendChild(el("div", { class: "field-inline" }, visual,
      el("label", { for: visualId, text: "Include portfolio-only sections (galleries, quotes, stat bands)" })));

    /* exports */
    panel.appendChild(el("p", { class: "sub-head", text: "Download" }));
    const exportGrid = el("div", { class: "export-grid" });
    RES.EXPORTS.forEach(function (spec) {
      exportGrid.appendChild(el("button", {
        type: "button", class: "export-card", onclick: function () { runExport(spec, msg); }
      },
        el("strong", null, el("span", { class: "export-ext", text: "." + spec.ext }), spec.name),
        el("span", { text: spec.blurb })));
    });
    panel.appendChild(exportGrid);
    panel.appendChild(msg);

    panel.appendChild(el("div", { class: "preview-bar", style: "margin-top:1.2rem" },
      el("button", { class: "btn btn-ghost", type: "button", onclick: function () {
        previewView = "resume"; selectTab("preview");
      } }, "Open the resume preview →")));
  }

  function runExport(spec, msg) {
    const setMsgText = function (t, kind) { msg.textContent = t; msg.className = "save-msg" + (kind ? " " + kind : ""); };
    const opts = { template: data.pdf.template, paper: data.pdf.paper, pages: data.pdf.pages, includeVisual: data.pdf.includeVisual, exclude: data.pdf.exclude };
    const base = RES.fileBase(data);

    if (spec.kind === "print") {
      const frame = document.getElementById("preview-frame");
      if (!frame || !frame.contentWindow || !previewReady) {
        previewView = "resume";
        selectTab("preview");
        setMsgText("Opening the preview first — press PDF again once it has loaded.", "warn");
        return;
      }
      sendPreview();
      frame.contentWindow.postMessage({ type: "portfolio:print", template: opts.template, paper: opts.paper }, window.location.origin);
      setMsgText("Print dialog opening — choose “Save as PDF” as the destination.", "ok");
      return;
    }

    setMsgText("Generating " + spec.name + "…");
    let result;
    try { result = spec.run(data, opts); }
    catch (e) { setMsgText(spec.name + " failed — " + (e.message || e), "err"); return; }

    Promise.resolve(result).then(function (out) {
      const name = base + "." + (out.ext || spec.ext);
      PF.util.download(name, out.blob || out.text, out.mime || spec.mime);
      setMsgText("Downloaded " + name + (out.note ? " — " + out.note : ""), "ok");
    }).catch(function (err) {
      setMsgText(spec.name + " failed — " + String((err && err.message) || err), "err");
    });
  }

  /* ====================================================================
     VALIDATION
     ==================================================================== */
  const MONTH_RE = /^\d{4}(?:-(0[1-9]|1[0-2]))?$/;
  const YEAR_RE = /^\d{4}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate() {
    const problems = [];
    const add = function (tab, where, message, level) {
      problems.push({ tab: tab, where: where, message: message, level: level || "error" });
    };

    try { JSON.stringify(data); }
    catch (e) { add("profile", "data", "The content can't be serialised to JSON: " + e.message); return problems; }

    SCHEMA.forEach(function (group) {
      if (group.kind === "object") {
        group.fields.forEach(function (f) {
          const v = data[group.key][f.key];
          if (f.type === "image") {
            if (v && has(v.src) && !has(v.alt)) add(group.key, group.label + " › " + f.label, "has no alt text. Screen readers will skip it.", "warning");
            return;
          }
          if (f.type === "icon") return;
          if (f.required && !String(v == null ? "" : v).trim()) add(group.key, group.label + " › " + f.label, "is required.");
          if (f.check === "email" && String(v || "").trim() && !EMAIL_RE.test(String(v).trim()))
            add(group.key, group.label + " › " + f.label, "doesn't look like an email address.");
        });
        return;
      }
      const seen = {};
      data[group.key].forEach(function (item, i) {
        const where = group.label + " #" + (i + 1);
        group.fields.forEach(function (f) {
          const v = item[f.key];
          if (f.type === "image") {
            if (v && has(v.src) && !has(v.alt)) add(group.key, where + " › " + f.label, "has no alt text.", "warning");
            return;
          }
          if (f.type === "icon") return;
          const s = v == null ? "" : String(v).trim();
          if (f.required && !s) add(group.key, where + " › " + f.label, "is required.");
          if (f.unique && s) {
            if (seen[s]) add(group.key, where + " › " + f.label, '"' + s + '" is already used by entry #' + seen[s] + ". IDs must be unique.");
            else seen[s] = i + 1;
          }
          if (f.type === "month" && s && !MONTH_RE.test(s))
            add(group.key, where + " › " + f.label, '"' + s + '" must be a year (2022) or year and month (2022-05).');
          if (f.type === "year" && s && !YEAR_RE.test(s))
            add(group.key, where + " › " + f.label, '"' + s + '" must be a 4-digit year.');
        });
        if (group.key === "experience" && item.startDate && item.endDate &&
            MONTH_RE.test(String(item.startDate)) && MONTH_RE.test(String(item.endDate)) &&
            String(item.endDate).padEnd(7, "-12") < String(item.startDate).padEnd(7, "-01")) {
          add(group.key, where, "ends before it starts.");
        }
      });
    });

    const layoutIds = PF.layouts.ids();
    const sectionIds = {};
    data.sections.forEach(function (sec, i) {
      const where = "Section #" + (i + 1);
      if (!has(sec.title)) add("sections", where + " › Title", "is required.");
      const id = F.slug(sec.id || sec.title);
      if (sectionIds[id]) add("sections", where + " › Anchor id", '"' + id + '" clashes with section #' + sectionIds[id] + ".");
      else sectionIds[id] = i + 1;
      if (has(sec.layout) && layoutIds.indexOf(sec.layout) === -1)
        add("sections", where + " › Layout", '"' + sec.layout + '" is not a known layout.');
      if (!Array.isArray(sec.items) || !sec.items.length)
        add("sections", where, "has no items, so it won't appear on the site.", "warning");
      (Array.isArray(sec.items) ? sec.items : []).forEach(function (it, j) {
        if (!has(it.title) && !has(it.body) && !has(it.value) && !(it.image && has(it.image.src)))
          add("sections", where + " › item " + (j + 1), "is empty.", "warning");
        if (it.image && has(it.image.src) && !has(it.image.alt))
          add("sections", where + " › item " + (j + 1) + " image", "has no alt text.", "warning");
        if (sec.layout === "stats" && !has(it.value))
          add("sections", where + " › item " + (j + 1), "has no big value, which is what the stats layout shows.", "warning");
        if (sec.layout === "gallery" && !(it.image && has(it.image.src)))
          add("sections", where + " › item " + (j + 1), "has no image, which is what the gallery layout shows.", "warning");
      });
    });

    const knownThemes = data.theme.customThemes.concat(TH.THEMES).map(function (t) { return t.id; });
    if (knownThemes.indexOf(data.theme.preset) === -1 && !(TH.ALIASES && TH.ALIASES[data.theme.preset]))
      add("theme", "Design › Theme", '"' + data.theme.preset + '" no longer exists — the site uses the default theme.', "warning");
    if (ICONS.ANIMATIONS.map(function (a) { return a.id; }).indexOf(data.theme.iconAnimation) === -1)
      add("theme", "Theme › Logo animation", '"' + data.theme.iconAnimation + '" is not a known animation.', "warning");
    if (RES.TEMPLATES.map(function (t) { return t.id; }).indexOf(data.pdf.template) === -1)
      add("resume", "Resume › Layout", '"' + data.pdf.template + '" is not a known layout.', "warning");

    return problems;
  }

  function showProblems(problems) {
    const host = document.getElementById("problems-host");
    if (host) host.remove();
    if (!problems.length) return;
    const errors = problems.filter(function (p) { return p.level === "error"; });
    const onlyWarn = errors.length === 0;
    const heading = onlyWarn
      ? problems.length + (problems.length === 1 ? " warning — you can still save" : " warnings — you can still save")
      : errors.length + (errors.length === 1 ? " problem blocks the save" : " problems block the save");

    const panel = el("div", { class: "problems" + (onlyWarn ? " only-warn" : ""), id: "problems-host", role: "alert", tabindex: "-1" },
      el("h2", { text: heading }),
      el("ul", null, problems.map(function (p) {
        return el("li", null,
          el("span", { class: "lvl " + (p.level === "warning" ? "warning" : "error"), text: p.level === "warning" ? "warn" : "error" }),
          el("span", { class: "where", text: p.where }),
          el("span", { text: p.message }),
          el("button", { type: "button", text: "Go to " + p.tab, onclick: function () { selectTab(p.tab); } }));
      })));
    document.getElementById("panels").before(panel);
    panel.focus();
  }

  /* ====================================================================
     TABS
     ==================================================================== */
  const tablist = document.getElementById("tablist");
  const panels = document.getElementById("panels");
  const panelNodes = {};

  function buildTabs() {
    clear(tablist); clear(panels);
    LIVE_HINTS = [];                                   // the old nodes are gone
    Object.keys(panelNodes).forEach(function (k) { delete panelNodes[k]; });

    TABS.forEach(function (group) {
      const tabId = "tab-" + group.key, panelId = "panel-" + group.key;
      const tab = el("button", {
        type: "button", class: "tab", id: tabId, role: "tab",
        "aria-selected": String(group.key === activeTab),
        "aria-controls": panelId,
        tabindex: group.key === activeTab ? "0" : "-1",
        onclick: function () { selectTab(group.key); }
      }, group.label, group.kind === "list" && el("span", { class: "count", "data-count": group.key }));

      tab.addEventListener("keydown", function (e) {
        const keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
        if (!(e.key in keys)) return;
        e.preventDefault();
        const i = TABS.findIndex(function (t) { return t.key === group.key; });
        let next;
        if (keys[e.key] === "first") next = 0;
        else if (keys[e.key] === "last") next = TABS.length - 1;
        else next = (i + keys[e.key] + TABS.length) % TABS.length;
        selectTab(TABS[next].key);
        document.getElementById("tab-" + TABS[next].key).focus();
      });

      tablist.appendChild(tab);
      const panel = el("section", {
        id: panelId, role: "tabpanel", "aria-labelledby": tabId, tabindex: "0", hidden: group.key !== activeTab
      });
      panelNodes[group.key] = panel;
      panels.appendChild(panel);
      buildPanel(group, panel);
    });
    refreshCounts();
  }

  function buildPanel(group, panel) {
    if (group.kind === "links") {
      clear(panel);
      panel.appendChild(el("div", { class: "panel-head" }, el("h2", { text: "Links" })));
      panel.appendChild(el("p", { class: "section-doc", text: "Your professional profiles, code, writing and other links. These appear on your portfolio and resume." }));
      panel.appendChild(listEditor(function () { return data.profile.links || (data.profile.links = []); }, {
        fields: LINK_FIELDS, itemLabel: "link", title: function (it) { return it.label || it.url || "New link"; }
      }));
      return;
    }
    if (group.kind === "sections") return buildSectionsPanel(panel);
    if (group.kind === "theme") return buildThemePanel(panel);
    if (group.kind === "resume") return buildResumePanel(panel);
    if (group.kind === "preview") return buildPreviewPanel(panel);

    clear(panel);
    panel.appendChild(el("div", { class: "panel-head" }, el("h2", { text: group.label })));
    if (group.doc) panel.appendChild(el("p", { class: "section-doc", text: group.doc }));
    if (group.kind === "object") {
      panel.appendChild(el("div", { class: "item-card" },
        el("div", { class: "item-body" }, fieldGroups(data[group.key], group.fields, null))));
    } else {
      panel.appendChild(listEditor(function () { return data[group.key]; }, {
        fields: group.fields, itemLabel: group.itemLabel, title: group.title, summary: group.summary, idPrefix: group.idPrefix
      }));
    }
    ICONS.paint();
  }

  function buildPreviewPanel(panel) {
    clear(panel);
    panel.appendChild(el("div", { class: "panel-head" }, el("h2", { text: "Preview" })));
    panel.appendChild(el("p", { class: "section-doc", text:
      "The real site, rendered against your unsaved edits — theme, custom sections and all. Nothing here is committed." }));

    const viewSwitch = el("div", { class: "mode-switch", role: "group", "aria-label": "Preview view" },
      [["site", "Site"], ["resume", "Resume"]].map(function (v) {
        return el("button", {
          type: "button", "aria-pressed": String(previewView === v[0]), text: v[1],
          onclick: function () { previewView = v[0]; buildPreviewPanel(panel); sendPreview(); }
        });
      }));

    const modeSwitch = el("div", { class: "mode-switch", role: "group", "aria-label": "Preview colour mode" },
      [["dark", "Dark"], ["light", "Light"]].map(function (m) {
        return el("button", {
          type: "button", "aria-pressed": String(editMode === m[0]), text: m[1],
          onclick: function () { data.theme.mode = m[0]; editMode = m[0]; touched(); buildPreviewPanel(panel); sendPreview(); }
        });
      }));

    panel.appendChild(el("div", { class: "preview-bar" },
      viewSwitch, modeSwitch,
      el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: refreshPreview }, "Reload preview"),
      el("span", { class: "hint", id: "preview-hint" })));

    panel.appendChild(el("iframe", {
      class: "preview-frame", id: "preview-frame",
      title: "Live preview of the portfolio", src: "site.html?preview=1"
    }));
    previewReady = false;
  }

  function selectTab(key) {
    activeTab = key;
    TABS.forEach(function (t) {
      const tab = document.getElementById("tab-" + t.key);
      const panel = panelNodes[t.key];
      if (!tab || !panel) return;
      const on = t.key === key;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
    });
    if (key === "preview") sendPreview();
    if (key === "theme") sendThemePreview();
  }

  function refreshCounts() {
    SCHEMA.forEach(function (g) {
      if (g.kind !== "list") return;
      const node = tablist.querySelector('[data-count="' + g.key + '"]');
      if (node) node.textContent = String(data[g.key].length);
    });
  }

  /* ====================================================================
     PREVIEW BRIDGE
     ==================================================================== */
  window.addEventListener("message", function (e) {
    const cardFrame = Array.prototype.find.call(document.querySelectorAll("iframe[data-theme-preview], iframe[data-look-preview]"), function (f) {
      return e.source === f.contentWindow;
    });
    if (cardFrame && e.data && e.data.type === "portfolio:preview-ready") {
      sendThemeCardPreview(cardFrame);
      return;
    }
    const themeFrame = document.getElementById("theme-live-frame");
    if (themeFrame && e.source === themeFrame.contentWindow && e.data && e.data.type === "portfolio:preview-ready") {
      themePreviewReady = true;
      sendThemePreview();
      return;
    }
    const frame = document.getElementById("preview-frame");
    if (!frame || e.source !== frame.contentWindow) return;
    if (!e.data || e.data.type !== "portfolio:preview-ready") return;
    previewReady = true;
    sendPreview();
  });

  function sendThemeCardPreview(frame) {
    if (!frame || !frame.contentWindow) return;
    const previewData = JSON.parse(serialise());
    const themeId = frame.getAttribute("data-theme-preview"), lookId = frame.getAttribute("data-look-preview");
    if (lookId) PF.looks.applyTemplate(previewData, lookId);
    if (themeId) previewData.theme = Object.assign({}, previewData.theme, {
      preset: themeId, fonts: {}, vars: { common: {}, dark: {}, light: {} }
    });
    frame.contentWindow.postMessage({
      type: "portfolio:data",
      data: previewData,
      mode: editMode,
      view: "site",
      template: data.pdf.template,
      paper: data.pdf.paper
    }, "*");
    const host = frame.parentElement;
    if (host) host.classList.add("is-ready");
  }

  function sendThemePreview() {
    const frame = document.getElementById("theme-live-frame");
    const hint = document.getElementById("theme-preview-hint");
    if (!frame || !frame.contentWindow) return;
    if (!themePreviewReady) { if (hint) hint.textContent = "Loading the real site preview…"; return; }
    frame.contentWindow.postMessage({
      type: "portfolio:data",
      data: JSON.parse(serialise()),
      mode: editMode,
      view: "site",
      template: data.pdf.template,
      paper: data.pdf.paper
    }, "*");
    if (hint) hint.textContent = "Live " + editMode + " preview using your content and selected site layout.";
  }

  function sendPreview() {
    const frame = document.getElementById("preview-frame");
    const hint = document.getElementById("preview-hint");
    if (!frame || !frame.contentWindow) return;
    if (!previewReady) { if (hint) hint.textContent = "Loading preview…"; return; }
    frame.contentWindow.postMessage({
      type: "portfolio:data",
      data: JSON.parse(serialise()),
      mode: editMode,
      view: previewView,
      template: data.pdf.template,
      paper: data.pdf.paper
    }, "*");
    if (hint) {
      hint.textContent = previewView === "resume"
        ? "Showing the " + data.pdf.template + " resume layout on " + (data.pdf.paper === "letter" ? "Letter" : "A4") + "."
        : "Showing your unsaved edits.";
    }
  }

  function refreshPreview() {
    const frame = document.getElementById("preview-frame");
    if (!frame) return;
    previewReady = false;
    frame.src = "site.html?preview=1";
  }

  /* ====================================================================
     DIRTY TRACKING
     ==================================================================== */
  function touched() {
    updateDirty();
    repaintHints();
    if (activeTab === "preview") sendPreview();
    if (activeTab === "theme") sendThemePreview();
  }

  function updateDirty() {
    const label = document.getElementById("dirty-label");
    if (!label) return;
    const dirty = isDirty();
    label.className = dirty ? "dirty-dot" : "clean-dot";
    label.textContent = dirty ? "Unsaved changes" : "Saved";
  }

  window.addEventListener("beforeunload", function (e) {
    if (!TOKEN || !isDirty()) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
  });

  /* ====================================================================
     CONNECT / RELOAD / SAVE
     ==================================================================== */
  const connectView = document.getElementById("connect-view");
  const editorView = document.getElementById("editor-view");
  const connectMsg = document.getElementById("connect-msg");
  const saveMsg = document.getElementById("save-msg");

  function setMsg(node, text, kind) {
    node.textContent = text;
    node.className = "save-msg" + (kind ? " " + kind : "");
  }

  document.getElementById("connect-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const tokenInput = document.getElementById("in-token");
    repo = {
      owner: document.getElementById("in-owner").value.trim(),
      name: document.getElementById("in-repo").value.trim(),
      branch: document.getElementById("in-branch").value.trim() || "main",
      path: document.getElementById("in-path").value.trim().replace(/^\/+/, "") || "data.json"
    };
    TOKEN = tokenInput.value.trim();
    if (!TOKEN) { setMsg(connectMsg, "Paste a token first.", "err"); return; }
    if (!repo.owner || !repo.name) { setMsg(connectMsg, "Username and repository are both required.", "err"); return; }

    const btn = document.getElementById("connect-btn");
    btn.disabled = true;
    setMsg(connectMsg, "Connecting…");

    fetchFile().then(function (res) {
      tokenInput.value = "";               // the token lives in TOKEN only
      data = res.data;
      sha = res.sha;
      editMode = "dark";
      document.getElementById("repo-label").textContent =
        repo.owner + "/" + repo.name + " @ " + repo.branch + " · " + repo.path;
      document.getElementById("sha-label").textContent = "sha " + String(sha).slice(0, 7);
      connectView.hidden = true;
      editorView.hidden = false;
      document.getElementById("disconnect-btn").hidden = false;
      buildTabs();
      selectTab("profile");
      /* Building the forms can materialise absent-but-implied structures;
         that isn't an edit, so re-baseline rather than opening dirty. */
      savedSnapshot = serialise();
      updateDirty();
      setMsg(saveMsg, "Loaded " + repo.path + " from GitHub.", "ok");
    }).catch(function (err) {
      setMsg(connectMsg, String(err.message || err), "err");
    }).then(function () { btn.disabled = false; });
  });

  document.getElementById("disconnect-btn").addEventListener("click", function () {
    if (isDirty() && !window.confirm("You have unsaved changes. Disconnect and lose them?")) return;
    TOKEN = null; sha = null; data = normalise({}); savedSnapshot = serialise();
    editorView.hidden = true;
    connectView.hidden = false;
    document.getElementById("disconnect-btn").hidden = true;
    resetEditorTheme();
    applyThemeHere = false;
    setMsg(connectMsg, "Disconnected. The token has been discarded.", "ok");
  });

  document.getElementById("reload-btn").addEventListener("click", function () {
    if (isDirty() && !window.confirm("Reloading discards your unsaved edits. Continue?")) return;
    setMsg(saveMsg, "Reloading…");
    fetchFile().then(function (res) {
      data = res.data; sha = res.sha;
      editMode = "dark";
      document.getElementById("sha-label").textContent = "sha " + String(sha).slice(0, 7);
      buildTabs(); selectTab(activeTab === "preview" ? "profile" : activeTab);
      savedSnapshot = serialise();
      updateDirty();
      setMsg(saveMsg, "Reloaded from GitHub.", "ok");
    }).catch(function (err) { setMsg(saveMsg, String(err.message || err), "err"); });
  });

  document.getElementById("save-btn").addEventListener("click", function () {
    const problems = validate();
    showProblems(problems);
    const errors = problems.filter(function (p) { return p.level === "error"; });
    if (errors.length) {
      setMsg(saveMsg, "Nothing was committed — fix the " + errors.length +
        (errors.length === 1 ? " problem" : " problems") + " listed above.", "err");
      return;
    }

    const btn = document.getElementById("save-btn");
    const message = document.getElementById("commit-msg").value.trim() || "Update portfolio content";
    const payload = serialise();
    btn.disabled = true;
    setMsg(saveMsg, "Committing to " + repo.owner + "/" + repo.name + "…");

    putFile(repo.path, message, PF.b64.encode(payload), sha).then(function (res) {
      if (res.ok) {
        sha = (res.json && res.json.content && res.json.content.sha) || sha;
        savedSnapshot = payload;
        document.getElementById("sha-label").textContent = "sha " + String(sha).slice(0, 7);
        updateDirty();
        const url = res.json && res.json.commit && res.json.commit.html_url;
        setMsg(saveMsg, "Committed. GitHub Pages usually redeploys within a minute.", "ok");
        if (url) {
          saveMsg.appendChild(document.createTextNode(" "));
          saveMsg.appendChild(el("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: "View commit ↗" }));
        }
        return;
      }

      const stale = res.status === 409 ||
        (res.status === 422 && /sha/i.test((res.json && res.json.message) || ""));
      if (stale) {
        setMsg(saveMsg, "Conflict — " + repo.path + " changed on GitHub since you loaded it. Fetching the new version…", "warn");
        return fetchFile().then(function (fresh) {
          sha = fresh.sha;
          document.getElementById("sha-label").textContent = "sha " + String(sha).slice(0, 7);
          const remote = JSON.stringify(fresh.data, null, 2) + "\n";
          setMsg(saveMsg, remote === payload
            ? "Conflict resolved: the remote file already matches your edits. Nothing to commit."
            : "Nothing was committed. Someone (or another tab) changed " + repo.path + ". Your edits are still here and the sha is refreshed — press Save again to overwrite the remote version, or Reload from GitHub to throw yours away.",
            "warn");
        });
      }
      throw new Error(describeHttpError(res.status, res.json));
    }).catch(function (err) {
      setMsg(saveMsg, "Save failed — " + String(err.message || err), "err");
    }).then(function () { btn.disabled = false; });
  });

  document.getElementById("download-btn").addEventListener("click", function () {
    PF.util.download("data.json", serialise(), "application/json");
    setMsg(saveMsg, "Downloaded data.json — commit it by hand if you prefer.", "ok");
  });

  /* ====================================================================
     CHROME
     ==================================================================== */
  const themeBtn = document.getElementById("theme-toggle");
  themeBtn.addEventListener("click", function () {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    themeBtn.setAttribute("aria-pressed", String(next === "light"));
    themeBtn.setAttribute("aria-label", next === "dark" ? "Switch to light theme" : "Switch to dark theme");
    if (applyThemeHere) TH.applyTheme(document, resolvedTheme(), next);
  });

  const host = window.location.hostname;
  if (window.location.protocol === "http:" && host !== "localhost" && host !== "127.0.0.1") {
    document.getElementById("insecure-warning").hidden = false;
  }
  const ghMatch = host.match(/^([^.]+)\.github\.io$/);
  if (ghMatch) {
    document.getElementById("in-owner").value = ghMatch[1];
    const projectRepo = window.location.pathname.split("/").filter(Boolean)[0];
    document.getElementById("in-repo").value = projectRepo || host;
  }

  /* Do not install the optional CDN icon helper here. This page handles a
     repository token, so every executable dependency must stay same-origin. */
  savedSnapshot = serialise();
})();
