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

const ORCHESTRATOR_SYSTEM = `You are the top-level AI Agent (오케스트레이터). You coordinate sub-agents. **All recommendations for people/contacts come ONLY from the user's collected name cards** — there is no external talent pool.

Sub-agents (tools). Call ONE tool per turn. After each result you get another turn.

1. **suggest_idea(user_request)** — 기획 에이전트. 사용자가 만들고 싶은 앱/서비스에 대해 어떤 기획을 할지 정합니다. "스포츠 앱 만들고 싶어", "앱 아이디어 있어?" 등일 때 사용.

2. **suggest_tech(idea_summary)** — 개발 에이전트. 기획 요약을 받아 적합한 기술 스택(프론트/백엔드/DB/배포)을 추천합니다. suggest_idea 결과가 있으면 그 요약을 넘기세요.

3. **recommend_talent(query)** — 인맥 에이전트. **수집한 명함만** 대상으로, 조건에 맞는 사람을 찾습니다. 조건은 전공·지식·기술 스택·지역·취미 등 자유 형식입니다.
   - 예: "스포츠/기획 지식 있는 기획자", "React 사용 가능한 개발자", "망원동 근처", "당구 치는 사람"
   - 앱 기획·개발 맥락이면: 먼저 suggest_idea → suggest_tech 한 뒤, recommend_talent로 "해당 기획 지식을 아는 사람", "해당 스택 쓸 수 있는 사람"을 찾도록 query를 짭니다.

4. **suggest_contact(user_request)** — 컨택 에이전트. **수집한 명함만** 대상으로, 누구에게 연락할지 추천하고, 목적에 맞는 연락 메시지 초안을 제안합니다.
   - 예: "연락하고 싶어", "컨택해보려고", "이 사람한테 어떻게 말 걸지"
   - 예: "망원동에서 당구 치고 싶어" → 망원동 근처에 사는 사람 / 당구 치는 사람을 찾고, 당구 치자고 유혹하는 연락 초안 제안

**Flow 예시**
- "스포츠 앱 만들고 싶어" → suggest_idea(요청) → suggest_tech(기획 요약) → recommend_talent("스포츠 앱 기획 지식 있는 사람") → 필요 시 recommend_talent("추천받은 스택 사용 가능한 사람") → 최종 정리.
- "망원동에서 당구 치고 싶어" → recommend_talent("망원동 근처 또는 당구 치는 사람") 또는 suggest_contact(요청). suggest_contact는 "누구에게 연락할지 + 당구 치자고 하는 메시지 초안"까지 제공.

Always reply with a final summary in Korean. No more tool calls when you have enough to answer.

---

**멀티 에이전트 파이프라인 (선택)**  
요청이 "팀 구성 + 연락"이면 아래 순서로 호출할 수 있습니다.
- **analyze_request** → 요청에서 조건·컨텍스트 추출 (Data Miner)
- **context_matcher** → 조건에 맞는 인원 선정 (Context Matcher)
- **message_architect** → 선정 인원별 개인화 메시지 초안 (Message Architect)
- **channel_dispatcher** → 카드별 추천 채널 + 발송용 문구 (Channel Dispatcher)

또는 단순 요청이면 recommend_talent / suggest_contact만 써도 됩니다.`

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

  console.log('[ask-agent] OpenAI 호출 #runRecommendTalent (인맥 추천)')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You recommend people from the user's collected name cards that match the given condition.
Condition can be about: expertise/domain knowledge, tech stack, location (지역, 동네), hobby/interest (취미), job role, etc. Match from name, title, expertise, description, and any hints in the data.
Return ONLY valid JSON: {"ids": ["uuid1", ...], "reasons": {"uuid1": "reason in Korean", ...}}. Order by relevance. 1-5 recommendations. Reasons should explain why they match (e.g. 지역이 맞음, 해당 스택 언급, 취미 일치).`,
        },
        {
          role: 'user',
          content: `Condition: "${query}"\n\nCollected cards (name, title, expertise, description, scores):\n${JSON.stringify(cardSummaries, null, 2)}`,
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
    const contactParts = [(c as Record<string, unknown>).email, (c as Record<string, unknown>).kakao_id, (c as Record<string, unknown>).phone].filter(Boolean)
    return {
      id: c.id,
      name: c.card_name || 'Unknown',
      title: c.custom_title || '',
      expertise: c.custom_content || '',
      contact: contactParts.join(', '),
      description: String((c as Record<string, unknown>).description || '').slice(0, 150),
      scores: scores.map((s) => `${s.category}:${s.score}`).join(', '),
    }
  })

  console.log('[ask-agent] OpenAI 호출 #runSuggestContact (컨택 추천)')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You recommend who to contact from the user's collected name cards and suggest an outreach message draft.
Use cases: business (프로젝트 제안, 협업), or casual (만나고 싶어, 같이 뭔가 하고 싶어 — e.g. "망원동에서 당구 치고 싶어" → 망원동 근처/당구 치는 사람 추천 + 당구 치자고 유혹하는 연락 초안).
Return ONLY valid JSON in Korean:
{"ids": ["uuid1", ...], "reasons": {"uuid1": "why contact in Korean", ...}, "outreachTip": "연락 팁 또는 실제 쓸 수 있는 메시지 초안 (한국어, 친근하고 목적에 맞게)"}
Suggest 1-3 people. outreachTip: what to say, how to start, or a short message draft they can send.`,
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
  console.log('[ask-agent] OpenAI 호출 #callLlm (기획·아이디어 또는 기술 스택)')
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

type CardSummary = {
  id: string
  name: string
  title: string
  expertise: string
  description: string
  scores: string
  contact?: string
}

async function getCollectedCardsWithSummaries(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  options?: { includeContact?: boolean }
): Promise<{ cards: Record<string, unknown>[]; cardSummaries: CardSummary[] }> {
  const { data: collectedRows } = await supabase
    .from('collected_cards')
    .select('id, card_id')
    .eq('user_id', userId)
  if (!collectedRows?.length) return { cards: [], cardSummaries: [] }

  const cardIdList = collectedRows.map((r) => r.card_id).filter(Boolean) as string[]
  const cardToCollectedId = new Map(collectedRows.map((r) => [r.card_id, r.id]))
  const collectedIds = collectedRows.map((r) => r.id)

  const [cardsRes, scoresRes] = await Promise.all([
    supabase.from('user_cards').select('*').in('id', cardIdList),
    supabase.from('collected_card_scores').select('collected_card_id, category, score').in('collected_card_id', collectedIds),
  ])
  const cards = (cardsRes.data ?? []) as Record<string, unknown>[]
  const scoresRows = (scoresRes.data ?? []) as { collected_card_id: string; category: string; score: number }[]
  const scoresByCollected = new Map<string, { category: string; score: number }[]>()
  for (const s of scoresRows) {
    const list = scoresByCollected.get(s.collected_card_id) ?? []
    list.push({ category: s.category, score: Number(s.score) })
    scoresByCollected.set(s.collected_card_id, list)
  }

  const cardSummaries: CardSummary[] = cards.map((c) => {
    const collectedId = cardToCollectedId.get(c.id as string)
    const scores = collectedId ? scoresByCollected.get(collectedId) ?? [] : []
    const row: CardSummary = {
      id: c.id as string,
      name: String(c.card_name || 'Unknown'),
      title: String(c.custom_title || ''),
      expertise: String(c.custom_content || ''),
      description: String(c.description || '').slice(0, 200),
      scores: scores.map((s) => `${s.category}:${s.score}`).join(', '),
    }
    if (options?.includeContact) {
      const contactParts = [c.email, c.kakao_id, c.phone].filter(Boolean).map(String)
      row.contact = contactParts.join(', ')
    }
    return row
  })
  return { cards, cardSummaries }
}

/** Data Miner: 요청에서 구조화된 조건·컨텍스트 추출 */
async function runAnalyzeRequest(openaiKey: string, userRequest: string): Promise<string> {
  console.log('[ask-agent] OpenAI 호출 #analyze_request (Data Miner)')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You analyze the user's request and extract structured criteria for finding people and context for communication.
Return ONLY valid JSON (no markdown): {"criteria": "한국어로 추천 조건 (기술 스택, 지역, 취미, 역할 등)", "context_type": "business" or "casual", "summary": "한 줄 요약 (한국어)"}
- context_type: "business" = 프로젝트/협업/진지한 스터디 등, "casual" = 술자리/번개/만남/취미 등
- criteria: 수집 명함에서 누구를 찾을지 조건 (예: "React 가능한 개발자", "망원동 근처 당구 좋아하는 사람")`,
        },
        { role: 'user', content: userRequest },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  })
  if (!res.ok) return JSON.stringify({ criteria: userRequest, context_type: 'business', summary: '요청 분석 실패' })
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) return JSON.stringify({ criteria: userRequest, context_type: 'business', summary: '' })
  return content
}

/** Context Matcher: 조건·컨텍스트에 맞는 인원 선정 (적합성 가중치 반영) */
async function runContextMatcher(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  userId: string,
  criteria: string,
  contextType: string
): Promise<{ summary: string; recommendations: { card: Record<string, unknown>; reason: string }[] }> {
  const { cards, cardSummaries } = await getCollectedCardsWithSummaries(supabase, userId)
  if (!cards.length) return { summary: '수집한 명함이 없습니다.', recommendations: [] }

  console.log('[ask-agent] OpenAI 호출 #context_matcher (Context Matcher)')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You select and rank people from the user's collected cards that best match the criteria.
context_type: "business" = weigh technical fit, collaboration potential, project experience. "casual" = weigh location, hobby, availability for casual meetups.
Return ONLY valid JSON: {"ids": ["uuid1", ...], "reasons": {"uuid1": "reason in Korean", ...}}. Order by fit. 1-5 people. Reasons explain why they match (적합성).`,
        },
        {
          role: 'user',
          content: `criteria: "${criteria}"\ncontext_type: ${contextType}\n\nCollected cards:\n${JSON.stringify(cardSummaries, null, 2)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  })
  if (!res.ok) return { summary: '컨텍스트 매칭 중 오류가 났습니다.', recommendations: [] }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) return { summary: '매칭 결과가 없습니다.', recommendations: [] }
  let parsed: { ids?: string[]; reasons?: Record<string, string> }
  try {
    parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return { summary: '매칭 결과를 파싱하지 못했습니다.', recommendations: [] }
  }
  const idsFromAi = parsed.ids ?? []
  const reasons = parsed.reasons ?? {}
  const cardMap = new Map(cards.map((c) => [c.id as string, c]))
  const recommendations = idsFromAi
    .filter((id) => cardMap.has(id))
    .map((id) => ({ card: cardMap.get(id)!, reason: reasons[id] || '' }))
  const names = recommendations.map((r) => (r.card as Record<string, unknown>).card_name || 'Unknown').join(', ')
  return {
    summary: recommendations.length > 0 ? `선정: ${recommendations.length}명 (${names}). 적합성 기준으로 선정했습니다.` : '조건에 맞는 인원을 찾지 못했습니다.',
    recommendations,
  }
}

/** Message Architect: 선정 인원별 개인화 메시지 초안 (말투·목적 반영) */
async function runMessageArchitect(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  userId: string,
  userRequest: string,
  cardIdsJson: string,
  tone: string
): Promise<string> {
  const { cards, cardSummaries } = await getCollectedCardsWithSummaries(supabase, userId, { includeContact: true })
  let ids: string[] = []
  try {
    const parsed = JSON.parse(cardIdsJson)
    ids = Array.isArray(parsed) ? parsed : parsed.ids ? parsed.ids : []
  } catch {
    ids = cardIdsJson.split(',').map((s) => s.trim()).filter(Boolean)
  }
  const selected = cardSummaries.filter((s) => ids.length === 0 || ids.includes(s.id))
  if (selected.length === 0) return '선정된 인원이 없어 메시지 초안을 만들 수 없습니다.'

  console.log('[ask-agent] OpenAI 호출 #message_architect (Message Architect)')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write personalized outreach message drafts for each person. Tone: "business" = professional, project/collaboration. "casual" = friendly, invite to hang out (e.g. 당구 치자, 만나서 놀자).
Return a single text in Korean with clear sections per person:
"## [이름]\n[메시지 초안]\n"
Adjust tone to relationship (선배/동료/초면) and purpose. Keep each draft short and sendable.`,
        },
        {
          role: 'user',
          content: `User request: "${userRequest}"\ntone: ${tone}\n\nPeople to message:\n${JSON.stringify(selected, null, 2)}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.5,
    }),
  })
  if (!res.ok) return '메시지 초안 생성 중 오류가 났습니다.'
  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() ?? '메시지 초안을 생성하지 못했습니다.'
}

/** Channel Dispatcher: 카드별 추천 채널 + 발송용 문구 */
async function runChannelDispatcher(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  cardId: string,
  messageDraft: string
): Promise<string> {
  const { cards } = await getCollectedCardsWithSummaries(supabase, userId, { includeContact: true })
  const card = cards.find((c) => c.id === cardId) as Record<string, unknown> | undefined
  if (!card) return '해당 카드를 찾을 수 없습니다.'
  const kakao = card.kakao_id ?? card.kakaotalk_id
  const email = card.email
  const phone = card.phone
  const channels: string[] = []
  if (kakao) channels.push('카카오톡')
  if (email) channels.push('이메일')
  if (phone) channels.push('문자/전화')
  const preferred = channels[0] || '연락처 없음'
  return `추천 채널: ${preferred}\n발송용 문구:\n${messageDraft}`
}

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'analyze_request',
      description: 'Data Miner. 사용자 요청에서 추천 조건(criteria)과 컨텍스트(business/casual)를 추출합니다. 파이프라인 첫 단계.',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '사용자 요청 (한국어)' } }, required: ['user_request'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'context_matcher',
      description: 'Context Matcher. 추출된 조건에 맞는 인원을 수집 명함에서 선정합니다. business=협업/실력, casual=지역/취미/만남 가중치.',
      parameters: {
        type: 'object' as const,
        properties: {
          criteria: { type: 'string', description: '추천 조건 (한국어)' },
          context_type: { type: 'string', description: '"business" or "casual"' },
        },
        required: ['criteria', 'context_type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'message_architect',
      description: 'Message Architect. 선정된 인원별로 관계·목적에 맞는 개인화 메시지 초안을 작성합니다.',
      parameters: {
        type: 'object' as const,
        properties: {
          user_request: { type: 'string', description: '사용자 요청' },
          card_ids: { type: 'string', description: '선정된 카드 id 배열 JSON (예: ["uuid1","uuid2"])' },
          tone: { type: 'string', description: '"business" or "casual"' },
        },
        required: ['user_request', 'card_ids', 'tone'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'channel_dispatcher',
      description: 'Channel Dispatcher. 대상 카드의 연락처를 보고 추천 채널(카카오/이메일/문자)과 발송용 문구를 제안합니다.',
      parameters: {
        type: 'object' as const,
        properties: {
          card_id: { type: 'string', description: '카드 id' },
          message_draft: { type: 'string', description: '해당 인물용 메시지 초안' },
        },
        required: ['card_id', 'message_draft'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_idea',
      description: '기획 에이전트. 만들고 싶은 앱/서비스에 대해 어떤 기획을 할지 조언합니다.',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '사용자 요청 (한국어)' } }, required: ['user_request'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_tech',
      description: '개발 에이전트. 기획 요약에 맞는 기술 스택(프론트/백엔드/DB/배포) 추천.',
      parameters: { type: 'object' as const, properties: { idea_summary: { type: 'string', description: '기획 아이디어 요약' } }, required: ['idea_summary'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'recommend_talent',
      description: '인맥 에이전트. 수집한 명함 중 조건에 맞는 사람 추천 (단축 플로우).',
      parameters: { type: 'object' as const, properties: { query: { type: 'string', description: '추천 조건 (한국어)' } }, required: ['query'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_contact',
      description: '컨택 에이전트. 수집한 명함 중 연락 대상 + 메시지 초안 제안 (단축 플로우).',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '사용자 요청 (한국어)' } }, required: ['user_request'] },
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

    const rawMessages = body.messages ?? []
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(JSON.stringify({ message: 'messages array required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const messages = rawMessages
      .filter((m) => m && typeof m.role === 'string')
      .map((m) => ({ role: m.role, content: String(m.content ?? '') }))
    if (messages.length === 0) {
      return new Response(JSON.stringify({ message: 'Valid messages (role, content) required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      ...messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '(empty)' })),
    ]

    let recommendations: { card: Record<string, unknown>; reason: string }[] = []
    const agentsUsed = new Set<string>()
    const agentResponses: { agent: string; content: string }[] = []
    type Step = { type: 'request'; to: string; requestText: string } | { type: 'response'; from: string; content: string }
    const steps: Step[] = []
    let openAiCallCount = 0

    for (let round = 0; round < 10; round++) {
      openAiCallCount += 1 // 오케스트레이터 1회
      console.log('[ask-agent] OpenAI 호출 #orchestrator', { round: round + 1 })
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

      let data: { choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[] }
      try {
        data = await res.json()
      } catch {
        return new Response(
          JSON.stringify({ message: 'AI 응답 파싱 실패' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const choice = data?.choices?.[0]
      const msg = choice?.message
      if (!msg) {
        const errDetail = (data as { error?: { message?: string } })?.error?.message
        return new Response(
          JSON.stringify({ message: errDetail || 'AI 응답이 비어 있습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const finalText = (msg.content ?? '').trim() || '답변을 생성하지 못했어요.'
        return new Response(
          JSON.stringify({
            message: finalText,
            recommendations: recommendations.length > 0 ? recommendations : undefined,
            agentsUsed: Array.from(agentsUsed),
            agentResponses: agentResponses.length > 0 ? agentResponses : undefined,
            steps: steps.length > 0 ? steps : undefined,
            openAiCallCount,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      openAiMessages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: [msg.tool_calls[0]],
      })

      // 한 턴에 하나의 도구만 실행: 총괄이 한 명한테 물어보고 → 답 받고 → 다음 턴에서 다음 에이전트 호출
      const tc = msg.tool_calls[0]
      if (!tc || !tc.function) {
        console.error('[ask-agent] invalid tool_call', tc)
        return new Response(
          JSON.stringify({ message: '도구 호출 형식이 올바르지 않아요.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
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
      let requestText: string

      if (name === 'analyze_request') {
        agentLabel = 'Data Miner'
        requestText = `요청 분석: "${args.user_request ?? ''}"`
        agentsUsed.add(agentLabel)
        steps.push({ type: 'request', to: agentLabel, requestText })
        openAiCallCount += 1
        toolResult = await runAnalyzeRequest(openaiKey, args.user_request ?? '')
      } else if (name === 'context_matcher') {
        agentLabel = 'Context Matcher'
        requestText = `컨텍스트 매칭: "${args.criteria ?? ''}" (${args.context_type ?? 'business'})`
        agentsUsed.add(agentLabel)
        steps.push({ type: 'request', to: agentLabel, requestText })
        openAiCallCount += 1
        const out = await runContextMatcher(supabase, openaiKey, user.id, args.criteria ?? '', args.context_type ?? 'business')
        recommendations.push(...out.recommendations)
        toolResult = out.summary
      } else if (name === 'message_architect') {
        agentLabel = 'Message Architect'
        requestText = `메시지 설계: tone=${args.tone ?? 'business'}`
        agentsUsed.add(agentLabel)
        steps.push({ type: 'request', to: agentLabel, requestText })
        openAiCallCount += 1
        toolResult = await runMessageArchitect(supabase, openaiKey, user.id, args.user_request ?? '', args.card_ids ?? '[]', args.tone ?? 'business')
      } else if (name === 'channel_dispatcher') {
        agentLabel = 'Channel Dispatcher'
        requestText = `채널·발송: card_id=${String(args.card_id ?? '').slice(0, 8)}...`
        agentsUsed.add(agentLabel)
        steps.push({ type: 'request', to: agentLabel, requestText })
        toolResult = await runChannelDispatcher(supabase, user.id, String(args.card_id ?? ''), String(args.message_draft ?? ''))
      } else if (name === 'recommend_talent') {
        agentLabel = '인맥 추천'
        requestText = `인맥 추천: "${args.query ?? ''}"`
        agentsUsed.add(agentLabel)
        steps.push({ type: 'request', to: agentLabel, requestText })
        openAiCallCount += 1
        const out = await runRecommendTalent(supabase, openaiKey, user.id, args.query ?? '')
        recommendations.push(...out.recommendations)
        toolResult = out.summary
      } else if (name === 'suggest_idea') {
        agentLabel = '기획·아이디어'
        requestText = `기획·아이디어 조언 요청: "${args.user_request ?? ''}"`
        agentsUsed.add(agentLabel)
        steps.push({ type: 'request', to: agentLabel, requestText })
        openAiCallCount += 1
        toolResult = await callLlm(
          openaiKey,
          'You are an app/product idea consultant. Answer in Korean. Give concise, practical brainstorming and planning advice.',
          args.user_request ?? ''
        )
      } else if (name === 'suggest_tech') {
        agentLabel = '기술 스택'
        requestText = `기술 스택 추천 요청 (아이디어 요약): "${args.idea_summary ?? ''}"`
        agentsUsed.add(agentLabel)
        steps.push({ type: 'request', to: agentLabel, requestText })
        openAiCallCount += 1
        toolResult = await callLlm(
          openaiKey,
          'You recommend technology stacks (frontend, backend, DB, deployment) for app ideas. Answer in Korean. Be specific (e.g. React, Node, Supabase).',
          args.idea_summary ?? ''
        )
      } else if (name === 'suggest_contact') {
        agentLabel = '컨택'
        requestText = `컨택·연락 추천 요청: "${args.user_request ?? ''}"`
        agentsUsed.add(agentLabel)
        steps.push({ type: 'request', to: agentLabel, requestText })
        openAiCallCount += 1
        const out = await runSuggestContact(supabase, openaiKey, user.id, args.user_request ?? '')
        recommendations.push(...out.recommendations)
        toolResult = out.summary
      } else {
        agentLabel = '알 수 없음'
        requestText = ''
        toolResult = '알 수 없는 도구입니다.'
      }

      steps.push({ type: 'response', from: agentLabel, content: toolResult })
      agentResponses.push({ agent: agentLabel, content: toolResult })
      openAiMessages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult })
    }

    const lastAssistant = openAiMessages.filter((m) => m.role === 'assistant').pop() as { content?: string | null } | undefined
    const finalText = (lastAssistant?.content ?? '').trim() || '답변이 길어져 여기서 마무리할게요.'
    return new Response(
      JSON.stringify({
        message: finalText,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        agentsUsed: Array.from(agentsUsed),
        agentResponses: agentResponses.length > 0 ? agentResponses : undefined,
        steps: steps.length > 0 ? steps : undefined,
        openAiCallCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[ask-agent]', err.message, err.stack)
    return new Response(
      JSON.stringify({ message: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
