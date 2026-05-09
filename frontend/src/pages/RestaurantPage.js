import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import StarRating from '../components/StarRating';
import ReservationForm from '../components/ReservationForm';
import ReviewsSection from '../components/ReviewsSection';
import { apiFetch } from '../api/client';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseList(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

const HERO_AUTO_ROTATE_MS = 5000;

function HeroCarousel({ images, name, children }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIdx(0);
  }, [images.length]);

  // Auto-advance every 5s, pause on hover, reset on manual nav (idx in deps)
  useEffect(() => {
    if (images.length <= 1 || paused) return;
    const t = setTimeout(() => {
      setIdx(prev => (prev + 1) % images.length);
    }, HERO_AUTO_ROTATE_MS);
    return () => clearTimeout(t);
  }, [idx, paused, images.length]);

  const go = (delta) => {
    setIdx(prev => (prev + delta + images.length) % images.length);
  };

  if (images.length === 0) {
    return (
      <div className="restaurant-hero">
        <div className="restaurant-hero-placeholder">
          <span>{(name || '?').charAt(0)}</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className="restaurant-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={name}
          className={`restaurant-hero-img${i === idx ? ' is-active' : ''}`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="hero-nav hero-nav-prev"
            onClick={() => go(-1)}
            aria-label="Previous photo"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="hero-nav hero-nav-next"
            onClick={() => go(1)}
            aria-label="Next photo"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
          <div className="hero-dots">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`hero-dot${i === idx ? ' is-active' : ''}`}
                onClick={() => setIdx(i)}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
      {children}
    </div>
  );
}

function GalleryLightbox({ images, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [images.length, onClose]);

  if (!images.length) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">×</button>

      <button
        type="button"
        className="lightbox-nav lightbox-nav-prev"
        onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
        aria-label="Previous"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
        <img src={images[idx]} alt="" className="lightbox-image" />
      </div>

      <button
        type="button"
        className="lightbox-nav lightbox-nav-next"
        onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
        aria-label="Next"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>

      <div className="lightbox-thumbs" onClick={(e) => e.stopPropagation()}>
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            className={`lightbox-thumb${i === idx ? ' is-active' : ''}`}
            onClick={() => setIdx(i)}
          >
            <img src={src} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      <div className="lightbox-counter">{idx + 1} / {images.length}</div>
    </div>
  );
}

function ScheduleCard({ restaurant }) {
  const closedDays = parseList(restaurant.closed_days);
  const closures = parseList(restaurant.special_closures);
  const start = restaurant.reservation_start_time || '10:00';
  const end = restaurant.reservation_end_time || '23:00';

  const upcomingClosures = closures
    .filter(c => c.date >= new Date().toISOString().split('T')[0])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <div className="detail-card">
      <h3 className="detail-card-title">Opening Hours</h3>
      <div className="schedule-grid">
        {DAY_LABELS.map((label, i) => {
          const closed = closedDays.includes(i);
          return (
            <div key={i} className={`schedule-row${closed ? ' schedule-row-closed' : ''}`}>
              <span className="schedule-day">{label}</span>
              <span className="schedule-hours">{closed ? 'Closed' : `${start} – ${end}`}</span>
            </div>
          );
        })}
      </div>
      {upcomingClosures.length > 0 && (
        <div className="schedule-closures">
          <strong>Upcoming closures</strong>
          <ul>
            {upcomingClosures.map(c => (
              <li key={c.date}>
                {new Date(c.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {c.reason ? ` — ${c.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InfoChips({ restaurant }) {
  const start = restaurant.reservation_start_time || '10:00';
  const end = restaurant.reservation_end_time || '23:00';

  return (
    <div className="info-chips">
      <span className="info-chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {start} – {end}
      </span>
      <span className="info-chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
        Up to {restaurant.max_guests || restaurant.num_tables * (restaurant.seats_per_table || 4)} guests
      </span>
      <span className="info-chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
        </svg>
        {restaurant.num_tables} tables
      </span>
      {restaurant.phone && (
        <a href={`tel:${restaurant.phone}`} className="info-chip info-chip-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          {restaurant.phone}
        </a>
      )}
    </div>
  );
}

function LocationMap({ restaurant }) {
  if (restaurant.latitude == null || restaurant.longitude == null) return null;
  const pos = [restaurant.latitude, restaurant.longitude];
  return (
    <div className="detail-card detail-card-map">
      <h3 className="detail-card-title">Location</h3>
      <p className="detail-address">{restaurant.address}</p>
      <div className="detail-map-container">
        <MapContainer
          center={pos}
          zoom={15}
          style={{ height: '210px', width: '100%', borderRadius: '12px' }}
          attributionControl={false}
          scrollWheelZoom={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={pos} />
        </MapContainer>
      </div>
    </div>
  );
}

function RestaurantPage() {
  const { id } = useParams();
  const [showGallery, setShowGallery] = useState(false);

  const { data: restaurant, isLoading, error } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => apiFetch(`/restaurants/${id}`),
    enabled: !!id,
  });

  // Compute cover and gallery arrays. Fall back to image_url for legacy restaurants.
  const coverImages = useMemo(() => {
    if (!restaurant) return [];
    const arr = parseList(restaurant.cover_images);
    if (arr.length > 0) return arr;
    return restaurant.image_url ? [restaurant.image_url] : [];
  }, [restaurant]);

  const galleryImages = useMemo(
    () => (restaurant ? parseList(restaurant.gallery_images) : []),
    [restaurant]
  );

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error-message">{error.status === 404 ? 'Restaurant not found' : error.message}</div>;
  if (!restaurant) return null;

  return (
    <div>
      <Link to="/" className="back-link">&larr; Back to restaurants</Link>

      <HeroCarousel images={coverImages} name={restaurant.name}>
        <div className="restaurant-hero-overlay">
          <div className="restaurant-hero-info">
            <h1 className="restaurant-hero-title">{restaurant.name}</h1>
            <div className="restaurant-hero-meta">
              <StarRating rating={restaurant.rating} />
              <span className="hero-divider">·</span>
              <span className="hero-address">{restaurant.address}</span>
            </div>
          </div>

          {galleryImages.length > 0 && (
            <button
              type="button"
              className="hero-photos-pill"
              onClick={() => setShowGallery(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              See more photos · {galleryImages.length}
            </button>
          )}
        </div>
      </HeroCarousel>

      <div className="restaurant-detail">
        <div className="restaurant-detail-left">
          <div className="detail-card">
            <InfoChips restaurant={restaurant} />
            {restaurant.description && (
              <p className="description">{restaurant.description}</p>
            )}
          </div>

          <div className="detail-side-by-side">
            <ScheduleCard restaurant={restaurant} />
            <LocationMap restaurant={restaurant} />
          </div>

          <ReviewsSection restaurantId={restaurant.id} ownerId={restaurant.owner_id} />
        </div>

        <div className="restaurant-detail-right">
          <ReservationForm restaurantId={restaurant.id} restaurant={restaurant} />
        </div>
      </div>

      {showGallery && (
        <GalleryLightbox
          images={galleryImages}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
}

export default RestaurantPage;
