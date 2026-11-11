import { useRef } from "react";

export type TabId = "build" | "preview" | "json";
const TABS: { id: TabId; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "preview", label: "Preview" },
  { id: "json", label: "JSON" },
];

// ARIA tabs: arrow keys move between tabs, only the active tab is in the tab order.
export function Tabs({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const target = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : delta ? (index + delta + TABS.length) % TABS.length : -1;
    if (target === -1) return;
    event.preventDefault();
    const tab = TABS[target]!;
    onChange(tab.id);
    refs.current[tab.id]?.focus();
  }

  return (
    <div role="tablist" aria-label="Builder views" className="tabs">
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => { refs.current[tab.id] = el; }}
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          className="tab"
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => onKeyDown(e, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
