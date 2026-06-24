import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, CalendarClock, Lock, Plus, X, ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { listAccounts } from "@/lib/upload-post.functions";
import { publishContent } from "@/lib/publishing.functions";
import { listProjects } from "@/lib/projects.functions";
import {
  PUBLISHING_PLATFORMS,
  PLATFORM_META,
  PLATFORM_CAPABILITY_MATRIX,
  platformIncompatibilityReason,
  resolvePublishingError,
  type ContentType,
  type PublishingPlatform,
} from "@/lib/upload-post/shared";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "carousel", label: "Carousel" },
  { value: "video", label: "Video" },
  { value: "reel", label: "Reel" },
];

interface Account {
  platform: string;
  is_connected: boolean;
  facebook_page_name: string | null;
  pinterest_default_board_name: string | null;
}

export function PublishTab({
  initialProjectId,
  onPublished,
}: {
  initialProjectId?: string;
  onPublished?: () => void;
}) {
  const listAccountsFn = useServerFn(listAccounts);
  const listProjectsFn = useServerFn(listProjects);
  const publishFn = useServerFn(publishContent);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [selected, setSelected] = useState<Set<PublishingPlatform>>(new Set());
  const [title, setTitle] = useState("");
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");
  const [activePreview, setActivePreview] = useState<string>("");
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [submitting, setSubmitting] = useState<"publish" | "draft" | null>(null);

  const isConnected = (p: string) => accounts.find((a) => a.platform === p)?.is_connected;

  useEffect(() => {
    listAccountsFn()
      .then((r: any) => setAccounts(r.accounts ?? []))
      .catch(() => {});
    listProjectsFn()
      .then((r: any) => setProjects(r.projects ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialProjectId && projects.length) {
      const p = projects.find((x) => x.id === initialProjectId);
      if (p) seedFromProject(p);
    }
  }, [initialProjectId, projects]);

  const seedFromProject = (p: any) => {
    setTitle(p.title ?? "");
    if (p.latest_asset_url) setMediaUrls([p.latest_asset_url]);
    if (p.format === "reel") setContentType("reel");
    else if (p.format === "carousel") setContentType("carousel");
    else if (p.format === "image") setContentType("image");
    else if (p.format === "caption") setContentType("text");
  };

  // Auto-select the first compatible preview tab.
  const selectedList = useMemo(() => [...selected], [selected]);
  useEffect(() => {
    if (selectedList.length && !selected.has(activePreview as PublishingPlatform)) {
      setActivePreview(selectedList[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedList.length]);

  const togglePlatform = (p: PublishingPlatform) => {
    const reason = platformIncompatibilityReason(p, contentType);
    if (reason || !isConnected(p)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  // Drop now-incompatible platforms when content type changes.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<PublishingPlatform>();
      for (const p of prev) if (!platformIncompatibilityReason(p, contentType)) next.add(p);
      return next;
    });
  }, [contentType]);

  const addMedia = () => {
    const u = mediaInput.trim();
    if (!u) return;
    try {
      new URL(u);
    } catch {
      toast.error("Enter a valid URL");
      return;
    }
    setMediaUrls((m) => [...m, u]);
    setMediaInput("");
  };

  const setCaption = (platform: string, value: string) =>
    setCaptions((c) => ({ ...c, [platform]: value }));

  const validate = (draft: boolean): string | null => {
    if (selected.size === 0) return "Select at least one platform";
    if (contentType !== "text" && mediaUrls.length === 0 && !draft)
      return "Add at least one media URL for this content type";
    if (scheduleOn && !scheduleAt && !draft) return "Pick a date and time to schedule";
    return null;
  };

  const submit = async (draft: boolean) => {
    const err = validate(draft);
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(draft ? "draft" : "publish");
    try {
      const scheduledAt =
        !draft && scheduleOn && scheduleAt ? new Date(scheduleAt).toISOString() : null;
      const captionPerPlatform: Record<string, string> = {};
      for (const p of selected) captionPerPlatform[p] = captions[p] ?? captions["_all"] ?? "";

      const res = (await publishFn({
        data: {
          contentType,
          title: title || undefined,
          captionPerPlatform,
          hashtagsPerPlatform: {},
          mediaUrls,
          platforms: [...selected],
          scheduledAt,
          projectId: initialProjectId ?? null,
          saveAsDraft: draft,
        },
      })) as { status: string };

      if (draft) toast.success("Saved to drafts");
      else if (res.status === "scheduled") toast.success("Scheduled");
      else toast.success("Publishing started");

      // Reset transient state but keep platform/content selection.
      setCaptions({});
      onPublished?.();
    } catch (e) {
      const { title: t, message } = resolvePublishingError(e);
      toast.error(`${t}: ${message}`);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Content source */}
      <section>
        <Label>Content</Label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
            value={initialProjectId ?? ""}
            onChange={(e) => {
              const p = projects.find((x) => x.id === e.target.value);
              if (p) seedFromProject(p);
            }}
          >
            <option value="">Select from Projects…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setContentType(ct.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  contentType === ct.value
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-accent"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Media */}
      {contentType !== "text" && (
        <section>
          <Label>Media URLs</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://… (image or video URL)"
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMedia();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addMedia}>
              <ImagePlus className="mr-1.5 h-4 w-4" /> Add
            </Button>
          </div>
          {mediaUrls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {mediaUrls.map((u, i) => (
                <span
                  key={i}
                  className="inline-flex max-w-xs items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                >
                  <span className="truncate">{u.split("/").pop()}</span>
                  <button onClick={() => setMediaUrls((m) => m.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Platforms */}
      <section>
        <Label>Platforms</Label>
        <div className="flex flex-wrap gap-2">
          {PUBLISHING_PLATFORMS.map((p) => {
            const meta = PLATFORM_META[p];
            const reason = platformIncompatibilityReason(p, contentType);
            const connected = isConnected(p);
            const disabled = !!reason || !connected;
            const why = reason ?? (!connected ? `${meta.label} is not connected` : "");
            const isSel = selected.has(p);
            const chip = (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                disabled={disabled}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  isSel
                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                    : disabled
                      ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/60"
                      : "border-border bg-card hover:bg-accent"
                }`}
              >
                <span>{meta.emoji}</span>
                {meta.label}
                {disabled && <Lock className="h-3 w-3" />}
              </button>
            );
            return disabled && why ? (
              <Tooltip key={p}>
                <TooltipTrigger asChild>{chip}</TooltipTrigger>
                <TooltipContent>{why}</TooltipContent>
              </Tooltip>
            ) : (
              chip
            );
          })}
        </div>
      </section>

      {/* Per-platform captions */}
      {selected.size > 0 && (
        <section>
          <Label>Captions</Label>
          <Tabs value={activePreview} onValueChange={setActivePreview}>
            <TabsList className="flex-wrap">
              {selectedList.map((p) => (
                <TabsTrigger key={p} value={p}>
                  {PLATFORM_META[p as PublishingPlatform].emoji}{" "}
                  {PLATFORM_META[p as PublishingPlatform].label}
                </TabsTrigger>
              ))}
            </TabsList>
            {selectedList.map((p) => {
              const max = PLATFORM_CAPABILITY_MATRIX[p as PublishingPlatform].maxCaptionChars;
              const val = captions[p] ?? "";
              return (
                <TabsContent key={p} value={p} className="mt-3">
                  <Textarea
                    rows={5}
                    placeholder={`Write the ${PLATFORM_META[p as PublishingPlatform].label} caption…`}
                    value={val}
                    onChange={(e) => setCaption(p, e.target.value)}
                  />
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {val.length}
                      {max ? ` / ${max}` : ""} characters
                    </span>
                    {max && val.length > max && (
                      <span className="text-status-error">Will be trimmed to {max}</span>
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </section>
      )}

      {/* When */}
      <section>
        <Label>When</Label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!scheduleOn} onChange={() => setScheduleOn(false)} />
            Publish now
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={scheduleOn} onChange={() => setScheduleOn(true)} />
            Schedule
          </label>
          {scheduleOn && (
            <Input
              type="datetime-local"
              className="w-auto"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button onClick={() => submit(false)} disabled={!!submitting}>
          {submitting === "publish" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : scheduleOn ? (
            <CalendarClock className="mr-1.5 h-4 w-4" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {scheduleOn ? "Schedule" : "Publish Now"}
        </Button>
        <Button variant="outline" onClick={() => submit(true)} disabled={!!submitting}>
          {submitting === "draft" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Save Draft
        </Button>
        {selected.size > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {selected.size} platform{selected.size > 1 ? "s" : ""} selected
          </Badge>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.10em] text-accent-primary">
      {children}
    </p>
  );
}
