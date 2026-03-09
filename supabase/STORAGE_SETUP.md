# Storage 400 에러 해결

## "Bucket not found" → avatars 버킷 생성

### 방법 1: SQL로 생성 (권장)
Supabase Dashboard → **SQL Editor** → `003_storage_avatars_policy.sql` 전체 실행

### 방법 2: Dashboard에서 수동 생성
Storage → **New bucket** 클릭
- Name: `avatars`
- **Public bucket** 체크
- Create bucket

### 2. Policies (정책) 추가
Storage → avatars → **Policies** 탭

**INSERT 정책 추가:**
- New Policy → For full customization
- Policy name: `Allow authenticated uploads`
- Allowed operation: **INSERT**
- Target roles: `authenticated`
- WITH CHECK expression:
```sql
bucket_id = 'avatars' AND auth.role() = 'authenticated'
```

**SELECT 정책 추가:**
- New Policy → For full customization
- Policy name: `Public read`
- Allowed operation: **SELECT**
- USING expression:
```sql
bucket_id = 'avatars'
```

### 3. 버킷 설정 확인
avatars → **Configuration**:
- **Restrict file uploads** 끄기 (또는 image/* 허용)
- **File size limit** 5MB 이상 권장
