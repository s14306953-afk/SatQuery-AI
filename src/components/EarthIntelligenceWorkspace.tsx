import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Compass,
  Gauge,
  Radar,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  buildChangeDetection,
  buildForensicAnalysis,
  buildScenario,
  buildSatelliteImages,
  buildReport,
} from '../services/earthIntelligenceService'
import type { Location, Scenario } from '../types'

interface EarthIntelligenceWorkspaceProps {
  location: Location | null
}

const defaultLocation: Location = { id: 'default-location', name: 'Bengaluru Urban Fringe', lat: 12.9716, lng: 77.5946, radius: 2500 }

export function EarthIntelligenceWorkspace({ location }: EarthIntelligenceWorkspaceProps) {
  const activeLocation = location ?? defaultLocation
  const [scenario, setScenario] = useState<Scenario>({
    id: 'loading-scenario',
    title: 'Loading scenario',
    mode: 'urban-expansion',
    percentage: 20,
    radius: 800,
    affectedArea: 0,
    confidence: 0,
    summary: 'Loading Copernicus analysis…',
    currentVsScenario: { current: 100, simulated: 100 },
    impactedRegions: [],
    source: 'Copernicus Data Space',
    location: activeLocation.name,
  })
  const [satelliteImages, setSatelliteImages] = useState<any[]>([])
  const [changeDetection, setChangeDetection] = useState<any>(null)
  const [forensic, setForensic] = useState<any>(null)

  useEffect(() => {
    let active = true

    const loadAnalysis = async () => {
      const [images, detection, analysis, nextScenario] = await Promise.all([
        buildSatelliteImages(activeLocation),
        buildChangeDetection(activeLocation),
        buildForensicAnalysis(activeLocation),
        buildScenario(activeLocation, 20, 'urban-expansion', 800),
      ])

      if (!active) return

      setSatelliteImages(images)
      setChangeDetection(detection)
      setForensic(analysis)
      setScenario(nextScenario)
    }

    void loadAnalysis()

    return () => {
      active = false
    }
  }, [activeLocation])

  const resolvedChangeDetection = changeDetection ?? {
    id: 'loading-change',
    location: activeLocation.name,
    dateRange: 'Loading…',
    changeType: 'Loading',
    percentage: 0,
    area: 0,
    areaUnit: 'km²',
    alertLevel: '—',
    description: 'Loading the latest Copernicus analysis…',
    source: 'Copernicus Data Space',
    confidence: 0,
  }

  const resolvedForensic = forensic ?? {
    id: 'loading-forensic',
    question: 'Why did vegetation decrease here?',
    location: activeLocation.name,
    whatChanged: 'Loading analysis…',
    whenChanged: 'Loading analysis…',
    detectedSummary: 'Loading analysis…',
    supportedExplanation: 'Loading analysis…',
    factors: [],
    evidence: ['Loading analysis…'],
    confidence: 0,
    reliability: 'MEDIUM',
    source: 'Copernicus Data Space',
    date: new Date().toISOString(),
  }

  const reportText = useMemo(
    () => buildReport(activeLocation, resolvedChangeDetection, resolvedForensic, scenario),
    [activeLocation, resolvedChangeDetection, resolvedForensic, scenario],
  )

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.26em] text-violet-600">
              <Sparkles size={14} /> Earth Intelligence Workspace
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{activeLocation.name}</h2>
          </div>
          <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-violet-700">
            Demo data
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Detected change', value: `${resolvedChangeDetection.percentage.toFixed(1)}%`, icon: Activity },
            { label: 'Area affected', value: `${resolvedChangeDetection.area.toFixed(2)} km²`, icon: Gauge },
            { label: 'Confidence', value: `${Math.round(resolvedChangeDetection.confidence * 100)}%`, icon: ShieldCheck },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <Icon size={12} /> {label}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <motion.section id="forensics" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-700">
          <BrainCircuit size={14} /> Satellite Forensics
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-lg font-semibold text-slate-900">Why did vegetation decrease here?</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{resolvedForensic.supportedExplanation}</p>

            <div className="mt-4 space-y-3">
              {resolvedForensic.factors.map((factor: { type: string; label: string; detail: string }) => (
                <div key={factor.label} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{factor.type}</div>
                    <div className={`rounded-full px-2 py-1 text-[10px] font-medium ${factor.type === 'Detected' ? 'bg-emerald-100 text-emerald-700' : factor.type === 'Supported explanation' ? 'bg-sky-100 text-sky-700' : factor.type === 'Possible factor' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {factor.type}
                    </div>
                  </div>
                  <div className="mt-2 font-medium text-slate-900">{factor.label}</div>
                  <div className="mt-1 text-sm text-slate-600">{factor.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Evidence overview</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {resolvedForensic.evidence.map((item: string) => (
                <div key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <ArrowRight size={16} className="mt-0.5 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-sky-700">
            <Radar size={14} /> Imagery & sources
          </div>
          <div className="space-y-3">
            {satelliteImages.map((image) => (
              <div key={image.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{image.mission}</div>
                    <div className="text-xs text-slate-500">{image.sensor} · {image.band}</div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-600">{image.modality}</div>
                </div>
                <div className="mt-2 text-xs text-slate-500">Date: {image.date} · Source: {image.source}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-rose-700">
            <Compass size={14} /> AI report
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {reportText.split('\n').map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
