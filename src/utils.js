import Swal from 'sweetalert2'
import { CATEGORY_MAP } from './constants'

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
  const categoryName = CATEGORY_MAP[categoryCode] || categoryCode
  return `${categoryCode}(${categoryName})`
}
