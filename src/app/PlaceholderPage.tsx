type Props = { title: string; task: string; spec: string };

export function PlaceholderPage({ title, task, spec }: Props) {
  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Em construção. Implementada pela(s) tarefa(s) {task} (spec {spec}) em{" "}
        <code>specs/001-core/tasks.md</code>.
      </p>
    </section>
  );
}
