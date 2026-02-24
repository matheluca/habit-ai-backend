export default async function handler(req, res) {
  // =============================
  // CORS
  // =============================
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    console.log("BODY RECEBIDO:", req.body)

    const summaryData = req.body?.summaryData || req.body

    if (!summaryData) {
      return res.status(400).json({
        error: "Nenhum dado recebido no body"
      })
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `
Você é um analista estratégico de performance de hábitos.

Analise os seguintes dados:

${JSON.stringify(summaryData, null, 2)}

Forneça:

1. Diagnóstico geral
2. Pontos fortes
3. Pontos fracos
4. Riscos comportamentais
5. Estratégia prática de melhoria
6. Sugestões de otimização de consistência

Seja direto, estratégico e orientado a performance.
        `,
        max_output_tokens: 800
      })
    })

    const data = await openaiResponse.json()

    if (!openaiResponse.ok) {
      console.error("Erro OpenAI:", data)
      return res.status(500).json({
        error: data.error?.message || "Erro ao chamar OpenAI"
      })
    }

    return res.status(200).json({
      content: data.output_text || "Sem conteúdo retornado"
    })

  } catch (error) {
    console.error("Erro interno:", error)
    return res.status(500).json({
      error: "Erro ao gerar análise"
    })
  }
}
