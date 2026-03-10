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
