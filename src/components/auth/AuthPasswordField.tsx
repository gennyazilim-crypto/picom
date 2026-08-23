import { useState } from "react";
import { useTranslation } from "../../i18n";
import { AppIcon } from "../AppIcon";

type AuthPasswordFieldProps = Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}>;

export function AuthPasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required = false,
  disabled = false,
  id,
}: AuthPasswordFieldProps) {
  const { t } = useTranslation("auth");
  const [revealed, setRevealed] = useState(false);

  return (
    <label className="auth-field auth-field--password" htmlFor={id}>
      <span>{label}</span>
      <span className="auth-password-shell">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
        />
        <button
          type="button"
          className={`auth-password-toggle${revealed ? " is-revealed" : ""}`}
          aria-label={revealed ? t("password.hide") : t("password.show")}
          aria-pressed={revealed}
          disabled={disabled}
          onClick={() => setRevealed((current) => !current)}
        >
          <AppIcon name="eye" size="sm" />
          {revealed ? <span className="auth-password-toggle-slash" aria-hidden="true" /> : null}
        </button>
      </span>
    </label>
  );
}
