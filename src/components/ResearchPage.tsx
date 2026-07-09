import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  Search,
  Users,
  Hash,
  Loader2,
  Sparkles,
  Star,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Lightbulb,
  CalendarPlus,
} from "lucide-react";
import {
  createResearchReport,
  listResearchReports,
  getResearchReport,
  toggleSaveResearch,
  deleteResearchReport,
  generateContentIdeas,
} from "@/lib/research.functions";

const routeApi = getRouteApi("/_authenticated/research");

const NICHES = [
  "Fitness",
  "Real Estate",
  "Automotive",
  "Marketing",
  "Law",
  "Finance",
  "Beauty",
  "Travel",
  "Cooking",
  "Coaching",
  "SaaS",
  "E-commerce",
] as const;

type Report = {
  id: string;
  mode: string;
  subject: string;
  status: string;
  opportunity_score: number | null;
  is_saved?: boolean;
  error_message?: string | null;
  created_at: string | null;
};

export function ResearchPage() {
  const search = routeApi.useSearch();
  const navigate = useNavigate();

  const listFn = useServerFn(listResearchReports);
  const createFn = useServerFn(createResearchReport);
  const getFn = useServerFn(getResearchReport);
  const saveFn = useServerFn(toggleSaveResearch);
  const delFn = useServerFn(deleteResearchReport);
  const ideasFn = useServerFn(generateContentIdeas);

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<{ report: any; ideas: any[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ideasBusy, setIdeasBusy] = useState(false);

  // Form state
  const [tab, setTab] = useState<"niche" | "competitor" | "topic">("niche");
  const [niche, setNiche] = useState<string>("");
  const [competitor, setCompetitor] = useState("");
  const [topic, setTopic] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (search.reportId) openReport(search.reportId);
    else setDetail(null);
  }, [search.reportId]);

  async function refresh() {
    setLoadingList(true);
    try {
      const { reports } = await listFn();
      setReports(reports as any);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoadingList(false);
  }

  async function openReport(id: string) {
    setLoadingDetail(true);
    try {
      const res = await getFn({ data: { id } });
      setDetail(res as any);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoadingDetail(false);
  }

  async function submit() {
    const subject =
      tab === "niche" ? niche.trim() : tab === "competitor" ? competitor.trim() : topic.trim();
    if (!subject) {
      toast.error("Please enter a subject");
      return;
    }
    setCreating(true);
    try {
      const { id } = await createFn({ data: { mode: tab, subject } });
      toast.success("Research report generated");
      await refresh();
      navigate({ to: "/research", search: { reportId: id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
    setCreating(false);
  }

  async function runIdeas() {
    if (!detail?.report?.id) return;
    setIdeasBusy(true);
    try {
      const { ideas } = await ideasFn({ data: { id: detail.report.id } });
      setDetail({ ...detail, ideas });
      toast.success(`Generated ${ideas.length} content ideas`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setIdeasBusy(false);
  }

  if (search.reportId) {
    return (
      <ReportDetail
        detail={detail}
        loading={loadingDetail}
        onBack={() => navigate({ to: "/research", search: {} })}
        onSave={async () => {
          if (!detail?.report?.id) return;
          await saveFn({ data: { id: detail.report.id } });
          toast.success("Toggled saved");
          await refresh();
          await openReport(detail.report.id);
        }}
        onDelete={async () => {
          if (!detail?.report?.id) return;
          if (!confirm("Delete this research report?")) return;
          await delFn({ data: { id: detail.report.id } });
          toast.success("Deleted");
          navigate({ to: "/research", search: {} });
          refresh();
        }}
        ideasBusy={ideasBusy}
        onGenerateIdeas={runIdeas}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-accent shadow-ig">
          <Search className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Research</h1>
          <p className="text-sm text-muted-foreground">
            Discover what content your audience actually wants.
          </p>
        </div>
      </div>

      <Card className="p-4 lg:p-6 mb-8">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="niche" className="gap-2"><Hash className="h-4 w-4" />By Niche</TabsTrigger>
            <TabsTrigger value="competitor" className="gap-2"><Users className="h-4 w-4" />By Competitor</TabsTrigger>
            <TabsTrigger value="topic" className="gap-2"><Lightbulb className="h-4 w-4" />By Topic</TabsTrigger>
          </TabsList>

          <TabsContent value="niche">
            <Label className="mb-2 block">Pick or type a niche</Label>
            <div className="mb-3 flex flex-wrap gap-2">
              {NICHES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNiche(n)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    niche === n
                      ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                      : "border-border hover:border-border-default"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. Fitness Coaching" />
          </TabsContent>

          <TabsContent value="competitor">
            <Label className="mb-2 block">Instagram handle / creator / brand</Label>
            <Input
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="@alexhormozi or garyvee"
            />
          </TabsContent>

          <TabsContent value="topic">
            <Label className="mb-2 block">Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Lead generation, personal branding, weight loss…"
            />
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {creating ? "Analyzing… this can take up to a minute" : "Run Research"}
          </Button>
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent research</h2>
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loadingList ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No research yet. Run your first one above.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate({ to: "/research", search: { reportId: r.id } })}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-border-default hover:-translate-y-0.5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-md bg-accent-secondary/10 px-1.5 py-0.5 text-xs font-medium uppercase text-accent-secondary">
                  {r.mode}
                </span>
                {r.opportunity_score != null && (
                  <span className="font-mono text-sm font-bold text-accent-primary">
                    {r.opportunity_score}
                  </span>
                )}
              </div>
              <p className="mb-1 truncate text-sm font-semibold">{r.subject}</p>
              <p className="text-xs text-muted-foreground">
                {r.status === "ready" ? "Ready" : r.status === "failed" ? `Failed: ${r.error_message ?? "error"}` : r.status}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function ReportDetail({
  detail,
  loading,
  onBack,
  onSave,
  onDelete,
  onGenerateIdeas,
  ideasBusy,
}: {
  detail: { report: any; ideas: any[] } | null;
  loading: boolean;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  onGenerateIdeas: () => void;
  ideasBusy: boolean;
}) {
  if (loading || !detail) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-12 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading report…
      </div>
    );
  }
  const { report, ideas } = detail;
  const dna = report?.dna_report ?? {};

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSave} className="gap-1">
            <Star className={`h-4 w-4 ${report?.is_saved ? "fill-current text-yellow-500" : ""}`} />
            {report?.is_saved ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="gap-1 text-status-error">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{report.mode}</p>
          <h1 className="text-2xl font-bold lg:text-3xl">{report.subject}</h1>
          {dna.executiveSummary && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{dna.executiveSummary}</p>
          )}
        </div>
        {report.opportunity_score != null && (
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="font-mono text-3xl font-bold text-accent-primary">
              {report.opportunity_score}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Opportunity</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DnaSection title="Audience Profile">
          <p className="mb-2 text-sm"><b>Who:</b> {dna?.audienceProfile?.who}</p>
          <ListLine label="Desires" items={dna?.audienceProfile?.desires} />
          <ListLine label="Pain points" items={dna?.audienceProfile?.painPoints} />
          <p className="text-sm"><b>Psychographics:</b> {dna?.audienceProfile?.psychographics}</p>
        </DnaSection>

        <DnaSection title="Content Pillars">
          <ul className="space-y-2 text-sm">
            {(dna.contentPillars ?? []).map((p: any, i: number) => (
              <li key={i}>
                <b>{p.name}</b> {p.share != null && <span className="text-muted-foreground">— {p.share}%</span>}
                <div className="text-muted-foreground">{p.description}</div>
              </li>
            ))}
          </ul>
        </DnaSection>

        <DnaSection title="Common Hooks">
          <ul className="space-y-2 text-sm">
            {(dna.commonHooks ?? []).map((h: any, i: number) => (
              <li key={i}>
                <b>{h.pattern}</b>
                <div className="text-muted-foreground italic">"{h.example}"</div>
              </li>
            ))}
          </ul>
        </DnaSection>

        <DnaSection title="Top Topics">
          <ul className="space-y-1 text-sm">
            {(dna.topTopics ?? []).map((t: any, i: number) => (
              <li key={i}>
                <b>{t.topic}</b> — <span className="text-muted-foreground">{t.why}</span>
              </li>
            ))}
          </ul>
        </DnaSection>

        <DnaSection title="Caption Structure">
          <p className="text-sm"><b>Length:</b> {dna?.captionStructure?.typicalLength}</p>
          <p className="text-sm"><b>Tone:</b> {dna?.captionStructure?.tone}</p>
          <p className="text-sm"><b>Opening:</b> {dna?.captionStructure?.openingStyle}</p>
          <p className="text-sm"><b>CTA:</b> {dna?.captionStructure?.ctaStyle}</p>
        </DnaSection>

        <DnaSection title="Visual Style">
          <p className="text-sm"><b>Palette:</b> {dna?.visualStyle?.palette}</p>
          <p className="text-sm"><b>Composition:</b> {dna?.visualStyle?.composition}</p>
          <p className="text-sm"><b>Overlay:</b> {dna?.visualStyle?.textOverlay}</p>
          <p className="text-sm"><b>Edit style:</b> {dna?.visualStyle?.editStyle}</p>
        </DnaSection>

        <DnaSection title="Cadence & Engagement">
          <p className="text-sm"><b>Frequency:</b> {dna.postingFrequency}</p>
          <p className="text-sm"><b>Times:</b> {dna.postingTimes}</p>
          <p className="text-sm"><b>Trends:</b> {dna.engagementTrends}</p>
          <p className="text-sm"><b>Most shared:</b> {dna.mostShared}</p>
          <p className="text-sm"><b>Most saved:</b> {dna.mostSaved}</p>
        </DnaSection>

        <DnaSection title="Brand Voice & Storytelling">
          <p className="text-sm"><b>Voice:</b> {dna.brandVoice}</p>
          <p className="text-sm"><b>Style:</b> {dna.storytellingStyle}</p>
          <p className="text-sm"><b>Thumbnails:</b> {dna.thumbnailPatterns}</p>
          <ListLine label="CTA patterns" items={dna.ctaPatterns} />
        </DnaSection>

        <DnaSection title="Growth Opportunities">
          <ListLine items={dna.growthOpportunities} />
        </DnaSection>
        <DnaSection title="Weaknesses & Missed">
          <ListLine label="Weaknesses" items={dna.weaknesses} />
          <ListLine label="Missed opportunities" items={dna.missedOpportunities} />
        </DnaSection>
        <DnaSection title="Competitive Advantages">
          <ListLine items={dna.competitiveAdvantages} />
        </DnaSection>
      </div>

      {/* ── Content Opportunity Engine ─────────────────────────────── */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Content Opportunity Engine</h2>
          <Button onClick={onGenerateIdeas} disabled={ideasBusy} className="gap-2">
            {ideasBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {ideas.length > 0 ? "Regenerate 50 Ideas" : "Generate 50 Ideas"}
          </Button>
        </div>
        {ideas.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Generate 50 ranked ideas grounded in this DNA report.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {ideas.map((idea: any) => (
              <div key={idea.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="rounded bg-accent-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent-primary">
                    {idea.format}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    conf {idea.confidence_score}
                  </span>
                </div>
                <h3 className="mb-1 text-sm font-semibold">{idea.title}</h3>
                <p className="mb-2 text-xs italic text-muted-foreground">"{idea.hook}"</p>
                <p className="mb-3 text-xs text-muted-foreground">{idea.description}</p>
                <div className="mb-3 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                  <span>Virality {idea.virality_score}</span>
                  <span>Diff {idea.difficulty_score}</span>
                  <span>Comp {idea.competition_score}</span>
                  <span>Biz {idea.business_value_score}</span>
                  <span>Aud {idea.audience_interest_score}</span>
                  <span>Prod {idea.production_time_score}</span>
                </div>
                <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => toast.info("Campaign Planner integration ships in Phase 2")}>
                  <CalendarPlus className="h-3 w-3" /> Save to Planner
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DnaSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ListLine({ label, items }: { label?: string; items?: unknown }) {
  const arr = Array.isArray(items) ? items : [];
  if (arr.length === 0) return null;
  return (
    <div className="text-sm">
      {label && <b>{label}: </b>}
      <ul className="ml-4 list-disc text-muted-foreground">
        {arr.map((x, i) => (
          <li key={i}>{String(x)}</li>
        ))}
      </ul>
    </div>
  );
}