// ============================================================================
// 개발용 데이터 시드 스크립트
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) initDb() 로 DB 를 준비한다(없으면 새로 만든다).
//   2) 기존 테이블 데이터를 FK 역순으로 전부 삭제한다.
//   3) 관리자 / 게스트 계정, 호텔 3개 + 방 타입 8개, 티켓 5개, 패키지 3개
//      를 새로 INSERT 한다.
//   4) 오늘부터 30일 동안의 room/ticket/package 인벤토리를 한 트랜잭션으로
//      일괄 생성한다(주말 가격 +30%, 주말 예약률 가중치 반영).
//   5) 샘플 예약 3건(확정/대기/취소)과 대응 결제/바우처 row 를 만든다.
//
// 실행 방법: `node backend/src/seed.js` (또는 `npm run seed`).
// 절대 운영 DB 에 돌리지 말 것 — DELETE 로 시작하므로 모든 데이터가 날아간다.
//
// 주의:
//   - DELETE 순서는 FK 체인을 따른다. vouchers → payments → bookings →
//     package_inventory → package_items → packages → ticket_inventory →
//     tickets → room_inventory → room_types → hotels → users.
//     거꾸로 돌리면 FK 제약에 걸려 실패한다.
//   - 비밀번호는 bcrypt 라운드 10 으로 해시해 저장한다. (admin123, test123)
//   - 인벤토리 생성은 db.transaction() 안에 넣어 한 번의 saveDb 로 끝낸다.
//     바깥에서 호출하면 매 INSERT 마다 전체 DB 직렬화가 일어나 수십 배
//     느려진다.
// ============================================================================

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, initDb } = require('./config/database');

/** routes/bookings.js 와 동일한 12자리 예약 번호 생성기. */
function generateBookingNumber() {
  return 'BK-' + uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
}

/** routes/bookings.js 와 동일한 10자리 바우처 코드 생성기. */
function generateVoucherCode() {
  return 'VCR-' + uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase();
}

/**
 * 오늘에서 `daysFromNow` 일 뒤의 날짜를 YYYY-MM-DD 포맷으로 반환.
 * 음수도 허용되므로 과거 날짜 시뮬레이션에도 쓸 수 있다(현재는 0~29 만 사용).
 */
function getDateString(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

/**
 * 실제 시드 작업 본체. initDb() 가 끝난 뒤 호출한다.
 *
 * 단계:
 *   1) 테이블 전체 DELETE (FK 역순)
 *   2) 사용자 2명 INSERT (admin / guest)
 *   3) 호텔 3 + 방 타입 8 INSERT
 *   4) 티켓 5 + 패키지 3 (+ package_items) INSERT
 *   5) 30일치 room/ticket/package inventory 를 한 트랜잭션으로 INSERT
 *   6) 샘플 예약 3건 + payments + vouchers INSERT
 *
 * 부작용: DB 에 대규모 INSERT 가 일어나고 high1.db 가 여러 번 저장된다.
 */
function seed() {
  const db = getDb();

  console.log('Seeding High1 Resort database...');

  // 기존 데이터 삭제. 외래 키 때문에 **자식 테이블부터** 지워야 한다.
  // vouchers / payments → bookings → (package_inventory, package_items) →
  // packages → ticket_inventory → tickets → room_inventory → room_types →
  // hotels → users 순.
  db.exec(`
    DELETE FROM vouchers;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM package_inventory;
    DELETE FROM package_items;
    DELETE FROM packages;
    DELETE FROM ticket_inventory;
    DELETE FROM tickets;
    DELETE FROM room_inventory;
    DELETE FROM room_types;
    DELETE FROM hotels;
    DELETE FROM users;
  `);

  // ============================================================
  // USERS
  // ============================================================
  //
  // 데모 계정 2개 생성:
  //   admin@high1.com  (role=admin, 관리자 콘솔 접속)
  //   guest@test.com   (role=customer, 고객 앱 접속)
  //
  // 비밀번호 결정 규칙:
  //   1) 환경변수 SEED_ADMIN_PASSWORD / SEED_GUEST_PASSWORD 가 설정돼
  //      있으면 그 값으로 계정을 만든다. (CI/운영용)
  //   2) 환경변수가 없으면 기존 GUIDE.md / 온보딩 문서에 명시돼 있는
  //      관습 값('admin123', 'test123') 을 그대로 사용한다. 이 경로는
  //      어디까지나 "첫 실행 친화 UX" 를 위한 것이며, 아래에서 명시적
  //      경고 배너를 출력해 그 사실을 사용자에게 알린다.
  //
  // ☢ 운영 환경에서 이 seed 스크립트를 그대로 돌리지 말 것. 운영에서는
  //   반드시 env 로 강력한 임의 비밀번호를 넣거나, 이 스크립트를
  //   실행하지 말고 정상 회원가입 플로우로 운영 계정을 만들 것.
  console.log('Creating users...');

  const envAdminPw = process.env.SEED_ADMIN_PASSWORD;
  const envGuestPw = process.env.SEED_GUEST_PASSWORD;
  const adminPwPlain = envAdminPw || 'admin123';
  const guestPwPlain = envGuestPw || 'test123';

  if (!envAdminPw || !envGuestPw) {
    // 하나라도 기본값이 쓰였으면 눈에 띄는 경고 배너를 출력한다.
    console.warn('');
    console.warn('  ╔══════════════════════════════════════════════════════════════╗');
    console.warn('  ║  ⚠  SEED IS USING WEAK DEMO PASSWORDS                        ║');
    console.warn('  ║                                                              ║');
    console.warn('  ║  admin@high1.com  →  ' + adminPwPlain.padEnd(40) + '║');
    console.warn('  ║  guest@test.com   →  ' + guestPwPlain.padEnd(40) + '║');
    console.warn('  ║                                                              ║');
    console.warn('  ║  These are the out-of-the-box onboarding credentials.        ║');
    console.warn('  ║  Override them before any non-local deploy:                  ║');
    console.warn('  ║    SEED_ADMIN_PASSWORD=... SEED_GUEST_PASSWORD=... npm seed  ║');
    console.warn('  ╚══════════════════════════════════════════════════════════════╝');
    console.warn('');
  }

  // bcrypt 해시. 라운드 10 — routes/auth.js 의 register/login 과 일치.
  const adminPassword = bcrypt.hashSync(adminPwPlain, 10);
  const guestPassword = bcrypt.hashSync(guestPwPlain, 10);

  db.prepare(`
    INSERT INTO users (email, password, name, phone, nationality, role, language)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin@high1.com', adminPassword, 'Admin', '+82-33-745-5000', 'KR', 'admin', 'en');

  db.prepare(`
    INSERT INTO users (email, password, name, phone, nationality, role, language)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('guest@test.com', guestPassword, 'Zhang Wei', '+86-138-0000-1234', 'CN', 'customer', 'cn');

  const adminUser = db.prepare("SELECT id FROM users WHERE email = 'admin@high1.com'").get();
  const guestUser = db.prepare("SELECT id FROM users WHERE email = 'guest@test.com'").get();

  // ============================================================
  // HOTELS
  // ============================================================
  console.log('Creating hotels...');

  const hotel1 = db.prepare(`
    INSERT INTO hotels (name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'High1 Grand Hotel',
    'High1 格兰酒店',
    'Experience luxury at its finest in our 5-star Grand Hotel, nestled in the heart of the High1 Resort. Featuring panoramic mountain views, world-class dining, and direct ski-in/ski-out access. Every room is designed for ultimate comfort with premium bedding, marble bathrooms, and state-of-the-art amenities.',
    '在High1度假村中心的五星级格兰酒店体验顶级奢华。酒店拥有全景山景、世界级餐饮和直接滑雪进出通道。每间客房都配有高级床品、大理石浴室和先进设施，为您带来极致舒适体验。',
    '424 High1-gil, Sabuk-eup, Jeongseon-gun, Gangwon-do, South Korea',
    '/images/hotels/grand-hotel.jpg',
    4.8,
    JSON.stringify(['Free WiFi', 'Ski Storage', 'Spa', 'Indoor Pool', 'Fitness Center', 'Restaurant', 'Bar', 'Room Service', 'Concierge', 'Valet Parking']),
    'active'
  );

  const hotel2 = db.prepare(`
    INSERT INTO hotels (name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'High1 Mountain Lodge',
    'High1 山间小屋',
    'A cozy mountain retreat perfect for families and groups. Our Mountain Lodge offers comfortable accommodations with easy access to ski slopes and resort facilities. Enjoy the warmth of our lodge-style rooms with mountain-inspired decor and modern amenities.',
    '温馨的山间度假胜地，非常适合家庭和团体。我们的山间小屋提供舒适的住宿，方便前往滑雪场和度假村设施。享受山间风格的客房，装饰灵感来自自然，并配备现代化设施。',
    '424 High1-gil, Sabuk-eup, Jeongseon-gun, Gangwon-do, South Korea',
    '/images/hotels/mountain-lodge.jpg',
    4.5,
    JSON.stringify(['Free WiFi', 'Ski Storage', 'Restaurant', 'Laundry', 'Parking', 'Kids Play Area', 'Fireplace Lounge']),
    'active'
  );

  const hotel3 = db.prepare(`
    INSERT INTO hotels (name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'High1 Valley Inn',
    'High1 山谷旅馆',
    'Budget-friendly accommodations without compromising on comfort. Our Valley Inn provides clean, well-maintained rooms at affordable prices, making it the ideal choice for budget-conscious travelers who still want to enjoy the High1 Resort experience.',
    '经济实惠的住宿，不影响舒适度。我们的山谷旅馆提供干净整洁的客房，价格实惠，是注重预算又想享受High1度假村体验的旅客的理想选择。',
    '424 High1-gil, Sabuk-eup, Jeongseon-gun, Gangwon-do, South Korea',
    '/images/hotels/valley-inn.jpg',
    4.2,
    JSON.stringify(['Free WiFi', 'Parking', 'Breakfast Included', 'Shuttle Service', 'Luggage Storage']),
    'active'
  );

  // ============================================================
  // ROOM TYPES
  // ============================================================
  console.log('Creating room types...');

  // Grand Hotel rooms
  const rt1 = db.prepare(`
    INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, base_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotel1.lastInsertRowid,
    'Deluxe Mountain View', '豪华山景房',
    'Spacious 45sqm room with floor-to-ceiling windows offering breathtaking mountain views. Features a king-size bed, marble bathroom with rain shower, mini-bar, and premium toiletries.',
    '宽敞的45平方米客房，落地窗可欣赏壮丽山景。配有特大床、大理石浴室（带雨淋花洒）、迷你吧和高级洗浴用品。',
    2, 'King',
    JSON.stringify(['Mountain View', 'Rain Shower', 'Mini Bar', 'Safe', '55-inch TV', 'Coffee Machine', 'Bathrobe']),
    '/images/rooms/grand-deluxe.jpg', 280000, 'active'
  );

  const rt2 = db.prepare(`
    INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, base_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotel1.lastInsertRowid,
    'Premium Suite', '高级套房',
    'Luxurious 75sqm suite with separate living area, bedroom with king-size bed, and a premium bathroom with jacuzzi tub. Includes exclusive access to the Executive Lounge with complimentary breakfast and evening cocktails.',
    '奢华的75平方米套房，配有独立起居区、特大床卧室和带按摩浴缸的高级浴室。包括行政酒廊的独家使用权，提供免费早餐和晚间鸡尾酒。',
    3, 'King',
    JSON.stringify(['Jacuzzi', 'Living Area', 'Executive Lounge Access', 'Mountain View', 'Mini Bar', 'Nespresso', 'Bathrobe', 'Premium Toiletries']),
    '/images/rooms/grand-suite.jpg', 450000, 'active'
  );

  const rt3 = db.prepare(`
    INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, base_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotel1.lastInsertRowid,
    'Family Room', '家庭房',
    'Perfect for families, this 55sqm room features two double beds and a cozy sitting area. Includes child-friendly amenities and easy access to the kids play area.',
    '非常适合家庭，这间55平方米的客房配有两张双人床和一个舒适的休息区。包括儿童友好设施，方便前往儿童游乐区。',
    4, 'Twin Double',
    JSON.stringify(['Two Double Beds', 'Sitting Area', 'Mountain View', 'Mini Fridge', '55-inch TV', 'Child Amenities']),
    '/images/rooms/grand-family.jpg', 350000, 'active'
  );

  // Mountain Lodge rooms
  const rt4 = db.prepare(`
    INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, base_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotel2.lastInsertRowid,
    'Standard Room', '标准房',
    'Comfortable 30sqm room with lodge-style decor, featuring a queen-size bed and modern bathroom. A perfect base for your mountain adventure.',
    '舒适的30平方米客房，山间小屋风格装饰，配有大号床和现代浴室。是您山间冒险的完美基地。',
    2, 'Queen',
    JSON.stringify(['Free WiFi', 'TV', 'Heating', 'Private Bathroom', 'Desk']),
    '/images/rooms/lodge-standard.jpg', 150000, 'active'
  );

  const rt5 = db.prepare(`
    INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, base_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotel2.lastInsertRowid,
    'Superior Room', '高级房',
    'Upgraded 38sqm room with mountain views, king-size bed, and a spacious bathroom. Includes a small sitting area and complimentary welcome drink.',
    '升级的38平方米客房，山景，特大床和宽敞浴室。包括小型休息区和免费欢迎饮料。',
    2, 'King',
    JSON.stringify(['Mountain View', 'Free WiFi', 'TV', 'Mini Fridge', 'Sitting Area', 'Welcome Drink']),
    '/images/rooms/lodge-superior.jpg', 200000, 'active'
  );

  // Valley Inn rooms
  const rt6 = db.prepare(`
    INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, base_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotel3.lastInsertRowid,
    'Economy Single', '经济单人房',
    'Clean and efficient 20sqm room with a single bed, perfect for solo travelers. Includes breakfast and shuttle service to ski slopes.',
    '干净高效的20平方米客房，配有单人床，非常适合独行旅客。包括早餐和前往滑雪场的班车服务。',
    1, 'Single',
    JSON.stringify(['Free WiFi', 'Breakfast Included', 'Shuttle Service', 'TV']),
    '/images/rooms/valley-economy.jpg', 80000, 'active'
  );

  const rt7 = db.prepare(`
    INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, base_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotel3.lastInsertRowid,
    'Economy Twin', '经济双床房',
    'Comfortable 25sqm room with two single beds, ideal for friends traveling together. Includes breakfast and shuttle service.',
    '舒适的25平方米客房，配有两张单人床，非常适合一起旅行的朋友。包括早餐和班车服务。',
    2, 'Twin',
    JSON.stringify(['Free WiFi', 'Breakfast Included', 'Shuttle Service', 'TV', 'Heating']),
    '/images/rooms/valley-twin.jpg', 120000, 'active'
  );

  const rt8 = db.prepare(`
    INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, base_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotel3.lastInsertRowid,
    'Economy Double', '经济双人房',
    'Budget-friendly 22sqm room with a double bed. Clean and cozy with all essential amenities. Includes breakfast and free parking.',
    '经济实惠的22平方米客房，配有双人床。干净舒适，配有所有基本设施。包括早餐和免费停车。',
    2, 'Double',
    JSON.stringify(['Free WiFi', 'Breakfast Included', 'Free Parking', 'TV', 'Heating']),
    '/images/rooms/valley-double.jpg', 100000, 'active'
  );

  // ============================================================
  // TICKETS
  // ============================================================
  console.log('Creating tickets...');

  const ticket1 = db.prepare(`
    INSERT INTO tickets (name_en, name_cn, description_en, description_cn, category, image_url, base_price, duration, location, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Ski Lift Pass', '滑雪缆车通行证',
    'Full-day access to all ski lifts at High1 Resort. Enjoy 18 slopes ranging from beginner to expert level across 3 peaks. Includes access to the resort gondola for scenic mountain views.',
    '全天使用High1度假村所有滑雪缆车。享受横跨3座山峰的18条滑道，从初级到专家级。包括度假村缆车的使用权，欣赏山间美景。',
    'ski', '/images/tickets/ski-lift.jpg',
    79000, 'Full Day (8:30 AM - 5:00 PM)',
    'High1 Ski Resort - All Peaks', 'active'
  );

  const ticket2 = db.prepare(`
    INSERT INTO tickets (name_en, name_cn, description_en, description_cn, category, image_url, base_price, duration, location, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Snow Tubing Adventure', '雪上滑圈冒险',
    'Thrilling snow tubing experience on specially designed lanes. Safe and fun for all ages! Includes tube rental and unlimited runs during your session.',
    '在专门设计的滑道上体验刺激的雪上滑圈。安全有趣，适合所有年龄段！包括滑圈租赁和会话期间的无限次滑行。',
    'activity', '/images/tickets/snow-tubing.jpg',
    35000, '2 Hours',
    'High1 Resort Snow Park', 'active'
  );

  const ticket3 = db.prepare(`
    INSERT INTO tickets (name_en, name_cn, description_en, description_cn, category, image_url, base_price, duration, location, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Gondola Scenic Ride', '缆车观光',
    'Take a scenic gondola ride to the top of the mountain and enjoy panoramic views of the Taebaek Mountain range. Perfect for photography and sightseeing. Includes round-trip gondola ticket.',
    '乘坐观光缆车到达山顶，欣赏太白山脉的全景。非常适合摄影和观光。包括往返缆车票。',
    'sightseeing', '/images/tickets/gondola.jpg',
    25000, '1.5 Hours (round trip)',
    'High1 Resort Gondola Station', 'active'
  );

  const ticket4 = db.prepare(`
    INSERT INTO tickets (name_en, name_cn, description_en, description_cn, category, image_url, base_price, duration, location, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Ski Lesson - Beginner', '初级滑雪课程',
    'Professional ski instruction for beginners by certified instructors. Learn the basics of skiing in a safe and fun environment. Small group sizes ensure personalized attention. Includes equipment rental.',
    '由认证教练提供的专业初级滑雪指导。在安全有趣的环境中学习滑雪基础。小组规模确保个性化关注。包括设备租赁。',
    'lesson', '/images/tickets/ski-lesson.jpg',
    120000, '3 Hours (includes equipment)',
    'High1 Ski School', 'active'
  );

  const ticket5 = db.prepare(`
    INSERT INTO tickets (name_en, name_cn, description_en, description_cn, category, image_url, base_price, duration, location, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Spa & Wellness Package', '水疗与健康套餐',
    'Relax and rejuvenate at our premium spa facility. This package includes access to the hot spring pools, sauna, and steam room, plus a 60-minute traditional Korean body treatment. Complimentary herbal tea service included.',
    '在我们的高级水疗设施中放松身心。此套餐包括温泉池、桑拿浴和蒸汽浴的使用权，以及60分钟的传统韩式身体护理。包括免费草本茶服务。',
    'wellness', '/images/tickets/spa.jpg',
    95000, '3 Hours',
    'High1 Grand Hotel Spa Center', 'active'
  );

  // ============================================================
  // PACKAGES
  // ============================================================
  console.log('Creating packages...');

  const pkg1 = db.prepare(`
    INSERT INTO packages (name_en, name_cn, description_en, description_cn, image_url, base_price, includes, duration, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Ultimate Ski Getaway', '终极滑雪之旅',
    'The complete High1 ski experience! 2 nights at the Grand Hotel in a Deluxe Mountain View room, 2-day ski lift pass, and a relaxing spa session after hitting the slopes. Perfect for ski enthusiasts who want the premium experience.',
    '完整的High1滑雪体验！入住格兰酒店豪华山景房2晚，2天滑雪缆车通行证，以及滑雪后的放松水疗。非常适合想要高级体验的滑雪爱好者。',
    '/images/packages/ultimate-ski.jpg',
    750000,
    JSON.stringify(['2 nights at Grand Hotel (Deluxe Mountain View)', '2-day Ski Lift Pass', 'Spa & Wellness Package', 'Airport Shuttle', 'Welcome Drink']),
    '3 days / 2 nights', 'active'
  );

  const pkg2 = db.prepare(`
    INSERT INTO packages (name_en, name_cn, description_en, description_cn, image_url, base_price, includes, duration, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Family Fun Bundle', '家庭欢乐套餐',
    'Create unforgettable family memories at High1 Resort! Includes 2 nights at the Mountain Lodge, snow tubing for the family, and a scenic gondola ride. Kids will love the adventure while parents enjoy the beautiful mountain scenery.',
    '在High1度假村创造难忘的家庭回忆！包括山间小屋2晚住宿、家庭雪上滑圈和观光缆车。孩子们会喜欢冒险，父母可以享受美丽的山景。',
    '/images/packages/family-fun.jpg',
    480000,
    JSON.stringify(['2 nights at Mountain Lodge (Superior Room)', 'Snow Tubing for 4', 'Gondola Scenic Ride for 4', 'Kids Welcome Gift', 'Free Parking']),
    '3 days / 2 nights', 'active'
  );

  const pkg3 = db.prepare(`
    INSERT INTO packages (name_en, name_cn, description_en, description_cn, image_url, base_price, includes, duration, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Budget Ski & Stay', '经济滑雪住宿',
    'Enjoy the High1 ski experience without breaking the bank! 1 night at the Valley Inn with a full-day ski lift pass. Includes breakfast and shuttle service to the slopes. Best value for solo travelers and couples.',
    '享受High1滑雪体验，不需花费太多！山谷旅馆1晚住宿加全天滑雪缆车通行证。包括早餐和前往滑雪场的班车服务。为独行旅客和情侣提供最佳价值。',
    '/images/packages/budget-ski.jpg',
    199000,
    JSON.stringify(['1 night at Valley Inn (Economy Double)', '1-day Ski Lift Pass', 'Breakfast', 'Shuttle Service', 'Ski Locker']),
    '2 days / 1 night', 'active'
  );

  // Package items
  const insertPackageItem = db.prepare('INSERT INTO package_items (package_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)');

  // Ultimate Ski Getaway items
  insertPackageItem.run(pkg1.lastInsertRowid, 'room_type', rt1.lastInsertRowid, 1); // Deluxe Mountain View
  insertPackageItem.run(pkg1.lastInsertRowid, 'ticket', ticket1.lastInsertRowid, 2); // 2-day Ski Lift Pass
  insertPackageItem.run(pkg1.lastInsertRowid, 'ticket', ticket5.lastInsertRowid, 1); // Spa

  // Family Fun Bundle items
  insertPackageItem.run(pkg2.lastInsertRowid, 'room_type', rt5.lastInsertRowid, 1); // Lodge Superior
  insertPackageItem.run(pkg2.lastInsertRowid, 'ticket', ticket2.lastInsertRowid, 4); // Snow Tubing x4
  insertPackageItem.run(pkg2.lastInsertRowid, 'ticket', ticket3.lastInsertRowid, 4); // Gondola x4

  // Budget Ski & Stay items
  insertPackageItem.run(pkg3.lastInsertRowid, 'room_type', rt8.lastInsertRowid, 1); // Valley Economy Double
  insertPackageItem.run(pkg3.lastInsertRowid, 'ticket', ticket1.lastInsertRowid, 1); // 1-day Ski Lift Pass

  // ============================================================
  // INVENTORY (next 30 days)
  // ============================================================
  // 오늘(포함)부터 30일치 room/ticket/package 재고를 만든다.
  // 가격은 주말(토/일)에 1.3배, 평일은 1.0배.
  // 예약률(= preBooked)도 주말이 더 높게 시뮬레이션한다.
  // 전체 루프를 하나의 트랜잭션으로 묶어서 saveDb 호출을 한 번으로 줄인다.
  console.log('Creating inventory for next 30 days...');

  const roomTypeIds = [
    rt1.lastInsertRowid, rt2.lastInsertRowid, rt3.lastInsertRowid,
    rt4.lastInsertRowid, rt5.lastInsertRowid,
    rt6.lastInsertRowid, rt7.lastInsertRowid, rt8.lastInsertRowid
  ];
  const roomCounts = [20, 10, 15, 30, 20, 25, 20, 25];
  const roomPrices = [280000, 450000, 350000, 150000, 200000, 80000, 120000, 100000];

  const ticketIds = [
    ticket1.lastInsertRowid, ticket2.lastInsertRowid, ticket3.lastInsertRowid,
    ticket4.lastInsertRowid, ticket5.lastInsertRowid
  ];
  const ticketQuantities = [500, 200, 300, 50, 80];
  const ticketPrices = [79000, 35000, 25000, 120000, 95000];

  const packageIds = [pkg1.lastInsertRowid, pkg2.lastInsertRowid, pkg3.lastInsertRowid];
  const packageQuantities = [30, 40, 50];
  const packagePrices = [750000, 480000, 199000];

  const insertRoomInv = db.prepare('INSERT INTO room_inventory (room_type_id, date, total_rooms, booked_rooms, price) VALUES (?, ?, ?, ?, ?)');
  const insertTicketInv = db.prepare('INSERT INTO ticket_inventory (ticket_id, date, total_quantity, booked_quantity, price) VALUES (?, ?, ?, ?, ?)');
  const insertPackageInv = db.prepare('INSERT INTO package_inventory (package_id, date, total_quantity, booked_quantity, price) VALUES (?, ?, ?, ?, ?)');

  // db.transaction() 래퍼는 콜백을 BEGIN..COMMIT 안에서 실행한다.
  // 내부 모든 INSERT 가 끝나야 단 한 번의 파일 직렬화가 일어난다.
  const insertAllInventory = db.transaction(() => {
    for (let day = 0; day < 30; day++) {
      const dateStr = getDateString(day);
      // Date#getDay(): 0 = Sunday, 6 = Saturday.
      const isWeekend = [0, 6].includes(new Date(dateStr).getDay());
      // 주말 가격 +30%. 운영에서는 관리자 콘솔의 bulk inventory 업데이트로
      // 세밀하게 조정할 수 있다.
      const multiplier = isWeekend ? 1.3 : 1.0;

      // Room inventory
      for (let i = 0; i < roomTypeIds.length; i++) {
        const price = Math.round(roomPrices[i] * multiplier);
        const preBooked = isWeekend ? Math.floor(roomCounts[i] * 0.3) : Math.floor(roomCounts[i] * 0.1);
        insertRoomInv.run(roomTypeIds[i], dateStr, roomCounts[i], preBooked, price);
      }

      // Ticket inventory
      for (let i = 0; i < ticketIds.length; i++) {
        const price = Math.round(ticketPrices[i] * multiplier);
        const preBooked = isWeekend ? Math.floor(ticketQuantities[i] * 0.4) : Math.floor(ticketQuantities[i] * 0.1);
        insertTicketInv.run(ticketIds[i], dateStr, ticketQuantities[i], preBooked, price);
      }

      // Package inventory
      for (let i = 0; i < packageIds.length; i++) {
        const price = Math.round(packagePrices[i] * multiplier);
        const preBooked = isWeekend ? Math.floor(packageQuantities[i] * 0.2) : Math.floor(packageQuantities[i] * 0.05);
        insertPackageInv.run(packageIds[i], dateStr, packageQuantities[i], preBooked, price);
      }
    }
  });

  insertAllInventory();

  // ============================================================
  // SAMPLE BOOKINGS
  // ============================================================
  // 프런트엔드 UI 상태(확정/대기/취소 각각)를 바로 확인할 수 있도록
  // 세 건의 샘플 예약을 만든다. 각 예약은 결제 row 와 바우처 row 를
  // 함께 갖는다(실제 예약 API 와 동일한 구조).
  console.log('Creating sample bookings...');

  // 예약 1: 확정된 호텔 예약 (Zhang Wei, Deluxe Mountain View, 2박)
  const bn1 = generateBookingNumber();
  const checkIn1 = getDateString(5);
  const checkIn1End = getDateString(7);
  const booking1 = db.prepare(`
    INSERT INTO bookings (booking_number, user_id, guest_name, guest_email, guest_phone, product_type, product_id, room_type_id, check_in, check_out, guests, quantity, nights, total_price, status, payment_status, special_requests)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bn1, guestUser.id, 'Zhang Wei', 'guest@test.com', '+86-138-0000-1234',
    'hotel', hotel1.lastInsertRowid, rt1.lastInsertRowid,
    checkIn1, checkIn1End,
    2, 1, 2, 560000,
    'confirmed', 'paid', 'Late check-in around 9 PM please'
  );

  db.prepare("INSERT INTO payments (booking_id, amount, currency, method, stripe_payment_id, status) VALUES (?, ?, 'KRW', 'stripe', ?, 'paid')").run(
    booking1.lastInsertRowid, 560000, 'pi_simulated_001'
  );

  const vc1 = generateVoucherCode();
  db.prepare("INSERT INTO vouchers (booking_id, code, qr_data, status) VALUES (?, ?, ?, 'active')").run(
    booking1.lastInsertRowid, vc1,
    JSON.stringify({ booking_number: bn1, voucher_code: vc1, product_type: 'hotel', guest_name: 'Zhang Wei', total_price: 560000 })
  );

  // 예약 2: 미결제(pending) 상태의 티켓 예약 — 비로그인 게스트 예약
  // (user_id NULL). guest_email 은 Tanaka Yuki 의 것.
  const bn2 = generateBookingNumber();
  const visitDate2 = getDateString(10);
  const booking2 = db.prepare(`
    INSERT INTO bookings (booking_number, user_id, guest_name, guest_email, guest_phone, product_type, product_id, visit_date, guests, quantity, nights, total_price, status, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bn2, null, 'Tanaka Yuki', 'tanaka@example.com', '+81-90-1234-5678',
    'ticket', ticket1.lastInsertRowid,
    visitDate2,
    2, 2, 1, 158000,
    'pending', 'unpaid'
  );

  db.prepare("INSERT INTO payments (booking_id, amount, currency, method, status) VALUES (?, ?, 'KRW', 'stripe', 'pending')").run(
    booking2.lastInsertRowid, 158000
  );

  const vc2 = generateVoucherCode();
  db.prepare("INSERT INTO vouchers (booking_id, code, qr_data, status) VALUES (?, ?, ?, 'active')").run(
    booking2.lastInsertRowid, vc2,
    JSON.stringify({ booking_number: bn2, voucher_code: vc2, product_type: 'ticket', guest_name: 'Tanaka Yuki', total_price: 158000 })
  );

  // 예약 3: 취소·환불 완료된 패키지 예약. 결제는 refunded, 바우처는
  // cancelled 상태. 관리자 콘솔의 환불 UI 테스트에 쓰인다.
  const bn3 = generateBookingNumber();
  const visitDate3 = getDateString(3);
  const booking3 = db.prepare(`
    INSERT INTO bookings (booking_number, user_id, guest_name, guest_email, guest_phone, product_type, product_id, visit_date, guests, quantity, nights, total_price, status, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bn3, guestUser.id, 'Zhang Wei', 'guest@test.com', '+86-138-0000-1234',
    'package', pkg3.lastInsertRowid,
    visitDate3,
    2, 1, 1, 199000,
    'cancelled', 'refunded'
  );

  db.prepare("INSERT INTO payments (booking_id, amount, currency, method, stripe_payment_id, status, refund_amount) VALUES (?, ?, 'KRW', 'stripe', ?, 'refunded', ?)").run(
    booking3.lastInsertRowid, 199000, 'pi_simulated_003', 199000
  );

  const vc3 = generateVoucherCode();
  db.prepare("INSERT INTO vouchers (booking_id, code, qr_data, status) VALUES (?, ?, ?, 'cancelled')").run(
    booking3.lastInsertRowid, vc3,
    JSON.stringify({ booking_number: bn3, voucher_code: vc3, product_type: 'package', guest_name: 'Zhang Wei', total_price: 199000 })
  );

  console.log('');
  console.log('Seed completed successfully!');
  console.log('');
  console.log('Created:');
  console.log('  - 2 users (admin@high1.com / admin123, guest@test.com / test123)');
  console.log('  - 3 hotels with 8 room types');
  console.log('  - 5 tickets');
  console.log('  - 3 packages with items');
  console.log('  - 30 days of inventory for all products');
  console.log('  - 3 sample bookings (confirmed, pending, cancelled)');
}

/**
 * 엔트리 포인트. DB 초기화가 비동기라서 seed() 를 await 된 initDb() 뒤로
 * 감싼다. 실패 시 종료 코드 1 로 프로세스를 죽여 CI/스크립트 러너가
 * 에러를 감지할 수 있게 한다.
 */
async function main() {
  await initDb();
  seed();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
