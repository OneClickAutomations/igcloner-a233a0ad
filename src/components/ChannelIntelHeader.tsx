import { ExternalLink, Play, BadgeCheck, Link as LinkIcon, TrendingUp, Image as ImageIcon } from "lucide-react";
import { proxiedImg } from "@/lib/img-proxy";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}

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
  const followers = owner.followersCount ?? scraped?.followersCount ?? null;
  const posts = owner.mediaCount ?? scraped?.postsCount ?? null;
  const following = owner.followingCount ?? scraped?.followingCount ?? null;
  const likes = scraped?.likesCount ?? null;
  const comments = scraped?.commentsCount ?? null;
  const views = scraped?.videoViewCount ?? scraped?.videoPlayCount ?? null;
  const verified = owner.verified ?? false;
  const thumb = proxiedImg(scraped?.displayUrl || scraped?.thumbnailUrl || null);
  const externalUrl = owner.externalUrl || scraped?.externalUrl || null;
  const category = owner.businessCategoryName || dna?.contentCategory || null;
  const isPrivate = owner.isPrivate ?? false;

  const engagementRate =
    followers && followers > 0 && likes != null && comments != null
      ? (((likes + comments) / followers) * 100).toFixed(2) + "%"
      : null;

  const intel = dna?.channelIntelligence || {};
  const dataQuality = scraped ? "Full data" : "Estimated";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-ig">
      <div className="h-1 gradient-accent" />
      <div className="grid gap-5 p-5 md:grid-cols-[180px_1fr]">
        {/* Media preview — Instagram 4:5 portrait, gradient ring */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block aspect-[4/5] w-full max-w-[180px] overflow-hidden rounded-xl p-[2px] gradient-accent shadow-ig transition-transform hover:-translate-y-0.5 hover:shadow-ig-hover"
        >
          <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-card">
            {thumb ? (
              <img
                src={thumb}
                alt={`@${username} post`}
                loading="lazy"
                referrerPolicy="no-referrer"
               
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gradient-card text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-50" />
                <span className="mt-1 text-[11px] font-medium uppercase tracking-wider">No preview</span>
              </div>
            )}
            {/* Bottom gradient scrim for legibility */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
            {scraped?.videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur transition-transform group-hover:scale-110">
                  <Play className="h-5 w-5 text-accent-secondary" fill="currentColor" />
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white">
              <span className="truncate">@{username}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 backdrop-blur opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="h-3 w-3" /> Open
              </span>
            </div>
          </div>
        </a>

        {/* Intelligence */}
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold gradient-text">@{username}</span>
            {verified && <BadgeCheck className="h-4 w-4 text-accent-secondary" fill="currentColor" />}
            {category && (
              <span className="rounded-full bg-accent-primary/10 px-2.5 py-0.5 text-xs font-semibold text-accent-primary">{category}</span>
            )}
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {isPrivate ? "Private" : "Public"} · {dataQuality}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Followers" value={fmt(followers)} />
            <Metric label="Posts" value={fmt(posts)} />
            <Metric label="Avg views" value={intel.estimatedMonthlyViews || (views ? fmt(views) : "—")} />
            <Metric label="Following" value={fmt(following)} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {intel.isLikelyMonetized && intel.estimatedMonthlyRevenue && (
              <Badge tone="success">✦ Monetized — Est. {intel.estimatedMonthlyRevenue}/mo</Badge>
            )}
            {externalUrl && (
              <Badge tone="brand"><LinkIcon className="mr-1 inline h-3 w-3" /> Link in bio</Badge>
            )}
            {intel.postingFrequency && <Badge>📅 {intel.postingFrequency}</Badge>}
            {intel.audienceLanguage && <Badge>🌍 {intel.audienceLanguage}</Badge>}
            {intel.primaryNiche && intel.primaryNiche !== category && (
              <Badge tone="brand">💎 {intel.primaryNiche}</Badge>
            )}
          </div>

          {(likes != null || comments != null || views != null) && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs sm:grid-cols-4">
              <Stat label="Likes" value={fmt(likes)} />
              <Stat label="Comments" value={fmt(comments)} />
              {views != null && <Stat label="Views" value={fmt(views)} />}
              {engagementRate && <Stat label="Engagement" value={engagementRate} icon={<TrendingUp className="h-3 w-3" />} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-bold gradient-text leading-tight">{value}</div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1 font-semibold text-foreground">{icon}{value}</span>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "success" | "brand" }) {
  const cls =
    tone === "success"
      ? "bg-status-success/10 text-status-success border-status-success/20"
      : tone === "brand"
      ? "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/25"
      : "bg-muted text-text-secondary border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}