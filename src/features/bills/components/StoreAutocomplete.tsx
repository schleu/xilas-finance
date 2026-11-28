import { useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Store } from "@/features/stores/api/storesApi";

interface StoreAutocompleteProps {
  id: string;
  value: string;
  stores: Store[];
  placeholder?: string;
  onChange: (nextCompany: string, matchedStoreId: string) => void;
}

export function StoreAutocomplete({
  id,
  value,
  stores,
  placeholder = "Digite ou selecione uma empresa/loja",
  onChange,
}: StoreAutocompleteProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return stores.slice(0, 8);
    return stores.filter((s) => s.name.toLowerCase().includes(query)).slice(0, 8);
  }, [stores, value]);

  const handleInputChange = (nextText: string) => {
    const exactMatch = stores.find(
      (s) => s.name.trim().toLowerCase() === nextText.trim().toLowerCase(),
    );
    onChange(nextText, exactMatch?.id ?? "");
    setOpen(stores.length > 0);
    setActiveIndex(-1);
  };

  const selectStore = (store: Store) => {
    onChange(store.name, store.id);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      const target = filtered[activeIndex];
      if (target) {
        event.preventDefault();
        selectStore(target);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listboxId}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          if (stores.length > 0) setOpen(true);
        }}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {open && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {filtered.map((store, idx) => (
            <li
              key={store.id}
              role="option"
              aria-selected={idx === activeIndex}
              className={[
                "cursor-pointer rounded-sm px-2.5 py-1.5 text-sm",
                idx === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
              ].join(" ")}
              onMouseDown={(e) => {
                e.preventDefault();
                selectStore(store);
              }}
            >
              {store.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
