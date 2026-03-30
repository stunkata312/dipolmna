const db = require('./models/database');

// Clear existing data
db.exec('DELETE FROM reservations');
db.exec('DELETE FROM restaurants');
db.exec('DELETE FROM users');

// Seed users
const insertUser = db.prepare('INSERT INTO users (name, email, phone) VALUES (?, ?, ?)');
insertUser.run('Ivan Petrov', 'ivan@example.com', '+359 888 123 456');
insertUser.run('Maria Ivanova', 'maria@example.com', '+359 888 654 321');

// Seed restaurants
const insertRestaurant = db.prepare(
  'INSERT INTO restaurants (name, address, description, rating, image_url, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

insertRestaurant.run(
  'La Bella Italia',
  'ul. Vitosha 15, Sofia',
  'An authentic Italian restaurant offering handmade pasta, wood-fired pizzas, and a curated selection of Italian wines. The cozy interior and warm atmosphere make it perfect for a romantic dinner or a family gathering.',
  4.7,
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
  42.6930, 23.3210
);

insertRestaurant.run(
  'Sakura Sushi Bar',
  'bul. Tsar Osvoboditel 22, Sofia',
  'Experience the finest Japanese cuisine in the heart of Sofia. Our master sushi chefs prepare fresh sashimi, creative maki rolls, and traditional ramen bowls using premium imported ingredients.',
  4.5,
  'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=800',
  42.6950, 23.3310
);

insertRestaurant.run(
  'The Grill House',
  'ul. Graf Ignatiev 8, Sofia',
  'A premium steakhouse specializing in dry-aged beef and charcoal-grilled meats. Paired with craft cocktails and an extensive wine list, this is the go-to place for meat lovers.',
  4.3,
  'https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800',
  42.6920, 23.3270
);

insertRestaurant.run(
  'Green Garden',
  'ul. Rakovski 45, Sofia',
  'A plant-based paradise offering creative vegan and vegetarian dishes. From hearty Buddha bowls to gourmet plant burgers, every dish is crafted with locally sourced organic ingredients.',
  4.6,
  'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800',
  42.6960, 23.3280
);

insertRestaurant.run(
  'Chez Pierre',
  'ul. Shipka 12, Sofia',
  'A classic French bistro bringing the flavors of Paris to Sofia. Enjoy traditional dishes like coq au vin, duck confit, and crème brûlée in an elegant yet relaxed setting.',
  4.8,
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  42.6940, 23.3350
);

insertRestaurant.run(
  'Mehana Bulgaria',
  'ul. Patriarch Evtimiy 30, Sofia',
  'A traditional Bulgarian tavern offering classic dishes like shopska salad, kavarma, and grilled kebapche. Live folk music on weekends adds to the authentic experience.',
  4.4,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  42.6910, 23.3240
);

console.log('Database seeded successfully!');
