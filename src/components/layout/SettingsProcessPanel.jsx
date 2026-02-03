import { useEffect, useRef, useState } from 'react'
import {
  PROCESS_ORDER_OPTIONS,
  PROCESS_SELECTION_OPTIONS,
  PROCESS_SELECTION_MAP, // [추가] Process 이름 매핑을 위해 추가
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
  focusField,
  findAllConnectedPartNodes,
  formData
}) => {
  const stepSelectRef = useRef(null)
  const processSelectRef = useRef(null)
  const detailItemRefs = useRef(new Map())
  const [highlightedItems, setHighlightedItems] = useState(new Set())
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState(null)
  const [internalAddedParts, setInternalAddedParts] = useState([])

  // 패널이 열릴 때 내부 상태 동기화
  useEffect(() => {
    if (isOpen) {
      setInternalSelectedNodeId(selectedNodeId)
      setInternalAddedParts(addedParts)
    }
  }, [isOpen, selectedNodeId, addedParts])

  // 외부 상태 변경 시 싱크
  useEffect(() => {
    if (isOpen && selectedNodeId !== internalSelectedNodeId) {
      setInternalSelectedNodeId(selectedNodeId)
    }
    if (isOpen && addedParts !== internalAddedParts) {
      setInternalAddedParts(addedParts)
    }
  }, [isOpen, selectedNodeId, addedParts, internalSelectedNodeId, internalAddedParts])

  // 포커싱 처리
  useEffect(() => {
    if (isOpen && focusField === 'step' && stepSelectRef.current) {
      setTimeout(() => {
        stepSelectRef.current?.focus()
        stepSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    } else if (isOpen && focusField === 'process' && processSelectRef.current) {
      setTimeout(() => {
        processSelectRef.current?.focus()
        processSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [focusField, isOpen])

  // 그룹 커넥터 찾기
  const findCurrentGroupConnector = () => {
    if (internalSelectedNodeId && edges?.find(e => e?.id === internalSelectedNodeId)) {
      const connector = nodes?.find(n =>
        n && n.type === 'groupConnector' &&
        n.data?.groupEdges &&
        n.data.groupEdges.includes(internalSelectedNodeId)
      )
      if (connector) return connector
    }
    if (internalAddedParts && Array.isArray(internalAddedParts)) {
      for (const part of internalAddedParts) {
        const partId = typeof part === 'string' ? part : (part?.id || null)
        if (partId) {
          const node = nodes?.find(n => n?.id === partId)
          if (node && node.type === 'groupConnector' && node.data?.isGroupBox === true) {
            return node
          }
        }
      }
    }
    if(internalSelectedNodeId) {
      const node = nodes?.find(n => n?.id === internalSelectedNodeId)
      if(node && node.type === 'groupConnector') return node
    }
    return null
  }

  const currentGroupConnector = findCurrentGroupConnector()

  const allNodesConfirmed = internalAddedParts &&
    Array.isArray(internalAddedParts) &&
    internalAddedParts.length > 0 &&
    internalAddedParts.every(part => {
      const partId = typeof part === 'string' ? part : (part?.id || null)
      const node = nodes?.find(n => n?.id === partId)
      return node?.data?.isConfirmed === true
    })

  let isNodeConfirmed = allNodesConfirmed
  let effectiveIsEdgeConfirmed = isEdgeConfirmed

  if (currentGroupConnector && currentGroupConnector.data?.isConfirmed === false) {
    effectiveIsEdgeConfirmed = false
    isNodeConfirmed = false
  }

  const isReadOnly = effectiveIsEdgeConfirmed || isNodeConfirmed

  // [핵심] 그래프 데이터(노드/엣지) 일괄 업데이트 함수
  const updateGraphData = (key, value) => {
    if (internalSelectedNodeId && !isReadOnly) {
      const targetEdge = edges.find(e => e.id === internalSelectedNodeId)
      let connectedNodeIds = new Set()
      let connectedEdgeIds = new Set()

      if (targetEdge) {
        // [A] 엣지(그룹) 선택 시
        if (targetEdge.data?.savedSettings?.groupId) {
          const groupId = targetEdge.data.savedSettings.groupId
          edges.forEach(edge => {
            if (edge.data?.savedSettings?.groupId === groupId) {
              connectedEdgeIds.add(edge.id)
            }
          })
          if (targetEdge.data?.savedSettings?.addedPartsIds) {
             targetEdge.data.savedSettings.addedPartsIds.forEach(id => connectedNodeIds.add(id))
          }
        } else {
          const groupConnector = nodes.find(n =>
            n.type === 'groupConnector' &&
            n.data?.groupEdges?.includes(internalSelectedNodeId)
          )
          if (groupConnector) {
            if (groupConnector.data?.groupEdges) groupConnector.data.groupEdges.forEach(id => connectedEdgeIds.add(id))
            if (groupConnector.data?.nodeIds) groupConnector.data.nodeIds.forEach(id => connectedNodeIds.add(id))
            if (groupConnector.data?.nodeId) connectedNodeIds.add(groupConnector.data.nodeId)
          } else {
            connectedEdgeIds.add(internalSelectedNodeId)
            // 즉각적인 피드백을 위해 연결된 노드도 찾음
            const s = nodes.find(n => n.id === targetEdge.source)
            const t = nodes.find(n => n.id === targetEdge.target)
            if(s) connectedNodeIds.add(s.id)
            if(t) connectedNodeIds.add(t.id)
          }
        }
      } else {
        // [B] 노드 선택 시
        if (findAllConnectedPartNodes) {
          const connectedParts = findAllConnectedPartNodes(internalSelectedNodeId, nodes, edges)
          if (connectedParts.length > 0) {
            connectedParts.forEach(p => connectedNodeIds.add(p.id))
          } else {
            connectedNodeIds.add(internalSelectedNodeId)
          }
        } else {
          connectedNodeIds.add(internalSelectedNodeId)
        }

        edges.forEach(e => {
          if (connectedNodeIds.has(e.source) || connectedNodeIds.has(e.target)) {
            connectedEdgeIds.add(e.id)
          }
        })
      }

      // 노드 데이터 업데이트 (PartNode 디스플레이용)
      setNodes(nds => nds.map(node => {
        if (connectedNodeIds.has(node.id)) {
          return { ...node, data: { ...node.data, [key]: value } }
        }
        return node
      }))

      // 엣지 데이터 업데이트 (CustomEdge 디스플레이용)
      setEdges(eds => eds.map(edge => {
        if (connectedEdgeIds.has(edge.id)) {
          return { ...edge, data: { ...edge.data, [key]: value } }
        }
        return edge
      }))
    }
  }

  // Step 변경 핸들러
  const handleStepChange = (e) => {
    const newStep = e.target.value
    setSettingsData({ ...settingsData, step: newStep })
    
    // "STEP 01" -> "STEP. 01" 포맷 변환
    const formattedStep = newStep.replace('STEP ', 'STEP. ')
    
    // 그래프 업데이트 호출
    updateGraphData('step', formattedStep)
  }

  // Process 변경 핸들러
  const handleProcessChange = (e) => {
    const newProcess = e.target.value
    
    // 1. SettingsData 업데이트 (기존 시나리오 로직)
    if (newProcess && formData?.category && formData?.gender) {
      const scenario = DETAIL_ITEMS_SCENARIO[formData.category]?.[formData.gender]?.[newProcess]
      if (scenario) {
        const updatedData = {
          ...settingsData,
          process: newProcess,
          // ... 시나리오 데이터 매핑
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
        const changedItems = new Set()
        DETAIL_ITEMS.forEach(item => {
          const oldValue = settingsData[item.key] || ''
          const newValue = updatedData[item.key] || ''
          if (oldValue !== newValue && newValue !== '') {
            changedItems.add(item.key)
          }
        })
        setSettingsData(updatedData)
        if (changedItems.size > 0) {
          setHighlightedItems(changedItems)
          setTimeout(() => setHighlightedItems(new Set()), 2000)
        }
      } else {
        setSettingsData({ ...settingsData, process: newProcess, ...DETAIL_ITEMS_INIT })
      }
    } else {
      setSettingsData({ ...settingsData, process: newProcess, ...DETAIL_ITEMS_INIT })
    }

    // 2. [추가] 그래프 업데이트 (노드/엣지에 process 이름 표시)
    // 코드('01') 대신 이름('1 ROW STITCHING')을 표시하기 위해 매핑 사용
    const processLabel = PROCESS_SELECTION_MAP[newProcess] || newProcess || '-'
    updateGraphData('process', processLabel)
  }

  const handlePartRemove = (partId) => {
    handleNodeDelete(partId)
    if (!internalAddedParts || !Array.isArray(internalAddedParts)) return
    const newParts = internalAddedParts.filter(p => {
      const pId = typeof p === 'string' ? p : (p?.id || null)
      return pId !== partId
    })
    setAddedParts(newParts)
    setInternalAddedParts(newParts)
    if (newParts.length === 0) {
      onClose()
      setSelectedNodeId(null)
      setInternalSelectedNodeId(null)
    } else {
      const firstPart = newParts[0]
      const firstPartId = typeof firstPart === 'string' ? firstPart : (firstPart?.id || null)
      setSelectedNodeId(firstPartId)
      setInternalSelectedNodeId(firstPartId)
    }
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <div className={`settings-process-panel ${isOpen ? 'open' : ''}`}>
      <div className="settings-process-header">
        <h3>Settings Process</h3>
        <button className="settings-close-btn" onClick={handleClose}>×</button>
      </div>

      <div className="settings-process-body">
        {/* Added Parts */}
        <div className="settings-section">
          <label className="settings-label">Added Parts</label>
          <div className="added-parts-container">
            {internalAddedParts && Array.isArray(internalAddedParts) && internalAddedParts.map((part, index) => {
              const partId = typeof part === 'string' ? part : (part?.id || `part-${index}`)
              const partLabel = (() => {
                const node = nodes?.find(n => n?.id === partId)
                if(node && node.type === 'groupConnector') {
                  return node.data?.label || partId
                }
                return typeof part === 'string'
                  ? (node?.data?.label || part)
                  : (part?.data?.label || part?.id || partId)
              })()
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

        {/* Step */}
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

        {/* Process */}
        <div className="settings-section">
          <label className="settings-label">Process</label>
          <select
            ref={processSelectRef}
            className="settings-select"
            value={settingsData.process}
            disabled={isReadOnly}
            onChange={handleProcessChange} // [수정] 핸들러 교체
          >
            {PROCESS_SELECTION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* Detail Items */}
        <div className="settings-section">
          <label className="settings-label">Detail Items</label>
          <div className="detail-items">
            {DETAIL_ITEMS.map(item => {
              let options = [{ value: '', label: 'Select an item...' }]
              if (item.key === 'mcType') options = MC_TYPE_OPTIONS
              else if (item.key === 'needleType') options = NEEDLE_TYPE_OPTIONS
              else if (item.key === 'needleSize') options = NEEDLE_SIZE_OPTIONS
              else if (item.key === 'needlePoint') options = NEEDLE_POINT_OPTIONS
              else if (item.key === 'threadType') options = THREAD_TYPE_OPTIONS
              else if (item.key === 'stitchingMargin') options = STITCHING_MARGIN_OPTIONS
              else if (item.key === 'spi') options = SPI_OPTIONS
              else if (item.key === 'stitchingGuideline') options = STITCHING_GUIDELINE_OPTIONS
              else if (item.key === 'stitchingLines') options = STITCHING_LINES_OPTIONS
              else if (item.key === 'stitchingGuide') options = STITCHING_GUIDE_OPTIONS

              const isHighlighted = highlightedItems.has(item.key)

              return (
                <div key={item.key} className={`detail-item ${isHighlighted ? 'highlighted' : ''}`}>
                  <label>{item.label}</label>
                  <select
                    ref={(el) => {
                      if (el) detailItemRefs.current.set(item.key, el)
                      else detailItemRefs.current.delete(item.key)
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