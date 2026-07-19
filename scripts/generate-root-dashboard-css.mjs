import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const w = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

w("src/components/rootDashboard/rootDashboard.css", `/* Astral-inspired dense ops layout using Picom tokens */
.root-dashboard {
  --rd-sidebar-width: 248px;
  --rd-sidebar-compact: 72px;
  --rd-header-height: 52px;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--rd-sidebar-width) minmax(0, 1fr);
  background: var(--bg-chat);
  color: var(--text-primary);
  overflow: hidden;
}
.root-dashboard.is-compact {
  grid-template-columns: var(--rd-sidebar-compact) minmax(0, 1fr);
}
.rd-sidebar {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-sidebar) 92%, var(--surface));
  backdrop-filter: blur(10px);
  min-width: 0;
}
.rd-sidebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--rd-header-height);
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
}
.rd-sidebar__brand strong {
  font-size: 13px;
  letter-spacing: -0.02em;
}
.rd-sidebar__brand span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.rd-sidebar__nav {
  min-height: 0;
  overflow: auto;
  padding: 10px 8px 16px;
  display: grid;
  gap: 10px;
  align-content: start;
}
.rd-nav-group__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 8px;
}
.rd-nav-group__label:hover,
.rd-nav-group__label:focus-visible {
  background: var(--surface-hover);
  outline: none;
}
.rd-nav-group__items {
  display: grid;
  gap: 2px;
  margin-top: 2px;
}
.rd-nav-item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}
.rd-nav-item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.rd-nav-item.is-active {
  background: var(--accent-soft);
  color: var(--accent);
}
.rd-nav-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.root-dashboard.is-compact .rd-nav-item {
  grid-template-columns: 1fr;
  justify-items: center;
  padding: 0;
  width: 44px;
  margin: 0 auto;
}
.root-dashboard.is-compact .rd-nav-item span,
.root-dashboard.is-compact .rd-nav-group__label,
.root-dashboard.is-compact .rd-sidebar__brand strong,
.root-dashboard.is-compact .rd-sidebar__brand span:last-child {
  display: none;
}
.rd-main {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
}
.rd-header {
  height: var(--rd-header-height);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  backdrop-filter: blur(12px);
}
.rd-header__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.rd-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
  min-width: 0;
}
.rd-breadcrumb strong {
  color: var(--text-primary);
  font-size: 13px;
}
.rd-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rd-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}
.rd-chip.is-live i,
.rd-chip.is-online i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
}
.rd-chip.is-offline i,
.rd-chip.is-reconnect i {
  background: var(--warning);
}
.rd-command-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  min-width: 180px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}
.rd-command-btn:hover,
.rd-command-btn:focus-visible {
  border-color: var(--border-strong);
  color: var(--text-primary);
  outline: none;
  box-shadow: var(--focus-ring);
}
.rd-command-btn kbd {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.7;
}
.rd-content {
  min-height: 0;
  overflow: auto;
  padding: 14px 16px 24px;
  display: grid;
  gap: 12px;
  align-content: start;
}
.rd-page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.rd-page-head h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.03em;
}
.rd-page-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}
.rd-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.rd-kpi {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  min-height: 88px;
}
.rd-kpi.is-warning {
  border-color: color-mix(in srgb, var(--warning) 45%, var(--border));
  background: color-mix(in srgb, var(--warning) 8%, var(--surface));
}
.rd-kpi.is-realtime {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}
.rd-kpi.is-stale {
  opacity: 0.78;
}
.rd-kpi span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rd-kpi strong {
  font-size: 22px;
  letter-spacing: -0.04em;
  line-height: 1.1;
}
.rd-kpi em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-secondary);
}
.rd-kpi .rd-kpi__trend.up { color: var(--success); }
.rd-kpi .rd-kpi__trend.down { color: var(--danger); }
.rd-kpi.is-skeleton strong,
.rd-kpi.is-skeleton em {
  color: transparent;
  background: linear-gradient(90deg, var(--surface-soft), var(--surface-hover), var(--surface-soft));
  border-radius: 6px;
}
.rd-chart {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  padding: 12px;
  display: grid;
  gap: 10px;
  min-height: 180px;
}
.rd-chart header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.rd-chart header strong { font-size: 13px; }
.rd-chart header span { color: var(--text-muted); font-size: 11px; }
.rd-chart svg { width: 100%; height: 140px; display: block; }
.rd-chart__empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  font-size: 12px;
  border: 1px dashed var(--border);
  border-radius: 10px;
}
.rd-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: end;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.rd-filter-bar label {
  display: grid;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.rd-filter-bar input,
.rd-filter-bar select {
  height: 30px;
  min-width: 120px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--text-primary);
  padding: 0 8px;
  font-size: 12px;
}
.rd-filter-bar button {
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--text-secondary);
  padding: 0 10px;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
}
.rd-table-wrap {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  overflow: auto;
}
.rd-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.rd-table th,
.rd-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}
.rd-table thead th {
  position: sticky;
  top: 0;
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  z-index: 1;
}
.rd-table.is-compact th,
.rd-table.is-compact td { padding: 6px 10px; }
.rd-table tr.is-selected { background: var(--accent-soft); }
.rd-state {
  display: grid;
  gap: 8px;
  place-items: center;
  text-align: center;
  min-height: 160px;
  padding: 24px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  background: var(--surface-soft);
}
.rd-state strong { font-size: 14px; }
.rd-state p { margin: 0; color: var(--text-muted); font-size: 12px; max-width: 420px; }
.rd-state button {
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  padding: 0 12px;
  cursor: pointer;
  font-weight: 750;
  font-size: 12px;
}
.rd-split {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 10px;
}
.rd-panel-entry {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  margin: 8px 0 0;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--warning) 8%, var(--surface));
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
  text-align: left;
}
.rd-panel-entry.is-active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.rd-panel-entry.is-loading {
  opacity: 0.65;
  cursor: wait;
}
.rd-panel-entry:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.global-app-sidebar.is-compact .rd-panel-entry {
  grid-template-columns: 1fr;
  justify-items: center;
  width: 44px;
  min-height: 44px;
  margin: 8px auto 0;
  padding: 0;
}
.global-app-sidebar.is-compact .rd-panel-entry .global-nav-item__label {
  display: none;
}
.global-app-sidebar.is-compact .rd-panel-entry .global-nav-item__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--text-on-accent);
}
@media (max-width: 1100px) {
  .root-dashboard { grid-template-columns: var(--rd-sidebar-compact) minmax(0, 1fr); }
  .root-dashboard .rd-nav-item { grid-template-columns: 1fr; justify-items: center; width: 44px; margin: 0 auto; padding: 0; }
  .root-dashboard .rd-nav-item span,
  .root-dashboard .rd-nav-group__label,
  .root-dashboard .rd-sidebar__brand strong { display: none; }
  .rd-split { grid-template-columns: 1fr; }
  .rd-command-btn { min-width: 0; }
}
`);

console.log("css ok");
