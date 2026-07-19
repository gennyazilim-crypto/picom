import { useState, type FormEvent, type ReactNode } from "react";
import type { AdminOperationsResult } from "../../../types/adminOperations";
import type { RootDashboardMutationOk } from "../../../types/rootDashboardOperations";

type MutationRunner = () => Promise<AdminOperationsResult<RootDashboardMutationOk>>;

type ModuleMutationFormProps = Readonly<{
  title: string;
  children: ReactNode;
  submitLabel: string;
  onSubmit: MutationRunner;
  onSuccess?: () => void;
}>;

export function ModuleMutationForm({ title, children, submitLabel, onSubmit, onSuccess }: ModuleMutationFormProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await onSubmit();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.data.message ?? "Saved.");
    onSuccess?.();
  }

  return (
    <form className="rd-mutation-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="rd-mutation-form__head">
        <strong>{title}</strong>
        {error ? <span className="rd-mutation-form__error">{error}</span> : null}
        {!error && message ? <span className="rd-mutation-form__ok">{message}</span> : null}
      </div>
      <div className="rd-mutation-form__fields">{children}</div>
      <button type="submit" disabled={busy}>{busy ? "Working…" : submitLabel}</button>
    </form>
  );
}

export function FieldLabel({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="rd-mutation-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
