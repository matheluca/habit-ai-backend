const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  temperature: 0.2,
  messages: [
    {
      role: "system",
      content: `
Você é um analista comportamental objetivo.
Analise apenas dados explicitamente fornecidos.
Não invente informações.
Não dê conselhos.
Não faça inferências psicológicas.
Máximo 8 linhas.
Se dados insuficientes, escreva:
"Dados insuficientes para análise conclusiva."
Resposta em português, texto corrido.
      `,
    },
    {
      role: "user",
      content: `
Analise os comentários dos últimos 7 dias e identifique:
- padrões observáveis
- progresso ou regressão explícita
- dificuldades mencionadas
- sugestões explicitamente escritas

Comentários:
${limitedComments.join("\n")}
      `,
    },
  ],
});
