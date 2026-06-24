import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, RefreshCw, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  generateConnectUrl,
  syncAccounts,
  listAccounts,
  fetchPlatformSelectors,
  setPlatformSelector,
} from "@/lib/upload-post.functions";
import {
  PUBLISHING_PLATFORMS,
  PLATFORM_META,
  PLATFORM_CAPABILITY_MATRIX,
  resolvePublishingError,
  type PublishingPlatform,
} from "@/lib/upload-post/shared";

interface Account {
  platform: string;
  is_connected: boolean;
  profile_display_name: string | null;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  pinterest_default_board_id: string | null;
  pinterest_default_board_name: string | null;
  linkedin_org_name: string | null;
  connection_method: string;
}

type SelectorPlatform = "facebook" | "linkedin" | "pinterest";

export function ConnectedAccountsTab({
  autoSync,
  onConnectionsChanged,
}: {
  autoSync?: boolean;
  onConnectionsChanged?: () => void;
}) {
  const listFn = useServerFn(listAccounts);
  const syncFn = useServerFn(syncAccounts);
  const connectFn = useServerFn(generateConnectUrl);
  const fetchSelFn = useServerFn(fetchPlatformSelectors);
  const setSelFn = useServerFn(setPlatformSelector);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectorFor, setSelectorFor] = useState<SelectorPlatform | null>(null);
  const [selectorOptions, setSelectorOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [savingSelector, setSavingSelector] = useState<string | null>(null);

  const byPlatform = (p: string) => accounts.find((a) => a.platform === p);

  const load = async () => {
    try {
      const res = (await listFn()) as { accounts: Account[] };
      setAccounts(res.accounts ?? []);
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    } finally {
      setLoading(false);
    }
  };

  const sync = async (silent = false) => {
    setSyncing(true);
    try {
      const res = (await syncFn()) as { accounts: Account[] };
      setAccounts(res.accounts ?? []);
      onConnectionsChanged?.();
      if (!silent) toast.success("Accounts refreshed");
    } catch (e) {
      if (!silent) toast.error(resolvePublishingError(e).message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    load();
    if (autoSync) sync(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async (platform?: PublishingPlatform) => {
    setConnecting(true);
    try {
      const res = (await connectFn({
        data: platform ? { platforms: [platform] } : {},
      })) as { accessUrl: string };
      const popup = window.open(res.accessUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        toast.error("Popup blocked — allow popups and retry");
        return;
      }
      toast.info("Finish connecting in the new tab, then return here.");
      // Poll for the popup closing, then sync.
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          sync();
        }
      }, 1500);
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    } finally {
      setConnecting(false);
    }
  };

  const openSelector = async (platform: SelectorPlatform) => {
    setSelectorFor(platform);
    setSelectorOptions([]);
    setSelectorLoading(true);
    try {
      const res = (await fetchSelFn({ data: { platform } })) as {
        options: { id: string; name: string }[];
      };
      setSelectorOptions(res.options ?? []);
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    } finally {
      setSelectorLoading(false);
    }
  };

  const chooseSelector = async (id: string, name: string) => {
    if (!selectorFor) return;
    setSavingSelector(id);
    try {
      await setSelFn({ data: { platform: selectorFor, id, name } });
      toast.success(`${PLATFORM_META[selectorFor].label} destination saved`);
      setSelectorFor(null);
      await load();
      onConnectionsChanged?.();
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    } finally {
      setSavingSelector(null);
    }
  };

  const selectorSummary = (a: Account | undefined): string | null => {
    if (!a) return null;
    if (a.platform === "facebook")
      return a.facebook_page_name ? `Page: ${a.facebook_page_name}` : null;
    if (a.platform === "pinterest")
      return a.pinterest_default_board_name ? `Board: ${a.pinterest_default_board_name}` : null;
    if (a.platform === "linkedin")
      return a.linkedin_org_name ? `Org: ${a.linkedin_org_name}` : null;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading accounts…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Connected Accounts</h2>
          <p className="text-sm text-muted-foreground">
            We never store your passwords or tokens — connections live securely with our publishing
            provider.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => sync()} disabled={syncing}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => connect()} disabled={connecting}>
            {connecting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Connect More
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-ig">
        {PUBLISHING_PLATFORMS.map((p, i) => {
          const a = byPlatform(p);
          const connected = !!a?.is_connected;
          const meta = PLATFORM_META[p];
          const caps = PLATFORM_CAPABILITY_MATRIX[p];
          const summary = selectorSummary(a);
          const needsSelector = connected && caps.requiresSelector && !summary;
          return (
            <div
              key={p}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="text-xl leading-none">{meta.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{meta.label}</span>
                  {connected ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-success" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Not connected
                    </Badge>
                  )}
                  {needsSelector && (
                    <Badge variant="destructive" className="text-[10px]">
                      Action needed
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {connected
                    ? (summary ?? a?.profile_display_name ?? "Connected")
                    : "Link this account to publish to it"}
                </p>
              </div>
              {connected && caps.requiresSelector ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSelector(p as SelectorPlatform)}
                >
                  {summary ? "Change" : "Choose"} {p === "pinterest" ? "Board" : "Page"}
                </Button>
              ) : connected ? (
                <Button variant="ghost" size="sm" onClick={() => connect(p)}>
                  Manage
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => connect(p)}
                  disabled={connecting}
                >
                  Connect
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectorFor} onOpenChange={(o) => !o && setSelectorFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Choose a{" "}
              {selectorFor === "pinterest"
                ? "board"
                : selectorFor === "linkedin"
                  ? "organization"
                  : "page"}
            </DialogTitle>
            <DialogDescription>
              Pick where {selectorFor && PLATFORM_META[selectorFor].label} posts should be
              published.
            </DialogDescription>
          </DialogHeader>
          {selectorLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : selectorOptions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing found. Make sure the account is fully connected with the right permissions.
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectorFor && connect(selectorFor)}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Reconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {selectorOptions.map((o) => (
                <button
                  key={o.id}
                  onClick={() => chooseSelector(o.id, o.name)}
                  disabled={!!savingSelector}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition hover:bg-accent"
                >
                  <span className="truncate">{o.name}</span>
                  {savingSelector === o.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 opacity-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
