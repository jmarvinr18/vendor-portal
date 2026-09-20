// Vanilla JS only — no third-party libraries.
(function () {
  const managerSelect = document.getElementById("managerFilter");
  const marketSelect = document.getElementById("marketFilter");
  const yearSelect = document.getElementById("yearFilter");
  const monthSelect = document.getElementById("monthFilter");
  const resetBtn = document.getElementById("resetFilters");
  const employeeSort = document.getElementById("employeeSort");
  const tbody = document.querySelector("#employeeTable tbody");
  const rowCountEl = document.getElementById("rowCount");
  const filterCountEl = document.getElementById("filterCount");
  const snapshotBadge = document.getElementById("snapshotBadge");

  const kpiLicensed = document.getElementById("kpiLicensed");
  const kpiTokens = document.getElementById("kpiTokens");
  const heroRing = document.getElementById("heroRing");
  const heroRatePct = document.getElementById("heroRatePct");
  const heroActiveCount = document.getElementById("heroActiveCount");
  const heroLicensedCount = document.getElementById("heroLicensedCount");

  const marketRateChart = document.getElementById("marketRateChart");
  const riskChart = document.getElementById("riskChart");
  const managerChart = document.getElementById("managerChart");
  const departmentRateChart = document.getElementById("departmentRateChart");
  const titleRateChart = document.getElementById("titleRateChart");

  let sortKey = "tokens";
  let sortAsc = false;

  if (typeof META !== "undefined" && META.generatedAt && snapshotBadge) {
    snapshotBadge.textContent = `Data as of ${META.generatedAt}`;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }

  function populateSelect(select, values) {
    for (const v of uniqueSorted(values)) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    }
  }

  function getDateParts(date) {
    if (!date) return null;
    const [year, month] = date.split("-");
    return { year, month };
  }

  function getSelectedMonth() {
    return monthSelect.value;
  }

  function getTokens(employee) {
    const month = getSelectedMonth();
    if (month && employee.monthlyTokens) {
      return Number(employee.monthlyTokens[month] || 0);
    }
    return Number(employee.tokens || 0);
  }

  function isActive(employee) {
    return getSelectedMonth() ? getTokens(employee) > 0 : Boolean(employee.active);
  }

  function getFiltered() {
    const manager = managerSelect.value;
    const market = marketSelect.value;
    const year = yearSelect.value;
    return EMPLOYEES.filter((e) => {
      if (manager && e.manager !== manager) return false;
      if (market && e.marketTag !== market) return false;
      if (year && e.year !== year) return false;
      return true;
    });
  }

  function formatNumber(n) {
    return Math.round(n).toLocaleString();
  }

  function groupSum(items, keyFn, valueFn) {
    const map = new Map();
    for (const item of items) {
      const key = keyFn(item) || "Unknown";
      map.set(key, (map.get(key) || 0) + valueFn(item));
    }
    return Array.from(map, ([label, value]) => ({ label, value }));
  }

  function groupAdoptionRate(items, keyFn, minCount) {
    const map = new Map();
    for (const item of items) {
      const key = keyFn(item) || "Unknown";
      if (!map.has(key)) map.set(key, { total: 0, active: 0 });
      const g = map.get(key);
      g.total += 1;
      if (isActive(item)) g.active += 1;
    }
    return Array.from(map, ([label, g]) => ({
      label,
      total: g.total,
      active: g.active,
      rate: g.total ? (g.active / g.total) * 100 : 0,
    })).filter((g) => g.total >= minCount);
  }

  function renderBarChart(container, rows, { limit = 10, volume = false } = {}) {
    const top = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
    const max = Math.max(1, ...top.map((r) => r.value));
    container.innerHTML = top.map((r) => `
      <div class="bar-row">
        <span class="bar-label" title="${r.label}">${r.label}</span>
        <span class="bar-track"><span class="bar-fill ${volume ? "bar-volume" : ""}" style="width:${(r.value / max) * 100}%"></span></span>
        <span class="bar-value">${formatNumber(r.value)}</span>
      </div>
    `).join("") || `<p class="row-count">No data</p>`;
  }

  function renderRateChart(container, rows, { limit = 10, ascending = false, avgRate = 0 } = {}) {
    const sorted = [...rows]
      .sort((a, b) => (ascending ? a.rate - b.rate : b.rate - a.rate))
      .slice(0, limit);
    container.innerHTML = sorted.map((r) => {
      const isRisk = r.rate < avgRate;
      return `
        <div class="bar-row">
          <span class="bar-label" title="${r.label}">${r.label}</span>
          <span class="bar-track">
            <span class="bar-fill ${isRisk ? "bar-risk" : ""}" style="width:${r.rate}%"></span>
            <span class="avg-marker" style="left:${avgRate}%" title="Overall average: ${Math.round(avgRate)}%"></span>
          </span>
          <span class="bar-value">${Math.round(r.rate)}% <span class="bar-subvalue">(${r.active}/${r.total})</span></span>
        </div>
      `;
    }).join("") || `<p class="row-count">No data</p>`;
  }

  function renderCharts(filtered) {
    const activeCount = filtered.filter(isActive).length;
    const avgRate = filtered.length ? (activeCount / filtered.length) * 100 : 0;

    renderRateChart(marketRateChart, groupAdoptionRate(filtered, (e) => e.marketTag, 1), {
      limit: 8,
      ascending: false,
      avgRate,
    });
    renderRateChart(riskChart, groupAdoptionRate(filtered, (e) => e.manager, 3), {
      limit: 8,
      ascending: true,
      avgRate,
    });
    renderBarChart(managerChart, groupSum(filtered, (e) => e.manager, getTokens), { limit: 10, volume: true });
    renderRateChart(
      departmentRateChart,
      groupAdoptionRate(filtered, (e) => e.department, 1),
      { limit: 10, ascending: false, avgRate }
    );
    renderRateChart(
      titleRateChart,
      groupAdoptionRate(filtered, (e) => e.title, 1),
      { limit: 10, ascending: false, avgRate }
    );
  }

  function render() {
    const filtered = getFiltered();
    const activeCount = filtered.filter(isActive).length;
    const activeRate = filtered.length ? (activeCount / filtered.length) * 100 : 0;

    kpiLicensed.textContent = formatNumber(filtered.length);
    kpiTokens.textContent = formatNumber(
      filtered.reduce((sum, e) => sum + getTokens(e), 0)
    );
    heroRatePct.textContent = `${Math.round(activeRate)}%`;
    heroRing.style.background = `conic-gradient(var(--active) 0% ${activeRate}%, #E7EAF0 ${activeRate}% 100%)`;
    heroActiveCount.textContent = formatNumber(activeCount);
    heroLicensedCount.textContent = formatNumber(filtered.length);

    filterCountEl.textContent = `${filtered.length} employee${filtered.length === 1 ? "" : "s"} match current filters`;

    renderCharts(filtered);

    const sorted = [...filtered].sort((a, b) => {
      const av = sortKey === "tokens" ? getTokens(a) : a[sortKey];
      const bv = sortKey === "tokens" ? getTokens(b) : b[sortKey];
      let cmp;
      if (typeof av === "number" || typeof av === "boolean") {
        cmp = (av === bv) ? 0 : (av > bv ? 1 : -1);
      } else {
        cmp = String(av || "").localeCompare(String(bv || ""));
      }
      return sortAsc ? cmp : -cmp;
    });

    tbody.innerHTML = "";
    if (sorted.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="empty-state" colspan="5">No employees match the selected filters.</td>`;
      tbody.appendChild(tr);
    } else {
      for (const e of sorted) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${e.name || ""}</td>
          <td>${e.manager || ""}</td>
          <td>${e.marketTag || ""}</td>
          <td class="${isActive(e) ? "status-active" : "status-inactive"}">${isActive(e) ? "Active" : "Inactive"}</td>
          <td>${formatNumber(getTokens(e))}</td>
        `;
        tbody.appendChild(tr);
      }
    }
    rowCountEl.textContent = `${filtered.length} of ${EMPLOYEES.length} employees`;
  }

  populateSelect(managerSelect, EMPLOYEES.map((e) => e.manager));
  populateSelect(marketSelect, EMPLOYEES.map((e) => e.marketTag));
  populateSelect(yearSelect, EMPLOYEES.map((e) => e.year).filter(Boolean));
  const months = (typeof META !== "undefined" && META.months) || [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  managerSelect.addEventListener("change", render);
  marketSelect.addEventListener("change", render);
  yearSelect.addEventListener("change", render);
  monthSelect.addEventListener("change", render);
  employeeSort.addEventListener("change", () => {
    const [key, direction] = employeeSort.value.split("-");
    sortKey = key;
    sortAsc = direction === "asc";
    render();
  });
  resetBtn.addEventListener("click", () => {
    managerSelect.value = "";
    marketSelect.value = "";
    yearSelect.value = "";
    monthSelect.value = "";
    employeeSort.value = "tokens-desc";
    sortKey = "tokens";
    sortAsc = false;
    render();
  });

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = key;
        sortAsc = true;
      }
      if (sortKey === "tokens") {
        employeeSort.value = sortAsc ? "tokens-asc" : "tokens-desc";
      } else if (sortKey === "name") {
        employeeSort.value = sortAsc ? "name-asc" : "name-desc";
      }
      render();
    });
  });

  render();
})();
