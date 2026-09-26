import type {
  ChangeDetection,
  EvidenceItem,
  ForensicAnalysis,
  Location,
  Scenario,
  SatelliteImage,
  TimeSeries,
  VoiceQuery,
} from '../types'
import {
  getCopernicusChangeDetection,
  getCopernicusEvidence,
  getCopernicusForensicAnalysis,
  getCopernicusScenario,
  getCopernicusTimeSeries,
} from './providers/copernicusService'

// This service is intentionally isolated so production providers (Copernicus, weather, or AI backends)
// can be swapped in without changing the workspace UI contract.
// When real providers are unavailable, the app uses a clean demo adapter that is clearly labeled as DEMO DATA.

export const buildTimeSeries = async (location: Location): Promise<TimeSeries[]> => {
  try {
    return await getCopernicusTimeSeries(location)
  } catch {
    return [
      {
        id: 'ts-2023-02',
        date: '2023-02-15',
        sensor: 'Sentinel-2',
        source: 'DEMO DATA · Copernicus Data Space',
        summary: `Baseline vegetation and sparse built-up features before the main growth signal near ${location.name}.`,
        changePercent: 0,
        acquisition: '2023-02-15',
        band: 'RGB + NIR',
      },
      {
        id: 'ts-2023-07',
        date: '2023-07-14',
        sensor: 'Sentinel-2',
        source: 'DEMO DATA · Copernicus Data Space',
        summary: `Vegetation peak with moderate seasonal variation in the surrounding fields of ${location.name}.`,
        changePercent: 6.8,
        acquisition: '2023-07-14',
        band: 'RGB + NIR',
      },
      {
        id: 'ts-2024-03',
        date: '2024-03-09',
        sensor: 'Sentinel-1',
        source: 'DEMO DATA · Sentinel-1 SAR',
        summary: `Built-up and transport expansion begins to appear around the focus polygon in ${location.name}.`,
        changePercent: 12.4,
        acquisition: '2024-03-09',
        band: 'VV/VH',
      },
      {
        id: 'ts-2024-08',
        date: '2024-08-17',
        sensor: 'Sentinel-2',
        source: 'DEMO DATA · Copernicus Data Space',
        summary: `Vegetation decline and increased impervious cover are visible in the comparison area around ${location.name}.`,
        changePercent: 18.9,
        acquisition: '2024-08-17',
        band: 'RGB + SWIR',
      },
    ]
  }
}

export const buildSatelliteImages = async (location: Location): Promise<SatelliteImage[]> => [
  {
    id: 'img-before',
    source: 'DEMO DATA · Copernicus Data Space',
    mission: 'Sentinel-2',
    sensor: 'Multi-spectral optical',
    date: '2023-02-15',
    modality: 'multispectral',
    band: 'NDVI / RGB',
    cloudCover: 9,
    coordinates: [location.lat, location.lng],
    confidence: 0.86,
  },
  {
    id: 'img-after',
    source: 'DEMO DATA · Sentinel-1',
    mission: 'Sentinel-1',
    sensor: 'SAR',
    date: '2024-08-17',
    modality: 'sar',
    band: 'VV/VH',
    cloudCover: 12,
    coordinates: [location.lat + 0.015, location.lng + 0.02],
    confidence: 0.82,
  },
]

export const buildChangeDetection = async (location: Location): Promise<ChangeDetection> => {
  try {
    return await getCopernicusChangeDetection(location)
  } catch {
    return {
      id: 'change-demo-1',
      location: `${location.name || 'Selected area'} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
      dateRange: 'Feb 2023 → Aug 2024',
      changeType: 'Vegetation reduction',
      percentage: 18.9,
      area: 1.84,
      areaUnit: 'km²',
      alertLevel: 'Moderate',
      description: 'Vegetation decreased significantly between March and July as built-up and impervious surfaces expanded in the surrounding footprint.',
      source: 'DEMO DATA • Sentinel-2 / SAR fusion',
      confidence: 0.84,
    }
  }
}

export const buildForensicAnalysis = async (location: Location): Promise<ForensicAnalysis> => {
  try {
    return await getCopernicusForensicAnalysis(location)
  } catch {
    return {
      id: 'forensics-demo-1',
      question: 'Why did vegetation decrease here?',
      location: `${location.name || 'Selected area'} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
      whatChanged: 'Detected vegetation decline in the central and north-east field cluster.',
      whenChanged: 'Change is strongest between the March and July observations in the available timeline.',
      detectedSummary: 'Detected: vegetation index dropped by ~18.9% and impervious cover increased in the main corridor.',
      supportedExplanation: 'Supported explanation: a combination of urban expansion and increased water stress likely reduced crop vigor around the monitored perimeter.',
      factors: [
        {
          type: 'Detected',
          label: 'Vegetation reduction',
          detail: 'Spectral response and temporal trend show a sustained NDVI decline across the target zone.',
        },
        {
          type: 'Supported explanation',
          label: 'Urban expansion',
          detail: 'Built-up structures and road densification are spatially aligned with the most affected cells.',
        },
        {
          type: 'Possible factor',
          label: 'Water stress / drainage pattern',
          detail: 'Predominant soil moisture and irrigation patterns may have amplified stress in the adjacent agricultural zone.',
        },
        {
          type: 'Insufficient evidence',
          label: 'Policy or crop management change',
          detail: 'No field registry or administrative records are available to confirm the cause at this stage.',
        },
      ],
      evidence: [
        'Sentinel-2 time series shows a broad decrease in green reflectance in the target polygon.',
        'SAR backscatter reveals a denser built-up perimeter and new hard-surface coverage.',
        'Nearby roads and settlement patterns indicate a stronger urban footprint around the affected area.',
        'Weather and moisture data were not available for a full causal confirmation, so this remains a supported explanation rather than a confirmed causation.',
      ],
      confidence: 0.84,
      reliability: 'MEDIUM',
      source: 'DEMO DATA • satellite trend analysis + local context',
      date: '2024-08-17',
    }
  }
}

export const buildEvidenceChain = async (location: Location): Promise<EvidenceItem[]> => {
  try {
    return await getCopernicusEvidence(location)
  } catch {
    return [
      {
        id: 'evidence-1',
        satelliteDate: '2024-08-17',
        source: 'DEMO DATA · Copernicus Data Space',
        imagePreview: '/images/demo-sentinel-2.jpg',
        regionLabel: 'North-east agricultural cluster',
        coordinates: `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
        band: 'NDVI / SWIR',
        changeValue: 18.9,
        evidenceType: 'Detected change',
        confidence: 0.89,
        regionId: 'region-a',
        dataSource: 'Sentinel-2',
      },
      {
        id: 'evidence-2',
        satelliteDate: '2024-03-09',
        source: 'DEMO DATA · Sentinel-1',
        imagePreview: '/images/demo-sar.jpg',
        regionLabel: 'Urban fringe',
        coordinates: `${(location.lat + 0.01).toFixed(4)}, ${(location.lng + 0.02).toFixed(4)}`,
        band: 'VV/VH',
        changeValue: 12.4,
        evidenceType: 'Surface change',
        confidence: 0.81,
        regionId: 'region-b',
        dataSource: 'Sentinel-1 SAR',
      },
      {
        id: 'evidence-3',
        satelliteDate: '2024-08-17',
        source: 'DEMO DATA · weather adapter',
        imagePreview: '/images/demo-weather.jpg',
        regionLabel: 'Moisture stress area',
        coordinates: `${(location.lat + 0.008).toFixed(4)}, ${(location.lng - 0.011).toFixed(4)}`,
        band: 'Weather / soil moisture proxy',
        changeValue: 9.7,
        evidenceType: 'Environmental support',
        confidence: 0.72,
        regionId: 'region-c',
        dataSource: 'Weather station proxy',
      },
    ]
  }
}

export const buildScenario = async (location: Location, changePercent: number, scenarioType: string, radius: number): Promise<Scenario> => {
  try {
    return await getCopernicusScenario(location, changePercent, radius)
  } catch {
    return {
      id: 'scenario-demo-1',
      title: 'SIMULATION / SCENARIO',
      mode: scenarioType,
      percentage: changePercent,
      radius,
      affectedArea: Number(((changePercent / 100) * 3.4).toFixed(2)),
      confidence: 0.77,
      summary: 'This simulation estimates likely spatial impacts if the selected urban and agricultural zone changes by the requested percent. It is a scenario model only, not a forecast of actual future conditions.',
      currentVsScenario: {
        current: 100,
        simulated: 100 + changePercent,
      },
      impactedRegions: [
        'Settlement fringe',
        'Adjacent agricultural patch',
        'Water-stressed corridor',
      ],
      source: 'DEMO DATA · scenario model',
      location: `${location.name || 'Selected area'} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
    }
  }
}

export const buildVoiceQueries = (): VoiceQuery[] => [
  {
    id: 'voice-1',
    question: 'What changed here?',
    answer: 'Detected: vegetation changed by approximately 18.9% in the target zone, with urban expansion around the western edge.',
    timestamp: new Date().toISOString(),
    context: 'time-machine',
  },
  {
    id: 'voice-2',
    question: 'Why did it happen?',
    answer: 'Supported explanation: urban expansion and water stress are the leading contributors, while the exact cause remains partially uncertain without field records.',
    timestamp: new Date().toISOString(),
    context: 'forensics',
  },
]

export const buildReport = (location: Location, changeDetection: ChangeDetection, forensic: ForensicAnalysis, scenario: Scenario): string => {
  const timestamp = new Date().toISOString()
  return `EARTH INTELLIGENCE REPORT
Location: ${location.name || 'Selected area'} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})
Timestamp: ${timestamp}

Summary:
- ${changeDetection.description}
- ${forensic.detectedSummary}
- ${scenario.summary}

Data sources:
- Copernicus Data Space: DEMO DATA for historical comparison
- SAR / weather adapter: DEMO DATA for scenario context

Confidence: ${Math.round((changeDetection.confidence + forensic.confidence + scenario.confidence) / 3 * 100)}%

This report is for decision support only and should be validated with up-to-date operational sources.`
}
