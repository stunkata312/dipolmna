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
  'bul. Knyaz Boris I 25, Varna',
  'An authentic Italian restaurant offering handmade pasta, wood-fired pizzas, and a curated selection of Italian wines. The cozy interior and warm atmosphere make it perfect for a romantic dinner or a family gathering.',
  4.7,
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
  43.2069, 27.9172
);

insertRestaurant.run(
  'Sakura Sushi Bar',
  'bul. Slivnitsa 36, Varna',
  'Experience the finest Japanese cuisine on the Black Sea coast. Our master sushi chefs prepare fresh sashimi, creative maki rolls, and traditional ramen bowls using premium imported ingredients.',
  4.5,
  'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=800',
  43.2086, 27.9235
);

insertRestaurant.run(
  'The Grill House',
  'bul. Maria Luiza 15, Varna',
  'A premium steakhouse specializing in dry-aged beef and charcoal-grilled meats. Paired with craft cocktails and an extensive wine list, this is the go-to place for meat lovers.',
  4.3,
  'https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800',
  43.2105, 27.9145
);

insertRestaurant.run(
  'Green Garden',
  'ul. Han Krum 24, Varna',
  'A plant-based paradise offering creative vegan and vegetarian dishes. From hearty Buddha bowls to gourmet plant burgers, every dish is crafted with locally sourced organic ingredients.',
  4.6,
  'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800',
  43.2050, 27.9127
);

insertRestaurant.run(
  'Chez Pierre',
  'Primorski Park (Sea Garden), Varna',
  'A classic French bistro bringing the flavors of Paris to the Black Sea. Enjoy traditional dishes like coq au vin, duck confit, and crème brûlée in an elegant yet relaxed setting overlooking the sea.',
  4.8,
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  43.2140, 27.9270
);

insertRestaurant.run(
  'Mehana Bulgaria',
  'ul. 27-mi Yuli 13, Varna',
  'A traditional Bulgarian tavern offering classic dishes like shopska salad, kavarma, and grilled kebapche. Live folk music on weekends adds to the authentic experience.',
  4.4,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  43.2057, 27.9157
);

console.log('Database seeded successfully!');
