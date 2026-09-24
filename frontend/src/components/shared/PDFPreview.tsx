import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface PDFPreviewProps {
  url: string | null;
  loading: boolean;
  title?: string;
}

/**
 * Shared PDF preview surface. Renders an <iframe> once a blob URL is provided
 * and overlays a spinner while a new report is being fetched. Revokes the
 * previous object URL when it changes or the component unmounts.
 */
export default function PDFPreview({
  url,
  loading,
  title = "Report preview",
}: PDFPreviewProps) {
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!url && !loading) return null;

  return (
    <div
      className="relative mt-6 h-[calc(100vh-8rem)] min-h-[520px] w-full overflow-hidden rounded-md border bg-muted/20 shadow-sm"
      aria-busy={loading}
    >
      {url && (
        <iframe src={url} title={title} className="h-full w-full" />
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
            <p className="text-sm">Generating PDF…</p>
          </div>
        </div>
      )}
    </div>
  );
}
