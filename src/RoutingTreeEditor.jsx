import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'
import useRoutingStore from './store/useRoutingStore'
import { showSmallAlert } from './utils'
import { NODE_WIDTH, NODE_HEIGHT, INITIAL_SETTINGS_DATA, LABEL_BOX_HALF_WIDTH, LABEL_BOX_HALF_HEIGHT } from './constants'
import { EditorUtils } from './helper'
import { getConnectionCase, correctConnectionForCase5, findNearestHandle } from './utils/connectionHelpers'
import { findAllConnectedPartNodes, collectConfirmedGroupData, findConnectedEdgesInGroup, collectGroupNodesForAddedParts, handleCase5SpecialLogic, findUnconfirmedGroupConnector } from './utils/groupHelpers'
import { findGroupConnector, isMatchingConnector, hideChildGroupConnectors } from './utils/nodeHelpers'
import { syncConnectorPositions, calculateConnectorPosition } from './services/connectorService'
import { updateEdgeLabels } from './services/edgeLabelService'
import { exportImage } from './services/exportService'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useEdgeHandlers } from './hooks/useEdgeHandlers'
import { useNodeHandlers } from './hooks/useNodeHandlers'
import { useDragAndDrop } from './hooks/useDragAndDrop'
import { PartNode, GroupConnectorNode } from './components/nodes'
import { CustomEdge } from './components/edges'
import { EditorHeader, EditorMetaBar, SettingsProcessPanel, PartsPanel } from './components/layout'
import PartsListModal from './components/modals/PartsListModal'
import './RoutingTreeEditor.css'

const nodeWidth = NODE_WIDTH
const nodeHeight = NODE_HEIGHT

// 내부 컴포넌트 분리 (Provider 사용을 위해)
function EditorContent() {
  // 노드 및 엣지 타입 메모이제이션 (React Flow 경고 방지)
  const nodeTypes = useMemo(() => ({
    partNode: PartNode,
    groupConnector: GroupConnectorNode,
  }), [])

  const edgeTypes = useMemo(() => ({
    custom: CustomEdge,
  }), [])

  const { formData, patterns, reorderPatterns, removePattern } = useRoutingStore()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showPartsListModal, setShowPartsListModal] = useState(false)
  
  // 드래그 앤 드롭 상태 (패널에서 사용)
  const [draggedRowIndex, setDraggedRowIndex] = useState(null)

  // 설정 패널 관련 상태
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [focusField, setFocusField] = useState(null)
  const [settingsData, setSettingsData] = useState(INITIAL_SETTINGS_DATA)
  const settingsDataRef = useRef(settingsData) // 최신 상태 참조용 Ref
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [addedParts, setAddedParts] = useState([])
  const addedPartsRef = useRef(addedParts) // 최신 상태 참조용 Ref
  const [isEdgeConfirmed, setIsEdgeConfirmed] = useState(false) // 확정된 edge인지 확인
  const [isExportingImage, setIsExportingImage] = useState(false) // 이미지 내보내기 로딩 상태

  // React Flow 인스턴스 (좌표 변환용)
  const [rfInstance, setRfInstance] = useState(null)

  // 연결선 미리보기 타입 동적 변경을 위한 상태
  const [connectionLineType, setConnectionLineType] = useState('smoothstep')
  const connectingRef = useRef(null) // 연결 중인 상태 추적

  // 중복 호출 방지를 위한 ref
  const confirmingRef = useRef(new Set())

  // 엣지 핸들러 훅 사용
  const { handleEdgeDelete } = useEdgeHandlers({
    setEdges,
    setNodes,
    setIsEdgeConfirmed,
    setShowSettingsPanel,
    setSelectedNodeId
  })

  // 노드 설정 클릭 핸들러
  const handleNodeSettingsClick = useCallback((nodeId) => {
    setNodes((currentNodes) => {
      // edge ID인지 확인
      setEdges((currentEdges) => {
        const targetEdge = EditorUtils.findEdge(currentEdges, nodeId)

        // edge인 경우
        if (targetEdge) {
          // 설정 패널 열기
          setSelectedNodeId(nodeId)
          setShowSettingsPanel(true)

          // edge의 확정 상태 확인
          let isEdgeConfirmedState = targetEdge.data?.isConfirmed === true
          if (!isEdgeConfirmedState && targetEdge.data?.savedSettings?.connectorId) {
            const connector = currentNodes.find(n => n && n.id === targetEdge.data.savedSettings.connectorId)
            if (connector && connector.data?.isConfirmed === true) {
              isEdgeConfirmedState = true
            }
          }
          setIsEdgeConfirmed(isEdgeConfirmedState)

          // edge의 savedSettings 적용
          if (targetEdge.data?.savedSettings && Object.keys(targetEdge.data.savedSettings).length > 0) {
            const { addedPartsIds, ...settingsData } = targetEdge.data.savedSettings
            setSettingsData(settingsData)

            if (addedPartsIds && Array.isArray(addedPartsIds)) {
              const savedAddedParts = currentNodes.filter(n =>
                n && addedPartsIds.includes(n.id) && n.type === 'partNode'
              )
              setAddedParts(savedAddedParts)
            } else {
              setAddedParts([])
            }
          } else {
            setSettingsData(INITIAL_SETTINGS_DATA)
            setAddedParts([])
          }
          return currentEdges
        }

        // 노드인 경우
        const node = EditorUtils.findNode(currentNodes, nodeId)
        if (!node) return currentEdges

        setSelectedNodeId(nodeId)
        setShowSettingsPanel(true)
        setIsEdgeConfirmed(node.data?.isConfirmed === true)

        if (node.type === 'groupConnector') {
          // 그룹 커넥터 로직
          if (node.data?.isConfirmed === true && node.data?.savedSettings?.addedPartsIds) {
             const { addedPartsIds, ...settingsData } = node.data.savedSettings
             setSettingsData(settingsData)
             const savedAddedParts = currentNodes.filter(n =>
               n && addedPartsIds.includes(n.id) && n.type === 'partNode'
             )
             setAddedParts(savedAddedParts)
          } else {
             // 기존 로직 (저장된 값이 없거나 미확정 시)
             const groupNodeIds = (node.data?.nodeIds || []).filter(id => !id.startsWith('edge-'))
             const groupPartNodes = currentNodes.filter(n =>
               n && n.type === 'partNode' && groupNodeIds.includes(n.id)
             )
             
             if (node.data?.savedSettings) {
               setSettingsData(node.data.savedSettings)
             } else {
               setSettingsData(INITIAL_SETTINGS_DATA)
             }
             
             setAddedParts(groupPartNodes || [])
          }
        } else {
          // 일반 노드 로직
          const connectedPartNodes = findAllConnectedPartNodes(nodeId, currentNodes, currentEdges)
          if (node.data?.savedSettings) {
            setSettingsData(node.data.savedSettings)
          } else {
            setSettingsData(INITIAL_SETTINGS_DATA)
          }
          
          if (connectedPartNodes?.length > 0) {
            setAddedParts(connectedPartNodes)
          } else {
            setAddedParts([node])
          }
        }
        return currentEdges
      })
      return currentNodes
    })
  }, [setNodes, setEdges])

  // 더블클릭 zoom 비활성화
  useEffect(() => {
    const handleDoubleClick = (event) => {
      if (event.target.closest('.react-flow__pane')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('dblclick', handleDoubleClick, true)
    return () => {
      document.removeEventListener('dblclick', handleDoubleClick, true)
    }
  }, [])

  // 이미지로 내보내기 기능
  const handleExportImage = useCallback(async () => {
    await exportImage(rfInstance, setIsExportingImage)
  }, [rfInstance, setIsExportingImage])

  // Ref 업데이트
  useEffect(() => { settingsDataRef.current = settingsData }, [settingsData])
  useEffect(() => { addedPartsRef.current = addedParts }, [addedParts])

  // 노드 드랍 시 단일 노드 커넥터 생성
  useEffect(() => {
    if (!rfInstance || !nodes || !edges) return

    setNodes((currentNodes) => {
      const partNodes = currentNodes.filter(n => n && n.type === 'partNode' && !n.data?.isConfirmed)
      const updatedNodes = [...currentNodes]
      let hasChanges = false

      partNodes.forEach(node => {
        const hasEdge = (edges || []).some(e => e && (e.source === node.id || e.target === node.id))
        if (!hasEdge) {
          const connectorId = EditorUtils.createSingleNodeConnectorId(node.id)
          const existingConnector = EditorUtils.findConnector(currentNodes, connectorId)

          if (!existingConnector) {
            const labelX = node.position.x + 90
            const labelY = node.position.y + 260
            updatedNodes.push({
              id: connectorId,
              type: 'groupConnector',
              position: { x: labelX, y: labelY },
              data: {
                isConfirmed: false,
                isGroupBox: false,
                nodeId: node.id,
                hidden: false
              },
              zIndex: 1001
            })
            hasChanges = true
          }
        }
      })
      return hasChanges ? updatedNodes : currentNodes
    })
  }, [nodes.length, rfInstance, setNodes, edges])

  // 커넥터 위치 동기화 및 계산 콜백
  const syncConnectorPositionsCallback = useCallback(async (currentNodes, currentEdges) => {
    return await syncConnectorPositions(currentNodes, currentEdges, rfInstance)
  }, [rfInstance])

  const calculateConnectorPositionCallback = useCallback(async (connectedEdges, currentNodes, rfInst = null) => {
    return await calculateConnectorPosition(connectedEdges, currentNodes, rfInst)
  }, [])

  // Edge 라벨 및 그룹 연결포인트 업데이트
  const updateEdgeLabelsCallback = useCallback((currentEdges, currentNodes, rfInst = null, handleEdgeDeleteFn = null, handleNodeSettingsClickFn = null, handleNodeConfirmFn = null, targetGroupId = null) => {
    return updateEdgeLabels(currentEdges, currentNodes, rfInst, handleEdgeDeleteFn, handleNodeSettingsClickFn, handleNodeConfirmFn, targetGroupId)
  }, [])

  // 노드 핸들러 훅 사용
  const {
    handleNodeStepChange,
    handleNodeDelete,
    handleNodeEdit,
    handleNodeConfirm,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop
  } = useNodeHandlers({
    nodes,
    edges,
    setNodes,
    setEdges,
    rfInstance,
    settingsDataRef,
    addedPartsRef,
    confirmingRef,
    setIsEdgeConfirmed,
    setShowSettingsPanel,
    setFocusField,
    setSelectedNodeId,
    setAddedParts,
    setSettingsData,
    handleEdgeDelete,
    handleNodeSettingsClick,
    calculateConnectorPositionCallback,
    updateEdgeLabelsCallback
  })

  // 노드 변경 감지 및 커넥터 동기화
  const handleNodesChange = useCallback((changes) => {
    if (!changes || !Array.isArray(changes)) {
      onNodesChange(changes)
      return
    }
    onNodesChange(changes)
    const hasPositionChange = changes.some(change => change && change.type === 'position' && change.dragging === false)
    if (hasPositionChange) {
      // DOM 렌더링 완료 후 커넥터 위치 동기화
      setNodes((currentNodes) => {
        syncConnectorPositionsCallback(currentNodes, edges).then(updatedNodes => {
          if (updatedNodes) {
            setNodes(updatedNodes)
          }
        })
        return currentNodes
      })
    }
  }, [onNodesChange, edges, setNodes, syncConnectorPositionsCallback])

  // LocalStorage 훅 사용
  const { handleSave, clearLocalStorage } = useLocalStorage({
    formData,
    patterns,
    nodes,
    edges,
    rfInstance,
    setNodes,
    setEdges,
    handleNodeEdit,
    handleNodeConfirm,
    handleNodeSettingsClick,
    handleNodeDelete,
    handleNodeStepChange
  })

  // 드래그 앤 드롭 훅 사용
  const {
    onPartDragStart,
    onDrop,
    onDragOver
  } = useDragAndDrop({
    nodes,
    setNodes,
    rfInstance,
    nodeWidth,
    nodeHeight,
    handleNodeSettingsClick,
    handleNodeDelete,
    handleNodeStepChange,
    handleNodeConfirm,
    handleNodeEdit
  })

  // [수정됨] 연결 시작 처리 (Garbage Code 제거 및 로직 복구)
  const onConnectStart = useCallback((event, { nodeId, handleType, handleId }) => {
    if (!rfInstance) return

    const sourceNode = EditorUtils.findNode(nodes, nodeId)
    if (!sourceNode) return

    // source handle의 position 확인
    let sourcePosition = 'bottom' // 기본값
    if (sourceNode.type === 'partNode') {
      if (handleId === 'top') sourcePosition = 'top'
      else if (handleId === 'bottom') sourcePosition = 'bottom'
      else if (handleId === 'left') sourcePosition = 'left'
      else if (handleId === 'right') sourcePosition = 'right'
    } else if (sourceNode.type === 'groupConnector') {
      sourcePosition = 'bottom'
    }

    connectingRef.current = {
      sourceNodeId: nodeId,
      sourcePosition,
      handleType,
      handleId,
    }

    // 마우스 이동 시 연결선 타입 변경을 위한 이벤트 리스너
    const handleMouseMove = (e) => {
      if (!rfInstance || !connectingRef.current) return
      const flowPosition = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const nearestHandle = findNearestHandle(flowPosition.x, flowPosition.y, nodes, rfInstance)

      if (nearestHandle) {
        // getConnectionLineTypeForTarget 함수가 있다면 사용, 없으면 기본값
        // setConnectionLineType(newLineType) 
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    connectingRef.current.mouseMoveHandler = handleMouseMove
  }, [rfInstance, nodes])

  // 연결 종료 처리
  const onConnectEnd = useCallback(() => {
    if (connectingRef.current?.mouseMoveHandler) {
      document.removeEventListener('mousemove', connectingRef.current.mouseMoveHandler)
    }
    connectingRef.current = null
    setConnectionLineType('smoothstep')
  }, [])

  // 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    return () => {
      if (connectingRef.current?.mouseMoveHandler) {
        document.removeEventListener('mousemove', connectingRef.current.mouseMoveHandler)
      }
    }
  }, [])

  // 노드 간 연결 처리 (onConnect)
  const onConnect = useCallback((connection) => {
    if (!connection.source || !connection.target) return
    if (!rfInstance) return
    if (connection.source === connection.target) return

    const sourceNode = EditorUtils.findNode(nodes, connection.source)
    if (!sourceNode) return

    // 확정되지 않은 그룹 커넥터 연결 방지
    if (sourceNode.type === 'groupConnector') {
      if (!sourceNode.data?.isConfirmed || sourceNode.data?.hidden) return
    }

    const targetNode = EditorUtils.findNode(nodes, connection.target)
    if (targetNode) {
      if (targetNode.type === 'groupConnector') {
        if (!targetNode.data?.isConfirmed || targetNode.data?.hidden) return
      }
    }

    // 케이스 5 및 연결 보정
    const currentNodes = nodes
    const { correctedSource, correctedTarget } = correctConnectionForCase5(connection, currentNodes)
    if (correctedSource === correctedTarget) return

    // 노드 정렬 (케이스 1)
    setNodes((nds) => {
        const sNode = EditorUtils.findNode(nds, correctedSource)
        const tNode = EditorUtils.findNode(nds, correctedTarget)
        if(sNode && tNode) {
            const caseInfo = getConnectionCase(sNode, tNode)
            if(caseInfo.isCase1) {
                return nds.map(n => n.id === correctedTarget ? {...n, position: {...n.position, y: sNode.position.y}} : n)
            }
        }
        return nds
    })

    const newEdge = {
      id: EditorUtils.createEdgeId(edges),
      source: correctedSource,
      target: correctedTarget,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'custom',
      data: {
        step: 'STEP.',
        stepValue: '',
        isConfirmed: false,
        showLabel: true,
        onEdit: (edgeId) => handleNodeEdit(edgeId),
        onConfirm: (edgeId) => handleNodeConfirm(edgeId),
        onStepChange: (edgeId, value) => {
          setEdges((eds) => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, stepValue: value } } : e))
        },
        onSettingsClick: (edgeId) => handleNodeSettingsClick(edgeId)
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    }

    setEdges((eds) => {
        const updatedEdges = addEdge(newEdge, eds)
        
        // 연결 후 addedParts 업데이트 및 노드 상태 변경 로직
        setNodes((nds) => {
            // 노드 상태 업데이트 (hasConnectedEdge)
            const updatedNodes = nds.map(node => {
                if ((node.id === correctedSource || node.id === correctedTarget) && node.type === 'partNode') {
                    return { ...node, data: { ...node.data, hasConnectedEdge: true } }
                }
                return node
            })
            
            // 연결된 노드들을 찾아서 addedParts 설정
            const sourceNode = EditorUtils.findNode(updatedNodes, correctedSource)
            const targetNode = EditorUtils.findNode(updatedNodes, correctedTarget)
            
            if (sourceNode && targetNode) {
                // 그룹 커넥터와 연결된 경우: 직접 연결된 노드(그룹 커넥터, 파츠 노드)만 추가
                const isSourceGroupConnector = sourceNode.type === 'groupConnector'
                const isTargetGroupConnector = targetNode.type === 'groupConnector'
                
                if (isSourceGroupConnector || isTargetGroupConnector) {
                    // 그룹 커넥터와 직접 연결된 노드만 추가 (그룹 내부 partNode 제외)
                    const partsToAdd = []
                    if (isSourceGroupConnector) {
                        partsToAdd.push(sourceNode) // 그룹 커넥터 추가
                    } else if (sourceNode.type === 'partNode') {
                        partsToAdd.push(sourceNode)
                    }
                    
                    if (isTargetGroupConnector) {
                        if (!partsToAdd.find(p => p.id === targetNode.id)) {
                            partsToAdd.push(targetNode) // 그룹 커넥터 추가
                        }
                    } else if (targetNode.type === 'partNode' && targetNode.id !== sourceNode.id) {
                        partsToAdd.push(targetNode)
                    }
                    
                    if (partsToAdd.length > 0) {
                        setTimeout(() => {
                            setAddedParts(partsToAdd)
                            setSettingsData(INITIAL_SETTINGS_DATA)
                            setSelectedNodeId(newEdge.id)
                            setShowSettingsPanel(true)
                        }, 0)
                    }
                } else {
                    // 일반 노드 간 연결: 연결된 모든 partNode 찾기
                    const connectedPartNodes = findAllConnectedPartNodes(correctedSource, updatedNodes, updatedEdges)
                    
                    if (connectedPartNodes && connectedPartNodes.length > 0) {
                        // 비동기로 addedParts 설정 (상태 업데이트는 다음 렌더 사이클에서)
                        setTimeout(() => {
                            setAddedParts(connectedPartNodes)
                            setSettingsData(INITIAL_SETTINGS_DATA)
                            setSelectedNodeId(newEdge.id)
                            setShowSettingsPanel(true)
                        }, 0)
                    } else {
                        // 연결된 노드가 없으면 source와 target만 추가
                        const partsToAdd = []
                        if (sourceNode.type === 'partNode') partsToAdd.push(sourceNode)
                        if (targetNode.type === 'partNode' && targetNode.id !== sourceNode.id) {
                            partsToAdd.push(targetNode)
                        }
                        
                        if (partsToAdd.length > 0) {
                            setTimeout(() => {
                                setAddedParts(partsToAdd)
                                setSettingsData(INITIAL_SETTINGS_DATA)
                                setSelectedNodeId(newEdge.id)
                                setShowSettingsPanel(true)
                            }, 0)
                        }
                    }
                }
            }
            
            return updatedNodes
        })
        
        // Edge 라벨 업데이트 트리거
        setEdges(curEdges => {
            setNodes(curNodes => {
                const { updatedEdges, groupConnectorNodes } = updateEdgeLabels(curEdges, curNodes, rfInstance, handleEdgeDelete, handleNodeSettingsClick, handleNodeConfirm, null)
                
                // 커넥터 병합 로직: 기존 connector 상태 보존
                const filteredNodes = curNodes.filter(n => n && n.type !== 'groupConnector')
                const existingConnectorMap = new Map(
                    curNodes
                        .filter(n => n && n.type === 'groupConnector')
                        .map(n => [n.id, n])
                )
                
                const updatedConnectorMap = new Map()
                
                // updateEdgeLabels가 반환한 connector로 업데이트
                if (groupConnectorNodes && Array.isArray(groupConnectorNodes)) {
                    groupConnectorNodes.forEach(newConnector => {
                        const existingConnector = existingConnectorMap.get(newConnector.id)
                        // 기존 connector가 확정되어 있고 hidden이 false면, hidden 상태를 보존
                        if (existingConnector && existingConnector.data?.isConfirmed === true && existingConnector.data?.hidden === false) {
                            // updateEdgeLabels가 반환한 connector가 hidden: true로 설정했더라도, 기존 상태 보존
                            updatedConnectorMap.set(newConnector.id, {
                                ...newConnector,
                                data: {
                                    ...newConnector.data,
                                    hidden: false, // 기존 상태 보존
                                    isConfirmed: true
                                }
                            })
                        } else {
                            updatedConnectorMap.set(newConnector.id, newConnector)
                        }
                    })
                }
                
                // 기존 connector 중 updateEdgeLabels가 반환하지 않은 것도 유지
                existingConnectorMap.forEach((existingConnector, id) => {
                    if (!updatedConnectorMap.has(id)) {
                        // 확정된 connector는 항상 유지 (편집 모드에서도 상태 보존)
                        if (existingConnector.data?.isConfirmed === true && existingConnector.data?.hidden === false) {
                            updatedConnectorMap.set(id, existingConnector)
                        } else if (existingConnector.data?.isGroupBox === true && !existingConnector.data?.hidden) {
                            updatedConnectorMap.set(id, existingConnector)
                        }
                    }
                })
                
                const finalConnectors = Array.from(updatedConnectorMap.values())
                
                setEdges(updatedEdges)
                
                // DOM 렌더링 완료 후 커넥터 위치 동기화
                syncConnectorPositionsCallback([...filteredNodes, ...finalConnectors], updatedEdges).then(updatedNodes => {
                    if (updatedNodes) {
                        setNodes(updatedNodes)
                    }
                })
                
                return [...filteredNodes, ...finalConnectors]
            })
            return curEdges
        })

        return updatedEdges
    })

  }, [rfInstance, nodes, edges, setNodes, setEdges, handleNodeEdit, handleNodeConfirm, handleNodeSettingsClick, updateEdgeLabels, handleEdgeDelete, findAllConnectedPartNodes, setAddedParts, setSettingsData, setSelectedNodeId, setShowSettingsPanel])


  return (
    <div className="editor-container">
      <PartsListModal
        isOpen={showPartsListModal}
        onClose={() => setShowPartsListModal(false)}
        patterns={patterns}
        reorderPatterns={reorderPatterns}
        removePattern={removePattern}
        draggedRowIndex={draggedRowIndex}
        setDraggedRowIndex={setDraggedRowIndex}
      />

      <EditorHeader />
      <EditorMetaBar
        formData={formData}
        onReset={() => {
          setNodes([])
          setEdges([])
          setAddedParts([])
          setShowSettingsPanel(false)
          setSelectedNodeId(null)
          setIsEdgeConfirmed(false)
          clearLocalStorage()
        }}
        onSave={handleSave}
        onExportImage={handleExportImage}
        isExportingImage={isExportingImage}
      />

      <div className="editor-main">
        <div className="canvas-area">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setRfInstance}
            onPaneClick={() => {
              setShowSettingsPanel(false)
              setSelectedNodeId(null)
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
            minZoom={0.1}
            maxZoom={2}
            attributionPosition="bottom-left"
            connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 2 }}
            connectionLineType={connectionLineType}
            connectionRadius={60}
            autoPanOnConnect={true}
          >
            <Background color="#aaa" gap={16} />
            <Controls />
          </ReactFlow>
        </div>

        <SettingsProcessPanel
          isOpen={showSettingsPanel}
          onClose={() => {
            setShowSettingsPanel(false)
            setSelectedNodeId(null)
            setFocusField(null)
            setIsEdgeConfirmed(false)
          }}
          addedParts={addedParts}
          settingsData={settingsData}
          setSettingsData={setSettingsData}
          selectedNodeId={selectedNodeId}
          isEdgeConfirmed={isEdgeConfirmed}
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          handleNodeDelete={handleNodeDelete}
          setSelectedNodeId={setSelectedNodeId}
          setAddedParts={setAddedParts}
          updateEdgeLabels={updateEdgeLabels}
          focusField={focusField}
          findAllConnectedPartNodes={findAllConnectedPartNodes}
          handleEdgeDelete={handleEdgeDelete}
          handleNodeSettingsClick={handleNodeSettingsClick}
          handleNodeConfirm={handleNodeConfirm}
          rfInstance={rfInstance}
          formData={formData}
        />

        <PartsPanel
          patterns={patterns}
          nodes={nodes}
          onPartDragStart={onPartDragStart}
          onShowPartsListModal={() => setShowPartsListModal(true)}
        />
      </div>
    </div>
  )
}

// ReactFlowProvider로 감싸서 export
export default function RoutingTreeEditor() {
  return (
    <ReactFlowProvider>
      <EditorContent />
    </ReactFlowProvider>
  )
}