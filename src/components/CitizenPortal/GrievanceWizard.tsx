import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  MapPin,
  Camera,
  Volume2,
  VolumeX,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Info,
  Clock,
  Send,
  Building,
  Image as ImageIcon,
  Flame,
  UserCheck,
  Compass,
} from 'lucide-react';
import { classifyComplaintAI, submitComplaint } from '../../services/api';
import { TRANSLATIONS, LANGUAGES } from '../../i18n/translations';
import { SupportedLanguage, CitizenComplaint } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { InteractiveMap } from '../Common/InteractiveMap';

interface GrievanceWizardProps {
  language: SupportedLanguage;
  onViewGrievance: (complaintId: string) => void;
  onGoToLedger: () => void;
}

export const GrievanceWizard: React.FC<GrievanceWizardProps> = ({
  language,
  onViewGrievance,
  onGoToLedger,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const currentLangObj = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  const { user, openAuthModal } = useAuth();

  // Steps: 'input' -> 'confirm' -> 'success'
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');

  // Input states - INITIALIZED CLEANLY WITHOUT DEMO NAMES OR LOCATIONS
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [inputText, setInputText] = useState('');
  
  // Use authenticated user's name/phone if signed in, otherwise blank
  const [citizenName, setCitizenName] = useState(
    user && user.role === 'citizen' ? user.name : ''
  );
  const [citizenPhone, setCitizenPhone] = useState(
    user && user.role === 'citizen' ? user.phone : ''
  );
  const [citizenEmail, setCitizenEmail] = useState(
    user && user.role === 'citizen' ? user.email || '' : ''
  );

  // Clean location fields (no hardcoded personal addresses)
  const [locationText, setLocationText] = useState('');
  const [ward, setWard] = useState('Ward 14 (Central Zone)');
  const [latLong, setLatLong] = useState({ lat: 26.9124, lng: 75.7873 });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Sync user if auth changes
  useEffect(() => {
    if (user && user.role === 'citizen') {
      if (!citizenName) setCitizenName(user.name);
      if (!citizenPhone) setCitizenPhone(user.phone);
      if (user.email && !citizenEmail) setCitizenEmail(user.email);
    }
  }, [user]);

  // Voice recording states
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Confirmation AI analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiData, setAiData] = useState<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    department_id: string;
    department_name: string;
    ai_summary: string;
    confirmation_readback: string;
    suggested_action: string;
  } | null>(null);

  // Audio playback state (readback loop)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    is_duplicate: boolean;
    duplicate_of?: string;
    complaint: CitizenComplaint;
    message: string;
  } | null>(null);

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Stop after utterance to automatically triage!
      recognition.interimResults = true;
      recognition.lang = currentLangObj.speechCode;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          const updated = finalTranscript.trim();
          setInputText((prev) => (prev ? `${prev} ${updated}` : updated));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setSpeechError(`Voice input: ${event.error}. You can also type or use speech.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, currentLangObj.speechCode]);

  // Audio readback playback
  const playReadback = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLangObj.speechCode;
    utterance.rate = 0.95;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  };

  // AUTOMATIC TRIAGE & VOCALIZATION AFTER SPEAKING
  // As requested: "will it atoamtically tell what the complaint is abot after i speak the comaplint before loading the complain"
  const handleAutoTriageAndSpeak = async (textToTriage: string) => {
    const text = textToTriage.trim();
    if (!text) return;

    setIsAnalyzing(true);
    try {
      // First, play a brief auditory notification that analysis is in progress
      const analyzingUtterance =
        language === 'hi'
          ? 'आपकी शिकायत का विश्लेषण किया जा रहा है...'
          : 'Analyzing your complaint...';
      playReadback(analyzingUtterance);

      const result = await classifyComplaintAI(text, currentLangObj.label);
      setAiData(result);
      setStep('confirm');

      // Seamless automatic verbal readout: tell what the complaint is about!
      setTimeout(() => {
        playReadback(result.confirmation_readback);
      }, 700);
    } catch (err) {
      console.error('AI classification error:', err);
      const fallback = {
        category: 'Civic Infrastructure',
        severity: 'medium' as const,
        department_id: 'dept-roads',
        department_name: 'Roads & Infrastructure',
        ai_summary: text.slice(0, 100),
        confirmation_readback: `I understood: ${text.slice(0, 80)}. Is this correct?`,
        suggested_action: 'Dispatch field inspection crew.',
      };
      setAiData(fallback);
      setStep('confirm');
      setTimeout(() => {
        playReadback(fallback.confirmation_readback);
      }, 700);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle Voice Listening
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      // If we have text, automatically tell what the complaint is about!
      if (inputText.trim()) {
        handleAutoTriageAndSpeak(inputText);
      }
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Speech recognition start failed:', e);
        setIsListening(true);
        // Simulation fallback for browser without permission
        setTimeout(() => {
          const sample =
            language === 'hi'
              ? 'मुख्य सड़क पर बहुत बड़ा गड्ढा हो गया है, जलभराव के कारण दोपहिया वाहन गिर रहे हैं।'
              : 'Severe deep road pothole with stagnant water causing two-wheelers to slip.';
          setInputText(sample);
          setIsListening(false);
          handleAutoTriageAndSpeak(sample);
        }, 2500);
      }
    }
  };

  // Auto-detect GPS location
  const handleDetectLocation = () => {
    setIsDetectingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setLatLong({ lat, lng });
          setLocationText(`GPS Location: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`);
          setIsDetectingLocation(false);
        },
        (_err) => {
          setLatLong({ lat: 26.9124, lng: 75.7873 });
          setLocationText('Municipal Ward 14, Central Sector');
          setIsDetectingLocation(false);
        },
        { timeout: 6000 }
      );
    } else {
      setIsDetectingLocation(false);
    }
  };

  // Final Step: Submit grievance to backend
  const handleSubmitGrievance = async () => {
    if (!aiData || isSubmitting) return;
    setIsSubmitting(true);
    stopAudio();

    try {
      const res = await submitComplaint({
        citizen_name: citizenName.trim() || 'Anonymous Citizen',
        citizen_phone: citizenPhone.trim() || '+91 90000 00000',
        citizen_email: citizenEmail.trim() || undefined,
        preferred_language: currentLangObj.label,
        raw_input_text: inputText,
        latitude: latLong.lat,
        longitude: latLong.lng,
        address_text: locationText || `${latLong.lat.toFixed(4)}° N, ${latLong.lng.toFixed(4)}° E`,
        ward,
        photo_url: photoUrl || undefined,
        override_category: aiData.category,
        override_severity: aiData.severity,
        override_department_id: aiData.department_id,
      });

      setSubmissionResult(res);
      setStep('success');
    } catch (err: any) {
      alert(`Submission error: ${err.message || 'Could not reach server'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 font-sans-civic">
      {/* ---------------------------------------------------- */}
      {/* STEP 1: VOICE-FIRST FILING SCREEN                    */}
      {/* ---------------------------------------------------- */}
      {step === 'input' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="border-b border-[var(--line)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-[var(--green)]">
                Civic Redressal Portal
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold font-serif-civic text-[var(--ink)] mt-1">
                {t.fileGrievance}
              </h2>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                Speak your complaint aloud. Our AI automatically transcribes, explains what it understood, and verifies with you before dispatching.
              </p>
            </div>

            {/* Auth / Account indicator */}
            {!user ? (
              <button
                type="button"
                onClick={() => openAuthModal('citizen')}
                className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--card)] hover:bg-[var(--bg2)] text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <UserCheck className="w-3.5 h-3.5 text-[var(--green)]" />
                <span>Sign In (Optional)</span>
              </button>
            ) : (
              <div className="self-start sm:self-auto bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs text-emerald-900 font-medium">
                Signed in as: <strong className="font-semibold">{user.name}</strong>
              </div>
            )}
          </div>

          {/* Primary Input Container */}
          <div className="bg-[var(--card)] border-2 border-[var(--line)] rounded-2xl p-6 shadow-sm space-y-6">
            {/* Mode Switcher (Voice vs Text) */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <span className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">
                Select Reporting Method
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode('voice')}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                    mode === 'voice'
                      ? 'bg-[var(--green)] text-white'
                      : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                  }`}
                >
                  🎙️ Speak Aloud (Voice)
                </button>
                <button
                  onClick={() => setMode('text')}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
                    mode === 'text'
                      ? 'bg-[var(--green)] text-white'
                      : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                  }`}
                >
                  ⌨️ Type Text
                </button>
              </div>
            </div>

            {/* VOICE-FIRST SECTION (Dominant central action with auto-tell) */}
            {mode === 'voice' && (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                <div className="relative">
                  {isListening && (
                    <div className="absolute inset-0 rounded-full bg-[var(--green)] opacity-25 animate-ping" />
                  )}
                  <button
                    onClick={toggleListening}
                    className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all transform active:scale-95 shadow-md ${
                      isListening
                        ? 'bg-[var(--brick)] text-white scale-105'
                        : 'bg-[var(--green)] hover:bg-[var(--green-deep)] text-white'
                    }`}
                    title={isListening ? 'Click when done speaking' : 'Click to speak'}
                    aria-label="Speak complaint"
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-8 h-8 animate-pulse" />
                        <span className="text-[10px] font-bold mt-1">DONE</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-8 h-8" />
                        <span className="text-[10px] font-bold mt-1">SPEAK</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-[var(--ink)]">
                    {isListening ? 'Listening to your grievance...' : t.speakComplaint}
                  </h3>
                  <p className="text-xs text-[var(--ink-soft)] max-w-sm mt-1">
                    {isListening
                      ? 'Speak clearly in your language. Tap "DONE" when finished to hear what the AI understood!'
                      : `Tap the microphone to speak in ${currentLangObj.nativeName}. The AI will verbally read back its understanding.`}
                  </p>
                </div>

                {/* Animated waves when recording */}
                {isListening && (
                  <div className="flex items-center gap-1.5 h-6">
                    <span className="w-1 bg-[var(--green)] h-3 rounded-full animate-bounce" />
                    <span className="w-1 bg-[var(--green)] h-5 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1 bg-[var(--green)] h-4 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 bg-[var(--green)] h-6 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1 bg-[var(--green)] h-2 rounded-full animate-bounce [animation-delay:0.25s]" />
                  </div>
                )}

                {speechError && (
                  <p className="text-xs text-[var(--brick)] bg-red-50 p-2 rounded-lg border border-red-200">
                    {speechError}
                  </p>
                )}
              </div>
            )}

            {/* Transcript / Text Input Display */}
            <div>
              <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">
                {mode === 'voice' ? 'Transcribed Complaint Text:' : 'Complaint Details:'}
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  mode === 'voice'
                    ? 'Spoken words appear here automatically...'
                    : 'Describe the civic problem (e.g. road damage, broken street pole, water leak, overflowing garbage)...'
                }
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--green)] text-sm resize-y leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-[var(--ink-soft)] mt-1">
                <span>{inputText.length} characters</span>
                {inputText && (
                  <button
                    onClick={() => setInputText('')}
                    className="hover:text-[var(--brick)] underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* GOOGLE MAP & GEOLOCATION INTEGRATION */}
            <div className="space-y-3 pt-2 border-t border-[var(--line)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-[var(--green)]" />
                  Interactive Map & Defect Pinpoint:
                </span>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="text-xs text-[var(--green)] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{isDetectingLocation ? 'Detecting GPS...' : 'Auto-Detect My GPS'}</span>
                </button>
              </div>

              {/* Live Interactive Map with Google Maps Link & Draggable Pin */}
              <InteractiveMap
                latitude={latLong.lat}
                longitude={latLong.lng}
                onLocationChange={(newLat, newLng) => {
                  setLatLong({ lat: newLat, lng: newLng });
                  setLocationText(`Geotagged Pin: ${newLat.toFixed(4)}° N, ${newLng.toFixed(4)}° E`);
                }}
                interactive={true}
                height="220px"
              />

              {/* Location Text Input & Ward */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                    Street Address / Landmark:
                  </label>
                  <input
                    type="text"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="Enter street name, colony or landmark..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                    Municipal Ward:
                  </label>
                  <select
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] cursor-pointer"
                  >
                    <option value="Ward 14 (Central Zone)">Ward 14 (Central Zone)</option>
                    <option value="Ward 8 (East Zone)">Ward 8 (East Zone)</option>
                    <option value="Ward 11 (Civil Lines)">Ward 11 (Civil Lines)</option>
                    <option value="Ward 22 (South Zone)">Ward 22 (South Zone)</option>
                    <option value="Ward 29 (West Zone)">Ward 29 (West Zone)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Photo Attachment & Citizen Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--line)]">
              {/* Photo */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Photo Evidence (Optional):
                </label>
                {photoUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-[var(--line)] h-24 bg-black flex items-center justify-center">
                    <img src={photoUrl} alt="Attached issue" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPhotoUrl(null)}
                      className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="border border-dashed border-[var(--line)] hover:border-[var(--green)] rounded-lg p-3 text-center cursor-pointer bg-[var(--bg)] block">
                    <Camera className="w-4 h-4 mx-auto text-[var(--ink-soft)]" />
                    <span className="text-[11px] text-[var(--ink-soft)] block mt-1">Take Photo / Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => setPhotoUrl(event.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Citizen Contact Info */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink)]">
                    Your Name:
                  </label>
                  <input
                    type="text"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    placeholder="Enter your name..."
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-[var(--line)] bg-[var(--bg)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink)]">
                    Phone Number:
                  </label>
                  <input
                    type="text"
                    value={citizenPhone}
                    onChange={(e) => setCitizenPhone(e.target.value)}
                    placeholder="+91 Mobile number..."
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-[var(--line)] bg-[var(--bg)] font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Action Button: Review & Auto-Tell */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleAutoTriageAndSpeak(inputText)}
                disabled={!inputText.trim() || isAnalyzing}
                className={`w-full py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm ${
                  !inputText.trim() || isAnalyzing
                    ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                    : 'bg-[var(--green)] hover:bg-[var(--green-deep)] text-white'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing & preparing audio summary...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Review Complaint & Listen to AI Summary</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* STEP 2: MANDATORY AI CONFIRMATION & AUDIO READBACK   */}
      {/* ("Tell what the complaint is about before loading")  */}
      {/* ---------------------------------------------------- */}
      {step === 'confirm' && aiData && (
        <div className="space-y-6">
          <div className="border-b border-[var(--line)] pb-4 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-[var(--ochre)]">
                Pre-Lodging Verification
              </span>
              <h2 className="text-2xl font-bold font-serif-civic text-[var(--ink)] mt-1">
                {t.confirmTitle}
              </h2>
            </div>
            <button
              onClick={() => {
                stopAudio();
                setStep('input');
              }}
              className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Edit</span>
            </button>
          </div>

          {/* Verification Notice Card */}
          <div className="bg-[var(--card)] border-2 border-[var(--green)] rounded-2xl p-6 shadow-md space-y-6">
            {/* Audio Readout Banner: Tells citizen what was understood */}
            <div className="bg-[var(--bg2)] border border-[var(--line)] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[11px] uppercase font-bold text-[var(--green)] tracking-wider block">
                  AI Spoken Understanding:
                </span>
                <p className="text-sm font-medium text-[var(--ink)]">
                  "{aiData.confirmation_readback}"
                </p>
                <span className="text-xs text-[var(--ink-soft)]">
                  Spoken aloud to verify before submitting into the official register.
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  isPlayingAudio ? stopAudio() : playReadback(aiData.confirmation_readback)
                }
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  isPlayingAudio
                    ? 'bg-[var(--brick)] text-white'
                    : 'bg-[var(--green)] text-white hover:bg-[var(--green-deep)]'
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <VolumeX className="w-4 h-4 animate-pulse" />
                    <span>Stop Audio</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Listen Again</span>
                  </>
                )}
              </button>
            </div>

            {/* Triaged Details Ledger Block */}
            <div className="border border-[var(--line)] rounded-xl divide-y divide-[var(--line)] bg-[var(--bg)] text-xs">
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[var(--ink-soft)] font-medium">Auto-Assigned Department:</span>
                <span className="font-semibold text-[var(--ink)] text-sm flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[var(--green)]" />
                  {aiData.department_name}
                </span>
              </div>

              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[var(--ink-soft)] font-medium">Classified Category:</span>
                <span className="font-semibold text-[var(--ink)]">{aiData.category}</span>
              </div>

              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[var(--ink-soft)] font-medium">Severity Assessment:</span>
                <span
                  className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs ${
                    aiData.severity === 'critical'
                      ? 'bg-red-100 text-[var(--brick)] border border-red-300'
                      : aiData.severity === 'high'
                      ? 'bg-orange-100 text-orange-800'
                      : aiData.severity === 'medium'
                      ? 'bg-amber-100 text-[var(--ochre)]'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {aiData.severity === 'critical' && <Flame className="w-3 h-3 text-[var(--brick)]" />}
                  {aiData.severity.toUpperCase()} PRIORITY
                </span>
              </div>

              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[var(--ink-soft)] font-medium">Location on Map:</span>
                <span className="font-medium text-[var(--ink)] text-right">
                  {locationText || `${latLong.lat.toFixed(4)}° N, ${latLong.lng.toFixed(4)}° E`} ({ward})
                </span>
              </div>

              <div className="p-3.5 space-y-1">
                <span className="text-[var(--ink-soft)] font-medium block">Executive AI Summary:</span>
                <p className="text-[var(--ink)] font-serif-civic text-sm leading-relaxed">
                  {aiData.ai_summary}
                </p>
              </div>
            </div>

            {/* Confirm Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleSubmitGrievance}
                disabled={isSubmitting}
                className="w-full sm:flex-1 py-3 px-6 rounded-xl font-medium text-sm bg-[var(--green)] hover:bg-[var(--green-deep)] text-white flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Lodge & Dispatching to Department...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Yes, this is correct — Lodge Complaint</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopAudio();
                  setStep('input');
                }}
                disabled={isSubmitting}
                className="w-full sm:w-auto py-3 px-5 rounded-xl font-medium text-xs border border-[var(--line)] hover:bg-[var(--bg2)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
              >
                No, edit my complaint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* STEP 3: SUBMISSION SUCCESS & DISPATCH RECEIPT        */}
      {/* ---------------------------------------------------- */}
      {step === 'success' && submissionResult && (
        <div className="space-y-6">
          <div className="bg-[var(--card)] border-2 border-[var(--green)] rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-md">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 text-[var(--green)] flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider font-mono font-bold text-[var(--green)]">
                OFFICIAL CIVIC GRIEVANCE LODGED
              </span>
              <h2 className="text-3xl font-bold font-serif-civic text-[var(--ink)] mt-1">
                #{submissionResult.complaint.id}
              </h2>
            </div>

            {submissionResult.is_duplicate ? (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-left space-y-1">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Deduplication Cluster Notice</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {submissionResult.message}
                </p>
                <div className="text-[11px] font-medium text-amber-700 mt-1">
                  Reported by <strong>{submissionResult.complaint.report_count}</strong> citizens in this municipal sector. Priority boosted.
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 text-left">
                {submissionResult.message}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onViewGrievance(submissionResult.complaint.id)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Track this Grievance
              </button>

              <button
                type="button"
                onClick={onGoToLedger}
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-[var(--line)] bg-[var(--card)] hover:bg-[var(--bg2)] text-[var(--ink)] text-xs font-medium cursor-pointer transition-colors"
              >
                View Full Public Register
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('input');
                  setInputText('');
                  setPhotoUrl(null);
                  setSubmissionResult(null);
                }}
                className="w-full sm:w-auto px-4 py-3 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] underline cursor-pointer"
              >
                Lodge another grievance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
