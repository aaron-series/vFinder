import { PROCESS_ORDER_OPTIONS, PROCESS_SELECTION_OPTIONS, DETAIL_ITEMS } from '../../constants'

const SettingsProcessPanel = ({
  isOpen,
  onClose,
  addedParts,
  settingsData,
  setSettingsData,
  selectedNodeId,
  nodes,
  edges,
  setNodes,
  setEdges,
  handleNodeDelete,
  setSelectedNodeId,
  setAddedParts,
  updateEdgeLabels
}) => {
  // 그룹 내 모든 노드가 확정 상태인지 확인
  const allNodesConfirmed = addedParts.length > 0 && 
    addedParts.every(part => part.data?.isConfirmed === true)
  const isNodeConfirmed = allNodesConfirmed

  const handleProcessOrderChange = (e) => {
    const newProcessOrder = e.target.value
    setSettingsData({...settingsData, processOrder: newProcessOrder})
    
    // 선택된 노드와 연결된 노드들의 step 업데이트
    if (selectedNodeId) {
      // edges 업데이트
      setEdges((currentEdges) => {
        return currentEdges.map(edge => {
          if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
            return {
              ...edge,
              data: {
                ...edge.data,
                step: newProcessOrder.replace('STEP ', 'STEP. ')
              }
            }
          }
          return edge
        })
      })
      
      // nodes 업데이트
      setNodes((currentNodes) => {
        // 선택된 노드와 연결된 노드들 찾기
        const connectedNodeIds = new Set([selectedNodeId])
        edges.forEach(edge => {
          if (edge.source === selectedNodeId) connectedNodeIds.add(edge.target)
          if (edge.target === selectedNodeId) connectedNodeIds.add(edge.source)
        })
        
        return currentNodes.map(node => {
          if (connectedNodeIds.has(node.id)) {
            return {
              ...node,
              data: {
                ...node.data,
                step: newProcessOrder.replace('STEP ', 'STEP. ')
              }
            }
          }
          return node
        })
      })
      
      // 그룹 연결 노드 업데이트를 위해 updateEdgeLabels 호출
      setTimeout(() => {
        setEdges((currentEdges) => {
          setNodes((currentNodes) => {
            const { updatedEdges, groupConnectorNodes } = updateEdgeLabels(currentEdges, currentNodes)
            // 그룹 연결 노드 업데이트
            const filteredNodes = currentNodes.filter(n => n.type !== 'groupConnector')
            setNodes([...filteredNodes, ...groupConnectorNodes])
            return updatedEdges
          })
          return currentEdges
        })
      }, 0)
    }
  }

  const handlePartRemove = (partId) => {
    // 노드를 캔버스에서 제거
    handleNodeDelete(partId)
    
    // Added Parts에서도 제거
    const newParts = addedParts.filter(p => p.id !== partId)
    setAddedParts(newParts)
    
    // 모든 파트가 제거되면 설정 패널 닫기
    if (newParts.length === 0) {
      onClose()
      setSelectedNodeId(null)
    } else {
      // 남은 파트 중 첫 번째를 선택된 노드로 설정
      setSelectedNodeId(newParts[0].id)
    }
  }

  return (
    <div className={`settings-process-panel ${isOpen ? 'open' : ''}`}>
      <div className="settings-process-header">
        <h3>Settings Process</h3>
        <button 
          className="settings-close-btn"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      
      <div className="settings-process-body">
        {/* 추가된 파트 */}
        <div className="settings-section">
          <label className="settings-label">Added Parts</label>
          <div className="added-parts-container">
            {addedParts.map((part, index) => (
              <div key={part.id} className="added-part-item">
                <span className="part-number">{index + 1}</span>
                <span className="part-label">{part.data?.label || part.id}</span>
                <button 
                  className="part-remove-btn"
                  onClick={() => handlePartRemove(part.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 공정 순서 */}
        <div className="settings-section">
          <label className="settings-label">Process Order</label>
          <select 
            className="settings-select"
            value={settingsData.processOrder}
            disabled={isNodeConfirmed}
            onChange={handleProcessOrderChange}
          >
            {PROCESS_ORDER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* 공정 선택 */}
        <div className="settings-section">
          <label className="settings-label">Process Selection</label>
          <select 
            className="settings-select"
            value={settingsData.processSelection}
            disabled={isNodeConfirmed}
            onChange={(e) => setSettingsData({...settingsData, processSelection: e.target.value})}
          >
            {PROCESS_SELECTION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* 세부 항목 */}
        <div className="settings-section">
          <label className="settings-label">Detail Items</label>
          <div className="detail-items">
            {DETAIL_ITEMS.map(item => (
              <div key={item.key} className="detail-item">
                <label>{item.label}</label>
                <select 
                  className="settings-select"
                  value={settingsData[item.key]}
                  disabled={isNodeConfirmed}
                  onChange={(e) => setSettingsData({...settingsData, [item.key]: e.target.value})}
                >
                  <option value="">Select an item...</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsProcessPanel
