import { readFile, writeFile } from 'node:fs/promises';
import { generatePlan } from './planEngine.js';

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node engine/cli.js <setup.json> <product_catalog.json> <engine.package.json> [output.json] [--ack]');
  process.exit(1);
}

const [setupPath, catalogPath, packagePath, outputPath, ackFlag] = args;
const overrideAcknowledged = args.includes('--ack');

const loadJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const [setup, productCatalog, enginePackage] = await Promise.all([
  loadJson(setupPath),
  loadJson(catalogPath),
  loadJson(packagePath)
]);

const plan = generatePlan({
  setup,
  productCatalog,
  enginePackage,
  overrideAcknowledged,
  generatedAtIso: new Date().toISOString()
});

const output = JSON.stringify(plan, null, 2);
if (outputPath && outputPath !== '--ack') {
  await writeFile(outputPath, output);
}
console.log(output);
