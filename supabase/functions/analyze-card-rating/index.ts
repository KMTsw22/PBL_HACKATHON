import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CardInput = {
  card_name?: string | null
  description?: string | null
  custom_title?: string | null
  custom_content?: string | null
}

type Suggestion = {
  category: string
  score: number
  reason?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ message: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const card = (await req.json()) as CardInput
    if (!card) {
      return new Response(
        JSON.stringify({ message: 'card data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ message: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cardText = [
      card.card_name && `이름: ${card.card_name}`,
      card.custom_title && `직함: ${card.custom_title}`,
      card.custom_content && `전문분야: ${card.custom_content}`,
      card.description && `소개: ${card.description}`,
    ]
      .filter(Boolean)
      .join('\n')

    const systemPrompt = `You are an expert at evaluating professional networking profiles. Analyze the given card/profile and suggest ratings (0-5 scale, 0=DEVELOPING, 5=EXPERT) for relevant categories.

Always include these base categories: Expertise, Professionalism, Communication.
Additionally, suggest 0-3 extra categories that are relevant to this specific profile (e.g. "해커톤 적합도", "디자인 감각", "리더십" for designers; "기술 역량", "협업 능력" for developers).

Respond ONLY with valid JSON in this exact format, no other text:
{"suggestions":[{"category":"string","score":number,"reason":"brief reason in Korean"}]}

Score must be between 0 and 5. Use one decimal place.`

    const userPrompt = `다음 프로필을 분석하고 평가 점수를 제안해주세요:\n\n${cardText || '(정보 없음)'}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err?.error?.message || `OpenAI error: ${res.status}`
      return new Response(
        JSON.stringify({ message: msg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return new Response(
        JSON.stringify({ message: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let parsed: { suggestions: Suggestion[] }
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return new Response(
        JSON.stringify({ message: 'Invalid AI response format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const suggestions = (parsed.suggestions ?? []).map((s) => ({
      category: String(s.category || '').trim(),
      score: Math.min(5, Math.max(0, Number(s.score) || 4)),
      reason: s.reason ? String(s.reason).trim() : undefined,
    })).filter((s) => s.category)

    return new Response(
      JSON.stringify({ suggestions }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('[analyze-card-rating] 에러:', e)
    return new Response(
      JSON.stringify({ message: e instanceof Error ? e.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
