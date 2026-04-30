import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import StarRating from '../components/StarRating';
import { useAuth } from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet marker icons (they break with webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const API_URL = 'http://localhost:3001/api';
const DEFAULT_CENTER = [43.2141, 27.9147]; // shown only when no restaurants and no user location

// Auto-fits the map to show all restaurant pins (and user, if available) when geolocation isn't shared.
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [nearbyRestaurants, setNearbyRestaurants] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Redirect restaurant owners to dashboard
  useEffect(() => {
    if (user && user.role === 'restaurant') {
      navigate('/restaurant/dashboard');
    }
  }, [user, navigate]);

  // Fetch all restaurants
  useEffect(() => {
    fetch(`${API_URL}/restaurants`)
      .then(res => res.json())
      .then(data => {
        setRestaurants(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load restaurants');
        setLoading(false);
      });
  }, []);

  // Get user location and fetch nearby restaurants
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);

        fetch(`${API_URL}/restaurants/nearby?lat=${latitude}&lng=${longitude}`)
          .then(res => res.json())
          .then(data => setNearbyRestaurants(data))
          .catch(() => setLocationError('Failed to load nearby restaurants'));
      },
      () => {
        setLocationError('Unable to get your location');
      }
    );
  }, []);

  if (loading) return <div className="loading">Loading restaurants...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div>
      {/* Restaurants Map */}
      <div className="nearby-section">
        <h1 className="home-title">{userLocation ? 'Nearby Restaurants' : 'Restaurants'}</h1>
        {locationError && <div className="nearby-error">{locationError}</div>}
        <div className="map-container">
          <MapContainer
            center={userLocation || DEFAULT_CENTER}
            zoom={userLocation ? 14 : 4}
            style={{ height: '400px', width: '100%', borderRadius: '12px' }}
            attributionControl={false}
            worldCopyJump={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* User location marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={L.divIcon({
                  className: 'user-location-marker',
                  html: '<div class="user-dot"></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
              >
                <Popup>You are here</Popup>
              </Marker>
            )}

            {/* Auto-fit to all pins when we don't have the user's location */}
            {!userLocation && (() => {
              const pts = restaurants
                .filter(r => r.latitude != null && r.longitude != null)
                .map(r => [r.latitude, r.longitude]);
              return pts.length > 0 ? <FitBounds points={pts} /> : null;
            })()}

            {/* Restaurant markers */}
            {(() => {
              const distanceById = new Map(nearbyRestaurants.map(r => [r.id, r.distance]));
              return restaurants
                .filter(r => r.latitude != null && r.longitude != null)
                .map(r => (
                  <Marker key={r.id} position={[r.latitude, r.longitude]}>
                    <Popup>
                      <div className="map-popup">
                        <strong>{r.name}</strong>
                        <div className="map-popup-rating">
                          <span className="map-popup-stars">{'★'.repeat(Math.round(r.rating))}</span>
                          <span className="map-popup-score">{r.rating}</span>
                        </div>
                        <p className="map-popup-address">{r.address}</p>
                        {distanceById.has(r.id) && (
                          <p className="map-popup-distance">{distanceById.get(r.id)} km away</p>
                        )}
                        <button
                          className="map-popup-btn"
                          onClick={() => navigate(`/restaurant/${r.id}`)}
                        >
                          Book Now
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ));
            })()}
          </MapContainer>
        </div>
      </div>

      {/* All Restaurants Grid */}
      <h1 className="home-title" style={{ marginTop: '40px' }}>All Restaurants</h1>
      <div className="restaurant-grid">
        {restaurants.map(restaurant => (
          <Link
            to={`/restaurant/${restaurant.id}`}
            key={restaurant.id}
            className="restaurant-card"
          >
            {restaurant.image_url ? (
              <img
                src={restaurant.image_url}
                alt={restaurant.name}
                className="restaurant-card-image"
                loading="lazy"
              />
            ) : (
              <div className="restaurant-card-image restaurant-card-placeholder">
                <span>{restaurant.name.charAt(0)}</span>
              </div>
            )}
            <div className="restaurant-card-body">
              <h3>{restaurant.name}</h3>
              <p className="address">{restaurant.address}</p>
              <StarRating rating={restaurant.rating} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default HomePage;
