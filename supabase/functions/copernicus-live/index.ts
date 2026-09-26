const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ error: 'GET or POST is required.' }, 405)
  }

  const configuredBaseUrl = Deno.env.get('COPERNICUS_BASE_URL') || 'https://stac.dataspace.copernicus.eu/v1'
  const baseUrl = configuredBaseUrl.replace(/\/+$/, '').replace(/\/stac$/i, '/v1')
  const collection = Deno.env.get('COPERNICUS_COLLECTION') || 'sentinel-2-l2a'
  const token = Deno.env.get('COPERNICUS_TOKEN') || ''

  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
    const params = new URLSearchParams()
    const lat = Number(body.lat ?? body.latitude ?? 12.9716)
    const lng = Number(body.lng ?? body.longitude ?? 77.5946)
    const radius = Number(body.radius ?? 2000)
    const bbox = [lng - 0.05, lat - 0.05, lng + 0.05, lat + 0.05].join(',')

    params.set('collections', collection)
    params.set('bbox', bbox)
    params.set('limit', '4')
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setUTCFullYear(startDate.getUTCFullYear() - 2)
    params.set('datetime', `${startDate.toISOString()}/${endDate.toISOString()}`)
    params.set('sortby', '-properties.datetime')

    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/search`)
    url.search = params.toString()

    const headers: HeadersInit = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await fetch(url.toString(), { headers })
    const responseText = await response.text()
    let data: { features?: Array<Record<string, unknown>> }
    try {
      data = JSON.parse(responseText) as { features?: Array<Record<string, unknown>> }
    } catch {
      return jsonResponse({ error: 'Copernicus returned a non-JSON response.', details: responseText.slice(0, 300) }, 502)
    }

    if (!response.ok) {
      return jsonResponse({ error: 'Copernicus fetch failed.', details: data }, response.status)
    }

    const features = Array.isArray(data?.features) ? data.features : []

    return jsonResponse({
      source: 'Copernicus Data Space',
      collection,
      radius,
      location: { lat, lng },
      features,
      count: features.length,
    })
  } catch (error) {
    return jsonResponse({ error: 'Copernicus backend failed', details: error instanceof Error ? error.message : String(error) }, 502)
  }
})
