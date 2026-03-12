-- 예시 카드 확장 시드: 구인·구직, 교수·선생님, 다양한 직업, 취미 등 92명 추가
-- 기존 seed.sql 실행 후 이 파일을 SQL Editor에서 실행하세요. (총 36+92=128명)
-- 더 많은 인원이 필요하면 이어서 seed-bulk.sql 실행 (113명 추가, 총 241명)

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
    {"card_id":"e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a35","name":"김재영","desc":"IT 채용 10년. 개발자·기획자 채용 다수.","title":"채용 매니저","content":"테크 채용, 면접, 온보딩","img":"https://placehold.co/200x200/1a3a1a/eee?text=K"},
    {"card_id":"e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a36","name":"박미래","desc":"헤드헌터. 스타트업·대기업 이직 컨설팅.","title":"헤드헌터","content":"이직, 연봉 협상, 커리어","img":"https://placehold.co/200x200/2a4a2a/eee?text=P"},
    {"card_id":"e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a37","name":"이준호","desc":"구직 중인 시니어 백엔드. 8년차.","title":"구직 중 · 백엔드","content":"Java, Spring, Kafka","img":"https://placehold.co/200x200/3a5a3a/eee?text=L"},
    {"card_id":"e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a38","name":"최서연","desc":"주니어 프론트엔드 구직 중. 신입.","title":"구직 중 · 프론트엔드","content":"React, TypeScript","img":"https://placehold.co/200x200/4a6a4a/eee?text=C"},
    {"card_id":"e5eebc99-9c0b-4ef8-bb6d-6bb9bd380a39","name":"정민수","desc":"스타트업 대표. 백엔드·기획 인력 구인 중.","title":"스타트업 대표 · 구인","content":"풀타임·아웃소싱 구인","img":"https://placehold.co/200x200/5a7a5a/eee?text=J"},
    {"card_id":"e6eebc99-9c0b-4ef8-bb6d-6bb9bd380a3a","name":"한지우","desc":"인사팀 과장. R&D 채용 담당.","title":"인사팀 · 채용","content":"채용, 복지, 조직 문화","img":"https://placehold.co/200x200/6a8a6a/eee?text=H"},
    {"card_id":"e7eebc99-9c0b-4ef8-bb6d-6bb9bd380a3b","name":"강수아","desc":"PM 5년차. 이직 준비 중.","title":"구직 중 · PM","content":"기획, 스프린트, 협업","img":"https://placehold.co/200x200/7a9a7a/eee?text=S"},
    {"card_id":"e8eebc99-9c0b-4ef8-bb6d-6bb9bd380a3c","name":"조현지","desc":"디자이너 구직. UI/UX 3년.","title":"구직 중 · UI/UX","content":"Figma, 프로토타입","img":"https://placehold.co/200x200/8aaa8a/eee?text=H"},
    {"card_id":"e9eebc99-9c0b-4ef8-bb6d-6bb9bd380a3d","name":"윤도훈","desc":"컴퓨터공학과 교수. AI·머신러닝 연구.","title":"대학 교수 · 컴공","content":"AI, 논문, 대학원","img":"https://placehold.co/200x200/2d5a27/eee?text=D"},
    {"card_id":"eaeebc99-9c0b-4ef8-bb6d-6bb9bd380a3e","name":"장서현","desc":"경영학과 부교수. 스타트업·혁신.","title":"대학 교수 · 경영","content":"경영전략, 스타트업","img":"https://placehold.co/200x200/3d6a37/eee?text=S"},
    {"card_id":"ebeebc99-9c0b-4ef8-bb6d-6bb9bd380a3f","name":"임지훈","desc":"디자인학과 교수. 인터랙션 디자인.","title":"대학 교수 · 디자인","content":"인터랙션, 서비스디자인","img":"https://placehold.co/200x200/4d7a47/eee?text=J"},
    {"card_id":"eceebc99-9c0b-4ef8-bb6d-6bb9bd380a40","name":"오민지","desc":"고등학교 수학 교사. 15년차.","title":"고등학교 수학 교사","content":"수학, 수능, 진로","img":"https://placehold.co/200x200/5d8a57/eee?text=M"},
    {"card_id":"edeebc99-9c0b-4ef8-bb6d-6bb9bd380a41","name":"신예진","desc":"영어 학원 강사. 토익·회화.","title":"영어 강사","content":"토익, 회화, 비즈니스 영어","img":"https://placehold.co/200x200/6d9a67/eee?text=Y"},
    {"card_id":"eeeebc99-9c0b-4ef8-bb6d-6bb9bd380a42","name":"권재민","desc":"코딩 부트캠프 멘토. 웹 개발.","title":"코딩 멘토","content":"JavaScript, React, 취업","img":"https://placehold.co/200x200/7daa77/eee?text=J"},
    {"card_id":"efeebc99-9c0b-4ef8-bb6d-6bb9bd380a43","name":"송하늘","desc":"중학교 과학 선생님. 실험·탐구.","title":"중학교 과학 교사","content":"과학, 실험, 자유탐구","img":"https://placehold.co/200x200/8dba87/eee?text=H"},
    {"card_id":"f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44","name":"배지원","desc":"대학원 박사 과정. NLP 연구.","title":"박사 과정 · NLP","content":"NLP, 논문, 연구","img":"https://placehold.co/200x200/1a2a4a/eee?text=J"},
    {"card_id":"f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a45","name":"홍민재","desc":"내과 전문의. 건강 검진·상담.","title":"내과 전문의","content":"건강검진, 만성질환","img":"https://placehold.co/200x200/2a3a5a/eee?text=M"},
    {"card_id":"f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a46","name":"문소율","desc":"변호사. IT·스타트업 법률 자문.","title":"변호사","content":"계약, IP, 법률 자문","img":"https://placehold.co/200x200/3a4a6a/eee?text=S"},
    {"card_id":"f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a47","name":"서준혁","desc":"건축가. 주거·리모델링.","title":"건축가","content":"주거, 리모델링, 인테리어","img":"https://placehold.co/200x200/4a5a7a/eee?text=J"},
    {"card_id":"f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a48","name":"노다은","desc":"공인회계사. 스타트업 회계·세무.","title":"공인회계사","content":"회계, 세무, 재무","img":"https://placehold.co/200x200/5a6a8a/eee?text=D"},
    {"card_id":"f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a49","name":"양서준","desc":"세무사. 법인·개인 세무.","title":"세무사","content":"법인세, 종합소득세","img":"https://placehold.co/200x200/6a7a9a/eee?text=S"},
    {"card_id":"f6eebc99-9c0b-4ef8-bb6d-6bb9bd380a4a","name":"차유나","desc":"금융권 PB. 자산관리·연금.","title":"금융권 PB","content":"자산관리, 연금, 펀드","img":"https://placehold.co/200x200/7a8aaa/eee?text=Y"},
    {"card_id":"f7eebc99-9c0b-4ef8-bb6d-6bb9bd380a4b","name":"백지훈","desc":"영업 이사. B2B·제휴.","title":"영업 이사","content":"B2B, 제휴, 계약","img":"https://placehold.co/200x200/8a9aba/eee?text=J"},
    {"card_id":"f8eebc99-9c0b-4ef8-bb6d-6bb9bd380a4c","name":"남수빈","desc":"IT 기자. 스타트업·테크 뉴스.","title":"IT 기자","content":"기사, 인터뷰, 취재","img":"https://placehold.co/200x200/2a2a4a/eee?text=S"},
    {"card_id":"f9eebc99-9c0b-4ef8-bb6d-6bb9bd380a4d","name":"김예린","desc":"연구원. HCI·사용자 연구.","title":"선임 연구원","content":"HCI, 논문, R&D","img":"https://placehold.co/200x200/3a3a5a/eee?text=Y"},
    {"card_id":"faeebc99-9c0b-4ef8-bb6d-6bb9bd380a4e","name":"이도윤","desc":"포닥. 바이오 인포매틱스.","title":"박사후연구원","content":"바이오, 데이터, 논문","img":"https://placehold.co/200x200/4a4a6a/eee?text=D"},
    {"card_id":"fbeebc99-9c0b-4ef8-bb6d-6bb9bd380a4f","name":"박시우","desc":"에세이·소설 작가. 출간 3권.","title":"작가","content":"에세이, 소설, 글쓰기","img":"https://placehold.co/200x200/5a5a7a/eee?text=S"},
    {"card_id":"fceebc99-9c0b-4ef8-bb6d-6bb9bd380a50","name":"최민서","desc":"영한 번역가. IT·문학.","title":"번역가","content":"영한, 기술문서, 출판","img":"https://placehold.co/200x200/6a6a8a/eee?text=M"},
    {"card_id":"fdeebc99-9c0b-4ef8-bb6d-6bb9bd380a51","name":"정하은","desc":"클라이밍 5년. 인스트럭터.","title":"클라이밍 인스트럭터","content":"클라이밍, 볼더링, 체력","img":"https://placehold.co/200x200/5a2d27/eee?text=H"},
    {"card_id":"feeebc99-9c0b-4ef8-bb6d-6bb9bd380a52","name":"한준서","desc":"수영 동호회. 마스터즈 대회.","title":"수영 동호회","content":"수영, 마스터즈, 트라이애슬론","img":"https://placehold.co/200x200/6a3d37/eee?text=J"},
    {"card_id":"ffeebc99-9c0b-4ef8-bb6d-6bb9bd380a53","name":"강민지","desc":"로드바이크·사이클 동호회.","title":"사이클 동호회","content":"로드바이크, 그룹라이드","img":"https://placehold.co/200x200/7a4d47/eee?text=M"},
    {"card_id":"00eebc99-9c0b-4ef8-bb6d-6bb9bd380a54","name":"조서윤","desc":"수채화·드로잉 모임.","title":"그림 모임","content":"수채화, 드로잉, 전시","img":"https://placehold.co/200x200/8a5d57/eee?text=S"},
    {"card_id":"01eebc99-9c0b-4ef8-bb6d-6bb9bd380a55","name":"윤지호","desc":"웹툰 작가 지망. 단편 연재.","title":"웹툰 작가","content":"웹툰, 스토리, 연재","img":"https://placehold.co/200x200/9a6d67/eee?text=J"},
    {"card_id":"02eebc99-9c0b-4ef8-bb6d-6bb9bd380a56","name":"장민호","desc":"피아노 동호회. 연주·합주.","title":"피아노 동호회","content":"피아노, 클래식, 연주","img":"https://placehold.co/200x200/2d275a/eee?text=M"},
    {"card_id":"03eebc99-9c0b-4ef8-bb6d-6bb9bd380a57","name":"임수현","desc":"캠핑·글램핑 모임.","title":"캠핑 모임","content":"캠핑, 글램핑, 오토캠핑","img":"https://placehold.co/200x200/3d376a/eee?text=S"},
    {"card_id":"04eebc99-9c0b-4ef8-bb6d-6bb9bd380a58","name":"오현서","desc":"볼링 동호회. 주말 리그.","title":"볼링 동호회","content":"볼링, 리그, 스코어","img":"https://placehold.co/200x200/4d477a/eee?text=H"},
    {"card_id":"05eebc99-9c0b-4ef8-bb6d-6bb9bd380a59","name":"신도현","desc":"테니스 동호회. 단식·복식.","title":"테니스 동호회","content":"테니스, 주말 모임","img":"https://placehold.co/200x200/5d578a/eee?text=D"},
    {"card_id":"06eebc99-9c0b-4ef8-bb6d-6bb9bd380a5a","name":"권지민","desc":"풋살·축구 주말 리그.","title":"풋살 동호회","content":"풋살, 축구, 주말 리그","img":"https://placehold.co/200x200/6d679a/eee?text=J"},
    {"card_id":"07eebc99-9c0b-4ef8-bb6d-6bb9bd380a5b","name":"송예나","desc":"골프 레슨·스코어 개선.","title":"골프 동호회","content":"골프, 레슨, 라운딩","img":"https://placehold.co/200x200/7d77aa/eee?text=Y"},
    {"card_id":"08eebc99-9c0b-4ef8-bb6d-6bb9bd380a5c","name":"배서현","desc":"요가·필라테스 인스트럭터.","title":"요가 인스트럭터","content":"요가, 필라테스, 명상","img":"https://placehold.co/200x200/8d87ba/eee?text=S"},
    {"card_id":"09eebc99-9c0b-4ef8-bb6d-6bb9bd380a5d","name":"홍준영","desc":"사진작가. 웨딩·인물.","title":"사진작가","content":"웨딩, 인물, 전시","img":"https://placehold.co/200x200/1a1a3a/eee?text=J"},
    {"card_id":"0aeebc99-9c0b-4ef8-bb6d-6bb9bd380a5e","name":"문지현","desc":"댄스 동호회. K-pop·재즈.","title":"댄스 동호회","content":"댄스, K-pop, 공연","img":"https://placehold.co/200x200/2a2a4a/eee?text=J"},
    {"card_id":"0beebc99-9c0b-4ef8-bb6d-6bb9bd380a5f","name":"서유진","desc":"브루잉·맥주 동호회.","title":"브루잉 동호회","content":"맥주, 홈브루잉, 시음","img":"https://placehold.co/200x200/3a3a5a/eee?text=Y"},
    {"card_id":"0ceebc99-9c0b-4ef8-bb6d-6bb9bd380a60","name":"노민재","desc":"캘리그라피·손글씨 모임.","title":"캘리그라피 모임","content":"캘리그라피, 손글씨","img":"https://placehold.co/200x200/4a4a6a/eee?text=M"},
    {"card_id":"0deebc99-9c0b-4ef8-bb6d-6bb9bd380a61","name":"양서연","desc":"초등학교 교사. 10년차.","title":"초등학교 교사","content":"초등, 교육, 학부모","img":"https://placehold.co/200x200/2d4a27/eee?text=S"},
    {"card_id":"0eeebc99-9c0b-4ef8-bb6d-6bb9bd380a62","name":"차준호","desc":"고등학교 국어 교사.","title":"고등학교 국어 교사","content":"국어, 논술, 수능","img":"https://placehold.co/200x200/3d5a37/eee?text=J"},
    {"card_id":"0feebc99-9c0b-4ef8-bb6d-6bb9bd380a63","name":"백지원","desc":"대학 교수 · 심리학.","title":"대학 교수 · 심리학","content":"심리학, 상담, 연구","img":"https://placehold.co/200x200/4d6a47/eee?text=J"},
    {"card_id":"10eebc99-9c0b-4ef8-bb6d-6bb9bd380a64","name":"남예준","desc":"약사. 약국 운영·상담.","title":"약사","content":"약국, 처방, 건강상담","img":"https://placehold.co/200x200/5d7a57/eee?text=Y"},
    {"card_id":"11eebc99-9c0b-4ef8-bb6d-6bb9bd380a65","name":"김하늘","desc":"간호사. 병원·헬스케어.","title":"간호사","content":"간호, 환자 care","img":"https://placehold.co/200x200/6d8a67/eee?text=H"},
    {"card_id":"12eebc99-9c0b-4ef8-bb6d-6bb9bd380a66","name":"이수아","desc":"영양사. 기업 급식·상담.","title":"영양사","content":"급식, 다이어트, 상담","img":"https://placehold.co/200x200/7d9a77/eee?text=S"},
    {"card_id":"13eebc99-9c0b-4ef8-bb6d-6bb9bd380a67","name":"박도훈","desc":"치과의사. 임플란트·교정.","title":"치과의사","content":"임플란트, 교정, 예방","img":"https://placehold.co/200x200/8daa87/eee?text=D"},
    {"card_id":"14eebc99-9c0b-4ef8-bb6d-6bb9bd380a68","name":"최민지","desc":"한의사. 침·약침·한방.","title":"한의사","content":"침, 약침, 한방","img":"https://placehold.co/200x200/9dba97/eee?text=M"},
    {"card_id":"15eebc99-9c0b-4ef8-bb6d-6bb9bd380a69","name":"정서윤","desc":"비개발 IT. ERP·SI 기획.","title":"IT 기획 · 비개발","content":"ERP, SI, 요구사항","img":"https://placehold.co/200x200/1a3a2a/eee?text=S"},
    {"card_id":"16eebc99-9c0b-4ef8-bb6d-6bb9bd380a6a","name":"한지훈","desc":"퍼블리셔. 웹 퍼블리싱 7년.","title":"퍼블리셔","content":"HTML, CSS, 반응형","img":"https://placehold.co/200x200/2a4a3a/eee?text=J"},
    {"card_id":"17eebc99-9c0b-4ef8-bb6d-6bb9bd380a6b","name":"강예진","desc":"CS 매니저. 고객 응대·교육.","title":"CS 매니저","content":"고객응대, VOC, 교육","img":"https://placehold.co/200x200/3a5a4a/eee?text=Y"},
    {"card_id":"18eebc99-9c0b-4ef8-bb6d-6bb9bd380a6c","name":"조민서","desc":"브랜드 마케터. B2C 캠페인.","title":"브랜드 마케터","content":"브랜드, 캠페인, SNS","img":"https://placehold.co/200x200/4a6a5a/eee?text=M"},
    {"card_id":"19eebc99-9c0b-4ef8-bb6d-6bb9bd380a6d","name":"윤도현","desc":"사업개발. B2B 제휴·M&A.","title":"사업개발","content":"BD, 제휴, M&A","img":"https://placehold.co/200x200/5a7a6a/eee?text=D"},
    {"card_id":"1aeebc99-9c0b-4ef8-bb6d-6bb9bd380a6e","name":"장하은","desc":"프로덕트 마케터. 앱 성장.","title":"프로덕트 마케터","content":"앱 성장, 퍼널, A/B","img":"https://placehold.co/200x200/6a8a7a/eee?text=H"},
    {"card_id":"1beebc99-9c0b-4ef8-bb6d-6bb9bd380a6f","name":"임수진","desc":"인플루언서 마케팅. 협찬·콜라보.","title":"인플루언서 마케팅","content":"인플루언서, 협찬","img":"https://placehold.co/200x200/7a9a8a/eee?text=S"},
    {"card_id":"1ceebc99-9c0b-4ef8-bb6d-6bb9bd380a70","name":"오재민","desc":"VC 투자 매니저. 시드·시리즈A.","title":"VC 투자 매니저","content":"투자, 스타트업, DD","img":"https://placehold.co/200x200/8aaa9a/eee?text=J"},
    {"card_id":"1deebc99-9c0b-4ef8-bb6d-6bb9bd380a71","name":"신유나","desc":"컨설턴트. 전략·조직.","title":"컨설턴트","content":"전략, 조직, PMO","img":"https://placehold.co/200x200/9abaaa/eee?text=Y"},
    {"card_id":"1eeebc99-9c0b-4ef8-bb6d-6bb9bd380a72","name":"권시우","desc":"실무자 구인 중. 프론트 1명.","title":"스타트업 CTO · 구인","content":"프론트엔드 구인","img":"https://placehold.co/200x200/1a2a3a/eee?text=S"},
    {"card_id":"1feebc99-9c0b-4ef8-bb6d-6bb9bd380a73","name":"송민재","desc":"풀스택 구직. 3년차.","title":"구직 중 · 풀스택","content":"Node, React, AWS","img":"https://placehold.co/200x200/2a3a4a/eee?text=M"},
    {"card_id":"20eebc99-9c0b-4ef8-bb6d-6bb9bd380a74","name":"배지훈","desc":"데이터 사이언티스트 구직.","title":"구직 중 · 데이터","content":"Python, ML, SQL","img":"https://placehold.co/200x200/3a4a5a/eee?text=J"},
    {"card_id":"21eebc99-9c0b-4ef8-bb6d-6bb9bd380a75","name":"홍서아","desc":"일본어 강사. JPT·회화.","title":"일본어 강사","content":"일본어, JPT, 비즈니스","img":"https://placehold.co/200x200/4a5a6a/eee?text=S"},
    {"card_id":"22eebc99-9c0b-4ef8-bb6d-6bb9bd380a76","name":"문예준","desc":"중국어 통번역.","title":"중국어 통번역","content":"중국어, 통번역, 비즈니스","img":"https://placehold.co/200x200/5a6a7a/eee?text=Y"},
    {"card_id":"23eebc99-9c0b-4ef8-bb6d-6bb9bd380a77","name":"서도윤","desc":"고등학교 정보 교사.","title":"고등학교 정보 교사","content":"정보, 코딩, SW교육","img":"https://placehold.co/200x200/6a7a8a/eee?text=D"},
    {"card_id":"24eebc99-9c0b-4ef8-bb6d-6bb9bd380a78","name":"노하린","desc":"유치원 교사. 8년차.","title":"유치원 교사","content":"유치원, 놀이, 교육","img":"https://placehold.co/200x200/7a8a9a/eee?text=H"},
    {"card_id":"25eebc99-9c0b-4ef8-bb6d-6bb9bd380a79","name":"양민서","desc":"대학 교수 · 통계학.","title":"대학 교수 · 통계","content":"통계, 데이터, 연구","img":"https://placehold.co/200x200/8a9aaa/eee?text=M"},
    {"card_id":"26eebc99-9c0b-4ef8-bb6d-6bb9bd380a7a","name":"차지원","desc":"골프 레슨 프로.","title":"골프 프로","content":"골프, 레슨, 스윙","img":"https://placehold.co/200x200/275a4a/eee?text=J"},
    {"card_id":"27eebc99-9c0b-4ef8-bb6d-6bb9bd380a7b","name":"백서준","desc":"피트니스 트레이너.","title":"피트니스 트레이너","content":"헬스, 다이어트, PT","img":"https://placehold.co/200x200/376a5a/eee?text=S"},
    {"card_id":"28eebc99-9c0b-4ef8-bb6d-6bb9bd380a7c","name":"남지우","desc":"스쿼시 동호회.","title":"스쿼시 동호회","content":"스쿼시, 주말 모임","img":"https://placehold.co/200x200/477a6a/eee?text=J"},
    {"card_id":"29eebc99-9c0b-4ef8-bb6d-6bb9bd380a7d","name":"김예서","desc":"바둑 동호회.","title":"바둑 동호회","content":"바둑, 대국, 토너먼트","img":"https://placehold.co/200x200/578a7a/eee?text=Y"},
    {"card_id":"2aeebc99-9c0b-4ef8-bb6d-6bb9bd380a7e","name":"이준서","desc":"낚시 동호회. 선상·민물.","title":"낚시 동호회","content":"낚시, 선상, 민물","img":"https://placehold.co/200x200/679a8a/eee?text=J"},
    {"card_id":"2beebc99-9c0b-4ef8-bb6d-6bb9bd380a7f","name":"박시현","desc":"보드게임 제작자.","title":"보드게임 제작자","content":"보드게임, 기획, 제작","img":"https://placehold.co/200x200/77aa9a/eee?text=S"},
    {"card_id":"2ceebc99-9c0b-4ef8-bb6d-6bb9bd380a80","name":"최민호","desc":"테크 블로거. 개발·IT.","title":"테크 블로거","content":"블로그, 개발, IT","img":"https://placehold.co/200x200/87baaa/eee?text=M"},
    {"card_id":"2deebc99-9c0b-4ef8-bb6d-6bb9bd380a81","name":"정수빈","desc":"팟캐스트 진행. 인터뷰.","title":"팟캐스트 진행자","content":"팟캐스트, 인터뷰","img":"https://placehold.co/200x200/97caba/eee?text=S"},
    {"card_id":"2eeebc99-9c0b-4ef8-bb6d-6bb9bd380a82","name":"한도윤","desc":"유튜버. 개발·취미.","title":"유튜버","content":"유튜브, 개발, Vlog","img":"https://placehold.co/200x200/4a275a/eee?text=D"},
    {"card_id":"2feebc99-9c0b-4ef8-bb6d-6bb9bd380a83","name":"강예나","desc":"메이크업 아티스트.","title":"메이크업 아티스트","content":"메이크업, 브라이덜, 수업","img":"https://placehold.co/200x200/5a376a/eee?text=Y"},
    {"card_id":"30eebc99-9c0b-4ef8-bb6d-6bb9bd380a84","name":"조현서","desc":"플로리스트. 웨딩·이벤트.","title":"플로리스트","content":"꽃, 웨딩, 이벤트","img":"https://placehold.co/200x200/6a477a/eee?text=H"},
    {"card_id":"31eebc99-9c0b-4ef8-bb6d-6bb9bd380a85","name":"윤지민","desc":"소프트웨어 엔지니어 구인 중.","title":"대기업 R&D · 구인","content":"백엔드 2명 구인","img":"https://placehold.co/200x200/7a578a/eee?text=J"},
    {"card_id":"32eebc99-9c0b-4ef8-bb6d-6bb9bd380a86","name":"장서준","desc":"디자인 에이전시 대표.","title":"디자인 에이전시","content":"디자이너 채용, 프리랜서","img":"https://placehold.co/200x200/8a679a/eee?text=S"},
    {"card_id":"33eebc99-9c0b-4ef8-bb6d-6bb9bd380a87","name":"임예진","desc":"외식업 창업. 프랜차이즈.","title":"외식업 창업","content":"프랜차이즈, 창업","img":"https://placehold.co/200x200/9a77aa/eee?text=Y"},
    {"card_id":"34eebc99-9c0b-4ef8-bb6d-6bb9bd380a88","name":"오지훈","desc":"부동산 중개. 상가·주거.","title":"부동산 중개사","content":"중개, 상가, 주거","img":"https://placehold.co/200x200/aa87ba/eee?text=J"},
    {"card_id":"35eebc99-9c0b-4ef8-bb6d-6bb9bd380a89","name":"신민지","desc":"이벤트 기획자. 웨딩·기업.","title":"이벤트 기획자","content":"웨딩, 기업행사, 연출","img":"https://placehold.co/200x200/1a2a1a/eee?text=M"},
    {"card_id":"36eebc99-9c0b-4ef8-bb6d-6bb9bd380a8a","name":"권도훈","desc":"사운드 디자이너. 게임·영상.","title":"사운드 디자이너","content":"사운드, BGM, 효과음","img":"https://placehold.co/200x200/2a3a2a/eee?text=D"},
    {"card_id":"37eebc99-9c0b-4ef8-bb6d-6bb9bd380a8b","name":"송하진","desc":"애니메이션 연출.","title":"애니메이션 연출","content":"애니, 연출, 스토리보드","img":"https://placehold.co/200x200/3a4a3a/eee?text=H"},
    {"card_id":"38eebc99-9c0b-4ef8-bb6d-6bb9bd380a8c","name":"배수현","desc":"인더스트리얼 디자이너.","title":"인더스트리얼 디자이너","content":"제품디자인, 3D","img":"https://placehold.co/200x200/4a5a4a/eee?text=S"},
    {"card_id":"39eebc99-9c0b-4ef8-bb6d-6bb9bd380a8d","name":"홍지우","desc":"모델·광고.","title":"모델","content":"광고, 패션, 런웨이","img":"https://placehold.co/200x200/5a6a5a/eee?text=J"},
    {"card_id":"3aeebc99-9c0b-4ef8-bb6d-6bb9bd380a8e","name":"문서연","desc":"성우. 더빙·나레이션.","title":"성우","content":"더빙, 나레이션, 광고","img":"https://placehold.co/200x200/6a7a6a/eee?text=S"},
    {"card_id":"3beebc99-9c0b-4ef8-bb6d-6bb9bd380a8f","name":"서민준","desc":"사회복지사. 청소년·노인.","title":"사회복지사","content":"복지, 상담, 프로그램","img":"https://placehold.co/200x200/7a8a7a/eee?text=M"},
    {"card_id":"3ceebc99-9c0b-4ef8-bb6d-6bb9bd380a90","name":"노지안","desc":"직업상담사. 청년 취업.","title":"직업상담사","content":"취업, 상담, 진로","img":"https://placehold.co/200x200/8a9a8a/eee?text=J"}
  ]'::JSONB;
  v_idx INT := 0;
  v_ord_offset INT := 36;
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
