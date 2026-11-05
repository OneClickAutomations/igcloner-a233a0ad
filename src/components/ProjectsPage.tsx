import { useEffect, useMemo, useState } from "react";
import { proxiedImg } from "@/lib/img-proxy";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Film,
  LayoutGrid,
  Mic,
  Type,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  FilterX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listProjects, deleteProject, type ProjectFormat } from "@/lib/projects.functions";
import {
  applyFilters,
  distinctTypes,
  normalizePageSize,
  normalizeRange,
  normalizeSort,
  paginate,
  PAGE_SIZES,
  type ProjectFilterState,
} from "@/lib/projects-filter";

const routeApi = getRouteApi("/_authenticated/projects");

const FORMAT_META: Record<ProjectFormat, { Icon: typeof Film; label: string }> = {
  reel: { Icon: Film, label: "Reel" },
  carousel: { Icon: LayoutGrid, label: "Carousel" },
  voiceover: { Icon: Mic, label: "Voiceover" },
  caption: { Icon: Type, label: "Caption" },
  image: { Icon: ImageIcon, label: "Image" },
};

const STUDIO_ROUTE: Record<ProjectFormat, string> = {
  reel: "/studio/reel",
  carousel: "/studio/carousel",
  voiceover: "/studio/voiceover",
  caption: "/app",
  image: "/studio/image",
};

const RANGE_LABELS: Record<string, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const listFn = useServerFn(listProjects);
  const delFn = useServerFn(deleteProject);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState<null | { id: string; title: string }>(null);

  const filters: ProjectFilterState = {
    q: search.q,
    sort: normalizeSort(search.sort),
    type: search.type,
    range: normalizeRange(search.range),
  };
  const perPage = normalizePageSize(search.perPage);

  // Local text input, debounced into the URL so we don't navigate per keystroke.
  const [qInput, setQInput] = useState(search.q);
  useEffect(() => setQInput(search.q), [search.q]);
  useEffect(() => {
    if (qInput === search.q) return;
    const t = setTimeout(() => {
      navigate({
        to: "/projects",
        search: (prev: any) => ({ ...prev, q: qInput, page: 1 }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [qInput, search.q, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFn();
      setProjects((res as any).projects || []);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const types = useMemo(() => distinctTypes(projects), [projects]);
  const filtered = useMemo(() => applyFilters(projects, filters), [projects, filters.q, filters.sort, filters.type, filters.range]);
  const slice = useMemo(
    () => paginate(filtered, search.page, perPage),
    [filtered, search.page, perPage],
  );

  // If a filter change shrunk the result set under the current page, snap back.
  useEffect(() => {
    if (!loading && slice.page !== search.page) {
      navigate({
        to: "/projects",
        search: (prev: any) => ({ ...prev, page: slice.page }),
        replace: true,
      });
    }
  }, [loading, slice.page, search.page, navigate]);

  const setFilter = (patch: Record<string, unknown>) =>
    navigate({
      to: "/projects",
      search: (prev: any) => ({ ...prev, ...patch, page: 1 }),
    });

  const clearFilters = () =>
    navigate({
      to: "/projects",
      search: { q: "", sort: "recent", type: "all", range: "all", page: 1, perPage },
    });

  const hasActiveFilters =
    filters.q !== "" || filters.type !== "all" || filters.range !== "all" || filters.sort !== "recent";

  const handleDelete = async (id: string) => {
    try {
      await delFn({ data: { id } });
      setProjects((p) => p.filter((x) => x.id !== id));
      toast.success("Project deleted");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't delete");
    }
  };

  const open = (p: any) => {
    const route = STUDIO_ROUTE[p.format as ProjectFormat];
    if (p.format === "caption") {
      navigate({ to: route, search: { analysisId: p.analysis_id } } as any);
    } else {
      navigate({ to: route, search: { projectId: p.id } } as any);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 lg:py-14">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Every content production session you've started.</p>
        </div>
        <Button onClick={() => navigate({ to: "/app" })} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Clone
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="dash-card border-dashed p-12 text-center">
          <p className="text-base font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Analyze a post and click <span className="font-medium text-foreground">Create Content</span> to start your first project.
          </p>
          <Button onClick={() => navigate({ to: "/app" })} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> Go to Clone Studio
          </Button>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="dash-card mb-5 flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search by handle, title or format…"
                className="pl-9"
                aria-label="Search projects"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:items-center">
              <Select value={filters.sort} onValueChange={(v) => setFilter({ sort: v })}>
                <SelectTrigger className="w-full lg:w-[150px]" aria-label="Sort projects">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="score">Highest score</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.type} onValueChange={(v) => setFilter({ type: v })}>
                <SelectTrigger className="w-full lg:w-[140px]" aria-label="Filter by type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>
                      {FORMAT_META[t as ProjectFormat]?.label ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.range} onValueChange={(v) => setFilter({ range: v })}>
                <SelectTrigger className="w-full lg:w-[140px]" aria-label="Filter by date">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RANGE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(perPage)}
                onValueChange={(v) => setFilter({ perPage: Number(v) })}
              >
                <SelectTrigger className="w-full lg:w-[110px]" aria-label="Projects per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {slice.total === 0 ? (
            <div className="dash-card p-12 text-center">
              <FilterX className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-base font-medium">No projects match these filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search, or clear the filters to see everything.
              </p>
              <Button variant="outline" onClick={clearFilters} className="mt-4 gap-1.5">
                <FilterX className="h-4 w-4" /> Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {slice.items.map((p) => {
                  const meta = FORMAT_META[p.format as ProjectFormat];
                  const Icon = meta?.Icon ?? Type;
                  return (
                    <div key={p.id} className="dash-card group relative flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-ig-hover">
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                          {meta?.label ?? p.format}
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {p.status?.replace("_", " ")}
                        </span>
                      </div>
                      {(p.latest_asset_url || p.source_thumbnail) && (
                        <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                          <img
                            src={p.latest_asset_url ?? (proxiedImg(p.source_thumbnail) ?? p.source_thumbnail)}
                            alt=""
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                      )}
                      <div>
                        <h3 className="line-clamp-2 text-base font-semibold tracking-tight">{p.title}</h3>
                        {p.source_account && (
                          <p className="text-xs text-muted-foreground">From @{p.source_account}</p>
                        )}
                      </div>
                      <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pt-2">
                        <Button size="sm" onClick={() => open(p)} className="min-w-0">
                          {p.status === "complete" || p.status === "exported" ? "Open" : "Continue"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDel({ id: p.id, title: p.title })}
                          aria-label="Delete project"
                          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pager */}
              <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Showing {slice.from}–{slice.to} of {slice.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={slice.page <= 1}
                    onClick={() =>
                      navigate({
                        to: "/projects",
                        search: (prev: any) => ({ ...prev, page: slice.page - 1 }),
                      })
                    }
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <span className="min-w-[72px] text-center text-sm font-medium">
                    Page {slice.page} of {slice.pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={slice.page >= slice.pageCount}
                    onClick={() =>
                      navigate({
                        to: "/projects",
                        search: (prev: any) => ({ ...prev, page: slice.page + 1 }),
                      })
                    }
                    className="gap-1"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{confirmDel?.title}</span>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirmDel) await handleDelete(confirmDel.id);
                setConfirmDel(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
