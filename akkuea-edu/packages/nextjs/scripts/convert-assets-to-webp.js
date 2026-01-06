import { glob } from 'glob';
import sharp from 'sharp';

const files = await glob('public/**/*.+(jpg|jpeg|png)', { nodir: true });

await Promise.all(
  files.map(async (f) => {
    const out = f.replace(/\.(jpe?g|png)$/i, '.webp');
    const isPng = /\.png$/i.test(f);
    await sharp(f)
      .webp(isPng ? { nearLossless: true, quality: 85 } : { quality: 75 })
      .toFile(out);
    console.log('✓', out);
  })
);
