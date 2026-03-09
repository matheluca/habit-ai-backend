import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

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

    const limitedComments = comments.filter(Boolean).slice(0, 50);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Você analisa hábitos e gera um diagnóstico comportamental estruturado.
Identifique padrões claros e forneça análise objetiva.
          `,
        },
        {
          role: "user",
          content: `
Analise os comentários abaixo e gere:

1️⃣ Score geral do hábito (0–10)
2️⃣ Principal ponto positivo
3️⃣ O que precisa melhorar
4️⃣ Ajustes estratégicos

Comentários:
${limitedComments.join("\n")}
          `,
        },
      ],
    });

    const content =
      completion.choices[0]?.message?.content?.trim() || "";

    return res.status(200).json({ content });

  } catch (error) {
    console.error("Generate analysis error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
