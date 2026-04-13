// ============================================================================
// /api/hotels — 호텔 목록/상세/가용성 조회 (공개 API)
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   GET /                 — 활성 호텔 목록 (검색 옵션)
//   GET /:id              — 호텔 상세 + 활성 room_type 배열
//   GET /:id/availability — 주어진 기간의 방 타입별 가용성/총액 계산
//
// 공통 동작:
//   - 응답 직전에 amenities 컬럼(TEXT JSON)을 JSON.parse() 해서 배열로
//     넘겨 준다. 이유: DB 에는 JSON 문자열로 저장하지만, 프런트엔드는
//     배열을 그대로 쓰고 싶어 한다.
//   - 정렬: is_featured DESC → sort_order ASC → rating DESC → id ASC.
//     관리자가 featured 토글로 핫픽을 올렸을 때 최상단 노출되도록.
// ============================================================================

const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

/**
 * GET / — 활성 호텔 목록.
 *
 * Query: { search? }  — name_en / name_cn / address 부분 일치 검색.
 * 응답: 200 { hotels: [...] }  — amenities 는 JSON 파싱된 배열.
 * 실패: 500 내부 에러
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search } = req.query;

    let query = 'SELECT * FROM hotels WHERE status = ?';
    const params = ['active'];

    if (search) {
      // LIKE 에 바인드할 % 와일드카드를 명시적으로 감싸서 사용자 입력을
      // 그대로 SQL 에 흘리지 않는다. 필드를 더 추가할 때도 3개 term 을
      // 같이 push 해야 자리 수가 맞다.
      query += ' AND (name_en LIKE ? OR name_cn LIKE ? OR address LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    // 관리자가 featured 토글을 켠 호텔을 최상단에 고정하고, 그 뒤는
    // sort_order → rating → id 순. 안정적인 tie-breaker 를 위해 마지막에
    // id 를 둔다.
    query += ' ORDER BY is_featured DESC, sort_order ASC, rating DESC, id ASC';

    const hotels = db.prepare(query).all(...params);

    // amenities 컬럼은 DB 에 JSON 문자열로 저장됨. 응답 전에 배열로 디코딩.
    const result = hotels.map(hotel => ({
      ...hotel,
      amenities: JSON.parse(hotel.amenities || '[]')
    }));

    res.json({ hotels: result });
  } catch (err) {
    console.error('List hotels error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 호텔 상세 + 해당 호텔의 활성 room_type 목록.
 *
 * 응답: 200 { hotel, room_types } | 404 호텔 없음 | 500 내부 에러
 * amenities 는 호텔/방 양쪽 모두 JSON 파싱된 배열.
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    hotel.amenities = JSON.parse(hotel.amenities || '[]');

    const roomTypes = db.prepare('SELECT * FROM room_types WHERE hotel_id = ? AND status = ?').all(hotel.id, 'active');

    const result = roomTypes.map(rt => ({
      ...rt,
      amenities: JSON.parse(rt.amenities || '[]')
    }));

    res.json({ hotel, room_types: result });
  } catch (err) {
    console.error('Get hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id/availability — 지정 기간의 방 타입별 가용성 / 총액 계산.
 *
 * Query: { check_in, check_out }  — YYYY-MM-DD. 반개방 구간 [in, out).
 * 응답:
 *   200 {
 *     hotel: { id, name_en, name_cn },
 *     check_in, check_out,
 *     availability: [{
 *       room_type: {...amenities 배열},
 *       dates: [{ date, available, price }],
 *       min_available,          // 기간 내 최소 가용 수량
 *       total_price,            // 기간 합산 가격 (per 1 room)
 *       nights,
 *       is_available            // min_available > 0 여부
 *     }]
 *   }
 *   400 날짜 누락 | 404 호텔 없음 | 500 내부 에러
 *
 * 계산 로직:
 *   각 방 타입에 대해 체크인~체크아웃 날짜 범위를 돌면서 room_inventory
 *   에서 해당 날짜 row 를 찾아 available / price 를 누적한다. 한 날짜라도
 *   inventory row 가 없으면 available = 0 으로 취급해 is_available=false.
 */
router.get('/:id/availability', (req, res) => {
  try {
    const db = getDb();
    const { check_in, check_out } = req.query;

    if (!check_in || !check_out) {
      return res.status(400).json({ error: 'check_in and check_out dates are required (YYYY-MM-DD).' });
    }

    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    const roomTypes = db.prepare('SELECT * FROM room_types WHERE hotel_id = ? AND status = ?').all(hotel.id, 'active');

    const availability = roomTypes.map(rt => {
      const inventory = db.prepare(`
        SELECT date, total_rooms, booked_rooms, price
        FROM room_inventory
        WHERE room_type_id = ? AND date >= ? AND date < ?
        ORDER BY date ASC
      `).all(rt.id, check_in, check_out);

      // 날짜별 availability 집계. inventory 는 이미 range 로 가져왔지만
      // row 가 누락된 날짜도 있을 수 있으므로 cursor 루프로 명시적으로
      // 모든 날짜를 채운다 — 프런트엔드가 차트/테이블을 그릴 때 누락
      // 일자를 직접 처리할 필요가 없게 한다.
      const dates = [];
      let currentDate = new Date(check_in);
      const endDate = new Date(check_out);
      // minAvailable 은 모든 날짜의 available 중 최소값. 하루라도 0 이면
      // 전체가 불가로 잡힌다. Infinity 로 시작해 첫 비교에서 반드시 교체.
      let minAvailable = Infinity;
      let totalPrice = 0;
      let nights = 0;

      while (currentDate < endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const inv = inventory.find(i => i.date === dateStr);

        // 해당 날짜의 inventory row 가 없으면 가용 0 으로 본다.
        const available = inv ? inv.total_rooms - inv.booked_rooms : 0;
        const price = inv ? (inv.price || rt.base_price) : rt.base_price;

        if (available < minAvailable) minAvailable = available;
        totalPrice += price;
        nights++;

        dates.push({
          date: dateStr,
          available,
          price
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // dates 배열이 비어 있을 가능성(동일 날짜 입력 등) 에 대비해 Infinity
      // 를 0 으로 치환.
      if (minAvailable === Infinity) minAvailable = 0;

      return {
        room_type: {
          ...rt,
          amenities: JSON.parse(rt.amenities || '[]')
        },
        dates,
        min_available: minAvailable,
        total_price: totalPrice,
        nights,
        is_available: minAvailable > 0
      };
    });

    res.json({
      hotel: {
        id: hotel.id,
        name_en: hotel.name_en,
        name_cn: hotel.name_cn
      },
      check_in,
      check_out,
      availability
    });
  } catch (err) {
    console.error('Check availability error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
