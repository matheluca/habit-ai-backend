{\rtf1\ansi\ansicpg1252\cocoartf2867
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import OpenAI from "openai";\
\
export default async function handler(req, res) \{\
  if (req.method !== "POST") \{\
    return res.status(405).json(\{ error: "Method not allowed" \});\
  \}\
\
  try \{\
    const openai = new OpenAI(\{\
      apiKey: process.env.OPENAI_API_KEY,\
    \});\
\
    const \{ summaryData \} = req.body;\
\
    if (!summaryData) \{\
      return res.status(400).json(\{ error: "summaryData is required" \});\
    \}\
\
    const response = await openai.chat.completions.create(\{\
      model: "gpt-4o-mini",\
      temperature: 0.3,\
      max_tokens: 700,\
      messages: [\
        \{\
          role: "system",\
          content: `\
Voc\'ea \'e9 um estrategista de alta performance especializado em disciplina, consist\'eancia e execu\'e7\'e3o.\
\
Seja:\
- Anal\'edtico\
- Objetivo\
- Estruturado\
- Estrat\'e9gico\
\
Evite motiva\'e7\'e3o gen\'e9rica.\
          `\
        \},\
        \{\
          role: "user",\
          content: `\
Analise os dados abaixo e gere:\
\
1. Diagn\'f3stico Geral de Performance\
2. Padr\'f5es Estrat\'e9gicos Identificados\
3. Gargalos de Performance\
4. Recomenda\'e7\'f5es Estrat\'e9gicas\
5. Insight Final\
\
Dados:\
$\{JSON.stringify(summaryData)\}\
          `\
        \}\
      ]\
    \});\
\
    return res.status(200).json(\{\
      content: response.choices[0].message.content\
    \});\
\
  \} catch (error) \{\
    console.error(error);\
    return res.status(500).json(\{\
      error: "Erro ao gerar an\'e1lise"\
    \});\
  \}\
\}}