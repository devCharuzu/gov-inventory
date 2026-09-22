import { useCallback, useEffect, useState } from "react";
import { Database, Download, Inbox, Loader2, Pencil, Plus, RotateCcw, Trash2, UserCheck, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { AppLayout, PageWrapper } from "@/components/layout";
import { ConfirmDialog, DateInput, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyticsService } from "@/lib/services/analytics.service";
import { useAuth } from "@/store/AuthContext";
import { auditService } from "@/lib/services/audit.service";
import { authService } from "@/lib/services/auth.service";
import { backupService } from "@/lib/services/backup.service";
import { signatoriesService } from "@/lib/services/signatories.service";
import { EMPLOYEE_UNITS, isEmployeeUnit } from "@/lib/employee-units";
import { transactionsService } from "@/lib/services/transactions.service";
import type { AuditLog } from "@/types/audit.types";
import type { User, UserRole } from "@/types/auth.types";
import type { Signatory, SignatorySettings } from "@/types/signatory.types";
import UserForm, { type UserFormValues } from "./UserForm";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageWrapper title="Settings" subtitle="System administration">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="signatories">Employees</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
            <TabsTrigger value="info">App Info</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-6">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
          <TabsContent value="signatories" className="mt-6">
            <SignatoriesTab />
          </TabsContent>
          <TabsContent value="audit" className="mt-6">
            <AuditTab />
          </TabsContent>
          <TabsContent value="backup" className="mt-6">
            <BackupTab />
          </TabsContent>
          <TabsContent value="info" className="mt-6">
            <AppInfoTab />
          </TabsContent>
        </Tabs>
      </PageWrapper>
    </AppLayout>
  );
}

function roleVariant(role: UserRole) {
  return role === "admin"
    ? "default"
    : role === "encoder"
      ? "secondary"
      : "outline";
}

/* -------------------------------------------------------------------------- */
/* Users tab                                                                  */
/* -------------------------------------------------------------------------- */
function UsersTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("viewer");
  const [editActive, setEditActive] = useState("active");
  const [toDelete, setToDelete] = useState<User | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    authService
      .getUsers(1, 100)
      .then((res) => setUsers(res.items))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(fetchUsers, [fetchUsers]);

  async function handleCreate(values: UserFormValues) {
    setSubmitting(true);
    try {
      await authService.createUser({
        full_name: values.full_name,
        username: values.username,
        role: values.role,
        password: values.password,
      });
      toast.success("User created");
      setAddOpen(false);
      fetchUsers();
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
      toast.error(detail ?? "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(u: User) {
    setEditing(u);
    setEditRole(u.role);
    setEditActive(u.is_active ? "active" : "inactive");
  }

  async function handleEditSave() {
    if (!editing) return;
    setSubmitting(true);
    try {
      await authService.updateUser(editing.id, {
        role: editRole,
        is_active: editActive === "active",
      });
      toast.success("User updated");
      setEditing(null);
      fetchUsers();
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
      toast.error(detail ?? "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReactivate(u: User) {
    try {
      await authService.updateUser(u.id, { is_active: true });
      toast.success(`Reactivated ${u.username}`);
      fetchUsers();
    } catch {
      toast.error("Failed to reactivate user");
    }
  }

  async function handleDelete(password: string) {
    if (!toDelete) return;
    await authService.deleteUser(toDelete.id, password);
    toast.success(`Deleted ${toDelete.username}`);
    setToDelete(null);
    fetchUsers();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <EmptyRow cols={5} message="No users" />
            ) : (
              users.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <TableRow
                    key={u.id}
                    className={u.is_active ? "" : "bg-muted/40"}
                  >
                    <TableCell className="font-medium">
                      {u.full_name}
                    </TableCell>
                    <TableCell>
                      {u.username}
                      {u.is_main_admin && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-blue-600/30 text-[10px] text-blue-700 dark:text-blue-400"
                        >
                          Main Admin
                        </Badge>
                      )}
                      {isSelf && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant(u.role)} className="uppercase">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge active={u.is_active} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(u)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!u.is_active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-600"
                            onClick={() => handleReactivate(u)}
                            aria-label="Reactivate"
                            title="Reactivate"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {!u.is_main_admin && !isSelf && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setToDelete(u)}
                            aria-label="Delete"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <UserForm
            submitting={submitting}
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editRole}
                onValueChange={(v) => v && setEditRole(v as UserRole)}
                disabled={editing?.is_main_admin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="encoder">Encoder</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              {editing?.is_main_admin && (
                <p className="text-xs text-muted-foreground">
                  The main admin's role cannot be changed.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editActive}
                onValueChange={(v) => v && setEditActive(v)}
                disabled={editing?.is_main_admin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {editing?.is_main_admin && (
                <p className="text-xs text-muted-foreground">
                  The main admin cannot be deactivated.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={submitting}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete user?"
        description={
          toDelete
            ? `${toDelete.username} will be permanently removed and will no longer be able to sign in. Enter your password to confirm.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Password-confirmation dialog — used for actions that need re-auth         */
/* -------------------------------------------------------------------------- */
function PasswordConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError(null);
    }
  }, [open]);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
      setError(detail ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="pw-confirm">Your password</Label>
            <Input
              id="pw-confirm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !password}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit tab                                                                  */
/* -------------------------------------------------------------------------- */
function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    authService
      .getUsers(1, 100)
      .then((res) => setUsers(res.items))
      .catch(() => undefined);
    auditService.getActions().then(setActions).catch(() => undefined);
  }, []);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    auditService
      .getAuditLogs({
        user_id: userId,
        action: action,
        start_date: start ? new Date(start).toISOString() : undefined,
        end_date: end ? new Date(end).toISOString() : undefined,
        page: 1,
        size: 50,
      })
      .then((res) => setLogs(res.items))
      .catch(() => toast.error("Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [userId, action, start, end]);

  useEffect(fetchLogs, [fetchLogs]);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  }

  function toggleSelectAll() {
    if (selected.size === logs.length && logs.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(logs.map((l) => l.id)));
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selected];
    try {
      const res = await auditService.bulkDeleteLogs(ids);
      toast.success(`Deleted ${res.deleted} log${res.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      fetchLogs();
    } catch {
      toast.error("Failed to delete audit logs");
    }
  }

  async function handleDeleteAll() {
    const ids = logs.map((l) => l.id);
    try {
      const res = await auditService.bulkDeleteLogs(ids);
      toast.success(`Deleted ${res.deleted} log${res.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      fetchLogs();
    } catch {
      toast.error("Failed to delete audit logs");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={userId} onValueChange={(v) => setUserId(v ?? undefined)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {userId && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setUserId(undefined)} aria-label="Clear">
            <X className="h-4 w-4" />
          </Button>
        )}
        <Select value={action} onValueChange={(v) => setAction(v ?? undefined)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {action && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAction(undefined)} aria-label="Clear">
            <X className="h-4 w-4" />
          </Button>
        )}
        <DateInput
          value={start}
          onChange={setStart}
          placeholder="Start date"
          aria-label="Start date"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <DateInput
          value={end}
          onChange={setEnd}
          placeholder="End date"
          aria-label="End date"
        />
        {selected.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDeleteSelected(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete ({selected.size})
          </Button>
        )}
        {logs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDeleteAll(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete All
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={logs.length > 0 && selected.size === logs.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <EmptyRow cols={7} message="No audit entries" />
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(log.id)}
                      onCheckedChange={() => toggleSelect(log.id)}
                      aria-label="Select row"
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.user_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.entity_type ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate font-mono text-xs">
                    {log.entity_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    {log.details ? (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setExpanded((id) =>
                              id === log.id ? null : log.id
                            )
                          }
                        >
                          {expanded === log.id ? "Hide" : "View"}
                        </Button>
                        {expanded === log.id && (
                          <pre className="mt-1 max-w-xs overflow-auto rounded bg-muted p-2 text-xs">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmDeleteSelected}
        onOpenChange={setConfirmDeleteSelected}
        title="Delete selected logs?"
        description={`${selected.size} audit log${selected.size === 1 ? "" : "s"} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteSelected}
      />
      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete all visible logs?"
        description={`${logs.length} audit log${logs.length === 1 ? "" : "s"} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete All"
        destructive
        onConfirm={handleDeleteAll}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Backup tab                                                                 */
/* -------------------------------------------------------------------------- */
function BackupTab() {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await backupService.download();
      toast.success("Backup downloaded");
    } catch {
      toast.error("Failed to download backup");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" />
          Database Backup
        </CardTitle>
        <CardDescription>
          Download inventory records as JSON for safekeeping. PDF contents are excluded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleDownload} disabled={downloading}>
          <Download className="mr-2 h-4 w-4" />
          {downloading ? "Preparing…" : "Download Database Backup"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* App Info tab                                                               */
/* -------------------------------------------------------------------------- */
function AppInfoTab() {
  const [counts, setCounts] = useState<{
    users: number;
    items: number;
    transactions: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      authService.getUsers(1, 1),
      analyticsService.getSummary(),
      transactionsService.getTransactions({ page: 1, size: 1 }),
    ])
      .then(([users, summary, txns]) =>
        setCounts({
          users: users.total,
          items: summary.total_items,
          transactions: txns.total,
        })
      )
      .catch(() => setCounts(null));
  }, []);

  const rows: [string, string][] = [
    ["Application", "Philfida Inventory System"],
    ["Version", "1.0.0"],
    ["Total Users", counts ? String(counts.users) : "…"],
    ["Total Items", counts ? String(counts.items) : "…"],
    ["Total Transactions", counts ? String(counts.transactions) : "…"],
  ];

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Application Information</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between py-2.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile Tab                                                                 */
/* -------------------------------------------------------------------------- */
function ProfileTab() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.full_name ?? "");
  const [position, setPosition] = useState(user?.position ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        full_name: name.trim() || undefined,
        position: position.trim() || undefined,
      });
      setUser(updated);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-base">My Profile</CardTitle>
          <CardDescription>
            Your name and position appear in the audit log and on official documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>Position / Designation</Label>
            <Input
              placeholder="e.g. Administrative Officer IV"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>Username: <span className="font-mono">{user?.username}</span></p>
            <p>Role: <span className="capitalize">{user?.role}</span></p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const { user, setUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleChange() {
    if (pw.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (pw !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword(current, pw);
      if (user) setUser({ ...user, must_change_password: false });
      setCurrent("");
      setPw("");
      setConfirm("");
      toast.success("Password changed");
    } catch (err) {
      const detail = (
        err as { response?: { data?: { detail?: string } } }
      )?.response?.data?.detail;
      toast.error(detail ?? "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Change Password</CardTitle>
        <CardDescription>
          {user?.must_change_password
            ? "Your account still uses the default password — set a real one now."
            : "Update the password you use to sign in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Current Password</Label>
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Leave blank if you haven't set one"
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label>New Password</Label>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label>Confirm New Password</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={saving}
          />
        </div>
        <Button
          onClick={handleChange}
          disabled={saving || !pw}
          className="w-full"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Change Password
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Signatories Tab                                                             */
/* -------------------------------------------------------------------------- */
function SignatoriesTab() {
  const [people, setPeople] = useState<Signatory[]>([]);
  const [settings, setSettings] = useState<SignatorySettings>({
    certifier_id: null,
    issuer_id: null,
    region: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Signatory | null>(null);
  const [nameVal, setNameVal] = useState("");
  const [desigVal, setDesigVal] = useState("");
  const [unitVal, setUnitVal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirm delete
  const [toDelete, setToDelete] = useState<Signatory | null>(null);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      signatoriesService.list(),
      signatoriesService.getSettings(),
    ])
      .then(([list, s]) => {
        setPeople(list);
        setSettings(s);
      })
      .catch(() => toast.error("Failed to load signatories"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(fetchAll, [fetchAll]);

  function openAdd() {
    setEditing(null);
    setNameVal("");
    setDesigVal("");
    setUnitVal("");
    setDialogOpen(true);
  }

  function openEdit(s: Signatory) {
    setEditing(s);
    setNameVal(s.full_name);
    setDesigVal(s.designation);
    setUnitVal(s.unit ?? "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!nameVal.trim() || !desigVal.trim()) {
      toast.error("Name and position are required");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        if (!isEmployeeUnit(unitVal)) {
          toast.error("Choose one of the listed units before saving");
          return;
        }
        await signatoriesService.update(editing.id, {
          full_name: nameVal.trim(),
          designation: desigVal.trim(),
          unit: unitVal,
        });
        toast.success("Employee updated");
      } else {
        if (!isEmployeeUnit(unitVal)) {
          toast.error("Choose a unit before adding the employee");
          return;
        }
        await signatoriesService.create({
          full_name: nameVal.trim(),
          designation: desigVal.trim(),
          unit: unitVal,
        });
        toast.success("Employee added");
      }
      setDialogOpen(false);
      fetchAll();
    } catch {
      toast.error("Failed to save employee");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await signatoriesService.remove(toDelete.id);
      toast.success(`Removed ${toDelete.full_name}`);
      fetchAll();
    } catch {
      toast.error("Failed to remove signatory");
    }
  }

  async function updateRole(
    role: "certifier_id" | "issuer_id",
    value: string | null
  ) {
    setSaving(true);
    try {
      const updated = await signatoriesService.updateSettings({ [role]: value });
      setSettings(updated);
      toast.success("Selection saved");
    } catch {
      toast.error("Failed to save selection");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regional Office</CardTitle>
          <CardDescription>
            Your account is permanently assigned to this region. Inventory,
            users, settings, reports, and PDF headers are isolated to it.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm font-medium">
          {settings.region ?? "Assigned regional office"}
        </CardContent>
      </Card>

      {/* Selection card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" />
            Document Signatories
          </CardTitle>
          <CardDescription>
            The selected persons will appear on the Certified By and Issued By
            lines of every OUT transaction slip.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Certified By</Label>
            <div className="flex items-center gap-1">
              <Select
                value={settings.certifier_id ?? undefined}
                onValueChange={(v) => updateRole("certifier_id", v ?? null)}
                disabled={saving || loading}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select employee…">
                    {(val) =>
                      people.find((p) => p.id === val)?.full_name ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div>
                        <p>{p.full_name}</p>
                        <p className="text-xs text-muted-foreground">{p.designation}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {settings.certifier_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => updateRole("certifier_id", null)}
                  disabled={saving}
                  aria-label="Clear certifier"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Issued By</Label>
            <div className="flex items-center gap-1">
              <Select
                value={settings.issuer_id ?? undefined}
                onValueChange={(v) => updateRole("issuer_id", v ?? null)}
                disabled={saving || loading}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select employee…">
                    {(val) =>
                      people.find((p) => p.id === val)?.full_name ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div>
                        <p>{p.full_name}</p>
                        <p className="text-xs text-muted-foreground">{p.designation}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {settings.issuer_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => updateRole("issuer_id", null)}
                  disabled={saving}
                  aria-label="Clear issuer"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees list card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Employees</CardTitle>
            <CardDescription>
              Manage employees. These appear as selectable recipients when
              releasing items and as Certified By / Issued By officers.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : people.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Inbox className="h-7 w-7" />
              <p className="text-sm">No employees yet — add one above.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((p) => {
                  const isCert = settings.certifier_id === p.id;
                  const isIss = settings.issuer_id === p.id;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.designation}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.unit || "—"}
                        {p.unit && !isEmployeeUnit(p.unit) && (
                          <span className="ml-2 text-xs text-amber-700">
                            Needs unit update
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isCert && (
                            <Badge variant="default" className="text-[10px]">
                              Certifier
                            </Badge>
                          )}
                          {isIss && (
                            <Badge variant="secondary" className="text-[10px]">
                              Issuer
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setToDelete(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Employee" : "Add Employee"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="e.g. Juan Dela Cruz"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input
                placeholder="e.g. Administrative Officer IV"
                value={desigVal}
                onChange={(e) => setDesigVal(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={unitVal || undefined}
                onValueChange={(value) => setUnitVal(value ?? "")}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an office unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitVal && !isEmployeeUnit(unitVal) && (
                    <SelectItem value={unitVal}>
                      Current: {unitVal} — choose a standard unit
                    </SelectItem>
                  )}
                  {EMPLOYEE_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {editing && unitVal && !isEmployeeUnit(unitVal)
                  ? "This employee has a manually entered unit. Choose a standard unit to update the record."
                  : "Choose a unit so employees and release reports stay grouped consistently."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remove employee?"
        description={
          toDelete
            ? `${toDelete.full_name} will be removed. If currently selected as a signatory, the slip will show a blank line until a new person is chosen.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-32">
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Inbox className="h-7 w-7" />
          <p className="text-sm">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
