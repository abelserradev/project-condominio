#!/usr/bin/env node
/**
 * Compara dep_graph.py con docs/arch-eval/arch-baseline.json — Phase 1 guardrail.
 * Requiere python3 y el script arch-evaluator (ruta local o ARCH_DEP_GRAPH_SCRIPT).
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(repoRoot, 'docs/arch-eval/arch-baseline.json');
const analysisDir = path.join(repoRoot, 'docs/arch-eval/analysis');

const vendoredScript = path.join(repoRoot, 'scripts/arch/dep_graph.py');
const fallbackScript = path.join(
  process.env.HOME ?? '',
  '.agents/skills/arch-evaluator/scripts/dep_graph.py',
);
const depGraphScript =
  process.env.ARCH_DEP_GRAPH_SCRIPT?.trim() ||
  (existsSync(vendoredScript) ? vendoredScript : fallbackScript);

if (!existsSync(depGraphScript)) {
  console.error(
    `[arch:baseline] No se encontró dep_graph.py en ${depGraphScript}. ` +
      'Define ARCH_DEP_GRAPH_SCRIPT o instala arch-evaluator.',
  );
  process.exit(1);
}

mkdirSync(analysisDir, { recursive: true });
execSync(`python3 "${depGraphScript}" "${repoRoot}" -o "${analysisDir}"`, {
  stdio: 'inherit',
});

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const graphPath = path.join(analysisDir, 'dep_graph.json');
const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const sccCount = graph.cycles_scc?.length ?? 0;
const maxAllowed = baseline.maxStronglyConnectedComponents;

if (sccCount > maxAllowed) {
  console.error(
    `[arch:baseline] FAIL: ${sccCount} SCC > máximo ${maxAllowed}. ` +
      'No introducir ciclos nuevos (ver docs/arch-eval/02-MIGRATION-PLAN.md).',
  );
  console.error(JSON.stringify(graph.cycles_scc, null, 2));
  process.exit(1);
}

const adminUtilsCycle = graph.cycles_scc?.some((cycle) =>
  cycle.includes('src/administracion/utils'),
);
if (adminUtilsCycle) {
  console.error(
    '[arch:baseline] FAIL: ciclo administracion/utils regresó — utils no debe importar *.service.ts',
  );
  process.exit(1);
}

const forbiddenMutual = [
  ['src/auth', 'src/buildings'],
  ['src/auth', 'src/owners'],
  ['src/buildings', 'src/common'],
  ['src/administracion', 'src/administracion/utils'],
];
const pairs = graph.cycles_pairs ?? [];
for (const [a, b] of forbiddenMutual) {
  const hit = pairs.some(
    (p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a),
  );
  if (hit) {
    console.error(
      `[arch:baseline] FAIL: par mutuo prohibido ${a} ↔ ${b} (ADR-001 / Phase 1).`,
    );
    process.exit(1);
  }
}

console.log(
  `[arch:baseline] OK: ${sccCount} SCC (máx ${maxAllowed}); sin ciclo administracion/utils.`,
);
