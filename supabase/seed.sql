-- 예시 카드 시드 데이터: 36개의 가짜 카드 = 36명의 서로 다른 사람이 각자 1장씩 소유
-- (김민태 카드 → 계정 1, 이서연 카드 → 계정 2, … 총 36계정·36카드 1:1)
-- 연락하기 시 상대방 이름이 카드 이름으로 표시되며, 사람마다 별도 대화방으로 감
--
-- 실행: supabase db reset / supabase db seed 또는 SQL Editor에서 실행

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  rec RECORD;
  v_uid UUID;
  v_email TEXT;
  v_pw TEXT := crypt('demo1234', gen_salt('bf'));
  v_instance_id UUID := '00000000-0000-0000-0000-000000000000';
  v_card_data JSONB;
  v_cards JSONB := '[
    {"card_id":"b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","name":"김민태","desc":"게임 서버·백엔드 개발. 당구 동호회 운영 경험.","title":"백엔드 개발자","content":"Node.js, PostgreSQL, 실시간 매칭","img":"https://placehold.co/200x200/1a1a2e/eee?text=K"},
    {"card_id":"b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12","name":"이서연","desc":"앱 기획·PM. 스포츠/라이프스타일 서비스 기획 다수.","title":"기획자","content":"기획, 사용자 리서치, 로드맵","img":"https://placehold.co/200x200/16213e/eee?text=L"},
    {"card_id":"b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13","name":"박준혁","desc":"프론트엔드·React. 모바일 퍼스트 UI 개발.","title":"프론트엔드 개발자","content":"React, TypeScript, React Native","img":"https://placehold.co/200x200/0f3460/eee?text=P"},
    {"card_id":"b4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14","name":"최지훈","desc":"UI/UX 디자이너. 게임·앱 UI 디자인.","title":"UI/UX 디자이너","content":"Figma, 프로토타입, 디자인 시스템","img":"https://placehold.co/200x200/533483/eee?text=C"},
    {"card_id":"b5eebc99-9c0b-4ef8-bb6d-6bb9bd380a15","name":"정유나","desc":"마케팅·그로스. 앱 런칭·SNS 캠페인.","title":"마케팅","content":"SNS, 인플루언서, 데이터 분석","img":"https://placehold.co/200x200/e94560/eee?text=J"},
    {"card_id":"b6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16","name":"한소희","desc":"당구 강사·전 대회 입상. 레슨·콘텐츠 기획 관심.","title":"당구 전문가","content":"당구 레슨, 대회 운영, 콘텐츠","img":"https://placehold.co/200x200/1a1a2e/eee?text=H"},
    {"card_id":"b7eebc99-9c0b-4ef8-bb6d-6bb9bd380a17","name":"강민수","desc":"풀스택 개발. 스타트업 MVP 개발 경험.","title":"풀스택 개발자","content":"Next.js, Supabase, AWS","img":"https://placehold.co/200x200/16213e/eee?text=M"},
    {"card_id":"b8eebc99-9c0b-4ef8-bb6d-6bb9bd380a18","name":"조수빈","desc":"기획·운영. 커뮤니티·이벤트 기획.","title":"운영 기획자","content":"커뮤니티, 이벤트, CS","img":"https://placehold.co/200x200/0f3460/eee?text=S"},
    {"card_id":"b9eebc99-9c0b-4ef8-bb6d-6bb9bd380a19","name":"윤태영","desc":"게임 클라이언트. Unity·모바일 게임.","title":"게임 클라이언트 개발자","content":"Unity, C#, 모바일 게임","img":"https://placehold.co/200x200/533483/eee?text=T"},
    {"card_id":"baeebc99-9c0b-4ef8-bb6d-6bb9bd380a1a","name":"장예린","desc":"브랜딩·그래픽. 앱 아이덴티티·일러스트.","title":"그래픽 디자이너","content":"브랜딩, 일러스트, 아이콘","img":"https://placehold.co/200x200/e94560/eee?text=Y"},
    {"card_id":"bbeebc99-9c0b-4ef8-bb6d-6bb9bd380a1b","name":"임동현","desc":"데이터 엔지니어. 실시간 대시보드·분석.","title":"데이터 엔지니어","content":"Python, BigQuery, 실시간 파이프라인","img":"https://placehold.co/200x200/1a1a2e/eee?text=D"},
    {"card_id":"bceebc99-9c0b-4ef8-bb6d-6bb9bd380a1c","name":"오세훈","desc":"백엔드·API. REST·실시간 소켓 설계.","title":"백엔드 개발자","content":"Go, PostgreSQL, Redis, WebSocket","img":"https://placehold.co/200x200/16213e/eee?text=S"},
    {"card_id":"bdeebc99-9c0b-4ef8-bb6d-6bb9bd380a1d","name":"신지민","desc":"프로덕트 디자이너. 사용자 플로우·와이어프레임.","title":"프로덕트 디자이너","content":"사용자 리서치, 플로우, 프로토타입","img":"https://placehold.co/200x200/0f3460/eee?text=J"},
    {"card_id":"beeebc99-9c0b-4ef8-bb6d-6bb9bd380a1e","name":"권혜진","desc":"콘텐츠·에디터. 앱 내 콘텐츠·튜토리얼 기획.","title":"콘텐츠 기획","content":"에디터, 튜토리얼, 카피","img":"https://placehold.co/200x200/533483/eee?text=H"},
    {"card_id":"bfeebc99-9c0b-4ef8-bb6d-6bb9bd380a1f","name":"송재민","desc":"인프라·DevOps. CI/CD·클라우드 배포.","title":"DevOps 엔지니어","content":"AWS, Docker, GitHub Actions","img":"https://placehold.co/200x200/e94560/eee?text=J"},
    {"card_id":"c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20","name":"배성훈","desc":"당구장 운영·이벤트. 지역 당구 커뮤니티.","title":"당구장 운영","content":"이벤트, 대회, 지역 협력","img":"https://placehold.co/200x200/1a1a2e/eee?text=S"},
    {"card_id":"c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21","name":"홍다은","desc":"QA·테스트. 앱 QA·자동화 테스트.","title":"QA 엔지니어","content":"테스트 자동화, 버그 트래킹","img":"https://placehold.co/200x200/16213e/eee?text=D"},
    {"card_id":"c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a22","name":"문지호","desc":"모바일 개발. iOS·Android 네이티브.","title":"모바일 개발자","content":"Swift, Kotlin, React Native","img":"https://placehold.co/200x200/0f3460/eee?text=J"},
    {"card_id":"c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a23","name":"서현우","desc":"기술 PM. 개발·디자인 브릿지, 일정 관리.","title":"기술 PM","content":"일정, 스프린트, 협업","img":"https://placehold.co/200x200/533483/eee?text=H"},
    {"card_id":"c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a24","name":"노서영","desc":"그로스·퍼널. 앱 리텐션·활성화 전략.","title":"그로스 팀","content":"퍼널, 푸시, A/B 테스트","img":"https://placehold.co/200x200/e94560/eee?text=S"},
    {"card_id":"c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a25","name":"양준혁","desc":"풀스택·스타트업. 당구 스코어 앱 사이드 프로젝트.","title":"풀스택 개발자","content":"React, Node, 당구 규칙 로직","img":"https://placehold.co/200x200/1a1a2e/eee?text=J"},
    {"card_id":"c6eebc99-9c0b-4ef8-bb6d-6bb9bd380a26","name":"차미래","desc":"UX 리서치. 사용자 인터뷰·정성 분석.","title":"UX 리서처","content":"인터뷰, 페르소나, 저니맵","img":"https://placehold.co/200x200/16213e/eee?text=M"},
    {"card_id":"c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a27","name":"백도훈","desc":"게임 기획. 캐주얼·스포츠 게임 기획 경험.","title":"게임 기획자","content":"밸런싱, 메타게임, 이벤트","img":"https://placehold.co/200x200/0f3460/eee?text=D"},
    {"card_id":"c8eebc99-9c0b-4ef8-bb6d-6bb9bd380a28","name":"남지은","desc":"커뮤니티 매니저. 당구 동호회·오프라인 모임.","title":"커뮤니티 매니저","content":"디스코드, 오프라인, 이벤트","img":"https://placehold.co/200x200/533483/eee?text=J"},
    {"card_id":"c9eebc99-9c0b-4ef8-bb6d-6bb9bd380a29","name":"김도훈","desc":"월 1회 독서 모임 운영. 인문·자기계발 서적.","title":"독서 모임 리더","content":"독서, 서평, 북클럽","img":"https://placehold.co/200x200/2d5a27/eee?text=D"},
    {"card_id":"caeebc99-9c0b-4ef8-bb6d-6bb9bd380a2a","name":"이수진","desc":"주말 러닝 크루. 마라톤·반마 완주 다수.","title":"러닝 크루","content":"마라톤, 러닝, 건강","img":"https://placehold.co/200x200/5a2d27/eee?text=S"},
    {"card_id":"cbeebc99-9c0b-4ef8-bb6d-6bb9bd380a2b","name":"박지훈","desc":"인디 밴드 기타리스트. 작곡·공연 활동.","title":"밴드 활동","content":"기타, 작곡, 라이브","img":"https://placehold.co/200x200/275a4a/eee?text=J"},
    {"card_id":"cceebc99-9c0b-4ef8-bb6d-6bb9bd380a2c","name":"최유리","desc":"사진 동호회. 스트리트·인물 사진.","title":"사진 동호회","content":"스트리트 포토, 인물, 전시","img":"https://placehold.co/200x200/4a275a/eee?text=Y"},
    {"card_id":"cdeebc99-9c0b-4ef8-bb6d-6bb9bd380a2d","name":"정현수","desc":"여행 동호회. 국내외 배낭여행·맛집 탐방.","title":"여행 동호회","content":"배낭여행, 맛집, 국내외","img":"https://placehold.co/200x200/2d5a27/eee?text=H"},
    {"card_id":"ceeebc99-9c0b-4ef8-bb6d-6bb9bd380a2e","name":"한지민","desc":"요리·홈베이킹 스터디. 레시피 공유·오프라인 모임.","title":"요리 스터디","content":"홈베이킹, 레시피, 파티","img":"https://placehold.co/200x200/5a2d27/eee?text=J"},
    {"card_id":"cfeebc99-9c0b-4ef8-bb6d-6bb9bd380a2f","name":"강서준","desc":"영어 스터디 운영. 토익·회화·원서 읽기.","title":"영어 스터디","content":"토익, 회화, 원서","img":"https://placehold.co/200x200/275a4a/eee?text=S"},
    {"card_id":"d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30","name":"조예진","desc":"코딩 스터디·사이드프로젝트 모임. 주 1회 온라인.","title":"코딩 스터디","content":"React, 사이드프로젝트, 코드리뷰","img":"https://placehold.co/200x200/4a275a/eee?text=Y"},
    {"card_id":"d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31","name":"윤민호","desc":"등산 동호회. 주말 산행·100명산 도전.","title":"등산 동호회","content":"등산, 100명산, 트레킹","img":"https://placehold.co/200x200/2d5a27/eee?text=M"},
    {"card_id":"d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32","name":"장수아","desc":"보드게임 모임. 보드게임 카페 정기 모임.","title":"보드게임 모임","content":"보드게임, 카페, 정기모임","img":"https://placehold.co/200x200/5a2d27/eee?text=S"},
    {"card_id":"d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33","name":"임하늘","desc":"영화·드라마 동호회. 시네마톡·OTT 토론.","title":"영화 동호회","content":"시네마톡, OTT, 리뷰","img":"https://placehold.co/200x200/275a4a/eee?text=H"},
    {"card_id":"d4eebc99-9c0b-4ef8-bb6d-6bb9bd380a34","name":"오지원","desc":"자격증 스터디. 정보처리기사·ADsP·SQL 공부.","title":"자격증 스터디","content":"정보처리기사, ADsP, SQL","img":"https://placehold.co/200x200/4a275a/eee?text=J"}
  ]'::JSONB;
  v_idx INT := 0;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(v_cards) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_idx := (rec.ord)::int;
    v_uid := ('d500' || lpad(to_hex(v_idx), 4, '0') || '-9c0b-4ef8-bb6d-6bb9bd380a11')::uuid;
    v_email := 'demo-card-' || v_idx || '@example.com';
    v_card_data := rec.elem;

    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_uid, v_instance_id, 'authenticated', 'authenticated', v_email, v_pw, NOW(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_card_data->>'name'), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (v_uid, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', v_uid::text, NOW(), NOW(), NOW())
    ON CONFLICT (provider, provider_id) DO NOTHING;

    INSERT INTO public.profiles (id, name, photo_url)
    VALUES (v_uid, v_card_data->>'name', v_card_data->>'img')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, photo_url = COALESCE(EXCLUDED.photo_url, profiles.photo_url);

    INSERT INTO public.user_cards (id, user_id, card_name, description, custom_title, custom_content, image_url)
    VALUES (
      (v_card_data->>'card_id')::uuid,
      v_uid,
      v_card_data->>'name',
      v_card_data->>'desc',
      v_card_data->>'title',
      v_card_data->>'content',
      v_card_data->>'img'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
