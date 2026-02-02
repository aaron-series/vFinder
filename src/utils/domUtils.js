/**
 * DOM 렌더링 완료를 기다리는 유틸리티 함수
 * 필요한 edge-label-box DOM 요소들이 모두 렌더링될 때까지 대기
 */
export const waitForDOMReady = (edgeIds, maxAttempts = 10) => {
  return new Promise((resolve) => {
    let attempts = 0

    const checkDOM = () => {
      attempts++
      
      // 모든 edge-label-box가 DOM에 렌더링되었는지 확인
      const allRendered = edgeIds.every(edgeId => {
        const labelBox = document.querySelector(`.edge-label-box[data-edge-id="${edgeId}"]`)
        if (!labelBox) return false
        
        // 요소가 실제로 렌더링되었는지 확인 (크기가 0이 아닌지)
        const rect = labelBox.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })

      if (allRendered || attempts >= maxAttempts) {
        // 다음 프레임에서 실행하여 렌더링이 완전히 완료되도록 보장
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve(allRendered)
          })
        })
      } else {
        // 다음 프레임에서 다시 확인
        requestAnimationFrame(checkDOM)
      }
    }

    // 첫 프레임에서 확인 시작
    requestAnimationFrame(checkDOM)
  })
}

/**
 * 특정 edge-label-box가 DOM에 렌더링되었는지 확인
 */
export const isLabelBoxRendered = (edgeId) => {
  const labelBox = document.querySelector(`.edge-label-box[data-edge-id="${edgeId}"]`)
  if (!labelBox) return false
  
  const rect = labelBox.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}
