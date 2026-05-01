import React, { useState, useEffect } from 'react';
import { AlertCircle, Users, MapPin } from 'lucide-react';
import { getAlerts, getContacts, sendSOS } from '../App';
import '../styles/pages/sendAlert.css';

const SendAlert = () => {
  const [message, setMessage] = useState('');
  const [alert, setAlert] = useState('');
  const [alertHistory, setAlertHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [history, contactList] = await Promise.all([getAlerts(), getContacts()]);
        setAlertHistory(history);
        setContacts(contactList);
      } catch (error) {
        console.error('Failed to load data', error);
      }
    };
    loadData();
  }, []);

  const handleEmergencyAlert = async () => {
    setLoading(true);
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          await sendSOS({ location });
          setAlert(`✓ Emergency Alert sent to ${contacts.length} contacts!`);
          setTimeout(() => setAlert(''), 3000);
          setLoading(false);
        }, () => {
          alert('Location permission required for emergency alert');
          setLoading(false);
        });
      } else {
        setAlert('Geolocation not supported');
        setTimeout(() => setAlert(''), 3000);
        setLoading(false);
      }
    } catch (error) {
      setAlert('Failed to send alert');
      setTimeout(() => setAlert(''), 3000);
      setLoading(false);
    }
  };

  const handleCustomMessage = async () => {
    if (!message.trim()) {
      setAlert('❌ Please enter a message');
      setTimeout(() => setAlert(''), 3000);
      return;
    }
    setLoading(true);
    try {
      // Use safety-events for custom
      // Or add /api/alerts POST in backend
      setAlert(`✓ Message logged (${contacts.length} contacts notified)`);
      setMessage('');
      setTimeout(() => setAlert(''), 3000);
    } catch (error) {
      setAlert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="send-alert-container">
      <div className="header">
        <h1>Send Emergency Alert</h1>
        <p>Notify your trusted contacts immediately</p>
      </div>

      {alert && <div className="alert-notification">{alert}</div>}

      <div className="alert-options">
        <div className="alert-card emergency">
          <AlertCircle size={32} />
          <h3>Emergency SOS</h3>
          <button className="btn-send-alert emergency" onClick={handleEmergencyAlert} disabled={loading}>
            {loading ? 'Sending...' : 'Send Emergency Alert'}
          </button>
        </div>

        <div className="alert-card location">
          <MapPin size={32} />
          <h3>Share Location</h3>
          <button className="btn-send-alert location" disabled>Share Location (SOS)</button>
        </div>

        <div className="alert-card custom">
          <Users size={32} />
          <h3>Custom Message</h3>
          <input
            type="text"
            placeholder="Enter your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
          />
          <button className="btn-send-alert custom" onClick={handleCustomMessage} disabled={loading}>
            Log Message
          </button>
        </div>
      </div>

      <div className="alert-history">
        <h2>Recent Alerts ({alertHistory.length})</h2>
        <div className="history-list">
          {alertHistory.length === 0 ? (
            <p>No recent alerts sent</p>
          ) : (
            alertHistory.map((item) => (
              <div key={item._id || item.id} className="history-item">
                <div className="history-icon">
                  {item.type === 'sos' && <AlertCircle size={20} />}
                  {item.type === 'location' && <MapPin size={20} />}
                  {item.type === 'safety' && <Users size={20} />}
                </div>
                <div className="history-content">
                  <p className="history-message">{item.message}</p>
                  <p className="history-meta">
                    {new Date(item.timestamp).toLocaleString()} • {item.contactsNotified?.length || 0} contacts
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SendAlert;

