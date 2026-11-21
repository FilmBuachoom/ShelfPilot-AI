export function FilterTabs<Filter extends string>({ tabs, value, onChange }: {
  tabs: readonly { id: Filter; label: string; count: number }[];
  value: Filter;
  onChange: (filter: Filter) => void;
}) {
  return (
    <div className="sp-tabs" role="group" aria-label="กรองคลัง">
      {tabs.map(({ id, label, count }) => (
        <button key={id} type="button" className="sp-tab"
          aria-pressed={value === id} onClick={() => onChange(id)}>
          {label}<span className="sp-tab__count">{count}</span>
        </button>
      ))}
    </div>
  );
}
