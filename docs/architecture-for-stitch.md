# Tech Stack & Architecture — Stitch AI용 풀어쓴 설명

아래 내용을 Stitch AI에 그대로 붙여 넣어서 다이어그램/슬라이드 생성에 사용하면 됩니다.

---

## 제목
**Tech Stack & Architecture** (기술 스택 및 아키텍처)

---

## 전체 구조 (3계층)

아키텍처는 **바깥에서 안쪽으로** 세 개의 계층으로 이루어져 있다.

1. **가장 바깥 계층: Frontend (프론트엔드)**  
2. **중간 계층: Backend & DB (백엔드·DB)**  
3. **가장 안쪽 계층: AI Layer (AI 계층)**  

시각적으로는 **동심원(concentric circles)** 으로 표현하면 된다.  
- 가장 바깥 원 = Frontend  
- 가운데 원 = Backend (Supabase)  
- 가장 안쪽 원 = AI Layer  

---

## 1. Frontend (프론트엔드)

- **역할**: 사용자가 보는 화면과 상호작용. 웹·모바일 앱 UI.
- **기술 스택**:
  - **React** — UI 라이브러리
  - **Vite** — 빌드·개발 서버
  - **TypeScript** — 타입이 있는 JavaScript
  - **Tailwind** — CSS 유틸리티(스타일링)
  - **Capacitor** — 웹 앱을 iOS/Android 네이티브 앱으로 감싸는 크로스플랫폼

- **한 줄 요약**: React · Vite · TypeScript · Tailwind · Capacitor

---

## 2. Backend & DB (백엔드·DB)

- **역할**: 인증, 데이터 저장, 서버 로직. Supabase 한 플랫폼에서 제공.
- **기술 스택**:
  - **Supabase**
    - **Auth** — 로그인·회원가입·세션
    - **Database** — PostgreSQL 기반 DB (명함, 수집 목록, 대화 등)
    - **Edge Functions** — 서버리스 함수(예: Ask 에이전트 API가 여기서 실행)

- **한 줄 요약**: Supabase — Auth, Database, Edge Functions

---

## 3. AI Layer (AI 계층)

- **역할**: 사용자 요청을 분석하고, 수집 명함에서 인원을 추천하고, 연락 메시지 초안을 만드는 등 모든 AI 판단·생성. **멀티 에이전트 오케스트레이션**이 핵심.
- **구성**:
  - **모델**: **GPT-4o-mini**와 **GPT-3.5**를 **동시에(parallel)** 사용.
  - **방식**: 같은 작업(예: 요청 분석, 인원 선정, 메시지 초안)에 **한 모델이 아니라 서로 다른 모델**을 써서 **서로 다른 아이디어·관점**을 뽑고, **총괄 에이전트(orchestrator)** 가 두 결과를 **종합·타협·문제 해결**한 뒤 다음 단계로 넘긴다.
  - **에이전트 예시**: 총괄(Orchestrator), Data Miner(요청 분석), Suggest Idea / Suggest Tech(기획·기술), Context Matcher(인원 선정), Message Architect(메시지 초안), Suggest Contact(연락 팁·발송).

- **한 줄 요약**: OpenAI multi-agent — GPT-4o-mini + GPT-3.5 running in parallel (같은 단계에서 다른 모델로 다른 아이디어 도출 후 종합·타협)

---

## Stitch AI에게 전달할 때 추가로 넣을 문구 (선택)

- “동심원 3개로 그려줘. 바깥부터 Frontend → Backend (Supabase) → AI Layer.”
- “오른쪽에는 Frontend / Backend & DB / AI Layer 각각을 박스로 쌓고, 위에 적힌 한 줄 요약을 박스 안에 넣어줘.”
- “AI Layer는 ‘Multi-agent orchestration with GPT-4o-mini and GPT-3.5’ 또는 ‘GPT-4o-mini + GPT-3.5 running in parallel’ 로 강조해 줘.”

---

이 파일을 Stitch AI에 복사해 넣으면, 텍스트만으로도 위 아키텍처 다이어그램을 재구성할 수 있습니다.
