import React, { useState, useEffect } from 'react';
import { Navigation, Phone } from 'lucide-react';
import { getNearbyPoliceStations } from '../App';
import '../styles/pages/policeStations.css';

const PoliceStations = () => {
  const [policeStations, setPoliceStations] = useState([]);
  const [locationStatus, setLocationStatus] = useState('Fetching nearby stations...');

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported. Showing default stations.');
      setPoliceStations(getNearbyPoliceStations());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const stations = getNearbyPoliceStations(position.coords.latitude, position.coords.longitude);
        setPoliceStations(stations);
        setLocationStatus('Showing nearby police stations based on your current location.');
      },
      () => {
        setLocationStatus('Unable to access your location. Showing default nearby stations.');
        setPoliceStations(getNearbyPoliceStations());
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  }, []);

  return (
    <div className="police-stations-container">
      <div className="header">
        <h1>Nearby Police Stations</h1>
        <p>{locationStatus}</p>
      </div>

      <div className="stations-list">
        {policeStations.map((station) => (
          <div key={station.id} className="station-card">
            <div className="station-header">
              <h3>{station.name}</h3>
              <span className="rating">⭐ {station.rating}</span>
            </div>
            <p className="address">{station.address}</p>
            <p className="distance">📍 {station.distance}</p>
            <p className="phone">☎️ {station.phone}</p>
            <div className="actions">
              <button className="btn-call" onClick={() => window.open(`tel:${station.phone}`)}>
                <Phone size={16} />
                Call
              </button>
              <button className="btn-navigate" onClick={() => window.open(station.directionsUrl, '_blank')}>
                <Navigation size={16} />
                Navigate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PoliceStations;
