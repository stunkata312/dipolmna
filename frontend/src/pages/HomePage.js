import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StarRating from '../components/StarRating';

const API_URL = 'http://localhost:5000/api';

function HomePage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/restaurants`)
      .then(res => res.json())
      .then(data => {
        setRestaurants(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load restaurants');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading restaurants...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div>
      <h1 className="home-title">Restaurants</h1>
      <div className="restaurant-grid">
        {restaurants.map(restaurant => (
          <Link
            to={`/restaurant/${restaurant.id}`}
            key={restaurant.id}
            className="restaurant-card"
          >
            <img
              src={restaurant.image_url}
              alt={restaurant.name}
              className="restaurant-card-image"
            />
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
