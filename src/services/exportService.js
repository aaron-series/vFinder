import Swal from 'sweetalert2'
import { getKoreaTimeStamp } from '../utils'

// 이미지 export 함수
export const exportImage = async (rfInstance, setIsExportingImage) => {
  if (!rfInstance) {
    Swal.fire({
      title: 'Error',
      text: 'Canvas is not ready',
      icon: 'error',
      confirmButtonColor: '#1f2937',
      width: '380px',
      padding: '20px'
    })
    return
  }

  setIsExportingImage(true)
  try {
    // html-to-image를 동적으로 import
    const { toPng } = await import('html-to-image')

    // React Flow 컨테이너 선택
    const reactFlowContainer = document.querySelector('.react-flow')
    if (!reactFlowContainer) {
      throw new Error('React Flow container not found')
    }

    // SVG 요소가 제대로 렌더링되도록 약간의 대기 시간
    await new Promise(resolve => setTimeout(resolve, 200))

    // 이미지 생성 - html-to-image는 SVG를 더 잘 지원
    const dataUrl = await toPng(reactFlowContainer, {
      backgroundColor: '#f3f4f6',
      quality: 2.0,
      pixelRatio: 4, // 고해상도
      cacheBust: true,
      filter: (node) => {
        // Controls와 Background는 제외 (선택사항)
        if (node.classList?.contains('react-flow__controls')) {
          return false
        }
        if (node.classList?.contains('react-flow__background')) {
          return false
        }
        return true
      }
    })

    // 다운로드 링크 생성
    const link = document.createElement('a')
    const timestamp = getKoreaTimeStamp()
    const fileName = `routing-tree-${timestamp}.png`

    link.href = dataUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // 성공 메시지 표시
    Swal.fire({
      title: 'Export Completed',
      text: `Image saved as ${fileName}`,
      icon: 'success',
      confirmButtonColor: '#1f2937',
      width: '380px',
      padding: '20px',
      timer: 1000,
      showConfirmButton: false
    })
    setIsExportingImage(false)
  } catch (error) {
    console.error('Failed to export image:', error)
    setIsExportingImage(false)
    Swal.fire({
      title: 'Export Failed',
      text: error.message || 'Failed to export canvas as image',
      icon: 'error',
      confirmButtonColor: '#1f2937',
      width: '380px',
      padding: '20px'
    })
  }
}
