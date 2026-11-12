import { formatUsd } from "@nolossmeme/sdk";
import { useNearUsd } from "@nolossmeme/ui";

interface Props {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  max?: string;
  placeholder?: string;
  id?: string;
}

export function AmountInput({ value, onChange, unit, max, placeholder = "0.0", id }: Props) {
  const price = useNearUsd();
  const near = Number(value);
  const usd = unit === "NEAR" && price !== undefined && near > 0 ? formatUsd(near * price) : null;
  return (
    <div className="relative">
      <input
        id={id}
        className={`input ${usd ? "pr-44" : "pr-24"}`}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        aria-label={`Amount in ${unit}`}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-2 text-xs">
        {max !== undefined && (
          <button type="button" className="text-lime hover:underline" onClick={() => onChange(max)}>
            MAX
          </button>
        )}
        {usd && <span className="text-muted">≈ {usd}</span>}
        <span className="text-muted">{unit}</span>
      </div>
    </div>
  );
}
