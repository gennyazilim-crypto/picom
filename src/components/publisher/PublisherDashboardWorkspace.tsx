import { useEffect, useState } from "react";
import { publisherProgramService } from "../../services/publisher/publisherProgramService";
import type { PublisherProgramState } from "../../services/publisher/publisherProgramTypes";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import "./publisherProgram.css";

type Props = Readonly<{
  onClose: () => void;
  onGoLive: () => void;
  onOpenApplication: () => void;
}>;

type ScheduleRow = {
  id: string;
  title: string;
  status: string;
  scheduled_start_at: string;
  stream_type: string;
};

export function PublisherDashboardWorkspace({ onClose, onGoLive, onOpenApplication }: Props) {
  const [state, setState] = useState<PublisherProgramState | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [section, setSection] = useState<"overview" | "streams" | "create" | "schedule" | "settings">("overview");

  async function refresh() {
    const program = await publisherProgramService.getProgramState();
    if (!program.ok) {
      setError(program.error);
      setState(null);
      return;
    }
    setState(program.data);
    setError(null);
    const client = getSupabaseClient() as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: ScheduleRow[] | null }>;
          };
        };
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
      auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
    } | null;
    if (!client || !program.data.canBroadcast) {
      setSchedules([]);
      return;
    }
    const { data } = await client
      .from("publisher_stream_schedules")
      .select("id,title,status,scheduled_start_at,stream_type")
      .order("scheduled_start_at", { ascending: true })
      .limit(40);
    setSchedules(data ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createSchedule() {
    if (!state?.canBroadcast) return;
    const client = getSupabaseClient() as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
      auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
    } | null;
    if (!client) return;
    const { data: session } = await client.auth.getSession();
    const userId = session.session?.user?.id;
    if (!userId || !title.trim() || !startAt) return;
    const { error: insertError } = await client.from("publisher_stream_schedules").insert({
      owner_user_id: userId,
      title: title.trim(),
      scheduled_start_at: new Date(startAt).toISOString(),
      status: "scheduled",
      visibility: "public",
      stream_type: "screen_share",
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setStartAt("");
    await refresh();
  }

  if (state && !state.canBroadcast) {
    return (
      <section className="publisher-program-shell">
        <header className="publisher-program-header">
          <div>
            <h1>Publisher Dashboard</h1>
            <p>Bu alana yalnızca onaylı Creator/Publisher hesapları erişebilir.</p>
          </div>
          <button type="button" className="publisher-ghost" onClick={onClose}>Kapat</button>
        </header>
        <div className="publisher-card">
          <p>Hesabınız henüz yayın yetkisine sahip değil.</p>
          <button type="button" className="publisher-primary" onClick={onOpenApplication}>Başvuru durumunu gör</button>
        </div>
      </section>
    );
  }

  return (
    <section className="publisher-program-shell" aria-label="Publisher Dashboard">
      <header className="publisher-program-header">
        <div>
          <p className="publisher-eyebrow">Publisher Dashboard</p>
          <h1>{state?.profile?.displayPublisherName || "Yayıncı paneli"}</h1>
          <p>
            {state?.activeBadge
              ? `Aktif rozet: ${state.activeBadge.badgeType}`
              : "Rozet durumu yükleniyor…"}
          </p>
        </div>
        <div className="publisher-header-actions">
          <button type="button" className="publisher-primary" onClick={onGoLive}>Go Live</button>
          <button type="button" className="publisher-ghost" onClick={onClose}>Kapat</button>
        </div>
      </header>

      <nav className="publisher-tabs" aria-label="Publisher sections">
        {(["overview", "streams", "create", "schedule", "settings"] as const).map((key) => (
          <button key={key} type="button" className={section === key ? "is-active" : ""} onClick={() => setSection(key)}>
            {key}
          </button>
        ))}
      </nav>

      {error ? <p className="publisher-error" role="alert">{error}</p> : null}

      {section === "overview" ? (
        <div className="publisher-card">
          <h2>Genel bakış</h2>
          <p>Canlı yayın başlatmak için Go Live kullanın. Live Now yalnızca public_discovery + onaylı rozetli yayınları listeler.</p>
          <p>Gelir / abonelik / reklam: henüz yapılandırılmadı (billing provider yok).</p>
        </div>
      ) : null}

      {section === "streams" || section === "schedule" ? (
        <div className="publisher-card">
          <h2>Yayın takvimi</h2>
          <ul className="publisher-list">
            {schedules.map((row) => (
              <li key={row.id}>
                <strong>{row.title}</strong> · {row.status} · {new Date(row.scheduled_start_at).toLocaleString()} · {row.stream_type}
              </li>
            ))}
            {schedules.length === 0 ? <li>Planlanmış yayın yok.</li> : null}
          </ul>
        </div>
      ) : null}

      {section === "create" ? (
        <form
          className="publisher-card publisher-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createSchedule();
          }}
        >
          <h2>Yayın planla</h2>
          <label>
            Başlık
            <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={160} />
          </label>
          <label>
            Başlangıç
            <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
          </label>
          <button type="submit" className="publisher-primary">Takvime ekle</button>
        </form>
      ) : null}

      {section === "settings" ? (
        <div className="publisher-card">
          <h2>Hesap doğrulama</h2>
          <p>Hesap türü: {state?.profile?.accountKind ?? "—"}</p>
          <p>Profil durumu: {state?.profile?.status ?? "—"}</p>
          <button type="button" className="publisher-ghost" onClick={onOpenApplication}>Başvuru geçmişi</button>
        </div>
      ) : null}
    </section>
  );
}
