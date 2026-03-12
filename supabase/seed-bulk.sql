-- 대량 시드: AI·빅데이터·개발자 + 다양한 취미·직업 (113명 추가)
-- 실행 순서: seed.sql → seed-extended.sql → seed-bulk.sql → (선택) seed-1000.sql (총 241명 또는 1241명)
-- SQL Editor에서 순서대로 실행하세요.

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
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b01","name":"김AI","desc":"AI 엔지니어. LLM·프롬프트 엔지니어링·RAG.","title":"AI 엔지니어","content":"LLM, RAG, 파인튜닝, LangChain","img":"https://placehold.co/200x200/1a1a4a/eee?text=AI"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b02","name":"이머신","desc":"머신러닝 엔지니어. 추천·검색·NLP.","title":"ML 엔지니어","content":"Python, TensorFlow, PyTorch, 추천시스템","img":"https://placehold.co/200x200/2a2a5a/eee?text=ML"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b03","name":"박빅데이터","desc":"빅데이터 엔지니어. 스파크·카프카·DW.","title":"빅데이터 엔지니어","content":"Spark, Kafka, Airflow, Snowflake","img":"https://placehold.co/200x200/3a3a6a/eee?text=BD"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b04","name":"최NLP","desc":"NLP 연구·개발. 형태소·QA·요약.","title":"NLP 엔지니어","content":"NLP, BERT, KoGPT, 요약·QA","img":"https://placehold.co/200x200/4a4a7a/eee?text=NLP"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b05","name":"정데이터","desc":"데이터 사이언티스트. AB테스트·인사이트.","title":"데이터 사이언티스트","content":"Python, SQL, 통계, 시각화","img":"https://placehold.co/200x200/5a5a8a/eee?text=DS"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b06","name":"한ML옵스","desc":"MLOps. 모델 서빙·파이프라인.","title":"MLOps 엔지니어","content":"Kubeflow, MLflow, SageMaker, CI/CD","img":"https://placehold.co/200x200/6a6a9a/eee?text=MLOps"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b07","name":"강커서","desc":"AI 툴·개발자 경험. Cursor·Copilot.","title":"AI 개발자","content":"AI 툴, Cursor, 자동화, 프로토타입","img":"https://placehold.co/200x200/7a7aaa/eee?text=AI Dev"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b08","name":"조연구","desc":"AI 연구원. 논문·발표·산학.","title":"AI 연구원","content":"논문, 학회, 딥러닝, 비전","img":"https://placehold.co/200x200/8a8aba/eee?text=Research"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b09","name":"윤프로덕트AI","desc":"AI 프로덕트. LLM 기반 서비스 기획.","title":"AI PM","content":"LLM 서비스, 프롬프트, UX","img":"https://placehold.co/200x200/9a9aca/eee?text=AI PM"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b0a","name":"장비전","desc":"컴퓨터 비전. 이미지·영상 인식.","title":"CV 엔지니어","content":"이미지 분류, 객체탐지, 영상처리","img":"https://placehold.co/200x200/1a2a4a/eee?text=CV"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b0b","name":"임리추천","desc":"추천 시스템. 개인화·랭킹.","title":"추천 시스템 엔지니어","content":"추천, 랭킹, 개인화, A/B","img":"https://placehold.co/200x200/2a3a5a/eee?text=Rec"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b0c","name":"오인프라데이터","desc":"데이터 인프라. 파이프라인·레이크.","title":"데이터 인프라","content":"Data Lake, ETL, dbt, 실시간","img":"https://placehold.co/200x200/3a4a6a/eee?text=Data Infra"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b0d","name":"신풀스택","desc":"풀스택·AI 연동. 채팅봇·RAG 서비스.","title":"풀스택 · AI 연동","content":"Next.js, FastAPI, OpenAI API, RAG","img":"https://placehold.co/200x200/4a5a7a/eee?text=Full+AI"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b0e","name":"권백엔드","desc":"백엔드 8년. 대용량·실시간.","title":"시니어 백엔드","content":"Java, Kotlin, gRPC, Kafka","img":"https://placehold.co/200x200/5a6a8a/eee?text=BE"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b0f","name":"송iOS","desc":"iOS 네이티브. Swift·UI.","title":"iOS 개발자","content":"Swift, SwiftUI, Combine","img":"https://placehold.co/200x200/6a7a9a/eee?text=iOS"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b10","name":"배안드로이드","desc":"Android. Kotlin·Jetpack.","title":"Android 개발자","content":"Kotlin, Jetpack, Compose","img":"https://placehold.co/200x200/7a8aaa/eee?text=And"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b11","name":"홍게임서버","desc":"게임 서버. 멀티·실시간.","title":"게임 서버 개발자","content":"C++, Go, 실시간, 매칭","img":"https://placehold.co/200x200/8a9aba/eee?text=Game"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b12","name":"문임베디드","desc":"임베디드·IoT. 펌웨어·C.","title":"임베디드 개발자","content":"C, RTOS, IoT, 하드웨어","img":"https://placehold.co/200x200/9aaaca/eee?text=Embed"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b13","name":"서보안","desc":"보안 엔지니어. 앱·인프라.","title":"보안 엔지니어","content":"시큐어코딩, 침투테스트, 인증","img":"https://placehold.co/200x200/1a3a2a/eee?text=Sec"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b14","name":"노블록체인","desc":"블록체인·스마트 컨트랙트.","title":"블록체인 개발자","content":"Solidity, Web3, DeFi","img":"https://placehold.co/200x200/2a4a3a/eee?text=Web3"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b15","name":"양SRE","desc":"SRE·온콜·안정성.","title":"SRE","content":"K8s, 모니터링, 장애대응","img":"https://placehold.co/200x200/3a5a4a/eee?text=SRE"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b16","name":"차프론트","desc":"프론트엔드 5년. React·성능.","title":"시니어 프론트엔드","content":"React, Next, 성능, 접근성","img":"https://placehold.co/200x200/4a6a5a/eee?text=FE"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b17","name":"백기획","desc":"서비스 기획. 앱·웹 기획 6년.","title":"서비스 기획자","content":"기획, 와이어프레임, 메트릭","img":"https://placehold.co/200x200/5a7a6a/eee?text=Plan"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b18","name":"남디자인","desc":"UI/UX 7년. 앱·웹 디자인 시스템.","title":"시니어 UI/UX","content":"Figma, 디자인시스템, 프로토타입","img":"https://placehold.co/200x200/6a8a7a/eee?text=UX"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b19","name":"김당구","desc":"당구 동호회 회장. 주 2회.","title":"당구 동호회","content":"당구, 포켓볼, 친목","img":"https://placehold.co/200x200/2d5a27/eee?text=당구"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b1a","name":"이독서","desc":"월 2회 독서 모임. 소설·에세이.","title":"독서 모임","content":"독서, 북클럽, 서평","img":"https://placehold.co/200x200/3d6a37/eee?text=독서"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b1b","name":"박러닝","desc":"런닝 크루. 주말 10K.","title":"러닝 크루","content":"마라톤, 10K, 건강","img":"https://placehold.co/200x200/4d7a47/eee?text=Run"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b1c","name":"최자전거","desc":"로드바이크·그라벨. 주말 라이딩.","title":"자전거 동호회","content":"로드, 그라벨, 장거리","img":"https://placehold.co/200x200/5d8a57/eee?text=Bike"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b1d","name":"정등산","desc":"100명산 도전. 주말 산행.","title":"등산 동호회","content":"등산, 100명산, 트레킹","img":"https://placehold.co/200x200/6d9a67/eee?text=등산"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b1e","name":"한클라이밍","desc":"클라이밍장 정기. 볼더링·리드.","title":"클라이밍","content":"볼더링, 리드, 체력","img":"https://placehold.co/200x200/7daa77/eee?text=Climb"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b1f","name":"강수영","desc":"수영·트라이애슬론.","title":"수영 동호회","content":"수영, 트라이애슬론","img":"https://placehold.co/200x200/8dba87/eee?text=Swim"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b20","name":"조요리","desc":"홈쿡·맛집 탐방 모임.","title":"요리 모임","content":"홈쿡, 맛집, 레시피","img":"https://placehold.co/200x200/9dca97/eee?text=Cook"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b21","name":"윤베이킹","desc":"홈베이킹·케이크.","title":"베이킹 모임","content":"케이크, 빵, 수제","img":"https://placehold.co/200x200/275a4a/eee?text=Bake"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b22","name":"장커피","desc":"커피 로스팅·핸드드립.","title":"커피 동호회","content":"로스팅, 핸드드립, 원두","img":"https://placehold.co/200x200/376a5a/eee?text=Coffee"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b23","name":"임와인","desc":"와인 시음·스터디.","title":"와인 모임","content":"와인, 레드·화이트, 페어링","img":"https://placehold.co/200x200/477a6a/eee?text=Wine"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b24","name":"오영상","desc":"영상 편집·유튜브.","title":"영상 편집 모임","content":"프리미어, 유튜브, 썸네일","img":"https://placehold.co/200x200/578a7a/eee?text=Video"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b25","name":"신게임","desc":"PC·콘솔 게임 동호회.","title":"게임 동호회","content":"PC, 콘솔, 멀티","img":"https://placehold.co/200x200/679a8a/eee?text=Game"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b26","name":"권스키","desc":"스키·스노보드 겨울 시즌.","title":"스키·스노보드","content":"스키, 스노보드, 겨울","img":"https://placehold.co/200x200/77aa9a/eee?text=Ski"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b27","name":"송반려","desc":"반려동물·강아지 모임.","title":"반려동물 모임","content":"강아지, 산책, 케어","img":"https://placehold.co/200x200/87baaa/eee?text=Pet"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b28","name":"배자원","desc":"자원봉사·사회공헌.","title":"자원봉사 모임","content":"봉사, 사회공헌","img":"https://placehold.co/200x200/97caba/eee?text=Vol"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b29","name":"홍악기","desc":"밴드·악기 연주. 기타·드럼.","title":"밴드·악기","content":"기타, 드럼, 연주","img":"https://placehold.co/200x200/4a275a/eee?text=Band"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b2a","name":"문사진","desc":"풍경·인물 사진. 전시.","title":"사진 동호회","content":"풍경, 인물, 전시","img":"https://placehold.co/200x200/5a376a/eee?text=Photo"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b2b","name":"서여행","desc":"국내외 배낭여행·맛집.","title":"여행 동호회","content":"배낭여행, 맛집, 국내외","img":"https://placehold.co/200x200/6a477a/eee?text=Travel"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b2c","name":"노캠핑","desc":"캠핑·글램핑·오토캠핑.","title":"캠핑 모임","content":"캠핑, 글램핑, 차박","img":"https://placehold.co/200x200/7a578a/eee?text=Camp"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b2d","name":"양볼링","desc":"볼링 주말 리그.","title":"볼링 동호회","content":"볼링, 리그, 스코어","img":"https://placehold.co/200x200/8a679a/eee?text=Bowl"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b2e","name":"차테니스","desc":"테니스 단식·복식.","title":"테니스 동호회","content":"테니스, 주말","img":"https://placehold.co/200x200/9a77aa/eee?text=Tennis"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b2f","name":"백골프","desc":"골프 라운딩·레슨.","title":"골프 동호회","content":"골프, 라운딩, 레슨","img":"https://placehold.co/200x200/aa87ba/eee?text=Golf"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b30","name":"남풋살","desc":"풋살·축구 주말 리그.","title":"풋살 동호회","content":"풋살, 축구, 리그","img":"https://placehold.co/200x200/1a2a1a/eee?text=Futsal"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b31","name":"김요가","desc":"요가·필라테스.","title":"요가·필라테스","content":"요가, 필라테스, 스트레칭","img":"https://placehold.co/200x200/2a3a2a/eee?text=Yoga"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b32","name":"이댄스","desc":"K-pop·재즈댄스.","title":"댄스 동호회","content":"K-pop, 재즈, 공연","img":"https://placehold.co/200x200/3a4a3a/eee?text=Dance"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b33","name":"박브루잉","desc":"홈브루잉·맥주 시음.","title":"브루잉 동호회","content":"맥주, 홈브루잉, 시음","img":"https://placehold.co/200x200/4a5a4a/eee?text=Brew"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b34","name":"최영화","desc":"영화·OTT 시네마톡.","title":"영화 동호회","content":"영화, OTT, 리뷰","img":"https://placehold.co/200x200/5a6a5a/eee?text=Movie"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b35","name":"정보드","desc":"보드게임 카페 정기.","title":"보드게임 모임","content":"보드게임, 카페","img":"https://placehold.co/200x200/6a7a6a/eee?text=Board"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b36","name":"한교수AI","desc":"대학 교수. AI·머신러닝.","title":"대학 교수 · AI","content":"AI, ML, 논문, 대학원","img":"https://placehold.co/200x200/2d4a27/eee?text=Prof"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b37","name":"강교수데이터","desc":"대학 교수. 데이터사이언스.","title":"대학 교수 · 데이터","content":"데이터, 통계, 연구","img":"https://placehold.co/200x200/3d5a37/eee?text=Prof"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b38","name":"조선생코딩","desc":"초등 코딩·SW 교육.","title":"코딩 교육 강사","content":"스크래치, SW교육, 초등","img":"https://placehold.co/200x200/4d6a47/eee?text=Teacher"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b39","name":"윤의사","desc":"가정의학과 전문의.","title":"가정의학과 전문의","content":"건강검진, 생활습관","img":"https://placehold.co/200x200/5d7a57/eee?text=MD"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b3a","name":"장변호사","desc":"지식재산·IT 법률.","title":"변호사 · IP","content":"특허, 저작권, 계약","img":"https://placehold.co/200x200/6d8a67/eee?text=Law"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b3b","name":"임회계","desc":"공인회계사. 스타트업.","title":"공인회계사","content":"회계, 세무, 재무","img":"https://placehold.co/200x200/7d9a77/eee?text=CPA"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b3c","name":"오투자","desc":"VC 파트너. 시드·시리즈.","title":"VC 파트너","content":"투자, DD, 스타트업","img":"https://placehold.co/200x200/8daa87/eee?text=VC"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b3d","name":"신기자","desc":"테크·스타트업 기자.","title":"테크 기자","content":"취재, 인터뷰, 기사","img":"https://placehold.co/200x200/9dba97/eee?text=Press"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b3e","name":"권작가","desc":"IT·기술 에세이 작가.","title":"기술 작가","content":"에세이, 기술, 출판","img":"https://placehold.co/200x200/1a3a2a/eee?text=Writer"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b3f","name":"송강사","desc":"기업 강연·워크숍.","title":"기업 강사","content":"강연, 워크숍, 리더십","img":"https://placehold.co/200x200/2a4a3a/eee?text=Speaker"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b40","name":"배디렉터","desc":"영상·광고 연출.","title":"영상 디렉터","content":"영상, CF, 연출","img":"https://placehold.co/200x200/3a5a4a/eee?text=Director"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b41","name":"홍퍼블","desc":"웹 퍼블리셔. 반응형·접근성.","title":"퍼블리셔","content":"HTML, CSS, SCSS","img":"https://placehold.co/200x200/4a6a5a/eee?text=Pub"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b42","name":"문QA","desc":"QA·테스트 자동화.","title":"QA 엔지니어","content":"테스트, 자동화, CI","img":"https://placehold.co/200x200/5a7a6a/eee?text=QA"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b43","name":"서PM","desc":"기술 PM. 일정·리소스.","title":"기술 PM","content":"스프린트, 일정, 협업","img":"https://placehold.co/200x200/6a8a7a/eee?text=PM"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b44","name":"노그로스","desc":"그로스·리텐션.","title":"그로스 팀","content":"퍼널, A/B, 푸시","img":"https://placehold.co/200x200/7a9a8a/eee?text=Growth"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b45","name":"양컨설","desc":"IT·디지털 전환 컨설턴트.","title":"IT 컨설턴트","content":"전략, 전환, PMO","img":"https://placehold.co/200x200/8aaa9a/eee?text=Consult"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b46","name":"차창업","desc":"스타트업 대표 2차.","title":"스타트업 대표","content":"창업, 제품, 팀","img":"https://placehold.co/200x200/9abaaa/eee?text=CEO"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b47","name":"백인사","desc":"IT 인사·조직.","title":"인사팀 · IT","content":"채용, 조직, 문화","img":"https://placehold.co/200x200/1a2a3a/eee?text=HR"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b48","name":"남영업","desc":"B2B SaaS 영업.","title":"B2B 영업","content":"SaaS, 엔터프라이즈","img":"https://placehold.co/200x200/2a3a4a/eee?text=Sales"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b49","name":"김번역","desc":"기술 문서·영한 번역.","title":"기술 번역가","content":"영한, 기술문서, localization","img":"https://placehold.co/200x200/3a4a5a/eee?text=Trans"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b4a","name":"이캐리어","desc":"커리어 코치·이직.","title":"커리어 코치","content":"이직, 연봉, 자기계발","img":"https://placehold.co/200x200/4a5a6a/eee?text=Career"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b4b","name":"박프리","desc":"프리랜서 디자이너.","title":"프리랜서 디자이너","content":"UI, 브랜딩, 프리랜스","img":"https://placehold.co/200x200/5a6a7a/eee?text=Freelance"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b4c","name":"최운영","desc":"서비스 운영·고객대응.","title":"서비스 운영","content":"운영, CS, 모니터링","img":"https://placehold.co/200x200/6a7a8a/eee?text=Ops"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b4d","name":"정커뮤니티","desc":"커뮤니티 매니저. 온·오프.","title":"커뮤니티 매니저","content":"디스코드, 오프라인, 이벤트","img":"https://placehold.co/200x200/7a8a9a/eee?text=CM"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b4e","name":"한콘텐츠","desc":"콘텐츠 기획·에디터.","title":"콘텐츠 에디터","content":"기획, 카피, 튜토리얼","img":"https://placehold.co/200x200/8a9aaa/eee?text=Content"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b4f","name":"강리서치","desc":"UX 리서처. 정성·정량.","title":"UX 리서처","content":"인터뷰, 페르소나, 저니","img":"https://placehold.co/200x200/9aaaba/eee?text=Research"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b50","name":"조인플루언서","desc":"테크 인플루언서.","title":"테크 인플루언서","content":"유튜브, SNS, 리뷰","img":"https://placehold.co/200x200/2d275a/eee?text=Influencer"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b51","name":"윤백엔드주니어","desc":"백엔드 2년차. Java·Spring.","title":"주니어 백엔드","content":"Java, Spring, MySQL","img":"https://placehold.co/200x200/3d376a/eee?text=BE"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b52","name":"장프론트주니어","desc":"프론트 1년차. React.","title":"주니어 프론트엔드","content":"React, JavaScript","img":"https://placehold.co/200x200/4d477a/eee?text=FE"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b53","name":"임데이터주니어","desc":"데이터 분석 2년.","title":"주니어 데이터 분석","content":"Python, SQL, Pandas","img":"https://placehold.co/200x200/5d578a/eee?text=Data"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b54","name":"오디자인주니어","desc":"UI/UX 1년차.","title":"주니어 디자이너","content":"Figma, 프로토타입","img":"https://placehold.co/200x200/6d679a/eee?text=Design"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b55","name":"신기획주니어","desc":"서비스 기획 1년.","title":"주니어 기획자","content":"기획, 요구사항, 문서","img":"https://placehold.co/200x200/7d77aa/eee?text=Plan"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b56","name":"권풀스택","desc":"풀스택 4년. 스타트업.","title":"풀스택 개발자","content":"Node, React, AWS","img":"https://placehold.co/200x200/8d87ba/eee?text=Full"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b57","name":"송데브옵스","desc":"DevOps 5년. K8s·CI/CD.","title":"DevOps 엔지니어","content":"K8s, Terraform, ArgoCD","img":"https://placehold.co/200x200/9d97ca/eee?text=DevOps"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b58","name":"배게임기획","desc":"게임 기획 6년.","title":"게임 기획자","content":"밸런싱, 메타, 이벤트","img":"https://placehold.co/200x200/1a1a2a/eee?text=GamePlan"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b59","name":"홍마케팅","desc":"디지털 마케팅 4년.","title":"디지털 마케터","content":"GA, 광고, SNS","img":"https://placehold.co/200x200/2a2a3a/eee?text=Marketing"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b5a","name":"문세일즈","desc":"B2B 영업 7년.","title":"B2B 영업","content":"엔터프라이즈, 제안","img":"https://placehold.co/200x200/3a3a4a/eee?text=Sales"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b5b","name":"서피트","desc":"피트니스 트레이너.","title":"피트니스 트레이너","content":"PT, 다이어트, 운동","img":"https://placehold.co/200x200/4a4a5a/eee?text=PT"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b5c","name":"노골프프로","desc":"골프 레슨 프로.","title":"골프 프로","content":"골프, 레슨, 스윙","img":"https://placehold.co/200x200/5a5a6a/eee?text=GolfPro"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b5d","name":"양피아노","desc":"피아노·클래식 동호회.","title":"피아노 동호회","content":"피아노, 클래식, 연주","img":"https://placehold.co/200x200/6a6a7a/eee?text=Piano"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b5e","name":"차캘리","desc":"캘리그라피·손글씨.","title":"캘리그라피","content":"손글씨, 캘리","img":"https://placehold.co/200x200/7a7a8a/eee?text=Calli"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b5f","name":"백드로잉","desc":"수채화·드로잉 모임.","title":"드로잉 모임","content":"수채, 스케치, 전시","img":"https://placehold.co/200x200/8a8a9a/eee?text=Draw"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b60","name":"남바둑","desc":"바둑 동호회.","title":"바둑 동호회","content":"바둑, 대국","img":"https://placehold.co/200x200/9a9aaa/eee?text=Baduk"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b61","name":"김낚시","desc":"낚시·선상·민물.","title":"낚시 동호회","content":"낚시, 선상","img":"https://placehold.co/200x200/1a2a3a/eee?text=Fish"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b62","name":"이스쿼시","desc":"스쿼시 주말.","title":"스쿼시 동호회","content":"스쿼시","img":"https://placehold.co/200x200/2a3a4a/eee?text=Squash"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b63","name":"박영어","desc":"영어 스터디. 토익·회화.","title":"영어 스터디","content":"토익, 회화","img":"https://placehold.co/200x200/3a4a5a/eee?text=Eng"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b64","name":"최코딩스터디","desc":"코딩 스터디. 사이드프로젝트.","title":"코딩 스터디","content":"React, 프로젝트","img":"https://placehold.co/200x200/4a5a6a/eee?text=Code"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b65","name":"정자격증","desc":"자격증 스터디. 정보처리·ADsP.","title":"자격증 스터디","content":"정보처리기사, ADsP","img":"https://placehold.co/200x200/5a6a7a/eee?text=Cert"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b66","name":"한웹툰","desc":"웹툰·만화 창작.","title":"웹툰 작가","content":"웹툰, 스토리","img":"https://placehold.co/200x200/6a7a8a/eee?text=Webtoon"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b67","name":"강팟캐스트","desc":"팟캐스트 진행·인터뷰.","title":"팟캐스트","content":"팟캐스트, 인터뷰","img":"https://placehold.co/200x200/7a8a9a/eee?text=Pod"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b68","name":"조유튜브","desc":"유튜버. 개발·테크.","title":"유튜버","content":"유튜브, 개발, Vlog","img":"https://placehold.co/200x200/8a9aaa/eee?text=YT"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b69","name":"윤이벤트","desc":"이벤트 기획. 웨딩·기업.","title":"이벤트 기획","content":"웨딩, 기업행사","img":"https://placehold.co/200x200/9aaaba/eee?text=Event"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b6a","name":"장부동산","desc":"부동산 중개. 상가·주거.","title":"부동산 중개사","content":"중개, 상가","img":"https://placehold.co/200x200/2d5a27/eee?text=Real"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b6b","name":"임외식","desc":"외식·프랜차이즈.","title":"외식업 창업","content":"프랜차이즈, 창업","img":"https://placehold.co/200x200/3d6a37/eee?text=F&B"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b6c","name":"오사회복지","desc":"사회복지사. 청소년·노인.","title":"사회복지사","content":"복지, 상담","img":"https://placehold.co/200x200/4d7a47/eee?text=Welfare"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b6d","name":"신직업상담","desc":"직업상담사. 청년 취업.","title":"직업상담사","content":"취업, 상담, 진로","img":"https://placehold.co/200x200/5d8a57/eee?text=CareerAdv"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b6e","name":"권헤드헌터","desc":"IT 헤드헌터.","title":"헤드헌터","content":"이직, 채용, 연봉","img":"https://placehold.co/200x200/6d9a67/eee?text=HH"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b6f","name":"송채용","desc":"테크 채용 매니저.","title":"채용 매니저","content":"채용, 면접, 온보딩","img":"https://placehold.co/200x200/7daa77/eee?text=Recruit"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b70","name":"배구직백엔드","desc":"구직 중. 백엔드 5년.","title":"구직 · 백엔드","content":"Java, Spring, Kafka","img":"https://placehold.co/200x200/8dba87/eee?text=Job"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b71","name":"홍구직프론트","desc":"구직 중. 프론트 3년.","title":"구직 · 프론트엔드","content":"React, TypeScript","img":"https://placehold.co/200x200/9dca97/eee?text=Job"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b72","name":"문구직AI","desc":"구직 중. AI·ML 3년.","title":"구직 · AI 엔지니어","content":"Python, PyTorch, NLP","img":"https://placehold.co/200x200/275a4a/eee?text=Job"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b73","name":"서구인스타트업","desc":"스타트업 대표. 개발자 구인.","title":"스타트업 · 구인","content":"풀스택, 백엔드 구인","img":"https://placehold.co/200x200/376a5a/eee?text=Hiring"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b74","name":"노대학원","desc":"대학원 박사. ML 연구.","title":"박사 과정 · ML","content":"ML, 논문, 연구","img":"https://placehold.co/200x200/477a6a/eee?text=PhD"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b75","name":"양포닥","desc":"박사후연구원. AI.","title":"박사후연구원","content":"AI, 논문, 산학","img":"https://placehold.co/200x200/578a7a/eee?text=PostDoc"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b76","name":"차고등정보","desc":"고등학교 정보 교사.","title":"정보 교사","content":"SW교육, 코딩","img":"https://placehold.co/200x200/679a8a/eee?text=Teacher"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b77","name":"백초등교사","desc":"초등학교 교사.","title":"초등 교사","content":"초등, 교육","img":"https://placehold.co/200x200/77aa9a/eee?text=Teacher"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b78","name":"남간호","desc":"간호사. 병원.","title":"간호사","content":"간호, 환자","img":"https://placehold.co/200x200/87baaa/eee?text=Nurse"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b79","name":"김약사","desc":"약사. 약국·상담.","title":"약사","content":"약국, 처방","img":"https://placehold.co/200x200/97caba/eee?text=Pharm"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b7a","name":"이건축","desc":"건축가. 주거·리모델링.","title":"건축가","content":"건축, 인테리어","img":"https://placehold.co/200x200/1a1a3a/eee?text=Arch"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b7b","name":"박금융","desc":"금융권 PB. 자산관리.","title":"금융 PB","content":"자산관리, 연금","img":"https://placehold.co/200x200/2a2a4a/eee?text=PB"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b7c","name":"최세무","desc":"세무사. 법인·개인.","title":"세무사","content":"세무, 법인세","img":"https://placehold.co/200x200/3a3a5a/eee?text=Tax"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b7d","name":"정메이크업","desc":"메이크업 아티스트.","title":"메이크업 아티스트","content":"메이크업, 브라이덜","img":"https://placehold.co/200x200/4a4a6a/eee?text=MUA"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b7e","name":"한플로리스트","desc":"플로리스트. 웨딩·이벤트.","title":"플로리스트","content":"꽃, 웨딩","img":"https://placehold.co/200x200/5a5a7a/eee?text=Flower"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b7f","name":"강사운드","desc":"사운드 디자이너. 게임·영상.","title":"사운드 디자이너","content":"BGM, 효과음","img":"https://placehold.co/200x200/6a6a8a/eee?text=Sound"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b80","name":"조애니","desc":"애니메이션 연출.","title":"애니메이션 연출","content":"연출, 스토리보드","img":"https://placehold.co/200x200/7a7a9a/eee?text=Ani"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b81","name":"윤제품디자인","desc":"인더스트리얼 디자이너.","title":"제품 디자이너","content":"제품, 3D","img":"https://placehold.co/200x200/8a8aaa/eee?text=ID"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b82","name":"장성우","desc":"성우. 더빙·나레이션.","title":"성우","content":"더빙, 나레이션","img":"https://placehold.co/200x200/9a9aba/eee?text=VA"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b83","name":"임블로거","desc":"테크 블로거.","title":"테크 블로거","content":"블로그, IT, 개발","img":"https://placehold.co/200x200/1a2a2a/eee?text=Blog"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b84","name":"오보드제작","desc":"보드게임 제작.","title":"보드게임 제작자","content":"보드게임, 기획","img":"https://placehold.co/200x200/2a3a3a/eee?text=Board"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b85","name":"신모델","desc":"모델·광고.","title":"모델","content":"광고, 패션","img":"https://placehold.co/200x200/3a4a4a/eee?text=Model"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b86","name":"권일본어","desc":"일본어 강사. JPT·회화.","title":"일본어 강사","content":"일본어, JPT","img":"https://placehold.co/200x200/4a5a5a/eee?text=JP"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b87","name":"송중국어","desc":"중국어 통번역.","title":"중국어 통번역","content":"중국어, 통번역","img":"https://placehold.co/200x200/5a6a6a/eee?text=CN"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b88","name":"배유치원","desc":"유치원 교사.","title":"유치원 교사","content":"유치원, 놀이","img":"https://placehold.co/200x200/6a7a7a/eee?text=Kinder"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b89","name":"홍심리","desc":"대학 교수. 심리학.","title":"대학 교수 · 심리","content":"심리학, 상담","img":"https://placehold.co/200x200/7a8a8a/eee?text=Psych"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b8a","name":"문영양","desc":"영양사. 급식·상담.","title":"영양사","content":"급식, 다이어트","img":"https://placehold.co/200x200/8a9a9a/eee?text=Nutri"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b8b","name":"서치과","desc":"치과의사. 임플란트·교정.","title":"치과의사","content":"임플란트, 교정","img":"https://placehold.co/200x200/9aaaaa/eee?text=Dent"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b8c","name":"노한의","desc":"한의사. 침·약침.","title":"한의사","content":"침, 약침, 한방","img":"https://placehold.co/200x200/1a1a2a/eee?text=KM"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b8d","name":"양연구원","desc":"선임 연구원. HCI·R&D.","title":"선임 연구원","content":"HCI, 논문, R&D","img":"https://placehold.co/200x200/2a2a3a/eee?text=Researcher"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b8e","name":"차번역","desc":"번역가. 영한·기술문서.","title":"번역가","content":"영한, 기술문서","img":"https://placehold.co/200x200/3a3a4a/eee?text=Trans"},
    {"card_id":"50eebc99-9c0b-4ef8-bb6d-6bb9bd380b8f","name":"백사진작가","desc":"사진작가. 웨딩·인물.","title":"사진작가","content":"웨딩, 인물, 전시","img":"https://placehold.co/200x200/4a4a5a/eee?text=Photo"}
  ]'::JSONB;
  v_idx INT := 0;
  v_ord_offset INT := 128;
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
