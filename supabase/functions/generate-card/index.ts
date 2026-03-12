import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ message: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const prompt =
      typeof body.prompt === 'string'
        ? body.prompt
        : typeof body.description === 'string'
          ? [body.cardName, body.description, body.customTitle, body.customContent]
              .filter(Boolean)
              .join('. ')
          : null
    const imageBase64 = body.imageBase64
    if (!prompt) {
      return new Response(
        JSON.stringify({ message: 'prompt or description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ message: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let finalPrompt = prompt
    if (imageBase64 && typeof imageBase64 === 'string') {
      const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '이 이미지를 한 문장으로 간결하게 설명해주세요. 인물의 외모, 스타일, 분위기 등을 한국어로 작성해주세요. DALL-E 이미지 생성 프롬프트에 넣을 수 있도록 구체적으로.',
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                },
              ],
            },
          ],
          max_tokens: 200,
        }),
      })
      if (visionRes.ok) {
        const visionData = await visionRes.json()
        const description = visionData?.choices?.[0]?.message?.content?.trim()
        if (description) {
          finalPrompt = `참조 이미지: ${description}. ${prompt}`
        } else {
          console.log('[generate-card] Vision 설명 없음, 원본 프롬프트 사용')
        }
      } else {
        const visionErr = await visionRes.json().catch(() => ({}))
        console.warn('[generate-card] Vision API 실패, 참조 없이 진행:', visionErr?.error?.message || visionRes.status)
      }
    }

    let res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: finalPrompt.slice(0, 4000),
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      }),
    })

    if (!res.ok && imageBase64) {
      const retryErr = await res.json().catch(() => ({}))
      console.warn('[generate-card] 참조 이미지로 DALL-E 실패, 참조 없이 재시도:', retryErr?.error?.message || res.status)
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'url',
        }),
      })
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error?.message || err.message || `OpenAI error: ${res.status}`
      console.error('[generate-card] OpenAI 에러:', { status: res.status, err, msg })
      return new Response(
        JSON.stringify({ message: msg }),
        { status: res.status >= 400 ? res.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiJson = await res.json()
    const { data } = openaiJson
    const imageUrl = data?.[0]?.url
    console.log('[generate-card] OpenAI 응답:', { hasData: !!data, hasImageUrl: !!imageUrl })
    if (!imageUrl) {
      console.error('[generate-card] OpenAI에서 image URL 없음:', openaiJson)
      return new Response(
        JSON.stringify({ message: 'No image URL in OpenAI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const imageRes = await fetch(imageUrl)
    if (!imageRes.ok) {
      return new Response(
        JSON.stringify({ message: 'Failed to fetch generated image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const imageBlob = await imageRes.blob()
    const ext = 'png'
    const path = `cards/${crypto.randomUUID()}.${ext}`

    // DB에 오래 보관: OpenAI 임시 URL 대신 Supabase Storage에 업로드 후 public URL 반환 → 클라이언트가 user_cards.image_url에 저장
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, imageBlob, { contentType: 'image/png', upsert: true })

    if (uploadError) {
      return new Response(
        JSON.stringify({ message: `Storage upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(uploadData.path)
    const publicUrl = urlData.publicUrl
    console.log('[generate-card] 성공:', { path: uploadData.path, publicUrl: publicUrl?.slice(0, 80) })

    return new Response(
      JSON.stringify({ url: publicUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('[generate-card] 에러:', e)
    return new Response(
      JSON.stringify({ message: e instanceof Error ? e.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
