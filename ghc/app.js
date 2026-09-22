// Vanilla JS only (Bootstrap supplies layout/reset CSS; no charting library).
// All data-derived strings are inserted with textContent, never innerHTML.
(function () {
  "use strict";

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PAGE_SIZE = 10;

  const state = {
    manager: "",
    market: "",
    search: "",
    tableSearch: "",
    status: "",
    sortKey: "tokens",
    sortAsc: false,
    page: 1,
    month: "",
    week: "",
  };

  /* ------------------------------------------------------------ helpers */

  const $ = (id) => document.getElementById(id);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  const fmt = (n) => Math.round(n).toLocaleString();

  function fmtCompact(n) {
    const v = Math.round(n);
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return v.toLocaleString();
  }

  function initials(name) {
    const parts = String(name).replace(",", "").trim().split(/\s+/);
    const first = parts[0] ? parts[0][0] : "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function niceMax(value) {
    if (value <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    const scaled = value / pow;
    const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return step * pow;
  }

  // Finer steps than niceMax, whose 1/2/5/10 jumps would leave the capacity plot half empty.
  function niceCeil(value) {
    if (value <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    return steps.find((s) => s >= value / pow) * pow;
  }

  function arrowIcon(dir) {
    const icon = svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "3" });
    icon.appendChild(svg("path", {
      d: dir === "down" ? "M6 9l6 6 6-6" : dir === "up" ? "M6 15l6-6 6 6" : "M5 12h14",
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
    return icon;
  }

  /* ------------------------------------------- reporting window (data) */

  // Months after the last one carrying any usage are "not yet reported" —
  // charting them as zero would read as a collapse in adoption.
  const lastReported = (function () {
    let last = -1;
    for (const e of EMPLOYEES) {
      for (let i = 0; i < MONTHS.length; i++) {
        if (Number(e.monthlyTokens[MONTHS[i]] || 0) > 0 && i > last) last = i;
      }
    }
    return last;
  })();

  const REPORTED = MONTHS.slice(0, lastReported + 1);
  const YEAR = (EMPLOYEES[0] && EMPLOYEES[0].year) || "";

  /* ---------------------------------------------------------- selectors */

  const monthTokens = (e, month) => Number(e.monthlyTokens[month] || 0);
  const isActiveIn = (e, month) => monthTokens(e, month) > 0;
  const locIn = (e, month) => Number((e.monthlyLinesOfCode || {})[month] || 0);
  const weekTokens = (e, id) => Number((e.weeklyTokens || {})[id] || 0);

  /* ------------------------------------------------------ period (time) */

  // ISO weeks in the data with the span each covers. A week is filed under the
  // month holding most of its reported days, and flagged partial when fewer than
  // 7 of its days fall inside the reporting window.
  const WEEKS = (function () {
    const ids = Object.keys((EMPLOYEES[0] && EMPLOYEES[0].weeklyTokens) || {});
    const firstDay = new Date(Date.UTC(Number(YEAR), 0, 1));
    const lastDay = new Date(Date.UTC(Number(YEAR), lastReported + 1, 0));
    const mon = (d) => MONTHS[d.getUTCMonth()].slice(0, 3);
    return ids.map((id) => {
      const [y, w] = id.split("-W").map(Number);
      const jan4 = new Date(Date.UTC(y, 0, 4));
      const start = new Date(jan4);
      start.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (w - 1) * 7);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);

      const perMonth = {};
      let reported = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        if (d < firstDay || d > lastDay) continue;
        reported += 1;
        perMonth[d.getUTCMonth()] = (perMonth[d.getUTCMonth()] || 0) + 1;
      }
      const monthIdx = Number(Object.keys(perMonth).sort((a, b) => perMonth[b] - perMonth[a])[0]);
      const span = mon(start) + " " + start.getUTCDate() + "–" +
        (end.getUTCMonth() === start.getUTCMonth() ? "" : mon(end) + " ") + end.getUTCDate();
      const partial = reported < 7;
      return { id, month: MONTHS[monthIdx], partial, short: "W" + w,
               label: "W" + w + " · " + span + (partial ? " (partial)" : "") };
    });
  })();

  function monthPeriod(m) {
    return { kind: "month", key: m, month: m, short: m.slice(0, 3), name: m, label: m + " " + YEAR, partial: false };
  }
  function weekPeriod(w) {
    return { kind: "week", key: w.id, month: w.month, short: w.short, name: w.short, label: w.label, partial: w.partial };
  }
  function currentPeriod() {
    if (state.week) return weekPeriod(WEEKS.find((w) => w.id === state.week));
    if (state.month) return monthPeriod(state.month);
    return { kind: "ytd", label: REPORTED[0] + "–" + REPORTED[REPORTED.length - 1] + " " + YEAR };
  }
  // What adoption and the period deltas measure: the selected period, or with
  // none selected, the latest reported month.
  function focusPeriod(period) {
    return period.kind === "ytd" ? monthPeriod(REPORTED[REPORTED.length - 1]) : period;
  }
  function prevOf(p) {
    if (p.kind === "month") {
      const i = REPORTED.indexOf(p.key);
      return i > 0 ? monthPeriod(REPORTED[i - 1]) : null;
    }
    const i = WEEKS.findIndex((w) => w.id === p.key);
    return i > 0 ? weekPeriod(WEEKS[i - 1]) : null;
  }
  // A partial week against a full one would read as a collapse, so no delta then.
  function comparablePrev(p) {
    const prev = prevOf(p);
    return prev && !p.partial && !prev.partial ? prev : null;
  }
  function tokensIn(e, p) {
    if (p.kind === "week") return weekTokens(e, p.key);
    if (p.kind === "month") return monthTokens(e, p.key);
    return Number(e.tokens || 0);
  }

  function getFiltered() {
    const q = state.search.toLowerCase();
    return EMPLOYEES.filter((e) => {
      if (state.manager && e.manager !== state.manager) return false;
      if (state.market && e.marketTag !== state.market) return false;
      if (q) {
        const hay = (e.name + " " + e.login + " " + e.title + " " + e.department).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // Panel-local narrowing: refines only the Employees table, so the KPIs and
  // charts above keep the numbers for the whole global selection.
  function getTableRows(rows) {
    const q = state.tableSearch.toLowerCase();
    return rows.filter((e) => {
      if (state.status === "active" && !e.active) return false;
      if (state.status === "idle" && e.active) return false;
      if (q) {
        const hay = (e.name + " " + e.login + " " + e.title + " " +
          e.department + " " + e.manager + " " + e.marketTag).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function groupTokens(rows, keyFn) {
    const map = new Map();
    for (const r of rows) {
      const key = keyFn(r) || "Unknown";
      if (!map.has(key)) map.set(key, { value: 0, users: 0, active: 0 });
      const g = map.get(key);
      g.value += Number(r.tokens || 0);
      g.users += 1;
      if (r.active) g.active += 1;
    }
    return Array.from(map, ([label, g]) => ({ label, ...g })).sort((a, b) => b.value - a.value);
  }

  function groupAdoption(rows, keyFn, minCount) {
    const map = new Map();
    for (const r of rows) {
      const key = keyFn(r) || "Unknown";
      if (!map.has(key)) map.set(key, { total: 0, active: 0 });
      const g = map.get(key);
      g.total += 1;
      if (r.active) g.active += 1;
    }
    return Array.from(map, ([label, g]) => ({
      label, total: g.total, active: g.active,
      rate: g.total ? (g.active / g.total) * 100 : 0,
    })).filter((g) => g.total >= minCount);
  }

  /* ------------------------------------------------------------ tooltip */

  const tooltipEl = $("tooltip");

  function showTooltip(event, title, rows) {
    clear(tooltipEl);
    tooltipEl.appendChild(el("p", "tt-title", title));
    for (const row of rows) {
      const line = el("div", "tt-row");
      const key = el("span", "tt-key");
      key.style.background = row.color;
      key.style.height = "3px";
      line.appendChild(key);
      line.appendChild(el("span", "tt-val", row.value));
      line.appendChild(el("span", "tt-name", row.name));
      tooltipEl.appendChild(line);
    }
    tooltipEl.classList.add("show");
    positionTooltip(event);
  }

  function positionTooltip(event) {
    const rect = tooltipEl.getBoundingClientRect();
    let x = event.clientX + 14;
    let y = event.clientY - rect.height - 10;
    if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
    if (y < 8) y = event.clientY + 18;
    tooltipEl.style.left = x + "px";
    tooltipEl.style.top = y + "px";
  }

  function hideTooltip() {
    tooltipEl.classList.remove("show");
  }

  /* --------------------------------------------------------- KPI tiles */

  function renderKpis(rows, period) {
    const host = $("kpiRow");
    clear(host);

    const licensed = rows.length;
    const active = rows.filter((e) => e.active).length;
    const tokens = rows.reduce((s, e) => s + Number(e.tokens || 0), 0);
    const inactive = licensed - active;
    const avgPerActive = active ? tokens / active : 0;

    const cur = REPORTED[REPORTED.length - 1];
    const prev = REPORTED.length > 1 ? REPORTED[REPORTED.length - 2] : null;
    const totalLoc = rows.reduce((s, e) => s + Number(e.linesOfCode || 0), 0);
    const curLoc = cur ? rows.reduce((s, e) => s + locIn(e, cur), 0) : 0;
    const prevLoc = prev ? rows.reduce((s, e) => s + locIn(e, prev), 0) : 0;

    const focus = focusPeriod(period);
    const before = comparablePrev(focus);
    const tokensFor = (p) => rows.reduce((s, e) => s + tokensIn(e, p), 0);

    const pctChange = (a, b) => (b ? ((a - b) / b) * 100 : 0);
    const scoped = period.kind !== "ytd";
    const inPeriod = "in " + (scoped ? period.short : "");

    const tiles = [
      { cls: "t1", label: "Capacity Created", value: fmtCompact(totalLoc), delta: pctChange(curLoc, prevLoc), deltaLabel: prev ? "vs " + prev : "" },
      { cls: "t2", label: "Active users / Licensed", value: `${fmt(active)} / ${fmt(licensed)}`, note: scoped ? "active " + inPeriod : "in current selection" },
      before
        ? { cls: "t3", label: "Tokens utilised", value: fmtCompact(tokens), delta: pctChange(tokensFor(focus), tokensFor(before)), deltaLabel: "vs " + before.name }
        : { cls: "t3", label: "Tokens utilised", value: fmtCompact(tokens), note: focus.partial ? "partial week" : inPeriod },
      { cls: "t4", label: "Avg tokens / active user", value: fmtCompact(avgPerActive), note: scoped ? inPeriod : "across " + YEAR },
      { cls: "t5", label: "Idle licences", value: fmt(inactive), note: scoped ? "no usage " + inPeriod : (inactive ? "reclaim candidates" : "none idle") },
    ];

    for (const tile of tiles) {
      const card = el("div", "kpi-tile " + tile.cls);
      card.appendChild(el("span", "kpi-label", tile.label));
      card.appendChild(el("span", "kpi-value", tile.value));

      const foot = el("div", "kpi-foot");
      if (typeof tile.delta === "number" && tile.deltaLabel) {
        const dir = tile.delta > 0.5 ? "up" : tile.delta < -0.5 ? "down" : "flat";
        const chip = el("span", "delta " + dir);
        chip.appendChild(arrowIcon(dir));
        chip.appendChild(document.createTextNode(Math.abs(tile.delta).toFixed(1) + "%"));
        foot.appendChild(chip);
        foot.appendChild(el("span", "kpi-note", tile.deltaLabel));
      } else {
        foot.appendChild(el("span", "kpi-note", tile.note));
      }
      card.appendChild(foot);
      host.appendChild(card);
    }
  }

  /* ---------------------------------------------------------- hero ring */

  // Adoption is measured on the latest reported month (the current month once it
  // has data), so it reflects who is using the tool now, not anyone this year.
  // Adoption = users with token usage in the selected period, or the latest
  // reported month when none is selected, so it reflects who is using it now.
  function renderHero(rows, period) {
    const focus = focusPeriod(period);
    const before = comparablePrev(focus);
    const licensed = rows.length;
    const active = rows.filter((e) => tokensIn(e, focus) > 0).length;
    const tokens = rows.reduce((s, e) => s + tokensIn(e, focus), 0);
    const rate = licensed ? (active / licensed) * 100 : 0;
    const when = focus.kind === "week" ? focus.short : focus.name;

    $("heroSub").textContent = "Users with token usage in " + focus.label;
    $("heroRate").textContent = Math.round(rate) + "%";
    $("heroRateLabel").textContent = "in " + when;
    $("heroActive").textContent = fmt(active);
    $("heroActiveLabel").textContent = "Active in " + focus.short;
    $("heroLicensed").textContent = fmt(licensed);
    $("heroTokens").textContent = fmtCompact(tokens);
    $("heroTokensLabel").textContent = "Tokens in " + focus.short;
    $("heroRingLabel").textContent = "Adoption rate in " + focus.label + ": " + Math.round(rate) +
      " percent. " + active + " of " + licensed + " licensed users had token usage, " +
      fmt(tokens) + " tokens in total.";

    // Change in the rate is in percentage points, not percent.
    const chip = $("heroDelta");
    clear(chip);
    chip.hidden = !(before && licensed);
    if (!chip.hidden) {
      const prevRate = (rows.filter((e) => tokensIn(e, before) > 0).length / licensed) * 100;
      const change = rate - prevRate;
      const dir = change > 0.05 ? "up" : change < -0.05 ? "down" : "flat";
      chip.className = "delta " + dir;
      chip.appendChild(arrowIcon(dir));
      chip.appendChild(document.createTextNode(Math.abs(change).toFixed(1) + " pp vs " + before.name));
    }

    const host = $("heroRing");
    clear(host);
    const r = 52, c = 60, circumference = 2 * Math.PI * r;

    host.appendChild(svg("circle", {
      cx: c, cy: c, r: r, fill: "none",
      stroke: token("--series-licensed"), "stroke-opacity": "0.22", "stroke-width": "12",
    }));

    if (rate > 0) {
      host.appendChild(svg("circle", {
        cx: c, cy: c, r: r, fill: "none",
        stroke: token("--series-active"), "stroke-width": "12", "stroke-linecap": "round",
        "stroke-dasharray": (rate / 100) * circumference + " " + circumference,
      }));
    }
  }

  /* ----------------------------------------- grouped column trend chart */

  function barPath(x, y, w, h, radius) {
    if (h <= 0) return "";
    const r = Math.min(radius, h, w / 2);
    return "M" + x + " " + (y + h) +
      " L" + x + " " + (y + r) +
      " Q" + x + " " + y + " " + (x + r) + " " + y +
      " L" + (x + w - r) + " " + y +
      " Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) +
      " L" + (x + w) + " " + (y + h) + " Z";
  }

  // Monotone cubic (Fritsch-Carlson): smooth, but never overshoots a data point.
  function monotonePath(pts) {
    const n = pts.length;
    if (n < 2) return n ? "M" + pts[0][0] + " " + pts[0][1] : "";
    const dx = [], slope = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      slope[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
    }
    const t = [slope[0]];
    for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
    t[n - 1] = slope[n - 2];
    for (let i = 0; i < n - 1; i++) {
      if (slope[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / slope[i], b = t[i + 1] / slope[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * slope[i]; t[i + 1] = k * b * slope[i]; }
    }
    let d = "M" + pts[0][0] + " " + pts[0][1];
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += " C" + (pts[i][0] + h) + " " + (pts[i][1] + t[i] * h) + " " +
        (pts[i + 1][0] - h) + " " + (pts[i + 1][1] - t[i + 1] * h) + " " +
        pts[i + 1][0] + " " + pts[i + 1][1];
    }
    return d;
  }

  /* ---------------------------------------------------- capacity panel */

  function renderCapacity(rows) {
    const total = rows.reduce((s, e) => s + Number(e.linesOfCode || 0), 0);
    const active = rows.filter((e) => e.active).length;
    const tokens = rows.reduce((s, e) => s + Number(e.tokens || 0), 0);
    const contributors = rows.filter((e) => Number(e.linesOfCode || 0) > 0).length;

    const cur = REPORTED[REPORTED.length - 1];
    const prev = REPORTED.length > 1 ? REPORTED[REPORTED.length - 2] : null;
    const curLoc = rows.reduce((s, e) => s + locIn(e, cur), 0);
    const prevLoc = prev ? rows.reduce((s, e) => s + locIn(e, prev), 0) : 0;

    $("capacitySub").textContent =
      "Lines committed in Bitbucket · " + REPORTED[0].slice(0, 3) + "–" + cur.slice(0, 3) + " " + YEAR;
    $("capacityFigure").textContent = fmtCompact(total);
    $("capacityMonth").textContent = fmtCompact(curLoc);
    $("capacityMonthLabel").textContent = "in " + cur;
    $("capacityPerUser").textContent = active ? fmtCompact(total / active) : "—";
    $("capacityPerToken").textContent = tokens ? fmt(total / (tokens / 1000)) : "—";
    $("capacityContributors").textContent = fmt(contributors);

    const chip = $("capacityDelta");
    clear(chip);
    chip.hidden = !(prev && prevLoc);
    if (!chip.hidden) {
      const change = ((curLoc - prevLoc) / prevLoc) * 100;
      const dir = change > 0.5 ? "up" : change < -0.5 ? "down" : "flat";
      chip.className = "delta " + dir;
      chip.appendChild(arrowIcon(dir));
      chip.appendChild(document.createTextNode(Math.abs(change).toFixed(1) + "% vs " + prev));
    }
  }

  /* ------------------------- capacity line + licensed/active columns */

  function renderTrend(rows, period) {
    const host = $("trendChart");
    clear(host);

    const licensedCount = rows.length;
    const series = REPORTED.map((month) => ({
      month,
      licensed: licensedCount,
      active: rows.filter((e) => isActiveIn(e, month)).length,
      tokens: rows.reduce((s, e) => s + monthTokens(e, month), 0),
      loc: rows.reduce((s, e) => s + locIn(e, month), 0),
    }));

    $("trendSub").textContent = "Month-on-month utilisation and lines committed · " +
      REPORTED[0] + "–" + REPORTED[REPORTED.length - 1] + " " + YEAR;
    renderTrendTable(series);

    if (!series.length || !licensedCount) {
      host.appendChild(el("p", "empty-state", "No employees match the current filters."));
      return;
    }

    // Two small multiples on one shared month axis. Lines committed and user counts
    // are different scales, so each plot keeps its own y-axis: a dual-axis overlay
    // would imply a correlation that the arbitrary scale alignment cannot support.
    const W = 760, H = 392, left = 52, right = 10;
    const plotW = W - left - right;
    const cap = { top: 32, height: 112 };
    const bar = { top: 192, height: 164 };
    const band = plotW / series.length;
    const cx = (i) => left + band * i + band / 2;

    const capMax = niceCeil(Math.max(...series.map((p) => p.loc), 1) * 1.08);
    const capY = (v) => cap.top + cap.height - (v / capMax) * cap.height;
    const barMax = niceMax(licensedCount);
    const barY = (v) => bar.top + bar.height - (v / barMax) * bar.height;
    const barBase = bar.top + bar.height;

    const colLicensed = token("--series-licensed");
    const colActive = token("--series-active");
    const colCapacity = token("--series-capacity");
    const colSurface = token("--surface");

    const root = svg("svg", {
      viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img",
      "aria-label": "Lines committed per month, and licensed versus active users per month",
    });
    const addText = (x, y, text, cls, anchor) => {
      const node = svg("text", { x, y, "text-anchor": anchor || "middle", class: cls });
      node.textContent = text;
      root.appendChild(node);
    };
    const gridline = (y, tick) => {
      root.appendChild(svg("line", { x1: left, y1: y, x2: W - right, y2: y, class: "chart-grid-line" }));
      addText(left - 9, y + 4, tick, "chart-axis-text", "end");
    };

    const spanTop = cap.top - 8;
    const selected = period.kind === "ytd" ? -1 : series.findIndex((p) => p.month === period.month);
    if (selected >= 0) {
      root.appendChild(svg("rect", {
        x: left + band * selected + 2, y: spanTop, width: band - 4, height: barBase - spanTop,
        rx: 6, class: "chart-band-selected",
      }));
    }
    const highlights = series.map((p, i) => {
      const rect = svg("rect", {
        x: left + band * i + 2, y: spanTop, width: band - 4, height: barBase - spanTop,
        rx: 6, class: "chart-band-hl",
      });
      root.appendChild(rect);
      return rect;
    });

    addText(left, cap.top - 16, "Capacity created · lines committed", "chart-facet-text", "start");
    addText(left, bar.top - 16, "Licensed vs active users", "chart-facet-text", "start");
    for (let i = 0; i <= 2; i++) gridline(capY((capMax / 2) * i), fmtCompact((capMax / 2) * i));
    for (let i = 0; i <= 4; i++) gridline(barY((barMax / 4) * i), fmtCompact((barMax / 4) * i));

    const pts = series.map((p, i) => [cx(i), capY(p.loc)]);
    const line = monotonePath(pts);
    const last = series.length - 1;
    root.appendChild(svg("path", {
      d: line + " L" + pts[last][0] + " " + capY(0) + " L" + pts[0][0] + " " + capY(0) + " Z",
      fill: colCapacity, "fill-opacity": "0.1",
    }));
    root.appendChild(svg("path", {
      d: line, fill: "none", stroke: colCapacity, "stroke-width": "2",
      "stroke-linejoin": "round", "stroke-linecap": "round",
    }));

    const barW = Math.min(24, Math.max(8, band / 2 - 5));
    const pairX = (i) => left + band * i + (band - (barW * 2 + 2)) / 2;
    series.forEach((p, i) => {
      const x0 = pairX(i);
      root.appendChild(svg("path", { d: barPath(x0, barY(p.licensed), barW, barBase - barY(p.licensed), 4), fill: colLicensed }));
      root.appendChild(svg("path", { d: barPath(x0 + barW + 2, barY(p.active), barW, barBase - barY(p.active), 4), fill: colActive }));
      addText(cx(i), H - 12, p.month.slice(0, 3), "chart-axis-text");
    });

    // Direct labels on the final month only; the axis and tooltip carry the rest.
    const lp = series[last];
    addText(pairX(last) + barW / 2, barY(lp.licensed) - 7, fmt(lp.licensed), "chart-label-text");
    addText(pairX(last) + barW * 1.5 + 2, barY(lp.active) - 7, fmt(lp.active), "chart-label-text");
    root.appendChild(svg("circle", {
      cx: pts[last][0], cy: pts[last][1], r: 4, fill: colCapacity, stroke: colSurface, "stroke-width": 2,
    }));
    addText(pts[last][0], pts[last][1] - 11, fmtCompact(lp.loc), "chart-label-text");

    const hoverDot = svg("circle", {
      r: 4.5, fill: colCapacity, stroke: colSurface, "stroke-width": 2,
      opacity: 0, "pointer-events": "none",
    });
    root.appendChild(hoverDot);

    series.forEach((p, i) => {
      const rate = p.licensed ? Math.round((p.active / p.licensed) * 100) : 0;
      const hit = svg("rect", {
        x: left + band * i, y: spanTop, width: band, height: barBase - spanTop,
        class: "chart-hit", tabindex: "0", role: "button",
        "aria-label": p.month + ": " + fmt(p.loc) + " lines committed, " +
          p.active + " active of " + p.licensed + " licensed",
      });
      const enter = (event) => {
        highlights[i].style.opacity = "1";
        hoverDot.setAttribute("cx", pts[i][0]);
        hoverDot.setAttribute("cy", pts[i][1]);
        hoverDot.setAttribute("opacity", "1");
        showTooltip(event, p.month + " " + YEAR, [
          { color: colCapacity, value: fmt(p.loc), name: "Lines committed" },
          { color: colLicensed, value: fmt(p.licensed), name: "Licensed" },
          { color: colActive, value: fmt(p.active), name: "Active · " + rate + "%" },
          { color: "transparent", value: fmtCompact(p.tokens), name: "Tokens" },
        ]);
      };
      const leave = () => {
        highlights[i].style.opacity = "0";
        hoverDot.setAttribute("opacity", "0");
        hideTooltip();
      };
      hit.addEventListener("pointerenter", enter);
      hit.addEventListener("pointermove", positionTooltip);
      hit.addEventListener("focus", () => {
        const box = hit.getBoundingClientRect();
        enter({ clientX: box.left + box.width / 2, clientY: box.top + 40 });
      });
      hit.addEventListener("pointerleave", leave);
      hit.addEventListener("blur", leave);
      root.appendChild(hit);
    });

    host.appendChild(root);
  }

  function renderTrendTable(series) {
    const host = $("trendTable");
    clear(host);
    const table = el("table", "data-table mini-table");
    const thead = el("thead");
    const hrow = el("tr");
    ["Month", "Licensed", "Active", "Adoption", "Tokens", "Lines committed", "Lines / 1K tokens"].forEach((h, i) => {
      const th = el("th", null, h);
      if (i > 0) th.style.textAlign = "right";
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const p of series) {
      const tr = el("tr");
      tr.appendChild(el("td", null, p.month));
      [
        fmt(p.licensed),
        fmt(p.active),
        p.licensed ? Math.round((p.active / p.licensed) * 100) + "%" : "—",
        fmt(p.tokens),
        fmt(p.loc),
        p.tokens ? fmt(p.loc / (p.tokens / 1000)) : "—",
      ].forEach((v) => {
        const td = el("td", "num", v);
        td.style.textAlign = "right";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    host.appendChild(table);
  }

  /* ------------------------------------------------ horizontal bar list */

  // The chart shows the top `limit` rows for a consistent row rhythm across cards;
  // the table twin always carries the full list, so nothing is hidden.
  function renderBarList(hostId, tableId, subId, allRows, limit, unitLabel, scope) {
    const host = $(hostId);
    clear(host);

    const total = allRows.reduce((s, r) => s + r.value, 0);
    const rows = allRows.slice(0, limit);

    $(subId).textContent = scope +
      (allRows.length > rows.length ? " · top " + rows.length + " of " + allRows.length : "");

    if (!rows.length) {
      host.appendChild(el("p", "empty-state", "No data for the current filters."));
      clear($(tableId));
      return;
    }

    const max = Math.max(...rows.map((r) => r.value), 1);
    const color = token("--series-licensed");
    const list = el("div", "bar-list");
    list.setAttribute("role", "list");

    for (const row of rows) {
      const share = total ? (row.value / total) * 100 : 0;
      const perUser = row.users ? row.value / row.users : 0;

      const line = el("div", "bar-row");
      line.tabIndex = 0;
      line.setAttribute("role", "listitem");
      line.setAttribute("aria-label",
        row.label + ": " + fmt(row.value) + " tokens, " + share.toFixed(1) + "% of selection, " + row.users + " users");

      const top = el("div", "bar-top");
      const name = el("span", "bar-name", row.label);
      name.title = row.label;
      top.appendChild(name);
      top.appendChild(el("span", "bar-meta", row.users + (row.users === 1 ? " user" : " users")));
      top.appendChild(el("span", "bar-num", fmtCompact(row.value)));
      line.appendChild(top);

      const fill = el("span", "bar-fill");
      fill.style.width = Math.max((row.value / max) * 100, 1) + "%";
      fill.style.background = color;
      line.appendChild(fill);

      const enter = (event) => showTooltip(event, row.label, [
        { color: color, value: fmt(row.value), name: unitLabel },
        { color: "transparent", value: share.toFixed(1) + "%", name: "of selection" },
        { color: "transparent", value: fmtCompact(perUser), name: "avg / user" },
        { color: "transparent", value: row.active + " / " + row.users, name: "active" },
      ]);
      line.addEventListener("pointerenter", enter);
      line.addEventListener("pointermove", positionTooltip);
      line.addEventListener("focus", () => {
        const box = line.getBoundingClientRect();
        enter({ clientX: box.left + box.width / 2, clientY: box.top });
      });
      line.addEventListener("pointerleave", hideTooltip);
      line.addEventListener("blur", hideTooltip);

      list.appendChild(line);
    }
    host.appendChild(list);

    // table twin
    const tableHost = $(tableId);
    clear(tableHost);
    const table = el("table", "data-table mini-table");
    const thead = el("thead");
    const hrow = el("tr");
    ["Name", unitLabel, "Users", "Avg / user"].forEach((label, i) => {
      const th = el("th", null, label);
      if (i > 0) th.style.textAlign = "right";
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const row of allRows) {
      const tr = el("tr");
      tr.appendChild(el("td", null, row.label));
      const cells = [
        fmt(row.value),
        fmt(row.users),
        fmt(row.users ? row.value / row.users : 0),
      ];
      cells.forEach((value) => {
        const td = el("td", "num", value);
        td.style.textAlign = "right";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableHost.appendChild(table);
  }

  /* ------------------------------------------------------- rank lists */

  function renderRisk(rows, period) {
    const host = $("riskList");
    clear(host);
    $("riskSub").textContent = "Lowest team adoption (3+ licences)" +
      (period.kind === "ytd" ? "" : " · " + period.label);
    const teams = groupAdoption(rows, (e) => e.manager, 3)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 6);

    if (!teams.length) {
      host.appendChild(el("p", "empty-state", "No teams with 3 or more licences in this selection."));
      return;
    }

    for (const team of teams) {
      const item = el("div", "rank-item");
      item.appendChild(el("span", "rank-badge", initials(team.label)));
      const body = el("div", "rank-body");
      body.appendChild(el("p", "rank-name", team.label));
      body.appendChild(el("p", "rank-meta", team.active + " of " + team.total + " active"));
      item.appendChild(body);
      item.appendChild(el("span", "rank-value", Math.round(team.rate) + "%"));
      host.appendChild(item);
    }
  }

  function renderTopUsers(rows, period) {
    const host = $("topUsers");
    clear(host);
    $("topUsersSub").textContent = "Highest token consumption" +
      (period.kind === "ytd" ? "" : " · " + period.label);
    const top = rows.filter((e) => e.tokens > 0).sort((a, b) => b.tokens - a.tokens).slice(0, 6);

    if (!top.length) {
      host.appendChild(el("p", "empty-state", "No token usage for this selection."));
      return;
    }

    for (const person of top) {
      const item = el("div", "rank-item");
      item.appendChild(el("span", "rank-badge", initials(person.name)));
      const body = el("div", "rank-body");
      body.appendChild(el("p", "rank-name", person.name));
      body.appendChild(el("p", "rank-meta", person.title + " · " + person.marketTag));
      item.appendChild(body);
      item.appendChild(el("span", "rank-value", fmtCompact(person.tokens)));
      host.appendChild(item);
    }
  }

  /* --------------------------------------------------- employee table */

  function renderEmployees(rows, period) {
    const tbody = document.querySelector("#employeeTable tbody");
    clear(tbody);

    const narrowed = getTableRows(rows);
    const narrowing = Boolean(state.tableSearch || state.status);
    $("clearTableFilters").hidden = !narrowing;
    $("employeeSub").textContent = (narrowing
      ? "Filtered to " + fmt(narrowed.length) + " of " + fmt(rows.length) + " in the current selection"
      : "Licence holders in the current selection") +
      (period.kind === "ytd" ? "" : " · tokens for " + period.label);

    const sorted = [...narrowed].sort((a, b) => {
      const av = a[state.sortKey];
      const bv = b[state.sortKey];
      let cmp;
      if (typeof av === "number" || typeof av === "boolean") cmp = av === bv ? 0 : av > bv ? 1 : -1;
      else cmp = String(av || "").localeCompare(String(bv || ""));
      return state.sortAsc ? cmp : -cmp;
    });

    const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = sorted.slice(start, start + PAGE_SIZE);

    if (!slice.length) {
      const tr = el("tr");
      const td = el("td", "empty-state", narrowing
        ? "No employees match these table filters."
        : "No employees match the current filters.");
      td.colSpan = 5;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    for (const person of slice) {
      const tr = el("tr");

      const nameCell = el("td");
      const wrap = el("div", "person");
      wrap.appendChild(el("span", "person-avatar", initials(person.name)));
      const meta = el("div");
      meta.appendChild(el("p", "person-name", person.name));
      meta.appendChild(el("p", "person-meta", person.title));
      meta.title = person.name + " · " + person.title;
      wrap.appendChild(meta);
      nameCell.appendChild(wrap);
      tr.appendChild(nameCell);

      const managerCell = el("td", null, person.manager);
      managerCell.title = person.manager;
      tr.appendChild(managerCell);
      const marketCell = el("td", null, person.marketTag);
      marketCell.title = person.marketTag;
      tr.appendChild(marketCell);

      const statusCell = el("td");
      const pill = el("span", "pill " + (person.active ? "is-active" : "is-inactive"));
      pill.appendChild(el("i", "dot"));
      pill.appendChild(document.createTextNode(person.active ? "Active" : "Idle"));
      statusCell.appendChild(pill);
      tr.appendChild(statusCell);

      const tokenCell = el("td", "num", fmt(person.tokens));
      tokenCell.style.textAlign = "right";
      tr.appendChild(tokenCell);

      tbody.appendChild(tr);
    }

    $("rowCount").textContent =
      sorted.length
        ? "Showing " + (start + 1) + "–" + Math.min(start + PAGE_SIZE, sorted.length) + " of " + fmt(sorted.length)
        : "No results";

    syncSortControls();
    renderPager(pages);
  }

  function syncSortControls() {
    const dir = state.sortAsc ? "asc" : "desc";
    document.querySelectorAll("#employeeTable th[data-sort]").forEach((th) => {
      th.setAttribute("aria-sort",
        th.dataset.sort === state.sortKey ? (state.sortAsc ? "ascending" : "descending") : "none");
    });
    $("employeeSort").value = state.sortKey + "-" + dir;
  }

  function renderPager(pages) {
    const host = $("pager");
    clear(host);
    if (pages <= 1) return;

    const addButton = (label, page, disabled, current) => {
      const button = el("button", null, label);
      button.type = "button";
      if (disabled) button.disabled = true;
      if (current) button.setAttribute("aria-current", "true");
      button.addEventListener("click", () => { state.page = page; render(); });
      host.appendChild(button);
    };

    addButton("‹", state.page - 1, state.page === 1, false);
    const window_ = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - state.page) <= 1) window_.push(p);
    }
    let previous = 0;
    for (const p of window_) {
      if (previous && p - previous > 1) {
        const gap = el("button", null, "…");
        gap.type = "button";
        gap.disabled = true;
        host.appendChild(gap);
      }
      addButton(String(p), p, false, p === state.page);
      previous = p;
    }
    addButton("›", state.page + 1, state.page === pages, false);
  }

  /* -------------------------------------------------- filter chip row */

  function renderChips(period) {
    const host = $("activeFilters");
    clear(host);

    const chips = [];
    if (period.kind !== "ytd") chips.push({ label: "Period: " + period.label, clear: () => { setPeriod("", ""); } });
    if (state.manager) chips.push({ label: "Manager: " + state.manager, clear: () => { state.manager = ""; $("managerFilter").value = ""; } });
    if (state.market) chips.push({ label: "Market: " + state.market, clear: () => { state.market = ""; $("marketFilter").value = ""; } });
    if (state.search) chips.push({ label: 'Search: "' + state.search + '"', clear: () => { state.search = ""; $("searchInput").value = ""; } });

    if (!chips.length) {
      host.appendChild(el("span", "row-count", "Showing all markets and managers"));
      return;
    }

    for (const chip of chips) {
      const node = el("span", "filter-chip", chip.label);
      const button = el("button", null, "×");
      button.type = "button";
      button.setAttribute("aria-label", "Clear " + chip.label);
      button.addEventListener("click", () => { chip.clear(); state.page = 1; render(); });
      node.appendChild(button);
      host.appendChild(node);
    }
  }

  /* -------------------------------------------------------- render all */

  function render() {
    const base = getFiltered();
    const period = currentPeriod();
    // Token views read e.tokens / e.active, so a selected period is projected onto
    // those two fields. Capacity and the monthly trend keep the unprojected rows.
    const rows = period.kind === "ytd" ? base : base.map((e) => {
      const tokens = tokensIn(e, period);
      return Object.assign({}, e, { tokens, active: tokens > 0 });
    });
    const scope = period.kind === "ytd" ? "Total tokens utilised" : "Tokens utilised in " + period.label;

    renderChips(period);
    renderKpis(rows, period);
    renderCapacity(base);
    renderHero(base, period);
    renderTrend(base, period);
    renderBarList("marketChart", "marketTable", "marketSub", groupTokens(rows, (e) => e.marketTag), 8, "Tokens", scope);
    renderBarList("managerChart", "managerTable", "managerSub", groupTokens(rows, (e) => e.manager), 8, "Tokens", scope);
    renderBarList("departmentChart", "departmentTable", "departmentSub", groupTokens(rows, (e) => e.department), 8, "Tokens", scope);
    renderRisk(rows, period);
    renderTopUsers(rows, period);
    renderEmployees(rows, period);

    const markets = new Set(rows.map((e) => e.marketTag)).size;
    const teams = new Set(rows.map((e) => e.manager)).size;
    $("pageSubtitle").textContent =
      "Licence utilisation across " + markets + (markets === 1 ? " market · " : " markets · ") +
      teams + (teams === 1 ? " team" : " teams");
  }

  /* ------------------------------------------------------------- theme */

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(choice) {
    if (choice === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", choice);

    try {
      if (choice === "system") localStorage.removeItem("ghc-theme");
      else localStorage.setItem("ghc-theme", choice);
    } catch (e) { /* storage blocked — theme still applies for this session */ }

    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === choice));
    });
    render();
  }

  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
  });

  mediaQuery.addEventListener("change", () => {
    if (!document.documentElement.hasAttribute("data-theme")) render();
  });

  /* -------------------------------------------------- filters & events */

  function fillSelect(select, values) {
    Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)).forEach((value) => {
      const option = el("option", null, value);
      option.value = value;
      select.appendChild(option);
    });
  }

  REPORTED.forEach((month) => {
    const option = el("option", null, month);
    option.value = month;
    $("monthFilter").appendChild(option);
  });
  $("monthFilter").options[0].textContent = "All months (" + REPORTED[0].slice(0, 3) + "–" +
    REPORTED[REPORTED.length - 1].slice(0, 3) + ")";

  // The week list follows the chosen month, so the two controls never disagree.
  function fillWeekOptions() {
    const select = $("weekFilter");
    while (select.options.length > 1) select.remove(1);
    select.options[0].textContent = state.month ? "All weeks in " + state.month.slice(0, 3) : "All weeks";
    WEEKS.filter((w) => !state.month || w.month === state.month).forEach((w) => {
      const option = el("option", null, w.label);
      option.value = w.id;
      select.appendChild(option);
    });
    select.value = state.week;
  }

  function setPeriod(month, week) {
    state.month = month;
    state.week = week;
    $("monthFilter").value = month;
    fillWeekOptions();
  }

  $("monthFilter").addEventListener("change", (e) => {
    setPeriod(e.target.value, "");
    state.page = 1;
    render();
  });
  $("weekFilter").addEventListener("change", (e) => {
    const week = WEEKS.find((w) => w.id === e.target.value);
    setPeriod(week ? week.month : state.month, week ? week.id : "");
    state.page = 1;
    render();
  });
  fillWeekOptions();

  fillSelect($("managerFilter"), EMPLOYEES.map((e) => e.manager));
  fillSelect($("marketFilter"), EMPLOYEES.map((e) => e.marketTag));

  $("managerFilter").addEventListener("change", (e) => { state.manager = e.target.value; state.page = 1; render(); });
  $("marketFilter").addEventListener("change", (e) => { state.market = e.target.value; state.page = 1; render(); });

  let searchTimer;
  $("searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const value = e.target.value.trim();
    searchTimer = setTimeout(() => { state.search = value; state.page = 1; render(); }, 160);
  });

  let tableSearchTimer;
  $("tableSearch").addEventListener("input", (e) => {
    clearTimeout(tableSearchTimer);
    const value = e.target.value.trim();
    tableSearchTimer = setTimeout(() => { state.tableSearch = value; state.page = 1; render(); }, 160);
  });

  $("statusFilter").addEventListener("change", (e) => {
    state.status = e.target.value;
    state.page = 1;
    render();
  });

  $("employeeSort").addEventListener("change", (e) => {
    const [key, direction] = e.target.value.split("-");
    state.sortKey = key;
    state.sortAsc = direction === "asc";
    state.page = 1;
    render();
  });

  $("clearTableFilters").addEventListener("click", () => {
    state.tableSearch = "";
    state.status = "";
    state.page = 1;
    $("tableSearch").value = "";
    $("statusFilter").value = "";
    render();
  });

  $("resetFilters").addEventListener("click", () => {
    setPeriod("", "");
    state.manager = ""; state.market = ""; state.search = "";
    state.tableSearch = ""; state.status = ""; state.page = 1;
    $("managerFilter").value = ""; $("marketFilter").value = ""; $("searchInput").value = "";
    $("tableSearch").value = ""; $("statusFilter").value = "";
    render();
  });

  document.querySelectorAll("#employeeTable th[data-sort]").forEach((th) => {
    th.setAttribute("tabindex", "0");
    th.setAttribute("role", "button");
    const sortBy = () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) state.sortAsc = !state.sortAsc;
      else { state.sortKey = key; state.sortAsc = key === "name" || key === "manager" || key === "marketTag"; }
      state.page = 1;
      render();
    };
    th.addEventListener("click", sortBy);
    th.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); sortBy(); }
    });
  });

  document.querySelectorAll("[data-chart-card]").forEach((card) => {
    const name = card.dataset.chartCard;
    card.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        card.querySelectorAll("[data-view]").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.dataset.view === button.dataset.view));
        });
        const showTable = button.dataset.view === "table";
        $(name + "Chart").hidden = showTable;
        $(name + "Table").hidden = !showTable;
      });
    });
  });

  const sidebar = $("sidebar");
  const scrim = $("scrim");
  $("sidebarToggle").addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
    scrim.classList.toggle("is-open");
  });
  scrim.addEventListener("click", () => {
    sidebar.classList.remove("is-open");
    scrim.classList.remove("is-open");
  });

  window.addEventListener("scroll", hideTooltip, { passive: true });

  /* --------------------------------------------------------- bootstrap */

  const lastMonth = REPORTED[REPORTED.length - 1];
  $("snapshotBadge").textContent = "Data as of " + lastMonth + " " + YEAR;
  $("noteText").textContent =
    "Reporting covers " + REPORTED[0] + "–" + lastMonth + " " + YEAR + "; " +
    (lastReported < 11 ? MONTHS[lastReported + 1] + "–" + MONTHS[11] + " are not yet reported and are excluded from the trend. " : "") +
    "Time saved is not available — no source data currently tracks it.";

  applyTheme((function () {
    try {
      const saved = localStorage.getItem("ghc-theme");
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch (e) { return "system"; }
  })());
})();
