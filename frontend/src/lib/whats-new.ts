export interface ProductUpdate {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  publishedAt: string;
  showOnLoginUntil: string;
  details: Array<{ title: string; description: string }>;
}

// Add future release notes here. The login announcement window is independent
// from the archive, so update details remain available after the first week.
export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "stock-card-2026-09",
    slug: "stock-card",
    title: "A clearer stock card for every item",
    shortTitle: "Stock cards are here",
    summary:
      "See deliveries and office issues together in one printable record. Each receipt adds to the balance, and every office issue reduces it.",
    publishedAt: "2026-09-30T16:45:00+08:00",
    showOnLoginUntil: "2026-10-07T16:45:00+08:00",
    details: [
      {
        title: "One history for each item",
        description:
          "The stock card follows the item’s recorded activity. It starts with an empty transaction table and fills in as stock is received or issued.",
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
  },
];

const SESSION_KEY_PREFIX = "philfida.whats-new.session.";
const DISMISSED_KEY_PREFIX = "philfida.whats-new.dismissed.";

function storageKey(prefix: string, userId: string, updateId: string): string {
  return `${prefix}${encodeURIComponent(userId)}.${encodeURIComponent(updateId)}`;
}

export function getLoginAnnouncement(now = new Date()): ProductUpdate | null {
  return (
    PRODUCT_UPDATES.find(
      (update) => new Date(update.showOnLoginUntil).getTime() >= now.getTime()
    ) ?? null
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
