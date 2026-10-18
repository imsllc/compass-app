// Deterministic asset preparation; preserves the supplied JPEG artwork.
const path = require('node:path');
const { createRequire } = require('node:module');
const imageRequire = createRequire(require.resolve('@expo/image-utils'));
const Jimp = imageRequire('jimp-compact');
const root = path.resolve(process.cwd());

async function main() {
  const original = await Jimp.read(path.join(root, 'app_icon.jpg'));
  await original.clone().resize(1024, 1024).writeAsync(path.join(root, 'assets/app_icon.png'));
  const foreground = original.clone();
  // Remove only the dark navy backdrop; retain the white, red and blue artwork.
  foreground.scan(0, 0, foreground.bitmap.width, foreground.bitmap.height, function (x, y, i) {
    const d = this.bitmap.data;
    const difference = Math.max(Math.abs(d[i] - 11), Math.abs(d[i + 1] - 30), Math.abs(d[i + 2] - 59));
    d[i + 3] = Math.round(Math.max(0, Math.min(1, (difference - 16) / 24)) * 255);
  });
  // Match K-Pop's packaging: 640px artwork centered in a 1024px layer.
  // Apply this once to both adaptive variants; keep the backdrop full bleed.
  const layer = new Jimp(1024, 1024, 0x00000000);
  layer.composite(foreground.resize(640, 640), 192, 192);
  await layer.writeAsync(path.join(root, 'assets/app-icon-foreground.png'));
  const monochrome = layer.clone();
  monochrome.scan(0, 0, 1024, 1024, function (x, y, i) {
    this.bitmap.data[i] = this.bitmap.data[i + 1] = this.bitmap.data[i + 2] = 255;
  });
  await monochrome.writeAsync(path.join(root, 'assets/app-icon-monochrome.png'));

  const preview = new Jimp(1120, 440, '#EEF1F5');
  const shapes = ['Circle', 'Squircle', 'Rounded square', 'Themed example'];
  for (let n = 0; n < shapes.length; n++) {
    const themed = n === 3;
    const background = new Jimp(1024, 1024, themed ? '#DCE9D4' : '#0B1E3B');
    const artwork = themed ? monochrome.clone() : layer;
    if (themed) artwork.scan(0, 0, 1024, 1024, function (x, y, i) {
      this.bitmap.data[i] = 38; this.bitmap.data[i + 1] = 65; this.bitmap.data[i + 2] = 44;
    });
    background.composite(artwork, 0, 0);
    // Launcher viewport is the central 72 dp of the full 108 dp layers.
    const icon = background.crop(171, 171, 682, 682).resize(224, 224);
    icon.scan(0, 0, 224, 224, function (x, y, i) {
      const u = Math.abs((x + .5 - 112) / 112), v = Math.abs((y + .5 - 112) / 112);
      const power = n === 1 ? 4 : n === 2 ? 6 : 2;
      if (u ** power + v ** power > 1) this.bitmap.data[i + 3] = 0;
    });
    const left = 32 + n * 272;
    preview.composite(icon, left, 105);
  }
  await preview.writeAsync(path.join(root, 'docs/adaptive-icon-preview.png'));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

