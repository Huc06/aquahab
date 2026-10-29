// Top bar: wordmark and operator status line (DESIGN.md §6.12).
// Values are mock until the API is connected.
export function TopBar() {
  return (
    <header className="flex h-14 items-center gap-6 border-b border-line-decor bg-surface px-4">
      <span className="text-lg font-semibold text-fg">Aquahab</span>
      <div className="flex min-w-0 items-center gap-4 overflow-hidden whitespace-nowrap font-mono text-[13px] text-fg-2">
        <span>
          Walrus Memory <span className="text-ok">● healthy</span>
        </span>
        <span>
          Agents <span className="text-agent">2 working</span> · 3 idle
        </span>
        <span>Quota 14 memories · 48 KB</span>
        <span>Testnet</span>
      </div>
      <span className="ml-auto text-sm text-fg-2">HQ overview</span>
    </header>
  );
}
