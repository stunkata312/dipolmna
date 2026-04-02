import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import StarRating from '../components/StarRating';
import ReservationForm from '../components/ReservationForm';

const API_URL = 'http://localhost:3001/api';

function RestaurantPage() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/restaurants/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Restaurant not found');
        return res.json();
      })
      .then(data => {
        setRestaurant(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error-message">{error}</div>;
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
