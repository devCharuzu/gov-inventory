import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Text shown in place of the native mm/dd/yyyy mask while empty. */
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
}

/**
 * Date picker that masks the browser's native `mm/dd/yyyy` text with a
 * friendly placeholder (e.g. "Start date") until a value is chosen — the
 * pattern used on the Analytics page, shared here for consistency.
 */
export default function DateInput({
  value,
  onChange,
  placeholder = "Select date",
  className,
  disabled,
  ...rest
}: DateInputProps) {
  return (
    <div className={cn("relative", className ?? "w-40")}>
      {!value && (
        <span className="pointer-events-none absolute inset-y-px left-px right-8 flex items-center rounded-l-lg bg-background pl-2.5 text-sm text-muted-foreground">
          {placeholder}
        </span>
      )}
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={className ?? "w-40"}
        aria-label={rest["aria-label"] ?? placeholder}
      />
    </div>
  );
}
