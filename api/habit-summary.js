import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // ✅ LIBERAR CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { comments } = req.body;

    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      return res.status(400).json({ error: "No comments provided" });
    }

    const limitedComments = comments.slice(0, 50);

    const prompt = `
Você é um analista comportamental objetivo.
Analise apenas informações explicitamente fornecidas.
Não invente dados.
Não faça inferências psicológicas.
Não dê conselhos.
Máximo 8 linhas.
Se dados insuficientes, escreva:
"Dados insuficientes para análise conclusiva."
Resposta em português, texto corrido.

Analise os comentários dos últimos 7 dias e identifique:
- padrões observáveis
- progresso ou regressão explícita
- dificuldades mencionadas
- sugestões explicitamente escritas

${limitedComments.join("\n")}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() || "";

    return res.status(200).json({ summary });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
