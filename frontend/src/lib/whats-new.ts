import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BellRing,
  CalendarDays,
  Eye,
  FileText,
  History,
  LayoutDashboard,
  Newspaper,
  Palette,
  Printer,
  Sparkles,
  SunMoon,
} from "lucide-react";

export interface ProductUpdate {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  publishedAt: string;
  showOnLoginUntil: string;
  details: Array<{ title: string; description: string }>;
  /** Groups related announcements, e.g. "Design changes". Shown in the modal and archive badges. */
  category?: string;
  /** Optional 3-step visual for the login modal. When absent, the modal keeps its default visual. */
  quickLook?: { steps: Array<{ icon: LucideIcon; label: string }> };
  /** Optional "try it" callout for the detail page. When absent, no callout is shown. */
  tryIt?: Array<{ text: string; bold?: boolean }>;
}

// Add future release notes here. The login announcement window is independent
// from the archive, so update details remain available after the first week.
//
// Each entry carries its own invisible 7-day login-modal window
// (publishedAt -> showOnLoginUntil). The countdown is silent: entries simply
// stop appearing in the login modal once their window lapses, one by one.
// When several announcements belong together, stagger publishedAt by a day so
// each gets its own day in the spotlight before vanishing in turn.
export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "ui-refresh-theme-2026-10",
    slug: "dark-mode",
    title: "Dark mode has arrived",
    shortTitle: "Dark mode",
    summary:
      "You can now switch the whole system between light and dark. Tap the sun/moon toggle in the top-right page header \u2014 charts, tables, and dialogs follow along.",
    publishedAt: "2026-10-07T09:00:00+08:00",
    showOnLoginUntil: "2026-10-14T09:00:00+08:00",
    category: "Design changes",
    quickLook: {
      steps: [
        { icon: SunMoon, label: "One-tap toggle" },
        { icon: Eye, label: "Easy on the eyes" },
        { icon: Palette, label: "Brand green kept" },
      ],
    },
    details: [
      {
        title: "One-tap toggle",
        description:
          "The sun/moon button in the page header switches themes instantly, and your choice is remembered the next time you sign in.",
      },
      {
        title: "Gentle on the eyes",
        description:
          "Colors crossfade smoothly instead of snapping, and contrast was tuned so text stays readable in both modes.",
      },
      {
        title: "Charts follow the theme",
        description:
          "Stock movement charts, tooltips, and notifications all adapt to the active theme automatically.",
      },
    ],
    tryIt: [
      { text: "Tap the " },
      { text: "sun/moon toggle", bold: true },
      { text: " in the top-right page header to try it now." },
    ],
  },
  {
    id: "ui-refresh-whats-new-2026-10",
    slug: "whats-new-refresh",
    title: "A fresher What\u2019s new page",
    shortTitle: "What\u2019s new refresh",
    summary:
      "This very page got a redesign. The latest update is featured in a hero banner up top, while older updates now live in a timeline that\u2019s easier to browse.",
    publishedAt: "2026-10-06T09:00:00+08:00",
    showOnLoginUntil: "2026-10-13T09:00:00+08:00",
    category: "Design changes",
    quickLook: {
      steps: [
        { icon: Sparkles, label: "Featured latest" },
        { icon: History, label: "Timeline archive" },
        { icon: Newspaper, label: "Browse past updates" },
      ],
    },
    details: [
      {
        title: "Featured latest update",
        description:
          "The most recent announcement gets a hero treatment with a soft gradient backdrop, so you never miss what\u2019s newest.",
      },
      {
        title: "A timeline for older updates",
        description:
          "Past updates are arranged in a timeline with numbered detail steps, making the full history of improvements easy to follow.",
      },
    ],
    tryIt: [
      {
        text: "You\u2019re looking at it \u2014 scroll down to browse the timeline of past updates.",
      },
    ],
  },
  {
    id: "ui-refresh-reports-2026-10",
    slug: "reports-refresh",
    title: "Reports with a clearer, more compact layout",
    shortTitle: "Reports refresh",
    summary:
      "The Reports page is now more visual and space-efficient. Each report type has its own icon tile, the date filter is slimmer, and generated documents are easier to browse.",
    publishedAt: "2026-10-05T09:00:00+08:00",
    showOnLoginUntil: "2026-10-12T09:00:00+08:00",
    category: "Design changes",
    quickLook: {
      steps: [
        { icon: FileText, label: "Icon per report" },
        { icon: CalendarDays, label: "Compact date filter" },
        { icon: Printer, label: "Batch printing" },
      ],
    },
    details: [
      {
        title: "An icon tile for each report",
        description:
          "Stock Card, Request Form, Received Form, and Batch Print each have a distinct icon, so the report you need is recognizable at a glance.",
      },
      {
        title: "A slimmer date filter",
        description:
          "The date range filter now takes less vertical space with a compact green-tinted design, leaving more room for the reports themselves.",
      },
      {
        title: "Tidier document rows",
        description:
          "Generated documents appear as compact file tiles with clearer actions for previewing and downloading.",
      },
    ],
    tryIt: [
      { text: "Open " },
      { text: "Reports", bold: true },
      { text: " and pick any report type to see the new layout." },
    ],
  },
  {
    id: "ui-refresh-dashboard-2026-10",
    slug: "dashboard-refresh",
    title: "A cleaner, more breathable dashboard",
    shortTitle: "Dashboard refresh",
    summary:
      "Your daily overview got a visual tidy-up \u2014 compact KPI cards, clearer charts, and low-stock alerts that are easier to scan. Same numbers, same links, less clutter.",
    publishedAt: "2026-10-04T09:00:00+08:00",
    showOnLoginUntil: "2026-10-11T09:00:00+08:00",
    category: "Design changes",
    quickLook: {
      steps: [
        { icon: LayoutDashboard, label: "Compact KPI cards" },
        { icon: BellRing, label: "Low-stock alerts" },
        { icon: BarChart3, label: "Clearer charts" },
      ],
    },
    details: [
      {
        title: "Compact KPI cards",
        description:
          "Total items, stock value, and today\u2019s movements now sit in tighter cards with tinted icon tiles, so the key figures are easier to scan at a glance.",
      },
      {
        title: "Low-stock alerts stand out",
        description:
          "Items running low get their own alert tiles with a direct link to each item, so restocking is one click away.",
      },
      {
        title: "Clearer charts and lists",
        description:
          "The stock movement chart and recent activity list have branded section headers and more breathing room, with tighter spacing between cards.",
      },
    ],
    tryIt: [
      { text: "See it on the " },
      { text: "Dashboard", bold: true },
      { text: " \u2014 everything is where you left it, just tidier." },
    ],
  },
  {
    id: "stock-card-2026-09",
    slug: "stock-card",
    title: "A clearer stock card for every item",
    shortTitle: "Stock cards are here",
    summary:
      "See deliveries and office issues together in one printable record. Each receipt adds to the balance, and every office issue reduces it.",
    publishedAt: "2026-09-30T16:45:00+08:00",
    showOnLoginUntil: "2026-10-07T16:45:00+08:00",
    category: "Stock card",
    details: [
      {
        title: "One history for each item",
        description:
          "The stock card follows the item\u2019s recorded activity. It starts with an empty transaction table and fills in as stock is received or issued.",
      },
      {
        title: "Deliveries are easy to trace",
        description:
          "A stock-in entry shows the date, the reference you entered, and the quantity received. Use a purchase order or delivery reference your team already recognizes.",
      },
      {
        title: "Office issues update the balance",
        description:
          "Each stock-out shows how many items were issued and which office received them. The running balance updates after every recorded movement.",
      },
      {
        title: "Find and print it from Reports",
        description:
          "Open Reports, choose Stock Card, select an item, and apply the existing date filters. Preview or download the long-bond PDF when you are ready to print.",
      },
    ],
    tryIt: [
      { text: "To try it, open " },
      { text: "Reports", bold: true },
      { text: ", choose " },
      { text: "Stock Card", bold: true },
      { text: ", and select an item with recorded activity." },
    ],
  },
];

const SESSION_KEY_PREFIX = "philfida.whats-new.session.";
const DISMISSED_KEY_PREFIX = "philfida.whats-new.dismissed.";

function storageKey(prefix: string, userId: string, updateId: string): string {
  return `${prefix}${encodeURIComponent(userId)}.${encodeURIComponent(updateId)}`;
}

/** Updates whose publish date has passed. Future-staggered entries stay hidden until their day. */
export function getVisibleUpdates(now = new Date()): ProductUpdate[] {
  return PRODUCT_UPDATES.filter(
    (update) => new Date(update.publishedAt).getTime() <= now.getTime()
  );
}

export function getLoginAnnouncement(now = new Date(), userId?: string): ProductUpdate | null {
  return (
    PRODUCT_UPDATES.find((update) => {
      if (new Date(update.publishedAt).getTime() > now.getTime()) return false;
      if (new Date(update.showOnLoginUntil).getTime() < now.getTime())
        return false;
      if (userId && hasDismissedUpdate(userId, update.id)) return false;
      return true;
    }) ?? null
  );
}

export function hasDismissedUpdate(userId: string, updateId: string): boolean {
  try {
    return (
      window.localStorage.getItem(
        storageKey(DISMISSED_KEY_PREFIX, userId, updateId)
      ) === "true"
    );
  } catch {
    return false;
  }
}

export function hasSeenUpdateThisSession(
  userId: string,
  updateId: string
): boolean {
  try {
    return (
      window.sessionStorage.getItem(
        storageKey(SESSION_KEY_PREFIX, userId, updateId)
      ) === "true"
    );
  } catch {
    return false;
  }
}

export function markUpdateSeen(
  userId: string,
  updateId: string,
  dontShowAgain: boolean
): void {
  try {
    window.sessionStorage.setItem(
      storageKey(SESSION_KEY_PREFIX, userId, updateId),
      "true"
    );
    if (dontShowAgain) {
      window.localStorage.setItem(
        storageKey(DISMISSED_KEY_PREFIX, userId, updateId),
        "true"
      );
    }
  } catch {
    // The announcement can still be closed if browser storage is unavailable.
  }
}

export function clearWhatsNewSessionForUser(userId: string): void {
  try {
    const prefix = `${SESSION_KEY_PREFIX}${encodeURIComponent(userId)}.`;
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(prefix)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // A missing session-storage permission should not interrupt sign-in/out.
  }
}
