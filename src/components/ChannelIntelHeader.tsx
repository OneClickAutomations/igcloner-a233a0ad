import {
  ExternalLink,
  Play,
  BadgeCheck,
  Link as LinkIcon,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  DollarSign,
  Hash,
  AtSign,
  Music2,
  MapPin,
  ZoomIn,
} from "lucide-react";
import { useState } from "react";
import { proxiedImg } from "@/lib/img-proxy";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/* ---------- helpers ---------- */

function isMissing(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "number") return !isFinite(v) || v < 0;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "" || t === "unknown" || t === "n/a" || t === "null";
  }
  return false;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return n.toLocaleString();
}

function formatRelativeDate(timestamp: string): string {
  const t = Date.parse(timestamp);
  if (!isFinite(t)) return "—";
  const diff = Date.now() - t;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dataConfidence(scraped: any): { level: "full" | "partial" | "limited"; label: string; tone: string } {
  if (!scraped) return { level: "limited", label: "Limited data — URL only", tone: "bg-status-error/10 text-status-error border-status-error/25" };
  const fields = [
    !isMissing(scraped?.owner?.followersCount),
    !isMissing(scraped?.likesCount),
    !isMissing(scraped?.caption),
    !isMissing(scraped?.displayUrl || scraped?.thumbnailUrl),
  ].filter(Boolean).length;
  if (fields === 4) return { level: "full", label: "Full data", tone: "bg-status-success/10 text-status-success border-status-success/25" };
  if (fields >= 2) return { level: "partial", label: "Partial data", tone: "bg-status-warning/10 text-status-warning border-status-warning/25" };
  return { level: "limited", label: "Limited data", tone: "bg-status-error/10 text-status-error border-status-error/25" };
}

/* ---------- UI primitives ---------- */

function MetricCell({
  label,
  value,
  source,
  tooltip,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  source?: "calc" | "est" | "scrape";
  tooltip?: string;
  highlight?: boolean;
}) {
  return (
    <div
      title={tooltip}
      className={`rounded-xl border p-3 ${highlight ? "border-accent-primary/40 bg-accent-primary/5" : "border-border bg-muted/30"}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {source === "calc" && (
          <span className="rounded bg-muted px-1 py-px text-[9px] font-semibold uppercase text-muted-foreground">calc</span>
        )}
        {source === "est" && (
          <span className="rounded bg-accent-secondary/15 px-1 py-px text-[9px] font-semibold uppercase text-accent-secondary">est</span>
        )}
      </div>
      <div className="mt-1 truncate text-base font-bold leading-tight text-foreground">{value}</div>
    </div>
  );
}

function Dash({ tooltip = "Not available from public data" }: { tooltip?: string }) {
  return (
    <span title={tooltip} className="text-muted-foreground/70">
      —
    </span>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "brand" | "warning";
}) {
  const cls =
    tone === "success"
      ? "bg-status-success/10 text-status-success border-status-success/25"
      : tone === "brand"
        ? "bg-accent-primary/10 text-accent-primary border-accent-primary/25"
        : tone === "warning"
          ? "bg-status-warning/10 text-status-warning border-status-warning/25"
          : "bg-muted text-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

/* ---------- main ---------- */

export function ChannelIntelHeader({
  scraped,
  dna,
  url,
}: {
  scraped: any;
  dna: any;
  url: string;
}) {
  const owner = scraped?.owner ?? {};
  const username = scraped?.ownerUsername || owner.username || dna?.sourceAccount || "unknown";
  const followers = owner.followersCount ?? null;
  const posts = owner.mediaCount ?? null;
  const following = owner.followingCount ?? null;
  const likes = scraped?.likesCount ?? null;
  const comments = scraped?.commentsCount ?? null;
  const views = scraped?.videoViewCount ?? scraped?.videoPlayCount ?? null;
  const verified = !!owner.verified;
  const thumb = proxiedImg(scraped?.displayUrl || scraped?.thumbnailUrl || null);
  const externalUrl = owner.externalUrl || null;
  const category = owner.businessCategoryName || null;
  const isPrivate = !!owner.isPrivate;
  const fullName = owner.fullName || null;
  const biography = owner.biography || null;
  const accountType = owner.isBusinessAccount
    ? "Business"
    : (owner as any).isProfessionalAccount
      ? "Creator"
      : "Personal";

  const postType: string = (dna?.postType || scraped?.type || "Post") as string;
  const isReel = /reel|video/i.test(postType) || !!scraped?.videoUrl;
  const isCarousel = /carousel|sidecar/i.test(postType) || (Array.isArray(scraped?.childPosts) && scraped.childPosts.length > 1);

  const hashtags: string[] = Array.isArray(scraped?.hashtags) ? scraped.hashtags : [];
  const mentions: string[] = Array.isArray(scraped?.mentions) ? scraped.mentions : [];
  const caption: string | null = scraped?.caption ?? null;
  const timestamp: string | null = scraped?.timestamp ?? null;
  const isSponsored = !!scraped?.isSponsored;
  const locationName: string | null = scraped?.locationName ?? null;

  const music = scraped?.musicInfo ?? null;
  const audioLabel = (() => {
    if (!isReel) return null;
    if (scraped?.isOriginalAudio) return `Original audio by @${username}`;
    const song = music?.songName || music?.name;
    const artist = music?.artistName;
    if (song && artist) return `${music?.isTrending ? "🔥 Trending: " : ""}"${song}" by ${artist}`;
    if (song) return `"${song}"`;
    return null;
  })();

  const carouselSlides: any[] = Array.isArray(scraped?.childPosts) ? scraped.childPosts : [];

  // Calculated metrics (clearly marked)
  const engagementRate =
    !isMissing(likes) && !isMissing(comments) && !isMissing(followers) && followers > 0
      ? (((likes + comments) / followers) * 100).toFixed(2) + "%"
      : null;
  const viewToFollower =
    !isMissing(views) && !isMissing(followers) && followers > 0
      ? ((views / followers) * 100).toFixed(1) + "%"
      : null;
  const likeToView =
    !isMissing(likes) && !isMissing(views) && views > 0
      ? ((likes / views) * 100).toFixed(1) + "%"
      : null;

  const intel = (dna?.channelIntelligence ?? {}) as any;
  const confidence = dataConfidence(scraped);

  const [captionOpen, setCaptionOpen] = useState(false);
  const captionShort = caption && caption.length > 240 ? caption.slice(0, 240) + "…" : caption;
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-ig">
      <div className="h-1 gradient-accent" />

      {/* HEADER: thumbnail + identity */}
      <div className="grid gap-5 p-5 md:grid-cols-[180px_1fr]">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block aspect-[4/5] w-full max-w-[180px] overflow-hidden rounded-xl p-[2px] gradient-accent shadow-ig transition-transform hover:-translate-y-0.5"
        >
          <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-card">
            {thumb ? (
              <img
                src={thumb}
                alt={`@${username} post`}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gradient-card text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-50" />
                <span className="mt-1 text-[11px] uppercase tracking-wider">No preview</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
            {thumb && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setZoomSrc(thumb);
                }}
                aria-label="Enlarge image"
                title="Enlarge image"
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur transition hover:bg-black/75 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/70"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            )}
            {isReel && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur transition-transform group-hover:scale-110">
                  <Play className="h-5 w-5 text-accent-secondary" fill="currentColor" />
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white">
              <span className="truncate">@{username}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 backdrop-blur opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="h-3 w-3" /> Open
              </span>
            </div>
          </div>
        </a>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold gradient-text">@{username}</span>
            {verified && <BadgeCheck className="h-4 w-4 text-accent-secondary" fill="currentColor" />}
            <Pill tone="brand">{isPrivate ? "Private" : "Public"}</Pill>
            <span title={`Data quality: ${confidence.label}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${confidence.tone}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {confidence.label}
            </span>
            {isSponsored && <Pill tone="warning">💰 Paid Partnership</Pill>}
          </div>
          {fullName && <div className="text-sm font-semibold text-foreground">{fullName}</div>}
          {category && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Category: <span className="text-foreground">{category}</span>
            </div>
          )}
          {biography && (
            <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">"{biography}"</div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {externalUrl ? (
              <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="truncate text-accent-primary hover:underline">
                {externalUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="text-muted-foreground">No link in bio</span>
            )}
          </div>
        </div>
      </div>

      {confidence.level === "limited" && (
        <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-xs text-status-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Limited data mode — most metrics unavailable without a successful Apify scrape.</span>
        </div>
      )}

      {/* ACCOUNT SIZE */}
      <Section title="Account size">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCell
            label="Followers"
            tooltip="Total public followers at time of scrape."
            value={isMissing(followers) ? <Dash /> : formatNumber(followers)}
          />
          <MetricCell
            label="Total posts"
            tooltip="Total posts published on this account."
            value={isMissing(posts) ? <Dash /> : formatNumber(posts)}
          />
          <MetricCell
            label="Following"
            value={isMissing(following) ? <Dash /> : formatNumber(following)}
          />
          <MetricCell label="Account type" value={accountType} />
        </div>
      </Section>

      {/* POST PERFORMANCE */}
      <Section title="This post's performance">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCell
            label="Likes"
            value={isMissing(likes) ? <Dash /> : formatNumber(likes)}
          />
          <MetricCell
            label="Comments"
            value={isMissing(comments) ? <Dash /> : formatNumber(comments)}
          />
          <MetricCell
            label="Video views"
            tooltip={isReel ? "Total views on this Reel." : "Only available for video posts."}
            value={isMissing(views) ? <Dash tooltip={isReel ? "Not available from public data" : "Reel/video only"} /> : formatNumber(views)}
          />
          <MetricCell
            label="Eng. rate"
            source={engagementRate ? "calc" : undefined}
            tooltip="(Likes + Comments) ÷ Followers × 100. Above 3% is excellent for 1M+ accounts."
            value={engagementRate ?? <Dash />}
            highlight={!!engagementRate}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCell label="Post type" value={isReel ? "Reel" : isCarousel ? "Carousel" : "Post"} />
          <MetricCell label="Posted" value={timestamp ? formatRelativeDate(timestamp) : <Dash />} />
          <MetricCell label="Hashtags" value={`${hashtags.length} tag${hashtags.length === 1 ? "" : "s"}`} />
          <MetricCell label="Mentions" value={`${mentions.length} account${mentions.length === 1 ? "" : "s"}`} />
        </div>
      </Section>

      {/* REEL DETAILS */}
      {isReel && (
        <Section title="Reel details">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCell
              label="Duration"
              value={isMissing(scraped?.videoDuration) ? <Dash /> : `${Math.round(scraped.videoDuration)}s`}
            />
            <MetricCell
              label="View / follower"
              source={viewToFollower ? "calc" : undefined}
              tooltip="Views vs. follower count. Above 100% = the algorithm pushed it to non-followers (viral signal)."
              value={viewToFollower ?? <Dash />}
              highlight={!!viewToFollower}
            />
            <MetricCell
              label="Like / view"
              source={likeToView ? "calc" : undefined}
              tooltip="Percent of viewers who liked. Above 3% is very high for short-form video."
              value={likeToView ?? <Dash />}
            />
            <MetricCell
              label="Audio"
              value={audioLabel ? <span className="inline-flex items-center gap-1 text-sm"><Music2 className="h-3.5 w-3.5" />{audioLabel}</span> : <Dash />}
            />
          </div>
        </Section>
      )}

      {/* CAROUSEL DETAILS */}
      {isCarousel && carouselSlides.length > 0 && (
        <Section title="Carousel details">
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <MetricCell label="Slides" value={`${carouselSlides.length} slides`} />
            <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-2">
              {carouselSlides.slice(0, 10).map((s: any, i: number) => {
                const sThumb = proxiedImg(s?.displayUrl || s?.thumbnailUrl || null);
                return sThumb ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setZoomSrc(sThumb)}
                    aria-label={`Enlarge slide ${i + 1}`}
                    className="group relative h-12 w-12 overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  >
                    <img src={sThumb} alt={`Slide ${i + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <ZoomIn className="h-4 w-4 text-white" />
                    </span>
                  </button>
                ) : (
                  <div key={i} className="h-12 w-12 rounded-md bg-muted" />
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* LOCATION */}
      {locationName && (
        <Section title="Location">
          <div className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {locationName}
          </div>
        </Section>
      )}

      {/* CAPTION */}
      {caption && (
        <Section title="Caption">
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm leading-relaxed text-foreground">
            <div className="whitespace-pre-wrap break-words">{captionOpen ? caption : captionShort}</div>
            {caption.length > 240 && (
              <button
                onClick={() => setCaptionOpen((o) => !o)}
                className="mt-2 text-xs font-semibold text-accent-primary hover:underline"
              >
                {captionOpen ? "Show less" : "Show full caption"}
              </button>
            )}
          </div>
        </Section>
      )}

      {/* HASHTAGS */}
      {hashtags.length > 0 && (
        <Section title="Hashtags used">
          <div className="flex flex-wrap gap-1.5">
            {hashtags.slice(0, 12).map((h) => (
              <span key={h} className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground">
                <Hash className="h-3 w-3 text-muted-foreground" />
                {h.replace(/^#/, "")}
              </span>
            ))}
            {hashtags.length > 12 && (
              <span className="text-xs text-muted-foreground">+ {hashtags.length - 12} more</span>
            )}
          </div>
        </Section>
      )}

      {/* MENTIONS */}
      {mentions.length > 0 && (
        <Section title="Mentions">
          <div className="flex flex-wrap gap-1.5">
            {mentions.slice(0, 10).map((m) => (
              <span key={m} className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground">
                <AtSign className="h-3 w-3 text-muted-foreground" />
                {m.replace(/^@/, "")}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* AI ESTIMATES — clearly labeled */}
      {(intel.primaryNiche || intel.audienceLanguage || intel.estimatedMonthlyRevenue || intel.estimatedMonthlyViews) && (
        <Section title="AI estimates">
          <div className="rounded-xl border border-accent-secondary/30 bg-accent-secondary/5 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent-secondary">
              <Sparkles className="h-3 w-3" /> AI estimates — based on public data + niche benchmarks
            </div>
            <dl className="grid gap-1.5 text-xs sm:grid-cols-2">
              {intel.primaryNiche && <EstRow label="Niche" value={intel.primaryNiche} />}
              {intel.audienceLanguage && <EstRow label="Audience language" value={intel.audienceLanguage} />}
              {intel.audienceAgeRange && <EstRow label="Audience age" value={intel.audienceAgeRange} />}
              {intel.contentQualityLevel && <EstRow label="Content quality" value={intel.contentQualityLevel} />}
              {intel.competitorLevel && <EstRow label="Competitor level" value={intel.competitorLevel} />}
              {intel.postingFrequency && <EstRow label="Posting frequency" value={intel.postingFrequency} />}
              {intel.isLikelyMonetized && intel.estimatedMonthlyRevenue && (
                <EstRow label="Est. monthly revenue" value={<span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" />{intel.estimatedMonthlyRevenue}/mo</span>} />
              )}
              {intel.estimatedMonthlyViews && (
                <EstRow label="Est. monthly views" value={`~${intel.estimatedMonthlyViews}`} />
              )}
              {intel.audienceDemographic && (
                <div className="sm:col-span-2 mt-1 text-muted-foreground">{intel.audienceDemographic}</div>
              )}
            </dl>
            {intel.confidence && (
              <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Confidence: <span className="text-foreground">{intel.confidence}</span>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border px-5 py-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function EstRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/40 py-0.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">
        {value} <span className="text-[9px] uppercase text-accent-secondary">est</span>
      </span>
    </div>
  );
}