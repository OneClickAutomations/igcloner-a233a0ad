import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { InspirationStudio, inspirationQuery } from '@/components/InspirationStudio';
export const Route = createFileRoute('/_authenticated/studio/inspiration')({
  validateSearch: z.object({ projectId: z.string().uuid().optional(), delivery: z.boolean().optional() }),
  loaderDeps: ({ search }) => ({ projectId: search.projectId }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(inspirationQuery(deps.projectId)),
  head: () => ({ meta: [
    { title: 'Video Inspiration Studio — IG-Cloner' },
    { name: 'description', content: 'Create original portrait storyboards, approve scene stills, and generate private clips from structure-only inspiration.' },
    { property: 'og:title', content: 'Video Inspiration Studio — IG-Cloner' },
    { property: 'og:description', content: 'Original scenes, reference-defined subjects, approved stills and private video clips.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }, { name: 'robots', content: 'noindex' },
  ] }),
  component: () => <InspirationStudio projectId={Route.useSearch().projectId} initialDelivery={Route.useSearch().delivery}/>,
});