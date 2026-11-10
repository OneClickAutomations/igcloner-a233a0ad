export type VideoChange = { key: string; label: string; source: string; recommended: string; options: string[]; identity?: boolean };
export function observedVideoChanges(source: any): VideoChange[] {
  const dna = source?.dna ?? source?.dna_analysis ?? {};
  const blueprint = source?.blueprint ?? dna.blueprint ?? {};
  const video = source?.evidence?.video ?? source?.evidence?.partial?.video ?? {};
  const scenes = blueprint.scenes ?? [];
  const description = String(video.shots?.[0]?.onScreen ?? scenes[0]?.description ?? dna.videoVisualDNA?.subjectDescription ?? 'Not recorded');
  const extract = (pattern: RegExp, fallback: string) => description.match(pattern)?.[0] ?? fallback;
  const person = extract(/(?:a |an )?(?:woman|man|person|athlete|presenter)(?:[^.,]*?)(?= wearing| speaks| performs| flips| stands| walks|$)/i, scenes[0]?.subject || 'No person recorded');
  const clothing = extract(/(?:wearing|dressed in) [^.,]+/i, 'Clothing not recorded');
  const setting = extract(/(?:indoors|outdoors|gym|garden|yard|studio|office|beach|kitchen)(?:[^.,]*?)(?=,|\.|$)/i, dna.videoVisualDNA?.backgroundDescription || 'Setting not recorded');
  const action = video.shots?.[0]?.action ?? extract(/(?:backflip|flips?|spins?|speaks|gestur\w*|toss\w*|catch\w*|demonstrat\w*)[^.,]*/i, description);
  const product = extract(/(?:bottle|knife|dagger|phone|cup|box|product)\b[^.,]*/i, 'None observed');
  const tone = dna.videoVisualDNA?.paceAndEnergy ?? video.audio?.energy ?? dna.captionDNA?.tone ?? 'Source-matched energy';
  return [
    {key:'person',label:'Person',source:person,recommended:'New original person; similar performance energy',options:['New original person; similar performance energy','Woman performer','Man performer','Different presenter','Use my person reference'],identity:true},
    {key:'clothing',label:'Clothing',source:clothing,recommended:clothing,options:[clothing,'Black activewear','Casual everyday clothes','Business clothing','Use clothing from my reference']},
    {key:'setting',label:'Setting',source:setting,recommended:setting,options:[setting,'Gym','Outdoor garden','Clean studio','Home interior']},
    {key:'action',label:'Action',source:String(action),recommended:String(action),options:[String(action),'Keep the source action','Demonstrate my product','Show the result first','Explain directly to camera']},
    {key:'product',label:'Product',source:product,recommended:product,options:[product,'No product','Use my uploaded product','Similar kind of product']},
    {key:'tone',label:'Tone',source:String(tone),recommended:String(tone),options:[String(tone),'Energetic','Calm and natural','Confident','Playful']},
  ];
}
export function videoChangeBrief(rows: VideoChange[], values: Record<string,string>) {
  return rows.map(r=>`${r.label}: ${values[r.key] || r.recommended}${r.identity?' (casting intent only; actual identity from reference pixels, never source likeness)':''}`).join('\n');
}