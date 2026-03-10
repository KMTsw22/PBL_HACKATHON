import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type OpenAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string }

const ORCHESTRATOR_SYSTEM = `You are the top-level AI Agent (오케스트레이터). You coordinate multiple sub-agents and combine their answers.

Sub-agents (tools) — **call multiple when the request is broad**:
1. recommend_talent(query) - People/team from user's collected cards. Query in Korean (e.g. "프론트엔드 개발자").
2. suggest_idea(user_request) - App/product brainstorming and planning advice. Use when user says they want to "make an app", "build something", or need ideas.
3. suggest_tech(idea_summary) - Tech stack (frontend, backend, DB, deployment) for an app idea. Pass a short idea summary.
4. suggest_contact(user_request) - Who to contact from collected cards and how to reach out. Use when user wants to "연락하고 싶어", "컨택해보려고", "이 사람한테 어떻게 말 걸지", or needs outreach/message tips.

**Important**: For broad requests like "팬커뮤니티 만들고 싶어", "어떤 앱 만들고 싶다" you MUST call at least 2 agents so they collaborate:
- First call suggest_idea with the user's request (get planning/idea advice).
- Then call suggest_tech with a brief summary of that idea (get tech stack).
This way the user sees multiple experts working together. When the user mentions contacting someone or networking (컨택, 연락, 메시지, 어떻게 말하지), also call suggest_contact. After you get all tool results, write a short final summary in Korean that ties their answers together.`

async function runRecommendTalent(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  userId: string,
  query: string
): Promise<{ summary: string; recommendations: { card: Record<string, unknown>; reason: string }[] }> {
  const { data: collectedRows } = await supabase
    .from('collected_cards')
    .select('id, card_id')
    .eq('user_id', userId)

  if (!collectedRows?.length) {
    return { summary: '수집한 명함이 없습니다.', recommendations: [] }
  }

  const collectedIds = collectedRows.map((r) => r.id)
  const cardIdList = collectedRows.map((r) => r.card_id).filter(Boolean)
  const cardIdToCollectedId = new Map(collectedRows.map((r) => [r.card_id, r.id]))

  const [cardsRes, scoresRes] = await Promise.all([
    supabase.from('user_cards').select('*').in('id', cardIdList),
    supabase.from('collected_card_scores').select('collected_card_id, category, score').in('collected_card_id', collectedIds),
  ])

  const cards = (cardsRes.data ?? []) as Record<string, unknown>[]
  const scoresRows = scoresRes.data ?? []
  const scoresByCollected = new Map<string, { category: string; score: number }[]>()
  for (const s of scoresRows as { collected_card_id: string; category: string; score: number }[]) {
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

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Return ONLY valid JSON: {"ids": ["uuid1", ...], "reasons": {"uuid1": "reason in Korean", ...}}. Order by relevance. 1-5 recommendations.',
        },
        {
          role: 'user',
          content: `User request: "${query}"\n\nCollected professionals:\n${JSON.stringify(cardSummaries, null, 2)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  })

  if (!res.ok) return { summary: '인재 추천 중 오류가 났습니다.', recommendations: [] }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) return { summary: '추천 결과가 없습니다.', recommendations: [] }

  let parsed: { ids?: string[]; reasons?: Record<string, string> }
  try {
    parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return { summary: '추천 결과를 파싱하지 못했습니다.', recommendations: [] }
  }

  const idsFromAi = parsed.ids ?? []
  const reasons = parsed.reasons ?? {}
  const cardMap = new Map(cards.map((c) => [c.id, c]))
  const recommendations = idsFromAi
    .filter((id) => cardMap.has(id))
    .map((id) => ({ card: cardMap.get(id)!, reason: reasons[id] || '' }))

  const names = recommendations.map((r) => (r.card as Record<string, unknown>).card_name || 'Unknown').join(', ')
  return {
    summary: recommendations.length > 0 ? `인재 추천 결과: ${recommendations.length}명 (${names}). 각자 추천 이유가 있습니다.` : '조건에 맞는 인재를 찾지 못했습니다.',
    recommendations,
  }
}

async function runSuggestContact(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  userId: string,
  userRequest: string
): Promise<{ summary: string; recommendations: { card: Record<string, unknown>; reason: string }[] }> {
  const { data: collectedRows } = await supabase
    .from('collected_cards')
    .select('id, card_id')
    .eq('user_id', userId)

  if (!collectedRows?.length) {
    return { summary: '수집한 명함이 없어서 연락 추천을 할 수 없어요.', recommendations: [] }
  }

  const cardIdList = collectedRows.map((r) => r.card_id).filter(Boolean)
  const cardIdToCollectedId = new Map(collectedRows.map((r) => [r.card_id, r.id]))
  const collectedIds = collectedRows.map((r) => r.id)

  const [cardsRes, scoresRes] = await Promise.all([
    supabase.from('user_cards').select('*').in('id', cardIdList),
    supabase.from('collected_card_scores').select('collected_card_id, category, score').in('collected_card_id', collectedIds),
  ])

  const cards = (cardsRes.data ?? []) as Record<string, unknown>[]
  const scoresRows = scoresRes.data ?? []
  const scoresByCollected = new Map<string, { category: string; score: number }[]>()
  for (const s of scoresRows as { collected_card_id: string; category: string; score: number }[]) {
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
      contact: [c.email, c.kakao_id, c.phone].filter(Boolean).join(', '),
      description: (c.description || '').slice(0, 150),
      scores: scores.map((s) => `${s.category}:${s.score}`).join(', '),
    }
  })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a contact/outreach advisor. User has collected business cards. Return ONLY valid JSON in Korean:
{"ids": ["uuid1", ...], "reasons": {"uuid1": "why contact in Korean", ...}, "outreachTip": "한 문단 연락 팁 또는 메시지 초안 (한국어)"}
Suggest 1-3 people to contact. Order by relevance. outreachTip should be practical (how to start the message, what to ask).`,
        },
        {
          role: 'user',
          content: `User request: "${userRequest}"\n\nCollected contacts:\n${JSON.stringify(cardSummaries, null, 2)}`,
        },
      ],
      max_tokens: 550,
      temperature: 0.4,
    }),
  })

  if (!res.ok) return { summary: '컨택 추천 중 오류가 났습니다.', recommendations: [] }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) return { summary: '연락 추천 결과가 없습니다.', recommendations: [] }

  let parsed: { ids?: string[]; reasons?: Record<string, string>; outreachTip?: string }
  try {
    parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return { summary: '연락 추천 결과를 파싱하지 못했습니다.', recommendations: [] }
  }

  const idsFromAi = parsed.ids ?? []
  const reasons = parsed.reasons ?? {}
  const outreachTip = parsed.outreachTip ?? ''
  const cardMap = new Map(cards.map((c) => [c.id, c]))
  const recs = idsFromAi
    .filter((id) => cardMap.has(id))
    .map((id) => ({ card: cardMap.get(id)!, reason: reasons[id] || '' }))

  const names = recs.map((r) => (r.card as Record<string, unknown>).card_name || 'Unknown').join(', ')
  const summary =
    (recs.length > 0 ? `연락 추천: ${recs.length}명 (${names}).\n` : '조건에 맞는 연락처를 찾지 못했어요.\n') +
    (outreachTip ? `\n[연락 팁]\n${outreachTip}` : '')

  return { summary, recommendations: recs }
}

async function callLlm(openaiKey: string, systemPrompt: string, userContent: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 600,
      temperature: 0.5,
    }),
  })
  if (!res.ok) return '응답을 생성하지 못했습니다.'
  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() ?? '응답이 비어 있습니다.'
}

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'recommend_talent',
      description: '수집한 명함 중에서 사용자가 원하는 인재(팀원, 전문가)를 추천합니다. 인재 구함, 팀원 구해요, 개발자 필요 등일 때 사용하세요.',
      parameters: { type: 'object' as const, properties: { query: { type: 'string', description: '추천 조건 (한국어, 예: 프론트엔드 개발자)' } }, required: ['query'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_idea',
      description: '사용자가 만들고 싶은 앱/서비스에 대한 기획·아이디어 조언을 합니다. 어떤 앱을 만들고 싶다, 아이디어가 없다 등일 때 사용하세요.',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '사용자의 요청 내용' } }, required: ['user_request'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_tech',
      description: '앱/서비스 아이디어에 맞는 기술 스택(프레임워크, DB, 배포 등)을 추천합니다.',
      parameters: { type: 'object' as const, properties: { idea_summary: { type: 'string', description: '앱 아이디어 요약' } }, required: ['idea_summary'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_contact',
      description: '수집한 명함 중에서 누구에게 연락할지 추천하고, 연락 팁/메시지 초안을 제안합니다. 연락하고 싶어, 컨택해보려고, 어떻게 말 걸지 등일 때 사용하세요.',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '사용자의 요청 (예: 프로젝트 제안하고 싶어, 이 분한테 연락할게)' } }, required: ['user_request'] },
    },
  },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ message: 'Authorization header required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let body: { messages?: { role: string; content: string }[] }
    try {
      body = (await req.json()) as { messages?: { role: string; content: string }[] }
    } catch {
      return new Response(JSON.stringify({ message: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const messages = body.messages ?? []
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ message: 'messages array required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ message: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ message: 'OPENAI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const openAiMessages: OpenAIMessage[] = [
      { role: 'system', content: ORCHESTRATOR_SYSTEM },
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    let recommendations: { card: Record<string, unknown>; reason: string }[] = []
    const agentsUsed = new Set<string>()
    const agentResponses: { agent: string; content: string }[] = []

    for (let round = 0; round < 5; round++) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          tools: TOOLS,
          tool_choice: 'auto',
          max_tokens: 800,
          temperature: 0.4,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ message: (err as { error?: { message?: string } })?.error?.message ?? 'AI 오류' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const data = await res.json()
      const choice = data?.choices?.[0]
      const msg = choice?.message
      if (!msg) {
        return new Response(
          JSON.stringify({ message: 'AI 응답이 비어 있습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      openAiMessages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      })

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const finalText = (msg.content ?? '').trim() || '답변을 생성하지 못했어요.'
        return new Response(
          JSON.stringify({
            message: finalText,
            recommendations: recommendations.length > 0 ? recommendations : undefined,
            agentsUsed: Array.from(agentsUsed),
            agentResponses: agentResponses.length > 0 ? agentResponses : undefined,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      for (const tc of msg.tool_calls) {
        const name = tc.function?.name
        const args = (() => {
          try {
            return JSON.parse(tc.function?.arguments ?? '{}')
          } catch {
            return {}
          }
        })()

        let toolResult: string
        let agentLabel: string

        if (name === 'recommend_talent') {
          agentLabel = '인재 추천'
          agentsUsed.add(agentLabel)
          const out = await runRecommendTalent(supabase, openaiKey, user.id, args.query ?? '')
          recommendations.push(...out.recommendations)
          toolResult = out.summary
        } else if (name === 'suggest_idea') {
          agentLabel = '기획·아이디어'
          agentsUsed.add(agentLabel)
          toolResult = await callLlm(
            openaiKey,
            'You are an app/product idea consultant. Answer in Korean. Give concise, practical brainstorming and planning advice.',
            args.user_request ?? ''
          )
        } else if (name === 'suggest_tech') {
          agentLabel = '기술 스택'
          agentsUsed.add(agentLabel)
          toolResult = await callLlm(
            openaiKey,
            'You recommend technology stacks (frontend, backend, DB, deployment) for app ideas. Answer in Korean. Be specific (e.g. React, Node, Supabase).',
            args.idea_summary ?? ''
          )
        } else if (name === 'suggest_contact') {
          agentLabel = '컨택'
          agentsUsed.add(agentLabel)
          const out = await runSuggestContact(supabase, openaiKey, user.id, args.user_request ?? '')
          recommendations.push(...out.recommendations)
          toolResult = out.summary
        } else {
          agentLabel = '알 수 없음'
          toolResult = '알 수 없는 도구입니다.'
        }

        agentResponses.push({ agent: agentLabel, content: toolResult })
        openAiMessages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult })
      }
    }

    const lastAssistant = openAiMessages.filter((m) => m.role === 'assistant').pop() as { content?: string | null } | undefined
    const finalText = (lastAssistant?.content ?? '').trim() || '답변이 길어져 여기서 마무리할게요.'
    return new Response(
      JSON.stringify({
        message: finalText,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        agentsUsed: Array.from(agentsUsed),
        agentResponses: agentResponses.length > 0 ? agentResponses : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('[ask-agent]', e)
    return new Response(
      JSON.stringify({ message: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
