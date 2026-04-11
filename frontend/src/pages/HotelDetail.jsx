import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'
import DateRangePicker from '../components/DateRangePicker'

const styles = {
  page: {
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: 'calc(var(--header-height) + 32px) 20px 60px',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: '24px',
    background: 'none',
    border: 'none',
    padding: 0,
    transition: 'var(--transition)',
  },
  heroImage: {
    width: '100%',
    height: '320px',
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '32px',
    overflow: 'hidden',
  },
  heroIcon: {
    fontSize: '5rem',
    opacity: 0.8,
  },
  infoSection: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '32px',
    marginBottom: '40px',
  },
  mainInfo: {},
  hotelName: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  ratingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    borderRadius: '20px',
    background: '#fef3c7',
    color: '#92400e',
    fontWeight: 700,
    fontSize: '0.9rem',
  },
  address: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  description: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
    marginBottom: '24px',
  },
  amenitiesGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '16px',
  },
  amenityTag: {
    padding: '6px 14px',
    borderRadius: '20px',
    background: 'var(--bg)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: '1px solid var(--border)',
  },
  sidebar: {
    position: 'sticky',
    top: 'calc(var(--header-height) + 32px)',
  },
  dateCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-light)',
  },
  dateCardTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '20px',
  },
  dateGroup: {
    marginBottom: '16px',
  },
  dateLabel: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  dateInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    transition: 'var(--transition)',
  },
  checkBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary)',
    color: 'var(--white)',
    fontWeight: 600,
    fontSize: '0.95rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    marginTop: '8px',
  },
  roomsSection: {
    marginTop: '40px',
  },
  roomsSectionTitle: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '24px',
  },
  roomCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    marginBottom: '16px',
    display: 'grid',
    gridTemplateColumns: '200px 1fr auto',
    gap: '24px',
    alignItems: 'center',
    transition: 'var(--transition-slow)',
  },
  roomImage: {
    width: '200px',
    height: '140px',
    borderRadius: 'var(--radius-sm)',
    background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    flexShrink: 0,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  roomDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  roomMeta: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  roomMetaItem: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  roomPriceCol: {
    textAlign: 'right',
    minWidth: '160px',
  },
  roomPrice: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: '4px',
  },
  roomPriceUnit: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: '12px',
  },
  bookRoomBtn: {
    padding: '10px 24px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent)',
    color: 'var(--white)',
    fontWeight: 600,
    fontSize: '0.9rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  },
  sectionLabel: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
}

function parseImages(images) {
  if (!images) return []
  if (Array.isArray(images)) return images
  if (typeof images === 'string') {
    try { return JSON.parse(images) } catch { return [] }
  }
  return []
}

export default function HotelDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const [hotel, setHotel] = useState(null)
  const [roomTypesList, setRoomTypesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [availability, setAvailability] = useState(null)
  const [checkingAvail, setCheckingAvail] = useState(false)
  const [heroIdx, setHeroIdx] = useState(0)

  useEffect(() => {
    const fetchHotel = async () => {
      setLoading(true)
      try {
        const data = await get(`/hotels/${id}`)
        setHotel(data.hotel || data)
        setRoomTypesList(data.room_types || data.roomTypes || (data.hotel || data).roomTypes || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchHotel()
  }, [id])

  const checkAvailability = async () => {
    if (!checkIn || !checkOut) return
    setCheckingAvail(true)
    try {
      const data = await get(`/hotels/${id}/availability?check_in=${checkIn}&check_out=${checkOut}`)
      setAvailability(data)
    } catch (err) {
      console.error('Availability check failed:', err)
    } finally {
      setCheckingAvail(false)
    }
  }

  const handleBookRoom = (roomType) => {
    const rtId = roomType._id || roomType.id
    const params = new URLSearchParams()
    if (rtId) params.set('roomType', rtId)
    if (checkIn) params.set('checkIn', checkIn)
    if (checkOut) params.set('checkOut', checkOut)
    navigate(`/booking/hotel/${id}?${params.toString()}`)
  }

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (error || !hotel) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error || 'Hotel not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/hotels')}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  const roomTypes = roomTypesList
  const hotelImages = parseImages(hotel.images)
  const hotelName = (lang === 'cn' || lang === 'zh') ? (hotel.name_cn || hotel.name_en || hotel.name) : (hotel.name_en || hotel.name)
  const hotelDesc = (lang === 'cn' || lang === 'zh') ? (hotel.description_cn || hotel.description_en || hotel.description) : (hotel.description_en || hotel.description)
  const isHtmlDesc = hotelDesc && typeof hotelDesc === 'string' && /<[a-z][\s\S]*>/i.test(hotelDesc)

  return (
    <div style={styles.page}>
      <button
        style={styles.backBtn}
        onClick={() => navigate('/hotels')}
        onMouseEnter={e => { e.target.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-secondary)' }}
      >
        &larr; {t('common.back')}
      </button>

      {hotelImages.length > 0 ? (
        <div style={{ position: 'relative', marginBottom: '32px' }}>
          <div style={{
            ...styles.heroImage,
            backgroundImage: `url(${hotelImages[heroIdx]})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />
          {hotelImages.length > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              {hotelImages.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setHeroIdx(i)}
                  style={{
                    width: 64, height: 44, borderRadius: 6, cursor: 'pointer',
                    border: i === heroIdx ? '2px solid var(--primary)' : '2px solid transparent',
                    backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center',
                    opacity: i === heroIdx ? 1 : 0.6, transition: 'all 0.2s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.heroImage}>
          <span style={styles.heroIcon}>&#127976;</span>
        </div>
      )}

      <div style={styles.infoSection} className="hotel-info-grid">
        <div style={styles.mainInfo}>
          <h1 style={styles.hotelName}>{hotelName}</h1>
          <div style={styles.ratingRow}>
            {hotel.rating && (
              <span style={styles.ratingBadge}>&#9733; {hotel.rating}</span>
            )}
            {hotel.address && (
              <span style={styles.address}>&#128205; {hotel.address}</span>
            )}
          </div>
          {isHtmlDesc ? (
            <div style={styles.description} dangerouslySetInnerHTML={{ __html: hotelDesc }} />
          ) : (
            <p style={styles.description}>{hotelDesc || ''}</p>
          )}

          {hotel.amenities && hotel.amenities.length > 0 && (
            <>
              <h3 style={styles.sectionLabel}>{t('hotel.amenities')}</h3>
              <div style={styles.amenitiesGrid}>
                {hotel.amenities.map((a, i) => (
                  <span key={i} style={styles.amenityTag}>{a}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.dateCard}>
            <h3 style={styles.dateCardTitle}>{t('hotel.availability')}</h3>
            <div style={styles.dateGroup}>
              <label style={styles.dateLabel}>Check-in / Check-out</label>
              <DateRangePicker
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={(ci, co) => { setCheckIn(ci); setCheckOut(co) }}
                placeholder="Select check-in & check-out"
              />
            </div>
            <button
              style={styles.checkBtn}
              onClick={checkAvailability}
              disabled={!checkIn || !checkOut || checkingAvail}
              onMouseEnter={e => { if (!e.target.disabled) { e.target.style.background = 'var(--primary-dark)' } }}
              onMouseLeave={e => { e.target.style.background = 'var(--primary)' }}
            >
              {checkingAvail ? t('common.loading') : t('hotel.availability')}
            </button>
          </div>
        </div>
      </div>

      {/* Room Types */}
      <div style={styles.roomsSection}>
        <h2 style={styles.roomsSectionTitle}>{t('hotel.rooms')}</h2>
        {roomTypes.length > 0 ? (
          roomTypes.map((room, idx) => {
            const roomAvail = availability?.rooms?.find(r => (r._id || r.id) === (room._id || room.id))
            const isAvailable = !availability || !roomAvail || roomAvail.available !== false

            return (
              <div
                key={room._id || room.id || idx}
                style={styles.roomCard}
                className="room-card"
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
              >
                {(() => {
                  const roomImgs = parseImages(room.images)
                  const roomName = (lang === 'cn' || lang === 'zh') ? (room.name_cn || room.name_en || room.name || room.type || `Room Type ${idx + 1}`) : (room.name_en || room.name || room.type || `Room Type ${idx + 1}`)
                  const roomDesc = (lang === 'cn' || lang === 'zh') ? (room.description_cn || room.description_en || room.description || '') : (room.description_en || room.description || '')
                  const isRoomHtml = roomDesc && typeof roomDesc === 'string' && /<[a-z][\s\S]*>/i.test(roomDesc)
                  return (
                    <>
                      {roomImgs.length > 0 ? (
                        <div style={{
                          ...styles.roomImage,
                          backgroundImage: `url(${roomImgs[0]})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }} />
                      ) : (
                        <div style={styles.roomImage}>&#128716;</div>
                      )}
                      <div style={styles.roomInfo}>
                        <div style={styles.roomName}>{roomName}</div>
                        {isRoomHtml ? (
                          <div style={styles.roomDesc} dangerouslySetInnerHTML={{ __html: roomDesc }} />
                        ) : (
                          <div style={styles.roomDesc}>{roomDesc}</div>
                        )}
                        <div style={styles.roomMeta}>
                          {(room.maxGuests || room.max_guests) && (
                            <span style={styles.roomMetaItem}>&#128101; {t('hotel.maxGuests')}: {room.maxGuests || room.max_guests}</span>
                          )}
                          {(room.bedType || room.bed_type) && (
                            <span style={styles.roomMetaItem}>&#128716; {t('hotel.bedType')}: {room.bedType || room.bed_type}</span>
                          )}
                        </div>
                        {room.amenities && room.amenities.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {room.amenities.map((a, i) => (
                              <span key={i} style={{ ...styles.amenityTag, fontSize: '0.7rem', padding: '3px 10px' }}>{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={styles.roomPriceCol}>
                        <div style={styles.roomPrice}>
                          {t('common.currency')} {(room.price || room.basePrice || room.base_price || 0).toLocaleString()}
                        </div>
                        <div style={styles.roomPriceUnit}>/ {t('common.night')}</div>
                        <button
                          style={{
                            ...styles.bookRoomBtn,
                            ...(isAvailable ? {} : { opacity: 0.5, cursor: 'not-allowed', background: 'var(--text-muted)' }),
                          }}
                          onClick={() => isAvailable && handleBookRoom(room)}
                          disabled={!isAvailable}
                          onMouseEnter={e => { if (isAvailable) { e.target.style.background = 'var(--accent-dark)' } }}
                          onMouseLeave={e => { if (isAvailable) { e.target.style.background = 'var(--accent)' } }}
                        >
                          {isAvailable ? t('hotel.bookNow') : t('hotel.noRooms')}
                        </button>
                      </div>
                    </>
                  )
                })()}
              </div>
            )
          })
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">&#128716;</div>
            <p className="empty-state-text">{t('hotel.noRooms')}</p>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hotel-info-grid { grid-template-columns: 1fr !important; }
          .room-card {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .room-card > div:first-child {
            width: 100% !important;
            height: 120px !important;
          }
        }
      `}</style>
    </div>
  )
}
