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

  function renderKpis(rows) {
    const host = $("kpiRow");
    clear(host);

    const licensed = rows.length;
    const active = rows.filter((e) => e.active).length;
    const tokens = rows.reduce((s, e) => s + Number(e.tokens || 0), 0);
    const inactive = licensed - active;
    const avgPerActive = active ? tokens / active : 0;

    const cur = REPORTED[REPORTED.length - 1];
    const prev = REPORTED.length > 1 ? REPORTED[REPORTED.length - 2] : null;

    const curActive = cur ? rows.filter((e) => isActiveIn(e, cur)).length : 0;
    const prevActive = prev ? rows.filter((e) => isActiveIn(e, prev)).length : 0;
    const curTokens = cur ? rows.reduce((s, e) => s + monthTokens(e, cur), 0) : 0;
    const prevTokens = prev ? rows.reduce((s, e) => s + monthTokens(e, prev), 0) : 0;

    const pctChange = (a, b) => (b ? ((a - b) / b) * 100 : 0);

    const tiles = [
      { cls: "t1", label: "Licensed users", value: fmt(licensed), note: "in current selection" },
      { cls: "t2", label: "Active users", value: fmt(active), delta: pctChange(curActive, prevActive), deltaLabel: prev ? "vs " + prev : "" },
      { cls: "t3", label: "Tokens utilised", value: fmtCompact(tokens), delta: pctChange(curTokens, prevTokens), deltaLabel: prev ? "vs " + prev : "" },
      { cls: "t4", label: "Avg tokens / active user", value: fmtCompact(avgPerActive), note: "across " + YEAR },
      { cls: "t5", label: "Idle licences", value: fmt(inactive), note: inactive ? "reclaim candidates" : "none idle" },
    ];

    for (const tile of tiles) {
      const card = el("div", "kpi-tile " + tile.cls);
      card.appendChild(el("span", "kpi-label", tile.label));
      card.appendChild(el("span", "kpi-value", tile.value));

      const foot = el("div", "kpi-foot");
      if (typeof tile.delta === "number" && tile.deltaLabel) {
        const dir = tile.delta > 0.5 ? "up" : tile.delta < -0.5 ? "down" : "flat";
        const chip = el("span", "delta " + dir);
        const arrow = svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "3" });
        const path = svg("path", {
          d: dir === "down" ? "M6 9l6 6 6-6" : dir === "up" ? "M6 15l6-6 6 6" : "M5 12h14",
          "stroke-linecap": "round", "stroke-linejoin": "round",
        });
        arrow.appendChild(path);
        chip.appendChild(arrow);
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

  function renderHero(rows) {
    const licensed = rows.length;
    const active = rows.filter((e) => e.active).length;
    const rate = licensed ? (active / licensed) * 100 : 0;

    $("heroRate").textContent = Math.round(rate) + "%";
    $("heroActive").textContent = fmt(active);
    $("heroLicensed").textContent = fmt(licensed);
    $("heroRingLabel").textContent =
      "Adoption rate " + Math.round(rate) + " percent: " + active + " active of " + licensed + " licensed users.";

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

  function renderTrend(rows) {
    const host = $("trendChart");
    clear(host);

    const licensedCount = rows.length;
    const series = REPORTED.map((month) => ({
      month,
      licensed: licensedCount,
      active: rows.filter((e) => isActiveIn(e, month)).length,
      tokens: rows.reduce((s, e) => s + monthTokens(e, month), 0),
    }));

    $("trendSub").textContent =
      "Month-on-month utilisation · " + REPORTED[0] + "–" + REPORTED[REPORTED.length - 1] + " " + YEAR;

    if (!series.length || !licensedCount) {
      host.appendChild(el("p", "empty-state", "No employees match the current filters."));
      renderTrendTable(series);
      return;
    }

    const W = 760, H = 250;
    const m = { top: 22, right: 10, bottom: 34, left: 46 };
    const plotW = W - m.left - m.right;
    const plotH = H - m.top - m.bottom;
    const top = niceMax(licensedCount);
    const yOf = (v) => m.top + plotH - (v / top) * plotH;

    const root = svg("svg", {
      viewBox: "0 0 " + W + " " + H, class: "chart-svg",
      preserveAspectRatio: "xMidYMid meet", role: "img",
      "aria-label": "Licensed versus active users per month",
    });

    // gridlines + y ticks
    for (let i = 0; i <= 4; i++) {
      const value = (top / 4) * i;
      const y = yOf(value);
      root.appendChild(svg("line", { x1: m.left, y1: y, x2: W - m.right, y2: y, class: "chart-grid-line" }));
      const tick = svg("text", { x: m.left - 9, y: y + 4, "text-anchor": "end", class: "chart-axis-text" });
      tick.textContent = fmtCompact(value);
      root.appendChild(tick);
    }

    const band = plotW / series.length;
    const barW = Math.min(24, Math.max(8, band / 2 - 5));
    const colLicensed = token("--series-licensed");
    const colActive = token("--series-active");

    series.forEach((point, i) => {
      const bandX = m.left + band * i;
      const pairW = barW * 2 + 2; // 2px surface gap between the pair
      const x0 = bandX + (band - pairW) / 2;

      const highlight = svg("rect", {
        x: bandX + 2, y: m.top, width: band - 4, height: plotH, rx: 6, class: "chart-band-hl",
      });
      root.appendChild(highlight);

      const hLic = plotH - (yOf(point.licensed) - m.top);
      const hAct = plotH - (yOf(point.active) - m.top);
      root.appendChild(svg("path", { d: barPath(x0, yOf(point.licensed), barW, hLic, 4), fill: colLicensed }));
      root.appendChild(svg("path", { d: barPath(x0 + barW + 2, yOf(point.active), barW, hAct, 4), fill: colActive }));

      // Direct labels on the final month only — the axis and tooltip carry the rest.
      if (i === series.length - 1) {
        const labLic = svg("text", { x: x0 + barW / 2, y: yOf(point.licensed) - 7, "text-anchor": "middle", class: "chart-label-text" });
        labLic.textContent = fmt(point.licensed);
        root.appendChild(labLic);
        const labAct = svg("text", { x: x0 + barW + 2 + barW / 2, y: yOf(point.active) - 7, "text-anchor": "middle", class: "chart-label-text" });
        labAct.textContent = fmt(point.active);
        root.appendChild(labAct);
      }

      const monthLabel = svg("text", {
        x: bandX + band / 2, y: H - 12, "text-anchor": "middle", class: "chart-axis-text",
      });
      monthLabel.textContent = point.month.slice(0, 3);
      root.appendChild(monthLabel);

      const hit = svg("rect", {
        x: bandX, y: m.top, width: band, height: plotH,
        class: "chart-hit", tabindex: "0", role: "button",
        "aria-label": point.month + ": " + point.active + " active of " + point.licensed + " licensed",
      });
      const rate = point.licensed ? Math.round((point.active / point.licensed) * 100) : 0;
      const enter = (event) => {
        highlight.style.opacity = "1";
        showTooltip(event, point.month + " " + YEAR, [
          { color: colLicensed, value: fmt(point.licensed), name: "Licensed" },
          { color: colActive, value: fmt(point.active), name: "Active · " + rate + "%" },
          { color: "transparent", value: fmtCompact(point.tokens), name: "Tokens" },
        ]);
      };
      hit.addEventListener("pointerenter", enter);
      hit.addEventListener("pointermove", positionTooltip);
      hit.addEventListener("focus", () => {
        const box = hit.getBoundingClientRect();
        enter({ clientX: box.left + box.width / 2, clientY: box.top + 40 });
      });
      const leave = () => { highlight.style.opacity = "0"; hideTooltip(); };
      hit.addEventListener("pointerleave", leave);
      hit.addEventListener("blur", leave);
      root.appendChild(hit);
    });

    host.appendChild(root);
    renderTrendTable(series);
  }

  function renderTrendTable(series) {
    const host = $("trendTable");
    clear(host);
    const table = el("table", "data-table mini-table");
    const thead = el("thead");
    const hrow = el("tr");
    ["Month", "Licensed", "Active", "Adoption", "Tokens"].forEach((h, i) => {
      const th = el("th", null, h);
      if (i > 0) th.style.textAlign = "right";
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const point of series) {
      const tr = el("tr");
      tr.appendChild(el("td", null, point.month));
      const rate = point.licensed ? Math.round((point.active / point.licensed) * 100) + "%" : "—";
      [fmt(point.licensed), fmt(point.active), rate, fmt(point.tokens)].forEach((v) => {
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
  function renderBarList(hostId, tableId, subId, allRows, limit, unitLabel) {
    const host = $(hostId);
    clear(host);

    const total = allRows.reduce((s, r) => s + r.value, 0);
    const rows = allRows.slice(0, limit);

    $(subId).textContent = "Total tokens utilised" +
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
    ["Name", unitLabel, "Share", "Users", "Avg / user"].forEach((label, i) => {
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
        (total ? ((row.value / total) * 100).toFixed(1) : "0") + "%",
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

  function renderRisk(rows) {
    const host = $("riskList");
    clear(host);
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

  function renderTopUsers(rows) {
    const host = $("topUsers");
    clear(host);
    const top = [...rows].sort((a, b) => b.tokens - a.tokens).slice(0, 6);

    if (!top.length) {
      host.appendChild(el("p", "empty-state", "No employees match the current filters."));
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

  function renderEmployees(rows) {
    const tbody = document.querySelector("#employeeTable tbody");
    clear(tbody);

    const narrowed = getTableRows(rows);
    const narrowing = Boolean(state.tableSearch || state.status);
    $("clearTableFilters").hidden = !narrowing;
    $("employeeSub").textContent = narrowing
      ? "Filtered to " + fmt(narrowed.length) + " of " + fmt(rows.length) + " in the current selection"
      : "Licence holders in the current selection";

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
      wrap.appendChild(meta);
      nameCell.appendChild(wrap);
      tr.appendChild(nameCell);

      tr.appendChild(el("td", null, person.manager));
      tr.appendChild(el("td", null, person.marketTag));

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

  function renderChips() {
    const host = $("activeFilters");
    clear(host);

    const chips = [];
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
    const rows = getFiltered();

    renderChips();
    renderKpis(rows);
    renderHero(rows);
    renderTrend(rows);
    renderBarList("marketChart", "marketTable", "marketSub", groupTokens(rows, (e) => e.marketTag), 8, "Tokens");
    renderBarList("managerChart", "managerTable", "managerSub", groupTokens(rows, (e) => e.manager), 8, "Tokens");
    renderBarList("departmentChart", "departmentTable", "departmentSub", groupTokens(rows, (e) => e.department), 8, "Tokens");
    renderRisk(rows);
    renderTopUsers(rows);
    renderEmployees(rows);

    const markets = new Set(rows.map((e) => e.marketTag)).size;
    const teams = new Set(rows.map((e) => e.manager)).size;
    $("sideFootCount").textContent = fmt(rows.length) + " licensed";
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
