// Stub: o chat será implementado pela tarefa T-20 (specs/001-core/tasks.md).
// Regras: validar o JWT do Supabase, usar chaves de LLM só do ambiente do servidor,
// nunca enviar dados bancários ao LLM (constituição, princípios 3, 4 e 5).
export function POST(): Response {
  return Response.json({ error: "Chat ainda não implementado (T-20)." }, { status: 501 });
}
