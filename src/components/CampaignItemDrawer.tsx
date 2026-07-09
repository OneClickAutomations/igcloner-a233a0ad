import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Wand2, Loader2, Film, Layers, Image as ImageIcon, Mic, Send,
  Calendar as CalendarIcon, Sparkles, Trash2, Save,
} from "lucide-react";
import { updateCalendarItem, deleteCalendarItem } from "@/lib/analyze.functions";
import { directContent } from "@/lib/campaigns.functions";

export type CampaignItem = {
  id: string;
  scheduled_for: string;
  post_type: string | null;
  title: string | null;
  hook: string | null;
  caption: string | null;
  visual_idea: string | null;
  objective: string | null;
  audience: string | null;
  cta: string | null;
  platforms: string[] | null;
  priority: string | null;
  ai_notes: string | null;
  confidence: number | null;
  hashtags: string[] | null;
  status: string;
};

const VARIANTS: { key: string; label: string }[] = [
  { key: "rewrite", label: "Rewrite" },
  { key: "more_viral", label: "More viral" },
  { key: "more_professional", label: "More pro" },
  { key: "more_emotional", label: "More emotional" },
  { key: "more_educational", label: "More educational" },
  { key: "luxury", label: "Luxury" },
  { key: "shorter", label: "Shorter" },
  { key: "longer", label: "Longer" },
];

export function CampaignItemDrawer({
  item, open, onOpenChange, onChanged,
}: {
  item: CampaignItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const updateFn = useServerFn(updateCalendarItem);
  const deleteFn = useServerFn(deleteCalendarItem);
  const directFn = useServerFn(directContent);

  const [draft, setDraft] = useState<Partial<CampaignItem>>({});
  const [saving, setSaving] = useState(false);
  const [directing, setDirecting] = useState<string | null>(null);

  const current: any = { ...(item ?? {}), ...draft };

  const patch = (p: Partial<CampaignItem>) => setDraft((d) => ({ ...d, ...p }));

  const save = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: item.id,
          hook: current.hook ?? undefined,
          caption: current.caption ?? undefined,
          visual_idea: current.visual_idea ?? undefined,
          scheduled_for: current.scheduled_for ?? undefined,
          status: current.status ?? undefined,
        },
      });
      toast.success("Saved");
      setDraft({});
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item || !confirm("Delete this day?")) return;
    try {
      await deleteFn({ data: { id: item.id } });
      toast.success("Deleted");
      onOpenChange(false);
      onChanged();
    } catch {
      toast.error("Delete failed");
    }
  };

  const direct = async (variant: string) => {
    if (!item) return;
    setDirecting(variant);
    try {
      const { item: updated } = await directFn({ data: { item_id: item.id, variant: variant as any } });
      setDraft({
        hook: updated.hook,
        caption: updated.caption,
        title: (updated as any).title,
        cta: updated.cta,
        hashtags: updated.hashtags,
        ai_notes: (updated as any).ai_notes,
      });
      toast.success("Rewritten");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Direction failed");
    } finally {
      setDirecting(null);
    }
  };

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{current.post_type || "Post"}</Badge>
            {current.priority === "high" && <Badge className="bg-status-warning/15 text-status-warning border-status-warning/30">High priority</Badge>}
            {typeof current.confidence === "number" && current.confidence > 0 && (
              <span className="text-xs text-muted-foreground">Confidence {Math.round(current.confidence)}/100</span>
            )}
          </div>
          <SheetTitle className="text-left">{current.title || current.hook || "Untitled"}</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-left">
            <CalendarIcon className="h-3.5 w-3.5" />
            {new Date(current.scheduled_for + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* AI Director bar */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5" /> AI Content Director
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VARIANTS.map((v) => (
                <Button
                  key={v.key}
                  size="sm"
                  variant="outline"
                  disabled={directing !== null}
                  onClick={() => direct(v.key)}
                  className="h-7 text-xs"
                >
                  {directing === v.key ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                  {v.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Produce actions — link into existing Studio */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Produce</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link to="/studio/reel" className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-xs hover:border-accent-primary hover:bg-accent-primary/5">
                <Film className="h-4 w-4" /> Reel
              </Link>
              <Link to="/studio/carousel" className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-xs hover:border-accent-primary hover:bg-accent-primary/5">
                <Layers className="h-4 w-4" /> Carousel
              </Link>
              <Link to="/studio/image" className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-xs hover:border-accent-primary hover:bg-accent-primary/5">
                <ImageIcon className="h-4 w-4" /> Image
              </Link>
              <Link to="/studio/voiceover" className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-xs hover:border-accent-primary hover:bg-accent-primary/5">
                <Mic className="h-4 w-4" /> Voice
              </Link>
            </div>
            <Link to="/publishing" className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border p-2 text-xs font-medium hover:border-accent-secondary hover:bg-accent-secondary/5">
              <Send className="h-4 w-4" /> Publish to platforms
            </Link>
          </div>

          <Separator />

          {/* Editable fields */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Hook</Label>
              <Textarea value={current.hook ?? ""} onChange={(e) => patch({ hook: e.target.value })} className="mt-1 min-h-[60px]" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Caption</Label>
              <Textarea value={current.caption ?? ""} onChange={(e) => patch({ caption: e.target.value })} className="mt-1 min-h-[120px]" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Visual idea</Label>
              <Textarea value={current.visual_idea ?? ""} onChange={(e) => patch({ visual_idea: e.target.value })} className="mt-1 min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Objective</Label>
                <div className="mt-1 text-sm">{current.objective || "—"}</div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Audience</Label>
                <div className="mt-1 text-sm">{current.audience || "—"}</div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">CTA</Label>
                <div className="mt-1 text-sm">{current.cta || "—"}</div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Platforms</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(current.platforms ?? []).map((p: string) => (
                    <Badge key={p} variant="secondary" className="capitalize text-[10px]">{p}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {(current.hashtags ?? []).length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Hashtags</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {current.hashtags!.map((h: string) => (
                    <Badge key={h} variant="outline" className="text-[10px]">#{h.replace(/^#/, "")}</Badge>
                  ))}
                </div>
              </div>
            )}

            {current.ai_notes && (
              <div className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                <span className="font-semibold">Director's note:</span> {current.ai_notes}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Reschedule</Label>
                <Input
                  type="date"
                  value={current.scheduled_for}
                  onChange={(e) => patch({ scheduled_for: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Status</Label>
                <select
                  value={current.status}
                  onChange={(e) => patch({ status: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                >
                  <option value="planned">Planned</option>
                  <option value="drafted">Drafted</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="posted">Posted</option>
                </select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={remove} className="text-status-error hover:bg-status-error/10">
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}