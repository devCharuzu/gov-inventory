import {
  Boxes,
  CheckCircle2,
  PackageCheck,
  Tags,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuickTutorialDialog({
  open,
  onOpenChange,
}: QuickTutorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,760px)] max-w-[calc(100%-2rem)] overflow-y-auto p-0 sm:max-w-4xl"
        showCloseButton={false}
      >
        <div className="relative overflow-hidden rounded-t-xl bg-primary px-8 pb-6 pt-6 text-primary-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border-[24px] border-white/10"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            aria-label="Close quick guide"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="relative flex items-center gap-4">
            <img
              src="/philfida-logo.png"
              alt=""
              className="h-12 w-12 rounded-xl bg-white p-1.5 object-contain shadow-sm"
            />
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
                <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Quick guide
              </div>
              <p className="text-xs text-white/75">Inventory basics</p>
            </div>
          </div>
          <DialogHeader className="relative mt-6 text-left">
            <DialogTitle className="text-2xl font-semibold leading-tight text-primary-foreground">
              Get your inventory ready
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-white/85">
              Follow these steps once before recording your first release.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-8 py-6">
          <section aria-labelledby="quick-guide-steps-title">
            <h2
              id="quick-guide-steps-title"
              className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Start with these three steps
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <GuideStep
                number="1"
                icon={Tags}
                title="Add categories"
                text="Create categories first, such as Office Supplies or Equipment."
              />
              <GuideStep
                number="2"
                icon={Boxes}
                title="Add items"
                text="Add each inventory item and assign it to a category."
              />
              <GuideStep
                number="3"
                icon={CheckCircle2}
                title="Stock in"
                text="Record received stock before releasing items for requests."
              />
            </div>
          </section>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <PackageCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              When fulfilling a request
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Choose an item with available stock, search for the employee,
              enter the quantity, then record the stock-out.
            </p>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button onClick={() => onOpenChange(false)}>
              Got it
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GuideStep({
  number,
  icon: Icon,
  title,
  text,
}: {
  number: string;
  icon: typeof Tags;
  title: string;
  text: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {number}
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
