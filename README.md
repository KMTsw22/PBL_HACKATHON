# My Networking Agent

명함 수집·관리와 AI 에이전트를 활용한 인맥/팀 구성·연락 추천 앱입니다.

## 스택

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, DB, Storage, Edge Functions, Realtime)
- **AI**: OpenAI (카드 분석, Ask 에이전트)

## 주요 기능

- **Find**: 명함 탐색·수집
- **Collect**: 내가 수집한 명함 관리·평가
- **Messages**: 1:1 DM (채팅 목록 + 스레드, 인스타 디엠 스타일)
- **Ask**: AI 에이전트(기획/개발/인맥/컨택)로 팀 구성·연락 추천
- **Settings**: 프로필·설정

### 예시 카드 시드 (다양한 이름)

Find에서 수집·테스트할 수 있도록 **예시 카드 36장**(직업·취미·공부 등 다양한 이름·직함)을 넣을 수 있습니다.

- **로컬**: `supabase db reset`(마이그레이션+시드) 또는 `supabase db seed`(시드만)
- **클라우드**: Supabase 대시보드 → SQL Editor에서 `supabase/seed.sql` 내용 실행

데모 계정: `demo-cards@example.com` / `demo1234` (예시 카드 소유자).

---

## Ask 에이전트 구조

Ask 페이지에서는 **총괄 에이전트(오케스트레이터)**가 사용자 요청을 받고, 목적에 맞는 **서브 에이전트**를 순서대로 호출한 뒤 최종 요약과 연락까지 이어줍니다. 모든 인맥 추천은 **사용자가 수집한 명함** 안에서만 이뤄집니다.

### 전체 구조

```
[사용자] → [총괄 에이전트] → 서브 에이전트 1 → 서브 에이전트 2 → … → [최종 요약 + 연락(DM)]
```

- **총괄 에이전트**: 한 턴에 **도구 1개만** 호출. 각 도구 결과를 받은 뒤 다음 에이전트에게 **맥락을 포함해** 넘김.
- **원칙**: 같은 목표라면 **에이전트를 최대한 많이 쓰는 경로**를 우선 (단축 경로도 가능).

### 서브 에이전트 목록

| 도구 (영문) | 표시 이름 | 역할 |
|-------------|-----------|------|
| `suggest_idea` | 기획 에이전트 | 앱/서비스/프로젝트 기획 (기능·타겟·UI/UX 등). **앱 만들고 싶을 때만** 사용. |
| `suggest_tech` | 개발 에이전트 | 기획 요약을 받아 **기술 스택**(프론트/백/DB/배포) 추천. 기획 이후에만 호출. |
| `clarify_casual_request` | 취미·일상 정리 | "취미 같이 할 사람", "스터디", "같이 운동" 등을 **인맥 매칭용 조건**으로 2~4문장 정리. |
| `clarify_job_request` | 구직·구인 정리 | "회사 찾고 있어", "구인 구해요" 등을 **인맥 매칭용 조건**으로 정리. |
| `analyze_request` | Data Miner | 요청에서 **추천 조건(criteria)**·**컨텍스트(business/casual)**를 JSON으로 추출. 파이프라인 첫 단계로 쓰면 활용도 ↑. |
| `context_matcher` | Context Matcher | 추출된 조건에 맞는 인원을 **수집 명함**에서 선정. analyze_request 결과를 그대로 넘김. |
| `message_architect` | Message Architect | 선정된 인원별 **개인화 메시지 초안** 생성. context_matcher가 준 카드 id 배열을 `card_ids`로 넘김. |
| `recommend_talent` | 인맥 에이전트 | 수집 명함 중 조건에 맞는 사람 추천. **단축 경로**용(에이전트 수를 줄일 때). |
| `suggest_contact` | Contact 에이전트 | 연락 대상 + 메시지 초안 생성 후 **앱 내 DM**으로 자동 발송. **마지막에 한 번 호출**해야 연락 발송. |

### 플로우 예시

- **앱/프로젝트**  
  `suggest_idea` → `suggest_tech` → `analyze_request` → `context_matcher` → `message_architect` → `suggest_contact` → 최종 정리

- **취미·일상**  
  `clarify_casual_request` → `analyze_request` → `context_matcher` → `message_architect` → `suggest_contact` → 최종 정리  
  (suggest_idea, suggest_tech 사용 안 함)

- **구직·구인·회사 찾기**  
  `clarify_job_request` → `analyze_request` → `context_matcher` → `message_architect` → `suggest_contact` → 최종 정리  
  (suggest_idea, suggest_tech 사용 안 함)

- **단축 경로**  
  `clarify_*` 또는 기획·기술 요약 뒤 `recommend_talent` → `suggest_contact`

### 구현 위치

- **백엔드**: `supabase/functions/ask-agent/index.ts` (ORCHESTRATOR_SYSTEM, 도구 정의, 각 `run*` 함수)
- **프론트**: `src/pages/Ask.tsx` (스트리밍 UI, 대화 저장), `src/lib/askAgent.ts` (스트리밍 호출)
- **대화 저장**: `src/lib/askConversations.ts`, `supabase/migrations/015_ask_conversations.sql`

### 다중 LLM (OpenAI + Gemini) / 토론형 에이전트 — 로드맵

기획1=OpenAI, 기획2=Gemini처럼 **서로 다른 API를 쓰는 하위 에이전트**가 “토론”하듯 답하고, 그 결과를 합쳐 쓰는 구조로 확장하려면 아래 순서를 추천합니다.

#### 1. 현재 구조 파악

- **OpenAI만 사용**: `ask-agent/index.ts` 안에서 모든 하위 에이전트가 `fetch('https://api.openai.com/v1/chat/completions', ...)` 또는 공용 `callLlm(openaiKey, systemPrompt, userContent)` 로 호출됨.
- **호출 위치**: `callLlm`(기획·기술), `runSuggestContact`, `runMessageArchitect`, `runContextMatcher`, `runAnalyzeRequest`, `runRecommendTalent`, `runClarifyCasualRequest`, `runClarifyJobRequest` 등이 각각 OpenAI를 직접 호출.

#### 2. Gemini API 연동 (1단계)

| 할 일 | 설명 |
|-------|------|
| **API 키** | Gemini API 키 발급 후 Supabase Edge Function 시크릿에 `GEMINI_API_KEY` 등록. |
| **호출 함수 추가** | `index.ts`에 `callGemini(geminiKey, model, messages)` 함수 추가. Gemini REST: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=KEY`, body는 [Gemini API 문서](https://ai.google.dev/api/rest/v1beta/models/generateContent) 형식 (contents, systemInstruction 등). |
| **메시지 형식 맞추기** | OpenAI는 `{ role, content }` 배열. Gemini는 `contents[]` 안에 `role`(user/model), `parts: [{ text }]`. system은 `systemInstruction` 또는 첫 user 메시지로 전달. 변환 유틸 하나 두면 재사용하기 좋음. |

이 단계만 끝나면 “특정 에이전트만 Gemini로 바꿔 호출”이 가능해짐.

#### 3. 추상화 레이어 (선택, 2단계)

- **옵션 A**: `callLlm(provider: 'openai' | 'gemini', systemPrompt, userContent, options?)` 하나로 통합. 내부에서 provider에 따라 `callOpenAI` / `callGemini` 분기.
- **옵션 B**: 지금처럼 `callLlm`(OpenAI 전용)은 유지하고, Gemini용 `callGemini`만 추가한 뒤, “토론”이 필요한 도구에서만 두 API를 모두 호출.

토론형을 먼저 만들 때는 **옵션 B**로 가도 충분함.

#### 4. “기획1 OpenAI + 기획2 Gemini” 토론형 도구 (3단계)

- **방식 1 — 기존 도구 확장**  
  `suggest_idea` 호출 시:
  1. 동일 `user_request`로 **OpenAI** 기획 1회 호출 → 응답 A  
  2. 같은 `user_request`로 **Gemini** 기획 1회 호출 → 응답 B  
  3. 한 번에 반환: `"## 기획 관점 (OpenAI)\n...\n\n## 기획 관점 (Gemini)\n...\n\n(선택) 공통점·보완점 요약"`  
  총괄/다음 에이전트는 이 합친 텍스트를 그대로 받아서 사용.

- **방식 2 — 새 도구 추가**  
  `suggest_idea_debate` 같은 도구를 하나 더 두고, 위 1~3을 그 도구 안에서만 수행. 오케스트레이터 프롬프트에 “앱 기획 시 suggest_idea_debate 우선 호출” 등을 넣어서 토론형 기획만 이 경로로 타게 할 수 있음.

- **구현 시 유의**  
  - 두 API 호출을 `Promise.all`로 병렬 처리하면 지연 감소.  
  - 한쪽만 실패해도 다른 쪽 결과는 그대로 반환하고, 실패한 쪽만 “(Gemini 응답 없음)” 등으로 표시하는 편이 UX에 유리함.

#### 5. 다른 에이전트에 적용 (4단계)

- **suggest_tech**: 기획처럼 “기술 관점 1 (OpenAI) / 기술 관점 2 (Gemini)” 형태로 두 번 호출 후 합치기.
- **analyze_request, context_matcher** 등:  
  - 토론이 필요 없으면 지금처럼 OpenAI만 사용.  
  - “다른 관점도 보고 싶다”면 해당 도구 안에서만 OpenAI + Gemini 각 1회 호출 후 결과를 합쳐서 반환하는 패턴을 그대로 재사용하면 됨.

#### 6. 정리 — 어디서부터 할지

1. **먼저**: `callGemini` 구현 + `GEMINI_API_KEY` 설정 (위 2단계).  
2. **다음**: `suggest_idea`(또는 `suggest_idea_debate`)에서 OpenAI 1회 + Gemini 1회 호출 후 하나의 문자열로 합쳐 반환 (위 3·4단계).  
3. **이후**: 필요하면 `suggest_tech` 등 다른 도구에도 같은 “두 API 호출 → 결과 합치기” 패턴 적용.

이 순서로 하면 “기획1은 OpenAI, 기획2는 Gemini로 서로 토론하는 느낌”을 최소 변경으로 도입할 수 있고, 이후 다른 하위 에이전트로도 같은 방식으로 확장할 수 있습니다.

---

## 1:1 채팅 (DM) 설계 — 인스타 디엠 스타일

앱 내에서 **수집한 명함 상대방과 1:1로 연락**할 수 있는 채팅 기능을 인스타그램 DM처럼 설계하는 방안입니다.

### 1. 목표

- **인스타 디엠과 유사한 구조**: 채팅 목록(대화 목록) → 대화 선택 시 해당 상대와의 **1:1 메시지 스레드** 표시
- **진입점**: 카드 상세에서 "연락하기" / Ask 추천 결과에서 "연락하기" → 해당 유저와의 **채팅방 생성 또는 기존 채팅방으로 이동**
- **실시간**: 새 메시지 수신 시 목록·스레드 반영 (Supabase Realtime)

### 2. 데이터 모델 (Supabase)

#### 2.1 대화(채팅방) — `conversations`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `created_at` | timestamptz | 생성 시각 |
| `updated_at` | timestamptz | 마지막 메시지 시각 (목록 정렬용) |

- **1:1 고정**: 한 대화 = 참여자 2명만. 인스타 DM처럼 "대화" 단위가 1:1 방.

#### 2.2 대화 참여자 — `conversation_participants`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `conversation_id` | uuid | FK → conversations |
| `user_id` | uuid | FK → auth.users (참여자) |
| `joined_at` | timestamptz | 참여 시각 |
| `last_read_at` | timestamptz | (선택) 읽음 처리용 |

- **Unique**: `(conversation_id, user_id)` 한 쌍당 한 행.
- **역할**: "나와 상대"를 한 대화에 묶고, 나중에 읽음/알림 확장 시 사용.

#### 2.3 메시지 — `messages`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK |
| `conversation_id` | uuid | FK → conversations |
| `sender_id` | uuid | FK → auth.users (보낸 사람) |
| `content` | text | 메시지 본문 (텍스트) |
| `created_at` | timestamptz | 전송 시각 |
| `metadata` | jsonb | (선택) 첨부/타입 등 확장용 |

- **인스타 디엠처럼**: 일단 **텍스트만** 저장. 이후 이미지/링크는 `metadata` 또는 별도 테이블로 확장.

### 3. 흐름 (User Flow)

1. **채팅 목록 (인스타 DM 목록)**
   - `conversation_participants`에서 현재 유저가 참여한 `conversation_id` 목록 조회
   - 각 대화별로 **마지막 메시지 1건** + **상대 참여자 1명** (프로필/이름) 조회
   - `conversations.updated_at` 또는 마지막 메시지 `created_at` 기준 **최신순 정렬**
   - 읽지 않은 메시지 수(선택) 표시

2. **대화 스레드 (1:1 채팅방)**
   - 특정 `conversation_id` 선택 시 해당 대화의 `messages` 페이지네이션 조회 (최신순 → 위로 스크롤 시 과거 로드)
   - 상대방 정보: `conversation_participants`에서 나 제외한 `user_id` → `profiles`/`user_cards`로 이름·사진 표시
   - 입력창에서 텍스트 입력 후 전송 → `messages`에 INSERT, `conversations.updated_at` 갱신

3. **진입점: "연락하기"**
   - **카드 상세** 또는 **Ask 추천 카드**에서 "연락하기" 클릭
   - 상대 `user_id`(카드 소유자) 결정
   - **이미 대화 존재 여부 조회**: (나, 상대)가 포함된 `conversation_participants`가 있는 `conversation_id` 검색
   - 없으면: `conversations` 1건 + `conversation_participants` 2건 생성 후 해당 채팅방으로 이동
   - 있으면: 해당 채팅방으로 바로 이동

### 4. UI 구조 (인스타 디엠 참고)

- **라우트**
  - `/chats` — 채팅 목록 (대화 목록)
  - `/chats/:conversationId` — 1:1 채팅 스레드
- **레이아웃**
  - 목록: 각 행 = [상대 프로필/이름 | 마지막 메시지 미리보기 | 시간]
  - 스레드: 상단에 상대 이름·프로필, 중앙 메시지 목록(말풍선), 하단 입력창 + 전송 버튼
- **네비게이션**: 하단 탭 또는 상단에 "채팅" 진입점 추가

### 5. Realtime (실시간 반영)

- **Supabase Realtime** 구독 대상: `messages` (해당 `conversation_id`만 필터) 또는 `conversations`
- 새 행 INSERT 시 클라이언트에서 목록/스레드에 반영 (낙관적 업데이트 + 서버 이벤트로 동기화)
- (선택) `conversation_participants.last_read_at` 갱신으로 "읽음" 표시

### 6. 보안 (RLS)

- **conversations**: 참여자만 조회/수정 허용 (참여 여부는 `conversation_participants`로 판단)
- **conversation_participants**: 자신이 참여한 대화만 SELECT; INSERT는 대화 생성 시에만 (서버/트리거 또는 클라이언트 정책으로 생성 권한 제한)
- **messages**: 해당 대화의 참여자만 SELECT; INSERT는 자신이 참여한 대화에만, sender_id = auth.uid()

### 7. 구현 순서 제안

1. **DB**: `conversations`, `conversation_participants`, `messages` 테이블 + RLS
2. **API/훅**: 대화 목록 조회, 대화 생성(또는 기존 반환), 메시지 목록·전송, Realtime 구독
3. **페이지**: `/chats` 목록, `/chats/:id` 스레드
4. **진입점**: 카드 상세·Ask 추천 카드에 "연락하기" 버튼 → 채팅 생성/이동
5. (선택) 읽음 처리, 알림 배지, 이미지/첨부 확장

---

---

### 8. 구현 상태

- **DB**: `supabase/migrations/010_dm_conversations.sql` 적용 (conversations, conversation_participants, messages, RLS, `get_or_create_dm_conversation` 함수).
- **UI**: `/chats` 목록(검색, AI Agent Suggestions, Recent), `/chats/:id` 스레드(말풍선, Agent Insights 카드, 입력창).
- **진입점**: 카드 상세(Find/Collect/Ask)에서 "연락하기" → 해당 유저와 대화 생성 또는 기존 대화로 이동.
- **Realtime**: Supabase Dashboard → Database → Replication에서 `messages` 테이블을 publication에 추가하면 실시간 수신 가능.
