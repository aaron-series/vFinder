import Swal from 'sweetalert2'
import { CATEGORY_MAP, GENDER_MAP } from './constants'

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
  if (!categoryCode) return "-"
  
  // CATEGORY_MAP (01, 02, ...) 또는 CATEGORY_MAP_BACKUP (A, B, ...)에서 찾기
  const categoryName = CATEGORY_MAP[categoryCode] || categoryCode
  
  // 이미 포맷된 형식인지 확인 (괄호가 포함되어 있으면 그대로 반환)
  if (categoryCode.includes('(') && categoryCode.includes(')')) {
    return categoryCode
  }
  
  // 코드와 값이 같으면 코드만 반환, 다르면 "코드(value)" 형식으로 반환
  if (categoryName === categoryCode) {
    return categoryCode
  }
  
  return `${categoryName}`
}

export const formatGender = (genderCode) => {
  if (!genderCode) return "-"
  return GENDER_MAP[genderCode] || genderCode
}

// 한국 시간대(KST, UTC+9)로 날짜/시간 포맷팅
export const getKoreaTime = () => {
  const now = new Date()
  // UTC 시간에 9시간 추가하여 한국 시간으로 변환
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
  return koreaTime
}

// 한국 시간대 ISO 문자열 반환
export const getKoreaTimeISOString = () => {
  const koreaTime = getKoreaTime()
  return koreaTime.toISOString()
}

// 한국 시간대 타임스탬프 문자열 반환 (파일명용)
export const getKoreaTimeStamp = () => {
  return getKoreaTimeISOString().replace(/[:.]/g, '-').slice(0, -5)
}

export const asdf = (str) => {
  console.log(str)
  return str
}
