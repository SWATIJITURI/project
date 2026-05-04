import React, { useEffect, useRef, useState } from 'react';
import { Phone, Smartphone, Volume2 } from 'lucide-react';
import '../styles/pages/advancedSafety.css';

const SOUND_THRESHOLD = 10;
const SHAKE_WINDOW_MS = 1500;
const SHAKE_REQUIRED_COUNT = 1;
const SHAKE_SENSITIVITY = {
  low: 14,
  medium: 9,
  high: 5,
};

const AdvancedSafetyEnhanced = () => {
  const [alerts, setAlerts] = useState([]);
  const [soundMonitoring, setSoundMonitoring] = useState(false);
  const [soundLevel, setSoundLevel] = useState(0);
  const [soundStatus, setSoundStatus] = useState('Not hearable');
  const [soundError, setSoundError] = useState('');
  const [shakeMonitoring, setShakeMonitoring] = useState(false);
  const [shakeStatus, setShakeStatus] = useState('Waiting for shake...');
  const [shakeError, setShakeError] = useState('');
  const [sensitivity, setSensitivity] = useState('high');
  const [shakeCount, setShakeCount] = useState(0);
  const [callerName, setCallerName] = useState('Mom');
  const [callDelay, setCallDelay] = useState(5);
  const [fakeCallStage, setFakeCallStage] = useState('idle');
  const [callCountdown, setCallCountdown] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const [buttonClicks, setButtonClicks] = useState({
    soundStart: 0,
    soundStop: 0,
    shakeStart: 0,
    shakeStop: 0,
    fakeCall: 0,
    fakeCancel: 0,
    acceptCall: 0,
    rejectCall: 0,
  });

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const loudSoundTriggeredRef = useRef(false);
  const shakeEventsRef = useRef([]);
  const fakeCallTimeoutRef = useRef(null);
  const fakeCallIntervalRef = useRef(null);
  const callTimerRef = useRef(null);
  const lastButtonPressRef = useRef({});
  const sensitivityRef = useRef(sensitivity);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const addAlert = (message, type = 'info') => {
    setAlerts((current) => [
      {
        id: Date.now() + Math.random(),
        message,
        type,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...current,
    ].slice(0, 8));
  };

  const simulateSOS = (reason) => {
    console.log('SOS simulated:', reason);
  };

  const runButtonAction = (key, action) => {
    const now = Date.now();
    if (lastButtonPressRef.current[key] && now - lastButtonPressRef.current[key] < 350) {
      return;
    }

    lastButtonPressRef.current[key] = now;
    setButtonClicks((current) => ({
      ...current,
      [key]: current[key] + 1,
    }));
    action();
  };

  const stopSoundDetection = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }

    audioContextRef.current = null;
    analyserRef.current = null;
    loudSoundTriggeredRef.current = false;
    setSoundMonitoring(false);
    setSoundLevel(0);
    setSoundStatus('Not hearable');
  };

  const startSoundDetection = async () => {
    stopSoundDetection();
    setSoundError('');
    setSoundStatus('Listening...');
    setSoundMonitoring(true);
    setSoundLevel(1);
    loudSoundTriggeredRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser not supported: microphone access is unavailable.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error('Browser not supported: audio analysis is unavailable.');
      }

      const audioContext = new AudioContextClass();
      await audioContext.resume();

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.35;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      mediaStreamRef.current = stream;
      addAlert('Sound detection started', 'success');

      const samples = new Uint8Array(analyser.fftSize);

      const monitor = () => {
        if (!analyserRef.current) {
          return;
        }

        analyserRef.current.getByteTimeDomainData(samples);
        let sum = 0;

        for (let i = 0; i < samples.length; i += 1) {
          const normalized = (samples[i] - 128) / 128;
          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / samples.length);
        const level = Math.min(100, Math.max(0, Math.round(rms * 900)));
        setSoundLevel(level);
        setSoundStatus(level > 2 ? 'Listening...' : 'Not hearable');

        if (level >= SOUND_THRESHOLD && !loudSoundTriggeredRef.current) {
          loudSoundTriggeredRef.current = true;
          setSoundStatus('Loud sound detected!');
          addAlert('Loud sound detected!', 'emergency');
          alert('Loud sound detected! SOS triggered!');
          simulateSOS('Loud sound detected');
        }

        animationFrameRef.current = requestAnimationFrame(monitor);
      };

      monitor();
    } catch (error) {
      console.error('Sound detection error:', error);
      setSoundError(error.message || 'Microphone permission denied.');
      addAlert(error.message || 'Microphone permission denied.', 'error');
      stopSoundDetection();
    }
  };

  const handleShakeMotion = (event) => {
    const acceleration = event.accelerationIncludingGravity || event.acceleration;

    if (!acceleration) {
      return;
    }

    const x = acceleration.x || 0;
    const y = acceleration.y || 0;
    const z = acceleration.z || 0;
    const strength = Math.sqrt(x * x + y * y + z * z);
    const threshold = SHAKE_SENSITIVITY[sensitivityRef.current];
    const now = Date.now();

    if (strength < threshold) {
      return;
    }

    shakeEventsRef.current = [...shakeEventsRef.current, now].filter(
      (time) => now - time <= SHAKE_WINDOW_MS
    );
    setShakeCount(shakeEventsRef.current.length);

    if (shakeEventsRef.current.length >= SHAKE_REQUIRED_COUNT) {
      shakeEventsRef.current = [];
      setShakeCount(0);
      setShakeStatus('Shake detected!');
      addAlert('Shake detected! SOS triggered!', 'emergency');
      alert('Shake detected! SOS triggered!');
      simulateSOS('Shake detected');
    }
  };

  const startShakeDetection = async () => {
    setShakeError('');
    setShakeStatus('Waiting for shake...');
    setShakeCount(0);
    setShakeMonitoring(true);
    shakeEventsRef.current = [];

    try {
      if (typeof DeviceMotionEvent === 'undefined') {
        throw new Error('DeviceMotion is not supported on this device.');
      }

      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Motion permission denied.');
        }
      }

      window.removeEventListener('devicemotion', handleShakeMotion);
      window.addEventListener('devicemotion', handleShakeMotion);
      addAlert('Shake detection started', 'success');
    } catch (error) {
      console.error('Shake detection error:', error);
      setShakeError(error.message || 'Unable to start shake detection.');
      addAlert(error.message || 'Unable to start shake detection.', 'error');
      setShakeMonitoring(false);
    }
  };

  const stopShakeDetection = () => {
    window.removeEventListener('devicemotion', handleShakeMotion);
    shakeEventsRef.current = [];
    setShakeMonitoring(false);
    setShakeCount(0);
    setShakeStatus('Waiting for shake...');
    addAlert('Shake detection stopped', 'info');
  };

  const clearFakeCallTimers = () => {
    if (fakeCallTimeoutRef.current) {
      clearTimeout(fakeCallTimeoutRef.current);
      fakeCallTimeoutRef.current = null;
    }

    if (fakeCallIntervalRef.current) {
      clearInterval(fakeCallIntervalRef.current);
      fakeCallIntervalRef.current = null;
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const triggerFakeCall = () => {
    clearFakeCallTimers();
    const delay = Math.max(0, Number(callDelay) || 0);
    const fakeCaller = callerName.trim() || 'Mom';
    setFakeCallStage('scheduled');
    setCallCountdown(delay);
    setCallSeconds(0);
    addAlert(`Fake call scheduled from ${fakeCaller}`, 'success');

    if (delay === 0) {
      setFakeCallStage('ringing');
      return;
    }

    fakeCallIntervalRef.current = setInterval(() => {
      setCallCountdown((seconds) => {
        if (seconds <= 1) {
          clearInterval(fakeCallIntervalRef.current);
          fakeCallIntervalRef.current = null;
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    fakeCallTimeoutRef.current = setTimeout(() => {
      setFakeCallStage('ringing');
      addAlert(`Incoming fake call from ${fakeCaller}`, 'info');
    }, delay * 1000);
  };

  const acceptCall = () => {
    setFakeCallStage('accepted');
    setCallSeconds(0);
    addAlert('Fake call accepted', 'success');
    callTimerRef.current = setInterval(() => {
      setCallSeconds((seconds) => seconds + 1);
    }, 1000);
  };

  const rejectCall = () => {
    clearFakeCallTimers();
    setFakeCallStage('idle');
    setCallCountdown(0);
    setCallSeconds(0);
    addAlert('Fake call rejected', 'info');
  };

  useEffect(() => {
    return () => {
      stopSoundDetection();
      window.removeEventListener('devicemotion', handleShakeMotion);
      clearFakeCallTimers();
    };
  }, []);

  const fakeCaller = callerName.trim() || 'Mom';

  return (
    <div className="advanced-safety-container">
      <div className="safety-header">
        <h1>Advanced Safety Features</h1>
        <p>Emergency tools using browser microphone, motion sensors, and fake-call simulation.</p>
      </div>

      {alerts.length > 0 && (
        <div className="alerts-section">
          <h2>Recent Activity</h2>
          <div className="alerts-list">
            {alerts.map((item) => (
              <div key={item.id} className={`alert-item ${item.type}`}>
                <span className="alert-message">{item.message}</span>
                <span className="alert-time">{item.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="features-grid">
        <div className="feature-card sound-detection">
          <div className="feature-icon">
            <Volume2 className={soundMonitoring ? 'active pulse' : ''} />
          </div>
          <div className="feature-content">
            <h3>Sound Detection</h3>
            <p>Detects even low voice by amplifying the live microphone level.</p>
            <div className="feature-status">{soundStatus}</div>
            <p className="feature-meta">Current sound level: {soundLevel}%</p>
            <div className="sound-meter">
              <div style={{ width: `${soundLevel}%` }} />
            </div>
            {soundError && <p className="feature-error">{soundError}</p>}
          </div>
          <p className="feature-click-count">Start clicks: {buttonClicks.soundStart}</p>
          <div className="feature-actions">
            <button
              type="button"
              className="feature-btn"
              onPointerDown={() => runButtonAction('soundStart', startSoundDetection)}
              onClick={() => runButtonAction('soundStart', startSoundDetection)}
            >
              Start Sound Detection
            </button>
            <button
              type="button"
              className="feature-btn secondary"
              onPointerDown={() => runButtonAction('soundStop', stopSoundDetection)}
              onClick={() => runButtonAction('soundStop', stopSoundDetection)}
            >
              Stop
            </button>
          </div>
        </div>

        <div className="feature-card shake-detection">
          <div className="feature-icon">
            <Smartphone className={shakeMonitoring ? 'active shake' : ''} />
          </div>
          <div className="feature-content">
            <h3>Shake Detection</h3>
            <p>Very sensitive motion detection. A small shake can trigger SOS.</p>
            <div className="feature-status">{shakeStatus}</div>
            <p className="feature-meta">Shake hits: {shakeCount}/{SHAKE_REQUIRED_COUNT}</p>
            <label className="feature-label" htmlFor="shake-sensitivity">Sensitivity</label>
            <select
              id="shake-sensitivity"
              value={sensitivity}
              onChange={(event) => setSensitivity(event.target.value)}
              disabled={shakeMonitoring}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {shakeError && <p className="feature-error">{shakeError}</p>}
          </div>
          <p className="feature-click-count">Start clicks: {buttonClicks.shakeStart}</p>
          <div className="feature-actions">
            <button
              type="button"
              className="feature-btn"
              onPointerDown={() => runButtonAction('shakeStart', startShakeDetection)}
              onClick={() => runButtonAction('shakeStart', startShakeDetection)}
            >
              Start Shake Detection
            </button>
            <button
              type="button"
              className="feature-btn secondary"
              onPointerDown={() => runButtonAction('shakeStop', stopShakeDetection)}
              onClick={() => runButtonAction('shakeStop', stopShakeDetection)}
            >
              Stop
            </button>
          </div>
        </div>

        <div className="feature-card fake-call">
          <div className="feature-icon">
            <Phone className={fakeCallStage !== 'idle' ? 'active ring' : ''} />
          </div>
          <div className="feature-content">
            <h3>Fake Call</h3>
            <p>Creates an incoming-call screen for emergency escape situations.</p>
            <label className="feature-label" htmlFor="caller-name">Caller name</label>
            <input
              id="caller-name"
              value={callerName}
              onChange={(event) => setCallerName(event.target.value)}
              placeholder="Mom"
            />
            <label className="feature-label" htmlFor="call-delay">Delay before call, seconds</label>
            <input
              id="call-delay"
              type="number"
              min="0"
              max="60"
              value={callDelay}
              onChange={(event) => setCallDelay(event.target.value)}
            />
            <div className="feature-status">
              {fakeCallStage === 'idle' && 'Ready to trigger fake call'}
              {fakeCallStage === 'scheduled' && `Incoming call in ${callCountdown}s`}
              {fakeCallStage === 'ringing' && 'Incoming call ringing'}
              {fakeCallStage === 'accepted' && `Call active: ${callSeconds}s`}
            </div>
          </div>
          <p className="feature-click-count">Trigger clicks: {buttonClicks.fakeCall}</p>
          <div className="feature-actions">
            <button
              type="button"
              className="feature-btn"
              onPointerDown={() => runButtonAction('fakeCall', triggerFakeCall)}
              onClick={() => runButtonAction('fakeCall', triggerFakeCall)}
            >
              Trigger Fake Call
            </button>
            <button
              type="button"
              className="feature-btn secondary"
              onPointerDown={() => runButtonAction('fakeCancel', rejectCall)}
              onClick={() => runButtonAction('fakeCancel', rejectCall)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {(fakeCallStage === 'scheduled' || fakeCallStage === 'ringing' || fakeCallStage === 'accepted') && (
        <div className="fake-call-modal" role="dialog" aria-modal="true">
          <div className="fake-call-content">
            <div className="caller-avatar">{fakeCaller.slice(0, 1).toUpperCase()}</div>
            <p className="fake-call-label">
              {fakeCallStage === 'scheduled' && `Incoming call in ${callCountdown}s`}
              {fakeCallStage === 'ringing' && 'Incoming call'}
              {fakeCallStage === 'accepted' && `Connected ${callSeconds}s`}
            </p>
            <h3>{fakeCaller}</h3>
            <p>{fakeCallStage === 'accepted' ? 'Fake call is active.' : 'Fake incoming call simulation.'}</p>
            <div className="call-actions">
              {fakeCallStage === 'ringing' && (
                <button
                  type="button"
                  className="answer-call"
                  onPointerDown={() => runButtonAction('acceptCall', acceptCall)}
                  onClick={() => runButtonAction('acceptCall', acceptCall)}
                >
                  Accept Call
                </button>
              )}
              <button
                type="button"
                className="decline-call"
                onPointerDown={() => runButtonAction('rejectCall', rejectCall)}
                onClick={() => runButtonAction('rejectCall', rejectCall)}
              >
                Reject Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSafetyEnhanced;
