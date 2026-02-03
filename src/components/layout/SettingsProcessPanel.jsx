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

/*
  [이슈 설명]
  설정패널을 닫았다가 다시 열면 그룹ID(그룹 커넥터의 id 혹은 groupEdge id 정보)가 없어지고 일반 노드만 남는 문제가 발생.
  이는 보통 관리되는 상태(selectedNodeId, addedParts 등)가 패널을 닫았다가 열 때 잘못 초기화되기 때문.
  selectedNodeId가 엣지(그룹)였다가 열고 닫으면 노드로 세팅되거나, addedParts가 일반 노드만으로 덮어씌워지는 현상이 발생.
  아래 코드는, 패널을 닫는 onClose 호출 및 addedParts/selectedNodeId 관리, 그리고 패널이 열릴 때 그룹연결자 선정 로직을 보완함.
*/

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

  // 패널이 열릴 때 내부 상태 동기화 (selectedNodeId와 addedParts 보존/복구 대응)
  useEffect(() => {
    if (isOpen) {
      setInternalSelectedNodeId(selectedNodeId)
      setInternalAddedParts(addedParts)
    }
  }, [isOpen, selectedNodeId, addedParts])

  // 외부에서 변경됐을 때 내부->외부(=props) 상태 싱크
  useEffect(() => {
    if (isOpen && selectedNodeId !== internalSelectedNodeId) {
      setInternalSelectedNodeId(selectedNodeId)
    }
    if (isOpen && addedParts !== internalAddedParts) {
      setInternalAddedParts(addedParts)
    }
  }, [isOpen, selectedNodeId, addedParts, internalSelectedNodeId, internalAddedParts])

  // focusField prop이 변경되면 해당 필드에 포커스
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

  // 그룹 커넥터를 robust하게 찾아주는 함수 (엣지/노드/그룹 커넥터 고려)
  const findCurrentGroupConnector = () => {
    // 1. 선택된 것이 edge(그룹)일 때 - 엣지를 통해 그룹 connector를 찾음
    if (internalSelectedNodeId && edges?.find(e => e?.id === internalSelectedNodeId)) {
      const connector = nodes?.find(n =>
        n && n.type === 'groupConnector' &&
        n.data?.groupEdges &&
        n.data.groupEdges.includes(internalSelectedNodeId)
      )
      if (connector) return connector
    }
    // 2. addedParts/selectedNodeId가 직접 그룹커넥터일 경우 탐색
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
    // 3. 직접 선택된 것이 groupConnector인 경우
    if(internalSelectedNodeId) {
      const node = nodes?.find(n => n?.id === internalSelectedNodeId)
      if(node && node.type === 'groupConnector') return node
    }
    return null
  }

  const currentGroupConnector = findCurrentGroupConnector()

  // 추가된 파트가 모두 확정되었는지 확인 (addedParts에 그룹커넥터도 있으므로 일반 노드뿐 아니라 connector에 대해서도 isConfirmed검사)
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

  // 공정 순서 변경 시 연결된 노드/엣지의 step 업데이트 (groupConnector 인식 포함)
  const handleStepChange = (e) => {
    const newStep = e.target.value
    setSettingsData({ ...settingsData, step: newStep })

    // "STEP 01" -> "STEP. 01" 포맷 변환
    const formattedStep = newStep.replace('STEP ', 'STEP. ')

    if (internalSelectedNodeId) {
      // 1. 현재 선택이 edge 인지, node 인지 확인 및 관련ID 수집
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
        } else {
          const groupConnector = nodes.find(n =>
            n.type === 'groupConnector' &&
            n.data?.groupEdges?.includes(internalSelectedNodeId)
          )
          if (groupConnector && groupConnector.data?.groupEdges) {
            groupConnector.data.groupEdges.forEach(id => connectedEdgeIds.add(id))
          } else {
            connectedEdgeIds.add(internalSelectedNodeId)
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

      const isSingleNode = connectedNodeIds.size === 1 && connectedEdgeIds.size === 0 && !targetEdge

      if (!isReadOnly) {
        if (isSingleNode) {
          setNodes(nds => nds.map(node => {
            if (connectedNodeIds.has(node.id)) {
              return {
                ...node,
                data: { ...node.data, step: formattedStep }
              }
            }
            return node
          }))
        } else {
          setEdges(eds => eds.map(edge => {
            if (connectedEdgeIds.has(edge.id)) {
              return {
                ...edge,
                data: { ...edge.data, step: formattedStep }
              }
            }
            return edge
          }))
        }
      }
    }
  }

  // 추가된 파트 제거 (그룹커넥터 포함 고려, 내부상태로도 제거)
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

  // 설정 패널 닫힐 때 내부 그룹/노드 선택상태 유지
  const handleClose = () => {
    onClose()
    // 내부 상태는 유지(혹은 필요시 지워줌), 외부 selectedNodeId/addedParts는 비우지 않음
  }

  // 설정 패널 렌더링
  return (
    <div className={`settings-process-panel ${isOpen ? 'open' : ''}`}>
      <div className="settings-process-header">
        <h3>Settings Process</h3>
        <button
          className="settings-close-btn"
          onClick={handleClose}
        >
          ×
        </button>
      </div>

      <div className="settings-process-body">
        {/* 추가된 파트 */}
        <div className="settings-section">
          <label className="settings-label">Added Parts</label>
          <div className="added-parts-container">
            {internalAddedParts && Array.isArray(internalAddedParts) && internalAddedParts.map((part, index) => {
              const partId = typeof part === 'string' ? part : (part?.id || `part-${index}`)
              const partLabel = (() => {
                const node = nodes?.find(n => n?.id === partId)
                {console.log('node', node)}
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
              if (newProcess && formData?.category && formData?.gender) {
                const scenario = DETAIL_ITEMS_SCENARIO[formData.category]?.[formData.gender]?.[newProcess]
                if (scenario) {
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
                    setTimeout(() => {
                      setHighlightedItems(new Set())
                    }, 2000)
                  }
                } else {
                  setSettingsData({
                    ...settingsData,
                    process: newProcess,
                    ...DETAIL_ITEMS_INIT
                  })
                }
              } else {
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