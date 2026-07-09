import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  UserPlus,
  Upload,
  Instagram,
  Music2,
  Mic,
  Film,
  Send,
  Loader2,
} from "lucide-react";
import { getApiKeys, getUsage } from "@/lib/settings.functions";
import { listAccounts } from "@/lib/upload-post.functions";

type Item = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  action?: () => void;
};

export function LaunchChecklist() {
  const navigate = useNavigate();
  const keysFn = useServerFn(getApiKeys);
  const usageFn = useServerFn(getUsage);
  const accountsFn = useServerFn(listAccounts);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [keysRes, usageRes, accountsRes] = await Promise.all([
        keysFn().catch(() => ({ keys: [] as any[] })),
        usageFn().catch(() => ({ publishingJobs: 0, projects: 0 } as any)),
        accountsFn().catch(() => ({ accounts: [] as any[] })),
      ]);
      if (cancelled) return;

      const keys: any[] = (keysRes as any).keys ?? [];
      const accounts: any[] = (accountsRes as any).accounts ?? [];
      const hasKey = (p: string) =>
        keys.some((k) => k.provider === p && k.status !== "invalid");
      const hasPlatform = (p: string) =>
        accounts.some((a) => a.platform === p && a.is_connected);

      const goSettings = (section: string) =>
        navigate({ to: "/settings", search: { section } as any });

      const next: Item[] = [
        {
          key: "account",
          label: "Create Account",
          icon: UserPlus,
          done: true,
        },
        {
          key: "upload_post",
          label: "Connect Upload-Post",
          icon: Upload,
          done: hasKey("upload_post"),
          action: () => goSettings("api-keys"),
        },
        {
          key: "instagram",
          label: "Connect Instagram",
          icon: Instagram,
          done: hasPlatform("instagram"),
          action: () => goSettings("social-accounts"),
        },
        {
          key: "tiktok",
          label: "Connect TikTok",
          icon: Music2,
          done: hasPlatform("tiktok"),
          action: () => goSettings("social-accounts"),
        },
        {
          key: "elevenlabs",
          label: "Add ElevenLabs Key",
          icon: Mic,
          done: hasKey("elevenlabs"),
          action: () => goSettings("api-keys"),
        },
        {
          key: "first_reel",
          label: "Generate First Reel",
          icon: Film,
          done: ((usageRes as any).projects ?? 0) > 0,
          action: () => navigate({ to: "/studio/reel" as any }),
        },
        {
          key: "first_post",
          label: "Publish First Post",
          icon: Send,
          done: ((usageRes as any).publishingJobs ?? 0) > 0,
          action: () => navigate({ to: "/publishing" as any }),
        },
      ];

      setItems(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const allDone = completed === total && total > 0;

  if (loading) {
    return (
      <div className="mb-8 rounded-2xl border border-border bg-card/60 p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading launch checklist…
      </div>
    );
  }

  if (allDone) return null;

  return (
    <section className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-card to-card/40 p-6 shadow-sm">
      <header className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-bold tracking-tight">Launch Checklist</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Finish setup to unlock the full IGCloner workflow.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold tabular-nums">
            {completed}/{total}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            complete
          </div>
        </div>
      </header>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-5">
        <div
          className="h-full bg-accent-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(({ key, label, icon: Icon, done, action }) => (
          <li key={key}>
            <button
              type="button"
              disabled={!action}
              onClick={action}
              className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                done
                  ? "border-border/50 bg-muted/30"
                  : "border-border bg-background hover:border-accent-primary/40 hover:bg-accent-primary/5"
              } ${action ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  done
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-accent-primary/10 text-accent-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={`flex-1 text-sm font-medium ${
                  done ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {label}
              </span>
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}