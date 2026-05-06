import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import StarRating from '../components/StarRating';
import RestaurantCardSkeleton from '../components/RestaurantCardSkeleton';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet marker icons (they break with webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const DEFAULT_CENTER = [43.2141, 27.9147]; // shown only when no restaurants and no user location
const SKELETON_COUNT = 6;

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

// Smoothly recenters and zooms the map onto a target lat/lng whenever it changes.
function FlyTo({ position, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.flyTo(position, zoom, { duration: 1.2 });
  }, [map, position, zoom]);
  return null;
}

function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState('');
  const [minRating, setMinRating] = useState(0);

  // Redirect restaurant owners to dashboard
  useEffect(() => {
    if (user && user.role === 'restaurant') {
      navigate('/restaurant/dashboard');
    }
  }, [user, navigate]);

  const isCustomer = !user || user.role !== 'restaurant';

  const { data: restaurants = [], isLoading, error } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => apiFetch('/restaurants'),
    enabled: isCustomer,
  });

  const { data: nearbyRestaurants = [] } = useQuery({
    queryKey: ['restaurants', 'nearby', userLocation],
    queryFn: () => apiFetch(`/restaurants/nearby?lat=${userLocation[0]}&lng=${userLocation[1]}`),
    enabled: !!userLocation,
  });

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocationError('Unable to get your location');
        setLocating(false);
      }
    );
  };

  const filteredRestaurants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return restaurants.filter(r => {
      if (minRating > 0 && (r.rating ?? 0) < minRating) return false;
      if (!q) return true;
      const haystack = `${r.name || ''} ${r.address || ''} ${r.description || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [restaurants, search, minRating]);

  const mapPins = useMemo(
    () => restaurants.filter(r => r.latitude != null && r.longitude != null),
    [restaurants]
  );

  const distanceById = useMemo(
    () => new Map(nearbyRestaurants.map(r => [r.id, r.distance])),
    [nearbyRestaurants]
  );

  if (error) return <div className="error-message">Failed to load restaurants</div>;

  return (
    <div>
      {/* Restaurants Map */}
      <div className="nearby-section">
        <div className="home-title-row">
          <h1 className="home-title">{userLocation ? 'Nearby Restaurants' : 'Restaurants'}</h1>
          {!userLocation && (
            <button
              className="locate-me-btn"
              onClick={handleLocateMe}
              disabled={locating}
              type="button"
            >
              {locating ? 'Locating…' : 'Find restaurants near me'}
            </button>
          )}
        </div>
        {locationError && <div className="nearby-error">{locationError}</div>}
        <div className="map-container">
          <MapContainer
            center={userLocation || DEFAULT_CENTER}
            zoom={userLocation ? 14 : 4}
            style={{ height: '400px', width: '100%', borderRadius: '12px' }}
            attributionControl={false}
            worldCopyJump={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {userLocation && <FlyTo position={userLocation} zoom={15} />}

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

            {!userLocation && mapPins.length > 0 && (
              <FitBounds points={mapPins.map(r => [r.latitude, r.longitude])} />
            )}

            {mapPins.map(r => (
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
            ))}
          </MapContainer>
        </div>
      </div>

      {/* All Restaurants Grid */}
      <div className="home-grid-header">
        <h1 className="home-title">All Restaurants</h1>
        <div className="home-filters">
          <input
            type="search"
            className="home-search-input"
            placeholder="Search by name, address, or description"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search restaurants"
          />
          <select
            className="home-rating-select"
            value={minRating}
            onChange={e => setMinRating(Number(e.target.value))}
            aria-label="Minimum rating"
          >
            <option value={0}>Any rating</option>
            <option value={3}>3+ stars</option>
            <option value={4}>4+ stars</option>
            <option value={4.5}>4.5+ stars</option>
          </select>
        </div>
      </div>

      <div className="restaurant-grid">
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => <RestaurantCardSkeleton key={i} />)
          : filteredRestaurants.length === 0
            ? <div className="empty-results">No restaurants match your filters.</div>
            : filteredRestaurants.map(restaurant => (
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
                      <span>{(restaurant.name || '?').charAt(0)}</span>
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
