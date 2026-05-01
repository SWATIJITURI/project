import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Smartphone, Volume2, Phone, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/pages/advancedSafety.css';

const AdvancedSafety = () => {
  const navigate = useNavigate();
  const [voiceListening, setVoiceListening] = useState(false);
  const [shakeDetection, setShakeDetection] = useState(false);
  const [soundDetection, setSoundDetection] = useState(false);
  const [fakeCallActive, setFakeCallActive] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [shakeLoading, setShakeLoading] = useState(false);
  const [soundLoading, setSoundLoading] = useState(false);
  const [fakeCallLoading, setFakeCallLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const soundDetectionRef = useRef(false);
  const shakeThreshold = 15;
  const soundThreshold = 0.8;

  // Initialize component
  useEffect(() => {
    setIsInitialized(true);
    return () => {
      // Cleanup on unmount
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopSoundDetection();
    };
  }, []);

  // Voice Activated SOS
  useEffect(() => {
    if (!isInitialized) return;

    try {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event) => {
          try {
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            if (transcript.includes('help me') || transcript.includes('help') || transcript.includes('emergency')) {
              triggerSOS('Voice command detected: "' + transcript + '"');
            }
          } catch (error) {
            console.error('Speech recognition result error:', error);
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          addAlert('Voice recognition error', 'error');
        };
      }
    } catch (error) {
      console.error('Speech recognition initialization error:', error);
      addAlert('Speech recognition not available', 'error');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping speech recognition:', error);
        }
      }
    };
  }, [isInitialized]);

  // Shake Detection
  useEffect(() => {
    if (!isInitialized || !shakeDetection) return;

    let lastX = 0, lastY = 0, lastZ = 0;
    let lastTime = 0;

    const handleShake = (event) => {
      try {
        const currentTime = new Date().getTime();
        if (currentTime - lastTime < 100) return;

        const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);

        if (deltaX + deltaY + deltaZ > shakeThreshold) {
          triggerSOS('Phone shake detected!');
        }

        lastX = x;
        lastY = y;
        lastZ = z;
        lastTime = currentTime;
      } catch (error) {
        console.error('Shake detection error:', error);
      }
    };

    try {
      window.addEventListener('devicemotion', handleShake);
      addAlert('Shake detection activated', 'info');
    } catch (error) {
      console.error('Error adding shake detection listener:', error);
      addAlert('Shake detection failed to start', 'error');
    }

    return () => {
      try {
        window.removeEventListener('devicemotion', handleShake);
      } catch (error) {
        console.error('Error removing shake detection listener:', error);
      }
    };
  }, [shakeDetection, isInitialized]);

  const triggerSOS = (reason) => {
    addAlert(`🚨 SOS TRIGGERED: ${reason}`, 'emergency');
    setTimeout(() => {
      navigate('/sos');
    }, 1500);
  };

  const addAlert = (message, type) => {
    const newAlert = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 10));
  };

  const startSoundDetection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);

      analyserRef.current.fftSize = 256;
      microphoneRef.current.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSound = () => {
        if (!soundDetectionRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const volume = average / 128.0;

        if (volume > soundThreshold) {
          triggerSOS('Loud sound detected!');
        }

        requestAnimationFrame(checkSound);
      };

      soundDetectionRef.current = true;
      setSoundDetection(true);
      addAlert('Sound detection activated', 'success');
      checkSound();
    } catch (error) {
      console.error('Sound detection start error:', error);
      throw error;
    }
  };

  const stopSoundDetection = () => {
    try {
      soundDetectionRef.current = false;
      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
        microphoneRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setSoundDetection(false);
      addAlert('Sound detection deactivated', 'info');
    } catch (error) {
      console.error('Sound detection stop error:', error);
    }
  };

  const toggleVoiceSOS = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addAlert('Voice recognition not supported in this browser', 'error');
      return;
    }

    setVoiceLoading(true);
    try {
      if (voiceListening) {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setVoiceListening(false);
        setVoiceLoading(false);
        addAlert('Voice SOS deactivated', 'info');
      } else {
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        if (recognitionRef.current) {
          recognitionRef.current.start();
          setVoiceListening(true);
          addAlert('Voice SOS activated - Say "Help me"', 'success');
        } else {
          throw new Error('Speech recognition not initialized');
        }
      }
    } catch (error) {
      console.error('Voice SOS toggle error:', error);
      addAlert('Microphone permission required for voice SOS', 'error');
    } finally {
      setVoiceLoading(false);
    }
  };

  const toggleShakeDetection = async () => {
    if (!('DeviceMotionEvent' in window)) {
      addAlert('Shake detection not supported on this device', 'error');
      return;
    }

    setShakeLoading(true);
    try {
      // Request device motion permission if needed
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          addAlert('Motion permission denied', 'error');
          setShakeLoading(false);
          return;
        }
      }

      setShakeDetection(!shakeDetection);
      setShakeLoading(false);
      if (!shakeDetection) {
        addAlert('Shake detection activated', 'success');
      } else {
        addAlert('Shake detection deactivated', 'info');
      }
    } catch (error) {
      console.error('Shake detection toggle error:', error);
      addAlert('Motion permission required for shake detection', 'error');
      setShakeLoading(false);
    }
  };

  const toggleSoundDetection = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addAlert('Microphone access not supported', 'error');
      return;
    }

    setSoundLoading(true);
    if (soundDetection) {
      stopSoundDetection();
      setSoundLoading(false);
    } else {
      try {
        await startSoundDetection();
        setSoundLoading(false);
      } catch (error) {
        addAlert('Microphone permission required for sound detection', 'error');
        setSoundLoading(false);
      }
    }
  };

  const startFakeCall = async () => {
    setFakeCallLoading(true);
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        addAlert('Notification permission required for fake call', 'error');
        setFakeCallLoading(false);
        return;
      }
    }

    setFakeCallActive(true);
    setFakeCallLoading(false);
    addAlert('Fake call started - "Mom calling..."', 'info');

    // Simulate incoming call after 3 seconds
    setTimeout(() => {
      if (fakeCallActive) {
        // Create fake call notification
        const fakeCallNotification = new Notification('Incoming Call', {
          body: 'Mom calling...',
          icon: '/favicon.ico',
          tag: 'fake-call'
        });

        fakeCallNotification.onclick = () => {
          // Simulate answering call
          addAlert('Fake call answered - Use this to escape situation', 'success');
          setFakeCallActive(false);
        };

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          fakeCallNotification.close();
          setFakeCallActive(false);
          addAlert('Fake call ended', 'info');
        }, 10000);
      }
    }, 3000);
  };

  const stopFakeCall = () => {
    setFakeCallActive(false);
    addAlert('Fake call cancelled', 'info');
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

  return (
    <div className="advanced-safety-container">
      <div className="safety-header">
        <h1>Advanced Safety Features</h1>
        <p>AI-powered emergency detection systems</p>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h2>Recent Activity</h2>
          <div className="alerts-list">
            {alerts.map(alert => (
              <div key={alert.id} className={`alert-item ${alert.type}`}>
                <span className="alert-message">{alert.message}</span>
                <span className="alert-time">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="features-grid">
        {/* Voice Activated SOS */}
        <div className="feature-card voice-sos">
          <div className="feature-icon">
            {voiceListening ? <Mic className="active" /> : <MicOff />}
          </div>
          <div className="feature-content">
            <h3>Voice Activated SOS</h3>
            <p>Say "Help me" to trigger emergency</p>
            <div className="feature-status">
              {voiceListening ? '🎤 Listening...' : '🔇 Inactive'}
            </div>
          </div>
          <button
            className={`feature-btn ${voiceListening ? 'active' : ''}`}
            onClick={toggleVoiceSOS}
            disabled={voiceLoading}
          >
            {voiceLoading ? 'Requesting...' : voiceListening ? 'Stop Voice SOS' : 'Start Voice SOS'}
          </button>
        </div>

        {/* Shake Detection */}
        <div className="feature-card shake-detection">
          <div className="feature-icon">
            <Smartphone className={shakeDetection ? 'active shake' : ''} />
          </div>
          <div className="feature-content">
            <h3>Shake Detection</h3>
            <p>Shake phone to trigger SOS</p>
            <div className="feature-status">
              {shakeDetection ? '📳 Active' : '📱 Inactive'}
            </div>
          </div>
          <button
            className={`feature-btn ${shakeDetection ? 'active' : ''}`}
            onClick={toggleShakeDetection}
            disabled={shakeLoading}
          >
            {shakeLoading ? 'Requesting...' : shakeDetection ? 'Stop Shake Detection' : 'Start Shake Detection'}
          </button>
        </div>

        {/* Sound Detection */}
        <div className="feature-card sound-detection">
          <div className="feature-icon">
            <Volume2 className={soundDetection ? 'active pulse' : ''} />
          </div>
          <div className="feature-content">
            <h3>Sound Detection</h3>
            <p>Detect loud noises (clap/scream)</p>
            <div className="feature-status">
              {soundDetection ? '🔊 Listening...' : '🔇 Inactive'}
            </div>
          </div>
          <button
            className={`feature-btn ${soundDetection ? 'active' : ''}`}
            onClick={toggleSoundDetection}
            disabled={soundLoading}
          >
            {soundLoading ? 'Requesting...' : soundDetection ? 'Stop Sound Detection' : 'Start Sound Detection'}
          </button>
        </div>

        {/* Fake Call */}
        <div className="feature-card fake-call">
          <div className="feature-icon">
            <Phone className={fakeCallActive ? 'active ring' : ''} />
          </div>
          <div className="feature-content">
            <h3>Fake Call</h3>
            <p>Simulate incoming call to escape</p>
            <div className="feature-status">
              {fakeCallActive ? '📞 Calling...' : '📵 Ready'}
            </div>
          </div>
          <button
            className={`feature-btn ${fakeCallActive ? 'active' : ''}`}
            onClick={fakeCallActive ? stopFakeCall : startFakeCall}
            disabled={fakeCallLoading}
          >
            {fakeCallLoading ? 'Requesting...' : fakeCallActive ? 'Cancel Fake Call' : 'Start Fake Call'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions-section">
        <h2>How It Works</h2>
        <div className="instructions-grid">
          <div className="instruction-item">
            <AlertTriangle size={24} />
            <div>
              <h4>Voice SOS</h4>
              <p>Activate voice recognition and say "Help me" or "Emergency" to trigger SOS</p>
            </div>
          </div>
          <div className="instruction-item">
            <Smartphone size={24} />
            <div>
              <h4>Shake Detection</h4>
              <p>Shake your phone vigorously to automatically send emergency alerts</p>
            </div>
          </div>
          <div className="instruction-item">
            <Volume2 size={24} />
            <div>
              <h4>Sound Detection</h4>
              <p>Detects loud sounds like claps or screams to trigger emergency response</p>
            </div>
          </div>
          <div className="instruction-item">
            <Phone size={24} />
            <div>
              <h4>Fake Call</h4>
              <p>Creates a fake incoming call notification to help you escape uncomfortable situations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSafety;