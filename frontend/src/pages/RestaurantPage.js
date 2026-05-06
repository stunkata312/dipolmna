import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import StarRating from '../components/StarRating';
import ReservationForm from '../components/ReservationForm';
import { apiFetch } from '../api/client';

function RestaurantPage() {
  const { id } = useParams();

  const { data: restaurant, isLoading, error } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => apiFetch(`/restaurants/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error-message">{error.status === 404 ? 'Restaurant not found' : error.message}</div>;
  if (!restaurant) return null;

  return (
    <div>
      <Link to="/" className="back-link">&larr; Back to restaurants</Link>

      <div className="restaurant-detail">
        {/* Left Section - 75% */}
        <div className="restaurant-detail-left">
          {/* Container 1: Name, Rating, Address */}
          <div className="detail-card">
            <h1>{restaurant.name}</h1>
            <StarRating rating={restaurant.rating} />
            <p className="address">{restaurant.address}</p>
          </div>

          {/* Container 2: Description */}
          <div className="detail-card">
            <p className="description">{restaurant.description}</p>
          </div>
        </div>

        {/* Right Section - 25% */}
        <div className="restaurant-detail-right">
          <ReservationForm restaurantId={restaurant.id} restaurant={restaurant} />
        </div>
      </div>
    </div>
  );
}

export default RestaurantPage;
