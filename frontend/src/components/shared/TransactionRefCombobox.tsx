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
import { transactionsService } from "@/lib/services/transactions.service";
import type { Transaction, TransactionType } from "@/types/transaction.types";

interface TransactionRefComboboxProps {
  type: TransactionType;
  value?: string;
  onSelect: (txn: Transaction) => void;
}

export default function TransactionRefCombobox({
  type,
  value,
  onSelect,
}: TransactionRefComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Transaction[]>([]);
  const [selectedRef, setSelectedRef] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    transactionsService
      .getTransactions({ type, page: 1, size: 50 })
      .then((res) => active && setRows(res.items))
      .catch(() => {
        if (!active) return;
        setRows([]);
        setLoadError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, type]);

  const filtered = search
    ? rows.filter((t) =>
        t.reference_number.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
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
          {value ? selectedRef || value : `Select ${type} transaction…`}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search reference no…"
            value={search}
            onValueChange={setSearch}
            aria-label="Search transaction reference"
          />
          <CommandList>
            {(loading || loadError || filtered.length === 0) && (
              <CommandEmpty>
                {loading ? (
                  <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading transactions…
                  </span>
                ) : loadError ? (
                  "Couldn’t load transactions. Close and reopen to retry."
                ) : (
                  "No transactions found."
                )}
              </CommandEmpty>
            )}
            {!loading && !loadError && filtered.length > 0 && <CommandGroup>
              {filtered.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.id}
                  onSelect={() => {
                    onSelect(t);
                    setSelectedRef(t.reference_number);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === t.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate font-mono text-xs">
                    {t.reference_number}
                  </span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">
                    {t.item?.name ?? ""}
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
