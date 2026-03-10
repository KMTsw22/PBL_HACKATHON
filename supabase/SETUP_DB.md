# Supabase DB 설정

## 테이블 역할

| 테이블 | 역할 |
|--------|------|
| **profiles** | 사용자 프로필만 (이름, 사진, 전공 등) |
| **user_cards** | 카드 정보 (user_id로 해당 사용자 카드 연결) |

로그인 시 `profiles`와 `user_cards`를 각각 조회합니다.

---

## 1. profiles 테이블 (먼저 실행)

1. [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. `supabase/migrations/000_profiles.sql` 내용 복사 후 Run

---

## 2. user_cards 테이블

카드 저장용. profiles 실행 후 아래 SQL 실행.

```sql
-- user_cards 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_name TEXT,
  description TEXT,
  custom_title TEXT,
  custom_content TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Users can update own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON public.user_cards;

CREATE POLICY "Users can view own cards"
  ON public.user_cards FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards"
  ON public.user_cards FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards"
  ON public.user_cards FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards"
  ON public.user_cards FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON public.user_cards(user_id);
```

### 방법 2: 이미 테이블이 있는 경우

테이블은 있는데 RLS 정책만 없다면, 위 SQL에서 `CREATE TABLE` 부분을 제외하고 정책만 실행하세요.

---

## 3. Storage 정책 (사진 업로드용)

사진 업로드 시 400 에러가 나면 `003_storage_avatars_policy.sql` 실행

---

## 4. user_cards 연락처 컬럼 (Links & Portfolio, Contact Info)

`004_user_cards_contact.sql` 실행 → portfolio_url, email, kakao_id, phone 컬럼 추가

---

## 5. profiles 정리 (기존 테이블에 카드 컬럼이 있는 경우)

profiles에 카드 관련 컬럼이 있다면 `002_fix_profiles_structure.sql` 실행

---

### 확인

- **Table Editor** → `profiles`, `user_cards` 테이블 확인
- 카카오/Google 로그인 시 **profiles**에서 프로필, **user_cards**에서 카드 각각 조회

---

## 6. Find용 정책 + collected_cards 테이블

- `005_user_cards_discover.sql` → Find에서 모든 유저 카드 조회 가능
- `006_collected_cards.sql` → Find에서 수집한 카드 저장용 테이블
- `007_collected_cards_owner_view.sql` → 카드 소유자가 자신의 카드 수집 통계 조회 가능
- `008_collected_card_ratings.sql` → 수집 시 주제별 점수·메모 저장 (Ask 인재 검색용)
- `009_collected_cards_update.sql` → collected_cards private_notes 수정을 위한 UPDATE 정책

---

## 7. Google 로그인 설정 (선택)

1. [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → Providers → **Google** 활성화
2. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
3. OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)
4. 승인된 리디렉션 URI에 추가: `https://<프로젝트ID>.supabase.co/auth/v1/callback`
5. Client ID, Client Secret을 Supabase Google 설정에 입력

---

## 8. Edge Function: analyze-card-rating (Rate & Collect AI 분석)

Rate & Collect 시 AI가 카드를 분석해 주제별 점수를 제안합니다.

```bash
supabase functions deploy analyze-card-rating
```

- `OPENAI_API_KEY` 시크릿 필요 (generate-card와 동일)

## 9. Edge Function: recommend-from-collected (Ask 인재 추천)

Ask에서 "프론트엔드 개발자가 필요해" 등 요청 시 수집한 명함 중 AI가 추천합니다.

```bash
supabase functions deploy recommend-from-collected
```

## 10. Edge Function: ask-agent (Ask AI Agent 오케스트레이터)

Ask를 AI Agent로 동작시킵니다. 상위 에이전트가 사용자 의도를 파악해 하위 에이전트(인재 추천, 기획·아이디어, 기술 스택)를 호출하고 결과를 합쳐 답합니다.

```bash
supabase functions deploy ask-agent
```

- `OPENAI_API_KEY` 시크릿 필요
