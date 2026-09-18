import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PdfDialogProps {
  url: string | null;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

/**
 * In-app PDF viewer dialog so every "print/export PDF" action shows the
 * document here — the iframe's built-in toolbar handles print/save.
 */
export default function PdfDialog({
  url,
  onOpenChange,
  title = "Document",
}: PdfDialogProps) {
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <Dialog open={!!url} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] h-[94vh] !w-[96vw] !max-w-[1400px] gap-2 p-3 sm:p-4">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        {url && (
          <iframe
            src={url}
            title={title}
            className="min-h-0 h-full w-full rounded-md border bg-muted/20"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
