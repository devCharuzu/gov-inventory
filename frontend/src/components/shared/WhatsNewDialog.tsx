import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  PackageCheck,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductUpdate } from "@/lib/whats-new";

interface WhatsNewDialogProps {
  update: ProductUpdate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: (dontShowAgain: boolean) => void;
  onReadMore: (dontShowAgain: boolean) => void;
  showReadMore?: boolean;
}

export default function WhatsNewDialog({
  update,
  open,
  onOpenChange,
  onDismiss,
  onReadMore,
  showReadMore = true,
}: WhatsNewDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (open) setDontShowAgain(false);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) onDismiss(dontShowAgain);
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,760px)] max-w-lg overflow-y-auto p-0"
        showCloseButton={false}
      >
        <div className="relative overflow-hidden rounded-t-xl bg-primary px-6 pb-6 pt-6 text-primary-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border-[24px] border-white/10"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            aria-label="Close update announcement"
            onClick={() => handleOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="relative flex items-center gap-3">
            <img
              src="/philfida-logo.png"
              alt=""
              className="h-12 w-12 rounded-xl bg-white p-1.5 object-contain shadow-sm"
            />
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                What’s new
              </div>
              <p className="text-xs text-white/75">A recent improvement</p>
            </div>
          </div>
          <DialogHeader className="relative mt-5 gap-2 text-left">
            <DialogTitle className="max-w-sm text-2xl font-semibold leading-tight text-primary-foreground">
              {update.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-white/85">
              {update.summary}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <time dateTime={update.publishedAt}>
              {new Intl.DateTimeFormat("en-PH", {
                dateStyle: "medium",
                timeZone: "Asia/Manila",
              }).format(new Date(update.publishedAt))}
            </time>
            <span aria-hidden="true">·</span>
            <span>Stock card</span>
          </div>

          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              A quick look
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1">
              <FlowStep icon={ArrowDownToLine} label="Stock received" />
              <ArrowRight className="mt-3 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <FlowStep icon={Send} label="Sent to office" />
              <ArrowRight className="mt-3 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <FlowStep icon={PackageCheck} label="Balance updated" />
            </div>
          </div>

          <div className="flex min-h-11 items-center gap-2.5 text-sm text-muted-foreground">
            <Checkbox
              id="whats-new-dont-show"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label
              htmlFor="whats-new-dont-show"
              className="cursor-pointer font-normal"
            >
              Don’t show this update on future logins
            </Label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            {showReadMore && (
              <Button
                variant="ghost"
                className="justify-start px-0 text-primary hover:bg-transparent hover:text-primary/80"
                onClick={() => onReadMore(dontShowAgain)}
              >
                Read the full update
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button
              className={!showReadMore ? "sm:ml-auto" : undefined}
              onClick={() => handleOpenChange(false)}
            >
              Got it
            </Button>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            You can revisit this update any time from Settings → What’s new.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FlowStep({
  icon: Icon,
  label,
}: {
  icon: typeof PackageCheck;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-xs font-medium leading-snug">{label}</span>
    </div>
  );
}
