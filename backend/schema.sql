CREATE TABLE restaurants (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    cuisine       VARCHAR(60)  NOT NULL,
    rating        NUMERIC(2,1) NOT NULL DEFAULT 4.0,
    delivery_time INT          NOT NULL DEFAULT 30,
    description   TEXT
);

CREATE TABLE menu_items (
    id            SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    price         NUMERIC(8,2) NOT NULL CHECK (price > 0),
    category      VARCHAR(40)  NOT NULL DEFAULT 'Mains'
);

CREATE TABLE orders (
    id            SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    phone         VARCHAR(30)  NOT NULL,
    address       TEXT         NOT NULL,
    total         NUMERIC(10,2) NOT NULL,
    status        VARCHAR(30)  NOT NULL DEFAULT 'Placed',
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id        SERIAL PRIMARY KEY,
    order_id  INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    price     NUMERIC(8,2) NOT NULL,
    qty       INT NOT NULL CHECK (qty > 0)
);

INSERT INTO restaurants (name, cuisine, rating, delivery_time, description) VALUES
 ('Karahi Junction', 'Desi', 4.7, 35, 'Wok-fired karahi, fresh naan and tandoor grills.'),
 ('Burger Lab',      'Fast Food', 4.4, 25, 'Smashed beef patties, crispy chicken and loaded fries.'),
 ('Pasta Piazza',    'Italian', 4.5, 40, 'Handmade pasta, wood-fired pizza and garlic bread.'),
 ('Sushi Sora',      'Japanese', 4.6, 45, 'Rolls, nigiri and warm ramen bowls.');

INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES
 (1, 'Chicken Karahi (Half)', 'Tomato, ginger and green chilli gravy', 1450, 'Mains'),
 (1, 'Seekh Kabab (6 pcs)',   'Charcoal-grilled minced beef skewers', 950,  'Grill'),
 (1, 'Butter Naan',           'Fresh from the tandoor', 80, 'Breads'),
 (1, 'Mutton Biryani',        'Slow-cooked with saffron rice', 1250, 'Rice'),
 (1, 'Mint Raita',            'Cool yoghurt with mint', 120, 'Sides'),
 (2, 'Classic Smash Burger',  'Double patty, cheddar, house sauce', 890, 'Burgers'),
 (2, 'Zinger Burger',         'Crispy fried chicken, slaw, mayo', 720, 'Burgers'),
 (2, 'Loaded Fries',          'Cheese sauce, jalapenos, crispy onions', 560, 'Sides'),
 (2, 'Chocolate Shake',       'Thick and cold', 450, 'Drinks'),
 (3, 'Fettuccine Alfredo',    'Creamy parmesan sauce with grilled chicken', 1190, 'Pasta'),
 (3, 'Pepperoni Pizza (M)',   'Mozzarella and spicy pepperoni', 1350, 'Pizza'),
 (3, 'Garlic Bread',          'Toasted with herb butter', 380, 'Sides'),
 (3, 'Tiramisu',              'Espresso-soaked layers', 520, 'Dessert'),
 (4, 'California Roll (8)',   'Crab, avocado and cucumber', 1050, 'Rolls'),
 (4, 'Salmon Nigiri (4)',     'Fresh salmon over seasoned rice', 1400, 'Nigiri'),
 (4, 'Tonkotsu Ramen',        'Pork broth, egg, noodles', 1250, 'Ramen'),
 (4, 'Matcha Ice Cream',      'Two scoops', 480, 'Dessert');

INSERT INTO orders (customer_name, phone, address, total, status) VALUES
 ('Demo Customer', '0300-0000000', 'Block A, Demo Town, Lahore', 1530, 'Delivered');
INSERT INTO order_items (order_id, item_name, price, qty) VALUES
 (1, 'Chicken Karahi (Half)', 1450, 1), (1, 'Butter Naan', 80, 1);
