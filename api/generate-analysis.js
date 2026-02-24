export default async function handler(req, res) {
  // CORS
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
    const { summaryData } = req.body

    if (!summaryData) {
      return res.status(400).json({ error: "Missing summaryData" })
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `
          Você é um analista de performance de hábitos.
          Analise os seguintes dados:
          ${JSON.stringify(summaryData)}
          Gere insights estratégicos e recomendações.
        `,
        max_output_tokens: 800
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(data)
      return res.status(500).json({ error: data.error?.message || "Erro OpenAI" })
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
