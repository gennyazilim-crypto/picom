import { t } from "../i18n/messages";

export type FormStatusTone = "loading" | "error" | "success" | "info";

export type FormStatusState =
  | { kind: "idle" }
  | { kind: "loading"; message?: string }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string }
  | { kind: "info"; message: string };

type FormStatusProps =
  | { status: FormStatusState; tone?: never; message?: never }
  | { tone: FormStatusTone; message?: string | null; status?: never };

/**
 * Loading / error / success banner for account forms.
 * Supports either `status={{ kind }}` or `tone` + `message`.
 */
export function FormStatus(props: FormStatusProps) {
  if ("status" in props && props.status) {
    const { status } = props;
    if (status.kind === "idle") return null;
    if (status.kind === "loading") {
      return <div className="ac-status ac-status--loading" role="status">{status.message ?? t("form.working")}</div>;
    }
    if (status.kind === "error") {
      return <div className="ac-status ac-status--error" role="alert">{status.message}</div>;
    }
    if (status.kind === "info") {
      return <div className="ac-status ac-status--info" role="status">{status.message}</div>;
    }
    return <div className="ac-status ac-status--success" role="status">{status.message}</div>;
  }

  const { tone, message } = props;
  if (!message && tone !== "loading") return null;
  const text = message ?? t("form.working");
  if (tone === "loading") {
    return <div className="ac-status ac-status--loading" role="status">{text}</div>;
  }
  if (tone === "error") {
    return <div className="ac-status ac-status--error" role="alert">{text}</div>;
  }
  if (tone === "info") {
    return <div className="ac-status ac-status--info" role="status">{text}</div>;
  }
  return <div className="ac-status ac-status--success" role="status">{text}</div>;
}
