import {
  createElement,
  forwardRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Variants = Record<string, Record<string, unknown>>;

type MotionOnlyProps = Readonly<{
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  layout?: unknown;
  transition?: unknown;
  variants?: Variants;
  whileHover?: unknown;
  whileTap?: unknown;
}>;

function motionElement(tagName: string) {
  return forwardRef<HTMLElement, Record<string, unknown>>(function MotionLiteElement(props, ref) {
    const {
      animate: _animate,
      exit: _exit,
      initial: _initial,
      layout: _layout,
      transition: _transition,
      variants: _variants,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...domProps
    } = props as Record<string, unknown> & MotionOnlyProps;

    return createElement(tagName, { ...domProps, ref, "data-motion": "native" });
  });
}

export const motion = {
  article: motionElement("article"),
  aside: motionElement("aside"),
  button: motionElement("button"),
  div: motionElement("div"),
  section: motionElement("section"),
  span: motionElement("span"),
} as const;

export function AnimatePresence({ children }: Readonly<{ children?: ReactNode; initial?: boolean; mode?: string }>) {
  return <>{children}</>;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
