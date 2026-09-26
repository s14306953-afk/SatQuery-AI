import type { ChangeDetection, EvidenceItem, ForensicAnalysis, Location, Scenario, TimeSeries } from '../../types'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

const readEnv = (key: string, fallback: string) => {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const value = env ? env[`VITE_${key}`] ?? env[key] ?? fallback : fallback
  return typeof value === 'string' ? value : fallback
}

const COPERNICUS_BACKEND_URL = readEnv('COPERNICUS_BACKEND_URL', '')
const snapshotCache = new Map<string, { expiresAt: number; promise: Promise<CopernicusSnapshot> }>()

interface CopernicusSnapshot {
  timeSeries: TimeSeries[]
  changeDetection: ChangeDetection | null
  forensic: ForensicAnalysis | null
  evidence: EvidenceItem[]
  scenario: Scenario | null
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

const fetchCopernicusSnapshot = async (location: Location): Promise<CopernicusSnapshot> => {
  type SnapshotPayload = {
    features?: any[]
    timeSeries?: TimeSeries[]
    changeDetection?: ChangeDetection | null
    forensic?: ForensicAnalysis | null
    evidence?: EvidenceItem[]
    scenario?: Scenario | null
  }

  const emptySnapshot = {
    timeSeries: [] as TimeSeries[],
    changeDetection: null,
    forensic: null,
    evidence: [] as EvidenceItem[],
    scenario: null,
  }

  if (COPERNICUS_BACKEND_URL) {
    try {
      const response = await fetch(`${COPERNICUS_BACKEND_URL}?lat=${location.lat}&lng=${location.lng}&radius=${location.radius ?? 2000}`)
      if (!response.ok) throw new Error(`Copernicus backend returned ${response.status}.`)
      const payload = await response.json() as SnapshotPayload
      return {
        timeSeries: payload.timeSeries ?? (payload.features ?? []).slice(0, 4).map(normalizeFeature),
        changeDetection: payload.changeDetection ?? null,
        forensic: payload.forensic ?? null,
        evidence: payload.evidence ?? [],
        scenario: payload.scenario ?? null,
      }
    } catch {
      return emptySnapshot
    }
  }

  if (!isSupabaseConfigured) return emptySnapshot

  try {
    const { data, error } = await supabase.functions.invoke('copernicus-live', {
      body: { lat: location.lat, lng: location.lng, radius: location.radius ?? 2000 },
    })
    if (error) throw error
    const payload = data as SnapshotPayload
    const features = payload.features ?? []
    return {
      timeSeries: payload.timeSeries ?? features.slice(0, 4).map(normalizeFeature),
      changeDetection: payload.changeDetection ?? null,
      forensic: payload.forensic ?? null,
      evidence: payload.evidence ?? [],
      scenario: payload.scenario ?? null,
    }
  } catch {
    return emptySnapshot
  }
}

export const getCopernicusSnapshot = (location: Location): Promise<CopernicusSnapshot> => {
  const key = `${location.lat.toFixed(5)}:${location.lng.toFixed(5)}:${location.radius ?? 2000}`
  const cached = snapshotCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.promise

  const promise = fetchCopernicusSnapshot(location)
  snapshotCache.set(key, { expiresAt: Date.now() + 60_000, promise })
  return promise
}

export const getCopernicusTimeSeries = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.timeSeries)
export const getCopernicusChangeDetection = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.changeDetection)
export const getCopernicusForensicAnalysis = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.forensic)
export const getCopernicusEvidence = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.evidence)
export const getCopernicusScenario = async (location: Location) => {
  const snapshot = await getCopernicusSnapshot(location)
  return snapshot.scenario
}
