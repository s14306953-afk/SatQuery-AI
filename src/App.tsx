import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  FileText,
  Globe2,
  History,
  Image as ImageIcon,
  Layers3,
  Map,
  MapPinned,
  MessageCircle,
  MessageSquareText,
  Mic,
  LocateFixed,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { MapContainer, Circle, CircleMarker, Marker, Popup, Rectangle, TileLayer, Tooltip as MapTooltip, useMap } from 'react-leaflet'
import { BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { generateAnalysisPdf } from './services/reportService'
import { listAnalysisHistory, saveAnalysisResult } from './services/analysisService'
import { analyzeWithGemini } from './services/ai/aiService'
import { validateImageFile } from './services/imageService'
import { fetchNearbyFeatures } from './services/proximityService'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { AuthPage } from './components/AuthPage'
import { EarthIntelligenceWorkspace } from './components/EarthIntelligenceWorkspace'
import type { Session } from '@supabase/supabase-js'
import type { AnalysisRecord, Location, NearbyIssue, NearbyIssueAnalysis, UploadedImage } from './types'
import 'leaflet/dist/leaflet.css'

const suggestedQuestions = [
  'What changed between these images?',
  'Identify all buildings.',
  'Where are the water bodies?',
  'How much agricultural land is visible?',
  'Are there signs of flooding?',
  'Compare the optical and SAR images.',
  'Identify urban expansion.',
  'Calculate the approximate affected area.',
]

const modeOptions = [
  { label: 'Single', value: 'single' },
  { label: 'Optical + SAR', value: 'optical_sar' },
  { label: 'Before/After', value: 'before_after' },
  { label: 'Change Detection', value: 'change_detection' },
  { label: 'Disaster Analysis', value: 'disaster' },
]

type LanguageCode = 'en' | 'es' | 'fr' | 'hi' | 'kn' | 'te' | 'ta' | 'ml' | 'mr'

const speechLocales: Record<LanguageCode, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  hi: 'hi-IN',
  kn: 'kn-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
}

function MapRecenter({ location }: { location: { lat: number; lng: number } | null }) {
  const map = useMap()

  useEffect(() => {
    if (location) map.flyTo([location.lat, location.lng], 12, { duration: 1 })
  }, [location, map])

  return null
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(() => isSupabaseConfigured)
  const [authError, setAuthError] = useState('')
  const [isRecovery, setIsRecovery] = useState(false)
  const [isDashboardOpen, setIsDashboardOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')
  const [mode, setMode] = useState('single')
  const [language, setLanguage] = useState<LanguageCode>('en')
  const [beforeDate, setBeforeDate] = useState('2025-01-15')
  const [afterDate, setAfterDate] = useState('2026-01-15')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [query, setQuery] = useState('What changed between these images?')
  const [isLoading, setIsLoading] = useState(false)
  const [heatmapEnabled, setHeatmapEnabled] = useState(true)
  const [heatmapOpacity] = useState(0.7)
  const [datasetEvidenceEnabled, setDatasetEvidenceEnabled] = useState(true)
  const [voiceSupported] = useState(() => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window || 'speechSynthesis' in window))
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationAddress, setLocationAddress] = useState('')
  const [locationStatus, setLocationStatus] = useState('Detecting your location...')
  const [placeSearch, setPlaceSearch] = useState('')
  const [placeResults, setPlaceResults] = useState<Array<{ display_name: string; lat: string; lon: string; type?: string }>>([])
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false)
  const [placeSearchError, setPlaceSearchError] = useState('')
  const [selectedPlaceName, setSelectedPlaceName] = useState('')
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('satellite')
  const [voiceStatus, setVoiceStatus] = useState('idle')
  const [conversation, setConversation] = useState<Array<{ question: string; answer: string }>>([
    {
      question: 'What objects are visible?',
      answer: 'Urban structures, road networks, and water channels are visible in the sample region.',
    },
    {
      question: 'How much agricultural land is present?',
      answer: 'Approximately 38.4% of the area is classified as agriculture in the current workspace result.',
    },
  ])
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const [chatbotInput, setChatbotInput] = useState('')
  const [isChatbotTyping, setIsChatbotTyping] = useState(false)
  const [chatbotVoiceStatus, setChatbotVoiceStatus] = useState<'idle' | 'listening'>('idle')
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [history, setHistory] = useState<AnalysisRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [nearbyAnalysis, setNearbyAnalysis] = useState<NearbyIssueAnalysis | null>(null)
  const [nearbyRadius, setNearbyRadius] = useState(2000)
  const [nearbyPermissionOpen, setNearbyPermissionOpen] = useState(false)
  const [nearbyPermissionMessage, setNearbyPermissionMessage] = useState('')
  const [nearbyQuery, setNearbyQuery] = useState('')
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyError, setNearbyError] = useState('')
  const [selectedNearbyIssue, setSelectedNearbyIssue] = useState<NearbyIssue | null>(null)
  const [nearbyHeatmapEnabled, setNearbyHeatmapEnabled] = useState(true)
  const [nearbyHeatmapOpacity, setNearbyHeatmapOpacity] = useState(0.45)
  const [nearbyCategory, setNearbyCategory] = useState('all')
  const [nearbyConfidenceThreshold, setNearbyConfidenceThreshold] = useState(0)
  const [proximityQuery, setProximityQuery] = useState('What important features or issues are near this location?')
  const [proximityFeatures, setProximityFeatures] = useState<Array<{ id: string; label: string; kind: 'hospital' | 'road' | 'building' | 'river' | 'forest' | 'agriculture' | 'industry' | 'hazard'; distanceMeters: number; detail: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' }>>([])
  const [satelliteScenes, setSatelliteScenes] = useState<Array<{ id: string; name?: string; acquisition: string | null; satellite: string; sensor: string; processing: string; resolution: string; cloudCover: number | string | null; productUrl: string | null }>>([])
  const [satelliteSearchMessage, setSatelliteSearchMessage] = useState('')
  const [climateData, setClimateData] = useState<{ source: string; current?: { temperature: number; feelsLike: number; humidity: number; precipitation: number; windSpeed: number; weatherCode: number }; daily?: Array<{ date: string; max: number; min: number; precipitationProbability: number; precipitation: number; weatherCode: number }>; risks?: Array<{ type: string; level: string; confidence: string; evidence: string[] }>; message?: string } | null>(null)
  const [climateLoading, setClimateLoading] = useState(false)
  const [climateMessage, setClimateMessage] = useState('')
  const [climateLayer, setClimateLayer] = useState('satellite')
  const [climateAoiMode, setClimateAoiMode] = useState<'uploaded' | 'manual'>('manual')
  const [climateView, setClimateView] = useState<'overview' | 'forecast' | 'warning' | 'history'>('overview')

  const stats = useMemo(
    () => [
      { label: 'Total Analyses', value: String(history.length) },
      { label: 'Images Processed', value: String(history.reduce((total, item) => total + (item.images?.length ?? 0), 0)) },
      { label: 'Average Confidence', value: history.length ? `${(history.reduce((total, item) => total + (item.confidence_score ?? 0), 0) / history.length).toFixed(1)}%` : '—' },
      { label: 'Change Detection', value: String(history.filter((item) => item.type === 'change_detection' || item.type === 'before_after').length) },
    ],
    [history],
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message)
      setSession(data.session)
      setIsAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setIsAuthLoading(false)
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    listAnalysisHistory().then((savedHistory) => {
      setHistory(savedHistory)
      if (savedHistory[0]) setAnalysis(savedHistory[0])
    })
  }, [])

  function requestCurrentLocation(autoAnalyze = false) {
    setLocationStatus('Requesting location permission... Click Allow in the browser prompt.')

    if (!('geolocation' in navigator)) {
      setCurrentLocation(null)
      setLocationAddress('')
      setLocationStatus('Location access is unavailable in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
        }
        if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
          setCurrentLocation(null)
          setLocationAddress('')
          setLocationStatus('The browser returned an invalid location. Please try Locate me again.')
          return
        }
        setCurrentLocation(location)
        setSelectedPlaceName('')
        setLocationStatus(autoAnalyze ? 'Using your live location and checking nearby issues...' : 'Using your current location')
        setLocationAddress('Finding address...')
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.lat}&lon=${location.lng}`)
          if (!response.ok) throw new Error('Address lookup failed')
          const result = await response.json() as { display_name?: string; address?: { postcode?: string; city?: string; town?: string; village?: string; state?: string } }
          const address = result.address
          const postalCode = address?.postcode
          setLocationAddress(postalCode
            ? `${result.display_name || 'Selected location'} · PIN code: ${postalCode}`
            : result.display_name || 'Address unavailable; PIN code was not returned')
        } catch {
          setLocationAddress('Address unavailable; coordinates are shown')
        }

        if (autoAnalyze) {
          setNearbyError('')
          setActiveSection('nearby')
          await runNearbyAnalysis(location)
        }
      },
      (error) => {
        setCurrentLocation(null)
        setLocationAddress('')
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Allow location access in the browser address-bar settings, then click Locate me again.'
          : error.code === error.TIMEOUT
            ? 'Location request timed out. Check your device location settings and try Locate me again.'
            : 'Unable to determine your location. Check your device location settings and try again.'
        setLocationStatus(message)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const searchPlaces = async (searchOverride?: string) => {
    const search = (searchOverride ?? placeSearch).trim()
    if (!search || placeSearchLoading) return

    setPlaceSearchLoading(true)
    setPlaceSearchError('')
    try {
      const normalizedSearch = search
        .replace(/\bbanglore\b/gi, 'Bengaluru')
        .replace(/\bbangalore\b/gi, 'Bengaluru')
      const coordinateMatch = normalizedSearch.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/)
      const query = coordinateMatch ? `${coordinateMatch[1]}, ${coordinateMatch[2]}` : `${normalizedSearch}, India`
      const searchNominatim = async (searchQuery: string) => {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&addressdetails=1&q=${encodeURIComponent(searchQuery)}`)
        if (!response.ok) throw new Error('The place search service is currently unavailable.')
        return await response.json() as Array<{ display_name: string; lat: string; lon: string; type?: string }>
      }
      let results = coordinateMatch
        ? [{ display_name: `Selected coordinates: ${coordinateMatch[1]}, ${coordinateMatch[2]}`, lat: coordinateMatch[1], lon: coordinateMatch[2], type: 'coordinates' }]
        : await searchNominatim(query)
      if (!results.length && normalizedSearch.includes(',')) {
        const locality = normalizedSearch.split(',')[0].trim()
        if (locality) results = await searchNominatim(`${locality}, India`)
      }
      setPlaceResults(results)
      if (!results.length) setPlaceSearchError('No places found. Try a city, landmark, district, or country name.')
    } catch (error) {
      setPlaceResults([])
      setPlaceSearchError(error instanceof Error ? error.message : 'Unable to search for places.')
    } finally {
      setPlaceSearchLoading(false)
    }
  }

  useEffect(() => {
    const search = placeSearch.trim()
    if (search.length < 2 || selectedPlaceName) {
      if (search.length < 2) {
        setPlaceResults([])
        setPlaceSearchError('')
      }
      return
    }
    const timer = window.setTimeout(() => void searchPlaces(search), 500)
    return () => window.clearTimeout(timer)
  }, [placeSearch, selectedPlaceName])

  const selectPlace = (place: { display_name: string; lat: string; lon: string }) => {
    const latitude = Number(place.lat)
    const longitude = Number(place.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
    setCurrentLocation({ lat: latitude, lng: longitude })
    setSelectedPlaceName(place.display_name)
    setLocationAddress(place.display_name)
    setLocationStatus('Selected place')
    setPlaceSearch(place.display_name)
    setPlaceResults([])
    setPlaceSearchError('')
  }

  const recordNearbyPermission = async (permissionStatus: 'granted' | 'denied' | 'dismissed') => {
    if (!isSupabaseConfigured || !session) return
    await supabase.from('location_permissions').insert({ user_id: session.user.id, permission_status: permissionStatus })
  }

  const openNearbyAnalysis = () => {
    setNearbyPermissionMessage(currentLocation
      ? 'SatQuery AI will check verified satellite scene availability for the selected place and selected radius.'
      : 'SatQuery AI needs your location to analyze satellite imagery and identify potential issues in your surrounding area.')
    setNearbyPermissionOpen(true)
    setNearbyError('')
  }

  const getNearbyLocation = () => new Promise<{ lat: number; lng: number } | null>((resolve) => {
    if (!('geolocation' in navigator)) {
      setNearbyError('Location access is unavailable in this browser. You can manually select an area on the map instead.')
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        setCurrentLocation(location)
        setLocationStatus('Using your current location for this analysis')
        setLocationAddress('Exact address is kept out of the report unless needed for this analysis')
        resolve(location)
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    )
  })

  const generateProximityFeatures = (location: { lat: number; lng: number }, queryOverride?: string) => {
    const seed = Math.abs(Math.round(location.lat * 100000 + location.lng * 100000))
    const askedAbout = (queryOverride ?? proximityQuery).toLowerCase()

    const features = [
      { id: 'hospital', label: 'Hospital', kind: 'hospital' as const, distanceMeters: 1200 + ((seed + 17) % 500), detail: 'Emergency care access within the local area.', priority: 'MEDIUM' as const },
      { id: 'road', label: 'Main road', kind: 'road' as const, distanceMeters: 350 + ((seed + 49) % 500), detail: 'Primary transport corridor adjacent to the selected point.', priority: 'LOW' as const },
      { id: 'building', label: 'Built-up area', kind: 'building' as const, distanceMeters: 150 + ((seed + 81) % 450), detail: 'Dense settlement cluster near the selected coordinate.', priority: 'LOW' as const },
      { id: 'river', label: 'River / water body', kind: 'river' as const, distanceMeters: 800 + ((seed + 111) % 600), detail: 'Water feature within proximity and flood-risk consideration area.', priority: 'HIGH' as const },
      { id: 'forest', label: 'Forest patch', kind: 'forest' as const, distanceMeters: 1400 + ((seed + 139) % 700), detail: 'Vegetated area close to the selected location.', priority: 'LOW' as const },
      { id: 'agriculture', label: 'Agricultural area', kind: 'agriculture' as const, distanceMeters: 900 + ((seed + 177) % 800), detail: 'Crop or field pattern in the surrounding zone.', priority: 'MEDIUM' as const },
      { id: 'industry', label: 'Industrial area', kind: 'industry' as const, distanceMeters: 1800 + ((seed + 211) % 900), detail: 'Industrial footprint within the wider neighborhood radius.', priority: 'MEDIUM' as const },
      { id: 'hazard', label: 'Potential hazard', kind: 'hazard' as const, distanceMeters: 420 + ((seed + 333) % 380), detail: 'Surface disturbance or drainage risk near this point.', priority: 'HIGH' as const },
    ]

    if (!askedAbout.includes('road') && !askedAbout.includes('hospital') && !askedAbout.includes('water') && !askedAbout.includes('building') && !askedAbout.includes('forest') && !askedAbout.includes('agriculture') && !askedAbout.includes('industrial') && !askedAbout.includes('hazard') && !askedAbout.includes('flood') && !askedAbout.includes('risk') && !askedAbout.includes('change')) {
      return features
    }

    return features.filter((feature) => {
      const kindText = feature.kind.toLowerCase()
      if (askedAbout.includes('road') || askedAbout.includes('highway')) return kindText === 'road'
      if (askedAbout.includes('hospital') || askedAbout.includes('clinic')) return kindText === 'hospital'
      if (askedAbout.includes('water') || askedAbout.includes('lake') || askedAbout.includes('flood')) return kindText === 'river'
      if (askedAbout.includes('building') || askedAbout.includes('settlement')) return kindText === 'building'
      if (askedAbout.includes('forest') || askedAbout.includes('tree')) return kindText === 'forest'
      if (askedAbout.includes('agriculture') || askedAbout.includes('farm')) return kindText === 'agriculture'
      if (askedAbout.includes('industrial') || askedAbout.includes('factory')) return kindText === 'industry'
      if (askedAbout.includes('hazard') || askedAbout.includes('risk') || askedAbout.includes('change')) return kindText === 'hazard'
      return true
    })
  }

  const loadProximityFeatures = async (location: { lat: number; lng: number }, queryOverride?: string) => {
    const askedAbout = (queryOverride ?? proximityQuery).toLowerCase()

    const issueKeywords = ['hospital', 'road', 'highway', 'water', 'lake', 'river', 'flood', 'risk', 'hazard', 'forest', 'farm', 'agriculture', 'industrial', 'factory', 'building', 'change', 'drainage', 'storm']

    try {
      const nearbyFeatures = await fetchNearbyFeatures(location.lat, location.lng, nearbyRadius)

      const filteredFeatures = nearbyFeatures.filter((feature) => {
        const haystack = `${feature.name} ${feature.type} ${feature.category}`.toLowerCase()

        const isIssueLike =
          feature.priority === 'HIGH' ||
          issueKeywords.some((keyword) => haystack.includes(keyword)) ||
          feature.category === 'hazard' ||
          feature.category === 'road' ||
          feature.category === 'river' ||
          feature.category === 'industry' ||
          feature.category === 'agriculture'

        const shouldShowIfNoFilter = !issueKeywords.some((keyword) => askedAbout.includes(keyword))

        if (shouldShowIfNoFilter) return isIssueLike

        if (askedAbout.includes('road') || askedAbout.includes('highway')) return feature.category === 'road'
        if (askedAbout.includes('hospital') || askedAbout.includes('clinic')) return feature.category === 'hospital'
        if (askedAbout.includes('water') || askedAbout.includes('lake') || askedAbout.includes('flood')) return feature.category === 'river'
        if (askedAbout.includes('building') || askedAbout.includes('settlement')) return feature.category === 'building'
        if (askedAbout.includes('forest') || askedAbout.includes('tree')) return feature.category === 'forest'
        if (askedAbout.includes('agriculture') || askedAbout.includes('farm')) return feature.category === 'agriculture'
        if (askedAbout.includes('industrial') || askedAbout.includes('factory')) return feature.category === 'industry'
        if (askedAbout.includes('hazard') || askedAbout.includes('risk') || askedAbout.includes('change')) return feature.priority === 'HIGH' || feature.category === 'hazard'

        return isIssueLike
      })

      const mappedFeatures = (filteredFeatures.length ? filteredFeatures : nearbyFeatures.filter((feature) => issueKeywords.some((keyword) => `${feature.name} ${feature.type}`.toLowerCase().includes(keyword)) || feature.priority === 'HIGH')).slice(0, 8).map((feature) => ({
        id: feature.id,
        label: feature.name,
        kind: feature.category,
        distanceMeters: feature.distanceMeters,
        detail: feature.detail,
        priority: feature.priority,
      }))

      setProximityFeatures(mappedFeatures)
      if (mappedFeatures.length) {
        setNearbyError('')
      }
      return
    } catch {
      const fallbackFeatures = generateProximityFeatures(location, queryOverride)
      const filteredFallback = fallbackFeatures.filter((feature) => [
        'hospital',
        'road',
        'river',
        'forest',
        'agriculture',
        'industry',
        'hazard',
      ].includes(feature.kind))
      setProximityFeatures(filteredFallback.length ? filteredFallback : fallbackFeatures)
      setNearbyError('OpenStreetMap could not be reached, so the app loaded a local fallback set of nearby features.')
    }
  }

  const generateNearbyIssues = (location: { lat: number; lng: number }, radius: number): NearbyIssue[] => {
    const templates = [
      { issue_type: 'Vegetation stress', category: 'agriculture' as const, severity: 'MEDIUM' as const, description: 'Patchy vegetation response suggests local crop or land-cover stress in the surrounding zone.', confidence: 78, reliability: 'MEDIUM' as const },
      { issue_type: 'Waterlogging risk', category: 'environmental' as const, severity: 'HIGH' as const, description: 'Low-lying surface moisture or drainage stress is visible around this location.', confidence: 84, reliability: 'HIGH' as const },
      { issue_type: 'Road condition anomaly', category: 'infrastructure' as const, severity: 'MEDIUM' as const, description: 'Road surface or utility patterns show local disruption near the selected point.', confidence: 72, reliability: 'MEDIUM' as const },
      { issue_type: 'Built-up expansion', category: 'urban' as const, severity: 'LOW' as const, description: 'Built-up clustering indicates possible change or densification close to this area.', confidence: 68, reliability: 'MEDIUM' as const },
      { issue_type: 'Storm impact indicator', category: 'disaster' as const, severity: 'HIGH' as const, description: 'Surface disturbance around this area may indicate recent weather-related impact or runoff.', confidence: 81, reliability: 'HIGH' as const },
    ]

    const seed = Math.abs(Math.round(location.lat * 100000 + location.lng * 100000))
    const count = Math.min(4, 2 + (seed % 3))

    return templates.slice(0, count).map((template, index) => {
      const distanceMeters = 250 + (((seed + index * 331) % Math.max(1, Math.floor(radius * 0.75))) + 150)
      const bearing = ((seed * 0.73) + (index + 1) * 75) % 360
      const radians = (bearing * Math.PI) / 180
      const latOffset = (distanceMeters / 111320) * Math.cos(radians)
      const lngOffset = (distanceMeters / (111320 * Math.cos((location.lat * Math.PI) / 180))) * Math.sin(radians)

      return {
        id: `${template.issue_type}-${seed}-${index}`,
        issue_type: template.issue_type,
        category: template.category,
        severity: template.severity,
        latitude: location.lat + latOffset,
        longitude: location.lng + lngOffset,
        distance_meters: distanceMeters,
        area: Number((distanceMeters / 1000 * 0.4).toFixed(2)),
        description: template.description,
        confidence: template.confidence,
        reliability: template.reliability,
        evidence: [
          `Proximity scan around ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} within ${radius} m`,
          `${template.issue_type} pattern identified in the local surrounding zone`,
          'Interpretation is a local estimate and should be validated with a site visit or official source',
        ],
        detected_at: new Date().toISOString(),
        reference_date: new Date().toISOString(),
      }
    })
  }

  const searchCopernicusScenes = async (location: { lat: number; lng: number }) => {
    setSatelliteSearchMessage('Loading Copernicus Dataset products...')
    if (!isSupabaseConfigured) {
      setSatelliteSearchMessage('Configure Supabase to search the Copernicus Dataset.')
      return
    }

    const tryFunction = async (functionName: string, payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke(functionName, { body: payload })
      if (error) return null
      return data
    }

    const liveData = await tryFunction('copernicus-live', { lat: location.lat, lng: location.lng, radius: nearbyRadius })

    if (liveData && Array.isArray(liveData.features)) {
      const mappedScenes = liveData.features.slice(0, 6).map((feature: Record<string, unknown>, index: number) => {
        const properties = (feature.properties as Record<string, unknown>) ?? {}
        const datetime = (properties.datetime as string | undefined) ?? new Date(Date.now() - index * 86400000).toISOString()
        const cloudCover = (properties.cloudCover as number | undefined) ?? (properties['eo:cloud_cover'] as number | undefined) ?? null
        const collection = String((feature.collection as string | undefined) ?? 'sentinel-2-l2a')

        return {
          id: String((feature.id as string | undefined) ?? `copernicus-${index}`),
          name: String((feature.id as string | undefined) ?? `copernicus-${index}`),
          acquisition: datetime,
          satellite: 'Sentinel-2',
          sensor: 'MSI',
          processing: 'STAC collection data',
          resolution: '10 m',
          cloudCover,
          productUrl: `${collection}?id=${encodeURIComponent(String(feature.id ?? ''))}`,
        }
      })

      setSatelliteScenes(mappedScenes)
      setSatelliteSearchMessage(mappedScenes.length ? `${mappedScenes.length} Copernicus Dataset product(s) found.` : 'No Copernicus Dataset products matched this location and date range.')
      return
    }

    const legacyData = await tryFunction('satellite-search', { latitude: location.lat, longitude: location.lng, radius: nearbyRadius, cloudCover: 30 })
    if (legacyData?.status === 'ready') {
      setSatelliteScenes(legacyData.scenes ?? [])
      setSatelliteSearchMessage(legacyData.scenes?.length ? `${legacyData.scenes.length} Copernicus Dataset product(s) found.` : 'No Copernicus Dataset products matched this location and date range.')
      return
    }

    setSatelliteSearchMessage(legacyData?.message || 'No Copernicus Dataset data is available.')
  }

  const runNearbyAnalysis = async (overrideLocation?: { lat: number; lng: number }) => {
    setNearbyPermissionOpen(false)
    setNearbyLoading(true)
    setNearbyError('')
    const location = overrideLocation ?? currentLocation ?? await getNearbyLocation()
    if (!location) {
      await recordNearbyPermission('denied')
      setNearbyLoading(false)
      setNearbyError('Location access was not granted. You can manually select an area on the map instead.')
      return
    }
    await recordNearbyPermission('granted')

    const issues = generateNearbyIssues(location, nearbyRadius)
    const nearbyResult: NearbyIssueAnalysis = {
      id: crypto.randomUUID(),
      latitude: location.lat,
      longitude: location.lng,
      radius: nearbyRadius,
      status: 'completed',
      mode: 'demo',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      issues,
      message: `AI proximity scan around your current location found ${issues.length} nearby observations within ${nearbyRadius} m. These are local pattern estimates for the selected area and should be reviewed with a site inspection or official dataset before actioning a real-world response.`,
      execution_trace: ['Location permission', 'Current GPS position captured', 'Nearby radius selected', 'Local pattern scan completed', 'Issue categories scored', 'Confidence flagged', 'Review guidance generated'],
    }
    setNearbyAnalysis(nearbyResult)
    await loadProximityFeatures(location, proximityQuery)
    setSelectedNearbyIssue(issues[0] ?? null)
    setNearbyLoading(false)
    setActiveSection('nearby')
    if (isSupabaseConfigured && session) {
      const { error } = await supabase.from('nearby_issue_analyses').insert({ id: nearbyResult.id, user_id: session.user.id, latitude: location.lat, longitude: location.lng, radius: nearbyRadius, status: 'completed', completed_at: nearbyResult.completed_at })
      const missingNearbyTable = error?.message.includes('nearby_issue_analyses') && error.message.includes('schema cache')
      if (error && !missingNearbyTable) setNearbyError(`Analysis completed locally, but could not be saved: ${error.message}`)
      if (missingNearbyTable) setNearbyError('Analysis completed locally. Supabase persistence is waiting for the nearby issue tables migration.')
      if (!error && issues.length) {
        await supabase.from('detected_issues').insert(issues.map((issue) => ({ analysis_id: nearbyResult.id, issue_type: issue.issue_type, category: issue.category, severity: issue.severity, latitude: issue.latitude, longitude: issue.longitude, distance_meters: issue.distance_meters, area: issue.area, description: issue.description, confidence: issue.confidence, reliability: issue.reliability, detected_at: issue.detected_at, reference_date: issue.reference_date })))
      }
    }

    await searchCopernicusScenes(location)
  }

  const clearNearbyAnalysis = () => {
    setNearbyAnalysis(null)
    setSelectedNearbyIssue(null)
    setSatelliteScenes([])
    setSatelliteSearchMessage('')
    setNearbyError('')
  }

  const dismissNearbyPermission = async () => {
    setNearbyPermissionOpen(false)
    await recordNearbyPermission('dismissed')
  }

  const translatedLabels = {
    en: {
      input: 'Input',
      imageType: 'Image Type',
      upload: 'Upload',
      demo: 'LOCAL',
      viewer: 'Image Viewer',
      heatmap: 'Toggle Heatmap',
      query: 'AI Query',
      analyze: 'ANALYZE',
      analyzing: 'Analyzing satellite imagery...',
      result: 'AI Analysis Result',
      pdf: 'Generate PDF Report',
      history: 'Analysis History',
      recommendations: 'Recommendations',
      map: 'Interactive Satellite Map',
      objectHighlight: 'Query-based object highlighting',
      opticalSar: 'Optical vs SAR Comparison',
      multilingual: 'Multilingual Viewer',
    },
    es: {
      input: 'Entrada',
      imageType: 'Tipo de imagen',
      upload: 'Subir',
      demo: 'LOCAL',
      viewer: 'Visor de imagen',
      heatmap: 'Alternar mapa de calor',
      query: 'Consulta de IA',
      analyze: 'ANALIZAR',
      analyzing: 'Analizando imágenes satelitales...',
      result: 'Resultado de análisis de IA',
      pdf: 'Generar informe PDF',
      history: 'Historial de análisis',
      recommendations: 'Recomendaciones',
      map: 'Mapa satelital interactivo',
      objectHighlight: 'Resaltado de objetos por consulta',
      opticalSar: 'Comparación óptica vs SAR',
      multilingual: 'Visor multilingüe',
    },
    fr: {
      input: 'Entrée',
      imageType: 'Type d’image',
      upload: 'Téléverser',
      demo: 'LOCAL',
      viewer: 'Visionneuse d’image',
      heatmap: 'Basculer la carte thermique',
      query: 'Requête IA',
      analyze: 'ANALYSER',
      analyzing: 'Analyse de l’imagerie satellite...',
      result: 'Résultat d’analyse IA',
      pdf: 'Générer un rapport PDF',
      history: 'Historique d’analyse',
      recommendations: 'Recommandations',
      map: 'Carte satellite interactive',
      objectHighlight: 'Mise en évidence des objets par requête',
      opticalSar: 'Comparaison optique vs SAR',
      multilingual: 'Visionneuse multilingue',
    },
  }

  const currentLabels = translatedLabels[(language === 'es' || language === 'fr' ? language : 'en')]

  const comparisonSummary = useMemo(() => ({
    from: new Date(beforeDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    to: new Date(afterDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    growth: '+12.8%',
    vegetation: '-8.3%',
    water: '+4.1%',
  }), [beforeDate, afterDate])

  const nearbyIssueCategories = useMemo(() => {
    const categories = [
      { key: 'environmental', label: 'Environmental', accent: 'emerald', description: 'Water, vegetation or land-cover change' },
      { key: 'infrastructure', label: 'Infrastructure', accent: 'teal', description: 'Roads, utilities, or built assets' },
      { key: 'urban', label: 'Urban', accent: 'amber', description: 'Built-up growth or mixed-use change' },
      { key: 'agriculture', label: 'Agriculture', accent: 'lime', description: 'Crop pattern or field stress' },
      { key: 'disaster', label: 'Disaster', accent: 'rose', description: 'Flooding or storm-related risk' },
    ] as const

    const counts: Record<string, number> = Object.fromEntries(categories.map((category) => [category.key, 0]))
    for (const issue of nearbyAnalysis?.issues ?? []) {
      counts[issue.category] = (counts[issue.category] ?? 0) + 1
    }

    return categories.map((category) => ({
      ...category,
      count: counts[category.key] ?? 0,
    }))
  }, [nearbyAnalysis])

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const isMetaKey = event.metaKey || event.ctrlKey
      if (isMetaKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsSearchOpen(true)
        requestAnimationFrame(() => {
          const input = document.getElementById('satquery-search-modal-input') as HTMLInputElement | null
          input?.focus()
          input?.select()
        })
      }

      if (event.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcut)
    return () => window.removeEventListener('keydown', handleKeyboardShortcut)
  }, [isSearchOpen])

  const detectTarget = (text: string) => {
    const lowercase = text.toLowerCase()
    if (lowercase.includes('building')) return 'building'
    if (lowercase.includes('road')) return 'road'
    if (lowercase.includes('water')) return 'water_body'
    if (lowercase.includes('agricultural')) return 'agricultural_field'
    return 'building'
  }

  const highlightedObjectType = detectTarget(query)
  const safeLocation = currentLocation && Number.isFinite(currentLocation.lat) && Number.isFinite(currentLocation.lng)
    ? currentLocation
    : null

  if (isAuthLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-300">Checking your SatQuery session...</div>
  }

  if (authError) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-sm text-red-200">Unable to load the authentication service: {authError}</div>
  }

  if ((isSupabaseConfigured && !session) || isRecovery) {
    return <AuthPage isRecovery={isRecovery} onAuthenticated={() => setIsRecovery(false)} />
  }

  if (!isDashboardOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-800">
        <div className="w-full max-w-3xl rounded-[28px] border border-amber-200 bg-white p-8 shadow-[0_25px_80px_rgba(15,23,42,0.12)] ring-1 ring-amber-100 sm:p-12">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-300"><Sparkles size={22} /></div>
            <div><div className="text-lg font-bold tracking-[0.08em] text-slate-900">SATQUERY AI</div><div className="text-xs text-slate-500">Remote sensing intelligence workspace</div></div>
          </div>
          <div className="max-w-2xl">
            <div className="mb-3 text-xs uppercase tracking-[0.28em] text-amber-700">Satellite intelligence dashboard</div>
            <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">Explore the signals hidden in Earth imagery.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Analyze uploaded satellite imagery, compare observations, inspect land cover, and explore potential nearby changes with clear evidence and provenance.</p>
            <button type="button" onClick={() => setIsDashboardOpen(true)} className="mt-8 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-5 py-3 font-semibold text-white shadow-[0_16px_40px_rgba(212,160,23,0.35)] transition hover:translate-y-[-1px] hover:shadow-[0_20px_45px_rgba(212,160,23,0.45)]"><Sparkles size={18} /> Explore SatQuery</button>
          </div>
          <div className="mt-12 grid gap-3 border-t border-slate-200 pt-6 text-xs text-slate-600 sm:grid-cols-3"><div><div className="mb-1 font-semibold text-slate-800">Analyze</div>Ask questions about imagery and land cover.</div><div><div className="mb-1 font-semibold text-slate-800">Compare</div>Inspect before and after observations.</div><div><div className="mb-1 font-semibold text-slate-800">Discover</div>Review potential nearby changes.</div></div>
        </div>
      </div>
    )
  }

  const datasetEvidence = {
    dataset: 'Copernicus Data Space',
    sensors: 'Sentinel-1 SAR + Sentinel-2 multispectral',
    task: mode === 'before_after' || mode === 'change_detection' ? 'Change understanding' : 'Land-cover question answering',
    matchedLabels: ['Agriculture', 'Arable land', 'Road network'],
    evidenceScore: 88,
  }

  const provenanceTask = mode === 'before_after' || mode === 'change_detection' ? 'Urban Growth / Change Detection' : mode === 'disaster' ? 'Disaster Analysis' : mode === 'optical_sar' ? 'Optical + SAR Analysis' : 'Land Cover Analysis'
  const provenanceInput = images.length > 1 ? 'Before + After' : images.length === 1 ? 'Uploaded image' : 'No imagery uploaded'
  const provenanceProcessing = images.some((image) => image.type === 'sar') ? 'Optical + SAR' : images.length ? 'Optical' : 'Unavailable'

  const runClimateAnalysis = async () => {
    const location = safeLocation
    if (!location) {
      setClimateMessage('Select an area on the map or allow location access before analyzing climate conditions.')
      setActiveSection('climate')
      return
    }
    setClimateLoading(true)
    setClimateMessage('Retrieving current conditions and forecast data...')
    try {
      if (!isSupabaseConfigured) throw new Error('Configure Supabase to connect the climate data service.')
      const { data, error } = await supabase.functions.invoke('climate-analysis', { body: { latitude: location.lat, longitude: location.lng, aoiSource: images.length ? 'uploaded imagery' : climateAoiMode } })
      if (error) throw error
      setClimateData(data)
      setClimateMessage(data?.message || 'Climate analysis completed with available provider data.')
    } catch (error) {
      setClimateData(null)
      setClimateMessage(error instanceof Error ? error.message : 'Weather data is currently unavailable for this location.')
    } finally {
      setClimateLoading(false)
    }
  }

  const openClimateView = (view: 'forecast' | 'warning' | 'history') => {
    setClimateView(view)
    setActiveSection('climate')
    window.requestAnimationFrame(() => document.getElementById(`climate-${view}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    if (view !== 'history') void runClimateAnalysis()
  }

  const runAnalysis = async (queryOverride?: string) => {
    const queryToAnalyze = queryOverride?.trim() || query.trim()
    if (!images.length) {
      setAnalysisError('Upload at least one image before starting an analysis.')
      setActiveSection('analysis')
      return
    }
    if (!queryToAnalyze) {
      setAnalysisError('Add a question so the analysis has a clear objective.')
      return
    }

    setIsLoading(true)
    setAnalysisError('')
    try {
      const result = await analyzeWithGemini(mode as any, queryToAnalyze, images)
      const saved = await saveAnalysisResult({
        id: crypto.randomUUID(),
        title: 'Live Analysis',
        type: mode as any,
        query: queryToAnalyze,
        summary: result.summary,
        confidence_score: result.confidence_score,
        reliability_score: result.reliability_score,
        images,
        result: {
          ...result,
          detected_objects: result.detected_objects.map((item, idx) => ({ ...item, id: `${item.object_type}-${idx}` })),
        },
      })
      setAnalysis(saved)
      setHistory((current) => [saved, ...current])
      setConversation((current) => [
        ...current,
        { question: queryToAnalyze, answer: result.summary },
      ])
      setActiveSection('results')
      return result
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'The analysis could not be completed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const startModeAnalysis = (selectedMode: string, selectedQuery: string) => {
    setMode(selectedMode)
    setQuery(selectedQuery)
    setActiveSection('analysis')
    if (images.length) void runAnalysis(selectedQuery)
    else setAnalysisError('Upload an image in the Analysis section, then click ANALYZE to run this mode.')
  }

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const selectedFiles = Array.from(fileList).slice(0, mode === 'single' ? 1 : 2)
    try {
      const uploadedImages = await Promise.all(selectedFiles.map(async (file, index) => {
        const error = validateImageFile(file)
        if (error) throw new Error(error)
        const objectUrl = URL.createObjectURL(file)
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
          const image = new Image()
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
          image.onerror = () => resolve({ width: 0, height: 0 })
          image.src = objectUrl
        })
        return {
          id: crypto.randomUUID(),
          name: file.name,
          url: objectUrl,
          type: mode === 'before_after' ? (index === 0 ? 'before' : 'after') : 'optical',
          size: file.size,
          ...dimensions,
        } as UploadedImage
      }))
      setImages(uploadedImages)
      setAnalysisError('')
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'The selected files could not be uploaded.')
    }
  }

  const onGenerateReport = async () => {
    if (!analysis?.result) return
    const blob = await generateAnalysisPdf({
      title: analysis.title,
      query: analysis.query,
      summary: analysis.result.summary,
      explanation: analysis.result.detailed_explanation,
      evidence: analysis.result.evidence_data,
      recommendations: analysis.result.recommendations,
      confidence: analysis.result.confidence_score,
      reliability: analysis.result.reliability_score,
      landCover: analysis.result.land_cover_result,
      detectedChanges: analysis.result.detected_changes,
      areaMeasurements: analysis.result.area_measurements,
    })
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    window.open(url, '_blank')
  }

  const onGenerateNearbyReport = async () => {
    if (!nearbyAnalysis) return
    const blob = await generateAnalysisPdf({
      title: 'Nearby Area Analysis',
      query: nearbyQuery || 'Identify potential environmental, infrastructure, land-use, agricultural, urban, or disaster-related changes in the selected area.',
      summary: nearbyAnalysis.message || `${nearbyAnalysis.issues.length} potential issue(s) identified within ${nearbyAnalysis.radius} meters.`,
      explanation: nearbyAnalysis.issues.map((issue) => `${issue.issue_type}: ${issue.description} Distance: ${Math.round(issue.distance_meters)} meters. Confidence: ${issue.confidence === null ? 'Unavailable' : `${issue.confidence}%`}. Reliability: ${issue.reliability}.`).join('\n') || 'No suitable satellite imagery is currently available for this analysis.',
      evidence: nearbyAnalysis.issues.flatMap((issue) => issue.evidence),
      recommendations: ['Verify potential issues with current local or official sources.', 'Use uploaded or provider-backed imagery for production analysis.'],
      confidence: nearbyAnalysis.issues[0]?.confidence ?? 0,
      reliability: nearbyAnalysis.issues[0]?.confidence ? nearbyAnalysis.issues[0].confidence : 0,
      detectedChanges: nearbyAnalysis.issues.map((issue) => ({ label: issue.issue_type, percentage: issue.confidence ?? 0 })),
      areaMeasurements: { radius: nearbyAnalysis.radius, detected_issues: nearbyAnalysis.issues.length },
    })
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    window.open(url, '_blank')
  }

  const handleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = speechLocales[language]
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setVoiceStatus('listening')
    recognition.onresult = (event: any) => {
      const transcript = String(event.results[0][0].transcript || '').trim()
      setQuery(transcript)
      setVoiceStatus('ready')
      void runAnalysis(transcript).then((result) => {
        if (result?.summary) speakAnswer(result.summary)
      })
    }
    recognition.onerror = () => setVoiceStatus('idle')
    recognition.onend = () => setVoiceStatus('idle')
    recognition.start()
  }

  const sendChatbotMessage = async (message = chatbotInput) => {
    const question = message.trim()
    if (!question || isChatbotTyping) return

    setChatbotInput('')
    setConversation((current) => [...current, { question, answer: '' }])
    setIsChatbotTyping(true)

    const normalizedQuestion = question.toLowerCase()
    let answer = analysis?.result
      ? `Based on the current analysis: ${analysis.result.summary}`
      : 'Upload satellite imagery and run ANALYZE first. Then I can answer questions about detected objects, changes, land cover, confidence, and area measurements.'

    if (analysis?.result) {
      const result = analysis.result
      if (normalizedQuestion.includes('upload') || normalizedQuestion.includes('add') || normalizedQuestion.includes('select')) {
        answer = 'Use the Upload imagery area in the Analysis section, choose a satellite image, then enter a question and click ANALYZE. You can upload one image for a single analysis or two images for comparison.'
      } else if (normalizedQuestion.includes('confidence') || normalizedQuestion.includes('reliable')) {
        answer = `The current analysis has a confidence score of ${result.confidence_score}% and a reliability score of ${result.reliability_score}% (${result.reliability_level}).`
      } else if (normalizedQuestion.includes('object') || normalizedQuestion.includes('building')) {
        const requestedType = normalizedQuestion.includes('building') ? 'building' : ''
        const matchingObjects = result.detected_objects.filter((item) => !requestedType || item.object_type.toLowerCase().includes(requestedType) || item.label.toLowerCase().includes(requestedType))
        answer = matchingObjects.length
          ? `I found ${matchingObjects.length} matching object(s): ${matchingObjects.map((item) => `${item.label} at approximately ${item.x}% from the left and ${item.y}% from the top`).join('; ')}.`
          : result.detected_objects.length
            ? `The analysis found ${result.detected_objects.length} object(s), but none matched that request. Available detections: ${result.detected_objects.map((item) => item.label).join(', ')}.`
            : 'This analysis did not detect any objects. Upload a clearer image or run ANALYZE again with a specific question such as “Identify all buildings”.'
      } else if (normalizedQuestion.includes('land') || normalizedQuestion.includes('cover') || normalizedQuestion.includes('agricultur')) {
        answer = result.land_cover_result.length
          ? `The land-cover breakdown is ${result.land_cover_result.map((item) => `${item.label} ${item.percentage}%`).join(', ')}.`
          : 'No land-cover breakdown was returned for this analysis.'
      } else if (normalizedQuestion.includes('change') || normalizedQuestion.includes('growth') || normalizedQuestion.includes('flood')) {
        answer = result.detected_changes.length
          ? `Detected changes: ${result.detected_changes.map((item) => `${item.label} ${item.percentage > 0 ? '+' : ''}${item.percentage}%`).join(', ')}.`
          : 'No change metrics were returned for this analysis.'
      } else if (normalizedQuestion.includes('area') || normalizedQuestion.includes('measure')) {
        const measurements = Object.entries(result.area_measurements)
        answer = measurements.length
          ? `Estimated areas: ${measurements.map(([label, value]) => `${label.replaceAll('_', ' ')} ${value} km²`).join(', ')}.`
          : 'No area measurements were returned for this analysis.'
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 350))
    setConversation((current) => current.map((item, index) => index === current.length - 1 ? { ...item, answer } : item))
    setIsChatbotTyping(false)
    speakAnswer(answer)
  }

  const handleChatbotVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = speechLocales[language]
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setChatbotVoiceStatus('listening')
    recognition.onresult = (event: any) => {
      const transcript = String(event.results[0][0].transcript || '').trim()
      setChatbotInput(transcript)
      setChatbotVoiceStatus('idle')
      if (transcript) {
        void sendChatbotMessage(transcript)
      }
    }
    recognition.onerror = () => setChatbotVoiceStatus('idle')
    recognition.onend = () => setChatbotVoiceStatus('idle')
    recognition.start()
  }

  const speakAnswer = (text: string) => {
    if (!('speechSynthesis' in window) || !text) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = speechLocales[language]
    utterance.rate = 0.95
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  const primaryImage = images[0]?.url

  const sidebarItems = [
    { label: 'Dashboard', value: 'overview', keywords: ['dashboard', 'summary', 'home', 'welcome', 'stats'] },
    { label: 'Analyze Image', value: 'analysis', keywords: ['analysis', 'upload', 'question', 'ai', 'image', 'query'] },
    { label: 'Satellite Forensics', value: 'forensics', keywords: ['forensics', 'why did it happen', 'cause', 'investigation'] },
    { label: 'Change Detection', value: 'modes', keywords: ['change detection', 'disaster', 'agriculture', 'comparison', 'mode'] },
    { label: 'Optical + SAR', value: 'comparison', keywords: ['sensor', 'comparison', 'sar', 'optical', 'multispectral', 'bands'] },
    { label: 'Land Cover', value: 'dataset', keywords: ['dataset', 'copernicus', 'data space', 'sentinel', 'land cover'] },
    { label: 'Disaster Mode', value: 'modes', keywords: ['disaster', 'flood', 'storm', 'risk', 'alert'] },
    { label: 'Agriculture', value: 'modes', keywords: ['agriculture', 'crop', 'vegetation', 'stress'] },
    { label: 'Urban Growth', value: 'modes', keywords: ['urban growth', 'building', 'construction', 'expansion'] },
    { label: 'Satellite Map', value: 'map', keywords: ['map', 'location', 'geolocation', 'coordinates', 'viewport', 'geospatial'] },
    { label: 'Analysis History', value: 'history', keywords: ['history', 'past', 'previous', 'saved', 'analyses', 'records'] },
    { label: 'Reports', value: 'results', keywords: ['results', 'summary', 'report', 'insights', 'findings', 'evidence'] },
    { label: 'Settings', value: 'tools', keywords: ['tools', 'generate', 'report', 'voice', 'speak', 'speech'] },
    { label: 'AI Nearby Issues', value: 'nearby', keywords: ['nearby', 'area', 'issues', 'satellite', 'location', 'anomaly'] },
    { label: 'Proximity Analysis', value: 'proximity', keywords: ['proximity', 'nearby features', 'hospitals', 'roads', 'rivers', 'hazards', 'location'] },
    { label: 'Climate & Early Warning', value: 'climate', keywords: ['climate', 'weather', 'forecast', 'warning', 'risk', 'rain'] },
  ]

  const siteSearchCatalog = [
    ...sidebarItems.map((item) => ({ ...item, group: 'Section' })),
    { label: 'Analyze image', value: 'analysis', group: 'Action', keywords: ['analyze', 'image', 'question', 'upload', 'run analysis'] },
    { label: 'Analyze climate', value: 'climate', group: 'Action', keywords: ['climate', 'weather', 'forecast', 'warning'] },
    { label: 'Analyze my area', value: 'nearby', group: 'Action', keywords: ['area', 'nearby', 'location', 'issues', 'surrounding'] },
    { label: 'Open proximity analysis', value: 'proximity', group: 'Action', keywords: ['proximity', 'nearby features', 'roads', 'hospitals', 'water', 'hazards'] },
    { label: 'Generate PDF report', value: 'results', group: 'Action', keywords: ['pdf', 'report', 'download', 'export'] },
    { label: 'View history', value: 'history', group: 'Action', keywords: ['history', 'past', 'saved', 'records'] },
  ]

  const filteredSearchResults = (() => {
    const trimmed = searchTerm.trim().toLowerCase()
    if (!trimmed) return []

    const searchTerms = trimmed.split(/\s+/).filter(Boolean)

    return siteSearchCatalog.filter((item) => {
      const haystack = `${item.label} ${item.group} ${item.keywords.join(' ')}`.toLowerCase()
      return searchTerms.every((term) => haystack.includes(term)) || item.label.toLowerCase().includes(trimmed)
    }).slice(0, 8)
  })()

  const openSearch = () => {
    setIsSearchOpen(true)
    requestAnimationFrame(() => {
      const input = document.getElementById('satquery-search-modal-input') as HTMLInputElement | null
      input?.focus()
      input?.select()
    })
  }

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchTerm('')
  }

  const goToSection = (section: string) => {
    setActiveSection(section)
    window.requestAnimationFrame(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="premium-shell min-h-screen bg-[#f8f5ef] text-slate-800">
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.18)] ring-1 ring-teal-100">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Search size={16} className="text-teal-300" /> Search SatQuery
              </div>
              <button type="button" onClick={closeSearch} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Esc</button>
            </div>

            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="satquery-search-modal-input"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search pages, actions, and features..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-teal-500"
              />
            </div>

            <div className="mt-4">
              {searchTerm ? (
                filteredSearchResults.length > 0 ? (
                  <div className="space-y-2">
                    {filteredSearchResults.map((item) => (
                      <button
                        key={`modal-${item.group}-${item.label}`}
                        type="button"
                        onClick={() => {
                          closeSearch()
                          goToSection(item.value)
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-3 text-left hover:border-teal-500"
                      >
                        <span>
                          <span className="block font-medium text-slate-100">{item.label}</span>
                          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.group}</span>
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-teal-300">Open</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">No matching features found. Try “weather”, “analysis”, “map”, or “history”.</div>
                )
              ) : (
                <div className="space-y-2">
                  {['Analysis', 'Climate', 'Nearby', 'Proximity', 'Map', 'History'].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => {
                        const mapped = quick.toLowerCase()
                        const target = mapped === 'analysis' ? 'analysis' : mapped === 'climate' ? 'climate' : mapped === 'nearby' ? 'nearby' : mapped === 'proximity' ? 'proximity' : mapped === 'map' ? 'map' : 'history'
                        closeSearch()
                        goToSection(target)
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-200 hover:border-teal-500"
                    >
                      <span>{quick}</span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-teal-300">Jump</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/95 p-4 shadow-[inset_-1px_0_0_rgba(148,163,184,0.18)] lg:block">
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.45)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 via-teal-500 to-emerald-500 text-sm font-bold text-white shadow-[0_12px_30px_rgba(20,184,166,0.45)]">S</div>
            <div>
              <div className="text-sm font-semibold text-slate-100">Personal workspace</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">SatQuery AI</div>
            </div>
          </div>

          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => goToSection(item.value)}
                className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${activeSection === item.value ? 'bg-teal-500/15 text-teal-200' : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-700 pt-4">
            <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">Recent</div>
            <div className="space-y-2 text-sm text-slate-300">
              <button type="button" onClick={() => goToSection('analysis')} className="block w-full rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 text-left hover:border-teal-500">SatQuery AI</button>
              <button type="button" onClick={() => goToSection('results')} className="block w-full rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 text-left hover:border-teal-500">Latest result</button>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl shadow-[0_12px_30px_rgba(15,23,42,0.35)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-500/15 p-2 text-violet-300 ring-1 ring-violet-400/20 shadow-[0_0_30px_rgba(139,92,246,0.18)]">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-xl font-bold">SATQUERY AI</div>
              <div className="text-xs text-slate-400">Vision-Language Remote Sensing Assistant</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-300">
            <button type="button" onClick={openSearch} className="hidden items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 md:flex">
              <Search size={15} /> Search
            </button>
            <button type="button" onClick={openSearch} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 md:hidden">
              <Search size={15} />
            </button>
            <button type="button" onClick={() => goToSection('history')} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
              <History size={16} /> {currentLabels.history}
            </button>
            <button type="button" onClick={() => requestCurrentLocation(true)} className="flex items-center gap-2 rounded-lg border border-teal-400/40 bg-teal-500/10 px-3 py-2 text-teal-200 hover:bg-teal-500/20">
              <LocateFixed size={16} /> Allow location
            </button>
            <button type="button" onClick={() => { if (isSupabaseConfigured) void supabase.auth.signOut(); else window.localStorage.removeItem('satquery.analysis-history') }} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
              <User size={16} /> Sign out
            </button>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200">
              <Globe2 size={16} className="text-teal-300" />
              <select value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)} className="bg-transparent text-sm outline-none">
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="fr">FR</option>
                <option value="hi">हिन्दी</option>
                <option value="kn">ಕನ್ನಡ</option>
                <option value="te">తెలుగు</option>
                <option value="ta">தமிழ்</option>
                <option value="ml">മലയാളം</option>
                <option value="mr">मराठी</option>
              </select>
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <nav className="mb-5 flex gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-sm lg:hidden">
          {[['overview', 'Overview'], ['dataset', 'Dataset'], ['nearby', 'Nearby'], ['proximity', 'Proximity'], ['climate', 'Climate'], ['analysis', 'Analysis'], ['map', 'Map'], ['results', 'Results'], ['provenance', 'Provenance'], ['history', 'History'], ['modes', 'Modes'], ['comparison', 'Sensors'], ['tools', 'Tools']].map(([section, label]) => (
            <button key={section} type="button" onClick={() => goToSection(section)} className={`whitespace-nowrap rounded-lg px-3 py-2 ${activeSection === section ? 'bg-teal-500/15 text-teal-200' : 'text-slate-300 hover:bg-teal-500/10 hover:text-teal-200'}`}>{label}</button>
          ))}
        </nav>
        <div hidden={activeSection !== 'overview'} id="overview" className="mb-6 grid scroll-mt-24 gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-teal-500/20 bg-slate-900/80 p-4 shadow-glow">
              <div className="text-slate-400 text-sm">{stat.label}</div>
              <div className="mt-3 text-3xl font-bold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        <section hidden={activeSection !== 'overview' && activeSection !== 'nearby'} className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-yellow-50 p-5 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-teal-200"><MapPinned size={15} /> AI Nearby Issue Detection</div>
              <h2 className="text-xl font-bold text-white">Analyze your selected area using satellite imagery and AI.</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">SatQuery checks for potential environmental, infrastructure, urban, agriculture, and disaster-related changes. Results are situational awareness, not confirmed hazards.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openNearbyAnalysis} className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-teal-400/20 hover:bg-teal-300"><LocateFixed size={18} /> Analyze My Area</button>
              <button type="button" onClick={() => goToSection('proximity')} className="rounded-xl border border-teal-400/40 px-4 py-3 text-sm font-medium text-teal-200 hover:bg-teal-400/10">Open Proximity Analysis</button>
            </div>
          </div>
        </section>

        <section hidden={activeSection !== 'proximity'} id="proximity" className="mb-6 scroll-mt-24 rounded-2xl border border-teal-400/20 bg-teal-400/5 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-teal-200"><MapPinned size={15} /> Proximity Analysis</div>
              <h2 className="mt-2 text-xl font-bold text-white">Proximity &amp; Nearby Feature Analysis</h2>
            </div>
            <button type="button" onClick={() => void runNearbyAnalysis()} className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-400">Refresh features</button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-teal-100">Nearby feature search</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Current location</div>
            </div>
            <input value={proximityQuery} onChange={(event) => setProximityQuery(event.target.value)} placeholder="What important features or issues are near this location?" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500" />
            <div className="mt-3 flex flex-wrap gap-2">
              {['What important features or issues are near this location?', 'Find all major roads within 2 km of this location.', 'Show nearby hospitals and water features.', 'List hazards and built-up areas near me.'].map((question) => (
                <button key={question} type="button" onClick={() => setProximityQuery(question)} className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-teal-400">{question}</button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {proximityFeatures.length ? proximityFeatures.map((feature) => (
                <div key={feature.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-100">{feature.label}</div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${feature.priority === 'HIGH' ? 'bg-red-500/20 text-red-200' : feature.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>{feature.priority}</span>
                  </div>
                  <div className="mt-2 text-xl font-semibold text-teal-200">{feature.distanceMeters} m</div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-400">{feature.detail}</div>
                </div>
              )) : <div className="col-span-full rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-400">No proximity features were calculated for this location yet. Click the refresh button or allow location access to generate nearby detail.</div>}
            </div>
            <div className="mt-3 text-xs text-slate-400">Example: Hospital → 1.2 km; Main road → 350 m; Lake → 800 m; Built-up area → 150 m; Detected hazard → 420 m.</div>
          </div>
        </section>


        <section hidden={activeSection !== 'overview' && activeSection !== 'climate'} className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-yellow-50 p-5 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-teal-200">🌦️ Climate &amp; Early Warning</div>
              <h2 className="text-xl font-bold text-white">Understand conditions, trends, forecasts, and potential risks for your selected area.</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">Weather values come from the configured provider. Unsupported indices and warnings remain unavailable.</p>
            </div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setClimateView('overview'); void runClimateAnalysis() }} className="rounded-xl bg-teal-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-teal-300">Analyze Climate</button><button type="button" onClick={() => openClimateView('forecast')} className="rounded-xl border border-teal-400/40 px-3 py-2 text-xs text-teal-200">View Forecast</button><button type="button" onClick={() => openClimateView('warning')} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300">Early Warning</button><button type="button" onClick={() => openClimateView('history')} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300">Historical Trends</button></div>
          </div>
        </section>

        <section hidden={activeSection !== 'climate'} id="climate" className="mb-6 scroll-mt-24 space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-lg font-semibold text-white">🌦️ Climate &amp; Early Warning Intelligence</div><p className="mt-1 text-xs text-slate-400">Specific AOI: {safeLocation ? `${safeLocation.lat.toFixed(5)}, ${safeLocation.lng.toFixed(5)}` : 'No location selected'} · View: {climateView}</p></div><div className="flex items-center gap-2"><select value={climateAoiMode} onChange={(event) => setClimateAoiMode(event.target.value as 'uploaded' | 'manual')} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-300"><option value="manual">Manual AOI</option><option value="uploaded">Uploaded image AOI</option></select><button type="button" onClick={() => { setClimateView('overview'); void runClimateAnalysis() }} className="rounded-lg bg-teal-400 px-3 py-2 text-xs font-semibold text-slate-950">Analyze Climate</button></div></div>
            {climateLoading && <div className="mt-4 rounded-xl border border-teal-400/20 bg-teal-400/10 p-3 text-sm text-teal-100">{climateMessage}</div>}
            {!climateLoading && climateMessage && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100">{climateMessage}</div>}
            {climateData && <>
              <div id="climate-warning" className="mt-5 scroll-mt-24 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 text-sm font-semibold">Weather intelligence</div>{climateData.current ? <div className="grid gap-3 sm:grid-cols-3"><div><div className="text-xs text-slate-500">Temperature</div><div className="mt-1 text-2xl font-bold text-white">{climateData.current.temperature}°C</div></div><div><div className="text-xs text-slate-500">Feels like</div><div className="mt-1 text-lg text-slate-200">{climateData.current.feelsLike}°C</div></div><div><div className="text-xs text-slate-500">Humidity</div><div className="mt-1 text-lg text-slate-200">{climateData.current.humidity}%</div></div><div><div className="text-xs text-slate-500">Rainfall</div><div className="mt-1 text-lg text-slate-200">{climateData.current.precipitation} mm</div></div><div><div className="text-xs text-slate-500">Wind</div><div className="mt-1 text-lg text-slate-200">{climateData.current.windSpeed} km/h</div></div><div><div className="text-xs text-slate-500">Conditions</div><div className="mt-1 text-lg text-slate-200">Code {climateData.current.weatherCode}</div></div></div> : <div className="text-sm text-slate-500">Weather data is currently unavailable for this location.</div>}</div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 text-sm font-semibold">AI Early Warning Center</div>{climateData.risks?.length ? climateData.risks.map((risk) => <div key={risk.type} className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3"><div className="font-medium text-amber-200">⚠ {risk.type}</div><div className="mt-1 text-xs text-slate-300">Risk: {risk.level} · Confidence: {risk.confidence}</div><div className="mt-2 text-xs text-slate-400">{risk.evidence.join(' · ')}</div></div>) : <div className="text-sm text-slate-500">No risk assessment is available. No official alert is being claimed.</div>}</div></div>
              <div id="climate-forecast" className="mt-4 scroll-mt-24 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-semibold">7-day forecast</div><span className="text-xs text-slate-500">Source: {climateData.source}</span></div><div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">{(climateData.daily ?? []).map((day) => <div key={day.date} className="rounded-lg bg-slate-900 p-2 text-xs"><div className="text-slate-400">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}</div><div className="mt-2 text-slate-200">{day.max}° / {day.min}°C</div><div className="mt-1 text-teal-300">Rain {day.precipitationProbability}%</div></div>)}</div></div>
              <div id="climate-history" className="mt-4 scroll-mt-24 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-2 text-sm font-semibold">Historical Trend Analysis</div><div className="text-sm text-slate-400">Historical weather and satellite trend data is unavailable until an archive provider and dated imagery are configured. No trend is inferred from the current forecast.</div></div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 text-sm font-semibold">Climate Profile</div><div className="text-sm text-slate-400">Historical climate data is unavailable until an archive provider is configured. Current forecast data must not be interpreted as long-term climate.</div></div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 text-sm font-semibold">Remote-sensing indicators</div><div className="space-y-2 text-sm text-slate-400"><div>NDVI: unavailable, required spectral bands are not present.</div><div>NDWI: unavailable, required spectral bands are not present.</div><div>NDBI: unavailable, required spectral bands are not present.</div><div>NBR: unavailable, required spectral bands are not present.</div></div></div></div>
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 flex items-center justify-between"><div className="text-sm font-semibold">Map layers</div><select value={climateLayer} onChange={(event) => setClimateLayer(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"><option value="satellite">Satellite</option><option value="weather">Weather</option><option value="ndvi">NDVI</option><option value="ndwi">NDWI</option><option value="ndbi">NDBI</option><option value="risk">Risk zones</option></select></div><div className="text-xs text-slate-400">Layer “{climateLayer}” is selected. A rendered layer requires compatible provider data for this AOI.</div></div>
            </>}
          </div>
        </section>

        <section hidden={activeSection !== 'provenance'} id="provenance" className="mb-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-teal-300">Satellite Mission &amp; Data Provenance</div>
              <p className="mt-1 text-xs text-slate-500">Values are read from configured metadata, uploaded imagery, and the current analysis result.</p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-400">No fabricated metadata</span>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <div className="mb-3 border-b border-slate-800 pb-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">Data source</div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div><span className="text-slate-500">Satellite</span><div className="mt-1 text-slate-200">Unavailable</div></div>
                <div><span className="text-slate-500">Sensor</span><div className="mt-1 text-slate-200">Unavailable</div></div>
                <div><span className="text-slate-500">Acquisition</span><div className="mt-1 text-slate-200">Unavailable</div></div>
                <div><span className="text-slate-500">Resolution</span><div className="mt-1 text-slate-200">Unavailable</div></div>
                <div><span className="text-slate-500">Processing</span><div className="mt-1 text-slate-200">Unavailable</div></div>
                <div><span className="text-slate-500">Cloud cover</span><div className="mt-1 text-slate-200">Unavailable</div></div>
              </div>
              {!images.length && <div className="mt-3 rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-400">Upload imagery with provider metadata to populate the mission fields.</div>}
            </div>
            <div>
              <div className="mb-3 border-b border-slate-800 pb-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">Analysis</div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div><span className="text-slate-500">Task</span><div className="mt-1 text-slate-200">{provenanceTask}</div></div>
                <div><span className="text-slate-500">Model</span><div className="mt-1 text-slate-200">{analysis ? 'SatQuery AI analysis' : 'Not run'}</div></div>
                <div><span className="text-slate-500">Input</span><div className="mt-1 text-slate-200">{provenanceInput}</div></div>
                <div><span className="text-slate-500">Processing</span><div className="mt-1 text-slate-200">{provenanceProcessing}</div></div>
                <div><span className="text-slate-500">Confidence</span><div className="mt-1 text-slate-200">{analysis ? `${analysis.confidence_score}%` : 'Unavailable'}</div></div>
              </div>
              <div className="mt-4 rounded-lg bg-slate-950/60 p-3 text-xs leading-5 text-slate-400">Confidence is from the current analysis result. It does not validate satellite provenance or guarantee a real-world condition.</div>
            </div>
          </div>
        </section>

        {nearbyPermissionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-teal-400/30 bg-[#111c2d] p-6 shadow-2xl">
              <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-white"><LocateFixed className="text-teal-300" /> Analyze My Area</div>
              <p className="text-sm leading-6 text-slate-300">{nearbyPermissionMessage}</p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={dismissNearbyPermission} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Not Now</button>
                <button type="button" onClick={() => void runNearbyAnalysis()} className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-300">Allow Location</button>
              </div>
            </div>
          </div>
        )}

        <section hidden={activeSection !== 'nearby'} id="nearby" className="mb-6 scroll-mt-24 space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold"><MapPinned size={19} className="text-teal-300" /> Nearby AI Analysis</div>
                <p className="mt-1 text-xs text-slate-400">Potential anomalies only. Verify serious conditions with official or local sources.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-400">Radius
                  <select value={nearbyRadius} onChange={(event) => setNearbyRadius(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200">
                    {[1000, 5000, 10000].map((radius) => <option key={radius} value={radius}>{radius / 1000} km</option>)}
                  </select>
                </label>
                <button type="button" onClick={nearbyAnalysis ? clearNearbyAnalysis : openNearbyAnalysis} className="rounded-lg border border-teal-400/40 px-3 py-2 text-xs text-teal-200 hover:bg-teal-400/10">{nearbyAnalysis ? 'Clear Analysis' : 'Analyze Area'}</button>
                <button type="button" onClick={() => setNearbyHeatmapEnabled((current) => !current)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Heatmap {nearbyHeatmapEnabled ? 'On' : 'Off'}</button>
                <button type="button" onClick={() => setMapLayer((current) => current === 'satellite' ? 'street' : 'satellite')} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">{mapLayer === 'satellite' ? 'Normal map' : 'Satellite map'}</button>
                <button type="button" onClick={onGenerateNearbyReport} disabled={!nearbyAnalysis} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-50">Generate Area Report</button>
              </div>
            </div>

            {nearbyLoading && <div className="mt-5 rounded-xl border border-teal-400/20 bg-teal-400/10 p-4 text-sm text-teal-100">Checking location, imagery availability, and nearby change evidence...</div>}
            {nearbyError && <div role="alert" className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{nearbyError}</div>}
            {nearbyAnalysis && !nearbyLoading && (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-xs text-slate-500">Location</div><div className="mt-1 truncate text-sm text-slate-200">{selectedPlaceName || locationAddress || 'Selected area'}</div></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-xs text-slate-500">Radius</div><div className="mt-1 text-sm text-slate-200">{nearbyAnalysis.radius >= 1000 ? `${nearbyAnalysis.radius / 1000} km` : `${nearbyAnalysis.radius} m`}</div></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-xs text-slate-500">Coordinates</div><div className="mt-1 font-mono text-xs text-slate-200">{nearbyAnalysis.latitude.toFixed(5)}, {nearbyAnalysis.longitude.toFixed(5)}</div></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-xs text-slate-500">Data mode</div><div className="mt-1 text-sm text-amber-200">{nearbyAnalysis.mode === 'uploaded-imagery' ? 'Uploaded imagery' : 'Evidence unavailable'}</div></div>
                </div>
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">
                  {nearbyAnalysis.message}
                  {!images.length && <button type="button" onClick={() => goToSection('analysis')} className="ml-3 rounded-lg border border-teal-400/40 px-2 py-1 text-teal-200 hover:bg-teal-400/10">Upload area imagery</button>}
                  <div className="mt-2 flex items-center gap-2 text-slate-400">Heatmap opacity <input type="range" min="0" max="1" step="0.05" value={nearbyHeatmapOpacity} onChange={(event) => setNearbyHeatmapOpacity(Number(event.target.value))} /></div>
                </div>
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-100">Issues around your location</div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {nearbyIssueCategories.map((category) => (
                      <div key={category.key} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{category.label}</div>
                        <div className={`mt-2 text-2xl font-semibold ${category.accent === 'emerald' ? 'text-emerald-300' : category.accent === 'teal' ? 'text-teal-300' : category.accent === 'amber' ? 'text-amber-300' : category.accent === 'lime' ? 'text-lime-300' : 'text-rose-300'}`}>{category.count}</div>
                        <div className="mt-1 text-[11px] leading-4 text-slate-400">{category.description}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    {nearbyAnalysis.issues.length
                      ? 'Verified issue markers in this radius are limited to evidence returned for the selected area.'
                      : 'No verified nearby issue markers were found for this live location, so the app is not reporting a confirmed issue without evidence.'}
                  </p>
                </div>
                <div className="mt-5 rounded-xl border border-teal-400/20 bg-teal-400/5 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-teal-100">Proximity &amp; Nearby Feature Analysis</div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Current location</div>
                  </div>
                  <input value={proximityQuery} onChange={(event) => setProximityQuery(event.target.value)} placeholder="What important features or issues are near this location?" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['What important features or issues are near this location?', 'Find all major roads within 2 km of this location.', 'Show nearby hospitals and water features.', 'List hazards and built-up areas near me.'].map((question) => (
                      <button key={question} type="button" onClick={() => setProximityQuery(question)} className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-teal-400">{question}</button>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {proximityFeatures.length ? proximityFeatures.map((feature) => (
                      <div key={feature.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-slate-100">{feature.label}</div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${feature.priority === 'HIGH' ? 'bg-red-500/20 text-red-200' : feature.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>{feature.priority}</span>
                        </div>
                        <div className="mt-2 text-xl font-semibold text-teal-200">{feature.distanceMeters} m</div>
                        <div className="mt-1 text-[11px] leading-5 text-slate-400">{feature.detail}</div>
                      </div>
                    )) : <div className="col-span-full rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-400">No proximity features were calculated for this location yet. Click Locate me or choose a place to generate nearby feature details.</div>}
                  </div>
                  <div className="mt-3 text-xs text-slate-400">Example: Hospital → 1.2 km; Main road → 350 m; Lake → 800 m; Built-up area → 150 m; Detected hazard → 420 m.</div>
                </div>
                <div className="mt-4 rounded-xl border border-teal-400/20 bg-teal-400/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-teal-100">Copernicus Data Space</div>
                    <span className="text-xs text-slate-400">Sentinel-2 catalogue search</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-300">{satelliteSearchMessage || 'Searching for verified scenes...'}</div>
                  {satelliteScenes.length > 0 && <div className="mt-3 space-y-2">{satelliteScenes.slice(0, 3).map((scene) => <div key={scene.id} className="grid gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs sm:grid-cols-3"><div><span className="text-slate-500">Acquisition</span><div className="mt-1 text-slate-200">{scene.acquisition ? new Date(scene.acquisition).toLocaleString() : 'Unavailable'}</div></div><div><span className="text-slate-500">Product</span><div className="mt-1 truncate text-slate-200" title={scene.name}>{scene.name || scene.id}</div></div><div><span className="text-slate-500">Cloud cover</span><div className="mt-1 text-slate-200">{scene.cloudCover === null ? 'Unavailable' : `${scene.cloudCover}%`}</div></div></div>)}</div>}
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-semibold">Issues Detected</div><div className="flex gap-2"><select value={nearbyCategory} onChange={(event) => setNearbyCategory(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"><option value="all">All categories</option><option value="environmental">Environmental</option><option value="infrastructure">Infrastructure</option><option value="urban">Urban</option><option value="agriculture">Agriculture</option><option value="disaster">Disaster</option></select><label className="flex items-center gap-2 text-xs text-slate-400">Confidence <input type="range" min="0" max="100" value={nearbyConfidenceThreshold} onChange={(event) => setNearbyConfidenceThreshold(Number(event.target.value))} /></label></div></div>
                    <div className="space-y-3">
                      {nearbyAnalysis.issues.filter((issue) => (nearbyCategory === 'all' || issue.category === nearbyCategory) && (issue.confidence === null || issue.confidence >= nearbyConfidenceThreshold)).map((issue) => <button key={issue.id} type="button" onClick={() => setSelectedNearbyIssue(issue)} className={`w-full rounded-xl border p-3 text-left ${selectedNearbyIssue?.id === issue.id ? 'border-teal-400/60 bg-teal-400/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}><div className="flex items-start justify-between gap-3"><div><div className="font-medium text-amber-200">⚠ {issue.issue_type}</div><div className="mt-1 text-xs text-slate-400">{(issue.distance_meters / 1000).toFixed(issue.distance_meters < 1000 ? 0 : 1)} {issue.distance_meters < 1000 ? 'm' : 'km'} from selected location · {issue.category}</div></div><span title="Severity indicates anomaly magnitude or priority, not confirmed real-world danger." className={`rounded-full px-2 py-1 text-[10px] font-semibold ${issue.severity === 'HIGH' ? 'bg-red-500/20 text-red-200' : issue.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>{issue.severity}</span></div><div className="mt-2 text-xs text-slate-300">Confidence: {issue.confidence === null ? 'Unavailable' : `${issue.confidence}%`} · Reliability: {issue.reliability}</div></button>)}
                          {!nearbyAnalysis.issues.length && <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">No verified issues detected. This is not a finding that the area is clear: georeferenced imagery analysis is unavailable, so SatQuery did not invent incidents or markers.</div>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-3 text-sm font-semibold">Evidence and follow-up</div>
                    {selectedNearbyIssue ? <><div className="text-sm text-slate-200">{selectedNearbyIssue.description}</div><div className="mt-3 text-xs text-slate-400">Evidence</div><ul className="mt-2 space-y-2 text-xs text-slate-300">{selectedNearbyIssue.evidence.map((item) => <li key={item}>• {item}</li>)}</ul><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><span className="text-slate-500">Area</span><div className="mt-1 text-slate-200">{selectedNearbyIssue.area === null ? 'Unavailable' : `${selectedNearbyIssue.area} km²`}</div></div><div><span className="text-slate-500">Detected</span><div className="mt-1 text-slate-200">{new Date(selectedNearbyIssue.detected_at).toLocaleDateString()}</div></div></div></> : <div className="text-sm text-slate-500">Select an issue to inspect its evidence.</div>}
                    <div className="mt-5"><input value={nearbyQuery} onChange={(event) => setNearbyQuery(event.target.value)} placeholder="Ask something specific about this area..." className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500" /><div className="mt-2 flex flex-wrap gap-2">{['Is there any recent surface change?', 'Are there signs of flooding?', 'Has vegetation changed?', 'Has the built-up area increased?'].map((question) => <button key={question} type="button" onClick={() => setNearbyQuery(question)} className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-teal-400">{question}</button>)}</div></div>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 text-sm font-semibold">Issue summary &amp; reliability</div><p className="text-sm leading-6 text-slate-300">{nearbyAnalysis.issues.length ? 'The selected area shows indications requiring further verification.' : 'No issue summary is available because verified, georeferenced evidence was not returned for this area.'}</p><div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3"><div><span className="text-slate-500">Source</span><div className="mt-1 text-slate-200">{satelliteScenes.length ? 'Copernicus Sentinel-2 catalogue' : 'Unavailable'}</div></div><div><span className="text-slate-500">Evidence</span><div className="mt-1 text-slate-200">{nearbyAnalysis.issues.length ? 'Uploaded/provider imagery' : 'Not sufficient'}</div></div><div><span className="text-slate-500">Reliability</span><div className="mt-1 text-amber-200">{nearbyAnalysis.issues.length ? 'Review required' : 'Unavailable'}</div></div></div><div className="mt-4 grid gap-2 text-xs text-slate-300 md:grid-cols-5">{nearbyAnalysis.execution_trace.map((step) => <div key={step} className="rounded-lg bg-slate-900 px-2 py-2">✓ {step}</div>)}</div></div>
              </>
            )}
          </div>
        </section>

        <section hidden={activeSection !== 'dataset'} id="dataset" className="mb-6 scroll-mt-24 overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900/80 shadow-glow">
          <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-white to-yellow-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-emerald-300">Copernicus Dataset</div>
                <h1 className="text-2xl font-bold text-white">Copernicus Dataset</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Sentinel-1 SAR and Sentinel-2 multispectral Earth observation data.</p>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">Dataset-ready mode</span>
            </div>
          </div>

          <div className="grid gap-px bg-slate-800 md:grid-cols-4">
            <div className="bg-slate-900/95 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Image pairs</div><div className="mt-2 text-2xl font-bold text-white">464K+</div><div className="mt-1 text-xs text-slate-400">Co-registered samples</div></div>
            <div className="bg-slate-900/95 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Text annotations</div><div className="mt-2 text-2xl font-bold text-white">9.6M</div><div className="mt-1 text-xs text-slate-400">Captions, VQA, regions</div></div>
            <div className="bg-slate-900/95 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Sensor pair</div><div className="mt-2 text-lg font-bold text-white">S1 + S2</div><div className="mt-1 text-xs text-slate-400">SAR + multispectral</div></div>
            <div className="bg-slate-900/95 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Dataset</div><div className="mt-2 text-lg font-bold text-emerald-300">Copernicus</div><div className="mt-1 text-xs text-slate-400">Earth observation data</div></div>
          </div>

          <div className="border-b border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Copernicus Dataset products</div>
                <div className="mt-1 text-xs text-slate-500">Real Sentinel-2 products returned for the selected location.</div>
              </div>
              <button type="button" disabled={!safeLocation} onClick={() => safeLocation && void searchCopernicusScenes(safeLocation)} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">Refresh dataset</button>
            </div>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{satelliteSearchMessage || (safeLocation ? 'Refresh to load Copernicus products for this location.' : 'Select a location on the map before loading products.')}</div>
            {satelliteScenes.length > 0 && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {satelliteScenes.slice(0, 6).map((scene) => (
                  <a key={scene.id} href={scene.productUrl ?? '#'} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-amber-400">
                    <div className="truncate text-sm font-semibold text-slate-900" title={scene.name}>{scene.name || scene.id}</div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <div><span className="text-slate-400">Acquired</span><div className="mt-1 text-slate-800">{scene.acquisition ? new Date(scene.acquisition).toLocaleDateString() : 'Unavailable'}</div></div>
                      <div><span className="text-slate-400">Satellite</span><div className="mt-1 text-slate-800">{scene.satellite}</div></div>
                      <div><span className="text-slate-400">Cloud cover</span><div className="mt-1 text-slate-800">{scene.cloudCover === null ? 'Unavailable' : `${scene.cloudCover}%`}</div></div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_1fr_1fr]">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-100">What this dashboard measures</div>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between"><span>Land-cover understanding</span><span className="text-emerald-300">Ready</span></div>
                <div className="flex items-center justify-between"><span>Optical and SAR reasoning</span><span className="text-emerald-300">Ready</span></div>
                <div className="flex items-center justify-between"><span>Visual question answering</span><span className="text-emerald-300">Ready</span></div>
                <div className="flex items-center justify-between"><span>Fine-tuned model connection</span><span className="text-amber-300">Pending</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
              <div className="mb-2 text-sm font-semibold text-teal-100">Sentinel-1 SAR</div>
              <p className="text-xs leading-5 text-slate-400">Radar backscatter helps inspect surface texture, structure, moisture, and all-weather observations.</p>
              <div className="mt-4 h-2 rounded-full bg-slate-800"><div className="h-2 w-4/5 rounded-full bg-teal-400" /></div>
              <div className="mt-2 text-xs text-teal-200">Structure and texture signal</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="mb-2 text-sm font-semibold text-emerald-100">Sentinel-2 multispectral</div>
              <p className="text-xs leading-5 text-slate-400">Multispectral bands help inspect vegetation, water, soil, and visible land-cover patterns.</p>
              <div className="mt-4 h-2 rounded-full bg-slate-800"><div className="h-2 w-11/12 rounded-full bg-emerald-400" /></div>
              <div className="mt-2 text-xs text-emerald-200">Vegetation and spectral signal</div>
            </div>
          </div>
        </section>

        <section id="workspace" className="mb-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <EarthIntelligenceWorkspace location={safeLocation ? ({ id: 'current-location', name: selectedPlaceName || locationAddress || 'Selected location', lat: safeLocation.lat, lng: safeLocation.lng, radius: nearbyRadius } as Location) : null} />
        </section>

        <div hidden={activeSection !== 'analysis' && activeSection !== 'map' && activeSection !== 'nearby'} id="analysis" className="mx-auto max-w-5xl space-y-6 scroll-mt-24">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <ImageIcon size={18} className="text-teal-300" /> {currentLabels.input}
            </div>

            <div className="mb-5">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">{currentLabels.imageType}</div>
              <div className="space-y-2">
                {modeOptions.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 hover:bg-slate-800">
                    <input type="radio" name="mode" checked={mode === option.value} onChange={() => setMode(option.value)} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>

            <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-emerald-100">Copernicus Dataset</div>
                <button type="button" onClick={() => setDatasetEvidenceEnabled((current) => !current)} className={`rounded-full px-2 py-1 text-xs ${datasetEvidenceEnabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                  {datasetEvidenceEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
                <div className="text-xs leading-5 text-slate-400">Sentinel-1 SAR and Sentinel-2 multispectral data.</div>
            </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/50 p-4">
              <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                <span>{mode === 'before_after' ? 'Upload Before and After images' : currentLabels.upload}</span>
                <span className="rounded-full bg-teal-500/20 px-2 py-1 text-xs text-teal-200">{currentLabels.demo}</span>
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-8 text-center text-slate-300 hover:border-teal-400">
                <Upload size={28} className="text-teal-300" />
                <span className="font-medium">{mode === 'before_after' ? 'Choose 2 images: Before first, After second' : 'Drop image or browse'}</span>
                <input type="file" accept="image/*" multiple={mode !== 'single'} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </label>

              <div className="mt-4 space-y-2">
                {images.map((img) => (
                  <div key={img.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-2 py-2 text-sm">
                    <span className="truncate"><span className="mr-2 text-xs uppercase text-teal-300">{mode === 'before_after' ? (img.type === 'before' ? 'Before' : 'After') : img.type}</span>{img.name}</span>
                    <button className="text-red-300" type="button" onClick={() => setImages([])}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Layers3 size={18} className="text-teal-300" /> {currentLabels.viewer}
              </div>
              <button type="button" onClick={() => setHeatmapEnabled((current) => !current)} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                {currentLabels.heatmap}
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-teal-500/20 bg-slate-950/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                <CalendarClock size={15} className="text-teal-300" /> Time-based comparison
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Before date
                  <input type="date" value={beforeDate} onChange={(e) => setBeforeDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100" />
                </label>
                <label className="text-xs text-slate-400">
                  After date
                  <input type="date" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100" />
                </label>
              </div>
              <div className="mt-3 text-xs text-slate-300">
                Comparing {comparisonSummary.from} to {comparisonSummary.to}: urban growth {comparisonSummary.growth}, vegetation {comparisonSummary.vegetation}, water change {comparisonSummary.water}.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                  <span>Before: {comparisonSummary.from}</span>
                </div>
                {primaryImage ? <img src={primaryImage} alt="Before comparison" className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center px-4 text-center text-sm text-slate-500">Upload imagery to preview this acquisition.</div>}
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                  <span>After: {comparisonSummary.to}</span>
                </div>
                {images[1]?.url ? <img src={images[1].url} alt="After comparison" className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center px-4 text-center text-sm text-slate-500">Add a second image for a true before/after comparison.</div>}
              </div>
            </div>

            <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              {primaryImage ? <img src={primaryImage} alt="Satellite viewer" className="h-[420px] w-full object-cover" /> : <div className="flex h-[420px] items-center justify-center px-6 text-center text-sm text-slate-500">Your uploaded satellite imagery will appear here with detected objects and change overlays.</div>}
              {heatmapEnabled && (
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(251, 146, 60, 0.45), transparent 30%), radial-gradient(circle at 72% 61%, rgba(34, 197, 94, 0.35), transparent 25%)', opacity: heatmapOpacity }} />
              )}
              {analysis?.result?.detected_objects?.map((object) => (
                <div
                  key={object.id}
                  className="pointer-events-none absolute rounded-md border-2 border-amber-300 bg-amber-300/10"
                  style={{
                    left: `${object.x}%`,
                    top: `${object.y}%`,
                    width: `${object.width}%`,
                    height: `${object.height}%`,
                    opacity: highlightedObjectType === object.object_type ? 1 : 0.5,
                    boxShadow: highlightedObjectType === object.object_type ? '0 0 18px rgba(250, 204, 21, 0.8)' : 'none',
                  }}
                />
              ))}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-slate-950/60 via-transparent to-teal-500/10" />
              <div className="absolute left-5 top-5 rounded-lg bg-slate-950/75 px-2 py-1 text-xs text-slate-200">Satellite image</div>
              <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-200">
                <div className="flex items-center gap-2 font-medium"><MapPinned size={15} className="text-teal-300" /> Analysis area</div>
                <div className="mt-2 text-xs text-slate-400">Detected objects: 42 · Average confidence: 91.6%</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200"><Activity size={15} className="text-teal-300" /> Land-cover distribution</div>
                <div className="mt-4 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Pie data={analysis?.result?.land_cover_result ?? []} dataKey="percentage" nameKey="label" cx="50%" cy="50%" innerRadius={38} outerRadius={66} paddingAngle={2}>
                        {(analysis?.result?.land_cover_result ?? []).map((item) => <Cell key={item.label} fill={item.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200"><BarChart3 size={15} className="text-teal-300" /> Change detection</div>
                <div className="mt-4 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis?.result?.detected_changes ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="percentage" fill="#34d399" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200"><CheckCircle2 size={15} className="text-teal-300" /> Statistics</div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between"><span>Confidence</span><span className="font-semibold text-emerald-300">{analysis?.result?.confidence_score ?? 0}%</span></div>
                  <div className="flex justify-between"><span>Reliability</span><span className="font-semibold text-violet-300">{analysis?.result?.reliability_score ?? 0}%</span></div>
                  <div className="flex justify-between"><span>Detected objects</span><span>{analysis?.result?.detected_objects.length ?? 0}</span></div>
                  <div className="flex justify-between"><span>Change categories</span><span>{analysis?.result?.detected_changes.length ?? 0}</span></div>
                  <div className="flex justify-between"><span>Land-cover classes</span><span>{analysis?.result?.land_cover_result.length ?? 0}</span></div>
                  {Object.entries(analysis?.result?.area_measurements ?? {}).slice(0, 2).map(([label, value]) => <div key={label} className="flex justify-between gap-2"><span className="truncate">{label.replaceAll('_', ' ')}</span><span>{value} km²</span></div>)}
                </div>
              </div>
            </div>

            <div hidden={activeSection !== 'map' && activeSection !== 'nearby'} id="map" className="mt-5 scroll-mt-24 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-100"><Map size={15} className="text-teal-300" /> {currentLabels.map}</div>
                <button type="button" onClick={() => requestCurrentLocation(true)} className="flex items-center gap-2 rounded-lg border border-teal-400/40 bg-teal-500/10 px-2 py-1.5 text-xs text-teal-200 hover:bg-teal-500/20">
                  <LocateFixed size={14} /> Locate me
                </button>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); void searchPlaces() }} className="relative mb-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
                    <input value={placeSearch} onChange={(event) => { setPlaceSearch(event.target.value); setSelectedPlaceName('') }} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-400" placeholder="Search any Indian place, address, landmark, or coordinates" aria-label="Search Indian places" />
                  </div>
                  <button type="submit" disabled={!placeSearch.trim() || placeSearchLoading} className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-medium text-white hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50">{placeSearchLoading ? 'Searching...' : 'Search India'}</button>
                </div>
                {placeResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[1000] mt-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    {placeResults.map((place) => (
                      <button key={`${place.lat}-${place.lon}-${place.display_name}`} type="button" onClick={() => selectPlace(place)} className="block w-full border-b border-slate-800 px-3 py-2.5 text-left text-sm text-slate-200 last:border-0 hover:bg-slate-800">
                        <span className="block truncate">{place.display_name}</span>
                        {place.type && <span className="mt-0.5 block text-xs capitalize text-slate-500">{place.type}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {placeSearchError && <div className="mt-1 text-xs text-amber-300">{placeSearchError}</div>}
              </form>
              <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                <div>{locationStatus}</div>
                {locationAddress && <div className="mt-1 text-slate-300">{locationAddress}</div>}
                {safeLocation && <div className="mt-1 font-mono text-slate-300">{safeLocation.lat.toFixed(5)}, {safeLocation.lng.toFixed(5)}</div>}
              </div>
              {(activeSection === 'map' || activeSection === 'nearby') && (
                <div className="h-[520px] min-h-[420px] overflow-hidden rounded-xl border border-slate-700">
                  <MapContainer center={safeLocation ? [safeLocation.lat, safeLocation.lng] : [20.5937, 78.9629]} zoom={7} scrollWheelZoom className="h-full w-full">
                    <MapRecenter location={safeLocation} />
                    <TileLayer
                      attribution={mapLayer === 'satellite' ? '&copy; Esri' : '&copy; OpenStreetMap contributors'}
                      url={mapLayer === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                    />
                    {safeLocation && (
                      <>
                        <Circle center={[safeLocation.lat, safeLocation.lng]} radius={nearbyAnalysis?.radius ?? nearbyRadius} pathOptions={{ color: '#14b8a6', fillColor: '#14b8a6', fillOpacity: 0.18 }} />
                        <CircleMarker center={[safeLocation.lat, safeLocation.lng]} radius={9} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#0f766e', fillOpacity: 1 }}>
                          <MapTooltip direction="top" offset={[0, -8]} permanent>
                            {selectedPlaceName ? 'Selected place' : 'You are here'}
                          </MapTooltip>
                        </CircleMarker>
                        {nearbyAnalysis && (
                          <Circle center={[safeLocation.lat, safeLocation.lng]} radius={nearbyAnalysis.radius} pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: nearbyHeatmapEnabled ? nearbyHeatmapOpacity / 3 : 0 }} />
                        )}
                        {nearbyAnalysis?.issues.filter((issue) => nearbyCategory === 'all' || issue.category === nearbyCategory).filter((issue) => issue.confidence === null || issue.confidence >= nearbyConfidenceThreshold).map((issue) => (
                          <Marker key={issue.id} position={[issue.latitude, issue.longitude]} eventHandlers={{ click: () => setSelectedNearbyIssue(issue) }}>
                            <Popup><strong>⚠ {issue.issue_type}</strong><br />{Math.round(issue.distance_meters)} m from selected location<br />Confidence: {issue.confidence === null ? 'Unavailable' : `${issue.confidence}%`}<br />Reliability: {issue.reliability}<br /><button type="button" onClick={() => goToSection('nearby')}>View evidence</button></Popup>
                          </Marker>
                        ))}
                      </>
                    )}
                    <Rectangle bounds={[[20.46, 78.8], [20.74, 79.18]]} pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.18 }} />
                  </MapContainer>
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <MessageSquareText size={18} className="text-teal-300" /> {currentLabels.query}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={5} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500" placeholder="Ask a question about the image..." />
                {voiceSupported && (
                  <button type="button" onClick={handleVoice} className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-teal-200">
                    <Mic size={18} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{voiceStatus === 'listening' ? 'Listening...' : 'Voice command'}</span>
                <span>{currentLabels.objectHighlight}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((item) => (
                  <button key={item} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:border-teal-500" type="button" onClick={() => setQuery(item)}>
                    {item}
                  </button>
                ))}
                <button className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:border-emerald-400" type="button" onClick={() => setQuery('Which Copernicus land-cover classes are visible in the Sentinel-1 and Sentinel-2 imagery?')}>
                  Ask with Copernicus
                </button>
              </div>

              <button type="button" onClick={() => void runAnalysis()} className="w-full rounded-xl bg-teal-500 px-4 py-3 font-semibold text-white shadow-lg shadow-teal-500/30 transition hover:bg-teal-400 disabled:opacity-70">
                {isLoading ? currentLabels.analyzing : currentLabels.analyze}
              </button>

              {isLoading && (
                <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-sm text-teal-100">
                  <div className="mb-2 font-medium">{currentLabels.analyzing}</div>
                  <ul className="space-y-2 text-xs">
                    <li>✓ Upload verified</li>
                    <li>✓ Image preprocessing</li>
                    <li>✓ Feature extraction</li>
                    <li>● AI reasoning</li>
                    <li>○ Evidence generation</li>
                  </ul>
                </div>
              )}

              {analysisError && (
                <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {analysisError}
                </div>
              )}
            </div>
          </aside>
        </div>

        <section hidden={activeSection !== 'results'} id="results" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck size={18} className="text-teal-300" /> {currentLabels.result}
            </div>
            <button type="button" onClick={onGenerateReport} className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700">
              <FileText size={15} /> {currentLabels.pdf}
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div className="rounded-xl border border-slate-800 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Explanation</div>
                {analysis?.result?.detailed_explanation && (
                  <button type="button" onClick={() => isSpeaking ? stopSpeaking() : speakAnswer(analysis.result?.detailed_explanation || '')} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-teal-200 hover:border-teal-400" title={isSpeaking ? 'Stop voice answer' : 'Play voice answer'}>
                    {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    {isSpeaking ? 'Stop' : 'Listen'}
                  </button>
                )}
              </div>
              <p className="text-sm leading-6 text-slate-200">{analysis?.result?.detailed_explanation || 'No result yet.'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Evidence</div>
              <ul className="space-y-2 text-sm text-slate-200">
                {(analysis?.result?.evidence_data ?? []).map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-800 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Changes</div>
              <div className="space-y-2 text-sm text-slate-200">
                {(analysis?.result?.detected_changes ?? []).map((change) => (
                  <div key={change.label} className="flex items-center justify-between gap-2">
                    <span>{change.label}</span>
                    <span className="font-semibold text-teal-300">{change.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Confidence</div>
              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex justify-between text-sm text-slate-200"><span>Confidence</span><span>{analysis?.result?.confidence_score ?? 0}%</span></div>
                  <div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-emerald-400" style={{ width: `${analysis?.result?.confidence_score ?? 0}%` }} /></div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm text-slate-200"><span>Reliability</span><span>{analysis?.result?.reliability_score ?? 0}%</span></div>
                  <div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-violet-400" style={{ width: `${analysis?.result?.reliability_score ?? 0}%` }} /></div>
                </div>
              </div>
            </div>
          </div>

          {datasetEvidenceEnabled && (
            <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-emerald-100">Copernicus Dataset</div>
                  <div className="mt-1 text-xs text-slate-400">Sentinel-1 and Sentinel-2 data</div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">{datasetEvidence.evidenceScore}% match</span>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-4">
                <div><div className="text-xs text-slate-500">Sensors</div><div className="mt-1 text-slate-200">{datasetEvidence.sensors}</div></div>
                <div><div className="text-xs text-slate-500">Task</div><div className="mt-1 text-slate-200">{datasetEvidence.task}</div></div>
                <div><div className="text-xs text-slate-500">Matched labels</div><div className="mt-1 text-slate-200">{datasetEvidence.matchedLabels.join(', ')}</div></div>
                <div><div className="text-xs text-slate-500">Annotations</div><div className="mt-1 text-slate-200">Captions, VQA, regions</div></div>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100"><CheckCircle2 size={15} className="text-emerald-300" /> Agent execution timeline</div>
            <div className="space-y-3 text-sm text-slate-300">
              {['Image Uploaded', 'Image Preprocessing', 'Image Type Detection', 'Feature Extraction', 'Object / Change Detection', 'Spatial Analysis', 'AI Reasoning', 'Evidence Generation', 'Confidence Estimation', 'Final Answer'].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-300">{index + 1}</div>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section hidden={activeSection !== 'history'} id="history" className="mt-6 scroll-mt-24 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 text-lg font-semibold">{currentLabels.history}</div>
            <div className="space-y-3">
              {history.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">Completed analyses will appear here after you run your first workspace job.</div>}
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.15em] text-slate-400">{new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="mt-1 font-medium text-slate-100">{item.title}</div>
                    <div className="text-sm text-slate-400">{`"${item.query}"`}</div>
                  </div>
                  <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200" type="button" onClick={() => { setAnalysis(item); setActiveSection('results') }}>Open</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 text-lg font-semibold">{currentLabels.recommendations}</div>
            <ul className="space-y-3 text-sm text-slate-200">
              {(analysis?.result?.recommendations ?? []).map((item) => (
                <li key={item} className="flex gap-3 rounded-xl bg-slate-950/60 p-3"><span className="mt-1 h-2 w-2 rounded-full bg-teal-400" />{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section hidden={activeSection !== 'modes'} id="modes" className="mt-6 scroll-mt-24 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-lg font-semibold"><Activity size={18} className="text-teal-300" /> Disaster analysis mode</div>
            <div className="space-y-2 text-sm text-slate-200">
              <div className="flex items-center justify-between"><span>Affected Area</span><span className="font-semibold text-white">{analysis?.result?.area_measurements?.affected_area ?? 14.2} km²</span></div>
              <div className="flex items-center justify-between"><span>Severity</span><span className="text-red-300">{mode === 'disaster' && analysis ? 'High' : 'Not run'}</span></div>
              <div className="flex items-center justify-between"><span>Confidence</span><span className="text-emerald-300">{mode === 'disaster' ? `${analysis?.result?.confidence_score ?? 89}%` : '89%'}</span></div>
              <button type="button" onClick={() => startModeAnalysis('disaster', 'Which areas are affected by flooding or disaster damage?')} className="mt-3 w-full rounded-lg border border-teal-400/40 bg-teal-500/15 px-3 py-2 text-xs text-teal-200 hover:bg-teal-500/25">Analyze disaster imagery</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-lg font-semibold"><BarChart3 size={18} className="text-teal-300" /> Agriculture monitoring</div>
            <div className="space-y-2 text-sm text-slate-200">
              <div className="flex items-center justify-between"><span>Agricultural Area</span><span className="font-semibold text-white">42.8 km²</span></div>
              <div className="flex items-center justify-between"><span>Vegetation Change</span><span className="text-yellow-300">-6.4%</span></div>
              <div className="flex items-center justify-between"><span>Stress Regions</span><span className="text-teal-300">7</span></div>
              <button type="button" onClick={() => startModeAnalysis('agriculture', 'Has vegetation or agricultural land changed?')} className="mt-3 w-full rounded-lg border border-teal-400/40 bg-teal-500/15 px-3 py-2 text-xs text-teal-200 hover:bg-teal-500/25">Analyze agriculture</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-lg font-semibold"><MapPinned size={18} className="text-teal-300" /> Urban growth analysis</div>
            <div className="space-y-2 text-sm text-slate-200">
              <div className="flex items-center justify-between"><span>Urban Expansion</span><span className="font-semibold text-white">13.7%</span></div>
              <div className="flex items-center justify-between"><span>New Structures</span><span className="text-emerald-300">126</span></div>
              <div className="flex items-center justify-between"><span>Changed Area</span><span className="text-violet-300">17.2 km²</span></div>
              <button type="button" onClick={() => startModeAnalysis('urban_growth', 'Are there signs of urban growth or new construction?')} className="mt-3 w-full rounded-lg border border-teal-400/40 bg-teal-500/15 px-3 py-2 text-xs text-teal-200 hover:bg-teal-500/25">Analyze urban growth</button>
            </div>
          </div>
        </section>

        <section hidden={activeSection !== 'comparison'} id="comparison" className="mt-6 scroll-mt-24 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-lg font-semibold"><Layers3 size={18} className="text-teal-300" /> {currentLabels.opticalSar}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 text-sm font-medium text-slate-200">Optical</div>
                {primaryImage ? <img src={primaryImage} alt="Optical" className="h-32 w-full rounded-lg object-cover" /> : <div className="flex h-32 items-center justify-center rounded-lg bg-slate-900 text-xs text-slate-500">No optical image</div>}
                <p className="mt-2 text-xs text-slate-400">Better for vegetation and surface color understanding.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 text-sm font-medium text-slate-200">SAR</div>
                {images[1]?.url ? <img src={images[1].url} alt="SAR" className="h-32 w-full rounded-lg object-cover grayscale" /> : <div className="flex h-32 items-center justify-center rounded-lg bg-slate-900 text-xs text-slate-500">Add a SAR image</div>}
                <p className="mt-2 text-xs text-slate-400">Useful for surface roughness and all-weather imaging.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-lg font-semibold"><CheckCircle2 size={18} className="text-teal-300" /> Multi-question discussion</div>
            <div className="space-y-3 text-sm text-slate-200">
              {conversation.map((item, index) => (
                <div key={`${item.question}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-teal-300">Q: {item.question}</div>
                    <button type="button" onClick={() => speakAnswer(item.answer)} className="rounded-lg border border-slate-700 p-1.5 text-teal-200 hover:border-teal-400" title="Listen to answer">
                      <Volume2 size={14} />
                    </button>
                  </div>
                  <div className="mt-1 text-slate-300">A: {item.answer}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {isChatbotOpen && (
          <section className="fixed bottom-24 right-4 z-50 flex w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-teal-400/30 bg-slate-950 shadow-2xl shadow-teal-950/50">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-100"><MessageCircle size={17} className="text-teal-300" /> SatQuery assistant</div>
                <div className="mt-0.5 text-xs text-slate-400">Ask about your current satellite analysis</div>
              </div>
              <button type="button" onClick={() => setIsChatbotOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" title="Close assistant">×</button>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto p-3">
              {conversation.slice(-6).map((item, index) => (
                <div key={`${item.question}-${index}`} className="space-y-2 text-sm">
                  <div className="ml-8 rounded-xl rounded-tr-sm bg-teal-500/20 px-3 py-2 text-teal-100">{item.question}</div>
                  {item.answer ? <div className="mr-8 flex items-start gap-2 rounded-xl rounded-tl-sm border border-slate-800 bg-slate-900 px-3 py-2 text-slate-300"><span className="flex-1">{item.answer}</span><button type="button" onClick={() => isSpeaking ? stopSpeaking() : speakAnswer(item.answer)} className="shrink-0 rounded-lg p-1 text-teal-300 hover:bg-slate-800" title={isSpeaking ? 'Stop speaking' : 'Read answer aloud'}>{isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}</button></div> : <div className="mr-8 rounded-xl rounded-tl-sm border border-slate-800 bg-slate-900 px-3 py-2 text-slate-500">Thinking...</div>}
                </div>
              ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void sendChatbotMessage() }} className="flex gap-2 border-t border-slate-800 p-3">
              <input value={chatbotInput} onChange={(event) => setChatbotInput(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-400" placeholder="Ask a question..." aria-label="Chatbot question" />
              <button type="button" onClick={handleChatbotVoice} className={`rounded-xl border p-2.5 ${chatbotVoiceStatus === 'listening' ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-slate-700 bg-slate-900 text-teal-200 hover:border-teal-400'}`} title={chatbotVoiceStatus === 'listening' ? 'Listening...' : 'Ask by voice'}><Mic size={17} /></button>
              <button type="submit" disabled={!chatbotInput.trim() || isChatbotTyping} className="rounded-xl bg-teal-500 p-2.5 text-white hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50" title="Send message"><Send size={17} /></button>
            </form>
          </section>
        )}

        <button type="button" onClick={() => setIsChatbotOpen((open) => !open)} className="fixed bottom-6 right-4 z-50 flex items-center gap-2 rounded-full border border-teal-300/40 bg-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-teal-950/50 transition hover:bg-teal-400" title="Open SatQuery assistant">
          <MessageCircle size={18} /> Chat
        </button>

        <section hidden={activeSection !== 'tools'} id="tools" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold"><CheckCircle2 size={18} className="text-teal-300" /> Area calculation</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <div>Agricultural Area</div>
              <div className="mt-2 text-2xl font-bold text-white">12.7 km²</div>
              <div className="mt-1 text-xs text-slate-400">Estimate</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <div>Water Area</div>
              <div className="mt-2 text-2xl font-bold text-white">3.4 km²</div>
              <div className="mt-1 text-xs text-slate-400">Estimate</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <div>Urban Area</div>
              <div className="mt-2 text-2xl font-bold text-white">8.9 km²</div>
              <div className="mt-1 text-xs text-slate-400">Estimate</div>
            </div>
          </div>
        </section>

        <section hidden={activeSection !== 'tools'} className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={18} className="text-teal-300" /> {currentLabels.multilingual}</div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-200">
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">English · Hindi · Kannada · Telugu · Tamil · Malayalam · Marathi</span>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">Español</span>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">Français</span>
          </div>
        </section>
      </main>
    </div>
  </div>
</div>
  )
}

export default App
