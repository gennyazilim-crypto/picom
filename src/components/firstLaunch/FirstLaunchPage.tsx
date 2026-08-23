import type { ReactNode, Ref } from "react";

type FirstLaunchPageProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  headingRef?: Ref<HTMLHeadingElement>;
  helper?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
};

/** Shared page anatomy for every device-first-run step. */
export function FirstLaunchPage({ id, eyebrow, title, description, headingRef, helper, children, aside }: FirstLaunchPageProps) {
  const headingId = `${id}-heading`;
  return (
    <section className="first-launch-page" aria-labelledby={headingId}>
      <header className="first-launch-page-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={headingId} ref={headingRef} tabIndex={-1}>{title}</h1>
        <p>{description}</p>
        {helper ? <div className="first-launch-page-helper">{helper}</div> : null}
      </header>
      <div className={aside ? "first-launch-page-grid" : "first-launch-page-body"}>
        <div className="first-launch-page-body">{children}</div>
        {aside ? <aside className="first-launch-page-aside">{aside}</aside> : null}
      </div>
    </section>
  );
}
