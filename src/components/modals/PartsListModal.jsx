const PartsListModal = ({ isOpen, onClose, patterns, reorderPatterns, draggedRowIndex, setDraggedRowIndex }) => {
  if (!isOpen) return null

  return (
    <div className="parts-list-modal-overlay" onClick={onClose}>
      <div className="parts-list-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="parts-list-modal-header">
          <h2 className="parts-list-modal-title">Part List</h2>
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
                    <button className="parts-list-menu-btn">⋮</button>
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
