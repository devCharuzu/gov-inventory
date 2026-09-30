import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Sparkles,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { AppLayout, PageWrapper } from "@/components/layout";
import WhatsNewDialog from "@/components/shared/WhatsNewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRODUCT_UPDATES, markUpdateSeen, type ProductUpdate } from "@/lib/whats-new";
import { useAuth } from "@/store/AuthContext";

export default function WhatsNewPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);

  const update = slug
    ? PRODUCT_UPDATES.find((entry) => entry.slug === slug)
    : undefined;

  if (slug && !update) return <Navigate to="/settings/whats-new" replace />;

  function finishPreview(dontShowAgain: boolean, selected: ProductUpdate) {
    if (user) markUpdateSeen(user.id, selected.id, dontShowAgain);
  }

  if (update) {
    return (
      <AppLayout>
        <PageWrapper
          title="What’s new"
          subtitle="Small improvements to make everyday inventory work clearer."
          actions={
            <Button
              variant="outline"
              onClick={() => navigate("/settings/whats-new")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              All updates
            </Button>
          }
        >
          <article className="mx-auto max-w-3xl">
            <div className="mb-6 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge className="gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Product update
                </Badge>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <time dateTime={update.publishedAt}>{formatDate(update.publishedAt)}</time>
                </span>
              </div>
              <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                {update.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {update.summary}
              </p>
              <Button className="mt-5" onClick={() => setPreviewOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Show welcome message
              </Button>
            </div>

            <div className="space-y-3">
              {update.details.map((detail, index) => (
                <section
                  key={detail.title}
                  className="flex gap-4 rounded-xl border bg-card p-4 sm:p-5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{detail.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {detail.description}
                    </p>
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="leading-relaxed text-muted-foreground">
                To try it, open <strong className="text-foreground">Reports</strong>,
                choose <strong className="text-foreground">Stock Card</strong>, and
                select an item with recorded activity.
              </p>
            </div>
          </article>
        </PageWrapper>
        <WhatsNewDialog
          update={update}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          showReadMore={false}
          onDismiss={(dontShowAgain) => finishPreview(dontShowAgain, update)}
          onReadMore={(dontShowAgain) => {
            finishPreview(dontShowAgain, update);
            setPreviewOpen(false);
          }}
        />
      </AppLayout>
    );
  }

  const latest = PRODUCT_UPDATES[0];

  return (
    <AppLayout>
      <PageWrapper
        title="What’s new"
        subtitle="A quick guide to recent improvements in your inventory system."
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {PRODUCT_UPDATES.map((entry, index) => (
            <Card key={entry.id} className="border-primary/15">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {index === 0 ? "Latest update" : "Product update"}
                  </Badge>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(entry.publishedAt)}
                  </span>
                </div>
                <CardTitle className="pt-1 text-xl">{entry.shortTitle}</CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-relaxed">
                  {entry.summary}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => navigate(`/settings/whats-new/${entry.slug}`)}>
                  Read the full update
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {entry.id === latest.id && (
                  <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Show welcome message
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          <p className="px-1 text-xs text-muted-foreground">
            New login announcements appear for one week. You can revisit this update here afterward.
          </p>
          {user?.role === "admin" && (
            <div className="flex justify-end">
              <Button
                variant="link"
                className="px-1"
                onClick={() => navigate("/settings")}
              >
                System settings
              </Button>
            </div>
          )}
        </div>
      </PageWrapper>
      <WhatsNewDialog
        update={latest}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDismiss={(dontShowAgain) => finishPreview(dontShowAgain, latest)}
        onReadMore={(dontShowAgain) => {
          finishPreview(dontShowAgain, latest);
          setPreviewOpen(false);
          navigate(`/settings/whats-new/${latest.slug}`);
        }}
      />
    </AppLayout>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
