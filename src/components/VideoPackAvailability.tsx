import { useState } from 'react';
import { Film } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from './ui/dialog';
export function VideoPackAvailability() {
  const [open,setOpen]=useState(false);
  return <><Button variant="outline" onClick={()=>setOpen(true)}><Film className="size-4"/> Buy a video pack</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Video packs · coming soon</DialogTitle></DialogHeader><p>Pack prices are awaiting approval. Purchases are not available yet.</p><p className="text-sm text-muted-foreground">Your storyboard and approved stills stay saved. No plan credits will be used for video.</p></DialogContent></Dialog></>;
}