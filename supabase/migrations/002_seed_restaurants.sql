-- Seed sample restaurants for Karachi, Lahore, Islamabad
-- Run after 001_initial_schema.sql

INSERT INTO restaurants (name, slug, description, cuisine, category_id, city_id, address, latitude, longitude, phone, average_price, rating_avg, review_count, cover_image_url, is_halal, is_active, is_approved, accepts_ai_bookings, opening_hours, facilities, google_place_id)
SELECT
    r.name, r.slug, r.description, r.cuisine,
    c.id,
    ci.id,
    r.address, r.latitude, r.longitude, r.phone, r.average_price, r.rating_avg, r.review_count,
    r.cover_image_url, true, true, true, true,
    r.opening_hours::jsonb,
    r.facilities::jsonb,
    r.google_place_id
FROM (VALUES
    ('BBQ Tonight', 'bbq-tonight-karachi', 'Legendary BBQ buffet with live grills and Pakistani favorites.', 'BBQ', 'bbq', 'karachi', 'Clifton Block 5, Karachi', 24.8138, 67.0299, '+9221-111-227-111', 3500, 4.3, 1250, 'https://picsum.photos/seed/bbq-tonight/600/400', '{"monday":{"open":true,"from":"12:00","to":"23:30"}}', '{"parking":true,"outdoor_seating":true,"family_area":true}', NULL),
    ('Cocochan', 'cocochan-karachi', 'Pan-Asian fine dining with stunning rooftop views of Karachi.', 'Chinese', 'chinese', 'karachi', 'Khayaban-e-Shamsheer, DHA Phase 5', 24.8012, 67.0456, '+9221-3586-0000', 5000, 4.5, 890, 'https://picsum.photos/seed/cocochan/600/400', '{"monday":{"open":true,"from":"18:00","to":"01:00"}}', '{"parking":true,"outdoor_seating":true,"prayer_area":true}', NULL),
    ('Butt Karahi Tikka', 'butt-karahi-lahore', 'Iconic Lahori karahi and tikka since generations.', 'Desi', 'desi', 'lahore', 'M.M. Alam Road, Gulberg III', 31.5204, 74.3487, '+9242-3575-0000', 2000, 4.6, 2100, 'https://picsum.photos/seed/butt-karahi/600/400', '{"monday":{"open":true,"from":"12:00","to":"02:00"}}', '{"parking":false,"indoor_seating":true,"family_area":true}', NULL),
    ('Monal Islamabad', 'monal-islamabad', 'Spectacular hilltop restaurant with panoramic views of Islamabad.', 'Desi', 'desi', 'islamabad', 'Pir Sohawa Road, Margalla Hills', 33.7490, 73.0667, '+9251-111-666-625', 4000, 4.4, 3200, 'https://picsum.photos/seed/monal/600/400', '{"monday":{"open":true,"from":"11:00","to":"00:00"}}', '{"parking":true,"outdoor_seating":true,"wheelchair":true,"prayer_area":true}', NULL),
    ('Kolachi Restaurant', 'kolachi-karachi', 'Beachfront dining with fresh seafood and BBQ.', 'Seafood', 'seafood', 'karachi', 'Beach Avenue, Do Darya, DHA Phase 8', 24.7910, 67.0634, '+9221-3584-0000', 4500, 4.2, 980, 'https://picsum.photos/seed/kolachi/600/400', '{"monday":{"open":true,"from":"17:00","to":"01:00"}}', '{"parking":true,"outdoor_seating":true,"family_area":true}', NULL),
    ('Espresso', 'espresso-lahore', 'Premium cafe chain with artisan coffee and brunch.', 'Cafe', 'cafe', 'lahore', 'Main Boulevard, Gulberg II', 31.5290, 74.3420, '+9242-111-000-000', 1500, 4.1, 650, 'https://picsum.photos/seed/espresso/600/400', '{"monday":{"open":true,"from":"08:00","to":"23:00"}}', '{"parking":true,"outdoor_seating":true,"wifi":true}', NULL),
    ('X2 Pan-Asian', 'x2-pan-asian-karachi', 'Modern pan-Asian cuisine in a sleek Clifton setting.', 'Chinese', 'chinese', 'karachi', 'Clifton Block 4, Karachi', 24.8150, 67.0320, '+9221-3587-0000', 4000, 4.0, 420, 'https://picsum.photos/seed/x2/600/400', '{"monday":{"open":true,"from":"18:00","to":"00:00"}}', '{"parking":true,"indoor_seating":true}', NULL),
    ('Bundu Khan', 'bundu-khan-lahore', 'Classic desi BBQ and karahi in a family-friendly setting.', 'BBQ', 'bbq', 'lahore', 'Liberty Market, Gulberg III', 31.5150, 74.3410, '+9242-3571-0000', 2500, 4.3, 1100, 'https://picsum.photos/seed/bundu-khan/600/400', '{"monday":{"open":true,"from":"12:00","to":"01:00"}}', '{"parking":true,"family_area":true,"kids_area":true}', NULL)
) AS r(name, slug, description, cuisine, cat_slug, city_slug, address, latitude, longitude, phone, average_price, rating_avg, review_count, cover_image_url, opening_hours, facilities, google_place_id)
JOIN categories c ON c.slug = r.cat_slug
JOIN cities ci ON ci.slug = r.city_slug;

-- Sample menu items
INSERT INTO menu_items (restaurant_id, name, description, price, category)
SELECT r.id, m.name, m.description, m.price, m.category
FROM restaurants r
JOIN (VALUES
    ('bbq-tonight-karachi', 'Chicken Tikka', 'Marinated and grilled to perfection', 850, 'Grills'),
    ('bbq-tonight-karachi', 'Seekh Kebab', 'Spiced minced meat skewers', 750, 'Grills'),
    ('bbq-tonight-karachi', 'Mutton Karahi', 'Traditional karahi with naan', 1200, 'Karahi'),
    ('monal-islamabad', 'Mutton Karahi', 'Signature Monal karahi', 1800, 'Karahi'),
    ('monal-islamabad', 'Chicken Handi', 'Creamy chicken curry', 1400, 'Curries'),
    ('butt-karahi-lahore', 'Lahori Karahi', 'The original Butt karahi', 1600, 'Karahi'),
    ('kolachi-karachi', 'Grilled Prawns', 'Fresh jumbo prawns', 2200, 'Seafood'),
    ('cocochan-karachi', 'Dragon Chicken', 'Crispy sweet and spicy', 1100, 'Chinese')
) AS m(slug, name, description, price, category) ON r.slug = m.slug;

-- Sample special offers
INSERT INTO special_offers (restaurant_id, title, description, discount_percent, is_active)
SELECT r.id, o.title, o.description, o.discount_percent, true
FROM restaurants r
JOIN (VALUES
    ('bbq-tonight-karachi', 'Weekday Lunch Special', '20% off lunch buffet Mon-Thu', 20),
    ('monal-islamabad', 'Sunset Dinner Deal', 'Complimentary dessert with main course', 15),
    ('espresso-lahore', 'Coffee & Croissant', 'Buy 1 Get 1 on croissants before 11am', 50)
) AS o(slug, title, description, discount_percent) ON r.slug = o.slug;
