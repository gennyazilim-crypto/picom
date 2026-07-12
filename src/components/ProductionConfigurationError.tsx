import type { ProductionRuntimeConfiguration } from "../services/productionRuntimeConfigService";
import { AppIcon } from "./AppIcon";

export function ProductionConfigurationError({ configuration }: Readonly<{ configuration: ProductionRuntimeConfiguration }>) {
  return (
    <main className="startup-error-screen" role="alert" aria-live="assertive">
      <section className="startup-error-card" aria-labelledby="production-configuration-error-title">
        <div className="startup-error-mark" aria-hidden="true"><AppIcon name="lock" size="lg" /></div>
        <p className="eyebrow">Production configuration</p>
        <h1 id="production-configuration-error-title">Picom needs a valid data connection</h1>
        <p>Startup stopped before account or community data was loaded. Picom will not replace unavailable production data with mock content.</p>
        <div className="startup-error-guidance">
          <strong>{configuration.dataSource === "supabase" ? "Supabase is selected but not ready." : "The selected data source is not allowed for this release."}</strong>
          <span>Configure the public renderer environment, then restart Picom. Never place service-role keys or database credentials in Vite variables.</span>
        </div>
        <ul className="startup-configuration-issues">
          {configuration.issues.map((issue) => <li key={issue.code}><strong>{issue.code}</strong><span>{issue.message}</span></li>)}
        </ul>
        <p className="startup-error-meta">Environment: {configuration.environment} / Channel: {configuration.releaseChannel} / Data source: {configuration.dataSource}</p>
        <div className="startup-error-actions">
          <button type="button" className="primary" onClick={() => window.location.reload()}>Retry startup</button>
        </div>
      </section>
    </main>
  );
}
