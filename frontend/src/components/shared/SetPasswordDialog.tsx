import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/lib/services/auth.service";
import { useAuth } from "@/store/AuthContext";

/**
 * Shown automatically after login while the account still uses the
 * temporary issued password. Dismissible ("Later"), but reappears on every
 * login until a real password is set.
 */
export default function SetPasswordDialog() {
  const { user, setUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = !!user?.must_change_password && !dismissed;

  async function handleSave() {
    setError(null);
    if (pw.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (pw !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword(current, pw);
      if (user) setUser({ ...user, must_change_password: false });
      toast.success("Password set — use it the next time you sign in.");
    } catch (err) {
      const detail = (
        err as { response?: { data?: { detail?: string } } }
      )?.response?.data?.detail;
      setError(detail ?? "Failed to set password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setDismissed(true)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Set your password now
          </DialogTitle>
          <DialogDescription>
            This account is still using the temporary password issued by the
            developer. Please set a private password immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="spd-current">Current password</Label>
            <Input
              id="spd-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Enter the temporary password"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spd-new">New password</Label>
            <Input
              id="spd-new"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spd-confirm">Confirm new password</Label>
            <Input
              id="spd-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={saving}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDismissed(true)}
            disabled={saving}
          >
            Later
          </Button>
          <Button onClick={handleSave} disabled={saving || !pw}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Set Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
