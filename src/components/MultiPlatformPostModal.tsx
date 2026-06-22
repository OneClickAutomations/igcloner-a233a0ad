import { Copy, ExternalLink, Download, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PLATFORM_VOICE_PROFILES, type SocialPlatform } from "@/lib/platform-voice";
import type { PlatformCopyResult } from "@/lib/platform-copy.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  platforms: SocialPlatform[];
  copyByPlatform: Record<string, PlatformCopyResult | undefined>;
  onDownloadImage?: () => void;
  downloading?: boolean;
};

export function MultiPlatformPostModal({
  open,
  onOpenChange,
  platforms,
  copyByPlatform,
  onDownloadImage,
  downloading,
}: Props) {
  const copy = (text: string, label: string) => {
    if (!text) {
      toast.error("Nothing to copy yet");
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-accent-primary" /> Ready to Post
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Posting to {platforms.length} platform{platforms.length === 1 ? "" : "s"} ·{" "}
          {platforms.map((p) => PLATFORM_VOICE_PROFILES[p].platform).join(" · ")}
        </p>

        <div className="space-y-2">
          {platforms.map((p) => {
            const profile = PLATFORM_VOICE_PROFILES[p];
            const result = copyByPlatform[p];
            const tagStr = result
              ? result.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")
              : "";
            const full = result ? `${result.caption}${tagStr ? `\n\n${tagStr}` : ""}` : "";
            return (
              <div
                key={p}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {profile.icon}
                    </span>
                    <span className="text-sm font-semibold">{profile.platform}</span>
                    {result ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {result.characterCount} chars
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600">
                        not generated
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => copy(full, `${profile.platform} copy ready`)}
                      disabled={!result}
                    >
                      <Copy className="h-3 w-3" /> Copy post
                    </Button>
                    {result && result.hashtags.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px]"
                        onClick={() => copy(tagStr, "Hashtags copied")}
                      >
                        <Copy className="h-3 w-3" /> Tags
                      </Button>
                    )}
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                    >
                      <a href={profile.composerUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                    </Button>
                  </div>
                </div>
                {result && (
                  <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {result.caption}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {onDownloadImage && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onDownloadImage}
            disabled={downloading}
          >
            <Download className="h-4 w-4" /> Download Branded Image
          </Button>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-primary" />
          <span>
            <strong className="text-foreground">Coming soon:</strong> simultaneous auto-posting to
            all selected platforms via Upload-Post API. For now, copy &amp; paste into each platform.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}