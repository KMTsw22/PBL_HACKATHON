# 5분 발표용 자료

- **발표 언어**: 영어  
- **PPT 제작**: Gamma AI, 한글 슬라이드  
- **이미지**: 직접 첨부하여 사용  

---

## Gamma AI용 한글 프롬프트 (이미지와 함께 입력할 내용)

아래 블록을 **복사해서 Gamma AI에 붙여넣고, 각 슬라이드에 넣을 스크린샷/이미지를 순서대로 첨부**한 뒤 생성하면 됩니다.

---

```
주제: "My Networking Agent" — 명함 수집·관리와 AI 에이전트 기반 인맥 추천 서비스

대상: 해커톤/데모 발표 (5분 분량)
슬라이드 언어: 한글
톤: 간결하고 핵심만. 불릿 위주, 문장은 짧게.

---

[슬라이드 1] 표지
- 제목: My Networking Agent
- 부제: 명함 수집부터 AI 추천·연락 초안까지, 한 앱에서
- (첨부 이미지 1: 앱 로고 또는 메인 화면)

---

[슬라이드 2] 문제 정의
- 명함은 모으기만 하고 활용이 잘 안 됨
- "누구한테 연락해야 할지", "뭐라고 써야 할지" 고민
- 수집한 명함과 대화만으로 맞춤 인맥 추천·메시지 초안을 받고 싶다
- (첨부 이미지 2: 명함 더미 또는 Before 상황)

---

[슬라이드 3] 솔루션 한 줄
- My Networking Agent: **수집 명함 + 자연어 요청 → AI가 조건에 맞는 사람을 골라주고, 연락 메시지 초안까지 작성**
- Find(명함 발견) → 수집 → Ask(채팅)에서 "React 개발자 구해요", "스터디 같이할 사람"처럼 말하면 끝
- (첨부 이미지 3: Ask 화면 또는 대화 예시)

---

[슬라이드 4] 핵심 기능 3가지
1) **명함 발견·수집**: Find 탭에서 다른 사용자 명함을 보고 수집, Collect에서 내 수집함 관리·평가
2) **AI 에이전트 (Ask) — 멀티 에이전트 구조**: 한 분야(같은 작업)에서도 **같은 모델이 아닌 서로 다른 모델**(예: GPT-4o-mini vs GPT-3.5)을 써서 **서로 다른 아이디어·관점**을 도출한 뒤, 총괄이 종합·타협. 여러 에이전트가 감시·관리·문제 해결하며 요청 분석 → 인원 선정 → 연락 초안 → 발송까지 수행
3) **내 명함 관리**: 홈에서 내 명함 추가·수정, QR/공유로 나를 알리기
- (첨부 이미지 4: Find / Collect / Home 중 대표 화면)

---

[슬라이드 5] 기술 스택 & 아키텍처
- 프론트: React, Vite, TypeScript, Tailwind, Capacitor(모바일)
- 백엔드·DB: Supabase (Auth, DB, Edge Functions)
- AI: **멀티 에이전트 + 다른 모델로 다른 아이디어** — 같은 단계에서 GPT-4o-mini와 GPT-3.5 등 **서로 다른 모델**을 동시에 써서 **다양한 관점·아이디어**를 뽑고, 총괄이 두 결과를 종합·타협해 결론 도출 (한 모델만 쓰는 구조 아님)
- (첨부 이미지 5: 앱 구조 다이어그램 또는 코드/대시보드 스크린샷)

---

[슬라이드 6] 멀티 에이전트 플로우 (Ask) — 핵심: 다른 모델 → 다른 아이디어 → 종합·타협
- **총괄 에이전트**가 사용자 요청을 받고, 필요한 하위 에이전트를 순차 호출
- **한 분야(같은 작업)에서 같은 모델이 아니라 서로 다른 모델 사용**: 예) 요청 분석 시 GPT-4o-mini와 GPT-3.5가 **각자 다른 분석·아이디어**를 제출 → 총괄이 두 의견을 **종합·타협·문제 해결** 후 다음 단계로 전달. 인원 선정·메시지 초안 단계도 동일하게 **다른 모델로 다른 안**을 뽑고 종합
- 플로우: Analyze Request → (선택) Suggest Idea / Suggest Tech → Context Matcher → Message Architect → Suggest Contact
- **차별점**: 한 모델만 쓰는 게 아니라, **다른 모델이 다른 아이디어를 내고** 그걸 논의·타협해 더 나은 결과를 만드는 구조
- (첨부 이미지 6: Ask 대화 흐름 또는 에이전트 단계 스크린샷)

---

[슬라이드 7] 차별점 & 다음 단계
- 차별점 1: **같은 작업에 같은 모델이 아닌 서로 다른 모델**을 써서 **서로 다른 아이디어**를 도출 → 총괄이 종합·타협·문제 해결 (다양성 확보가 핵심)
- 차별점 2: 멀티 에이전트가 서로 감시·관리하며 협업
- 차별점 3: "명함 수집"과 "누구에게 뭐라고 연락할지"를 한 흐름으로 연결, 수집 데이터 기반 추천
- 다음: 더 많은 명함 데이터, 피드백 반영한 추천 정확도 개선, 실연락 발송 UX 강화
- (첨부 이미지 7: 연락 발송 화면 또는 로드맵 스케치)

---

[슬라이드 8] 마무리
- 제목: My Networking Agent — 수집한 명함, 이제 제대로 써보세요
- QR 또는 앱 다운로드/데모 링크(있을 경우)
- (첨부 이미지 8: 최종 앱 화면 또는 팀/로고)

---

요청 사항:
- 각 슬라이드에 제가 첨부한 이미지를 해당 순서에 맞게 배치해 주세요.
- 텍스트는 한글로, 불릿과 짧은 문장 위주로 유지해 주세요.
- 5분 발표에 맞게 슬라이드 수(8장)와 분량을 유지해 주세요.
```

---

## 영어 5분 발표 스크립트 (참고용)

1. **Opening (30초)**  
   "Hi, I'm going to present **My Networking Agent** — an app that turns your collected business cards into actionable connections. You collect cards, ask in plain language who to contact and what to say, and the AI suggests people and drafts messages for you."

2. **Problem (30초)**  
   "We all collect name cards but rarely use them. We forget who to contact for what, and we struggle to write the first message. We wanted one place where your collected cards and a simple chat request lead to personalized recommendations and message drafts."

3. **Solution (1분)**  
   "In My Networking Agent you **discover and collect** cards in the Find tab, manage them in Collect, and in **Ask** you just type things like 'I need a React developer' or 'people for a study group.' The AI analyzes your request, picks 2–5 people from your collection that fit, and writes **personalized message drafts** for each. You can then send those messages in-app."

4. **Features (1분)**  
   "Main features: (1) **Find & Collect** — browse others’ cards, collect and rate them. (2) **Ask** — **multi-agent AI where we deliberately use different models, not the same model, for the same task**: for example, GPT-4o-mini and GPT-3.5 each do the same analysis and produce different ideas; the orchestrator then synthesizes and reconciles them. So the key is **different models → different ideas → then compromise**. Agents monitor and correct each other. (3) **My cards** — create and manage your own card with QR and sharing."

5. **Tech (30초)**  
   "Built with React, TypeScript, and Vite on the front; Supabase for auth, database, and Edge Functions; and OpenAI for the agents. We use Capacitor for mobile."

6. **Flow (30초)**  
   "When you ask something in Ask, the **orchestrator** runs multiple agents. At each key step we use **different models** — e.g. GPT-4o-mini and GPT-3.5 — on the same task so they produce **different ideas**; the orchestrator then synthesizes and reconciles. So the flow is Analyze Request → Context Matcher → Message Architect → Suggest Contact, but the core is **different models, different perspectives, then compromise** — not one model doing everything."

7. **Closing (30초)**  
   "Our differentiator is using **different models for the same task to get different ideas**, then having the orchestrator synthesize and compromise — not one model or a simple pipeline. Plus multi-agent oversight and connecting **collection** and **outreach** in one flow. Next we’ll improve recommendation quality and the in-app sending experience. Thank you."

---

이 파일은 `docs/presentation-gamma-prompt.md`에 저장되어 있습니다. Gamma에서 새 프레젠테이션 만들 때 위 한글 프롬프트 블록을 붙여넣고, 슬라이드 순서대로 이미지를 첨부한 뒤 생성하면 됩니다.
