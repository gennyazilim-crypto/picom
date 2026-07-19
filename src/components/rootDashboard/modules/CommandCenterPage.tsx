import { useEffect, useMemo, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardMutationService } from "../../../services/rootDashboard/rootDashboardMutationService";
import type { RootDashboardCommandSearchItem } from "../../../types/rootDashboardOperations";
import { flattenNavItems, type RootDashboardRouteKey } from "../navigation/rootDashboardNav";
import { ModulePageHeader } from "./moduleScaffold";

type CommandCenterPageProps = Readonly<{
  access: AdminOperationsAccess;
  onNavigate: (route: RootDashboardRouteKey) => void;
}>;

const ROUTE_KEYS = new Set(flattenNavItems().map((item) => item.key));

function toRouteKey(value: string): RootDashboardRouteKey | null {
  return ROUTE_KEYS.has(value as RootDashboardRouteKey) ? value as RootDashboardRouteKey : null;
}

export function CommandCenterPage({ access, onNavigate }: CommandCenterPageProps) {
  const [query, setQuery] = useState("");
  const [remoteItems, setRemoteItems] = useState<RootDashboardCommandSearchItem[]>([]);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);

  const localItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const all = flattenNavItems();
    if (!normalized) return all;
    return all.filter((item) => item.label.toLowerCase().includes(normalized) || item.key.toLowerCase().includes(normalized));
  }, [query]);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setRemoteItems([]);
      setRemoteError(null);
      setRemoteLoading(false);
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    const handle = window.setTimeout(() => {
      void rootDashboardMutationService.getCommandSearch(access, normalized).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setRemoteError(result.message);
          setRemoteItems([]);
        } else {
          setRemoteError(null);
          setRemoteItems([...result.data.items]);
        }
        setRemoteLoading(false);
      });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [access, query]);

  return (
    <section className="rd-page">
      <ModulePageHeader
        title="Command Center"
        purpose="Jump to any Panel module. Remote search uses get_root_dashboard_command_search_v1 when deployed."
      />
      <label className="rd-mutation-field" style={{ maxWidth: 520 }}>
        <span>Find a module</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Users, voice, incidents…"
        />
      </label>
      {remoteLoading ? <p className="rd-mutation-form__ok">Searching remote command index…</p> : null}
      {remoteError ? <p className="rd-mutation-form__error">{remoteError}</p> : null}
      {remoteItems.length > 0 ? (
        <div className="rd-nav-group__items">
          {remoteItems.map((item) => {
            const route = toRouteKey(item.routeKey);
            return (
              <button
                key={item.id}
                type="button"
                className="rd-nav-item"
                disabled={!route}
                onClick={() => { if (route) onNavigate(route); }}
              >
                <span>{item.label}</span>
                {item.detail ? <em style={{ fontStyle: "normal", color: "var(--text-muted)", fontSize: 11 }}>{item.detail}</em> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rd-nav-group__items">
          {localItems.map((item) => (
            <button key={item.key} type="button" className="rd-nav-item" onClick={() => onNavigate(item.key)}>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
