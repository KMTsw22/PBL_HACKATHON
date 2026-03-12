-- DB 리셋 없이 예시 카드만 "1인 1장"으로 수정
-- 같은 user_id를 쓰던 카드들(김민태, 이서연, 박준혁 등)을 카드별로 서로 다른 데모 계정에 붙입니다.
-- 1) 36명의 데모 계정이 없으면 생성 (auth.users, identities, profiles) — 기존 계정은 건드리지 않음
-- 2) user_cards에서 예시 카드 id에 맞는 행만 user_id 갱신
-- Supabase SQL Editor에서 실행하세요.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_cards JSONB := '[
    {"card_id":"b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","name":"김민태"},
    {"card_id":"b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12","name":"이서연"},
    {"card_id":"b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13","name":"박준혁"},
    {"card_id":"b4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14","name":"최지훈"},
    {"card_id":"b5eebc99-9c0b-4ef8-bb6d-6bb9bd380a15","name":"정유나"},
    {"card_id":"b6eebc99-9c0b-4ef8-bb6d-6bb9bd380a16","name":"한소희"},
    {"card_id":"b7eebc99-9c0b-4ef8-bb6d-6bb9bd380a17","name":"강민수"},
    {"card_id":"b8eebc99-9c0b-4ef8-bb6d-6bb9bd380a18","name":"조수빈"},
    {"card_id":"b9eebc99-9c0b-4ef8-bb6d-6bb9bd380a19","name":"윤태영"},
    {"card_id":"baeebc99-9c0b-4ef8-bb6d-6bb9bd380a1a","name":"장예린"},
    {"card_id":"bbeebc99-9c0b-4ef8-bb6d-6bb9bd380a1b","name":"임동현"},
    {"card_id":"bceebc99-9c0b-4ef8-bb6d-6bb9bd380a1c","name":"오세훈"},
    {"card_id":"bdeebc99-9c0b-4ef8-bb6d-6bb9bd380a1d","name":"신지민"},
    {"card_id":"beeebc99-9c0b-4ef8-bb6d-6bb9bd380a1e","name":"권혜진"},
    {"card_id":"bfeebc99-9c0b-4ef8-bb6d-6bb9bd380a1f","name":"송재민"},
    {"card_id":"c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20","name":"배성훈"},
    {"card_id":"c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21","name":"홍다은"},
    {"card_id":"c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a22","name":"문지호"},
    {"card_id":"c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a23","name":"서현우"},
    {"card_id":"c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a24","name":"노서영"},
    {"card_id":"c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a25","name":"양준혁"},
    {"card_id":"c6eebc99-9c0b-4ef8-bb6d-6bb9bd380a26","name":"차미래"},
    {"card_id":"c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a27","name":"백도훈"},
    {"card_id":"c8eebc99-9c0b-4ef8-bb6d-6bb9bd380a28","name":"남지은"},
    {"card_id":"c9eebc99-9c0b-4ef8-bb6d-6bb9bd380a29","name":"김도훈"},
    {"card_id":"caeebc99-9c0b-4ef8-bb6d-6bb9bd380a2a","name":"이수진"},
    {"card_id":"cbeebc99-9c0b-4ef8-bb6d-6bb9bd380a2b","name":"박지훈"},
    {"card_id":"cceebc99-9c0b-4ef8-bb6d-6bb9bd380a2c","name":"최유리"},
    {"card_id":"cdeebc99-9c0b-4ef8-bb6d-6bb9bd380a2d","name":"정현수"},
    {"card_id":"ceeebc99-9c0b-4ef8-bb6d-6bb9bd380a2e","name":"한지민"},
    {"card_id":"cfeebc99-9c0b-4ef8-bb6d-6bb9bd380a2f","name":"강서준"},
    {"card_id":"d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30","name":"조예진"},
    {"card_id":"d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31","name":"윤민호"},
    {"card_id":"d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32","name":"장수아"},
    {"card_id":"d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33","name":"임하늘"},
    {"card_id":"d4eebc99-9c0b-4ef8-bb6d-6bb9bd380a34","name":"오지원"}
  ]'::JSONB;
  rec RECORD;
  v_idx INT;
  v_uid UUID;
  v_email TEXT;
  v_pw TEXT := crypt('demo1234', gen_salt('bf'));
  v_instance_id UUID := '00000000-0000-0000-0000-000000000000';
  v_card_data JSONB;
  v_card_id UUID;
  v_name TEXT;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(v_cards) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_idx := (rec.ord)::int;
    v_uid := ('d500' || lpad(to_hex(v_idx), 4, '0') || '-9c0b-4ef8-bb6d-6bb9bd380a11')::uuid;
    v_email := 'demo-card-' || v_idx || '@example.com';
    v_card_data := rec.elem;
    v_card_id := (v_card_data->>'card_id')::uuid;
    v_name := v_card_data->>'name';

    -- 데모 계정 생성 (이미 있으면 스킵, 내 계정 포함 기존 계정은 그대로)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_uid, v_instance_id, 'authenticated', 'authenticated', v_email, v_pw, NOW(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_name), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (v_uid, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', v_uid::text, NOW(), NOW(), NOW())
    ON CONFLICT (provider, provider_id) DO NOTHING;

    INSERT INTO public.profiles (id, name, photo_url)
    VALUES (v_uid, v_name, 'https://placehold.co/200x200/1a1a2e/eee?text=' || left(v_name, 1))
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- 해당 카드가 있으면 소유자만 이 데모 계정으로 변경 (다른 카드/내 카드는 건드리지 않음)
    UPDATE public.user_cards
    SET user_id = v_uid
    WHERE id = v_card_id;
  END LOOP;
END $$;
