"use client";
import { useId, useMemo, useRef, useState } from "react";

export type ComboGroup = { group: string; items: string[] };

/**
 * A text box with a dropdown of suggestions. Pick from the list or type your own.
 * The list filters as you type. Works with mouse, touch and keyboard.
 */
export function Combo({ name, label, groups, defaultValue, required, placeholder }: {
  name: string; label: string; groups: ComboGroup[]; defaultValue?: string | null; required?: boolean; placeholder?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const q = filtering ? value.trim().toLowerCase() : "";
    return groups
      .map((g) => ({ group: g.group, items: g.items.filter((i) => !q || i.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
  }, [groups, value, filtering]);
  const flat = shown.flatMap((g) => g.items);

  function choose(v: string) {
    setValue(v);
    setOpen(false);
    setFiltering(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0 && flat.at(active)) {
      e.preventDefault();
      choose(flat.at(active)!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Position of each option in the whole list, for keyboard highlighting.
  const offsets = shown.map((_, gi) => shown.slice(0, gi).reduce((n, g) => n + g.items.length, 0));
  return (
    <div className="relative min-w-0">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          ref={inputRef} id={id} name={name} className="input pr-10" autoComplete="off" required={required}
          placeholder={placeholder} value={value} role="combobox" aria-expanded={open} aria-controls={listId}
          aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          onChange={(e) => { setValue(e.target.value); setFiltering(true); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        <button type="button" tabIndex={-1} aria-label={`Show ${label} options`}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setFiltering(false); setOpen((o) => !o); inputRef.current?.focus(); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      {open && flat.length > 0 && (
        <ul id={listId} role="listbox"
          className="absolute inset-x-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {shown.map((g, gi) => (
            <li key={g.group} role="presentation">
              {groups.length > 1 && <div className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">{g.group}</div>}
              <ul role="presentation">
                {g.items.map((item, ii) => {
                  const i = (offsets.at(gi) ?? 0) + ii;
                  return (
                    <li key={item} id={`${id}-opt-${i}`} role="option" aria-selected={item === value}
                      className={`cursor-pointer truncate rounded-lg px-2 py-2 text-sm ${i === active ? "bg-accent-soft text-accent" : item === value ? "font-semibold" : ""} hover:bg-accent-soft`}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)}>
                      {item}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
