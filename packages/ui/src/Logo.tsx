import mark from "./nlm-mark.png";

/** The NLM mark (white, transparent background) for the dark UI. */
export function Logo({ size = 22 }: { size?: number }) {
  return <img src={mark} width={size} height={size} alt="" aria-hidden className="shrink-0" />;
}
