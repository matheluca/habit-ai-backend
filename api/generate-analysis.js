import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { summaryData } = req.body;

    if (!summaryData) {
      return res.status(400).json({ error: "summaryData is required" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `
Você é um estrategista de alta performance especializado em disciplina e consistência.
Seja analítico e objetivo.
Evite motivação genérica.
          `
        },
        {
          role: "user",
          content: `
Analise os dados abaixo:

${JSON.stringify(summaryData)}
          `
        }
      ]
    });

    return res.status(200).json({
      content: response.choices[0].message.content
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao gerar análise" });
  }
}
