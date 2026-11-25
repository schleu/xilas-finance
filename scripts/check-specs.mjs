#!/usr/bin/env node
/**
 * Verificador de SDD. Roda no CI e localmente (`npm run check:specs`).
 * Falha (exit 1) quando o repositório viola o processo definido em AGENTS.md.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const specsDir = join(root, "specs");
const errors = [];
const warnings = [];

const read = (p) => readFileSync(p, "utf8");
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// 1. Arquivos-base do processo
for (const f of ["AGENTS.md", "specs/constitution.md", "specs/README.md"]) {
  if (!existsSync(join(root, f))) fail(`Arquivo obrigatório ausente: ${f}`);
}
if (existsSync(join(root, "AGENTS.md"))) {
  const agents = read(join(root, "AGENTS.md"));
  if (!agents.includes("specs/constitution.md"))
    fail("AGENTS.md deve referenciar specs/constitution.md");
}

// 2. Cada feature em specs/NNN-nome precisa de spec, plan e tasks
const features = existsSync(specsDir)
  ? readdirSync(specsDir).filter(
      (d) => /^\d{3}-/.test(d) && statSync(join(specsDir, d)).isDirectory(),
    )
  : [];

if (features.length === 0) fail("Nenhuma feature encontrada em specs/NNN-nome/");

const allTaskIds = new Map();

for (const feature of features) {
  const dir = join(specsDir, feature);
  for (const f of ["spec.md", "plan.md", "tasks.md"]) {
    if (!existsSync(join(dir, f))) fail(`${feature}: falta ${f}`);
  }
  if (!existsSync(join(dir, "spec.md")) || !existsSync(join(dir, "tasks.md"))) continue;

  const spec = read(join(dir, "spec.md"));
  const tasks = read(join(dir, "tasks.md"));

  // 3. Status da spec
  const statusMatch = /\*\*Status:\*\*\s*([\p{L}-]+)/iu.exec(spec);
  const status = statusMatch?.[1]?.toLowerCase();
  const validStatus = ["rascunho", "aprovada", "implementada"];
  if (!status || !validStatus.includes(status)) {
    fail(`${feature}/spec.md: cabeçalho deve ter "**Status:** rascunho|aprovada|implementada"`);
  }

  // 4. IDs de tarefa únicos e bem formados
  const lines = tasks.split("\n");
  let phase = "";
  let taskCount = 0;
  let hasUnresolved = /\[NEEDS CLARIFICATION/i.test(spec);
  let doneOutsidePhase0 = [];
  for (const line of lines) {
    const heading = /^##\s+(.*)/.exec(line);
    if (heading) phase = heading[1];
    const task = /^- \[( |x|X)\] \*\*(T-\d{2,3})\b/.exec(line);
    if (!task) continue;
    const id = `${feature}:${task[2]}`;
    if (allTaskIds.has(id)) fail(`${feature}/tasks.md: ID duplicado ${task[2]}`);
    allTaskIds.set(id, true);
    taskCount++;
    if (task[1].toLowerCase() === "x" && !/^Fase 0\b/.test(phase)) doneOutsidePhase0.push(task[2]);
  }
  if (taskCount === 0)
    fail(`${feature}/tasks.md: nenhuma tarefa no formato "- [ ] **T-01 Título.**"`);

  // 5. Portões de aprovação
  if (status !== "aprovada" && status !== "implementada" && doneOutsidePhase0.length > 0) {
    fail(
      `${feature}: tarefas concluídas (${doneOutsidePhase0.join(", ")}) com spec "${status}". ` +
        `Só a Fase 0 (fundação) pode avançar sem spec aprovada.`,
    );
  }
  if (hasUnresolved && doneOutsidePhase0.length > 0) {
    fail(`${feature}/spec.md tem [NEEDS CLARIFICATION] pendente e já existem tarefas concluídas.`);
  } else if (hasUnresolved) {
    warn(`${feature}/spec.md ainda tem [NEEDS CLARIFICATION] pendente.`);
  }
  if (status === "implementada" && /^- \[ \] \*\*T-/m.test(tasks)) {
    fail(`${feature}: spec marcada como implementada, mas há tarefas em aberto.`);
  }
}

for (const w of warnings) console.warn(`⚠  ${w}`);
if (errors.length) {
  console.error("\n✖ Verificação de SDD falhou:\n");
  for (const e of errors) console.error(`  - ${e}`);
  console.error("\nVeja AGENTS.md e specs/README.md.\n");
  process.exit(1);
}
console.log(`✔ SDD ok (${features.length} feature(s) verificada(s)).`);
