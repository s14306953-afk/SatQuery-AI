import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Compass,
  Gauge,
  Radar,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
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

export function EarthIntelligenceWorkspace({ location }: EarthIntelligenceWorkspaceProps) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [satelliteImages, setSatelliteImages] = useState<any[]>([])
  const [changeDetection, setChangeDetection] = useState<any>(null)
  const [forensic, setForensic] = useState<any>(null)

  useEffect(() => {
    if (!location) {
      setSatelliteImages([])
      setChangeDetection(null)
      setForensic(null)
      setScenario(null)
      return
    }

    let active = true

    const loadAnalysis = async () => {
      const [images, detection, analysis, nextScenario] = await Promise.all([
        buildSatelliteImages(location),
        buildChangeDetection(location),
        buildForensicAnalysis(location),
        buildScenario(location),
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
  }, [location])

  if (!location) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Select a location to search for satellite observations.</div>
  }

  const reportText = changeDetection && forensic && scenario
    ? buildReport(location, changeDetection, forensic, scenario)
    : null

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.26em] text-amber-700">
              <Radar size={14} /> Earth Intelligence Workspace
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{location.name}</h2>
          </div>
        </div>

        {changeDetection ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Detected change', value: `${changeDetection.percentage.toFixed(1)}%`, icon: Activity },
              { label: 'Area affected', value: `${changeDetection.area.toFixed(2)} ${changeDetection.areaUnit}`, icon: Gauge },
              { label: 'Confidence', value: `${Math.round(changeDetection.confidence * 100)}%`, icon: ShieldCheck },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <Icon size={12} /> {label}
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No verified change analysis is available for this location.</p>
        )}
      </div>

      <motion.section id="forensics" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-700">
          <BrainCircuit size={14} /> Satellite Forensics
        </div>

        {forensic ? <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-lg font-semibold text-slate-900">{forensic.question}</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{forensic.supportedExplanation}</p>

            <div className="mt-4 space-y-3">
              {forensic.factors.map((factor: { type: string; label: string; detail: string }) => (
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
              {forensic.evidence.map((item: string) => (
                <div key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <ArrowRight size={16} className="mt-0.5 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div> : <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Forensic findings require verified imagery and an analysis result. None is available for this location yet.</p>}
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-sky-700">
            <Radar size={14} /> Imagery & sources
          </div>
          <div className="space-y-3">
            {!satelliteImages.length && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No satellite products were returned for this location.</p>}
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
            {reportText ? reportText.split('\n').map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            )) : 'No report is available because verified change, forensic, and scenario results were not returned.'}
          </div>
        </div>
      </div>
    </div>
  )
}
