import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { formatCategory } from '../../utils'

const EditorMetaBar = ({ formData, onReset }) => {
  const navigate = useNavigate()

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
        navigate('/')
      }
    })
  }

  return (
    <div className="editor-meta-bar">
      <div className="editor-info">
        <div className="info-item">
          <span className="info-label">Model. </span>
          <span className="info-value">{formData?.model || 'HO24 AIR MAX MUSE'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Dev. style. </span>
          <span className="info-value">{formData?.devStyle || 'ho123123'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Category. </span>
          <span className="info-value">{formatCategory(formData?.category)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Size. </span>
          <span className="info-value">{formData?.size || 'M'}</span>
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
        <button className="btn-save">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.667 14H3.333A1.333 1.333 0 012 12.667V3.333A1.333 1.333 0 013.333 2h7.334L14 5.333v7.334A1.333 1.333 0 0112.667 14z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.333 14v-5.333H4.667V14m0-12v3.333h5.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Save
        </button>
        <button className="btn-export">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 10v2.667A1.333 1.333 0 0112.667 14H3.333A1.333 1.333 0 012 12.667V10m8.667-4L8 2.667 5.333 6m2.667-3.333v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Export
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
