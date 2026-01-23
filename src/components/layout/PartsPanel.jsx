import { useRef, useState, useEffect, useCallback } from 'react'

const PartsPanel = ({
  patterns,
  nodes,
  onPartDragStart,
  onShowPartsListModal
}) => {
  const partsGridRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // 스크롤 가능 여부 체크
  const checkScrollability = useCallback(() => {
    if (!partsGridRef.current) return
    const { scrollWidth, clientWidth, scrollLeft } = partsGridRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  // 화면에 보이는 파츠 개수 계산
  const getVisiblePartsCount = useCallback(() => {
    if (!partsGridRef.current) return 0
    const containerWidth = partsGridRef.current.clientWidth
    const firstCard = partsGridRef.current.querySelector('.part-card')
    if (!firstCard) return 0
    
    const cardWidth = firstCard.offsetWidth
    const gap = 16 // CSS gap 값
    const visibleCount = Math.floor(containerWidth / (cardWidth + gap))
    return Math.max(1, visibleCount - 1) // 최소 1개는 보이도록
  }, [])

  // 화살표 버튼 클릭 핸들러
  const handleScrollLeft = () => {
    if (!partsGridRef.current) return
    const visibleCount = getVisiblePartsCount()
    const firstCard = partsGridRef.current.querySelector('.part-card')
    if (!firstCard) return
    
    const cardWidth = firstCard.offsetWidth
    const gap = 16
    const scrollAmount = visibleCount * (cardWidth + gap)
    
    partsGridRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
    setTimeout(checkScrollability, 300)
  }

  const handleScrollRight = () => {
    if (!partsGridRef.current) return
    const visibleCount = getVisiblePartsCount()
    const firstCard = partsGridRef.current.querySelector('.part-card')
    if (!firstCard) return
    
    const cardWidth = firstCard.offsetWidth
    const gap = 16
    const scrollAmount = visibleCount * (cardWidth + gap)
    
    partsGridRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    setTimeout(checkScrollability, 300)
  }

  // 마우스 드래그 스와이프 핸들러
  const handleMouseDown = (e) => {
    if (!partsGridRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - partsGridRef.current.offsetLeft)
    setScrollLeft(partsGridRef.current.scrollLeft)
    partsGridRef.current.style.cursor = 'grabbing'
  }

  const handleMouseLeave = () => {
    if (!partsGridRef.current) return
    setIsDragging(false)
    partsGridRef.current.style.cursor = 'grab'
  }

  const handleMouseUp = () => {
    if (!partsGridRef.current) return
    setIsDragging(false)
    partsGridRef.current.style.cursor = 'grab'
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !partsGridRef.current) return
    e.preventDefault()
    const x = e.pageX - partsGridRef.current.offsetLeft
    const walk = (x - startX) * 2 // 스크롤 속도 조절
    partsGridRef.current.scrollLeft = scrollLeft - walk
    checkScrollability()
  }

  // 컴포넌트 마운트 시 초기 커서 설정 및 스크롤 가능 여부 체크
  useEffect(() => {
    if (partsGridRef.current) {
      partsGridRef.current.style.cursor = 'grab'
      checkScrollability()
      
      // 스크롤 이벤트 리스너 추가
      const handleScroll = () => {
        checkScrollability()
      }
      partsGridRef.current.addEventListener('scroll', handleScroll)
      
      // 리사이즈 이벤트 리스너 추가
      const handleResize = () => {
        checkScrollability()
      }
      window.addEventListener('resize', handleResize)
      
      return () => {
        if (partsGridRef.current) {
          partsGridRef.current.removeEventListener('scroll', handleScroll)
        }
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [checkScrollability, patterns])

  return (
    <div className="parts-panel">
      <div className="parts-header">
        <div className="parts-title">
          <h3>PARTS</h3>
          <span className="parts-count">({patterns?.length || 8})</span>
        </div>
        <div className="parts-actions">
          <button 
            className="parts-action-btn" 
            title="Parts List"
            onClick={onShowPartsListModal}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Parts List
          </button>
        </div>
      </div>

      {/* Parts Grid Container */}
      <div className="parts-grid-container">
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <button 
            className="parts-scroll-btn parts-scroll-btn-left"
            onClick={handleScrollLeft}
            aria-label="왼쪽으로 스크롤"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {/* Parts Grid */}
        <div 
          className="parts-grid"
          ref={partsGridRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {/* 텍스트 입력 파츠 (가장 좌측 고정) */}
          <div 
            className="part-card part-card-text"
            draggable
            onDragStart={(e) => onPartDragStart(e, { isTextPart: true, code: 'TEXT', thumbnail: null })}
            title="Text Input"
          >
            <div className="part-thumbnail part-thumbnail-text">
              <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="30" width="80" height="60" rx="4" stroke="#2563eb" strokeWidth="2" fill="none"/>
                <line x1="30" y1="50" x2="90" y2="50" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
                <line x1="30" y1="70" x2="70" y2="70" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="part-info">
              <p className="part-code">TEXT</p>
            </div>
          </div>
          
          {patterns.map((part, index) => {
            // 캔버스에서 이 파츠를 사용하는 노드들 찾기
            const usedNodes = nodes.filter(node => 
              !node.data.isTextNode && node.data.label === part.code
            )
            
            return (
              <div 
                key={part.id || index} 
                className={`part-card ${usedNodes.length > 0 ? 'part-card-used' : ''}`}
                draggable
                onDragStart={(e) => onPartDragStart(e, part)}
                title={part.code}
              >
                {/* 사용된 노드 번호 표시 */}
                {usedNodes.length > 0 && (
                  <div className="part-used-badge">
                    {usedNodes.map(node => node.data.number).join(', ')}
                  </div>
                )}
                <div className="part-thumbnail">
                  {part.thumbnail ? (
                    <img 
                      src={part.thumbnail} 
                      alt={part.code}
                      className="part-thumbnail-image"
                    />
                  ) : (
                    <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M30 60 L60 30 L90 60 L60 90 Z" stroke="#999" strokeWidth="2" fill="none"/>
                    </svg>
                  )}
                </div>
                <div className="part-info">
                  <p className="part-code">{part.code}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right Arrow Button */}
        {canScrollRight && (
          <button 
            className="parts-scroll-btn parts-scroll-btn-right"
            onClick={handleScrollRight}
            aria-label="오른쪽으로 스크롤"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5L13 10L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default PartsPanel
