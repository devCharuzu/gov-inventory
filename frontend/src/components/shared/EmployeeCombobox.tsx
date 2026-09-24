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
import { signatoriesService } from "@/lib/services/signatories.service";
import { cn } from "@/lib/utils";
import type { Signatory } from "@/types/signatory.types";

interface EmployeeComboboxProps {
  value?: string;
  selectedLabel?: string;
  disabled?: boolean;
  onSelect: (employee: Signatory) => void;
}

/** Searchable employee picker used when releasing stock to a staff member. */
export default function EmployeeCombobox({
  value,
  selectedLabel,
  disabled,
  onSelect,
}: EmployeeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    signatoriesService
      .list()
      .then((rows) => active && setEmployees(rows))
      .catch(() => {
        if (!active) return;
        setEmployees([]);
        setLoadError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open]);

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
          {value ? selectedLabel : "Search and select employee…"}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search employee name or unit…"
            value={search}
            onValueChange={setSearch}
            aria-label="Search employee name or unit"
          />
          <CommandList>
            {(loading || loadError || employees.length === 0) && (
              <CommandEmpty>
                {loading ? (
                  <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading employees…
                  </span>
                ) : loadError ? (
                  "Couldn’t load employees. Close and reopen to retry."
                ) : (
                  "No employee found."
                )}
              </CommandEmpty>
            )}
            {!loading && !loadError && employees.length > 0 && <CommandGroup>
              {employees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={`${employee.full_name} ${employee.designation} ${employee.unit ?? ""}`}
                  onSelect={() => {
                    onSelect(employee);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === employee.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="block truncate">{employee.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {employee.designation}
                      {employee.unit ? ` · ${employee.unit}` : ""}
                    </span>
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
