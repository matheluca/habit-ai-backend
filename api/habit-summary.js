import OpenAI from "openai";
import { authenticateAndRateLimit } from '../src/lib/auth-middleware';
import { logSecurityEvent } from '../src/lib/audit-logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // =============================
  // CORS - PRIMEIRO
  // =============================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // ✅ HANDLE OPTIONS PRIMEIRO (antes de qualquer autenticação)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ✅ PASSO 1: AUTENTICAÇÃO & RATE LIMIT & ANOMALIA
    const auth = await authenticateAndRateLimit(
      new Request(new URL(`http://${req.headers.host}${req.url}`), {
        method: req.method,
        headers: new Headers(req.headers),
        body: JSON.stringify(req.body),
      })
    );

    if (!auth.success) {
      // Adicionar headers de rate limit se existirem
      Object.entries(auth.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      return res.status(auth.statusCode).json({
        error: auth.error,
        code: auth.statusCode === 401 ? 'UNAUTHORIZED' : 'RATE_LIMITED',
      });
    }

    const { uid } = auth.user;
    const ip = auth.clientIP;

    // ✅ PASSO 2: LOG - API chamada
    await logSecurityEvent({
      type: 'API_CALL_INITIATED',
      uid,
      ip,
      endpoint: '/api/habit-summary',
      statusCode: 200,
    });

    // ✅ PASSO 3: VALIDAÇÃO - Verificar dados
    const { comments } = req.body;

    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      await logSecurityEvent({
        type: 'VALIDATION_FAILED',
        uid,
        ip,
        endpoint: '/api/habit-summary',
        statusCode: 400,
        details: { error: 'No comments provided' },
      });

      return res.status(400).json({ 
        error: "No comments provided" 
      });
    }

    const limitedComments = comments.slice(0, 50);

    // 👉 formata os comentários com contexto
    const formatted = limitedComments.map((c) => {
      const statusLabel =
        c.status === "done"
          ? "concluído"
          : c.status === "skipped"
          ? "pulado"
          : "não concluído";
      return `Data: ${c.date} | Status: ${statusLabel}\nComentário: ${c.text}`;
    });

    const prompt = `
Resuma os comentários abaixo dos últimos 7 dias de um hábito.
Contexto:
- Cada comentário informa se o hábito foi concluído no dia.
- Identifique padrões entre comportamento e comentários.
Objetivo:
- Identificar progresso
- Dificuldades recorrentes
- Tendência geral
Seja direto, em português, máximo 8 linhas.
${formatted.join("\n\n")}
`;

    // ✅ PASSO 4: CHAMAR OPENAI (seu código atual)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = completion.choices[0]?.message?.content?.trim() || "";

    // ✅ PASSO 5: LOG - Sucesso
    await logSecurityEvent({
      type: 'API_CALL_COMPLETED',
      uid,
      ip,
      endpoint: '/api/habit-summary',
      statusCode: 200,
    });

    // ✅ PASSO 6: Adicionar headers de rate limit na resposta
    Object.entries(auth.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    return res.status(200).json({ summary });

  } catch (error) {
    console.error(error);

    await logSecurityEvent({
      type: 'API_CALL_ERROR',
      endpoint: '/api/habit-summary',
      statusCode: 500,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });

    return res.status(500).json({ 
      error: "Internal server error" 
    });
  }
}
