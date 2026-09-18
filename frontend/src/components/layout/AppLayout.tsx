import { useState, type ReactNode } from "react";

import QuickTutorialDialog from "@/components/shared/QuickTutorialDialog";
import SetPasswordDialog from "@/components/shared/SetPasswordDialog";
import Sidebar from "./Sidebar";

const TUTORIAL_KEY = "philfida.quick-tutorial-seen";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [tutorialOpen, setTutorialOpen] = useState(
    () => localStorage.getItem(TUTORIAL_KEY) !== "true"
  );

  function handleTutorialChange(open: boolean) {
    setTutorialOpen(open);
    if (!open) localStorage.setItem(TUTORIAL_KEY, "true");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar onOpenTutorial={() => setTutorialOpen(true)} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      {/* Nags until the blank/default password is replaced. */}
      <SetPasswordDialog />
      <QuickTutorialDialog
        open={tutorialOpen}
        onOpenChange={handleTutorialChange}
      />
    </div>
  );
}
