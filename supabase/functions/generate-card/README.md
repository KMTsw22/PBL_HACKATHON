# generate-card Edge Function

AI로 카드 이미지를 생성하는 Supabase Edge Function입니다.

## 배포

```bash
# 1. Supabase CLI 로그인 (최초 1회)
npx supabase login

# 2. 프로젝트 연결
npx supabase link --project-ref <프로젝트ID>

# 3. OpenAI API 키 설정
npx supabase secrets set OPENAI_API_KEY=sk-xxxx

# 4. 배포
npx supabase functions deploy generate-card
```

## 400 에러 발생 시

1. **OPENAI_API_KEY 확인**: Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. **OpenAI 크레딧**: [platform.openai.com](https://platform.openai.com)에서 결제 수단·크레딧 확인
3. **프롬프트 정책**: OpenAI가 거부하는 내용이 있으면 400 발생 → prompt 단순화

## JWT 인증

기본적으로 Edge Function은 JWT 검증을 합니다. 카카오 로그인 토큰이 정상이면 통과합니다.
문제 시: `npx supabase functions deploy generate-card --no-verify-jwt` (개발용)
