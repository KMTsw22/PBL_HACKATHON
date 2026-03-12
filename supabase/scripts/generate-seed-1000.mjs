#!/usr/bin/env node
/**
 * 1000장 시드 카드 SQL 생성
 * 언어·프레임워크·전공·직무 등 매우 다양하게 조합
 * 실행: node supabase/scripts/generate-seed-1000.mjs
 */

import fs from 'fs'

const LANGUAGES = [
  '한국어', 'English', '日本語', '中文', 'Español', 'Français', 'Deutsch', 'Русский', 'العربية', 'Português',
  'Italiano', 'Tiếng Việt', 'ไทย', 'Bahasa Indonesia', 'हिन्दी', 'Türkçe', 'Polski', 'Nederlands', '한국어·영어',
  'English·Japanese', '中文·English', 'Spanish·English', 'French·Korean', '독일어·영어', '러시아어', '베트남어',
  '스웨덴어', '노르웨이어', '덴마크어', '핀란드어', '그리스어', '히브리어', '페르시아어', '말레이어', '태갈로그어',
  '스와힐리어', '라틴어', '고대그리스어', '몽골어', '우크라이나어', '체코어', '루마니아어', '헝가리어', '캄보디아어', '미얀마어',
]

const FRAMEWORKS_AND_TECHS = [
  'React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Remix', 'Solid.js', 'Qwik',
  'Express', 'NestJS', 'Fastify', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Rails', 'Laravel', 'ASP.NET Core',
  'Node.js', 'Go', 'Rust', 'Kotlin', 'Swift', 'Flutter', 'React Native', 'Vue Native', 'Electron', 'Tauri',
  'TensorFlow', 'PyTorch', 'scikit-learn', 'Hugging Face', 'LangChain', 'LlamaIndex', 'OpenAI API',
  'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'RabbitMQ', 'GraphQL', 'gRPC',
  'Docker', 'Kubernetes', 'Terraform', 'AWS', 'GCP', 'Azure', 'Vercel', 'Supabase', 'Firebase',
  'Figma', 'Tailwind', 'Sass', 'Webpack', 'Vite', 'Jest', 'Cypress', 'Playwright',
  'Unity', 'Unreal', 'Godot', 'Three.js', 'WebGL', 'OpenCV', 'Pandas', 'NumPy', 'dbt', 'Airflow', 'Spark',
  'Solidity', 'Ethers.js', 'Web3.js', 'Hardhat', 'Truffle', 'Qt', 'GTK', 'SwiftUI', 'Jetpack Compose',
]

const MAJORS = [
  '컴퓨터공학', '소프트웨어학', '전자공학', '전기공학', '기계공학', '화학공학', '산업공학', '신소재공학', '항공우주공학', '원자력공학',
  '경영학', '경제학', '국제통상학', '회계학', '금융학', '마케팅', '빅데이터경영', '심리학', '사회학', '정치외교학', '행정학', '미디어커뮤니케이션',
  '법학', '의학', '간호학', '약학', '수의학', '치의학', '한의학', '보건행정', '물리치료', '작업치료', '영양학',
  '건축학', '건축공학', '도시공학', '실내건축', '디자인학', '시각디자인', '산업디자인', '패션디자인', '영상디자인', '게임디자인',
  '국어국문학', '영어영문학', '일본어일문학', '중어중문학', '독어독문학', '불어불문학', '사학', '철학', '미술사', '고고학',
  '수학', '통계학', '물리학', '화학', '생명과학', '지구과학', '환경과학', '해양학', '천문학', '지리학',
  '교육학', '유아교육', '초등교육', '특수교육', '체육교육', '음악교육', '미술교육', '영어교육', '국어교육', '수학교육',
  '음악', '성악', '작곡', '피아노', '미술', '회화', '조소', '무용', '연극', '영화',
  '경영정보', '전자상거래', '호텔경영', '관광경영', '외식경영', '부동산학', '법무행정', '사회복지', '아동가족', '의류학',
  '식품공학', '생명공학', '나노공학', '로봇공학', '자동차공학', '조선해양공학', '환경공학', '에너지공학', '바이오메디컬',
  '글로벌리더십', '국제학', '동양학', '서양학', '문헌정보', '언론정보', '광고홍보', '경제금융', '공공인재', '스포츠과학',
  '인공지능', '데이터과학', '사이버보안', '게임공학', '만화애니메이션', '영화영상', '실용음악', '무대미술', '문화예술경영',
]

const JOB_TITLES = [
  '개발자', '엔지니어', '연구원', '기획자', '디자이너', 'PM', '마케터', '데이터분석가', '컨설턴트', '강사', '교수', '선생님',
  '시니어 개발자', '주니어 개발자', '풀스택', '백엔드', '프론트엔드', 'ML 엔지니어', 'DevOps', 'QA', '프로덕트 매니저',
  '창업자', '대표', '팀장', '리드', '인턴', '박사과정', '박사후연구원', '포닥', '교수', '부교수', '조교수', '강사',
  '의사', '간호사', '약사', '변호사', '회계사', '세무사', '건축가', '기자', '작가', '번역가', '통역가',
]

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍', '문', '양', '손', '배', '백', '허', '남', '심', '노', '고', '곽', '사', '차', '주', '우', '진', '라', '마', '뢰', '구', '소', '석', '설', '길', '전', '피', '반', '방', '표', '팽', '봉', '부', '태', '모', '묵', '미', '범', '빈', '갈', '감', '계', '경', '공', '과', '교', '국', '군', '궁', '궉', '근', '금', '기', '길', '나', '단', '담', '당', '대', '도', '독', '동', '두', '란', '려', '로', '뢰', '리', '린', '마', '만', '매', '맹', '명', '몽', '무', '문', '미', '민', '반', '방', '배', '번', '벽', '변', '보', '복', '봉', '부', '비', '사', '삼', '상', '서', '석', '선', '설', '성', '소', '순', '승', '시', '신', '심', '아', '안', '애', '야', '양', '어', '엄', '여', '연', '염', '예', '오', '옥', '온', '와', '요', '용', '우', '운', '원', '위', '유', '윤', '은', '음', '이', '인', '임', '자', '장', '전', '정', '제', '조', '종', '주', '준', '지', '진', '차', '창', '채', '천', '초', '최', '추', '탁', '탄', '태', '편', '평', '포', '표', '풍', '피', '하', '한', '함', '해', '허', '현', '형', '호', '홍', '화', '황', '황보', '홍', '흥']

const GIVEN_NAMES = ['민준', '서준', '도윤', '예준', '시우', '하준', '지호', '지후', '준서', '준우', '도현', '건우', '현우', '지훈', '우진', '선우', '유준', '정우', '승우', '승현', '시현', '지원', '민재', '유찬', '지민', '수현', '재윤', '시윤', '민서', '수빈', '하은', '지우', '서연', '서윤', '지유', '민서', '채원', '지아', '수아', '소율', '예은', '지안', '수민', '유나', '가은', '다은', '예린', '시은', '수진', '지현', '소연', '예나', '유진', '민지', '하린', '서현', '지은', '예진', '채은', '수연', '다인', '서영', '예원', '지한', '소민', '유리', '민아', '하윤', '서우', '지율', '수현', '예서', '태윤', '현서', '도훈', '재민', '성민', '준혁', '영호', '상훈', '진호', '동현', '성준', '민호', '재현', '태현', '준영', '성현', '지환', '민성', '현준', '승민', '태민', '지원', '성훈', '준호', '영준', '시훈', '동욱', '재훈', '상우', '진우', '태영', '민규', '현수', '준수', '성우', '영우', '지웅', '동훈', '재영', '상민', '진영', '태우', '민우', '현민', '준민', '성재', '지성', '영민', '시준', '동준', '재우', '상현', '진수', '태준', '민혁', '현진', '준현', '성진', '지훈', '영진', '시원', '동윤', '재준', '상진', '진현', '태진', '민수', '현성', '준성', '성수', '지현', '영수', '시현', '동원', '재성', '상수', '진성', '태성']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, arr.length))
}

function escapeJson(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
}

const ORD_OFFSET = 241
const NUM_CARDS = 1000

const cards = []
for (let i = 0; i < NUM_CARDS; i++) {
  const name = pick(SURNAMES) + pick(GIVEN_NAMES)
  const lang = pick(LANGUAGES)
  const langs = pickN(LANGUAGES, 1 + Math.floor(Math.random() * 2)).join(', ')
  const fws = pickN(FRAMEWORKS_AND_TECHS, 2 + Math.floor(Math.random() * 3)).join(', ')
  const major = pick(MAJORS)
  const major2 = Math.random() > 0.6 ? pick(MAJORS) : null
  const job = pick(JOB_TITLES)
  const desc = `${major}${major2 ? `·${major2}` : ''} 전공. ${lang} 사용. ${job}로 활동.`
  const title = `${job} · ${major}`
  const content = [langs, fws, major].filter(Boolean).join(', ')
  const cardId = `70eebc99-9c0b-4ef8-bb6d-6bb9bd38${(i + 1).toString(16).padStart(4, '0')}`
  const hue = (i * 137) % 360
  const img = `https://placehold.co/200x200/hsl(${hue},40%,35%)/eee?text=${encodeURIComponent(name.slice(0, 1))}`
  cards.push({
    card_id: cardId,
    name,
    desc: escapeJson(desc),
    title: escapeJson(title),
    content: escapeJson(content),
    img,
  })
}

const jsonLines = cards.map((c) => {
  const name = escapeJson(c.name)
  return `    {"card_id":"${c.card_id}","name":"${name}","desc":"${c.desc}","title":"${c.title}","content":"${c.content}","img":"${c.img}"}`
})
const jsonArray = '[\n' + jsonLines.join(',\n') + '\n  ]'

const sql = `-- 시드 1000장: 언어·프레임워크·전공·직무 다양 (자동 생성)
-- 실행 순서: seed.sql → seed-extended.sql → seed-bulk.sql → seed-1000.sql (총 36+92+113+1000=1241명)
-- 생성: node supabase/scripts/generate-seed-1000.mjs

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  rec RECORD;
  v_uid UUID;
  v_email TEXT;
  v_pw TEXT := crypt('demo1234', gen_salt('bf'));
  v_instance_id UUID := '00000000-0000-0000-0000-000000000000';
  v_card_data JSONB;
  v_cards JSONB := $json$
${jsonArray}
$json$::jsonb;
  v_idx INT := 0;
  v_ord_offset INT := ${ORD_OFFSET};
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(v_cards) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_idx := v_ord_offset + (rec.ord)::int;
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
`

fs.writeFileSync(new URL('../seed-1000.sql', import.meta.url), sql, 'utf8')
console.log(`Generated supabase/seed-1000.sql with ${NUM_CARDS} cards. Run after seed.sql, seed-extended.sql, seed-bulk.sql.`)
