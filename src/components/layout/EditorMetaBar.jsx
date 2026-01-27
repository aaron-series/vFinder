import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { formatCategory, formatGender } from '../../utils'
import useRoutingStore from '../../store/useRoutingStore'

const EditorMetaBar = ({ formData, onReset, onSave, onExportImage, isExportingImage = false }) => {
  const navigate = useNavigate()
  const { reset } = useRoutingStore()

  const handleExit = () => {
    Swal.fire({
      title: 'Exit Workspace',
      html: 'Are you sure you want to exit the workspace?<br/>Unsaved changes will be lost.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#1f2937',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Exit',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        // store의 정보 초기화
        reset()
        // localStorage에서 캔버스 상태 제거
        try {
          localStorage.removeItem('routing-tree-canvas-state')
        } catch (error) {
          console.error('Failed to remove canvas state from localStorage:', error)
        }
        navigate('/')
      }
    })
  }

  const handleSave = () => {
    if (onSave) {
      onSave()
    }
  }

  return (
    <div className="editor-meta-bar">
      <div className="editor-info">
        <div className="info-item">
          <span className="info-label">Filename. </span>
          <span className="info-value">{formData?.fileName || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Model. </span>
          <span className="info-value">{formData?.model || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Dev. style. </span>
          <span className="info-value">{formData?.devStyle || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Category. </span>
          <span className="info-value">{formatCategory(formData?.category) || '-'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Gender. </span>
          <span className="info-value">{formatGender(formData?.gender) || '-'}</span>
        </div>
      </div>
      <div className="editor-meta-actions">
        <button className="btn-reset" onClick={onReset} title="Reset Canvas">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 2.667v2.666M8 10.667v2.666M5.333 4L3.333 2M12.667 2l-2 2M2 8h2.667M11.333 8H14M5.333 12l-2 2M12.667 12l-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="8" r="2.667" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Reset
        </button>
        <button className="btn-export">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2h12a1.333 1.333 0 011.333 1.333v9.334A1.333 1.333 0 0114 14H2a1.333 1.333 0 01-1.333-1.333V3.333A1.333 1.333 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 5.333h12M5.333 2v12M2 8h12M2 10.667h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 5.333v2.667M10.667 5.333v2.667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          xlsx
        </button>
        <button 
          className={`btn-export ${isExportingImage ? 'exporting' : ''}`} 
          onClick={onExportImage} 
          title="Export as Image"
          disabled={isExportingImage}
        >
          {isExportingImage ? (
            <svg className="loading-spinner" width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="28.27" strokeDashoffset="28.27" opacity="0.2"/>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="28.27" strokeDashoffset="21.21" opacity="0.8"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H2a1.333 1.333 0 00-1.333 1.333v9.334A1.333 1.333 0 002 14h12a1.333 1.333 0 001.333-1.333V3.333A1.333 1.333 0 0014 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.333 6.667a1.333 1.333 0 100-2.667 1.333 1.333 0 000 2.667zM2 12l3.333-3.333L8 11.333l4-4L14 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          Image
        </button>
        <button className="btn-save" onClick={handleSave} title="Save">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.667 14H3.333A1.333 1.333 0 012 12.667V3.333A1.333 1.333 0 013.333 2h7.334L14 5.333v7.334A1.333 1.333 0 0112.667 14z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.333 14v-5.333H4.667V14m0-12v3.333h5.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Save
        </button>
        <button className="btn-exit" onClick={handleExit} title="나가기">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 2H4a1.333 1.333 0 00-1.333 1.333v9.334A1.333 1.333 0 004 14h2M10 11.333L13.333 8M13.333 8L10 4.667M13.333 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default EditorMetaBar
