import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Mic,
  MicOff,
  Phone,
  Smartphone,
  Volume2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/pages/advancedSafety.css';

const VOICE_KEYWORDS = ['help me', 'emergency', 'save me', 'danger'];
const SHAKE_THRESHOLD = 24;
const SHAKE_BURST_TARGET = 3;
const SHAKE_WINDOW_MS = 1400;
const SOUND_RMS_THRESHOLD = 0.22;
const SOUND_PEAK_THRESHOLD = 0.58;
const SOS_COOLDOWN_MS = 6000;
const BACKEND_URL = 'http://localhost:5000';

const playAlarmSound = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1);
};

const playRingtone = (audioContext) => {
  if (!audioContext) return null;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, audioContext.currentTime); // A4
  
  // Create ringing pattern
  gain.gain.setValueAtTime(0, audioContext.currentTime);
  let now = audioContext.currentTime;
  for (let i=0; i<10; i++) {
    gain.gain.linearRampToValueAtTime(1, now + 0.1);
    gain.gain.linearRampToValueAtTime(1, now + 1.5);
    gain.gain.linearRampToValueAtTime(0, now + 1.6);
    now += 3;
  }
  
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(audioContext.currentTime);
  return { osc, gain };
};

const AdvancedSafetyEnhanced = () => {
  const navigate = useNavigate();
  const [voiceListening, setVoiceListening] = useState(false);
  const [shakeDetection, setShakeDetection] = useState(false);
  const [soundDetection, setSoundDetection] = useState(false);
  const [fakeCallStage, setFakeCallStage] = useState('idle');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [shakeLoading, setShakeLoading] = useState(false);
  const [soundLoading, setSoundLoading] = useState(false);
  const [fakeCallLoading, setFakeCallLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [lastTranscript, setLastTranscript] = useState('No voice command detected yet');
  const [soundLevel, setSoundLevel] = useState(0);
  const [fakeCallCountdown, setFakeCallCountdown] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [shakeSensitivity, setShakeSensitivity] = useState(SHAKE_THRESHOLD);
  const ringtoneRef = useRef(null);

  const recognitionRef = useRef(null);
  const voiceActiveRef = useRef(false);
  const voicePermissionStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const soundDetectionRef = useRef(false);
  const soundFrameRef = useRef(null);
  const consecutiveDangerFramesRef = useRef(0);
  const shakeStateRef = useRef({ burstCount: 0, lastMotionAt: 0, lastTriggerAt: 0 });
  const fakeCallTimerRef = useRef(null);
  const fakeCallCountdownRef = useRef(null);
  const sosCooldownRef = useRef(0);

  useEffect(() => {
    setIsInitialized(true);

    return () => {
      stopVoiceSOS(false);
      stopSoundDetection(false);
      clearFakeCallTimers();
      stopRingtone();
    };
  }, []);

  useEffect(() => {
    if (!isInitialized || !shakeDetection) {
      return undefined;
    }

    const handleShake = (event) => {
      const acceleration = event.accelerationIncludingGravity || event.acceleration;
      if (!acceleration) {
        return;
      }

      const x = Math.abs(acceleration.x || 0);
      const y = Math.abs(acceleration.y || 0);
      const z = Math.abs(acceleration.z || 0);
      const intensity = x + y + z;
      const now = Date.now();

      if (intensity < shakeSensitivity) {
        if (now - shakeStateRef.current.lastMotionAt > SHAKE_WINDOW_MS) {
          shakeStateRef.current.burstCount = 0;
        }
        return;
      }

      if (now - shakeStateRef.current.lastMotionAt > SHAKE_WINDOW_MS) {
        shakeStateRef.current.burstCount = 0;
      }

      shakeStateRef.current.lastMotionAt = now;
      shakeStateRef.current.burstCount += 1;

      if (
        shakeStateRef.current.burstCount >= SHAKE_BURST_TARGET &&
        now - shakeStateRef.current.lastTriggerAt > SOS_COOLDOWN_MS
      ) {
        shakeStateRef.current.burstCount = 0;
        shakeStateRef.current.lastTriggerAt = now;
        triggerSOS(`Rapid shake pattern detected (${Math.round(intensity)} motion units)`);
      }
    };

    window.addEventListener('devicemotion', handleShake);
    return () => window.removeEventListener('devicemotion', handleShake);
  }, [isInitialized, shakeDetection]);

  const saveSafetyEvent = async (feature, message, severity) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      await fetch(`${BACKEND_URL}/api/safety-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser?.id || currentUser?.email || 'guest',
          feature,
          message,
          severity,
        }),
      });
    } catch (error) {
      console.error('Safety event sync failed:', error);
    }
  };

  const addAlert = (message, type) => {
    const newAlert = {
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 12));
    saveSafetyEvent('advanced-safety', message, type);
  };

  const clearFakeCallTimers = () => {
    if (fakeCallTimerRef.current) {
      clearTimeout(fakeCallTimerRef.current);
      fakeCallTimerRef.current = null;
    }

    if (fakeCallCountdownRef.current) {
      clearInterval(fakeCallCountdownRef.current);
      fakeCallCountdownRef.current = null;
    }
  };

  const triggerSOS = async (reason) => {
    const now = Date.now();
    if (now - sosCooldownRef.current < SOS_COOLDOWN_MS) {
      addAlert(`SOS already triggered recently. Latest reason: ${reason}`, 'info');
      return;
    }

    sosCooldownRef.current = now;
    addAlert(`SOS triggered: ${reason}`, 'emergency');
    playAlarmSound();
    
    // Get location
    let locationData = {};
    try {
      if (navigator.geolocation) {
         const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
         });
         locationData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch (e) {
      console.error("Could not fetch location API", e);
    }
    
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      await fetch(`${BACKEND_URL}/api/sos/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || currentUser?.email || 'guest',
          source: 'advanced-safety',
          reason: reason,
          location: locationData
        })
      });
      addAlert("Emergency message with location sent successfully", 'success');
    } catch (error) {
      console.error('Failed to send auto SOS to backend:', error);
    }

    setTimeout(() => {
      navigate('/sos');
    }, 1200);
  };

  const stopVoiceSOS = (notify = true) => {
    voiceActiveRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current.abort(); // Force abort to release mic immediately
      } catch (error) {
        console.error('Voice recognition stop error:', error);
      }
    }

    setVoiceListening(false);
    if (notify) {
      addAlert('Voice SOS deactivated', 'info');
    }
  };

  const setupSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .toLowerCase()
        .trim();

      if (!transcript) {
        return;
      }

      setLastTranscript(transcript);
      const keywordDetected = VOICE_KEYWORDS.some((keyword) => transcript.includes(keyword));

      if (keywordDetected) {
        triggerSOS(`Voice keyword detected: "${transcript}"`);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || !voiceActiveRef.current) {
        return;
      }

      console.error('Speech recognition error:', event.error);
      addAlert(`Voice recognition error: ${event.error}`, 'error');
    };

    recognition.onend = () => {
      if (voiceActiveRef.current) {
        try {
          recognition.start();
        } catch (error) {
          console.error('Voice recognition restart error:', error);
          addAlert('Voice listening stopped unexpectedly. Try again.', 'error');
          stopVoiceSOS(false);
        }
      }
    };

    recognitionRef.current = recognition;
  };

  const toggleVoiceSOS = () => {
    setVoiceLoading(true);

    try {
      if (voiceListening || voiceActiveRef.current) {
        stopVoiceSOS();
        setVoiceLoading(false);
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition is not supported in this browser. Try Chrome/Edge.');
      }

      // We MUST initialize and start recognition synchronously within the click event!
      // Using async/await before start() breaks the user gesture and blocks the prompt.
      setupSpeechRecognition();
      recognitionRef.current.start();
      
      voiceActiveRef.current = true;
      setVoiceListening(true);
      addAlert('Voice SOS activated. Say "Help me" or "Emergency".', 'success');
    } catch (error) {
      console.error('Voice SOS toggle error:', error);
      
      if (error.name === 'NotAllowedError') {
         addAlert('Microphone access denied. Please click the lock icon in your URL bar and allow microphone permissions.', 'error');
      } else if (error.name === 'InvalidStateError') {
         addAlert('Voice recognition is already running in the background.', 'info');
      } else {
         addAlert(error.message || 'Unable to activate voice SOS', 'error');
      }
      
      stopVoiceSOS(false);
    } finally {
      setVoiceLoading(false);
    }
  };

  const toggleShakeDetection = async () => {
    setShakeLoading(true);

    try {
      if (shakeDetection) {
        setShakeDetection(false);
        shakeStateRef.current = { burstCount: 0, lastMotionAt: 0, lastTriggerAt: 0 };
        addAlert('Shake detection deactivated', 'info');
        return;
      }

      if (typeof DeviceMotionEvent === 'undefined') {
        throw new Error('Shake detection is not supported on this device');
      }

      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Motion permission denied');
        }
      }

      setShakeDetection(true);
      addAlert('Shake detection activated. Rapid panic movement will trigger SOS.', 'success');
    } catch (error) {
      console.error('Shake detection toggle error:', error);
      addAlert(error.message || 'Unable to activate shake detection', 'error');
    } finally {
      setShakeLoading(false);
    }
  };

  const stopSoundDetection = (notify = true) => {
    soundDetectionRef.current = false;
    consecutiveDangerFramesRef.current = 0;

    if (soundFrameRef.current) {
      cancelAnimationFrame(soundFrameRef.current);
      soundFrameRef.current = null;
    }

    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
      microphoneStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }

    audioContextRef.current = null;
    analyserRef.current = null;
    setSoundDetection(false);
    setSoundLevel(0);

    if (notify) {
      addAlert('Sound detection deactivated', 'info');
    }
  };

  const startSoundDetection = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
      },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Audio analysis is not supported in this browser');
    }

    const audioContext = new AudioContextClass();
    await audioContext.resume();

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    microphoneRef.current = source;
    microphoneStreamRef.current = stream;
    soundDetectionRef.current = true;
    setSoundDetection(true);
    addAlert('Sound detection activated. Loud danger sounds will trigger SOS.', 'success');

    const analyze = () => {
      if (!soundDetectionRef.current || !analyserRef.current) {
        return;
      }

      analyserRef.current.getFloatTimeDomainData(samples);
      let sumSquares = 0;
      let peak = 0;

      for (let i = 0; i < samples.length; i += 1) {
        const value = samples[i];
        sumSquares += value * value;
        peak = Math.max(peak, Math.abs(value));
      }

      const rms = Math.sqrt(sumSquares / samples.length);
      setSoundLevel(rms);

      if (rms > SOUND_RMS_THRESHOLD || peak > SOUND_PEAK_THRESHOLD) {
        consecutiveDangerFramesRef.current += 1;
      } else {
        consecutiveDangerFramesRef.current = Math.max(
          0,
          consecutiveDangerFramesRef.current - 1
        );
      }

      if (consecutiveDangerFramesRef.current >= 5) {
        consecutiveDangerFramesRef.current = 0;
        triggerSOS(`Dangerous sound detected (rms ${rms.toFixed(2)}, peak ${peak.toFixed(2)})`);
      }

      soundFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  const toggleSoundDetection = async () => {
    setSoundLoading(true);

    try {
      if (soundDetection) {
        stopSoundDetection();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser');
      }

      await startSoundDetection();
    } catch (error) {
      console.error('Sound detection toggle error:', error);
      addAlert(error.message || 'Unable to activate sound detection', 'error');
      stopSoundDetection(false);
    } finally {
      setSoundLoading(false);
    }
  };

  const speakFakeCallerMessage = () => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      'Hi, pick up when you can. I am waiting outside.'
    );
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const stopRingtone = () => {
     if (ringtoneRef.current) {
        try {
           ringtoneRef.current.osc.stop();
           ringtoneRef.current.osc.disconnect();
        } catch(e) {}
        ringtoneRef.current = null;
     }
  };

  const startFakeCall = async () => {
    setFakeCallLoading(true);
    clearFakeCallTimers();

    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      setFakeCallStage('scheduled');
      setFakeCallCountdown(4);
      addAlert('Fake call scheduled. Incoming call will appear in 4 seconds.', 'info');

      fakeCallCountdownRef.current = setInterval(() => {
        setFakeCallCountdown((current) => {
          if (current <= 1) {
            clearInterval(fakeCallCountdownRef.current);
            fakeCallCountdownRef.current = null;
            return 0;
          }

          return current - 1;
        });
      }, 1000);

      fakeCallTimerRef.current = setTimeout(() => {
        setFakeCallStage('ringing');
        addAlert('Incoming fake call from Mom is ringing now.', 'success');
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
           const ctx = new AudioContextClass();
           ringtoneRef.current = playRingtone(ctx);
        }

        if ('Notification' in window && Notification.permission === 'granted') {
          const notif = new Notification('Incoming Call', {
            body: 'Mom calling...',
            tag: 'fake-call',
            requireInteraction: true
          });
          notif.onclick = () => {
            window.focus();
            setFakeCallStage('ringing');
          };
        }
      }, 4000);
    } catch (error) {
      console.error('Fake call start error:', error);
      addAlert(error.message || 'Unable to start fake call', 'error');
      clearFakeCallTimers();
      setFakeCallStage('idle');
      setFakeCallCountdown(0);
    } finally {
      setFakeCallLoading(false);
    }
  };

  const stopFakeCall = () => {
    clearFakeCallTimers();
    stopRingtone();
    window.speechSynthesis?.cancel?.();
    setFakeCallStage('idle');
    setFakeCallCountdown(0);
    addAlert('Fake call cancelled', 'info');
  };

  const answerFakeCall = () => {
    clearFakeCallTimers();
    stopRingtone();
    setFakeCallStage('connected');
    addAlert('Fake call answered. Use this moment to move away safely.', 'success');
    speakFakeCallerMessage();
  };

  const endFakeCall = () => {
    stopRingtone();
    window.speechSynthesis?.cancel?.();
    setFakeCallStage('idle');
    setFakeCallCountdown(0);
    addAlert('Fake call ended', 'info');
  };

  if (!isInitialized) {
    return (
      <div className="advanced-safety-container">
        <div className="safety-header">
          <h1>Advanced Safety Features</h1>
          <p>Loading AI-powered detection systems...</p>
        </div>
      </div>
    );
  }

  const fakeCallActive = fakeCallStage !== 'idle';

  return (
    <div className="advanced-safety-container">
      <div className="safety-header">
        <h1>Advanced Safety Features</h1>
        <p>Browser-powered emergency detection with live triggers and a fake-call escape flow.</p>
      </div>

      {alerts.length > 0 && (
        <div className="alerts-section">
          <h2>Recent Activity</h2>
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div key={alert.id} className={`alert-item ${alert.type}`}>
                <span className="alert-message">{alert.message}</span>
                <span className="alert-time">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="features-grid">
        <div className="feature-card voice-sos">
          <div className="feature-icon">
            {voiceListening ? <Mic className="active" /> : <MicOff />}
          </div>
          <div className="feature-content">
            <h3>Voice Activated SOS</h3>
            <p>Continuously listens for emergency keywords such as "help me" and "emergency".</p>
            <div className="feature-status">
              {voiceListening ? 'Listening for distress keywords' : 'Voice monitoring off'}
            </div>
            <p className="feature-meta">Latest transcript: {lastTranscript}</p>
          </div>
          <button
            className={`feature-btn ${voiceListening ? 'active' : ''}`}
            onClick={toggleVoiceSOS}
            disabled={voiceLoading}
          >
            {voiceLoading ? 'Preparing microphone...' : voiceListening ? 'Stop Voice SOS' : 'Start Voice SOS'}
          </button>
        </div>

        <div className="feature-card shake-detection">
          <div className="feature-icon">
            <Smartphone className={shakeDetection ? 'active shake' : ''} />
          </div>
          <div className="feature-content">
            <h3>Shake Detection</h3>
            <p>Uses accelerometer motion bursts to catch panic-style shaking instead of minor movement.</p>
            <div className="feature-status">
              {shakeDetection ? 'Motion monitoring active' : 'Motion monitoring off'}
            </div>
            <p className="feature-meta">Triggers after 3 strong shakes in a short burst.</p>
            <div style={{ marginTop: '10px' }}>
              <label>Sensitivity ({shakeSensitivity}):</label>
              <input 
                type="range" 
                min="10" 
                max="50" 
                value={shakeSensitivity} 
                onChange={(e) => setShakeSensitivity(Number(e.target.value))} 
                disabled={shakeDetection}
              />
            </div>
          </div>
          <button
            className={`feature-btn ${shakeDetection ? 'active' : ''}`}
            onClick={toggleShakeDetection}
            disabled={shakeLoading}
          >
            {shakeLoading ? 'Requesting access...' : shakeDetection ? 'Stop Shake Detection' : 'Start Shake Detection'}
          </button>
        </div>

        <div className="feature-card sound-detection">
          <div className="feature-icon">
            <Volume2 className={soundDetection ? 'active pulse' : ''} />
          </div>
          <div className="feature-content">
            <h3>Sound Detection</h3>
            <p>Monitors live microphone input and reacts to sharp, high-intensity danger sounds.</p>
            <div className="feature-status">
              {soundDetection ? 'Microphone danger detection active' : 'Sound monitoring off'}
            </div>
            <p className="feature-meta">Live sound level: {(soundLevel * 100).toFixed(0)}%</p>
          </div>
          <button
            className={`feature-btn ${soundDetection ? 'active' : ''}`}
            onClick={toggleSoundDetection}
            disabled={soundLoading}
          >
            {soundLoading ? 'Preparing microphone...' : soundDetection ? 'Stop Sound Detection' : 'Start Sound Detection'}
          </button>
        </div>

        <div className="feature-card fake-call">
          <div className="feature-icon">
            <Phone className={fakeCallActive ? 'active ring' : ''} />
          </div>
          <div className="feature-content">
            <h3>Fake Call</h3>
            <p>Launches a delayed incoming-call screen so the feature works even without notifications.</p>
            <div className="feature-status">
              {fakeCallStage === 'scheduled' && `Incoming call in ${fakeCallCountdown}s`}
              {fakeCallStage === 'ringing' && 'Incoming fake call is ringing'}
              {fakeCallStage === 'connected' && 'Fake call connected'}
              {fakeCallStage === 'idle' && 'Ready to start'}
            </div>
            <p className="feature-meta">Caller: Mom</p>
          </div>
          <button
            className={`feature-btn ${fakeCallActive ? 'active' : ''}`}
            onClick={fakeCallActive ? stopFakeCall : startFakeCall}
            disabled={fakeCallLoading}
          >
            {fakeCallLoading ? 'Preparing fake call...' : fakeCallActive ? 'Cancel Fake Call' : 'Start Fake Call'}
          </button>
        </div>
      </div>

      <div className="instructions-section">
        <h2>How It Works</h2>
        <div className="instructions-grid">
          <div className="instruction-item">
            <AlertTriangle size={24} />
            <div>
              <h4>Voice SOS</h4>
              <p>Uses live speech recognition to convert voice to text and compare it against SOS keywords.</p>
            </div>
          </div>
          <div className="instruction-item">
            <Smartphone size={24} />
            <div>
              <h4>Shake Detection</h4>
              <p>Reads accelerometer movement and looks for rapid bursts that feel like panic shaking.</p>
            </div>
          </div>
          <div className="instruction-item">
            <Volume2 size={24} />
            <div>
              <h4>Sound Detection</h4>
              <p>Analyzes microphone intensity in real time and reacts to strong danger-like audio spikes.</p>
            </div>
          </div>
          <div className="instruction-item">
            <Phone size={24} />
            <div>
              <h4>Fake Call</h4>
              <p>Creates a visible incoming call overlay with answer and decline actions to help you exit a situation.</p>
            </div>
          </div>
        </div>
      </div>

      {fakeCallActive && (
        <div className="fake-call-modal" role="dialog" aria-modal="true">
          <div className="fake-call-content">
            <div className="caller-avatar">Mom</div>
            <p className="fake-call-label">
              {fakeCallStage === 'scheduled' && `Incoming call in ${fakeCallCountdown}s`}
              {fakeCallStage === 'ringing' && 'Incoming call'}
              {fakeCallStage === 'connected' && 'Connected'}
            </p>
            <h3>Mom Calling...</h3>
            <p>
              {fakeCallStage === 'connected'
                ? 'Use the fake conversation to step away safely.'
                : 'A realistic incoming call screen is now active.'}
            </p>
            <div className="call-actions">
              {fakeCallStage === 'ringing' && (
                <button className="answer-call" onClick={answerFakeCall}>
                  Answer
                </button>
              )}
              <button
                className="decline-call"
                onClick={fakeCallStage === 'connected' ? endFakeCall : stopFakeCall}
              >
                {fakeCallStage === 'connected' ? 'End Call' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSafetyEnhanced;
