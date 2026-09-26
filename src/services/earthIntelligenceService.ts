import type {
  ChangeDetection,
  EvidenceItem,
  ForensicAnalysis,
  Location,
  Scenario,
  SatelliteImage,
  TimeSeries,
} from '../types'
import {
  getCopernicusChangeDetection,
  getCopernicusEvidence,
  getCopernicusForensicAnalysis,
  getCopernicusScenario,
  getCopernicusTimeSeries,
} from './providers/copernicusService'

// Provider adapters return only observed catalogue metadata and verified analysis results.

export const buildTimeSeries = async (location: Location): Promise<TimeSeries[]> => {
  try {
    return await getCopernicusTimeSeries(location)
  } catch {
    return []
  }
}

export const buildSatelliteImages = async (location: Location): Promise<SatelliteImage[]> => {
  try {
    const observations = await getCopernicusTimeSeries(location)
    return observations.map((observation) => ({
      id: observation.id,
      source: observation.source,
      mission: observation.sensor,
      sensor: observation.sensor,
      date: observation.date,
      modality: /sentinel-1|sar/i.test(`${observation.sensor} ${observation.band}`) ? 'sar' : 'multispectral',
      band: observation.band,
    }))
  } catch {
    return []
  }
}

export const buildChangeDetection = async (location: Location): Promise<ChangeDetection | null> => {
  try {
    return await getCopernicusChangeDetection(location)
  } catch {
    return null
  }
}

export const buildForensicAnalysis = async (location: Location): Promise<ForensicAnalysis | null> => {
  try {
    return await getCopernicusForensicAnalysis(location)
  } catch {
    return null
  }
}

export const buildEvidenceChain = async (location: Location): Promise<EvidenceItem[]> => {
  try {
    return await getCopernicusEvidence(location)
  } catch {
    return []
  }
}

export const buildScenario = async (location: Location): Promise<Scenario | null> => {
  try {
    return await getCopernicusScenario(location)
  } catch {
    return null
  }
}

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
- Change analysis: ${changeDetection.source}
- Forensic analysis: ${forensic.source}
- Scenario: ${scenario.source}

Confidence: ${Math.round((changeDetection.confidence + forensic.confidence + scenario.confidence) / 3 * 100)}%

This report is for decision support only and should be validated with up-to-date operational sources.`
}
