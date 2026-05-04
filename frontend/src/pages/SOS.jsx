import React, { useCallback, useEffect, useRef, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Phone, MapPin, AlertCircle, Share2, Mic, MicOff, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendSOS } from '../App';
import '../styles/pages/sos.css';

const EMERGENCY_KEYWORDS = ['help me', 'emergency', 'save me', 'danger'];

const SOS = () => {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [sent, setSent] = useState(false);
  const [voiceEmergency, setVoiceEmergency] = useState(false);
  const [voicePopup, setVoicePopup] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceClickCount, setVoiceClickCount] = useState(0);
  const voiceTriggeredRef = useRef(false);
  const recognitionRef = useRef(null);
  const shouldKeepListeningRef = useRef(false);
  const startHandledAtRef = useRef(0);
  const startButtonRef = useRef(null);

  const {
    resetTranscript,
  } = useSpeechRecognition();

  const playAlertSound = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext = new AudioContext();
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.4, audioContext.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.1);
    gainNode.connect(audioContext.destination);

    [0, 0.32, 0.64].forEach((delay) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + delay);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + delay + 0.16);
      oscillator.connect(gainNode);
      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + 0.24);
    });

    window.setTimeout(() => audioContext.close(), 1300);
  }, []);

  const triggerSOS = useCallback((reason = 'Manual SOS Button Pressed', source = 'manual') => {
    if (isActive || sent) {
      return;
    }

    setIsActive(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          reason,
          source,
        };

        try {
          await sendSOS(location);
          setSent(true);
        } catch (error) {
          console.error('SOS failed', error);
        }

        setTimeout(() => {
          setIsActive(false);
          setSent(false);
        }, 3000);
      },
      async () => {
        try {
          await sendSOS({ reason, source });
          setSent(true);
        } catch (error) {
          console.error('SOS failed', error);
        }

        setTimeout(() => {
          setIsActive(false);
          setSent(false);
        }, 3000);
      }
    );
  }, [isActive, sent]);

  const handleDetectedSpeech = useCallback((spokenText) => {
    const normalizedTranscript = spokenText.toLowerCase();
    setVoiceTranscript(spokenText);

    const detectedKeyword = EMERGENCY_KEYWORDS.find((keyword) =>
      normalizedTranscript.includes(keyword)
    );

    if (!detectedKeyword || voiceTriggeredRef.current) {
      return;
    }

    voiceTriggeredRef.current = true;

    setVoiceEmergency(true);
    setVoicePopup(true);
    playAlertSound();
    console.log('Emergency detected by Voice SOS:', detectedKeyword);
    window.alert('Emergency detected! Sending SOS...');
    triggerSOS(`Voice emergency keyword detected: ${detectedKeyword}`, 'voice');
  }, [playAlertSound, triggerSOS]);

  const startVoiceSOS = () => {
    setVoiceClickCount((count) => count + 1);
    setVoiceError('');
    setVoiceEmergency(false);
    setVoicePopup(false);
    setVoiceTranscript('Listening...');
    setVoiceListening(true);
    voiceTriggeredRef.current = false;
    shouldKeepListeningRef.current = true;
    resetTranscript();

    const BrowserSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!BrowserSpeechRecognition) {
      setVoiceListening(false);
      setVoiceTranscript('Speech recognition is not available in this browser.');
      setVoiceError('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      SpeechRecognition.stopListening();

      const recognition = new BrowserSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setVoiceListening(true);
        setVoiceError('');
        setVoiceTranscript('Listening...');
      };

      recognition.onresult = (event) => {
        const spokenText = Array.from(event.results)
          .map((result) => result[0]?.transcript || '')
          .join(' ')
          .trim();

        if (spokenText) {
          handleDetectedSpeech(spokenText);
        }
      };

      recognition.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
        setVoiceListening(false);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError('Microphone permission is blocked. Click the lock icon in the address bar and allow microphone access.');
          shouldKeepListeningRef.current = false;
          return;
        }

        if (event.error === 'no-speech') {
          setVoiceError('No speech detected yet. Click Start Voice SOS again and speak clearly.');
          return;
        }

        setVoiceError(`Voice recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        setVoiceListening(false);

        if (shouldKeepListeningRef.current && !voiceTriggeredRef.current) {
          window.setTimeout(() => {
            try {
              recognition.start();
            } catch (error) {
              console.error('Voice recognition restart failed:', error);
            }
          }, 350);
        }
      };

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Previous voice recognition stop failed:', error);
        }
      }

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Voice SOS failed to start', error);
      setVoiceListening(false);
      setVoiceError(error.message || 'Microphone access was blocked or unavailable.');
    }
  };

  const handleStartVoiceButton = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    if (now - startHandledAtRef.current < 400) {
      return;
    }
    startHandledAtRef.current = now;
    startVoiceSOS();
  };

  const stopVoiceSOS = () => {
    shouldKeepListeningRef.current = false;
    setVoiceListening(false);
    setVoiceError('Voice SOS stopped.');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Voice recognition stop failed:', error);
      }
    }
    SpeechRecognition.stopListening();
  };

  useEffect(() => {
    const button = startButtonRef.current;

    if (!button) {
      return undefined;
    }

    const nativeStartHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - startHandledAtRef.current < 400) {
        return;
      }
      startHandledAtRef.current = now;
      startVoiceSOS();
    };

    button.addEventListener('mousedown', nativeStartHandler);
    button.addEventListener('touchstart', nativeStartHandler, { passive: false });

    return () => {
      button.removeEventListener('mousedown', nativeStartHandler);
      button.removeEventListener('touchstart', nativeStartHandler);
      shouldKeepListeningRef.current = false;
      recognitionRef.current?.stop?.();
      SpeechRecognition.stopListening();
    };
  }, []);

  return (
    <div className={`sos-container ${voiceEmergency ? 'voice-emergency-active' : ''}`}>
      <div className="sos-header">
        <h1>Emergency SOS</h1>
        <p>Tap the button below to instantly trigger emergency alert</p>
      </div>

      <div className="sos-instructions">
        <div className="instruction-box">
          <AlertCircle size={20} />
          <div>
            <p>Upon activation:</p>
            <ul>
              <li>Live location shared</li>
              <li>Alerts sent to contacts</li>
              <li>Logged in emergency history</li>
              <li>Stored securely on server</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="sos-button-wrapper">
        {isActive && (
          <div className="alert-pulse">
            <div className="pulse-ring"></div>
            <div className="pulse-ring pulse-ring-2"></div>
            <div className="pulse-ring pulse-ring-3"></div>
          </div>
        )}
        <button
          className={`sos-button ${isActive ? 'active' : ''}`}
          onClick={() => triggerSOS()}
          disabled={sent || isActive}
        >
          <span className="sos-text">{sent ? 'SENT' : 'SOS'}</span>
        </button>
      </div>

      {sent && <div className="alert-notification success">SOS SENT SUCCESSFULLY!</div>}
      {isActive && !sent && <div className="alert-notification">Sending SOS...</div>}

      <section className={`voice-sos-panel ${voiceEmergency ? 'danger' : ''}`}>
        <div className="voice-sos-topline">
          <div>
            <h2>Voice Activated SOS</h2>
            <p>Say "help me", "emergency", "save me", or "danger".</p>
          </div>
          <span className={`voice-listening-badge ${voiceListening ? 'active' : ''}`}>
            {voiceListening ? 'Listening...' : 'Stopped'}
          </span>
        </div>

        <div className="voice-controls">
          <button
            id="start-voice-sos-button"
            ref={startButtonRef}
            className="start-voice-btn"
            type="button"
            onClick={handleStartVoiceButton}
            onPointerDown={handleStartVoiceButton}
            onMouseDown={handleStartVoiceButton}
            onTouchStart={handleStartVoiceButton}
            aria-label="Start Voice SOS"
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          >
            <Mic size={20} />
            Start Voice SOS
          </button>
          <button className="stop-voice-btn" type="button" onClick={stopVoiceSOS} disabled={!voiceListening}>
            <MicOff size={20} />
            <span>Stop</span>
          </button>
        </div>

        <div className="voice-transcript-box">
          <div className="voice-transcript-header">
            <Volume2 size={18} />
            <span>Detected Transcript</span>
          </div>
          <p>{voiceTranscript || 'Click Start Voice SOS, allow microphone permission, then speak.'}</p>
        </div>

        <div className="voice-debug-status">
          Button clicks detected: {voiceClickCount}
        </div>

        {voiceError && <div className="voice-error">{voiceError}</div>}
        {voiceEmergency && (
          <div className="voice-warning">
            <AlertCircle size={22} />
            <span>Emergency voice keyword detected. SOS alert has been triggered.</span>
          </div>
        )}
      </section>

      {voicePopup && (
        <div className="voice-alert-modal" role="alertdialog" aria-modal="true">
          <div className="voice-alert-content">
            <AlertCircle size={44} />
            <h2>Voice SOS Alert</h2>
            <p>Emergency keyword detected. Your SOS alert is being sent now.</p>
            <button type="button" onClick={() => setVoicePopup(false)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="sos-quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-container">
          <button className="action-button location-action" onClick={() => navigate('/location')} disabled={isActive}>
            <MapPin size={24} />
            <span>Share Location</span>
          </button>
          <button className="action-button call-action" onClick={() => window.open('tel:100')}>
            <Phone size={24} />
            <span>Call 100</span>
          </button>
          <button className="action-button alert-action" onClick={() => navigate('/send-alert')} disabled={isActive}>
            <Share2 size={24} />
            <span>Send Alert</span>
          </button>
        </div>
      </div>

      <div className="safety-tips">
        <h2>Safety Tips</h2>
        <div className="tips-list">
          <div className="tip">
            <span className="tip-icon">OK</span>
            <p>Stay calm and find safe location</p>
          </div>
          <div className="tip">
            <span className="tip-icon">OK</span>
            <p>Keep phone charged and location ON</p>
          </div>
          <div className="tip">
            <span className="tip-icon">OK</span>
            <p>SOS automatically notifies contacts</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOS;
