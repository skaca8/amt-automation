// ============================================================================
// sql.js 기반 SQLite 데이터베이스 래퍼 + 스키마 부트스트랩
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) sql.js (WebAssembly 기반 SQLite) 를 비동기로 초기화한다.
//   2) 디스크 파일(high1.db)이 있으면 바이트 통째로 읽어 메모리에 올리고,
//      없으면 빈 인-메모리 DB 를 만든다.
//   3) better-sqlite3 와 인터페이스가 호환되도록 얇은 DatabaseWrapper /
//      PreparedStatement 클래스로 감싼다. (라우트 코드는 이 덕분에 별도
//      분기 없이 `db.prepare(...).run/get/all()` 을 쓸 수 있다.)
//   4) CREATE TABLE IF NOT EXISTS + 이디엠포턴트한 ALTER 로 스키마를 최신
//      상태로 만든다.
//
// 핵심 설계 결정 — saveDb() retouch-on-write 모델:
//   sql.js 는 순수 메모리 DB 라서 변경 사항을 디스크에 자동으로 내려 주지
//   않는다. 이 파일은 INSERT/UPDATE/DELETE/DDL 이 일어날 때마다
//   `_db.export()` 로 DB 전체를 바이트 배열로 직렬화해서 high1.db 에
//   덮어쓴다. DB 가 작을 때는 괜찮지만 규모가 커지면 write 한 번당
//   전체 재직렬화 비용이 들어가기 때문에, transaction() 안에 쓰기를
//   몰아넣는 게 중요하다. (inTransaction 플래그가 중간 saveDb 호출을
//   억제한다.)
//
// 누가 import 하나:
//   - 모든 라우트 파일: `const { getDb } = require('../config/database')`
//   - src/index.js: 부트 시퀀스에서 await initDb() 호출
//   - src/seed.js: 시드 스크립트가 동일하게 initDb() 로 준비
//
// 주의할 점:
//   - CREATE TABLE 블록과 alterStatements 배열은 이중으로 관리된다.
//     새 컬럼을 추가할 때 두 곳 모두 수정해야 한다. CREATE 쪽을 빼먹으면
//     fresh DB 에만 누락되고, ALTER 쪽을 빼먹으면 기존 high1.db 파일에
//     누락된다.
//   - 기존 DB 파일에 이미 있는 컬럼을 ALTER 로 다시 추가하면 sqlite 가
//     에러를 던지지만, 아래 for 루프는 try/catch 로 무시한다 — "이미
//     있으면 건너뛴다" 라는 의미.
//   - pragma('foreign_keys = ON') 은 sql.js 에서 모든 PRAGMA 가 통하는
//     건 아니기 때문에 try/catch 로 감싸 실패해도 서버가 죽지 않게 한다.
// ============================================================================

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// 모듈 로컬 상태. 싱글턴이므로 프로세스 당 하나의 dbWrapper 만 존재한다.
// getDb() 는 이 변수를 읽는다.
let dbWrapper = null;
// 초기화 후 디스크에 저장할 파일 경로. saveDb() 가 이 경로에 덮어쓴다.
let dbPath = null;
// transaction() 실행 중에는 true — 중간 saveDb() 호출을 무시해서 커밋
// 시점에 한 번만 디스크 write 가 일어나도록 만든다.
let inTransaction = false;

/**
 * 현재 메모리 상의 DB 상태를 high1.db 로 직렬화하여 저장한다.
 *
 * 호출 시점:
 *   - PreparedStatement.run() 직후 (INSERT/UPDATE/DELETE)
 *   - DatabaseWrapper.exec() 직후 (DDL 또는 여러 문장 실행)
 *   - 트랜잭션 COMMIT 직후
 *
 * 트랜잭션 중(inTransaction === true)에는 의도적으로 no-op 이다.
 * 이렇게 해야 한 트랜잭션 내부의 수백 번 writes 가 단 한 번의
 * 파일 재직렬화만 발생시킨다.
 *
 * 부작용: fs.writeFileSync — 동기 디스크 쓰기. 대량 쓰기 경로에서는
 * 반드시 db.transaction() 으로 감싸서 호출 횟수를 최소화할 것.
 */
function saveDb() {
  if (dbWrapper && dbPath && !inTransaction) {
    // _db.export() 는 sql.js 내부의 전체 DB 를 Uint8Array 로 꺼낸다.
    // 크기는 데이터 양에 비례하므로 큰 DB 에선 이 한 줄이 O(N).
    const data = dbWrapper._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// ----------------------------------------------------------------------------
// better-sqlite3 호환 레이어
// ----------------------------------------------------------------------------
// sql.js 는 원래 `db.prepare(sql).step()` / `getAsObject()` 스타일의 저수준
// 커서 API 만 제공한다. 프로젝트 전체(라우트 코드)는 better-sqlite3 의
// `.run(...params)`, `.get(...params)`, `.all(...params)` 관용구를 가정해
// 작성돼 있으므로, 아래 두 클래스로 두 API 를 흉내 낸다. 이렇게 해야
// better-sqlite3 로 이후에 교체할 때 라우트 코드 수정 없이 드롭인
// 교체가 가능하다.
// ----------------------------------------------------------------------------

/**
 * Prepared statement 한 건. 세 메서드만 제공한다:
 *   - run(...params)  : INSERT/UPDATE/DELETE. { lastInsertRowid, changes } 반환.
 *   - get(...params)  : 단일 행 SELECT. 레코드 객체 또는 undefined.
 *   - all(...params)  : 다중 행 SELECT. 레코드 객체 배열.
 *
 * 내부적으로는 sql.js 의 저수준 prepare/step/getAsObject 를 호출한다.
 */
class PreparedStatement {
  constructor(database, sql) {
    // sql.js 원본 Database 객체. exec/prepare/run 을 호출한다.
    this._db = database;
    this._sql = sql;
  }

  /**
   * INSERT/UPDATE/DELETE 실행.
   *
   * @param  {...any} params  positional bind parameters (better-sqlite3 스타일)
   * @returns {{lastInsertRowid: number, changes: number}}
   *
   * 부작용: saveDb() 호출 (트랜잭션 밖이면 파일 write).
   */
  run(...params) {
    // sql.js 의 run() 은 실제로는 void 를 반환하므로, 아래에서 별도
    // SELECT last_insert_rowid() 로 마지막 삽입 PK 를 얻어 온다.
    this._db.run(this._sql, params.length > 0 ? params : undefined);
    const result = this._db.exec("SELECT last_insert_rowid() as id");
    // INSERT 가 아니면 0 이 떨어지는데, better-sqlite3 동작과 동일.
    const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : 0;
    const changes = this._db.getRowsModified();
    saveDb();
    return { lastInsertRowid, changes };
  }

  /**
   * 단일 행 SELECT. 매치가 없으면 undefined 를 반환한다.
   *
   * stmt.free() 를 finally 블록에서 호출하는 이유: sql.js 의 prepared
   * statement 는 WASM 메모리를 사용하기 때문에 명시적으로 해제하지 않으면
   * 메모리 누수가 난다.
   */
  get(...params) {
    let stmt;
    try {
      stmt = this._db.prepare(this._sql);
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      if (stmt) stmt.free();
    }
  }

  /**
   * 다중 행 SELECT. 매치가 없으면 빈 배열을 반환한다.
   */
  all(...params) {
    const results = [];
    let stmt;
    try {
      stmt = this._db.prepare(this._sql);
      if (params.length > 0) stmt.bind(params);
      // step() 이 false 를 리턴할 때까지 한 행씩 꺼낸다.
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      if (stmt) stmt.free();
    }
  }
}

/**
 * DatabaseWrapper — getDb() 가 반환하는 객체.
 *
 * better-sqlite3 의 Database 인터페이스를 흉내 내어 prepare / exec /
 * pragma / transaction 네 가지 메서드를 제공한다.
 */
class DatabaseWrapper {
  constructor(sqlJsDb) {
    // 원본 sql.js Database 인스턴스. PreparedStatement 가 이 레퍼런스를
    // 공유한다. saveDb() 도 이 객체의 export() 를 통해 직렬화한다.
    this._db = sqlJsDb;
  }

  /** 새 PreparedStatement 를 만든다. run/get/all 로 체이닝한다. */
  prepare(sql) {
    return new PreparedStatement(this._db, sql);
  }

  /**
   * 여러 SQL 문을 세미콜론으로 이어서 한 번에 실행. DDL(CREATE TABLE 등)
   * 이나 seed 스크립트의 일괄 DELETE 에 쓰인다. 실행 후 saveDb() 한 번.
   */
  exec(sql) {
    this._db.exec(sql);
    saveDb();
  }

  /**
   * PRAGMA 실행 헬퍼. sql.js 는 일부 PRAGMA(WAL 모드 등)를 지원하지 않아
   * 에러가 날 수 있으므로 조용히 무시한다. 운영상 치명적인 PRAGMA 라면
   * 호출 측에서 별도로 검증할 것.
   */
  pragma(str) {
    try {
      this._db.exec(`PRAGMA ${str};`);
    } catch (e) {
      // sql.js 에서 통하지 않는 PRAGMA (예: WAL 모드) 는 그대로 무시.
    }
  }

  /**
   * 트랜잭션 데코레이터 — better-sqlite3 와 같은 패턴.
   *
   * 사용법:
   *   const tx = db.transaction((args) => { ... 여러 db 호출 ... });
   *   tx(args);  // 실제 실행
   *
   * 반환 함수를 호출하면 BEGIN TRANSACTION → fn() → COMMIT 가 순차로
   * 일어난다. fn() 안에서 throw 가 발생하면 ROLLBACK 후 에러를 재throw
   * 하므로 호출 측은 try/catch 로 받을 수 있다.
   *
   * 핵심: inTransaction 플래그를 설정해서 fn() 내부의 모든 run()/exec()
   * 가 saveDb() 를 건너뛰게 한다. 트랜잭션 종료 시점에 단 한 번만 파일
   * write 가 일어나므로, 대량 insert(seed / bulk inventory) 성능이
   * 수십 배 향상된다.
   */
  transaction(fn) {
    const self = this;
    return function (...args) {
      self._db.exec("BEGIN TRANSACTION");
      // 중간 saveDb 호출을 막아 트랜잭션 커밋 시점까지 디스크 I/O 를 모은다.
      inTransaction = true;
      try {
        const result = fn(...args);
        self._db.exec("COMMIT");
        inTransaction = false;
        // 커밋 이후 단 한 번의 파일 직렬화가 일어난다.
        saveDb();
        return result;
      } catch (e) {
        // 반드시 플래그를 원복해야 이후 호출에서 saveDb 가 다시 동작한다.
        self._db.exec("ROLLBACK");
        inTransaction = false;
        throw e;
      }
    };
  }
}

// ----------------------------------------------------------------------------
// 스키마 부트스트랩
// ----------------------------------------------------------------------------
// 아래 initTables 는 두 단계로 나뉜다:
//   A) CREATE TABLE IF NOT EXISTS — 빈 DB 파일에서 처음 기동할 때 필요한
//      모든 테이블을 생성한다. 이 블록은 원자적(한 번의 exec)으로 실행된다.
//   B) ALTER TABLE 배열 — 기존 high1.db 에 새 컬럼을 추가할 때 쓴다.
//      (SQLite 에서 ALTER 는 ADD COLUMN 만 지원하므로 형식이 고정돼 있다.)
//      이미 있는 컬럼은 try/catch 로 조용히 건너뛴다.
//
// 스키마를 수정할 때는 반드시 A 쪽과 B 쪽을 같이 업데이트할 것.
//   - A 만 건드리면 기존 파일 DB 에는 컬럼이 반영되지 않는다.
//   - B 만 건드리면 빈 DB 에서 CREATE 된 테이블에 그 컬럼이 없다가,
//     loop 에서 ALTER 로 추가되지만, DEFAULT 와 NOT NULL 등 컬럼 정의
//     차이가 생길 수 있다.
// ----------------------------------------------------------------------------

/**
 * 전체 스키마를 보장한다. 빈 DB 에 대해서는 CREATE 가, 기존 DB 에는
 * IF NOT EXISTS 로 no-op 이 된다. 그 다음 ALTER 배열로 마이그레이션.
 */
function initTables(db) {
  // -- A) CREATE TABLE 블록 ---------------------------------------------------
  // 주의: 이 template literal 은 "라이브 스키마의 원본(single source)" 이다.
  //       한 글자도 건드리지 말 것. 컬럼을 바꿀 때는 신중히.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      nationality TEXT,
      role TEXT DEFAULT 'customer',
      language TEXT DEFAULT 'en',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hotels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      address TEXT,
      image_url TEXT,
      rating REAL DEFAULT 0,
      amenities TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS room_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      max_guests INTEGER DEFAULT 2,
      bed_type TEXT,
      amenities TEXT DEFAULT '[]',
      image_url TEXT,
      base_price REAL NOT NULL,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_type_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_rooms INTEGER NOT NULL,
      booked_rooms INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(room_type_id, date),
      FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      category TEXT,
      image_url TEXT,
      base_price REAL NOT NULL,
      duration TEXT,
      location TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      booked_quantity INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(ticket_id, date),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      image_url TEXT,
      base_price REAL NOT NULL,
      includes TEXT DEFAULT '[]',
      duration TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS package_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS package_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      booked_quantity INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(package_id, date),
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_phone TEXT,
      product_type TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      room_type_id INTEGER,
      check_in TEXT,
      check_out TEXT,
      visit_date TEXT,
      guests INTEGER DEFAULT 1,
      quantity INTEGER DEFAULT 1,
      nights INTEGER DEFAULT 1,
      total_price REAL NOT NULL,
      currency TEXT DEFAULT 'KRW',
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      payment_id TEXT,
      special_requests TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'KRW',
      method TEXT DEFAULT 'stripe',
      stripe_payment_id TEXT,
      status TEXT DEFAULT 'pending',
      refund_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      qr_data TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value REAL NOT NULL DEFAULT 0,
      product_type TEXT,
      product_id INTEGER,
      start_date TEXT,
      end_date TEXT,
      min_quantity INTEGER DEFAULT 1,
      max_uses INTEGER,
      current_uses INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // -- B) ALTER TABLE 배열 ---------------------------------------------------
  // 기존 high1.db 파일에 누락됐을 수 있는 컬럼을 이디엠포턴트하게 추가한다.
  // 추가 순서는 영향이 없지만, 관련 필드끼리 모아 두면 history 추적이 쉽다.
  const alterStatements = [
    "ALTER TABLE hotels ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE room_types ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE tickets ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE packages ADD COLUMN images TEXT DEFAULT '[]'",
    "ALTER TABLE promotions ADD COLUMN blackout_dates TEXT DEFAULT '[]'",
    "ALTER TABLE hotels ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE hotels ADD COLUMN sort_order INTEGER DEFAULT 0",
    "ALTER TABLE room_types ADD COLUMN sort_order INTEGER DEFAULT 0",
    "ALTER TABLE tickets ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE tickets ADD COLUMN sort_order INTEGER DEFAULT 0",
    "ALTER TABLE packages ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE packages ADD COLUMN sort_order INTEGER DEFAULT 0",
    // 소셜 로그인 컬럼.
    //   google_id : 구글의 안정 식별자(sub 클레임)을 저장해 로그인마다
    //               동일 사용자를 재식별한다. 값이 있으면 해당 계정은
    //               "소셜 로그인 계정" 이라는 뜻이기도 하다.
    //   avatar_url: 구글이 반환한 프로필 사진 URL 을 캐시해 UI 가 두 번째
    //               라운드트립 없이 바로 렌더링할 수 있게 한다.
    "ALTER TABLE users ADD COLUMN google_id TEXT",
    "ALTER TABLE users ADD COLUMN avatar_url TEXT",
  ];
  for (const sql of alterStatements) {
    // 이미 컬럼이 존재하면 sqlite 가 "duplicate column" 에러를 던진다.
    // 우리는 그것을 "이미 마이그레이션 완료" 신호로 간주하고 무시.
    try { db.exec(sql); } catch (e) { /* column already exists */ }
  }
}

/**
 * DB 초기화 엔트리 포인트. 이미 초기화된 경우 기존 wrapper 를 반환한다.
 *
 * 동작 순서:
 *   1) backend/data 디렉터리가 없으면 생성.
 *   2) high1.db 파일이 있으면 바이트 통째로 읽어 sql.js 에 로드,
 *      없으면 빈 in-memory DB 생성.
 *   3) DatabaseWrapper 로 감싸고 foreign_keys PRAGMA 를 켠다.
 *   4) initTables() 로 스키마를 최신 상태로 맞춘다.
 *
 * @returns {Promise<DatabaseWrapper>}
 *
 * 호출: src/index.js 의 start(), src/seed.js 의 main().
 *
 * 주의: sql.js 는 WASM 초기화가 비동기라서 반드시 await 으로 호출해야
 * 한다. 초기화 전에 getDb() 를 부르면 예외가 터진다.
 */
async function initDb() {
  if (dbWrapper) return dbWrapper;

  // 프로젝트 루트 기준 backend/data 디렉터리. __dirname 이 config/ 이므로
  // 두 단계 위로 올라간다.
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, 'high1.db');

  // sql.js 의 WebAssembly 모듈을 로드. Promise 기반이라 await 필수.
  const SQL = await initSqlJs();

  let sqlJsDb;
  if (fs.existsSync(dbPath)) {
    // 기존 파일이 있으면 바이트 전체를 로드한다. sql.js 는 Buffer →
    // Uint8Array 로 받을 수 있다.
    const fileBuffer = fs.readFileSync(dbPath);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    // 완전히 새 DB. initTables 가 스키마를 만들 것.
    sqlJsDb = new SQL.Database();
  }

  dbWrapper = new DatabaseWrapper(sqlJsDb);
  // ON DELETE CASCADE 가 실제로 동작하려면 이 PRAGMA 가 필수.
  // sql.js 버전에 따라 거부될 수 있어 DatabaseWrapper.pragma 는
  // 내부적으로 try/catch 로 감싼다.
  dbWrapper.pragma('foreign_keys = ON');
  initTables(dbWrapper);

  return dbWrapper;
}

/**
 * 현재 DB wrapper 를 반환한다. initDb() 호출 전이면 예외를 던진다.
 * 라우트 핸들러가 매 요청마다 호출하므로 반드시 인-메모리 캐시 히트여야
 * 한다. 초기화는 서버 부트에서 단 한 번만 일어난다.
 */
function getDb() {
  if (!dbWrapper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbWrapper;
}

module.exports = { getDb, initDb };
