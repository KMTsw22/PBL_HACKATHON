-- PGRST203 방지: 인자 1개 버전 제거, (p_limit, p_exclude_ids) 버전만 유지
DROP FUNCTION IF EXISTS public.get_random_discover_cards(integer);
