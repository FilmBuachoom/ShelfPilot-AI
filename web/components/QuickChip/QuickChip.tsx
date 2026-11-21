export function QuickChip({ label, zeroToken = true, onClick }: {
  label: string;
  zeroToken?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="sp-chip" onClick={onClick} disabled={!onClick}>
      {zeroToken && <span className="sp-chip__bolt" aria-hidden="true">⚡</span>}
      {label}
    </button>
  );
}
