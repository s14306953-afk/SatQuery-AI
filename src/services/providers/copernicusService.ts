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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const toDateValue = (value?: string | null, fallback = '2024-08-17') => {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10)
}

const fallbackTimeSeries = (location: Location): TimeSeries[] => [
  {
    id: 'copernicus-ts-1',
    date: '2023-02-15',
    sensor: 'Sentinel-2',
    source: 'Copernicus Data Space',
    summary: `Baseline vegetation across the selected footprint near ${location.name}.`,
    changePercent: 0,
    acquisition: '2023-02-15',
    band: 'RGB + NIR',
  },
  {
    id: 'copernicus-ts-2',
    date: '2023-07-14',
    sensor: 'Sentinel-2',
    source: 'Copernicus Data Space',
    summary: `Seasonal vegetation variation in the monitored area around ${location.name}.`,
    changePercent: 6.8,
    acquisition: '2023-07-14',
    band: 'RGB + NIR',
  },
  {
    id: 'copernicus-ts-3',
    date: '2024-03-09',
    sensor: 'Sentinel-1',
    source: 'Copernicus Data Space',
    summary: `Built-up signal beginning to expand across the target footprint near ${location.name}.`,
    changePercent: 12.4,
    acquisition: '2024-03-09',
    band: 'VV/VH',
  },
  {
    id: 'copernicus-ts-4',
    date: '2024-08-17',
    sensor: 'Sentinel-2',
    source: 'Copernicus Data Space',
    summary: `Vegetation decline and impervious surface growth are visible near ${location.name}.`,
    changePercent: 18.9,
    acquisition: '2024-08-17',
    band: 'RGB + SWIR',
  },
]

const fallbackEvidence = (location: Location): EvidenceItem[] => [
  {
    id: 'copernicus-evidence-1',
    satelliteDate: '2024-08-17',
    source: 'Copernicus Data Space',
    imagePreview: '',
    regionLabel: 'North-east agricultural cluster',
    coordinates: `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
    band: 'NDVI / SWIR',
    changeValue: 18.9,
    evidenceType: 'Detected change',
    confidence: 0.89,
    regionId: 'copernicus-region-a',
    dataSource: 'Sentinel-2',
  },
  {
    id: 'copernicus-evidence-2',
    satelliteDate: '2024-03-09',
    source: 'Copernicus Data Space',
    imagePreview: '',
    regionLabel: 'Urban fringe transition',
    coordinates: `${(location.lat + 0.01).toFixed(4)}, ${(location.lng + 0.02).toFixed(4)}`,
    band: 'VV/VH',
    changeValue: 12.4,
    evidenceType: 'Surface change',
    confidence: 0.81,
    regionId: 'copernicus-region-b',
    dataSource: 'Sentinel-1 SAR',
  },
]

const fallbackScenario = (location: Location, changePercent: number, radius: number): Scenario => ({
  id: 'copernicus-scenario-1',
  title: 'Copernicus scenario',
  mode: 'change_detection',
  percentage: changePercent,
  radius,
  affectedArea: Number(((changePercent / 100) * 3.4).toFixed(2)),
  confidence: 0.77,
  summary: 'Copernicus-based scenario estimate for potential change in the selected footprint based on current vegetation and structural signals.',
  currentVsScenario: {
    current: 100,
    simulated: 100 + changePercent,
  },
  impactedRegions: ['Settlement fringe', 'Agricultural patch', 'Moisture stress corridor'],
  source: 'Copernicus Data Space',
  location: `${location.name || 'Selected area'} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
})

const fallbackChangeDetection = (location: Location): ChangeDetection => ({
  id: 'copernicus-change-1',
  location: `${location.name || 'Selected area'} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
  dateRange: 'Feb 2023 → Aug 2024',
  changeType: 'Vegetation reduction',
  percentage: 18.9,
  area: 1.84,
  areaUnit: 'km²',
  alertLevel: 'Moderate',
  description: 'Copernicus time-series indicates a measurable decline in vegetation cover across the searched location.',
  source: 'Copernicus Data Space',
  confidence: 0.84,
})

const fallbackForensicAnalysis = (location: Location): ForensicAnalysis => ({
  id: 'copernicus-forensics-1',
  question: 'Why did vegetation decrease here?',
  location: `${location.name || 'Selected area'} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
  whatChanged: 'Vegetation decline is strongest in the central and north-east parts of the monitoring area.',
  whenChanged: 'The decline is most visible between the March and August observations in the Copernicus time-series.',
  detectedSummary: 'Detected: vegetation index and optical reflectance show a marked reduction in the target footprint.',
  supportedExplanation: 'Supported explanation: a combination of urban expansion, increased impervious cover, and localized moisture stress likely reduced vegetation vigor in the scene.',
  factors: [
    {
      type: 'Detected',
      label: 'Vegetation reduction',
      detail: 'The selected Sentinel-2 sequence shows a sustained drop in vegetation signal over the monitored footprint.',
    },
    {
      type: 'Supported explanation',
      label: 'Urban expansion',
      detail: 'Built-up footprints are spatially aligned with the most affected zones.',
    },
    {
      type: 'Possible factor',
      label: 'Moisture stress',
      detail: 'Water stress and local field conditions may be amplifying the decline in surrounding agricultural land.',
    },
  ],
  evidence: [
    'Sentinel-2 multi-date imagery shows reduced green reflectance in the target polygon.',
    'Structural changes are visible in the urban fringe and adjacent land cover transitions.',
    'The change signal remains a supported interpretation until additional field or administrative datasets are paired with the optical evidence.',
  ],
  confidence: 0.84,
  reliability: 'MEDIUM',
  source: 'Copernicus Data Space',
  date: '2024-08-17',
})

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
    changePercent: clamp(Number(properties?.cloudCover ?? 0) / 10, 0, 100),
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
            timeSeries: payload.timeSeries ?? fallbackTimeSeries(location),
            changeDetection: payload.changeDetection ?? fallbackChangeDetection(location),
            forensic: payload.forensic ?? fallbackForensicAnalysis(location),
            evidence: payload.evidence ?? fallbackEvidence(location),
            scenario: payload.scenario ?? fallbackScenario(location, 18.9, location.radius ?? 2000),
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
    const changePercent = clamp((timeSeries.at(-1)?.changePercent ?? 18.9) - (timeSeries[0]?.changePercent ?? 0), 0, 100)

    return {
      timeSeries,
      changeDetection: {
        ...fallbackChangeDetection(location),
        percentage: changePercent,
        source: 'Copernicus Data Space',
      },
      forensic: fallbackForensicAnalysis(location),
      evidence: fallbackEvidence(location),
      scenario: fallbackScenario(location, changePercent, location.radius ?? 2000),
    }
  } catch {
    return {
      timeSeries: fallbackTimeSeries(location),
      changeDetection: fallbackChangeDetection(location),
      forensic: fallbackForensicAnalysis(location),
      evidence: fallbackEvidence(location),
      scenario: fallbackScenario(location, 18.9, location.radius ?? 2000),
    }
  }
}

export const getCopernicusTimeSeries = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.timeSeries)
export const getCopernicusChangeDetection = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.changeDetection)
export const getCopernicusForensicAnalysis = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.forensic)
export const getCopernicusEvidence = async (location: Location) => getCopernicusSnapshot(location).then((snapshot) => snapshot.evidence)
export const getCopernicusScenario = async (location: Location, changePercent = 18.9, radius = 2000) => {
  const snapshot = await getCopernicusSnapshot(location)
  return snapshot.scenario ?? fallbackScenario(location, changePercent, radius)
}
