const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const jobs = [
  { svg: 'assets/icon-source.svg',     out: 'assets/icon-only.png',           size: 1024 },
  { svg: 'assets/icon-foreground.svg', out: 'assets/icon-foreground.png',     size: 1024 },
  { svg: 'assets/icon-background.svg', out: 'assets/icon-background.png',     size: 1024 },
  { svg: 'app/icon.svg',               out: 'app/icon-192.png',               size: 192  },
  { svg: 'app/icon.svg',               out: 'app/icon-512.png',               size: 512  },
  { svg: 'app/icon.svg',               out: 'app/icon-maskable-512.png',      size: 512  },
  { svg: 'app/icon.svg',               out: 'app/apple-touch-icon.png',       size: 180  },
];

const only = process.argv[2];

(async () => {
  for (const job of jobs) {
    if (only && !job.svg.includes(only) && !job.out.includes(only)) continue;
    const svgPath = path.join(root, job.svg);
    const outPath = path.join(root, job.out);
    if (!fs.existsSync(svgPath)) {
      console.log(`SKIP (missing): ${job.svg}`);
      continue;
    }
    await sharp(svgPath, { density: 384 })
      .resize(job.size, job.size)
      .png()
      .toFile(outPath);
    console.log(`OK ${job.out} (${job.size}x${job.size})`);
  }
})();
