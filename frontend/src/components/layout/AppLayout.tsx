import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import QuickTutorialDialog from "@/components/shared/QuickTutorialDialog";
import SetPasswordDialog from "@/components/shared/SetPasswordDialog";
import WhatsNewDialog from "@/components/shared/WhatsNewDialog";
import { useAuth } from "@/store/AuthContext";
import {
  getLoginAnnouncement,
  hasDismissedUpdate,
  hasSeenUpdateThisSession,
  markUpdateSeen,
} from "@/lib/whats-new";
import Sidebar from "./Sidebar";

const TUTORIAL_KEY = "philfida.quick-tutorial-seen";

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [tutorialOpen, setTutorialOpen] = useState(
    () => localStorage.getItem(TUTORIAL_KEY) !== "true"
  );
  const [passwordPromptDismissed, setPasswordPromptDismissed] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementCycleDone, setAnnouncementCycleDone] = useState(false);
  const announcement = getLoginAnnouncement(new Date(), user?.id);
  const userId = user?.id;
  const announcementId = announcement?.id;
  const passwordPromptPending = !!user?.must_change_password && !passwordPromptDismissed;

  useEffect(() => {
    if (
      !userId ||
      !announcementId ||
      tutorialOpen ||
      passwordPromptPending ||
      announcementCycleDone
    ) return;
    if (
      hasDismissedUpdate(userId, announcementId) ||
      hasSeenUpdateThisSession(userId, announcementId)
    ) {
      return;
    }
    setAnnouncementOpen(true);
  }, [announcementCycleDone, announcementId, passwordPromptPending, tutorialOpen, userId]);

  function handleTutorialChange(open: boolean) {
    setTutorialOpen(open);
    if (!open) localStorage.setItem(TUTORIAL_KEY, "true");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar onOpenTutorial={() => setTutorialOpen(true)} />
      <main className="flex-1 overflow-y-auto">
        <div key={location.pathname} className="page-transition">
          {children}
        </div>
      </main>
      {/* Nags until the blank/default password is replaced. */}
      <SetPasswordDialog onDismiss={() => setPasswordPromptDismissed(true)} />
      <QuickTutorialDialog
        open={tutorialOpen}
        onOpenChange={handleTutorialChange}
      />
      {announcement && user && (
        <WhatsNewDialog
          update={announcement}
          open={announcementOpen}
          onOpenChange={setAnnouncementOpen}
          onDismiss={(dontShowAgain) => {
            setAnnouncementCycleDone(true);
            markUpdateSeen(user.id, announcement.id, dontShowAgain);
          }}
          onReadMore={(dontShowAgain) => {
            setAnnouncementCycleDone(true);
            markUpdateSeen(user.id, announcement.id, dontShowAgain);
            setAnnouncementOpen(false);
            navigate(`/settings/whats-new/${announcement.slug}`);
          }}
        />
      )}
    </div>
  );
}
