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
Você é um analista de performance comportamental com base em neurociência aplicada.
Analise os dados abaixo:
${JSON.stringify(summaryData, null, 2)}
Regras obrigatórias de resposta:
- Máximo 180 palavras
- Linguagem simples e direta
- Nada de textos longos ou técnicos
- Resposta estruturada e escaneável
- Pensado para caber sem rolagem excessiva em mobile
- trate e remova qualquer termo de inglês, evite os termos recebidos de "done,skipped,staks,none", traduza para o contexto.
- skipped não é ruim, ele é um descanso. não considere ele como algo negativo. 
- na avaliação sempre considere o contexto (descrição) do grupo e do hábito, se enviado. Como é um campo opcional, pode ser que não tenha. 
Estruture EXATAMENTE neste formato:
🔎 Score geral: X/10  
(1 frase explicando o porquê da nota)
🏆 Hábito destaque:
(Nome do hábito mais relevante + 1 frase objetiva explicando por que ele chama atenção — positivo ou negativo)
✅ Você está acertando:
- Bullet curto
- Bullet curto
⚠️ Precisa ajustar:
- Bullet curto
- Bullet curto
🧠 Ajuste estratégico:
(3 ações práticas, simples e específicas para próxima semana)
Use princípios básicos de neurociência comportamental:
- Reforço positivo
- Construção de consistência
- Pequenas vitórias
- Redução de fricção
Evite:
- Jargão técnico
- Textos longos
- Explicações genéricas
- Repetição do que já está óbvio nos dados
Seja direto, acionável e objetivo.
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
    // 🔥 Extração correta do texto
    let textOutput = ""
    if (data.output_text) {
      textOutput = data.output_text
    } else if (data.output && Array.isArray(data.output)) {
      textOutput = data.output
        .flatMap(item => item.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text)
        .join("\n")
    }
    return res.status(200).json({
      content: textOutput || "Sem conteúdo retornado"
    })
  } catch (error) {
    console.error("Erro interno:", error)
    return res.status(500).json({
      error: "Erro ao gerar análise"
    })
  }
}
