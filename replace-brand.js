import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'src/styles.css',
  'src/routes/__root.tsx',
  'src/routes/_authenticated.tsx',
  'src/routes/auth.tsx',
  'src/routes/index.tsx',
  'src/routes/sitemap[.]xml.ts',
  'src/routes/_authenticated/projects.tsx',
  'src/routes/_authenticated/app.tsx',
  'src/routes/_authenticated/studio.index.tsx',
  'src/routes/_authenticated/studio.carousel.tsx',
  'src/routes/_authenticated/studio.image.tsx',
  'src/routes/_authenticated/studio.reel.tsx',
  'src/routes/_authenticated/studio.voiceover.tsx',
  'src/lib/reel.functions.ts',
  'src/lib/carousel.functions.ts',
  'src/lib/angles.functions.ts',
  'src/lib/analyze.functions.ts',
  'src/components/LandingPage.tsx',
  'src/components/AuthPage.tsx',
  'src/components/AppSidebar.tsx',
  'src/assets/landing.html',
];

filesToUpdate.forEach((file) => {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace URLs
  content = content.replace(/https:\/\/igcloner\.lovable\.app/g, 'https://www.igcloner.com');
  content = content.replace(/igcloner\.lovable\.app/g, 'www.igcloner.com');
  content = content.replace(/igcloner\.app/g, 'www.igcloner.com');

  // Replace Brand Name
  content = content.replace(/IGCloner/g, 'IG-Cloner');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
});
