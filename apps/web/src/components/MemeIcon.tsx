/** Artwork for the testnet showcase pools; their on-chain icon is an emoji and cannot change. */
const LOGOS: Record<string, string> = { dogn: "logos/dogn.png", pepn: "logos/pepn.png" };

export function MemeIcon({
  icon,
  symbol,
  slug,
  size = 40,
}: {
  icon: string | null | undefined;
  symbol: string;
  slug?: string;
  size?: number;
}) {
  const style = { width: size, height: size };
  const logo = slug ? LOGOS[slug] : undefined;
  const src = logo ? `${import.meta.env.BASE_URL}${logo}` : icon;
  if (src && (logo || src.startsWith("data:") || src.startsWith("http"))) {
    return (
      <img
        src={src}
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
