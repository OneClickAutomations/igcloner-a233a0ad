import { useEffect, useState } from "react";
import { proxiedImg } from "@/lib/img-proxy";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Film, LayoutGrid, Mic, Type, Image as ImageIcon, Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export function ProjectsPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listProjects);
  const delFn = useServerFn(deleteProject);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState<null | { id: string; title: string }>(null);

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
          <Plus className="h-4 w-4" /> New from analysis
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="text-base font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Analyze a post and click <span className="font-medium text-foreground">Create Content</span> to start your first project.
          </p>
          <Button onClick={() => navigate({ to: "/app" })} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> Go to Analyze
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const meta = FORMAT_META[p.format as ProjectFormat];
            const Icon = meta?.Icon ?? Type;
            return (
              <div key={p.id} className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-ig transition-all hover:-translate-y-0.5 hover:shadow-ig-hover">
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