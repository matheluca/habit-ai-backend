import { authenticateAndRateLimit, createResponse } from '../src/lib/auth-middleware';
import { logSecurityEvent } from '../src/lib/audit-logger';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // =============================
  // CORS
  // =============================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ PASSO 1: AUTENTICAÇÃO & RATE LIMIT & ANOMALIA
    const authReq = new Request(new URL(`http://${req.headers.host}${req.url}`), {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
      body: JSON.stringify(req.body),
    });

    const auth = await authenticateAndRateLimit(authReq);

    if (!auth.success) {
      Object.entries(auth.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      return res.status(auth.statusCode).json({
        error: auth.error,
        code: auth.statusCode === 401 ? 'UNAUTHORIZED' : 'RATE_LIMITED',
      });
    }

    const { uid } = auth.user!;
    const ip = auth.clientIP;

    // ✅ PASSO 2: LOG - API chamada
    await logSecurityEvent({
      type: 'API_CALL_INITIATED',
      uid,
      ip,
      endpoint: '/api/generate-analysis',
      statusCode: 200,
    });

    // ✅ PASSO 3: VALIDAÇÃO - Verificar dados
    const summaryData = req.body?.summaryData || req.body;
    
    if (!summaryData) {
      await logSecurityEvent({
        type: 'VALIDATION_FAILED',
        uid,
        ip,
        endpoint: '/api/generate-analysis',
        statusCode: 400,
        details: { error: 'Nenhum dado recebido no body' },
      });

      return res.status(400).json({
        error: 'Nenhum dado recebido no body'
      });
    }

    // ✅ PASSO 4: CHAMAR OPENAI
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
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
    });

    const data = await openaiResponse.json() as any;

    if (!openaiResponse.ok) {
      console.error('Erro OpenAI:', data);

      await logSecurityEvent({
        type: 'API_CALL_ERROR',
        uid,
        ip,
        endpoint: '/api/generate-analysis',
        statusCode: 500,
        details: { error: data.error?.message || 'Erro ao chamar OpenAI' },
      });

      return res.status(500).json({
        error: data.error?.message || 'Erro ao chamar OpenAI'
      });
    }

    // 🔥 Extração correta do texto
    let textOutput = '';
    if (data.output_text) {
      textOutput = data.output_text;
    } else if (data.output && Array.isArray(data.output)) {
      textOutput = data.output
        .flatMap((item: any) => item.content || [])
        .filter((c: any) => c.type === 'output_text')
        .map((c: any) => c.text)
        .join('\n');
    }

    // ✅ PASSO 5: LOG - Sucesso
    await logSecurityEvent({
      type: 'API_CALL_COMPLETED',
      uid,
      ip,
      endpoint: '/api/generate-analysis',
      statusCode: 200,
    });

    // ✅ PASSO 6: Adicionar headers de rate limit
    Object.entries(auth.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    return res.status(200).json({
      content: textOutput || 'Sem conteúdo retornado'
    });

  } catch (error) {
    console.error('Erro interno:', error);

    await logSecurityEvent({
      type: 'API_CALL_ERROR',
      endpoint: '/api/generate-analysis',
      statusCode: 500,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });

    return res.status(500).json({
      error: 'Erro ao gerar análise'
    });
  }
}
