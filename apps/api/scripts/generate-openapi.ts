import app from '../src/index';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const res = await app.handle(new Request('http://localhost/docs/json'));

const spec = await res.json();

const outputPath = resolve(__dirname, '../docs/api/openapi.json');

writeFileSync(outputPath, JSON.stringify(spec, null, 2));

console.log('✅ OpenAPI spec generated');
