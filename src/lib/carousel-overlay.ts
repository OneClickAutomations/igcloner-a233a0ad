/** Browser-only execution: exact strings rendered onto a text-free bitmap. No native server dependency. */
export function wrapOverlayText(text:string,measure:(s:string)=>number,maxWidth:number):string[] {
  return text.split("\n").flatMap(paragraph=>{
    const lines:string[]=[];let line="";
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      if(measure(word)>maxWidth)throw new Error("A slide word is too long to fit. Shorten it before generating.");
      const next=line?`${line} ${word}`:word;
      if(line&&measure(next)>maxWidth){lines.push(line);line=word;}else line=next;
    }
    return [...lines,line];
  });
}
export async function overlayCarouselText(backgroundUrl:string,headline:string,body:string):Promise<string> {
  const response=await fetch(backgroundUrl);if(!response.ok)throw new Error("Couldn't load the slide background.");
  const bitmap=await createImageBitmap(await response.blob());
  const canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image rendering isn't available in this browser.");
  try {
    ctx.drawImage(bitmap,0,0);const w=canvas.width,h=canvas.height,margin=w*0.08;
    // Raster palette is deliberately fixed for contrast; these aren't UI theme colors.
    ctx.fillStyle="#101214";ctx.fillRect(0,0,w,h*0.62);ctx.fillStyle="#ffffff";
    ctx.textBaseline="top";
    const draw=(text:string,size:number,top:number,weight:number)=>{
      ctx.font=`${weight} ${size}px Arial, sans-serif`;
      const lines=wrapOverlayText(text,s=>ctx.measureText(s).width,w-margin*2);
      if(top+lines.length*size*1.2>h*0.59)throw new Error("Slide text is too long for clear typography. Shorten it.");
      lines.forEach((line,i)=>ctx.fillText(line,margin,top+i*size*1.2));
      return top+lines.length*size*1.2;
    };
    const end=draw(headline,h*0.065,h*0.06,700);
    draw(body,h*0.035,end+h*0.025,400);
    return canvas.toDataURL("image/png");
  }finally{bitmap.close();}
}