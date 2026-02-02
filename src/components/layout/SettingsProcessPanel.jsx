import { useEffect, useRef, useState } from 'react'
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
  STITCHING_GUIDE_OPTIONS,
  DETAIL_ITEMS_INIT,
  DETAIL_ITEMS_SCENARIO
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
  rfInstance,
  formData
}) => {
  // React Hooks 규칙: hooks는 항상 최상단에서 선언되어야 함
  // 조건부 return 전에 hooks를 선언해야 React가 hooks 호출 순서를 추적할 수 있음
  const stepSelectRef = useRef(null)
  const processSelectRef = useRef(null)
  const detailItemRefs = useRef(new Map())
  const [highlightedItems, setHighlightedItems] = useState(new Set())

  // focusField prop이 변경되면 해당 필드에 포커스
  useEffect(() => {
    if (focusField === 'step' && stepSelectRef.current) {
      setTimeout(() => {
        stepSelectRef.current?.focus()
        stepSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    } else if (focusField === 'process' && processSelectRef.current) {
      setTimeout(() => {
        processSelectRef.current?.focus()
        processSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [focusField])

  // 현재 편집 중인 그룹의 connector 찾기
  // 1. selectedNodeId가 edge ID인 경우 (그룹과 그룹 연결)
  let currentGroupConnector = selectedNodeId && edges?.find(e => e?.id === selectedNodeId)
    ? nodes?.find(n => 
        n && n.type === 'groupConnector' && 
        n.data?.groupEdges && 
        n.data.groupEdges.includes(selectedNodeId)
      )
    : null

  // 2. selectedNodeId가 edge ID가 아니고, addedParts에 그룹 connector가 있는 경우 (그룹과 노드 연결)
  if (!currentGroupConnector && selectedNodeId && addedParts && Array.isArray(addedParts)) {
    // addedParts에서 그룹 connector 찾기
    const groupConnectorInAddedParts = addedParts.find(part => {
      const partId = typeof part === 'string' ? part : (part?.id || null)
      if (!partId) return false
      const node = nodes?.find(n => n?.id === partId)
      return node && node.type === 'groupConnector' && node.data?.isGroupBox === true
    })
    
    if (groupConnectorInAddedParts) {
      const connectorId = typeof groupConnectorInAddedParts === 'string' 
        ? groupConnectorInAddedParts 
        : groupConnectorInAddedParts.id
      currentGroupConnector = nodes?.find(n => n?.id === connectorId)
    }
  }

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
  
  // 그룹과 그룹 연결, 그룹과 노드 연결 시: 현재 편집 중인 그룹 connector가 미확정이면 하위 그룹 connector의 isConfirmed 무시
  let isNodeConfirmed = allNodesConfirmed
  let effectiveIsEdgeConfirmed = isEdgeConfirmed // prop을 직접 수정하지 않고 로컬 변수 사용
  if (currentGroupConnector && currentGroupConnector.data?.isConfirmed === false) {
    // 현재 그룹이 미확정이면 편집 모드 (하위 그룹 connector들의 isConfirmed 무시)
    effectiveIsEdgeConfirmed = false
    isNodeConfirmed = false
  }

  // 확정된 edge이거나 확정된 노드인 경우 읽기 전용
  const isReadOnly = effectiveIsEdgeConfirmed || isNodeConfirmed

  const handleStepChange = (e) => {
    const newStep = e.target.value
    setSettingsData({ ...settingsData, step: newStep })

    // 선택된 노드와 연결된 모든 노드들의 step 업데이트
    if (selectedNodeId && findAllConnectedPartNodes) {

      // 함수형 업데이트를 사용하여 최신 상태 가져오기
      setEdges((currentEdges) => {
        setNodes((currentNodes) => {
          // edge ID인지 확인
          const targetEdge = currentEdges.find(e => e && e.id === selectedNodeId)
          
          // edge인 경우 savedSettings의 addedPartsIds 사용 (그룹 경계 존중)
          let connectedNodeIds = new Set()
          let connectedEdgeIds = new Set()
          
          if (targetEdge) {
            // savedSettings가 있는 경우 (확정된 그룹)
            if (targetEdge.data?.savedSettings?.addedPartsIds) {
              // savedSettings의 addedPartsIds에서 partNode ID만 추출
              const addedPartsIds = targetEdge.data.savedSettings.addedPartsIds
              addedPartsIds.forEach(nodeId => {
                const node = currentNodes.find(n => n && n.id === nodeId)
                if (node && node.type === 'partNode') {
                  connectedNodeIds.add(nodeId)
                }
              })
              
              // 해당 그룹에 속한 edge만 찾기 (savedSettings의 groupId 사용)
              if (targetEdge.data?.savedSettings?.groupId) {
                const groupId = targetEdge.data.savedSettings.groupId
                currentEdges.forEach(edge => {
                  // 같은 그룹에 속한 edge만 포함 (그룹 경계 존중)
                  if (edge.data?.savedSettings?.groupId === groupId) {
                    connectedEdgeIds.add(edge.id)
                  }
                })
              } else {
                // groupId가 없으면 연결된 노드와 연결된 edge 찾기
                currentEdges.forEach(edge => {
                  if (connectedNodeIds.has(edge.source) || connectedNodeIds.has(edge.target)) {
                    connectedEdgeIds.add(edge.id)
                  }
                })
              }
            } else {
              // savedSettings가 없는 경우 (확정되지 않은 그룹)
              // 그룹 connector를 찾아서 groupEdges 사용
              const groupConnector = currentNodes.find(n =>
                n && n.type === 'groupConnector' &&
                n.data?.isConfirmed === false &&
                n.data?.isGroupBox === true &&
                (n.data?.groupEdges?.includes(selectedNodeId) ||
                  (n.data?.nodeIds?.includes(targetEdge.source) &&
                   n.data?.nodeIds?.includes(targetEdge.target)))
              )

              if (groupConnector && groupConnector.data?.groupEdges) {
                // 그룹 connector의 groupEdges를 사용하여 그룹에 속한 edge 찾기
                groupConnector.data.groupEdges.forEach(edgeId => {
                  connectedEdgeIds.add(edgeId)
                })
                
                // 그룹에 속한 노드 ID 수집
                const groupNodeIds = groupConnector.data?.nodeIds || []
                groupNodeIds.forEach(nodeId => {
                  const node = currentNodes.find(n => n && n.id === nodeId)
                  if (node && node.type === 'partNode') {
                    connectedNodeIds.add(nodeId)
                  }
                })
              } else {
                // 그룹 connector를 찾지 못한 경우 기존 로직 사용
                const connectedPartNodes = findAllConnectedPartNodes(selectedNodeId, currentNodes, currentEdges)
                if (!connectedPartNodes || !Array.isArray(connectedPartNodes)) {
                  return currentNodes
                }
                connectedNodeIds = new Set(connectedPartNodes.map(n => n && n.id).filter(Boolean))

                // 연결된 모든 노드와 연결된 모든 edge 찾기
                currentEdges.forEach(edge => {
                  if (connectedNodeIds.has(edge.source) || connectedNodeIds.has(edge.target)) {
                    connectedEdgeIds.add(edge.id)
                  }
                })
              }
            }
          } else {
            // edge가 아닌 경우 기존 로직 사용
            const connectedPartNodes = findAllConnectedPartNodes(selectedNodeId, currentNodes, currentEdges)
            if (!connectedPartNodes || !Array.isArray(connectedPartNodes)) {
              return currentNodes
            }
            connectedNodeIds = new Set(connectedPartNodes.map(n => n && n.id).filter(Boolean))

            // 연결된 모든 노드와 연결된 모든 edge 찾기
            currentEdges.forEach(edge => {
              if (connectedNodeIds.has(edge.source) || connectedNodeIds.has(edge.target)) {
                connectedEdgeIds.add(edge.id)
              }
            })
          }

          // 단일 노드인지 여러 노드 연결인지 구분
          const isSingleNode = connectedNodeIds.size === 1 && connectedEdgeIds.size === 0
          const isMultipleNodes = connectedNodeIds.size > 1 || connectedEdgeIds.size > 0

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
                      step: newStep.replace('STEP ', 'STEP. ')
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
                      step: newStep.replace('STEP ', 'STEP. ')
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
                          step: newStep.replace('STEP ', 'STEP. ')
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

  // isOpen이 false일 때는 렌더링하지 않음 (불필요한 리렌더링 방지)
  if (!isOpen) {
    return null
  }

  return (
    <div className="settings-process-panel open">
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
          <label className="settings-label">Step</label>
          <select
            ref={stepSelectRef}
            className="settings-select"
            value={settingsData.step}
            disabled={isReadOnly}
            onChange={handleStepChange}
          >
            {PROCESS_ORDER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* 공정 선택 */}
        <div className="settings-section">
          <label className="settings-label">Process</label>
          <select
            ref={processSelectRef}
            className="settings-select"
            value={settingsData.process}
            disabled={isReadOnly}
            onChange={(e) => {
              const newProcess = e.target.value
              
              // 시나리오 기반으로 Detail Items 자동 채우기
              if (newProcess && formData?.category && formData?.gender) {
                const scenario = DETAIL_ITEMS_SCENARIO[formData.category]?.[formData.gender]?.[newProcess]
                
                if (scenario) {
                  // 시나리오에서 찾은 값으로 Detail Items 업데이트
                  const updatedData = {
                    ...settingsData,
                    process: newProcess,
                    mcType: scenario.mcType || '',
                    needleType: scenario.needleType || '',
                    needleSize: scenario.needleSize || '',
                    needlePoint: scenario.needlePoint || '',
                    threadType: scenario.threadType || '',
                    stitchingMargin: scenario.stitchingMargin || '',
                    spi: scenario.spi || '',
                    stitchingGuideline: scenario.stitchingGuideline || '',
                    stitchingLines: scenario.stitchingLines || '',
                    stitchingGuide: scenario.stitchingGuide || '',
                    bol: scenario.bol || '',
                    hash: scenario.hash || ''
                  }
                  
                  // 변경된 항목들 추적
                  const changedItems = new Set()
                  DETAIL_ITEMS.forEach(item => {
                    const oldValue = settingsData[item.key] || ''
                    const newValue = updatedData[item.key] || ''
                    if (oldValue !== newValue && newValue !== '') {
                      changedItems.add(item.key)
                    }
                  })
                  
                  setSettingsData(updatedData)
                  
                  // 변경된 항목들에 포커스 효과 적용
                  if (changedItems.size > 0) {
                    setHighlightedItems(changedItems)
                    
                    // 애니메이션 후 하이라이트 제거
                    setTimeout(() => {
                      setHighlightedItems(new Set())
                    }, 2000)
                  }
                } else {
                  // 시나리오를 찾지 못한 경우 process 업데이트 및 detail items 초기화
                  setSettingsData({ 
                    ...settingsData, 
                    process: newProcess,
                    ...DETAIL_ITEMS_INIT
                  })
                }
              } else {
                // category나 gender가 없으면 process 업데이트 및 detail items 초기화
                setSettingsData({ 
                  ...settingsData, 
                  process: newProcess,
                  ...DETAIL_ITEMS_INIT
                })
              }
            }}
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
              
              const isHighlighted = highlightedItems.has(item.key)
              
              return (
                <div 
                  key={item.key} 
                  className={`detail-item ${isHighlighted ? 'highlighted' : ''}`}
                >
                  <label>{item.label}</label>
                  <select
                    ref={(el) => {
                      if (el) {
                        detailItemRefs.current.set(item.key, el)
                      } else {
                        detailItemRefs.current.delete(item.key)
                      }
                    }}
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

