import { createCanvas } from 'canvas';
import * as fs from 'fs';

const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#FF00FF'; // Bright magenta
ctx.fillRect(0, 0, 200, 200);

const pixel = ctx.getImageData(0, 0, 1, 1).data;
console.log('Top-left pixel RGBA:', pixel);

fs.writeFileSync('test-magenta.png', canvas.toBuffer());
