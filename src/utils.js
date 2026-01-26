import Swal from 'sweetalert2'
import { CATEGORY_MAP, CATEGORY_MAP_BACKUP } from './constants'

// 작은 사이즈 Alert 유틸리티
export const showSmallAlert = (options) => {
  return Swal.fire({
    width: '380px',
    padding: '20px',
    confirmButtonColor: '#1f2937',
    confirmButtonText: 'OK',
    ...options
  })
}

// Category 표시 포맷 함수
export const formatCategory = (categoryCode) => {
  if (!categoryCode) return "W's Sportswear"
  
  // CATEGORY_MAP (01, 02, ...) 또는 CATEGORY_MAP_BACKUP (A, B, ...)에서 찾기
  const categoryName = CATEGORY_MAP[categoryCode] || CATEGORY_MAP_BACKUP[categoryCode] || categoryCode
  
  // 이미 포맷된 형식인지 확인 (괄호가 포함되어 있으면 그대로 반환)
  if (categoryCode.includes('(') && categoryCode.includes(')')) {
    return categoryCode
  }
  
  // 코드와 값이 같으면 코드만 반환, 다르면 "코드(value)" 형식으로 반환
  if (categoryName === categoryCode) {
    return categoryCode
  }
  
  return `${categoryCode}(${categoryName})`
}
