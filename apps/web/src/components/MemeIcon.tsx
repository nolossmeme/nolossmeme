export function MemeIcon({
  icon,
  symbol,
  size = 40,
}: {
  icon: string | null | undefined;
  symbol: string;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (icon && (icon.startsWith("data:") || icon.startsWith("http"))) {
    return (
      <img
        src={icon}
        alt=""
        style={style}
        className="rounded-full object-cover bg-surface-2 shrink-0"
      />
    );
  }
  return (
    <div
      style={style}
      className="rounded-full bg-gradient-to-br from-lime/70 to-pink/70 text-bg font-bold grid place-items-center shrink-0"
      aria-hidden
    >
      {icon && icon.length <= 2 ? icon : symbol.slice(0, 2)}
    </div>
  );
}
