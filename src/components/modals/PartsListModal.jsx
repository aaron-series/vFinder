import Swal from 'sweetalert2'

const PartsListModal = ({ isOpen, onClose, patterns, reorderPatterns, removePattern, draggedRowIndex, setDraggedRowIndex }) => {
  if (!isOpen) return null

  const handleRemove = async (e, partId) => {
    e.stopPropagation()
    
    const part = patterns.find(p => p.id === partId)
    const partCode = part?.code || 'This part'
    
    const result = await Swal.fire({
      title: 'Remove Parts',
      html: `<u>${partCode}</u> will be removed.<br/>Are you sure you want to remove it?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      width: '440px',
      padding: '20px',
      customClass: {
        container: 'swal2-container-high-z'
      }
    })
    
    if (result.isConfirmed) {
      removePattern(partId)
      Swal.fire({
        title: 'Remove Completed',
        text: 'Parts has been removed.',
        icon: 'success',
        confirmButtonColor: '#1f2937',
        width: '380px',
        padding: '20px',
        timer: 1000,
        showConfirmButton: false,
        customClass: {
          container: 'swal2-container-high-z'
        }
      })
    }
  }

  return (
    <div className="parts-list-modal-overlay" onClick={onClose}>
      <div className="parts-list-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="parts-list-modal-header">
          <h2 className="parts-list-modal-title">Parts List</h2>
          <button className="parts-list-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="parts-list-modal-body">
          <table className="parts-list-table">
            <thead>
              <tr>
                <th></th>
                <th>no.</th>
                <th></th>
                <th>Pattern Code</th>
                <th>Original Layer Name</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((part, index) => (
                <tr 
                  key={part.id || index}
                  draggable
                  onDragStart={(e) => {
                    setDraggedRowIndex(index)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggedRowIndex !== null && draggedRowIndex !== index) {
                      reorderPatterns(draggedRowIndex, index)
                      setDraggedRowIndex(null)
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedRowIndex(null)
                  }}
                  style={{
                    opacity: draggedRowIndex === index ? 0.5 : 1,
                    cursor: 'move'
                  }}
                >
                  <td className="drag-handle-cell">
                    <span className="drag-handle">☰</span>
                  </td>
                  <td className="no-cell">{part.no}</td>
                  <td className="thumbnail-cell">
                    <div className="parts-list-thumbnail">
                      {part.thumbnail ? (
                        <img 
                          src={part.thumbnail} 
                          alt={part.code}
                          className="parts-list-thumbnail-image"
                        />
                      ) : (
                        <div className="parts-list-thumbnail-placeholder"></div>
                      )}
                    </div>
                  </td>
                  <td className="code-cell">
                    <input 
                      type="text" 
                      className="parts-list-input" 
                      value={part.code}
                      readOnly
                    />
                  </td>
                  <td className="layer-cell">
                    <span className="layer-name">{part.layerName}</span>
                  </td>
                  <td className="menu-cell">
                    <button 
                      className="parts-list-menu-btn"
                      onClick={(e) => handleRemove(e, part.id)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PartsListModal
