/**
 * The in-page autofill engine.
 *
 * Plain JavaScript on purpose: this file is injected verbatim into the quote
 * page, so it must not depend on module scope or on anything a transpiler adds
 * around it (a TypeScript build's keepNames helper does not exist in the page,
 * and its absence silently kills the whole script).
 *
 * Reads window.__bqrPayload, which inject.ts prepends.
 */
(function () {
  var payload = window.__bqrPayload;
  if (!payload) return;

  var w = window;
  if (w.__bqrInstalled) return;
  w.__bqrInstalled = true;

  const HUD_ID = "bqr-hud";
  const send = (msg) => {
    const f = w.__bqrSend;
    if (typeof f === "function") { try { f(msg); } catch { /* page closing */ } }
  };

  const compiled = payload.questions.map((q) => ({
    key: q.key,
    scope: q.scope,
    weight: q.weight ?? 0,
    res: q.patterns.map((p) => new RegExp(p, "i")),
    neg: (q.negative ?? []).map((p) => new RegExp(p, "i")),
  }));

  const norm = (s) =>
    (s || "")
      .replace(/[£,]/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const humanise = (s) =>
    (s || "")
      .replace(/[-_]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();

  const digits = (s) => {
    const m = (s || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };

  const isVisible = (el) => {
    const he = el;
    if (he.closest("#" + HUD_ID)) return false;
    if (he.disabled) return false;
    if (he.getAttribute("aria-hidden") === "true") return false;
    const r = he.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const st = getComputedStyle(he);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  };

  const textOf = (el, cap) => {
    if (!el) return "";
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return t.length > cap ? t.slice(0, cap) : t;
  };

  /**
   * The strings most likely to *be* the question.
   *
   * Kept as separate candidates rather than one joined blob: an anchored
   * pattern like /^make$/ can never match "Make | Make | vehicle make", so
   * joining them would quietly break every short-labelled field on the page.
   */
  function labelFor(el) {
    const cands = [];
    const push = (str) => {
      const v = (str || "").trim();
      if (v && cands.indexOf(v) === -1) cands.push(v);
    };

    const labels = el.labels;
    if (labels) for (const l of Array.from(labels)) push(textOf(l, 160));
    if (el.id) {
      try {
        const sel = 'label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]';
        push(textOf(document.querySelector(sel), 160));
      } catch (e) { /* id isn't selector-safe */ }
    }
    push(textOf(el.closest("label"), 160));
    push(el.getAttribute("aria-label"));
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) for (const id of labelledBy.split(/\s+/)) push(textOf(document.getElementById(id), 160));
    push(el.getAttribute("placeholder"));
    push(el.getAttribute("title"));

    // The element's own identity: as trustworthy as a label, just uglier.
    const selfHints = [];
    push2(selfHints, humanise(el.getAttribute("name") || ""));
    push2(selfHints, humanise(el.getAttribute("data-testid") || el.getAttribute("data-test") || ""));
    push2(selfHints, humanise(el.id || ""));

    // Surrounding page text. Useful for a genuinely unlabelled box, and
    // dangerous everywhere else: a sibling question's wording sits in here too.
    const ambient = [];
    push2(ambient, textOf(el.closest("fieldset") ? el.closest("fieldset").querySelector("legend") : null, 160));
    let node = el.parentElement;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      const own = textOf(node, 400);
      if (own && own.length < 320) ambient.push(own);
      const heading = node.querySelector("h1,h2,h3,h4,h5,h6,legend,[class*=question],[class*=Question],[class*=label],[class*=Label]");
      if (heading && !heading.contains(el)) push2(ambient, textOf(heading, 160));
    }

    return {
      candidates: cands,
      selfHints: selfHints,
      ambient: ambient.join(" | "),
      primary: cands[0] || selfHints[0] || "",
      context: ambient.join(" | "),
    };
  }

  /**
   * The question a radio/checkbox group is asking.
   *
   * The text lives on the group's container, not on any one option, so read the
   * container and subtract the option labels, otherwise the question reads as
   * "Yes No" and matches nothing.
   */
  function groupLabel(els) {
    if (!els.length) return { candidates: [], primary: "", context: "" };
    let node = els[0].parentElement;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      if (els.every((e) => node.contains(e))) break;
    }
    if (!node) return labelFor(els[0]);

    let text = textOf(node, 500);
    for (const e of els) {
      const own = labelFor(e).primary;
      if (own) text = text.split(own).join(" ");
    }
    text = text.replace(/\s+/g, " ").trim();

    const fieldsetLegend = els[0].closest("fieldset") ? textOf(els[0].closest("fieldset").querySelector("legend"), 160) : "";
    const cands = [];
    if (text) cands.push(text);
    const heading = node.querySelector("h1,h2,h3,h4,h5,h6,legend,span,p,[class*=question],[class*=label]");
    if (heading) {
      const h = textOf(heading, 160);
      if (h && cands.indexOf(h) === -1) cands.push(h);
    }
    const nameHint = humanise(els[0].getAttribute("name") || "");
    return {
      candidates: cands,
      selfHints: nameHint ? [nameHint] : [],
      ambient: [fieldsetLegend, textOf(node.parentElement, 300)].filter(Boolean).join(" | "),
      primary: cands[0] || nameHint,
      context: [fieldsetLegend, nameHint].filter(Boolean).join(" | "),
    };
  }

  function push2(arr, s) { if (s && s.trim()) arr.push(s.trim()); }

  const PROPOSER_HEADINGS = /(your|my) details|about you|main (rider|driver)|policyholder|proposer|rider 1|driver 1/i;

  /**
   * Which rider is this part of the form about? 0 = you.
   *
   * Only a section that *declares* itself counts, its own heading or legend
   * naming an additional rider. Scanning raw ancestor text instead would send
   * every field on the page to the additional rider as soon as the walk reached
   * <body>, which contains that wording too.
   */
  function personIndexFor(el) {
    const names = payload.answers.peopleNames.map((n) => n.toLowerCase());
    let node = el.parentElement;
    for (let depth = 0; node && depth < 9; depth++, node = node.parentElement) {
      const heading = node.querySelector("legend,h1,h2,h3,h4,h5,h6,[class*=heading],[class*=Heading],[class*=sectionTitle]");
      if (!heading || heading.contains(el)) continue;
      const t = textOf(heading, 200).toLowerCase();
      if (!t) continue;

      for (let i = names.length - 1; i >= 1; i--) {
        if (names[i] && t.indexOf(names[i]) !== -1) return i;
      }
      if (PROPOSER_HEADINGS.test(t)) return 0;
      if (names[0] && t.indexOf(names[0]) !== -1) return 0;
      for (const m of payload.markers) {
        if (t.indexOf(m) !== -1) {
          const numbered = t.match(/(?:rider|driver)\s*([2-9])/);
          if (numbered && numbered[1]) return Math.min(parseInt(numbered[1], 10) - 1, payload.answers.people.length - 1);
          return Math.min(1, payload.answers.people.length - 1);
        }
      }
    }
    return 0;
  }

  function lookup(key, scope, personIndex) {
    if (scope === "shared") return payload.answers.shared[key];
    const person = payload.answers.people[personIndex] || payload.answers.people[0];
    return person ? person[key] : undefined;
  }

  /**
   * Match a field to a question, preferring to leave it alone over guessing.
   *
   * Evidence is tiered. A real label or the element's own name/id identifies the
   * field. Surrounding page text does not, it carries the wording of every
   * neighbouring question too, so it is only consulted for a box that has no
   * label and no useful name of its own. Getting this wrong types a date of
   * birth into "relationship to you", which is worse than an empty box: you
   * would not think to check it.
   */
  function bestQuestion(candidates, selfHints, ambient, personIndex) {
    const cands = (candidates || []).map(norm).filter(Boolean);
    const hints = (selfHints || []).map(norm).filter(Boolean);
    const amb = norm(ambient || "");
    const joined = cands.concat(hints).join(" | ") + " | " + amb;
    const identified = cands.length > 0 || hints.length > 0;
    let best = null;

    for (const q of compiled) {
      if (q.neg.some((r) => r.test(joined))) continue;
      let score = 0;
      for (const r of q.res) {
        for (const cand of cands) {
          if (r.test(cand)) {
            // A tight match on a short label beats an incidental hit in a long one.
            const tightness = Math.max(0, 6 - cand.length / 12);
            score = Math.max(score, 14 + q.weight * 2 + Math.min(r.source.length, 40) / 20 + tightness);
          }
        }
        for (const hint of hints) {
          if (r.test(hint)) score = Math.max(score, 9 + q.weight * 2);
        }
        if (!identified && amb && r.test(amb)) score = Math.max(score, 4 + q.weight);
      }
      if (score === 0) continue;
      const a = lookup(q.key, q.scope, personIndex);
      if (!a || a.value === "" || a.value === "undefined") continue;
      if (!best || score > best.score) best = { key: q.key, scope: q.scope, score: score };
    }
    return best;
  }

  // --- writing values -----------------------------------------------------

  function setNative(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype :
      el instanceof HTMLSelectElement ? HTMLSelectElement.prototype :
      HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function formatForInput(el, answer) {
    const alts = [answer.value].concat(answer.alt || []);
    const type = (el.type || "text").toLowerCase();
    if (answer.kind === "date" || type === "date") {
      const isoAlt = alts.find((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
      if (type === "date") return isoAlt || answer.value;
      const hint = norm((el.getAttribute("placeholder") || "") + " " + (el.getAttribute("pattern") || ""));
      if (hint.indexOf("yyyy-mm") !== -1 || hint.indexOf("yyyy/mm") !== -1) return isoAlt || answer.value;
      const max = parseInt(el.getAttribute("maxlength") || "0", 10);
      if (max === 8) return answer.value.replace(/\D/g, "");
      return answer.value;
    }
    if (type === "number" || answer.kind === "number") {
      const d = digits(answer.value);
      return d === null ? answer.value : String(d);
    }
    return answer.value;
  }

  function pickOption(sel, answer) {
    const cands = [answer.value].concat(answer.alt || []).map(norm).filter(Boolean);
    const wantNum = answer.kind === "number" ? digits(answer.value) : null;
    let best = null;
    let bestScore = 0;
    for (const opt of Array.from(sel.options)) {
      const t = norm(opt.textContent || "");
      const v = norm(opt.value);
      if (!t && !v) continue;
      if (/please select|choose|^-+$|^select/.test(t)) continue;
      let s = 0;
      if (wantNum !== null) {
        const ot = digits(t);
        const ov = digits(v);
        if (ot === wantNum || ov === wantNum) s = 95;
      }
      for (const cand of cands) {
        if (t === cand || v === cand) s = Math.max(s, 100);
        else if (t.indexOf(cand) === 0 || v.indexOf(cand) === 0) s = Math.max(s, 72 - Math.min(20, Math.abs(t.length - cand.length) * 0.5));
        else if (cand.length >= 4 && t.indexOf(cand) !== -1) s = Math.max(s, 55 - Math.min(20, Math.abs(t.length - cand.length) * 0.3));
      }
      if (s > bestScore) { bestScore = s; best = opt; }
    }
    return bestScore >= 50 ? best : null;
  }

  function fillRadioGroup(els, answer) {
    const cands = [answer.value].concat(answer.alt || []).map(norm).filter(Boolean);
    const wantNum = answer.kind === "number" ? digits(answer.value) : null;
    let best = null;
    let bestScore = 0;
    for (const el of els) {
      const t = norm(labelFor(el).primary) || norm(el.value);
      if (!t) continue;
      let s = 0;
      if (wantNum !== null && digits(t) === wantNum) s = 95;
      for (const cand of cands) {
        if (t === cand) s = Math.max(s, 100);
        else if (t.indexOf(cand) === 0) s = Math.max(s, 72);
        else if (cand.length >= 3 && t.indexOf(cand) !== -1) s = Math.max(s, 55);
      }
      if (s > bestScore) { bestScore = s; best = el; }
    }
    if (bestScore >= 50 && best) { best.click(); return true; }
    return false;
  }

  // --- the pass -----------------------------------------------------------



  function collectTargets() {
    const out = [];
    const seenGroups = {};
    const nodes = document.querySelectorAll("input,select,textarea,[role=combobox],[role=radiogroup]");
    for (const raw of Array.from(nodes)) {
      const el = raw;
      if (!isVisible(el)) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === "input") {
        const inp = el;
        const type = (inp.type || "text").toLowerCase();
        if (["hidden", "submit", "button", "reset", "image", "file"].indexOf(type) !== -1) continue;
        if (type === "radio") {
          const key = (inp.name || inp.id) + "|" + (inp.form ? inp.form.id || "f" : "-");
          if (seenGroups[key]) continue;
          seenGroups[key] = true;
          const group = Array.from(document.querySelectorAll('input[type=radio]'))
            .filter((r) => r.name === inp.name && isVisible(r));
          out.push({ kind: "radio", el: group[0] || inp, group });
          continue;
        }
        if (type === "checkbox") { out.push({ kind: "checkbox", el }); continue; }
        out.push({ kind: "input", el });
        continue;
      }
      if (tag === "select") { out.push({ kind: "select", el }); continue; }
      if (tag === "textarea") { out.push({ kind: "input", el }); continue; }
      out.push({ kind: "widget", el });
    }
    return out;
  }

  function runPass() {
    const report = { filled: [], needsYou: [], skipped: 0 };
    for (const t of collectTargets()) {
      const el = t.el;
      const lbl = t.kind === "radio" ? groupLabel(t.group || [el]) : labelFor(el);
      const primary = lbl.primary;
      const context = lbl.context;
      const personIndex = personIndexFor(el);
      const q = bestQuestion(lbl.candidates, lbl.selfHints, lbl.ambient, personIndex);
      if (!q) continue;
      const answer = lookup(q.key, q.scope, personIndex);
      if (!answer) continue;

      const shownLabel = (primary || context.split(" | ")[0] || "").slice(0, 90);
      const tag = q.scope === "person" && personIndex > 0 ? ` [${payload.answers.peopleNames[personIndex]}]` : "";

      try {
        if (t.kind === "input") {
          const inp = el;
          if (inp.value && !payload.overwrite) { report.skipped++; continue; }
          if (inp.readOnly) { report.needsYou.push({ label: shownLabel + tag, answer: answer.value, key: q.key }); continue; }
          const v = formatForInput(inp, answer);
          inp.focus();
          setNative(inp, v);
          inp.dispatchEvent(new Event("blur", { bubbles: true }));
          report.filled.push(q.key + tag);
        } else if (t.kind === "select") {
          const sel = el;
          if (sel.selectedIndex > 0 && !payload.overwrite) { report.skipped++; continue; }
          const opt = pickOption(sel, answer);
          if (!opt) { report.needsYou.push({ label: shownLabel + tag, answer: answer.value, key: q.key }); continue; }
          sel.focus();
          setNative(sel, opt.value);
          report.filled.push(q.key + tag);
        } else if (t.kind === "radio") {
          const group = t.group || [];
          if (group.some((r) => r.checked) && !payload.overwrite) { report.skipped++; continue; }
          if (fillRadioGroup(group, answer)) report.filled.push(q.key + tag);
          else report.needsYou.push({ label: shownLabel + tag, answer: answer.value, key: q.key });
        } else if (t.kind === "checkbox") {
          const cb = el;
          if (answer.kind !== "boolean") { report.needsYou.push({ label: shownLabel + tag, answer: answer.value, key: q.key }); continue; }
          const want = answer.value === "Yes";
          if (cb.checked !== want) cb.click();
          report.filled.push(q.key + tag);
        } else {
          report.needsYou.push({ label: shownLabel + tag, answer: answer.value, key: q.key });
          el.setAttribute("data-bqr-needs", answer.value);
          el.style.outline = "2px dashed #d97706";
        }
      } catch (e) {
        report.needsYou.push({ label: shownLabel + tag, answer: answer.value, key: q.key });
      }
    }
    return report;
  }

  // --- price grabbing -----------------------------------------------------

  function grabPrices() {
    const found = [];
    const re = /£\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || !isVisible(parent)) continue;
      const raw = node.nodeValue || "";
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(raw))) {
        const price = parseFloat(m[1].replace(/,/g, "") + (m[2] ? "." + m[2] : ""));
        if (price < 30 || price > 25000) continue;
        const block = parent.closest("li,article,section,tr,div") || parent;
        found.push({ price, context: textOf(block, 220) });
      }
    }
    const seen = {};
    const unique = found.filter((f) => {
      const k = f.price + "|" + f.context.slice(0, 60);
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
    send({ type: "prices", items: unique.slice(0, 60), url: location.href, meta: payload.answers.meta });
    return unique.length;
  }

  // --- HUD ----------------------------------------------------------------

  let lastReport = { filled: [], needsYou: [], skipped: 0 };

  function hud() {
    let root = document.getElementById(HUD_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = HUD_ID;
    root.setAttribute("data-bqr", "1");
    root.style.cssText = [
      "position:fixed", "right:12px", "bottom:12px", "z-index:2147483647",
      "width:320px", "max-height:60vh", "overflow:auto",
      "font:12px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "background:#0f172a", "color:#e2e8f0", "border:1px solid #334155",
      "border-radius:10px", "box-shadow:0 8px 30px rgba(0,0,0,.45)", "padding:10px 12px",
    ].join(";");
    document.body.appendChild(root);
    return root;
  }

  function renderHud() {
    const root = hud();
    const meta = payload.answers.meta;
    const needs = lastReport.needsYou;
    const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] || ch));
    root.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">' +
        '<strong style="color:#7dd3fc">' + esc(meta.bikeLabel) + "</strong>" +
        '<button data-bqr-act="hide" style="background:none;border:0;color:#64748b;cursor:pointer;font-size:14px">×</button>' +
      "</div>" +
      '<div style="color:#94a3b8;margin-bottom:8px">' + esc(meta.scenarioLabel) + " · start " + esc(meta.policyStartDate) + "</div>" +
      '<div style="margin-bottom:8px">' +
        '<span style="color:#4ade80">' + lastReport.filled.length + " filled</span> · " +
        '<span style="color:#64748b">' + lastReport.skipped + " left alone</span> · " +
        '<span style="color:#fbbf24">' + needs.length + " for you</span>" +
      "</div>" +
      (needs.length
        ? '<div style="border-top:1px solid #1e293b;padding-top:6px;margin-bottom:8px">' +
          needs.slice(0, 25).map((n) =>
            '<div style="margin-bottom:5px"><div style="color:#94a3b8">' + esc(n.label) + "</div>" +
            '<div><code data-bqr-copy="' + esc(n.answer) + '" style="cursor:pointer;background:#1e293b;padding:1px 5px;border-radius:4px;color:#fcd34d">' +
            esc(n.answer) + "</code></div></div>"
          ).join("") + "</div>"
        : "") +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        btn("fill", "Fill again") + btn("prices", "Grab prices") + btn("answers", "All answers") +
      "</div>" +
      '<div style="color:#475569;margin-top:6px">Alt+F fill · Alt+P prices</div>';

    root.querySelectorAll("[data-bqr-act]").forEach((b) => {
      b.addEventListener("click", () => {
        const act = b.getAttribute("data-bqr-act");
        if (act === "fill") { lastReport = runPass(); renderHud(); }
        else if (act === "prices") { const n = grabPrices(); flash(n + " prices sent to the terminal"); }
        else if (act === "answers") showAllAnswers();
        else if (act === "hide") root.style.display = "none";
      });
    });
    root.querySelectorAll("[data-bqr-copy]").forEach((cd) => {
      cd.addEventListener("click", () => {
        const v = cd.getAttribute("data-bqr-copy") || "";
        navigator.clipboard?.writeText(v);
        flash("copied " + v);
      });
    });
  }

  function btn(act, label) {
    return '<button data-bqr-act="' + act + '" style="background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:6px;padding:4px 8px;cursor:pointer">' + label + "</button>";
  }

  function flash(msg) {
    const n = document.createElement("div");
    n.textContent = msg;
    n.style.cssText = "position:fixed;right:12px;bottom:calc(60vh + 20px);z-index:2147483647;background:#0f172a;color:#7dd3fc;border:1px solid #334155;border-radius:6px;padding:6px 10px;font:12px system-ui";
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function showAllAnswers() {
    const lines = [];
    lines.push("== " + payload.answers.meta.bikeLabel + " / " + payload.answers.meta.scenarioLabel + " ==");
    payload.answers.people.forEach((p, i) => {
      lines.push("-- " + payload.answers.peopleNames[i] + (i === 0 ? " (you)" : " (named rider)"));
      Object.keys(p).forEach((k) => { if (p[k].value) lines.push("  " + k + ": " + p[k].value); });
    });
    lines.push("-- bike & policy");
    Object.keys(payload.answers.shared).forEach((k) => {
      const a = payload.answers.shared[k];
      if (a.value) lines.push("  " + k + ": " + a.value);
    });
    const text = lines.join("\n");
    const pane = document.createElement("pre");
    pane.setAttribute("data-bqr", "1");
    pane.textContent = text;
    pane.style.cssText = "position:fixed;inset:5vh 5vw;z-index:2147483647;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:10px;padding:16px;overflow:auto;font:12px ui-monospace,monospace;white-space:pre-wrap";
    pane.addEventListener("click", () => pane.remove());
    document.body.appendChild(pane);
    navigator.clipboard?.writeText(text);
  }

  // --- lifecycle ----------------------------------------------------------

  let timer;
  function schedule(delay) {
    if (!payload.auto) return;
    clearTimeout(timer);
    timer = setTimeout(() => { lastReport = runPass(); renderHud(); }, delay);
  }

  function boot() {
    if (!document.body) { setTimeout(boot, 100); return; }
    lastReport = payload.auto ? runPass() : lastReport;
    renderHud();
    const obs = new MutationObserver((records) => {
      const structural = records.some((r) => r.addedNodes.length > 0);
      if (!structural) return;
      for (const r of records) {
        for (const n of Array.from(r.addedNodes)) {
          if (n.getAttribute && n.closest("#" + HUD_ID)) return;
        }
      }
      schedule(700);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", (e) => {
      if (!e.altKey) return;
      if (e.key === "f" || e.key === "F") { lastReport = runPass(); renderHud(); }
      if (e.key === "p" || e.key === "P") { const n = grabPrices(); flash(n + " prices sent to the terminal"); }
    });
    send({ type: "ready", url: location.href });
  }

  // Inspection hook for the test suite and for diagnosing a page that won't fill.
  w.__bqrDebug = {
    runPass: runPass,
    labelFor: labelFor,
    groupLabel: groupLabel,
    bestQuestion: bestQuestion,
    personIndexFor: personIndexFor,
    lookup: lookup,
    collectTargets: collectTargets,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
