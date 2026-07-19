import type { ReactNode } from "react";
import { DashboardState } from "./DashboardState";

export type DataTableSortDirection = "asc" | "desc";

export type DataTableColumn<T> = Readonly<{
  id: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => ReactNode;
}>;

export type DataTableBulkAction = Readonly<{
  id: string;
  label: string;
  onAction: (ids: string[]) => void;
}>;

export type DataTableProps<T extends { id: string }> = Readonly<{
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  noPermission?: boolean;
  sortId?: string | null;
  sortDir?: DataTableSortDirection;
  onSort?: (columnId: string) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  selectedIds?: readonly string[];
  onSelect?: (ids: string[]) => void;
  density?: "compact" | "comfortable";
  bulkActions?: ReactNode;
}>;

export function StatusPill({ value }: Readonly<{ value: string | null | undefined }>) {
  const raw = (value ?? "—").trim() || "—";
  const tone = /urgent|critical|error|failed|open|pending|abuse/i.test(raw)
    ? "warn"
    : /resolved|closed|active|online|ok|healthy|live/i.test(raw)
      ? "ok"
      : /draft|idle|paused|unknown/i.test(raw)
        ? "muted"
        : "neutral";
  return <span className={`rd-status-pill is-${tone}`}>{raw.replace(/_/g, " ")}</span>;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  error,
  emptyMessage,
  noPermission,
  sortId,
  sortDir,
  onSort,
  page = 1,
  pageSize = 25,
  total,
  onPageChange,
  selectedIds = [],
  onSelect,
  density = "compact",
  bulkActions,
}: DataTableProps<T>) {
  if (noPermission) return <DashboardState tone="noPermission" />;
  if (loading) return <DashboardState tone="loading" />;
  if (error) return <DashboardState tone="error" detail={error} />;
  if (!rows.length) return <DashboardState tone="empty" detail={emptyMessage} />;

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const cell = (column: DataTableColumn<T>, row: T) => (column.render ? column.render(row) : column.accessor ? column.accessor(row) : null);

  return (
    <div className="rd-table-wrap">
      {bulkActions && selectedIds.length ? (
        <div className="rd-table-bulk" role="status">
          <span>{selectedIds.length} selected</span>
          <div className="rd-table-bulk__actions">{bulkActions}</div>
        </div>
      ) : null}
      <table className={`rd-table${density === "compact" ? " is-compact" : ""}`}>
        <thead>
          <tr>
            {onSelect ? (
              <th scope="col" className="rd-table__check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all rows"
                  onChange={(event) => onSelect(event.target.checked ? rows.map((row) => row.id) : [])}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.id} scope="col">
                {column.sortable && onSort ? (
                  <button type="button" className="rd-table__sort" onClick={() => onSort(column.id)}>
                    {column.header}
                    {sortId === column.id ? <span aria-hidden="true">{sortDir === "asc" ? " ↑" : " ↓"}</span> : null}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedIds.includes(row.id);
            return (
              <tr key={row.id} className={selected ? "is-selected" : undefined}>
                {onSelect ? (
                  <td className="rd-table__check">
                    <input
                      type="checkbox"
                      checked={selected}
                      aria-label={`Select row ${row.id}`}
                      onChange={(event) => {
                        onSelect(event.target.checked ? [...selectedIds, row.id] : selectedIds.filter((id) => id !== row.id));
                      }}
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.id}>{cell(column, row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {onPageChange && typeof total === "number" ? (
        <div className="rd-table-foot">
          <span>
            Page {page} · {pageSize}/page · {total} total
          </span>
          <div className="rd-table-foot__actions">
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Previous
            </button>
            <button type="button" disabled={page * pageSize >= total} onClick={() => onPageChange(page + 1)}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
