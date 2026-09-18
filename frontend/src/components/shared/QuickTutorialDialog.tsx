import { BookOpen, Boxes, CheckCircle2, Tags, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Quick start guide
          </DialogTitle>
          <DialogDescription>
            Follow these steps once before recording your first release.
          </DialogDescription>
        </DialogHeader>

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

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">For a request:</strong> choose
          an item with available stock, search for the employee, enter the
          quantity, then record the stock-out.
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Got it
          </Button>
        </DialogFooter>
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
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-primary">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {number}
        </span>
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
