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

**핵심: 하위 에이전트에게 물어볼 때 이전 내용을 생략하면 안 됨. 필요 없는 부분만 줄일 수 있더라도 구체적으로 넘겨야 함.**
- 각 도구 호출 후 당신은 해당 서브에이전트의 **전체 답변**을 받습니다. 그 내용을 **요약만 하지 말고**, 다음 에이전트에게 넘길 때 **반드시 맥락을 충분히 포함**하세요.
- **message_architect** 호출 시: user_request에 "메시지 설계: tone=business" 한 줄만 넣으면 안 됨. **기획·기술·Data Miner가 정리한 내용·Context Matcher 선정 맥락**을 생략하지 말고 구체적으로 넣을 것. card_ids에는 context_matcher가 방금 반환한 선정 인원의 카드 id 배열(JSON 문자열, 예: ["uuid1","uuid2"])을 **반드시** 넣을 것.
- 예: 사용자 "당구 어플 만들고 싶어" → suggest_idea 호출 → 기획 에이전트가 "기능 정의(게임 매칭, 스코어 기록, 튜토리얼, 소셜), 타겟(초보~숙련자), UI/UX 방향, 마케팅 전략..." 등 **자세히** 답함.  
  그다음 suggest_tech를 부를 때 **짧게 "당구 어플 기획" 이렇게만 넘기면 안 됨.**  
  반드시: "기획·아이디어 에이전트가 당구 어플에 대해 [기능: 게임 매칭·스코어 기록·튜토리얼·소셜], [타겟: 초보~숙련자], [UI/UX: 직관적·실시간 점수 화면], [마케팅: SNS·동호회 협업] 이렇게 정리해줬어. 이 기획 기준으로 개발 시 프론트/백엔드/DB/배포 기술 스택 추천해줘. 개발에 문제 없을까?" 처럼 **기획이 말한 내용을 토대로** 구체적으로 물어봐야 함.
- recommend_talent 호출 시에도 suggest_idea·suggest_tech 결과를 반영해 "기획에서 ~~이렇게 정했고, 기술은 ~~이렇게 추천받았어. 이 기획·스택에 맞는 사람 찾아줘" 처럼 **길게, 자세히** query를 넣으세요.
- **suggest_contact 호출 시 user_request는 반드시 매우 자세히.** "연락하고 싶어" 한 줄 금지. 다음을 **문단으로 나누어** 포함할 것:
  - **기획 에이전트**가 답한 내용: 기능 정의, 타겟 사용자, UI/UX 방향, 마케팅·운영 등 — **요약이 아니라 거의 전부** 문단별로.
  - **개발 에이전트**가 답한 내용: 프론트/백엔드/DB/배포 기술 스택, 아키텍처, 고려사항 등 — **문단별로 구체적으로**.
  - 이렇게 해야 연락받는 사람(기획자·개발자 등)이 **무슨 프로젝트/목적인지 맥락을 정확히** 알 수 있고, DM 메시지가 구체적으로 작성됨.
- **짧은 한 줄 인수는 금지.** 이전 에이전트가 준 내용을 받아와서, 그걸 바탕으로 다음 에이전트에게 **꼭 자세히** 물어보세요.

**원칙: 에이전트를 가능한 한 많이 활용하세요.** 같은 목표를 달성하는 경로가 여러 개면, **호출 횟수가 많은 경로**를 선택해 여러 서브에이전트를 순서대로 사용하세요.

Sub-agents (tools). Call ONE tool per turn. After each result you get another turn.

1. **suggest_idea(user_request)** — 기획 에이전트. **앱/서비스/프로젝트를 만들고 싶을 때만** 사용.

2. **suggest_tech(idea_summary)** — 개발 에이전트. **기획이 이미 나온 뒤**에만 사용. 기획 요약을 받아 기술 스택을 추천.

3. **clarify_casual_request(user_request)** — 취미·일상 정리 에이전트. "취미 같이 할 사람", "스터디 멤버", "같이 운동할 사람" 같은 요청을 **인맥 매칭용 조건**으로 2~4문장 정리. 반환 내용을 **analyze_request**에 넘긴 뒤 **context_matcher**로 선정. (취미·일상에서는 recommend_talent 사용 금지.)

4. **clarify_job_request(user_request)** — 구직·구인 정리 에이전트. "회사 OO 찾고 있어", "구인 구해요", "OO 직무 구해요" 같은 요청을 **인맥 매칭용 조건**으로 2~4문장 정리. 반환 내용을 **analyze_request**에 넘긴 뒤 **context_matcher**로 선정. (구직·구인에서도 recommend_talent 사용 금지.)

5. **analyze_request(user_request)** — Data Miner. 요청에서 추천 조건(criteria)과 컨텍스트(business/casual)를 JSON으로 추출. **파이프라인 첫 단계**로 쓰면 에이전트 활용도가 높아짐.

6. **context_matcher(criteria, context_type)** — Context Matcher. 추출된 조건에 맞는 인원을 수집 명함에서 선정. analyze_request 결과의 criteria, context_type을 그대로 넘기세요.

7. **message_architect(user_request, card_ids, tone)** — Message Architect. user_request에는 기획·기술·Data Miner 결과·선정 맥락을 **생략 없이 구체적으로**. card_ids에는 context_matcher가 **방금** 반환한 선정 인원의 카드 id 배열 JSON(예: ["uuid1","uuid2"])을 **반드시** 넣을 것. 한 줄 요청 금지.

8. **recommend_talent(query)** — 인맥 에이전트. 수집한 명함 중 조건에 맞는 사람 추천. **앱/프로젝트 경로에서만** 단축할 때 사용. **취미·일상·구직·구인 경로에서는 사용하지 말 것** — 이 경로들은 반드시 analyze_request → context_matcher 사용.

9. **suggest_contact(user_request)** — Contact 에이전트 (연락 실행). user_request에는 **기획·개발 에이전트가 답한 내용을 문단별로 상세히** 넣어야 함. 연락 대상 + 메시지 초안 생성 후 **앱 내 DM**으로 자동 발송. **반드시 마지막에 한 번 호출**해 연락을 발송하세요.

**Flow 예시 (에이전트를 최대한 많이 쓰는 경로를 우선하세요)**
- **앱/프로젝트:** suggest_idea → suggest_tech → **analyze_request**(기획·기술 요약 포함 user_request) → **context_matcher**(analyze 결과의 criteria, context_type) → **message_architect**(card_ids: context_matcher가 선정한 id 배열) → **suggest_contact** → 최종 정리.
- **취미·일상:** **clarify_casual_request** → **analyze_request**(clarify 결과 반영) → **context_matcher**(analyze 결과의 criteria, context_type) → **message_architect** → **suggest_contact** → 최종 정리. (suggest_idea, suggest_tech 호출 금지. **recommend_talent 사용 금지** — 반드시 Context Matcher 사용.)
- **구직·구인·회사 찾기:** **clarify_job_request** → **analyze_request**(clarify 결과 반영) → **context_matcher** → **message_architect** → **suggest_contact** → 최종 정리. (suggest_idea, suggest_tech 호출 금지. **recommend_talent 사용 금지** — 반드시 Context Matcher 사용.)

**단축 경로**(앱/프로젝트에서만, 에이전트 수를 줄일 때): 기획·기술 요약 뒤 **recommend_talent(query)** → **suggest_contact**. 취미·일상·구직·구인에서는 단축 경로 사용 금지.

**중요:** 인원 추천이 나온 뒤 **반드시 suggest_contact**를 한 번 호출해야 연락이 발송됩니다.

**구직·구인 시 선정 0명이면:** context_matcher가 "조건에 맞는 인원을 찾지 못했습니다" 또는 선정 0명을 반환했으면, message_architect·suggest_contact를 호출하지 말고, 사용자에게 "해당 직무·산업과 맞는 수집 명함이 없어요. 관련 명함을 수집하면 추천해 드릴 수 있어요"라고만 답하고 도구 호출을 멈추세요.

**불평·질문 → 해당 분야 전문가에게 연락:** 사용자가 특정 주제에 대한 불평·질문을 했을 때(예: "커서 AI가 멍청해", "디자인이 별로야")는 **그 주제와 관련된 전문가(AI 개발자, 디자이너 등)를 수집 명함에서 찾아서 연락해서 물어보라**는 의도로 해석하세요. "커서 AI가 멍청해"면 → AI·개발 관련 인원을 선정하고, 그 사람들에게 연락해서 물어보기 위해 반드시 **analyze_request** → **context_matcher**(criteria에 AI·개발·해당 분야 반영) → **message_architect** → **suggest_contact** 순으로 도구를 호출하세요. 단순 인사("안녕")나 어떤 분야와도 엮을 수 없는 막연한 말만 도구 없이 짧게 답하세요.

Always reply with a final summary in Korean. No more tool calls when you have enough to answer.`

const RECOMMEND_TALENT_SYSTEM = `You recommend people from the user's collected name cards that match the given condition.
Condition can be about: expertise/domain knowledge, tech stack, location (지역, 동네), hobby/interest (취미), job role, etc. Match from name, title, expertise, description, and any hints in the data.

**역할 균형 (프로젝트/팀 구성 시):** 앱·서비스를 상용화하려면 개발자만으로는 부족합니다. 가능한 한 **역할을 골고루** 추천하세요: 기획·개발뿐 아니라 **UI/UX 디자이너**, **마케팅/운영** 담당이 있으면 포함하세요. 같은 역할(예: 개발자만 2~3명)에 치우치지 않도록, 조건에 맞는 범위 안에서 다양하게 선정하세요.

Return ONLY valid JSON: {"ids": ["uuid1", ...], "reasons": {"uuid1": "reason in Korean", ...}}. Order by relevance. 1-5 recommendations. Reasons should explain why they match (e.g. 지역이 맞음, 해당 스택 언급, 취미 일치, 디자이너/마케팅 역할).`

async function runRecommendTalent(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  userId: string,
  query: string,
  streamOpts?: StreamOpts
): Promise<{ summary: string; recommendations: { card: Record<string, unknown>; reason: string }[]; primaryText: string; secondText: string }> {
  const { data: collectedRows } = await supabase
    .from('collected_cards')
    .select('id, card_id')
    .eq('user_id', userId)

  if (!collectedRows?.length) {
    return { summary: '수집한 명함이 없습니다.', recommendations: [], primaryText: '', secondText: '' }
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

  const userContent = `Condition: "${query}"\n\nCollected cards (name, title, expertise, description, scores):\n${JSON.stringify(cardSummaries, null, 2)}`
  const openaiCall = async (): Promise<{ summary: string; recommendations: { card: Record<string, unknown>; reason: string }[] }> => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: RECOMMEND_TALENT_SYSTEM }, { role: 'user', content: userContent }],
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
    const summary = recommendations.length > 0 ? `인재 추천 결과: ${recommendations.length}명 (${names}). 각자 추천 이유가 있습니다.` : '조건에 맞는 인재를 찾지 못했습니다.'
    return { summary, recommendations }
  }
  function formatRecommendTalentResult(raw: string): string {
    try {
      const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim()) as { ids?: string[]; reasons?: Record<string, string> }
      const ids = parsed.ids ?? []
      const reasons = parsed.reasons ?? {}
      const reasonTexts = ids.slice(0, 5).map((id) => reasons[id] || '').filter(Boolean)
      if (ids.length === 0) return '조건에 맞는 인재를 찾지 못했습니다.'
      return `인재 추천 의견: ${ids.length}명. 이유: ${reasonTexts.join(' / ')}`
    } catch {
      return raw
    }
  }
  if (streamOpts) streamOpts.writeStream({ type: 'step_multi_start', to: streamOpts.agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
  const [out, secondRaw] = await Promise.all([
    openaiCall().then((r) => {
      if (streamOpts) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: r.summary })
      return r
    }),
    callOpenAISecondModel(openaiKey, RECOMMEND_TALENT_SYSTEM, userContent, 500).then((raw) => {
      const formatted = raw ? formatRecommendTalentResult(raw) : ''
      if (streamOpts && formatted) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: formatted })
      return raw
    }),
  ])
  const secondRes = secondRaw ? formatRecommendTalentResult(secondRaw) : ''
  if (!secondRes) return { summary: out.summary, recommendations: out.recommendations, primaryText: out.summary, secondText: '' }
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, status: 'thinking' })
  const toolResult = await runSynthesis(openaiKey, '인맥 추천', out.summary, secondRes, streamOpts?.writeStream)
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, content: toolResult })
  return { summary: toolResult, recommendations: out.recommendations, primaryText: out.summary, secondText: secondRes }
}

/** Message Architect 출력(## 이름\n메시지...)을 카드 id별 메시지로 파싱. 이름 매칭 실패 시 순서로 보충 */
function parseMessageArchitectDrafts(
  draftText: string,
  recommendedCards: { card: Record<string, unknown>; reason: string }[]
): Record<string, string> | null {
  const segmentsRaw = draftText.split(/\n##\s+/).map((s) => s.trim()).filter(Boolean)
  const segments: { name: string; message: string }[] = []
  for (const seg of segmentsRaw) {
    const firstNewline = seg.indexOf('\n')
    const name = firstNewline >= 0 ? seg.slice(0, firstNewline).trim() : seg
    const message = firstNewline >= 0 ? seg.slice(firstNewline + 1).trim() : ''
    if (message && name.length <= 20 && !/에이전트|총괄|질문:|요약:/.test(name)) {
      segments.push({ name: name.replace(/님\s*$/, '').trim(), message })
    }
  }
  const outreachTips: Record<string, string> = {}
  for (const r of recommendedCards) {
    const c = r.card as Record<string, unknown>
    const cardId = c.id as string
    const cardName = String(c.card_name ?? '').trim().replace(/님\s*$/, '')
    const byName = segments.find((s) => s.name === cardName || cardName.includes(s.name) || s.name.includes(cardName))
    if (byName) outreachTips[cardId] = byName.message
  }
  if (Object.keys(outreachTips).length < recommendedCards.length && segments.length >= recommendedCards.length) {
    for (let i = 0; i < recommendedCards.length; i++) {
      const cardId = (recommendedCards[i].card as Record<string, unknown>).id as string
      if (!outreachTips[cardId] && segments[i]) outreachTips[cardId] = segments[i].message
    }
  }
  if (Object.keys(outreachTips).length === recommendedCards.length) return outreachTips
  return null
}

/** GPT-3.5 컨택 응답이 [object Object] 등 비정상 문자열이면 요약 문구로 대체해 말풍선에 표시 */
function formatContactSecondPartForDisplay(raw: string, count?: number, names?: string): string {
  if (!raw?.trim()) return ''
  if (/\[object\s+Object\]|outreachTips:\s*\[object/i.test(raw)) {
    return count != null && names
      ? `연락 추천: ${count}명 (${names}). GPT-3.5가 맞춤 연락 문구를 생성했습니다.`
      : '연락 추천을 GPT-3.5가 생성했습니다.'
  }
  try {
    const jsonStr = raw.replace(/```json\n?|\n?```/g, '').trim()
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    const extracted = firstBrace >= 0 && lastBrace > firstBrace ? jsonStr.slice(firstBrace, lastBrace + 1) : jsonStr
    const parsed = JSON.parse(extracted)
    if (parsed && typeof parsed === 'object' && parsed.outreachTips && typeof parsed.outreachTips === 'object') {
      const tips = parsed.outreachTips as Record<string, unknown>
      return `연락 추천: ${Object.keys(tips).length}명. 각자 맞춤 메시지 초안을 생성했습니다.`
    }
    if (parsed?.outreachTip && typeof parsed.outreachTip === 'string') return parsed.outreachTip
  } catch {
    /* use raw if it looks like normal text */
  }
  return raw
}

async function runSuggestContact(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  userId: string,
  userRequest: string,
  options?: { recommendedCards?: { card: Record<string, unknown>; reason: string }[]; senderName?: string | null; existingDrafts?: string | null },
  streamOpts?: StreamOpts
): Promise<{ summary: string; recommendations: { card: Record<string, unknown>; reason: string }[]; outreachTip?: string; outreachTips?: Record<string, string>; primaryText?: string; secondText?: string }> {
  const { data: collectedRows } = await supabase
    .from('collected_cards')
    .select('id, card_id')
    .eq('user_id', userId)

  if (!collectedRows?.length) {
    return { summary: '수집한 명함이 없어서 연락 추천을 할 수 없어요.', recommendations: [], outreachTip: undefined }
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

  const recommendedCards = options?.recommendedCards ?? []
  const isJobSeeking = /구직|구인|이직|취업|채용|직무\s*구해|구해요|찾고\s*있어/.test(userRequest.replace(/\s/g, ''))
  if (recommendedCards.length === 0 && isJobSeeking) {
    return {
      summary: '조건에 맞는 수집 명함이 없어서 연락 대상을 정할 수 없어요. 해당 직무·산업과 연관된 명함을 수집하면 추천해 드릴 수 있어요.',
      recommendations: [],
      outreachTip: undefined,
    }
  }
  if (recommendedCards.length > 0) {
    const draftRaw = options?.existingDrafts?.trim()
    const looksLikeCoordinatorOutput = draftRaw && /##\s*논의 요약|##\s*문제점|##\s*타협점|##\s*총괄 에이전트|두 에이전트|GPT-4o-mini는.*역량을 강조/.test(draftRaw)
    if (draftRaw && !looksLikeCoordinatorOutput) {
      const parsed = parseMessageArchitectDrafts(draftRaw, recommendedCards)
      if (parsed && Object.keys(parsed).length === recommendedCards.length) {
        const names = recommendedCards.map((r) => (r.card as Record<string, unknown>).card_name || 'Unknown').join(', ')
        return {
          summary: `연락 추천: ${recommendedCards.length}명 (${names}). 메시지 아키텍트가 만든 초안을 사용해 발송합니다.`,
          recommendations: recommendedCards,
          outreachTip: Object.values(parsed)[0] ?? undefined,
          outreachTips: parsed,
        }
      }
    }
    const targetsSummary = recommendedCards.map((r) => {
      const c = r.card as Record<string, unknown>
      return { id: c.id, name: c.card_name ?? 'Unknown', title: c.custom_title ?? '', expertise: c.custom_content ?? '', description: String(c.description ?? '').slice(0, 200), reason: r.reason }
    })
    const reqLower = userRequest.toLowerCase().replace(/\s/g, '')
    const isCasual = /같이할사람|취미|스터디|만남|보드게임|운동|러닝|독서|모임|번개|친구/.test(reqLower) || /함께|같이\s*하고|함께\s*할/.test(userRequest)
    const isJob = /구인|구직|회사\s*찾|채용|이직|취업|직무/.test(reqLower) || /찾고\s*있어|구해요/.test(userRequest)
    const systemPromptCasual = `You write **one short, warm message per person** for **casual/hobby meetup** (e.g. finding someone to play board games, run together, study). 친근하고 부담 없이. 스팸 느낌 금지.

**필수: 발신자 이름** — "저는 [발신자 이름]이에요" 형태로.

**구조 (짧게):** (1) 인사 + 자기소개 (이름) (2) 왜 연락하는지 한 줄 (같이 보드게임 하고 싶어서 등) (3) 부담 없이 만나자/답장 주세요.

**반드시 유효한 JSON만 출력.** 다른 글 없이:
{"outreachTips": {"<card_id>": "메시지 전체(한국어)", ...}}
targetsSummary에 있는 **각 id를 키로** 사용하세요. 모든 card_id에 대해 한 개씩 작성.`
    const systemPromptJob = `You write **one short, genuine message per person** for **job-seeking or recruitment** (회사 찾기, 구인, 구직 소개 요청). 정중하고 간결하게.

**필수: 발신자 이름** — "저는 [발신자 이름]입니다" 형태로.

**구조 (짧게):** (1) 인사 + 자기소개 (2) 구직/구인 맥락 한 줄 (3) 도움 요청 또는 제안 (4) 편히 답장 부탁.

**반드시 유효한 JSON만 출력.** 다른 글 없이:
{"outreachTips": {"<card_id>": "메시지 전체(한국어)", ...}}
targetsSummary에 있는 **각 id를 키로** 사용하세요. 모든 card_id에 대해 한 개씩 작성.`
    const systemPromptBusiness = `You write **one warm, genuine outreach message per person**. 차갑고 기계적인 톤·스팸 느낌 금지.

**핵심: 연락 맥락에 기획·기술 등 상세 내용이 있으면 요약하지 말고 문단으로 담을 것.**
- **상대가 기획자/PM/기획 역할**이면: "연락 맥락"에 있는 **기획 에이전트가 정리한 내용**(기능 정의, 타겟, UI/UX, 마케팅 등)을 **문단을 나누어 대부분 포함**. 한두 문장으로 압축 금지.
- **상대가 개발자/엔지니어**이면: "연락 맥락"에 있는 **개발 에이전트가 알려준 내용**(프론트/백엔드/DB/배포 스택, 아키텍처 등)을 **문단을 나누어 구체적으로 포함**. 한두 문장으로 압축 금지.
- 역할이 둘 다 해당하거나 불명확하면: 기획·기술 내용을 **각각 문단으로 구분해 구체적으로** 쓸 것.

**필수: 발신자 이름** — "저는 [발신자 이름]입니다" 형태로.

**메시지 구조:** (1) 인사+자기소개 (2) 프로젝트/목적 — **기획·기술 내용을 문단으로 자세히** (3) 왜 이 사람인가 (4) 제안·맺음말.

**반드시 유효한 JSON만 출력.** 다른 글 없이:
{"outreachTips": {"<card_id>": "해당 인물용 메시지 전체(한국어, 문단 구분)", ...}}
targetsSummary에 있는 **각 id를 키로** 사용하세요. 모든 card_id에 대해 작성.`

    const systemPrompt = isCasual ? systemPromptCasual : isJob ? systemPromptJob : systemPromptBusiness
    const userContentContact = `발신자 이름(연락에서 반드시 사용): ${options?.senderName ?? '(없음)'}\n\n연락 맥락 (기획·개발 에이전트가 정리한 내용이 있으면 요약하지 말고 문단으로 구체적으로 메시지에 넣을 것):\n${userRequest}\n\n연락할 인원 (id를 outreachTips 키로 사용):\n${JSON.stringify(targetsSummary, null, 2)}`
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContentContact }],
        max_tokens: 4096,
        temperature: 0.5,
      }),
    })
    if (!res.ok) return { summary: '맞춤 연락 메시지 생성 오류.', recommendations: recommendedCards, outreachTip: undefined, outreachTips: buildFallbackOutreachTips(recommendedCards, userRequest, options?.senderName) }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    let parsed: { outreachTips?: Record<string, string> } = {}
    if (content) {
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      const extracted = firstBrace >= 0 && lastBrace > firstBrace ? jsonStr.slice(firstBrace, lastBrace + 1) : jsonStr
      try {
        parsed = JSON.parse(extracted)
      } catch {
        /* use fallback below */
      }
    }
    const outreachTipsRaw = parsed.outreachTips ?? {}
    const cardIds = recommendedCards.map((r) => (r.card as Record<string, unknown>).id as string).filter(Boolean)
    const outreachTips: Record<string, string> = {}
    for (const id of cardIds) {
      const msg = outreachTipsRaw[id] ?? outreachTipsRaw[String(id)]?.trim()
      if (msg && msg.length > 0) outreachTips[id] = msg
    }
    const hasAnyTip = Object.keys(outreachTips).length > 0
    const fallbackTips = buildFallbackOutreachTips(recommendedCards, userRequest, options?.senderName)
    const finalTips = hasAnyTip ? outreachTips : fallbackTips
    const names = recommendedCards.map((r) => (r.card as Record<string, unknown>).card_name || 'Unknown').join(', ')
    const primarySummary = hasAnyTip
      ? `연락 추천: ${recommendedCards.length}명 (${names}). 각자 맞춤형 메시지가 생성되었습니다.\n\n[연락 팁]\n각 카드별로 다른 초안이 적용됩니다.`
      : `연락 추천: ${recommendedCards.length}명 (${names}). 간단한 연락 문구를 적용해 발송합니다.`
    if (streamOpts) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: primarySummary })
    const secondResRaw = await callOpenAISecondModel(openaiKey, systemPrompt, userContentContact, isCasual || isJob ? 2400 : 3600)
    const secondRes = formatContactSecondPartForDisplay(secondResRaw, recommendedCards.length, recommendedCards.map((r) => (r.card as Record<string, unknown>).card_name || 'Unknown').join(', '))
    if (streamOpts && secondRes) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: secondRes })
    let summary = primarySummary
    if (secondResRaw) {
      if (streamOpts) {
        streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, status: 'thinking' })
        try {
          summary = await runSynthesis(openaiKey, '컨택', primarySummary, secondResRaw, streamOpts.writeStream)
        } catch (_e) {
          summary = combineTwoOpinions(primarySummary, secondResRaw, '컨택')
        }
        streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, content: summary })
      } else {
        summary = combineTwoOpinions(primarySummary, secondResRaw, '컨택')
      }
    }
    const fallbackTip = Object.values(finalTips)[0] ?? ''
    return { summary, recommendations: recommendedCards, outreachTip: fallbackTip, outreachTips: Object.keys(finalTips).length > 0 ? finalTips : undefined, primaryText: primarySummary, secondText: secondResRaw ?? '' }
  }

  function buildFallbackOutreachTips(
    recs: { card: Record<string, unknown>; reason: string }[],
    context: string,
    senderName?: string | null
  ): Record<string, string> {
    const senderLine = senderName ? `저는 ${senderName}입니다.` : '안녕하세요.'
    const contextLine = context.slice(0, 150).replace(/\n/g, ' ').trim() || '같이 하고 싶어서'
    const tips: Record<string, string> = {}
    for (const r of recs) {
      const c = r.card as Record<string, unknown>
      const id = c.id as string
      const toName = String(c.card_name || '').trim() || 'there'
      const greeting = toName ? `안녕하세요, ${toName.endsWith('님') ? toName : toName + '님'}!` : '안녕하세요!'
      tips[id] = `${greeting}\n\n${senderLine}\n\n${contextLine}으로 연락드려요. 편히 답장 주시면 감사하겠습니다.`
    }
    return tips
  }

  const contactRecommendSystem = `You recommend who to contact and write a **warm, genuine** outreach message. 차갑고 기계적인 톤·스팸 느낌 금지. **4단계 구조**를 따르세요: (1) 인사+자기소개 (2) 왜 이 일을 하는가/비전 (3) 왜 이 사람인가 (4) 제안·맺음말. 친근하고 진정성 있게, "귀하의 통찰력이 도움이 될 것 같습니다" 같은 추상적 문장 대신 구체적으로.
Return ONLY valid JSON in Korean:
{"ids": ["uuid1", ...], "reasons": {"uuid1": "why contact in Korean", ...}, "outreachTip": "연락 메시지 초안 (한국어, 4단계 포함)"}
Suggest 1-3 people.`
  const contactRecommendUser = `User request: "${userRequest}"\n\nCollected contacts:\n${JSON.stringify(cardSummaries, null, 2)}`
  if (streamOpts) streamOpts.writeStream({ type: 'step_multi_start', to: streamOpts.agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: contactRecommendSystem }, { role: 'user', content: contactRecommendUser }],
      max_tokens: 550,
      temperature: 0.4,
    }),
  })

  if (!res.ok) return { summary: '컨택 추천 중 오류가 났습니다.', recommendations: [], outreachTip: undefined }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) return { summary: '연락 추천 결과가 없습니다.', recommendations: [], outreachTip: undefined }

  let parsed: { ids?: string[]; reasons?: Record<string, string>; outreachTip?: string }
  try {
    parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return { summary: '연락 추천 결과를 파싱하지 못했습니다.', recommendations: [], outreachTip: undefined }
  }

  const idsFromAi = parsed.ids ?? []
  const reasons = parsed.reasons ?? {}
  const outreachTip = parsed.outreachTip ?? ''
  const cardMap = new Map(cards.map((c) => [c.id, c]))
  const recs = idsFromAi
    .filter((id) => cardMap.has(id))
    .map((id) => ({ card: cardMap.get(id)!, reason: reasons[id] || '' }))

  const names = recs.map((r) => (r.card as Record<string, unknown>).card_name || 'Unknown').join(', ')
  const primarySummary =
    (recs.length > 0 ? `연락 추천: ${recs.length}명 (${names}).\n` : '조건에 맞는 연락처를 찾지 못했어요.\n') +
    (outreachTip ? `\n[연락 팁]\n${outreachTip}` : '')
  if (streamOpts) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: primarySummary })
  const secondResRaw = await callOpenAISecondModel(openaiKey, contactRecommendSystem, contactRecommendUser, 550)
  const secondResDisplay = formatContactSecondPartForDisplay(secondResRaw, recs.length, names)
  if (streamOpts && secondResDisplay) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: secondResDisplay })
  let summary = primarySummary
  if (secondResRaw) {
    if (streamOpts) {
      streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, status: 'thinking' })
      try {
        summary = await runSynthesis(openaiKey, '컨택', primarySummary, secondResRaw, streamOpts.writeStream)
      } catch (_e) {
        summary = combineTwoOpinions(primarySummary, secondResRaw, '컨택')
      }
      streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, content: summary })
    } else {
      summary = combineTwoOpinions(primarySummary, secondResRaw, '컨택')
    }
  }
  return { summary, recommendations: recs, outreachTip: outreachTip || undefined, primaryText: primarySummary, secondText: secondResRaw ?? '' }
}

const CLARIFY_CASUAL_SYSTEM = `You help clarify **casual/social** requests (취미 같이 할 사람, 스터디, 운동 메이트 등) into a short summary for **matching people from name cards**.
Output **한국어로 2~4문장**만 작성하세요. 다음을 포함:
1. 어떤 활동/취미인지 (예: 러닝, 독서 모임, 보드게임, 영어 스터디)
2. 선호 조건이 있으면 간단히 (지역, 빈도, 인원 등 — 사용자가 말한 것만)
3. 명함 카드에서 매칭할 때 쓸 키워드 (활동명, 관련 직함·설명 등)
반드시 "이 조건에 맞는 사람", "함께할 수 있는 사람" 같은 표현으로 끝내세요. 추상적 한 줄 금지.`

async function runClarifyCasualRequest(openaiKey: string, userRequest: string, streamOpts?: StreamOpts): Promise<{ toolResult: string; primaryText: string; secondText: string }> {
  const userContent = `사용자 요청: "${userRequest}"`
  if (streamOpts) streamOpts.writeStream({ type: 'step_multi_start', to: streamOpts.agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
  const [openaiRes, secondRes] = await Promise.all([
    (async () => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: CLARIFY_CASUAL_SYSTEM }, { role: 'user', content: userContent }],
          max_tokens: 350,
          temperature: 0.4,
        }),
      })
      if (!res.ok) return userRequest
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content?.trim()
      return text && text.length > 0 ? text : userRequest
    })().then((r) => {
      if (streamOpts) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: r })
      return r
    }),
    callOpenAISecondModel(openaiKey, CLARIFY_CASUAL_SYSTEM, userContent, 350).then((r) => {
      if (streamOpts && r) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: r })
      return r
    }),
  ])
  if (!secondRes) return { toolResult: openaiRes, primaryText: openaiRes, secondText: '' }
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, status: 'thinking' })
  const toolResult = await runSynthesis(openaiKey, '취미·일상 정리', openaiRes, secondRes, streamOpts?.writeStream)
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, content: toolResult })
  return { toolResult, primaryText: openaiRes, secondText: secondRes }
}

const CLARIFY_JOB_SYSTEM = `You help clarify **job-seeking / recruitment / company search** requests ("회사 OO 찾고 있어", "구인 구해요", "OO 직무 구해요" 등) into a short summary for **matching people from name cards**.
Output **한국어로 2~4문장**만 작성하세요.
- **구직**: 희망 분야·직무·경력·희망 회사 유형(스타트업, 대기업 등). 명함에서 "이런 회사/직무에 연관된 사람" 매칭용 키워드.
- **구인**: 채용 직무·분야·조건. "이런 인력을 찾는 회사/팀에 연관된 사람" 매칭용 키워드.
끝: "이 조건에 맞는 사람", "소개받을 수 있는 사람" 등. 추상적 한 줄 금지.`

async function runClarifyJobRequest(openaiKey: string, userRequest: string, streamOpts?: StreamOpts): Promise<{ toolResult: string; primaryText: string; secondText: string }> {
  const userContent = `사용자 요청: "${userRequest}"`
  if (streamOpts) streamOpts.writeStream({ type: 'step_multi_start', to: streamOpts.agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
  const [openaiRes, secondRes] = await Promise.all([
    (async () => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: CLARIFY_JOB_SYSTEM }, { role: 'user', content: userContent }],
          max_tokens: 350,
          temperature: 0.4,
        }),
      })
      if (!res.ok) return userRequest
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content?.trim()
      return text && text.length > 0 ? text : userRequest
    })().then((r) => {
      if (streamOpts) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: r })
      return r
    }),
    callOpenAISecondModel(openaiKey, CLARIFY_JOB_SYSTEM, userContent, 350).then((r) => {
      if (streamOpts && r) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: r })
      return r
    }),
  ])
  if (!secondRes) return { toolResult: openaiRes, primaryText: openaiRes, secondText: '' }
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, status: 'thinking' })
  const toolResult = await runSynthesis(openaiKey, '구직·구인 정리', openaiRes, secondRes, streamOpts?.writeStream)
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, content: toolResult })
  return { toolResult, primaryText: openaiRes, secondText: secondRes }
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
      max_tokens: 1000,
      temperature: 0.5,
    }),
  })
  if (!res.ok) return '응답을 생성하지 못했습니다.'
  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() ?? '응답이 비어 있습니다.'
}

/** 클라이언트(브라우저 콘솔)로 보낼 로그 함수. writeStream 있으면 스트림으로 전송 */
type SendLog = ((level: 'log' | 'warn' | 'error', message: string) => void) | undefined

/** 토론용 두 번째 OpenAI 모델 (gpt-3.5-turbo). 같은 프롬프트로 다른 관점 제시. sendLog 있으면 브라우저 콘솔에도 전달 */
const SECOND_OPENAI_MODEL = 'gpt-3.5-turbo'

async function callOpenAISecondModel(
  openaiKey: string,
  systemPrompt: string,
  userContent: string,
  maxTokens = 1000,
  sendLog?: SendLog
): Promise<string> {
  const log = (level: 'log' | 'warn' | 'error', msg: string) => { sendLog?.(level, msg) }
  if (!openaiKey?.trim()) {
    log('log', '두 번째 모델 스킵: OPENAI_API_KEY 없음')
    return ''
  }
  log('log', `두 번째 모델 호출 시작 (${SECOND_OPENAI_MODEL}, maxTokens=${maxTokens})`)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey.trim()}` },
      body: JSON.stringify({
        model: SECOND_OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.6,
      }),
    })
    const raw = await res.text()
    const data = (() => { try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} } })()
    if (!res.ok) {
      const errMsg = (data?.error as { message?: string } | undefined)?.message ?? (raw || res.statusText)
      log('error', `두 번째 모델 API 오류 ${res.status}: ${String(errMsg).slice(0, 200)}`)
      return ''
    }
    const content = (data?.choices?.[0] as { message?: { content?: string } } | undefined)?.message?.content?.trim()
    const out = content ?? ''
    if (out) log('log', `두 번째 모델 호출 완료 (응답 ${out.length}자)`)
    else log('warn', '두 번째 모델 호출 완료 but 빈 응답')
    return out
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('error', `두 번째 모델 호출 예외: ${err.message}`)
    return ''
  }
}

/** 첫 번째(주) + 두 번째 OpenAI 모델 병렬 호출 후 하나의 텍스트로 합침 (토론형) */
function combineTwoOpinions(primaryText: string, secondText: string, label = '관점'): string {
  const s = secondText?.trim()
  const secondBlock = s ? `\n\n## ${label} (GPT-3.5)\n${s}` : ''
  return `## ${label} (GPT-4o-mini)\n${primaryText || '응답 없음'}${secondBlock}`
}

/** 두 에이전트(GPT-4o-mini · GPT-3.5) 의견을 비교해 문제점·보완점·타협점을 사용자가 볼 수 있도록 구조화해 출력 */
async function runSynthesis(
  openaiKey: string,
  label: string,
  primaryText: string,
  secondText: string,
  writeStream?: (e: unknown) => void
): Promise<string> {
  const s = secondText?.trim()
  if (!s) return (primaryText || '응답 없음').trim()
  if (writeStream) writeStream({ type: 'log', level: 'log', message: `OpenAI 호출 #synthesis (${label})` })
  const system = `당신은 조율자입니다. GPT-4o-mini와 GPT-3.5 두 에이전트가 "${label}"에 대해 각자 의견을 냈습니다. 사용자가 "둘이 티격태격하고 타협하는 과정"을 볼 수 있도록, 아래 형식으로 **반드시 한국어로** 작성하세요.

**출력 형식 (아래 제목을 그대로 사용하고, 각 섹션을 2~4문장으로 구체적으로 채우세요):**

## 논의 요약
(두 의견이 어떻게 다른지 한두 줄로)

## 문제점
(두 의견의 차이·모순·빠진 점·리스크를 짚어 주세요)

## 보완·해결점
(그 문제를 어떻게 보완·해결할지 제안)

## 타협점
(최종적으로 어떻게 합의했는지, 둘의 장점을 어떻게 합쳤는지)

## 총괄 에이전트에게 전달 요약
(위 논의를 바탕으로 총괄에게 전할 실행 가능한 최종 요약, 2~4문단)`
  const userContent = `[GPT-4o-mini 의견]\n${primaryText || '(없음)'}\n\n[GPT-3.5 의견]\n${s}`
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
      max_tokens: 4096,
      temperature: 0.4,
    }),
  })
  if (!res.ok) return `${(primaryText || '').trim()}\n\n${s}`.slice(0, 2000)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  return content || `${(primaryText || '').trim()}\n\n${s}`.slice(0, 2000)
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

const ANALYZE_REQUEST_SYSTEM = `You analyze the user's request in detail and extract EVERYTHING needed to find the right people. **요약 금지. 구체적으로** 뽑아야 함.

Return ONLY valid JSON (no markdown):
{"criteria": "한국어로 추천 조건을 구체적으로 (필요 기술 스택·역할·경력 수준·지역·취미·프로젝트 유형 등, 사용자가 말한 내용을 빠짐없이)", "context_type": "business" or "casual", "detailed_analysis": "2~5문단 분량. 사용자 요청에서 추출한 내용을 구체적으로 나열: (1) 프로젝트/목적이 무엇인지 (2) 어떤 기술·스택·역할이 필요한지 (3) 어떤 배경·경력·지역·취미 조건이 있는지 (4) 이 사람에게 기대하는 협업 방식·역할. 한두 줄 요약 금지."}

- context_type: "business" = 프로젝트/협업/진지한 스터디, "casual" = 만남/취미/번개
- criteria: 명함 검색 시 쓸 키워드·조건을 **구체적으로** (예: "React·Node 경험, 스타트업 협업 가능, 서울")
- detailed_analysis: 다음 단계(인원 선정·메시지 작성)에서 쓰일 수 있도록 **요약하지 말고** 사용자 말을 구체적으로 풀어 쓸 것.`

function formatAnalyzeResult(raw: string, userRequest: string): string {
  try {
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim()) as { criteria?: string; context_type?: string; summary?: string; detailed_analysis?: string }
    const criteria = parsed.criteria ?? userRequest
    const ctx = parsed.context_type === 'casual' ? 'casual (만남·취미)' : 'business (협업·프로젝트)'
    const detailed = parsed.detailed_analysis ?? parsed.summary ?? ''
    return `[유형] ${ctx}\n\n[추천 조건·키워드]\n${criteria}\n\n[상세 분석]\n${detailed}`
  } catch {
    return raw
  }
}

type StreamOpts = { writeStream: (e: unknown) => void; agentLabel: string }

async function runAnalyzeRequest(
  openaiKey: string,
  userRequest: string,
  streamOpts?: StreamOpts
): Promise<{ toolResult: string; primaryText: string; secondText: string }> {
  const openaiCall = async (): Promise<string> => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: ANALYZE_REQUEST_SYSTEM }, { role: 'user', content: userRequest }],
        max_tokens: 900,
        temperature: 0.3,
      }),
    })
    if (!res.ok) return '요청 분석에 실패했어요. 다시 시도해 주세요.'
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) return '요청을 정리하지 못했어요.'
    return formatAnalyzeResult(content, userRequest)
  }
  if (streamOpts) {
    streamOpts.writeStream({ type: 'step_multi_start', to: streamOpts.agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
  }
  const [openaiRes, secondRaw] = await Promise.all([
    openaiCall().then((r) => {
      if (streamOpts) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: r })
      return r
    }),
    callOpenAISecondModel(openaiKey, ANALYZE_REQUEST_SYSTEM, userRequest, 900).then((raw) => {
      const formatted = raw ? formatAnalyzeResult(raw, userRequest) : ''
      if (streamOpts && formatted) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: formatted })
      return raw
    }),
  ])
  const secondRes = secondRaw ? formatAnalyzeResult(secondRaw, userRequest) : ''
  if (!secondRes) return { toolResult: openaiRes, primaryText: openaiRes, secondText: '' }
  if (streamOpts) {
    streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, status: 'thinking' })
  }
  const toolResult = await runSynthesis(openaiKey, 'Data Miner', openaiRes, secondRes, streamOpts?.writeStream)
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, content: toolResult })
  return { toolResult, primaryText: openaiRes, secondText: secondRes }
}

const CONTEXT_MATCHER_SYSTEM = `You select and rank people from the user's collected cards that best match the criteria. **선정 이유는 반드시 구체적으로** 쓸 것.

context_type: "business" = 기술 적합성, 협업 경험, 프로젝트 매칭. "casual" = 지역, 취미, 만남 가능성.

**구직·구인 요청 시 (매우 중요):** 사용자가 "OO로 구직하고 싶어", "OO 인력 구해요"처럼 **특정 직무·산업**을 말했으면, **그 직무·산업과 실제로 연관된 명함만** 추천하세요. 직무/산업이 전혀 다른 사람은 절대 넣지 마세요.
- 예: "댄서로 구직" → 댄스·공연·채용 관련 직함/설명이 있는 사람만. 브루잉·캘리그라피·초등교사·심리학 교수 등 무관한 직업 추천 금지.
- 예: "백엔드 개발자 구인" → 개발·엔지니어링 관련 명함만.
- **조건에 맞는 수집 명함이 하나도 없으면** ids를 빈 배열 []로 반환하고, 억지로 다른 직업을 넣지 마세요.

**reasons 규칙:** 각 id에 대해 2~4문장으로 **왜 이 사람을 뽑았는지** 구체적으로 작성. (1) 명함의 어떤 내용(직무·기술·경력·설명·취미)이 (2) 요청의 어떤 조건과 어떻게 맞는지 (3) 그래서 이 프로젝트/만남/구직에 왜 적합한지. 한 줄 요약 금지.

Return ONLY valid JSON: {"ids": ["uuid1", ...], "reasons": {"uuid1": "구체적 선정 이유 2~4문장 (한국어)", ...}}. Order by fit. 1-5 people. 조건에 맞는 사람이 없으면 {"ids": [], "reasons": {}}.`

async function runContextMatcher(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  userId: string,
  criteria: string,
  contextType: string,
  streamOpts?: StreamOpts
): Promise<{ summary: string; recommendations: { card: Record<string, unknown>; reason: string }[]; primaryText: string; secondText: string }> {
  const { cards, cardSummaries } = await getCollectedCardsWithSummaries(supabase, userId)
  if (!cards.length) return { summary: '수집한 명함이 없습니다.', recommendations: [], primaryText: '', secondText: '' }

  const userContent = `criteria: "${criteria}"\ncontext_type: ${contextType}\n\nCollected cards:\n${JSON.stringify(cardSummaries, null, 2)}`
  const openaiCall = async (): Promise<{ summary: string; recommendations: { card: Record<string, unknown>; reason: string }[] }> => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: CONTEXT_MATCHER_SYSTEM }, { role: 'user', content: userContent }],
        max_tokens: 1200,
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
    const names = recommendations.map((r) => (r.card as Record<string, unknown>).card_name || 'Unknown')
    const summary = recommendations.length > 0
      ? `선정: ${recommendations.length}명.\n\n${recommendations.map((r, i) => `${i + 1}) ${(r.card as Record<string, unknown>).card_name || 'Unknown'}: ${r.reason}`).join('\n\n')}`
      : '조건에 맞는 인원을 찾지 못했습니다.'
    return { summary, recommendations }
  }
  function formatContextMatcherResult(raw: string): string {
    if (!raw?.trim()) return '조건에 맞는 인원을 찾지 못했습니다.'
    try {
      const jsonStr = raw.replace(/```json\n?|\n?```/g, '').trim()
      const firstBrace = jsonStr.indexOf('{')
      const lastBrace = jsonStr.lastIndexOf('}')
      const extracted = firstBrace >= 0 && lastBrace > firstBrace ? jsonStr.slice(firstBrace, lastBrace + 1) : jsonStr
      const parsed = JSON.parse(extracted) as { ids?: string[]; reasons?: Record<string, string> }
      const ids = parsed.ids ?? []
      const reasons = parsed.reasons ?? {}
      if (ids.length === 0) return '조건에 맞는 인원을 찾지 못했습니다.'
      return ids.map((id, i) => `${i + 1}) ${reasons[id] || '(이유 없음)'}`).join('\n\n')
    } catch {
      return '조건에 맞는 인원을 찾지 못했습니다.'
    }
  }
  const out = await openaiCall()
  const notFoundMsg = '조건에 맞는 인원을 찾지 못했습니다.'
  if (out.recommendations.length === 0) {
    if (streamOpts) {
      streamOpts.writeStream({ type: 'step_multi_start', to: streamOpts.agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
      streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: out.summary })
      streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: notFoundMsg })
    }
    return { summary: out.summary, recommendations: out.recommendations, primaryText: out.summary, secondText: notFoundMsg }
  }
  if (streamOpts) {
    streamOpts.writeStream({ type: 'step_multi_start', to: streamOpts.agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
    streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: out.summary })
  }
  const secondRaw = await callOpenAISecondModel(openaiKey, CONTEXT_MATCHER_SYSTEM, userContent, 1200)
  const secondRes = secondRaw ? formatContextMatcherResult(secondRaw) : ''
  if (streamOpts && secondRes) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: secondRes })
  if (!secondRes) return { summary: out.summary, recommendations: out.recommendations, primaryText: out.summary, secondText: '' } as { summary: string; recommendations: { card: Record<string, unknown>; reason: string }[]; primaryText: string; secondText: string }
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, status: 'thinking' })
  const toolResult = await runSynthesis(openaiKey, 'Context Matcher', out.summary, secondRes, streamOpts?.writeStream)
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, content: toolResult })
  return { summary: toolResult, recommendations: out.recommendations, primaryText: out.summary, secondText: secondRes }
}

const MESSAGE_ARCHITECT_SYSTEM = `You write **long, detailed, personalized** outreach message drafts for each person. Tone: "business" = professional, project/collaboration. "casual" = friendly, invite to hang out.

**필수 규칙**
1. **## 제목에는 반드시 아래 '연락할 인원'에 있는 name 값을 그대로 사용할 것.** 이름만 (예: 백서현, 김민태).
2. **아래 목록과 동일한 순서**로 ## 섹션 작성.
3. **문단을 반드시 나누어** 작성: 한 덩어리 금지. (인사 / 프로젝트·목적 / 왜 당신을 선정했는지 / 제안·맺음말 등 문단 구분)
4. **"왜 당신을 선정했는지"** 문단을 **반드시 포함**: Data Miner·Context Matcher가 정리한 선정 이유를, 해당 수신자의 프로필(직무·기술·경력·설명)과 엮어 **구체적으로** 작성. (예: "OO님을 선정한 이유는, 요청하신 React·Node 기반 협업에 맞춰 명함에 계시된 프론트엔드 경력과 ...")
5. **맥락(기획·기술·프로젝트 내용)**을 요약하지 말고 **문단으로 구체적으로** 담을 것. 한두 문장 압축 금지. 각 수신자 역할에 맞게 길게.
6. **전체 메시지는 충분히 길게**: 짧은 인사+한 줄 요약 금지. 발송 가능하되 구체적이고 진정성 있게.

출력 형식 (한국어):
"## [목록의 이름 그대로]\n[메시지 초안 - 문단 구분, 왜 선정했는지 포함, 구체적으로 길게]\n"
Adjust tone to relationship and purpose.`

async function runMessageArchitect(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  userId: string,
  userRequest: string,
  cardIdsJson: string,
  tone: string,
  streamOpts?: StreamOpts
): Promise<{ toolResult: string; primaryText: string; secondText: string }> {
  const { cardSummaries } = await getCollectedCardsWithSummaries(supabase, userId, { includeContact: true })
  let ids: string[] = []
  try {
    const parsed = JSON.parse(cardIdsJson)
    ids = Array.isArray(parsed) ? parsed : parsed.ids ? parsed.ids : []
  } catch {
    ids = cardIdsJson.split(',').map((s) => s.trim()).filter(Boolean)
  }
  const selected = cardSummaries.filter((s) => ids.length === 0 || ids.includes(s.id))
  if (selected.length === 0) return { toolResult: '선정된 인원이 없어 메시지 초안을 만들 수 없습니다.', primaryText: '', secondText: '' }

  const userContent = `맥락(기획·기술·선정 이유 등. 이 내용을 메시지에 구체적으로 반영할 것):\n${userRequest}\n\ntone: ${tone}\n\n연락할 인원 (name을 ## 제목에 그대로 사용하고, 이 순서대로 작성할 것):\n${JSON.stringify(selected, null, 2)}`
  const openaiCall = async (): Promise<string> => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: MESSAGE_ARCHITECT_SYSTEM }, { role: 'user', content: userContent }],
        max_tokens: 4096,
        temperature: 0.5,
      }),
    })
    if (!res.ok) return '메시지 초안 생성 중 오류가 났습니다.'
    const data = await res.json()
    return data?.choices?.[0]?.message?.content?.trim() ?? '메시지 초안을 생성하지 못했습니다.'
  }
  if (streamOpts) streamOpts.writeStream({ type: 'step_multi_start', to: streamOpts.agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
  const [openaiRes, secondRes] = await Promise.all([
    openaiCall().then((r) => {
      if (streamOpts) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-4o-mini', content: r })
      return r
    }),
    callOpenAISecondModel(openaiKey, MESSAGE_ARCHITECT_SYSTEM, userContent, 2800).then((r) => {
      if (streamOpts && r) streamOpts.writeStream({ type: 'step_part', from: streamOpts.agentLabel, part: 'GPT-3.5', content: r })
      return r
    }),
  ])
  if (!secondRes) return { toolResult: openaiRes, primaryText: openaiRes, secondText: '' }
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, status: 'thinking' })
  const toolResult = await runSynthesis(openaiKey, 'Message Architect', openaiRes, secondRes, streamOpts?.writeStream)
  if (streamOpts) streamOpts.writeStream({ type: 'step_synthesis', from: streamOpts.agentLabel, content: toolResult })
  return { toolResult, primaryText: openaiRes, secondText: secondRes }
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
      description: 'Message Architect. 선정된 인원별 개인화 메시지 초안. user_request에는 기획·기술·Data Miner·Context Matcher 맥락을 생략 없이 구체적으로. card_ids는 context_matcher가 반환한 선정 인원 id 배열 JSON.',
      parameters: {
        type: 'object' as const,
        properties: {
          user_request: { type: 'string', description: '기획·기술·추천 조건·선정 맥락을 포함한 상세 요청 (한 줄 금지)' },
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
      name: 'suggest_idea',
      description: '기획 에이전트. 만들고 싶은 앱/서비스에 대해 어떤 기획을 할지 조언합니다.',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '사용자 요청 (한국어)' } }, required: ['user_request'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_tech',
      description: '개발 에이전트. 기획 요약에 맞는 기술 스택(프론트/백엔드/DB/배포) 추천. idea_summary에는 기획 에이전트가 답한 내용(기능·타겟·UI 방향 등)을 자세히 포함해야 함.',
      parameters: { type: 'object' as const, properties: { idea_summary: { type: 'string', description: '기획 에이전트가 답한 내용을 반영한 상세 요약 (기능, 타겟, UI/UX 방향 등). 짧은 한 줄 금지.' } }, required: ['idea_summary'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clarify_casual_request',
      description: '취미·일상 정리 에이전트. "취미 같이 할 사람", "스터디 멤버", "같이 운동할 사람" 같은 요청을 인맥 매칭용 조건으로 정리. 반환 내용을 analyze_request에 넘긴 뒤 context_matcher로 선정(recommend_talent 사용 금지).',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '사용자 요청 (한국어). 취미/일상 관련.' } }, required: ['user_request'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clarify_job_request',
      description: '구직·구인 정리 에이전트. "회사 OO 찾고 있어", "구인 구해요", "OO 직무 구해요" 같은 요청을 인맥 매칭용 조건으로 정리. 반환 내용을 analyze_request에 넘긴 뒤 context_matcher로 선정(recommend_talent 사용 금지).',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '사용자 요청 (한국어). 구직/구인/회사 찾기 관련.' } }, required: ['user_request'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'recommend_talent',
      description: '인맥 에이전트. 수집한 명함 중 조건에 맞는 사람 추천. 앱/프로젝트 경로에서만 단축할 때 사용. 취미·일상·구직·구인 경로에서는 사용 금지(이 경로들은 context_matcher 사용).',
      parameters: { type: 'object' as const, properties: { query: { type: 'string', description: '추천 조건 (한국어). 기획/기술 또는 취미·일상 정리 내용.' } }, required: ['query'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_contact',
      description: '컨택 에이전트. 연락 대상 + 메시지 초안 생성 후 앱 내 DM으로 자동 발송(카카오/이메일 등 외부 채널 아님). user_request에는 프로젝트·목적을 자세히 포함.',
      parameters: { type: 'object' as const, properties: { user_request: { type: 'string', description: '연락 목적·프로젝트 요약 포함 상세 요청 (한국어). 짧은 한 줄 금지.' } }, required: ['user_request'] },
    },
  },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const encoder = new TextEncoder()
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
  const stream = new ReadableStream<Uint8Array>({ start(c) { streamController = c } })
  const writeStream = (obj: unknown) => {
    if (streamController) streamController.enqueue(encoder.encode('data: ' + JSON.stringify(obj) + '\n\n'))
  }
  const closeStream = () => {
    if (streamController) {
      try { streamController.close() } catch { /* ignore */ }
      streamController = null
    }
  }
  const streamResponse = () => new Response(stream, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      writeStream({ type: 'error', message: 'Authorization header required' })
      closeStream()
      return streamResponse()
    }

    let body: { messages?: { role: string; content: string }[] }
    try {
      body = (await req.json()) as { messages?: { role: string; content: string }[] }
    } catch {
      writeStream({ type: 'error', message: 'Invalid JSON body' })
      closeStream()
      return streamResponse()
    }

    const rawMessages = body.messages ?? []
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      writeStream({ type: 'error', message: 'messages array required' })
      closeStream()
      return streamResponse()
    }
    const messages = rawMessages
      .filter((m) => m && typeof m.role === 'string')
      .map((m) => ({ role: m.role, content: String(m.content ?? '') }))
    if (messages.length === 0) {
      writeStream({ type: 'error', message: 'Valid messages (role, content) required' })
      closeStream()
      return streamResponse()
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      writeStream({ type: 'error', message: 'Invalid or expired token' })
      closeStream()
      return streamResponse()
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      writeStream({ type: 'error', message: 'OPENAI_API_KEY not configured' })
      closeStream()
      return streamResponse()
    }
    const openAiMessages: OpenAIMessage[] = [
      { role: 'system', content: ORCHESTRATOR_SYSTEM },
      ...messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '(empty)' })),
    ]

    let recommendations: { card: Record<string, unknown>; reason: string }[] = []
    let contactOutreachTip: string | undefined
    let contactOutreachTips: Record<string, string> | undefined
    let lastMessageArchitectDrafts: string | null = null
    const agentsUsed = new Set<string>()
    const agentResponses: { agent: string; content: string }[] = []
    type Step = { type: 'request'; to: string; requestText: string } | { type: 'response'; from: string; content: string }
    const steps: Step[] = []
    let openAiCallCount = 0

    // 스트림을 클라이언트에 바로 넘기고, 도구 호출은 비동기로 진행해 이벤트를 순차 전송
    void (async function runStreamingWork() {
      let senderName: string | null = null
      try {
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).single()
        const meta = (user as { user_metadata?: { full_name?: string; user_name?: string; name?: string } }).user_metadata
        senderName = prof?.name ?? meta?.full_name ?? meta?.user_name ?? meta?.name ?? null
      } catch {
        /* ignore */
      }
      try {
    for (let round = 0; round < 10; round++) {
      openAiCallCount += 1 // 오케스트레이터 1회
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          tools: TOOLS,
          tool_choice: 'auto',
          max_tokens: 4096,
          temperature: 0.4,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const errMsg = (err as { error?: { message?: string } })?.error?.message ?? 'AI 오류'
        writeStream({ type: 'error', message: errMsg })
        closeStream()
        return
      }

      let data: { choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[] }
      try {
        data = await res.json()
      } catch {
        writeStream({ type: 'error', message: 'AI 응답 파싱 실패' })
        closeStream()
        return
      }
      const choice = data?.choices?.[0]
      const msg = choice?.message
      if (!msg) {
        const errDetail = (data as { error?: { message?: string } })?.error?.message || 'AI 응답이 비어 있습니다.'
        writeStream({ type: 'error', message: errDetail })
        closeStream()
        return
      }

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const finalText = (msg.content ?? '').trim() || '답변을 생성하지 못했어요.'
        let contactSentCount = 0
        let contactSendError: string | undefined
        if (recommendations.length > 0 && (contactOutreachTip?.trim() || (contactOutreachTips && Object.keys(contactOutreachTips).length > 0))) {
          const cardIds = recommendations.map((r) => (r.card as Record<string, unknown>)?.id).filter(Boolean) as string[]
          const { data: cardRows } = cardIds.length > 0
            ? await supabase.from('user_cards').select('id, user_id').in('id', cardIds)
            : { data: [] as { id: string; user_id: string }[] }
          const cardIdToOwner = new Map((cardRows ?? []).map((c) => [c.id, c.user_id]))
          for (const r of recommendations) {
            const card = r.card as Record<string, unknown>
            const cardId = card?.id as string | undefined
            const otherUserId = (cardId ? cardIdToOwner.get(cardId) : null) ?? (card?.user_id as string | undefined) ?? (r.card as { user_id?: string }).user_id
            if (!otherUserId) {
              contactSendError = contactSendError ?? '카드에 user_id가 없어요.'
              continue
            }
            const message = (contactOutreachTips && cardId ? contactOutreachTips[cardId] : null) ?? contactOutreachTip ?? ''
            if (!message.trim()) continue
            const { error } = await supabase.rpc('send_dm_as_user', {
              sender_id: user.id,
              other_user_id: otherUserId,
              initial_message: message.trim(),
            })
            if (error) {
              contactSendError = contactSendError ?? error.message
            } else {
              contactSentCount += 1
            }
          }
        }
        writeStream({
          type: 'done',
          message: finalText,
          recommendations: recommendations.length > 0 ? recommendations : undefined,
          outreachTip: contactOutreachTip,
          outreachTips: contactOutreachTips,
          contactSentCount,
          contactSendError: contactSentCount === 0 && contactSendError ? contactSendError : undefined,
          agentsUsed: Array.from(agentsUsed),
          agentResponses: agentResponses.length > 0 ? agentResponses : undefined,
          steps: steps.length > 0 ? steps : undefined,
          openAiCallCount,
        })
        closeStream()
        return
      }

      openAiMessages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: [msg.tool_calls[0]],
      })

      // 한 턴에 하나의 도구만 실행: 총괄이 한 명한테 물어보고 → 답 받고 → 다음 턴에서 다음 에이전트 호출
      const tc = msg.tool_calls[0]
      if (!tc || !tc.function) {
        writeStream({ type: 'error', message: '도구 호출 형식이 올바르지 않아요.' })
        closeStream()
        return
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
      let stepEventSentThisTurn = false

      if (name === 'analyze_request') {
        agentLabel = 'Data Miner'
        requestText = `요청 분석: "${args.user_request ?? ''}"`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        await Promise.resolve()
        openAiCallCount += 1
        const analyzeOut = await runAnalyzeRequest(openaiKey, args.user_request ?? '', { writeStream, agentLabel })
        toolResult = analyzeOut.toolResult
        const analyzeResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: { to: agentLabel, parts: { 'GPT-4o-mini': analyzeOut.primaryText, 'GPT-3.5': analyzeOut.secondText }, synthesis: toolResult } }
        steps.push(analyzeResponse)
        writeStream({ type: 'step', request: steps[steps.length - 2], response: analyzeResponse })
        stepEventSentThisTurn = true
      } else if (name === 'context_matcher') {
        agentLabel = 'Context Matcher'
        requestText = `컨텍스트 매칭: "${args.criteria ?? ''}" (${args.context_type ?? 'business'})`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        await Promise.resolve()
        openAiCallCount += 1
        const out = await runContextMatcher(supabase, openaiKey, user.id, args.criteria ?? '', args.context_type ?? 'business', { writeStream, agentLabel })
        recommendations.push(...out.recommendations)
        toolResult = out.summary
        const ctxStepMulti =
          out.recommendations.length === 0
            ? { to: agentLabel, parts: { 'GPT-4o-mini': out.primaryText, 'GPT-3.5': out.secondText }, synthesis: 'idle' as const }
            : out.secondText === ''
              ? { to: agentLabel, parts: { 'GPT-4o-mini': out.primaryText }, synthesis: 'idle' as const }
              : { to: agentLabel, parts: { 'GPT-4o-mini': out.primaryText, 'GPT-3.5': out.secondText }, synthesis: toolResult }
        const ctxResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: ctxStepMulti }
        steps.push(ctxResponse)
        writeStream({ type: 'step', request: steps[steps.length - 2], response: ctxResponse })
        stepEventSentThisTurn = true
      } else if (name === 'message_architect') {
        agentLabel = 'Message Architect'
        requestText = `메시지 설계: ${(args.user_request ?? '').trim() || '(맥락 없음)'} tone=${args.tone ?? 'business'}`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        await Promise.resolve()
        openAiCallCount += 1
        let cardIdsArg = args.card_ids ?? '[]'
        if (recommendations.length > 0) {
          const idsFromRecommendations = recommendations.map((r) => (r.card as Record<string, unknown>).id).filter(Boolean) as string[]
          if (idsFromRecommendations.length > 0) cardIdsArg = JSON.stringify(idsFromRecommendations)
        } else {
          try {
            const parsed = typeof cardIdsArg === 'string' ? JSON.parse(cardIdsArg) : cardIdsArg
            const arr = Array.isArray(parsed) ? parsed : parsed?.ids
            if (!arr?.length) cardIdsArg = '[]'
          } catch {
            cardIdsArg = '[]'
          }
        }
        const userRequestForArchitect = (args.user_request ?? '').trim() || '선정된 인원에게 프로젝트/협업 목적에 맞는 연락 메시지 초안을 작성해 주세요.'
        const archOut = await runMessageArchitect(supabase, openaiKey, user.id, userRequestForArchitect, cardIdsArg, args.tone ?? 'business', { writeStream, agentLabel })
        toolResult = archOut.toolResult
        // DM 발송용은 반드시 인당 초안(## 이름 \n 메시지)만 사용. 조율자 결과(논의 요약·타협점 등)를 넣으면 파싱 시 잘못 매칭되어 이상한 메시지가 전송됨.
        lastMessageArchitectDrafts = archOut.primaryText
          .replace(/\n\n## 메시지 설계 \(GPT-3\.5\)[\s\S]*/i, '')
          .replace(/\n\n## 메시지 설계 \(Gemini\)[\s\S]*/i, '')
          .replace(/^## 메시지 설계 \(GPT-4o-mini\)\n?/i, '')
          .replace(/^## 메시지 설계 \(GPT-4o-mini\)\n?/i, '')
          .trim()
        const archResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: { to: agentLabel, parts: { 'GPT-4o-mini': archOut.primaryText, 'GPT-3.5': archOut.secondText }, synthesis: toolResult } }
        steps.push(archResponse)
        writeStream({ type: 'step', request: steps[steps.length - 2], response: archResponse })
        stepEventSentThisTurn = true
      } else if (name === 'recommend_talent') {
        agentLabel = '인맥 추천'
        requestText = `인맥 추천: "${args.query ?? ''}"`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        await Promise.resolve()
        openAiCallCount += 1
        const out = await runRecommendTalent(supabase, openaiKey, user.id, args.query ?? '', { writeStream, agentLabel })
        recommendations.push(...out.recommendations)
        toolResult = out.summary
        const talentResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: { to: agentLabel, parts: { 'GPT-4o-mini': out.primaryText, 'GPT-3.5': out.secondText }, synthesis: toolResult } }
        steps.push(talentResponse)
        writeStream({ type: 'step', request: steps[steps.length - 2], response: talentResponse })
        stepEventSentThisTurn = true
      } else if (name === 'suggest_idea') {
        agentLabel = '기획·아이디어'
        requestText = `기획·아이디어 조언 요청: "${args.user_request ?? ''}"`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        writeStream({ type: 'step_multi_start', to: agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
        await Promise.resolve()
        openAiCallCount += 1
        const ideaSystem = `You are an app/product idea consultant. Answer in Korean. Give detailed, practical brainstorming and planning advice.

**반드시 포함할 내용:**
1. **핵심 차별화(Killer Feature)**: "기존 앱 대신 왜 이 앱을 써야 하는가?"를 답할 수 있는 차별화 포인트를 제안하세요. (예: AI 점수판, 카메라로 공 궤적 분석, 오프라인 연동 등)
2. **실제 사용 시나리오(컨텍스트)**: 앱이 쓰이는 장소·상황을 고려한 UI/UX를 제안하세요. (예: 당구장이면 손에 초크, 한 손으로 큐를 들 수 있음 → 한 손 조작 모드, 음성 인식 점수 입력 등)
3. **O2O·수익 모델**: 동네 매장 예약, 키오스크 연동, 오프라인 연동 등 실질적인 수익·연동 방안이 있으면 포함하세요.
4. 기능 정의, 타겟 사용자, UI/UX 방향, 마케팅 전략을 구체적으로 적되, 위 1~3을 빠뜨리지 마세요.`
        const userReq = args.user_request ?? ''
        const [openaiIdea, secondIdea] = await Promise.all([
          callLlm(openaiKey, ideaSystem, userReq).then((r) => {
            writeStream({ type: 'step_part', from: agentLabel, part: 'GPT-4o-mini', content: r })
            return r
          }),
          callOpenAISecondModel(openaiKey, ideaSystem, userReq, 3200, (level, msg) => writeStream({ type: 'log', level, message: msg })).then((r) => {
            writeStream({ type: 'step_part', from: agentLabel, part: 'GPT-3.5', content: r })
            return r
          }),
        ])
        writeStream({ type: 'step_synthesis', from: agentLabel, status: 'thinking' })
        toolResult = await runSynthesis(openaiKey, '기획', openaiIdea, secondIdea, writeStream)
        writeStream({ type: 'step_synthesis', from: agentLabel, content: toolResult })
        const ideaResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: { to: agentLabel, parts: { 'GPT-4o-mini': openaiIdea, 'GPT-3.5': secondIdea }, synthesis: toolResult } }
        steps.push(ideaResponse)
        writeStream({ type: 'step', request: steps[steps.length - 2], response: ideaResponse })
        stepEventSentThisTurn = true
      } else if (name === 'suggest_tech') {
        agentLabel = '기술 스택'
        requestText = `기술 스택 추천 요청 (아이디어 요약): "${args.idea_summary ?? ''}"`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        writeStream({ type: 'step_multi_start', to: agentLabel, parts: ['GPT-4o-mini', 'GPT-3.5'] })
        await Promise.resolve()
        openAiCallCount += 1
        const techSystem = `You recommend technology stacks (frontend, backend, DB, deployment) for app ideas. Answer in Korean. Be specific (e.g. React, Node, Supabase).

**반드시 지킬 것:**
1. **DB 일관성**: MongoDB와 Firebase Firestore를 동시에 추천하지 마세요. 역할이 겹치는 NoSQL을 두 개 쓰면 관리가 파편화됩니다. 하나로 통합하거나, 실시간·리더보드·통계처럼 관계가 중요한 데이터는 **Supabase(PostgreSQL)** 같은 관계형 DB를 추천하세요.
2. **실시간/게임·순위**: 게임 매칭, 리더보드, 통계 추적은 관계형(SQL)이 정밀하게 처리하기 유리할 수 있음. Supabase 검토 권장.
3. **실시간 소켓(Socket.io 등)**: 실시간 대전/채팅을 추천할 때는 서버 확장성(Scalability), 동시 접속 대응을 한 줄이라도 언급하세요.
4. 프론트/백엔드/DB/배포를 구체적으로 제시하되, 위 규칙을 지키세요.`
        const ideaSummary = args.idea_summary ?? ''
        const [openaiTech, secondTech] = await Promise.all([
          callLlm(openaiKey, techSystem, ideaSummary).then((r) => {
            writeStream({ type: 'step_part', from: agentLabel, part: 'GPT-4o-mini', content: r })
            return r
          }),
          callOpenAISecondModel(openaiKey, techSystem, ideaSummary, 2400, (level, msg) => writeStream({ type: 'log', level, message: msg })).then((r) => {
            writeStream({ type: 'step_part', from: agentLabel, part: 'GPT-3.5', content: r })
            return r
          }),
        ])
        writeStream({ type: 'step_synthesis', from: agentLabel, status: 'thinking' })
        toolResult = await runSynthesis(openaiKey, '기술 스택', openaiTech, secondTech, writeStream)
        writeStream({ type: 'step_synthesis', from: agentLabel, content: toolResult })
        const techResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: { to: agentLabel, parts: { 'GPT-4o-mini': openaiTech, 'GPT-3.5': secondTech }, synthesis: toolResult } }
        steps.push(techResponse)
        writeStream({ type: 'step', request: steps[steps.length - 2], response: techResponse })
        stepEventSentThisTurn = true
      } else if (name === 'clarify_casual_request') {
        agentLabel = '취미·일상 정리'
        requestText = `취미·일상 요청 정리: "${args.user_request ?? ''}"`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        await Promise.resolve()
        openAiCallCount += 1
        const casualOut = await runClarifyCasualRequest(openaiKey, args.user_request ?? '', { writeStream, agentLabel })
        toolResult = casualOut.toolResult
        const casualResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: { to: agentLabel, parts: { 'GPT-4o-mini': casualOut.primaryText, 'GPT-3.5': casualOut.secondText }, synthesis: toolResult } }
        steps.push(casualResponse)
        writeStream({ type: 'step', request: steps[steps.length - 2], response: casualResponse })
        stepEventSentThisTurn = true
      } else if (name === 'clarify_job_request') {
        agentLabel = '구직·구인 정리'
        requestText = `구직·구인 요청 정리: "${args.user_request ?? ''}"`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        await Promise.resolve()
        openAiCallCount += 1
        const jobOut = await runClarifyJobRequest(openaiKey, args.user_request ?? '', { writeStream, agentLabel })
        toolResult = jobOut.toolResult
        const jobResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: { to: agentLabel, parts: { 'GPT-4o-mini': jobOut.primaryText, 'GPT-3.5': jobOut.secondText }, synthesis: toolResult } }
        steps.push(jobResponse)
        writeStream({ type: 'step', request: steps[steps.length - 2], response: jobResponse })
        stepEventSentThisTurn = true
      } else if (name === 'suggest_contact') {
        agentLabel = '컨택'
        requestText = `컨택·연락 추천 요청: "${args.user_request ?? ''}"`
        agentsUsed.add(agentLabel)
        writeStream({ type: 'decision', to: agentLabel })
        steps.push({ type: 'request', to: agentLabel, requestText })
        writeStream({ type: 'step', request: steps[steps.length - 1], response: null })
        await Promise.resolve()
        openAiCallCount += 1
        const out = await runSuggestContact(
          supabase,
          openaiKey,
          user.id,
          args.user_request ?? '',
          recommendations.length > 0
            ? { recommendedCards: recommendations, senderName, existingDrafts: lastMessageArchitectDrafts }
            : { senderName },
          { writeStream, agentLabel }
        )
        if (recommendations.length > 0) {
          contactOutreachTip = out.outreachTip
          contactOutreachTips = out.outreachTips
          toolResult = out.summary
        } else {
          recommendations.push(...out.recommendations)
          if (out.outreachTip) contactOutreachTip = out.outreachTip
          contactOutreachTips = out.outreachTips
          toolResult = out.summary
        }
        if (out.primaryText != null && out.secondText != null) {
          const contactResponse = { type: 'response' as const, from: agentLabel, content: toolResult, stepMulti: { to: agentLabel, parts: { 'GPT-4o-mini': out.primaryText, 'GPT-3.5': out.secondText }, synthesis: toolResult } }
          steps.push(contactResponse)
          writeStream({ type: 'step', request: steps[steps.length - 2], response: contactResponse })
          stepEventSentThisTurn = true
        }
      } else {
        agentLabel = '알 수 없음'
        requestText = ''
        toolResult = '알 수 없는 도구입니다.'
      }

      if (!stepEventSentThisTurn) {
        steps.push({ type: 'response', from: agentLabel, content: toolResult })
      }
      agentResponses.push({ agent: agentLabel, content: toolResult })
      openAiMessages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult })
      if (steps.length >= 2 && !stepEventSentThisTurn) {
        writeStream({ type: 'step', request: steps[steps.length - 2], response: steps[steps.length - 1] })
      }
    }

    const lastAssistant = openAiMessages.filter((m) => m.role === 'assistant').pop() as { content?: string | null } | undefined
    const finalText = (lastAssistant?.content ?? '').trim() || '답변이 길어져 여기서 마무리할게요.'
    let contactSentCount = 0
    let contactSendError: string | undefined
    if (recommendations.length > 0 && (contactOutreachTip?.trim() || (contactOutreachTips && Object.keys(contactOutreachTips).length > 0))) {
      const cardIds = recommendations.map((r) => (r.card as Record<string, unknown>)?.id).filter(Boolean) as string[]
      const { data: cardRows } = cardIds.length > 0
        ? await supabase.from('user_cards').select('id, user_id').in('id', cardIds)
        : { data: [] as { id: string; user_id: string }[] }
      const cardIdToOwner = new Map((cardRows ?? []).map((c) => [c.id, c.user_id]))
      for (const r of recommendations) {
        const card = r.card as Record<string, unknown>
        const cardId = card?.id as string | undefined
        const otherUserId = (cardId ? cardIdToOwner.get(cardId) : null) ?? (card?.user_id as string | undefined) ?? (r.card as { user_id?: string }).user_id
        if (!otherUserId) {
          contactSendError = contactSendError ?? '카드에 user_id가 없어요.'
          continue
        }
        const message = (contactOutreachTips && cardId ? contactOutreachTips[cardId] : null) ?? contactOutreachTip ?? ''
        if (!message.trim()) continue
        const { error } = await supabase.rpc('send_dm_as_user', {
          sender_id: user.id,
          other_user_id: otherUserId,
          initial_message: message.trim(),
        })
        if (error) {
          contactSendError = contactSendError ?? error.message
        } else {
          contactSentCount += 1
        }
      }
    }
    const safeMessage = (finalText && String(finalText).trim()) ? String(finalText).trim() : '답변을 생성하지 못했어요.'
    writeStream({
      type: 'done',
      message: safeMessage,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      outreachTip: contactOutreachTip,
      outreachTips: contactOutreachTips,
      contactSentCount,
      contactSendError: contactSentCount === 0 && contactSendError ? contactSendError : undefined,
      agentsUsed: Array.from(agentsUsed),
      agentResponses: agentResponses.length > 0 ? agentResponses : undefined,
      steps: steps.length > 0 ? steps : undefined,
      openAiCallCount,
    })
    closeStream()
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        writeStream({ type: 'error', message: err.message || 'Internal error' })
        closeStream()
      }
    })()
    return streamResponse()
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    writeStream({ type: 'error', message: err.message || 'Internal error' })
    closeStream()
    return streamResponse()
  }
})
