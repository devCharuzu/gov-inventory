import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { itemsService } from "@/lib/services/items.service";
import type { Item } from "@/types/item.types";

interface ItemComboboxProps {
  value?: string;
  selectedLabel?: string;
  disabled?: boolean;
  /** Bubbles the full item so the parent can show current stock. */
  onSelect: (item: Item) => void;
}

export default function ItemCombobox({
  value,
  selectedLabel,
  disabled,
  onSelect,
}: ItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Fetch active items matching the search term (debounced).
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    const t = setTimeout(() => {
      itemsService
        .getItems({
          search: search || undefined,
          is_active: true,
          page: 1,
          size: 20,
        })
        .then((res) => active && setItems(res.items))
        .catch(() => {
          if (!active) return;
          setItems([]);
          setLoadError(true);
        })
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className={cn(!value && "text-muted-foreground", "truncate")}>
          {value ? selectedLabel : "Select an item…"}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search items…"
            value={search}
            onValueChange={setSearch}
            aria-label="Search items"
          />
          <CommandList>
            {(loading || loadError || items.length === 0) && (
              <CommandEmpty>
                {loading ? (
                  <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Searching items…
                  </span>
                ) : loadError ? (
                  "Couldn’t load items. Try searching again."
                ) : (
                  "No items found."
                )}
              </CommandEmpty>
            )}
            {!loading && !loadError && items.length > 0 && <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.code}
                    </span>{" "}
                    {item.name}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.quantity} {item.unit ?? ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
