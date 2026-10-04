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
import { getVisibleUpdates, markUpdateSeen, type ProductUpdate } from "@/lib/whats-new";
import { useAuth } from "@/store/AuthContext";

export default function WhatsNewPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);

  const update = slug
    ? getVisibleUpdates().find((entry) => entry.slug === slug)
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
            <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.14] via-primary/[0.05] to-card p-6 shadow-sm sm:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
              />
              <div className="relative mb-6 flex flex-wrap items-center gap-2">
                <Badge className="gap-1.5 shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  {update.category ?? "Product update"}
                </Badge>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <time dateTime={update.publishedAt}>{formatDate(update.publishedAt)}</time>
                </span>
              </div>
              <h2 className="relative max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                {update.title}
              </h2>
              <p className="relative mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {update.summary}
              </p>
              <Button className="relative mt-6 shadow-sm" onClick={() => setPreviewOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Show welcome message
              </Button>
            </div>

            <ol className="relative mt-8 space-y-5 before:absolute before:bottom-8 before:left-[17px] before:top-8 before:w-px before:bg-border">
              {update.details.map((detail, index) => (
                <li key={detail.title} className="relative flex gap-4">
                  <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm ring-4 ring-background">
                    {index + 1}
                  </span>
                  <section className="flex-1 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
                    <h3 className="font-semibold tracking-tight">{detail.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {detail.description}
                    </p>
                  </section>
                </li>
              ))}
            </ol>

            {update.tryIt && (
            <div className="mt-8 flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 text-sm shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <CircleCheck className="h-5 w-5 text-primary" />
              </span>
              <p className="leading-relaxed text-muted-foreground">
                {update.tryIt.map((segment, index) =>
                  segment.bold ? (
                    <strong key={index} className="text-foreground">
                      {segment.text}
                    </strong>
                  ) : (
                    <span key={index}>{segment.text}</span>
                  )
                )}
              </p>
            </div>
            )}
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

  const visibleUpdates = getVisibleUpdates();
  const latest = visibleUpdates[0];
  const earlier = visibleUpdates.slice(1);

  return (
    <AppLayout>
      <PageWrapper
        title="What’s new"
        subtitle="A quick guide to recent improvements in your inventory system."
      >
        <div className="mx-auto max-w-4xl">
          <article className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.14] via-primary/[0.05] to-card p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
            />
            <div className="relative mb-5 flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5 shadow-sm">
                <Sparkles className="h-3 w-3" />
                Latest update
              </Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(latest.publishedAt)}
              </span>
            </div>
            <h2 className="relative text-2xl font-bold tracking-tight sm:text-3xl">
              {latest.shortTitle}
            </h2>
            <p className="relative mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {latest.summary}
            </p>
            <div className="relative mt-6 flex flex-wrap gap-2">
              <Button onClick={() => navigate(`/settings/whats-new/${latest.slug}`)}>
                Read the full update
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Show welcome message
              </Button>
            </div>
          </article>

          {earlier.length > 0 && (
            <ol className="relative mt-8 space-y-5 before:absolute before:bottom-6 before:left-[13px] before:top-6 before:w-px before:bg-border">
              {earlier.map((entry) => (
                <li key={entry.id} className="relative pl-10">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/25"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <Card className="border-primary/15 transition-shadow hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{entry.category ?? "Product update"}</Badge>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(entry.publishedAt)}
                        </span>
                      </div>
                      <CardTitle className="pt-1 text-xl tracking-tight">{entry.shortTitle}</CardTitle>
                      <CardDescription className="max-w-2xl text-sm leading-relaxed">
                        {entry.summary}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => navigate(`/settings/whats-new/${entry.slug}`)}>
                        Read the full update
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-8 px-1 text-xs text-muted-foreground">
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
