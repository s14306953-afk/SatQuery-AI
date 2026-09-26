import type { ChangeDetection, EvidenceItem, ForensicAnalysis, Location, Scenario, TimeSeries } from '../../types'

const readEnv = (key: string, fallback: string) => {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const value = env ? env[`VITE_${key}`] ?? env[key] ?? fallback : fallback
  return typeof value === 'string' ? value : fallback
}

const COPERNICUS_BASE_URL = readEnv('COPERNICUS_BASE_URL', 'https://stac.dataspace.copernicus.eu/stac')
const COPERNICUS_COLLECTION = readEnv('COPERNICUS_COLLECTION', 'sentinel-2-l2a')
const COPERNICUS_TOKEN = readEnv('COPERNICUS_TOKEN', '')
const COPERNICUS_BACKEND_URL = readEnv('COPERNICUS_BACKEND_URL', '')

const getCopernicusSearchUrl = () => {
  const normalizedBase = COPERNICUS_BASE_URL.replace(/\/+$/, '')
  const searchUrl = normalizedBase.endsWith('/search') ? normalizedBase : `${normalizedBase}/search`
  return new URL(searchUrl)
}

const toDateValue = (value?: string | null) => {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

const normalizeFeature = (feature: any, index: number): TimeSeries => {
  const properties = feature?.properties ?? {}
  const datetime = toDateValue(properties.datetime)
  const platform = String(properties.platform ?? 'Sentinel-2')
  const collection = String(feature?.collection ?? 'sentinel-2-l2a')

  return {
    id: `copernicus-${feature?.id ?? index + 1}`,
    date: datetime,
    sensor: platform,
    source: 'Copernicus Data Space',
    summary: `Remote sensing observation from ${platform} for the selected footprint.`,
    changePercent: Number(properties.changePercent) || 0,
    acquisition: datetime,
    band: collection.includes('sentinel-1') ? 'VV/VH' : 'RGB + NIR',
  }
}

export const getCopernicusSnapshot = async (location: Location) => {
  const bbox = [
    location.lng - 0.05,
    location.lat - 0.05,
    location.lng + 0.05,
    location.lat + 0.05,
  ]

  if (COPERNICUS_BACKEND_URL) {
    try {
      const response = await fetch(`${COPERNICUS_BACKEND_URL}?lat=${location.lat}&lng=${location.lng}&radius=${location.radius ?? 2000}`)
      if (response.ok) {
        const payload = await response.json() as { features?: any[]; timeSeries?: TimeSeries[]; changeDetection?: ChangeDetection; forensic?: ForensicAnalysis; evidence?: EvidenceItem[]; scenario?: Scenario }
        if (payload.features?.length || payload.timeSeries?.length) {
          return {
            timeSeries: payload.timeSeries ?? (payload.features ?? []).slice(0, 4).map(normalizeFeature),
            changeDetection: payload.changeDetection ?? null,
            forensic: payload.forensic ?? null,
            evidence: payload.evidence ?? [],
            scenario: payload.scenario ?? null,
          }
        }
      }
    } catch {
      // Fall through to the direct public fetch below.
    }
  }

  try {
    const url = getCopernicusSearchUrl()
    url.searchParams.set('collections', COPERNICUS_COLLECTION)
    url.searchParams.set('bbox', bbox.join(','))
    url.searchParams.set('limit', '4')
    url.searchParams.set('datetime', '2023-02-01/2024-12-31')

    const headers: HeadersInit = {
      Accept: 'application/json',
    }

    if (COPERNICUS_TOKEN) {
      headers.Authorization = `Bearer ${COPERNICUS_TOKEN}`
    }

    const response = await fetch(url.toString(), {
      headers,
    })

    if (!response.ok) {
      throw new Error(`Copernicus request failed with status ${response.status}`)
    }

    const payload = await response.json() as { features?: any[] }
    const features = payload.features ?? []

    if (!features.length) {
      throw new Error('No Copernicus items returned for this area.')
    }

    const timeSeries = features.slice(0, 4).map((feature, index) => normalizeFeature(feature, index))
    return {
      timeSeries,
      changeDetection: null,
      forensic: null,
      evidence: [],
      scenario: null,
    }
  } catch {
    return {
      timeSeries: [],
      changeDetection: null,
      forensic: null,
      evidence: [],
      scenario: null,
    }
  }
}

export const getCopernicusTimeSeries = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.timeSeries)
export const getCopernicusChangeDetection = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.changeDetection)
export const getCopernicusForensicAnalysis = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.forensic)
export const getCopernicusEvidence = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.evidence)
export const getCopernicusScenario = async (location: Location) => {
  const snapshot = await getCopernicusSnapshot(location)
  return snapshot.scenario
}
