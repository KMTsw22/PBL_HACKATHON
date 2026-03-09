import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    let body: { query?: string }
    try {
      body = (await req.json()) as { query?: string }
    } catch {
      return new Response(
        JSON.stringify({ message: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { query } = body
    if (!query || typeof query !== 'string' || !query.trim()) {
      return new Response(
        JSON.stringify({ message: 'query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ message: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    const { data: collectedRows, error: fetchError } = await supabase
      .from('collected_cards')
      .select('id, card_id')
      .eq('user_id', userId)

    if (fetchError) {
      console.error('[recommend-from-collected] fetch error:', fetchError)
      return new Response(
        JSON.stringify({ message: fetchError.message || '데이터를 불러오지 못했어요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!collectedRows?.length) {
      return new Response(
        JSON.stringify({
          recommendations: [],
          cards: [],
          message: '수집한 명함이 없어요. Find에서 먼저 명함을 수집해보세요.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const collectedIds = collectedRows.map((r) => r.id)
    const cardIdList = collectedRows.map((r) => r.card_id).filter(Boolean)
    const cardIdToCollectedId = new Map(collectedRows.map((r) => [r.card_id, r.id]))

    const cardsRes = await supabase.from('user_cards').select('*').in('id', cardIdList)
    const scoresRes = await supabase.from('collected_card_scores').select('collected_card_id, category, score').in('collected_card_id', collectedIds)

    const cards = (cardsRes.data ?? []) as Record<string, unknown>[]
    const scoresRows = scoresRes.data ?? []
    const scoresByCollected = new Map<string, { category: string; score: number }[]>()
    for (const s of scoresRows) {
      const list = scoresByCollected.get(s.collected_card_id) ?? []
      list.push({ category: s.category, score: Number(s.score) })
      scoresByCollected.set(s.collected_card_id, list)
    }

    const cardSummaries = cards.map((c) => {
      const collectedId = cardIdToCollectedId.get(c.id as string)
      const scores = collectedId ? scoresByCollected.get(collectedId) ?? [] : []
      return {
        id: c.id,
        name: c.card_name || 'Unknown',
        title: c.custom_title || '',
        expertise: c.custom_content || '',
        description: (c.description || '').slice(0, 200),
        scores: scores.map((s) => `${s.category}:${s.score}`).join(', '),
      }
    })

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ message: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const systemPrompt = `You are a networking assistant. The user has collected professional cards and is asking for recommendations.
Given their query and the list of collected professionals (with names, titles, expertise, and ratings the user gave), recommend the best matches.
Return ONLY valid JSON in this exact format: {"ids": ["uuid1", "uuid2", ...], "reasons": {"uuid1": "brief reason in Korean", "uuid2": "..."}}
Order ids by relevance (best match first). Include 1-5 recommendations. If no good match, return empty ids array.`

    const userPrompt = `User request: "${query.trim()}"

Collected professionals:
${JSON.stringify(cardSummaries, null, 2)}`

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
      return new Response(
        JSON.stringify({ message: err?.error?.message || 'AI error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return new Response(
        JSON.stringify({ recommendations: [], cards: [], message: '추천을 생성하지 못했어요.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let parsed: { ids?: string[]; reasons?: Record<string, string> }
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return new Response(
        JSON.stringify({ recommendations: [], cards: [], message: '추천을 생성하지 못했어요.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const idsFromAi = parsed.ids ?? []
    const reasons = parsed.reasons ?? {}
    const cardMap = new Map(cards.map((c) => [c.id, c]))
    const recommendedCards = idsFromAi
      .filter((id) => cardMap.has(id))
      .map((id) => ({
        card: cardMap.get(id)!,
        reason: reasons[id] || '',
      }))

    return new Response(
      JSON.stringify({
        recommendations: recommendedCards,
        cards: recommendedCards.map((r) => r.card),
        message: recommendedCards.length > 0
          ? `${recommendedCards.length}명을 추천해요`
          : '조건에 맞는 인재를 찾지 못했어요.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('[recommend-from-collected]', e)
    return new Response(
      JSON.stringify({ message: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
