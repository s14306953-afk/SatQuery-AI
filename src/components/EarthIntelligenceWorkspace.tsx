import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  CirclePlay,
  Compass,
  Gauge,
  Mic,
  Pause,
  Radar,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UserRound,
  Wand2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  buildChangeDetection,
  buildEvidenceChain,
  buildForensicAnalysis,
  buildScenario,
  buildSatelliteImages,
  buildTimeSeries,
  buildVoiceQueries,
  buildReport,
} from '../services/earthIntelligenceService'
import type { Location, Scenario, VoiceQuery } from '../types'

interface EarthIntelligenceWorkspaceProps {
  location: Location | null
}

const defaultLocation: Location = { id: 'default-location', name: 'Bengaluru Urban Fringe', lat: 12.9716, lng: 77.5946, radius: 2500 }

export function EarthIntelligenceWorkspace({ location }: EarthIntelligenceWorkspaceProps) {
  const activeLocation = location ?? defaultLocation
  const [timelineIndex, setTimelineIndex] = useState(2)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedScenarioType, setSelectedScenarioType] = useState('urban-expansion')
  const [changePercent, setChangePercent] = useState(20)
  const [impactRadius, setImpactRadius] = useState(800)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('evidence-1')
  const [voiceInput, setVoiceInput] = useState('What changed here?')
  const [voiceHistory, setVoiceHistory] = useState<VoiceQuery[]>(() => buildVoiceQueries())
  const [scenario, setScenario] = useState<Scenario>(() => buildScenario(activeLocation, changePercent, selectedScenarioType, impactRadius))

  const timeSeries = useMemo(() => buildTimeSeries(activeLocation), [activeLocation])
  const satelliteImages = useMemo(() => buildSatelliteImages(activeLocation), [activeLocation])
  const changeDetection = useMemo(() => buildChangeDetection(activeLocation), [activeLocation])
  const forensic = useMemo(() => buildForensicAnalysis(activeLocation), [activeLocation])
  const evidenceChain = useMemo(() => buildEvidenceChain(activeLocation), [activeLocation])

  const currentScene = timeSeries[timelineIndex] ?? timeSeries[timeSeries.length - 1]

  const handleScenarioRun = () => {
    setScenario(buildScenario(activeLocation, changePercent, selectedScenarioType, impactRadius))
  }

  const handleVoiceSubmit = () => {
    const question = voiceInput.trim()
    if (!question) return

    const answer = question.toLowerCase().includes('why')
      ? 'Supported explanation: urban expansion and local water stress are the leading contributors. The exact cause remains a supported interpretation until field records or additional operational data are added.'
      : question.toLowerCase().includes('how much') || question.toLowerCase().includes('area')
        ? `Approximately ${changeDetection.area.toFixed(2)} km² of the monitored footprint shows measurable change.`
        : question.toLowerCase().includes('compare') || question.toLowerCase().includes('last year')
          ? 'The selected time series shows a clear before/after trend: vegetation declined while the built-up footprint increased across the monitored dates.'
          : 'Detected: vegetation loss and expansion are visible in the target area, and the evidence chain shows multiple supporting signals.'

    setVoiceHistory((current) => [
      { id: crypto.randomUUID(), question, answer, timestamp: new Date().toISOString(), context: 'live-query' },
      ...current,
    ])
  }

  const handleSpeechCapture = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. The text query still works.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event: any) => {
      const transcript = String(event.results[0][0].transcript || '').trim()
      if (transcript) {
        setVoiceInput(transcript)
        setVoiceHistory((current) => [
          { id: crypto.randomUUID(), question: transcript, answer: 'Voice input captured. The workspace is using the selected site context and the current time series to answer the question.', timestamp: new Date().toISOString(), context: 'voice' },
          ...current,
        ])
      }
    }
    recognition.start()
  }

  const reportText = useMemo(
    () => buildReport(activeLocation, changeDetection, forensic, scenario),
    [activeLocation, changeDetection, forensic, scenario],
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
            { label: 'Detected change', value: `${changeDetection.percentage.toFixed(1)}%`, icon: Activity },
            { label: 'Area affected', value: `${changeDetection.area.toFixed(2)} km²`, icon: Gauge },
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
      </div>

      <motion.section id="time-machine" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-violet-600">
            <CalendarClock size={14} /> Time Machine
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIsPlaying((current) => !current)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700">
              {isPlaying ? <span className="inline-flex items-center gap-2"><Pause size={14} /> Pause</span> : <span className="inline-flex items-center gap-2"><CirclePlay size={14} /> Play</span>}
            </button>
            <button type="button" onClick={() => setTimelineIndex(0)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              <span className="inline-flex items-center gap-2"><TimerReset size={14} /> Reset</span>
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between text-sm text-slate-600">
              <span>Historical comparison</span>
              <span className="font-medium text-violet-600">{currentScene.acquisition}</span>
            </div>

            <div className="mb-4 h-52 overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_30%_15%,rgba(16,185,129,0.2),transparent_25%),radial-gradient(circle_at_70%_60%,rgba(59,130,246,0.18),transparent_20%),linear-gradient(135deg,#0f172a,#111827)] p-4">
              <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/40">
                <div className="absolute inset-3 rounded-xl border border-dashed border-violet-300/70" />
                <div className="absolute left-6 top-8 h-16 w-16 rounded-full bg-emerald-400/80 blur-md" />
                <div className="absolute bottom-7 right-12 h-20 w-20 rounded-full bg-sky-400/80 blur-md" />
                <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/5" />
                <div className="absolute left-10 top-10 h-16 w-24 rounded-xl border border-amber-200/70 bg-amber-200/20" />
                <div className="absolute bottom-10 right-16 h-16 w-20 rounded-xl border border-violet-200/70 bg-violet-200/10" />
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={timeSeries.length - 1}
              step={1}
              value={timelineIndex}
              onChange={(event) => setTimelineIndex(Number(event.target.value))}
              className="w-full accent-violet-500"
            />

            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {timeSeries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTimelineIndex(timeSeries.indexOf(entry))}
                  className={`rounded-full px-2 py-1 ${timelineIndex === timeSeries.indexOf(entry) ? 'bg-violet-100 text-violet-700' : 'text-slate-500'}`}
                >
                  {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Current scene</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{currentScene.sensor}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{currentScene.summary}</p>
              <div className="mt-3 text-xs font-medium text-violet-700">{currentScene.source}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">AI summary</div>
              <div className="mt-3 text-lg font-semibold text-slate-900">Vegetation decreased significantly between March and July.</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Detected change regions are highlighted in the scene and can be compared with neighboring dates automatically.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section id="forensics" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-700">
          <BrainCircuit size={14} /> Satellite Forensics
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-lg font-semibold text-slate-900">Why did vegetation decrease here?</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{forensic.supportedExplanation}</p>

            <div className="mt-4 space-y-3">
              {forensic.factors.map((factor) => (
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
              {forensic.evidence.map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <ArrowRight size={16} className="mt-0.5 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section id="talk-to-earth" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-700">
            <Mic size={14} /> Talk to the Earth
          </div>
          <button type="button" onClick={handleSpeechCapture} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-700">
            Use voice input
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Ask a question</label>
            <textarea value={voiceInput} onChange={(event) => setVoiceInput(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none ring-0 focus:border-cyan-300" />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={handleVoiceSubmit} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Ask</button>
              <button type="button" onClick={() => setVoiceInput('How much area changed?')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">How much area changed?</button>
              <button type="button" onClick={() => setVoiceInput('Why did it happen?')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">Why did it happen?</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Conversation memory</div>
            <div className="mt-4 space-y-3">
              {voiceHistory.slice(0, 3).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-700"><UserRound size={12} /> {entry.context}</div>
                  <div className="text-sm font-medium text-slate-900">{entry.question}</div>
                  <div className="mt-1 text-sm text-slate-600">{entry.answer}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-2">
        <motion.section id="evidence-chain" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-700">
            <ScanSearch size={14} /> AI Evidence Chain
          </div>

          <div className="space-y-3">
            {evidenceChain.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedEvidenceId(item.id)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${selectedEvidenceId === item.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
              >
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Evidence {index + 1}</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{item.regionLabel}</div>
                  <div className="mt-1 text-sm text-slate-600">{item.dataSource} · {item.satelliteDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-amber-700">{item.evidenceType}</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{item.changeValue.toFixed(1)}%</div>
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section id="what-if-simulator" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-pink-700">
            <Wand2 size={14} /> What-If Simulator
          </div>

          <div className="space-y-4">
            <label className="block text-sm text-slate-700">
              Scenario type
              <select value={selectedScenarioType} onChange={(event) => setSelectedScenarioType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                <option value="urban-expansion">Urban expansion</option>
                <option value="vegetation-loss">Forest / vegetation loss</option>
                <option value="water-loss">Waterbody reduction</option>
              </select>
            </label>

            <div>
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span>Percentage change</span>
                <span className="font-semibold text-pink-700">{changePercent}%</span>
              </div>
              <input type="range" min={5} max={50} value={changePercent} onChange={(event) => setChangePercent(Number(event.target.value))} className="mt-2 w-full accent-pink-500" />
            </div>

            <div>
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span>Impact radius</span>
                <span className="font-semibold text-slate-900">{impactRadius} m</span>
              </div>
              <input type="range" min={200} max={2000} step={100} value={impactRadius} onChange={(event) => setImpactRadius(Number(event.target.value))} className="mt-2 w-full accent-pink-500" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={handleScenarioRun} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Run simulation</button>
              <button type="button" onClick={() => { setChangePercent(20); setImpactRadius(800); setSelectedScenarioType('urban-expansion'); setScenario(buildScenario(activeLocation, 20, 'urban-expansion', 800)) }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">Reset</button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Scenario result</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{scenario.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{scenario.summary}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Affected area</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{scenario.affectedArea.toFixed(2)} km²</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Confidence</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{Math.round(scenario.confidence * 100)}%</div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

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
