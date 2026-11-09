import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ContentLibrary } from '@/components/ContentLibrary';

export const Route = createFileRoute('/_authenticated/library')({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({ meta: [
    { title: 'Content library — IG-Cloner' },
    { name: 'description', content: 'Find, edit, download, schedule and publish your saved images, carousels, reels and films.' },
    { property: 'og:title', content: 'Content library — IG-Cloner' },
    { property: 'og:description', content: 'Your finished content and platform captions, saved together in IG-Cloner.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'robots', content: 'noindex' },
  ] }),
  component: ContentLibrary,
});