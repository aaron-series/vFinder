import { useEffect, useRef } from 'react'
import { 
  PROCESS_ORDER_OPTIONS, 
  PROCESS_SELECTION_OPTIONS, 
  DETAIL_ITEMS,
  MC_TYPE_OPTIONS,
  NEEDLE_TYPE_OPTIONS,
  NEEDLE_SIZE_OPTIONS,
  NEEDLE_POINT_OPTIONS,
  THREAD_TYPE_OPTIONS,
  STITCHING_MARGIN_OPTIONS,
  SPI_OPTIONS,
  STITCHING_GUIDELINE_OPTIONS,
  STITCHING_LINES_OPTIONS,
  STITCHING_GUIDE_OPTIONS
} from '../../constants'

const SettingsProcessPanel = ({
  isOpen,
  onClose,
  addedParts,
  settingsData,
  setSettingsData,
  selectedNodeId,
  isEdgeConfirmed = false,
  nodes,
  edges,
  setNodes,
  setEdges,
  handleNodeDelete,
  setSelectedNodeId,
  setAddedParts,
  updateEdgeLabels,
  focusField,
  findAllConnectedPartNodes,
  handleEdgeDelete,
  handleNodeSettingsClick,
  handleNodeConfirm,
  rfInstance
}) => {
  const processOrderSelectRef = useRef(null)
  const processSelectionSelectRef = useRef(null)

  // focusField prop이 변경되면 해당 필드에 포커스
  useEffect(() => {
    if (focusField === 'processOrder' && processOrderSelectRef.current) {
      setTimeout(() => {
        processOrderSelectRef.current?.focus()
        processOrderSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    } else if (focusField === 'processSelection' && processSelectionSelectRef.current) {
      setTimeout(() => {
        processSelectionSelectRef.current?.focus()
        processSelectionSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [focusField])

  // 그룹 내 모든 노드가 확정 상태인지 확인
  const allNodesConfirmed = addedParts && Array.isArray(addedParts) && addedParts.length > 0 &&
    addedParts.every(part => {
      // part가 문자열 ID인 경우 nodes에서 찾아서 확인
      if (typeof part === 'string') {
        const node = nodes?.find(n => n?.id === part)
        return node?.data?.isConfirmed === true
      }
      // part가 객체인 경우
      return part && part.data?.isConfirmed === true
    })
  const isNodeConfirmed = allNodesConfirmed

  // 확정된 edge이거나 확정된 노드인 경우 읽기 전용
  const isReadOnly = isEdgeConfirmed || isNodeConfirmed

  const handleProcessOrderChange = (e) => {
    const newProcessOrder = e.target.value
    setSettingsData({ ...settingsData, processOrder: newProcessOrder })

    // 선택된 노드와 연결된 모든 노드들의 step 업데이트
    if (selectedNodeId && findAllConnectedPartNodes) {

      // 함수형 업데이트를 사용하여 최신 상태 가져오기
      setEdges((currentEdges) => {
        setNodes((currentNodes) => {

          // 연결된 모든 노드 찾기
          const connectedPartNodes = findAllConnectedPartNodes(selectedNodeId, currentNodes, currentEdges)
          if (!connectedPartNodes || !Array.isArray(connectedPartNodes)) {
            return currentNodes
          }
          const connectedNodeIds = new Set(connectedPartNodes.map(n => n && n.id).filter(Boolean))

          // 연결된 모든 노드와 연결된 모든 edge 찾기
          const connectedEdgeIds = new Set()
          currentEdges.forEach(edge => {
            if (connectedNodeIds.has(edge.source) || connectedNodeIds.has(edge.target)) {
              connectedEdgeIds.add(edge.id)
            }
          })

          // 단일 노드인지 여러 노드 연결인지 구분
          const isSingleNode = connectedPartNodes.length === 1 && connectedEdgeIds.size === 0
          const isMultipleNodes = connectedPartNodes.length > 1 || connectedEdgeIds.size > 0

          // 단일 노드와 여러 노드 연결의 처리 방식 분리
          if (!isReadOnly) {
            if (isSingleNode) {
              // 단일 노드 처리: 노드의 step만 업데이트
              // 단일 노드는 hasConnectedEdge: false이므로 노드의 라벨 박스가 표시됨
              const updatedNodes = currentNodes.map(node => {
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

              setTimeout(() => setEdges(currentEdges), 50)
              return updatedNodes
            } else if (isMultipleNodes) {
              // 여러 노드 연결 처리: showLabel: true인 edge의 step만 업데이트
              // 여러 노드는 hasConnectedEdge: true이므로 edge의 라벨 박스만 표시됨
              const updatedEdges = currentEdges.map(edge => {
                if (connectedEdgeIds.has(edge.id) && edge.data?.showLabel === true) {
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

              // 여러 노드 연결의 경우 connector 유지만 처리, 노드는 업데이트하지 않음
              // step을 먼저 업데이트한 후 updateEdgeLabels 호출
              setTimeout(() => {
                // 함수형 업데이트를 사용하여 최신 상태 가져오기
                setEdges((latestEdges) => {
                  // 안전성 체크: latestEdges가 배열인지 확인
                  if (!latestEdges || !Array.isArray(latestEdges)) {
                    return latestEdges || []
                  }

                  // step이 업데이트된 edges를 먼저 적용
                  const edgesWithUpdatedStep = []
                  for (const edge of latestEdges) {
                    if (connectedEdgeIds.has(edge.id) && edge.data?.showLabel === true) {
                      edgesWithUpdatedStep.push({
                        ...edge,
                        data: {
                          ...edge.data,
                          step: newProcessOrder.replace('STEP ', 'STEP. ')
                        }
                      })
                    } else {
                      edgesWithUpdatedStep.push(edge)
                    }
                  }

                  return setNodes((latestNodes) => {
                    if (!latestNodes || !Array.isArray(latestNodes)) {
                      return latestNodes || []
                    }

                    // step이 업데이트된 edges를 updateEdgeLabels에 전달
                    const { updatedEdges: finalEdges, groupConnectorNodes } = updateEdgeLabels(edgesWithUpdatedStep, latestNodes, rfInstance, handleEdgeDelete, handleNodeSettingsClick, handleNodeConfirm)

                    // 그룹 연결 노드 업데이트 (중복 제거 - 이미 존재하는 connector는 유지)
                    const filteredNodes = latestNodes.filter(n => n && n.type !== 'groupConnector')
                    const existingConnectorMap = new Map(
                      latestNodes
                        .filter(n => n && n.type === 'groupConnector')
                        .map(n => [n.id, n])
                    )

                    // updateEdgeLabels가 반환한 connector로 업데이트하되, 기존 connector도 모두 유지
                    const updatedConnectorMap = new Map()

                    // updateEdgeLabels가 반환한 connector로 업데이트
                    if (groupConnectorNodes && Array.isArray(groupConnectorNodes)) {
                      groupConnectorNodes.forEach(newConnector => {
                        updatedConnectorMap.set(newConnector.id, newConnector)
                      })
                    }

                    // 기존 connector 중 updateEdgeLabels가 반환하지 않은 것도 유지
                    // 여러 노드 연결의 경우 그룹박스 connector를 반드시 유지해야 함
                    existingConnectorMap.forEach((existingConnector, id) => {
                      if (!updatedConnectorMap.has(id)) {
                        // 확정된 connector는 항상 유지
                        if (existingConnector.data?.isConfirmed === true && !existingConnector.data?.hidden) {
                          updatedConnectorMap.set(id, existingConnector)
                        }
                        // 확정되지 않은 그룹박스 connector도 반드시 유지 (여러 노드 연결의 경우)
                        else if (existingConnector.data?.isGroupBox === true && !existingConnector.data?.hidden) {
                          updatedConnectorMap.set(id, existingConnector)
                        }
                      }
                    })

                    const finalConnectors = Array.from(updatedConnectorMap.values())

                    // edges 업데이트는 별도로 처리
                    setTimeout(() => setEdges(finalEdges || latestEdges), 0)
                    return [...filteredNodes, ...finalConnectors]
                  })
                })
              }, 100)

              // updateEdgeLabels가 이미 step이 업데이트된 edges를 반환하므로 별도로 setEdges 호출 불필요
              return currentNodes // 노드는 변경하지 않음
            }
          }

          // isNodeConfirmed가 true인 경우: 기존 로직 유지 (확정된 노드/그룹의 step 업데이트)
          const updatedEdges = currentEdges.map(edge => {
            if (connectedEdgeIds.has(edge.id)) {
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

          const updatedNodes = currentNodes.map(node => {
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

          setTimeout(() => setEdges(updatedEdges), 50)
          return updatedNodes
        })
        return currentEdges
      })
    }
  }

  const handlePartRemove = (partId) => {
    // 노드를 캔버스에서 제거
    handleNodeDelete(partId)

    // Added Parts에서도 제거
    if (!addedParts || !Array.isArray(addedParts)) {
      return
    }
    const newParts = addedParts.filter(p => {
      // p가 문자열 ID인 경우
      if (typeof p === 'string') {
        return p !== partId
      }
      // p가 객체인 경우
      return p && p.id !== partId
    })
    setAddedParts(newParts)

    // 모든 파트가 제거되면 설정 패널 닫기
    if (newParts.length === 0) {
      onClose()
      setSelectedNodeId(null)
    } else {
      // 남은 파트 중 첫 번째를 선택된 노드로 설정
      const firstPart = newParts[0]
      const firstPartId = typeof firstPart === 'string' ? firstPart : (firstPart?.id || null)
      setSelectedNodeId(firstPartId)
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
            {addedParts && Array.isArray(addedParts) && addedParts.map((part, index) => {
              // part가 문자열 ID인 경우와 객체인 경우 모두 처리
              const partId = typeof part === 'string' ? part : (part?.id || `part-${index}`)
              const partLabel = typeof part === 'string'
                ? (nodes?.find(n => n?.id === part)?.data?.label || part)
                : (part?.data?.label || part?.id || partId)

              return (
                <div key={partId} className="added-part-item">
                  <span className="part-number">{index + 1}</span>
                  <span className="part-label">{partLabel}</span>
                  <button
                    className="part-remove-btn"
                    disabled={isReadOnly}
                    onClick={() => handlePartRemove(partId)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* 공정 순서 */}
        <div className="settings-section">
          <label className="settings-label">Process Order</label>
          <select
            ref={processOrderSelectRef}
            className="settings-select"
            value={settingsData.processOrder}
            disabled={isReadOnly}
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
            ref={processSelectionSelectRef}
            className="settings-select"
            value={settingsData.processSelection}
            disabled={isReadOnly}
            onChange={(e) => setSettingsData({ ...settingsData, processSelection: e.target.value })}
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
            {DETAIL_ITEMS.map(item => {
              // 각 항목에 맞는 옵션 배열 선택
              let options = [{ value: '', label: 'Select an item...' }]
              
              if (item.key === 'mcType') {
                options = MC_TYPE_OPTIONS
              } else if (item.key === 'needleType') {
                options = NEEDLE_TYPE_OPTIONS
              } else if (item.key === 'needleSize') {
                options = NEEDLE_SIZE_OPTIONS
              } else if (item.key === 'needlePoint') {
                options = NEEDLE_POINT_OPTIONS
              } else if (item.key === 'threadType') {
                options = THREAD_TYPE_OPTIONS
              } else if (item.key === 'stitchingMargin') {
                options = STITCHING_MARGIN_OPTIONS
              } else if (item.key === 'spi') {
                options = SPI_OPTIONS
              } else if (item.key === 'stitchingGuideline') {
                options = STITCHING_GUIDELINE_OPTIONS
              } else if (item.key === 'stitchingLines') {
                options = STITCHING_LINES_OPTIONS
              } else if (item.key === 'stitchingGuide') {
                options = STITCHING_GUIDE_OPTIONS
              }
              
              return (
                <div key={item.key} className="detail-item">
                  <label>{item.label}</label>
                  <select
                    className="settings-select"
                    value={settingsData[item.key]}
                    disabled={isReadOnly}
                    onChange={(e) => setSettingsData({ ...settingsData, [item.key]: e.target.value })}
                  >
                    {options.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsProcessPanel
