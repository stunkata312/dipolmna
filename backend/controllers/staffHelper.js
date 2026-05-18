const RestaurantModel = require('../models/restaurantModel');

// Resolve the restaurant for the authed staff user. Primary owners are linked
// via restaurants.owner_id; extra owners and hostesses carry users.restaurant_id.
function getStaffRestaurant(authedUser) {
  if (!authedUser) return null;
  const byOwner = RestaurantModel.getByOwnerId(authedUser.id);
  if (byOwner) return byOwner;
  if (authedUser.restaurant_id) return RestaurantModel.getById(authedUser.restaurant_id);
  return null;
}

module.exports = { getStaffRestaurant };
