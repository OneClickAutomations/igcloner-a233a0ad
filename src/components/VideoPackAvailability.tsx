import { useState } from 'react';
import { Film } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from './ui/dialog';
import { STUDIO_PRICING } from '@/lib/studio-pricing';
export function VideoPackAvailability() {
  const [open,setOpen]=useState(false);
  return <><Button variant="outline" onClick={()=>setOpen(true)}><Film className="size-4"/> Buy a video pack</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Video packs · coming soon</DialogTitle></DialogHeader><p>Pack prices are approved. Purchases are not available yet.</p><ul className="space-y-2">{STUDIO_PRICING.video.packs.map(pack=><li key={pack.id}>{pack.name} · {pack.credits} video credits · ${pack.usd}</li>)}</ul><p className="text-sm text-muted-foreground">Your storyboard and approved stills stay saved. No plan credits will be used for video.</p></DialogContent></Dialog></>;
}