// ============================================================================
// /api/admin/upload — 관리자 이미지 업로드 라우트
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   POST /           — 단일 이미지 업로드 (multipart field: "image")
//   POST /multiple   — 최대 10장 다중 업로드 (multipart field: "images")
//
// multer disk storage 를 사용해 backend/uploads/ 디렉터리에 직접 저장한다.
// 이 디렉터리는 index.js 에서 express.static 으로 `/uploads` 경로에 마운트돼
// 업로드 즉시 브라우저가 `/uploads/<filename>` 으로 읽을 수 있다.
//
// 제한:
//   - 파일 크기: 10MB
//   - MIME: jpeg / jpg / png / gif / webp (확장자와 mimetype 모두 검사)
//
// 주의: 업로드 후 파일 삭제 엔드포인트는 현재 없다. 테스트용 업로드가 쌓일
// 수 있으므로 주기적으로 정리가 필요하다.
// ============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
// 관리자 인증 필수. 업로드는 공개 기능이 아니다.
router.use(authenticate, requireAdmin);

// ----------------------------------------------------------------------------
// multer 디스크 스토리지 설정
// ----------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // backend/uploads. __dirname 이 routes/admin 이므로 네 단계 위.
    // index.js 에서도 동일 경로를 정적 서빙하므로 여기서 바꾸면 그쪽도
    // 맞춰야 한다.
    const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 충돌 방지용 파일명. timestamp + 9자리 랜덤 + 확장자.
    // 원본 파일 이름을 그대로 쓰면 동일 이름 업로드 시 덮어쓰기 위험 있음.
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  // 10MB 제한. 원본 사진을 그대로 올리는 관리자 UX 를 고려한 값.
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // 확장자와 MIME 를 모두 검사. 둘 중 하나라도 일치하지 않으면 거부.
    // 정규식은 소문자 비교를 위해 경로 확장자를 toLowerCase() 처리한다.
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

/**
 * POST / — 단일 이미지 업로드.
 *
 * form field: image (multipart/form-data)
 * 응답: 200 { url, filename, size } | 400 파일 없음
 *
 * 반환되는 url 은 `/uploads/<filename>` 형태의 절대 경로(프런트 도메인 기준).
 */
router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, size: req.file.size });
});

/**
 * POST /multiple — 다중 이미지 업로드 (최대 10장).
 *
 * form field: images (반복)
 * 응답: 200 { files: [{ url, filename, size }, ...] } | 400 파일 없음
 */
router.post('/multiple', upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images provided' });
  const files = req.files.map(f => ({
    url: `/uploads/${f.filename}`,
    filename: f.filename,
    size: f.size
  }));
  res.json({ files });
});

module.exports = router;
