import { useState } from "react";
import { Copy, ExternalLink, Calendar, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caption?: string;
  hashtags?: string[];
  format: "image" | "reel" | "carousel" | "voiceover" | "caption";
};

export function PostScheduleModal({ open, onOpenChange, caption = '', hashtags = [], format }: Props) {
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");

  const tagString = (hashtags ?? []).map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  const fullText = `${caption}\n\n${tagString}`;

  const cp = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-accent-primary" />
            Post to Instagram
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 rounded-lg bg-muted p-1 text-xs font-medium">
            <button
              onClick={() => setMode("now")}
              className={`flex-1 rounded-md px-2 py-1.5 transition ${
                mode === "now" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Post Now
            </button>
            <button
              onClick={() => setMode("schedule")}
              className={`flex-1 rounded-md px-2 py-1.5 transition ${
                mode === "schedule" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Schedule for Later
            </button>
          </div>

          {mode === "schedule" && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Time</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                We'll save a reminder on your calendar. Posting directly to Instagram requires connecting a Business account.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Caption preview
            </div>
            <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-foreground/90">
              {caption}
            </p>
            {(hashtags ?? []).length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">{tagString}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => cp(caption, "Caption copied")}>
              <Copy className="h-3.5 w-3.5" /> Copy caption
            </Button>
            <Button variant="outline" size="sm" onClick={() => cp(tagString, "Hashtags copied")}>
              <Copy className="h-3.5 w-3.5" /> Copy hashtags
            </Button>
            <Button variant="default" size="sm" onClick={() => cp(fullText, "Caption + tags copied")} className="col-span-2">
              <Copy className="h-3.5 w-3.5" /> Copy caption + hashtags
            </Button>
          </div>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Open Instagram
            </p>
            <Button variant="outline" size="sm" asChild className="w-full">
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open Instagram in new tab
              </a>
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Tip: paste the caption above into your {format} post.
            </p>
          </div>

          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}