import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [43.2141, 27.9147]; // Varna fallback when nothing is picked yet
const DEFAULT_ZOOM = 13;

// Keeps the map centered on the marker when its position changes externally
function RecenterOnPin({ position, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, zoom ?? map.getZoom(), { animate: true });
  }, [map, position, zoom]);
  return null;
}

// Picks a new coordinate when the user clicks the map
function ClickToPick({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

export default function LocationPicker({ lat, lng, onChange, address }) {
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const markerRef = useRef(null);

  const hasPin = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
  const center = hasPin ? [lat, lng] : DEFAULT_CENTER;

  const runSearch = async (query) => {
    const q = (query || '').trim();
    if (!q) {
      setSearchError('Type an address to search.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        if (!Number.isNaN(newLat) && !Number.isNaN(newLng)) {
          onChange(newLat, newLng);
        } else {
          setSearchError('Could not parse location. Pick on the map below.');
        }
      } else {
        setSearchError("Couldn't find that address. Click on the map to set the pin manually.");
      }
    } catch {
      setSearchError('Search failed. Pick the location on the map below.');
    } finally {
      setSearching(false);
    }
  };

  const handleFindOnMap = () => {
    runSearch(searchQuery || address);
  };

  return (
    <div className="location-picker">
      <div className="location-picker-actions">
        <button type="button" className="locate-btn" onClick={handleFindOnMap} disabled={searching || (!searchQuery.trim() && !address)}>
          {searching ? 'Searching…' : 'Find on map'}
        </button>
        <input
          type="text"
          className="location-picker-search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleFindOnMap(); } }}
          placeholder={address ? `Search a different address (default: ${address})` : 'Type an address to search…'}
        />
        {hasPin && (
          <span className="location-picker-coords">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        )}
        {!hasPin && !searchQuery && (
          <span className="location-picker-hint">Type an address, click the map, or drag the pin.</span>
        )}
      </div>

      {searchError && <div className="location-picker-error">{searchError}</div>}

      <div className="location-picker-map">
        <MapContainer
          center={center}
          zoom={hasPin ? 15 : DEFAULT_ZOOM}
          style={{ height: '300px', width: '100%', borderRadius: '12px' }}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickToPick onPick={onChange} />
          {hasPin && <RecenterOnPin position={[lat, lng]} zoom={15} />}
          {hasPin && (
            <Marker
              position={[lat, lng]}
              draggable={true}
              ref={markerRef}
              eventHandlers={{
                dragend: () => {
                  const m = markerRef.current;
                  if (!m) return;
                  const ll = m.getLatLng();
                  onChange(ll.lat, ll.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

// Default Leaflet icon fix for webpack — match HomePage.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});
