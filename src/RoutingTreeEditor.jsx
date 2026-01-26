import { useState, useRef, useEffect, useCallback } from 'react'
import Swal from 'sweetalert2'
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import useRoutingStore from './store/useRoutingStore'
import { showSmallAlert } from './utils'
import { NODE_WIDTH, NODE_HEIGHT, INITIAL_SETTINGS_DATA } from './constants'
import { PartNode, GroupConnectorNode } from './components/nodes'
import { CustomEdge } from './components/edges'
import { EditorHeader, EditorMetaBar, SettingsProcessPanel, PartsPanel } from './components/layout'
import PartsListModal from './components/modals/PartsListModal'
import './RoutingTreeEditor.css'

// 노드 및 엣지 타입 정의
const nodeTypes = {
  partNode: PartNode,
  groupConnector: GroupConnectorNode,
}

const edgeTypes = {
  custom: CustomEdge,
}

const nodeWidth = NODE_WIDTH
const nodeHeight = NODE_HEIGHT

// 내부 컴포넌트 분리 (Provider 사용을 위해)
function EditorContent() {
  const { formData, patterns, reorderPatterns, removePattern } = useRoutingStore()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [draggedPart, setDraggedPart] = useState(null)
  const [showPartsListModal, setShowPartsListModal] = useState(false)
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
  
  // React Flow 인스턴스 (좌표 변환용)
  const [rfInstance, setRfInstance] = useState(null)

  // 중복 호출 방지를 위한 ref
  const confirmingRef = useRef(new Set())

  // 저장 기능
  const handleSave = useCallback(() => {
    // 현재 상태 수집
    // formData를 명시적으로 복사하여 저장 (모든 필드 포함)
    const savedFormData = {
      fileName: formData?.fileName || '',
      model: formData?.model || '',
      devStyle: formData?.devStyle || '',
      category: formData?.category || '',
      size: formData?.size || ''
    }
    
    const saveData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      formData: savedFormData,
      patterns: patterns,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        draggable: node.draggable
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        data: edge.data,
        markerEnd: edge.markerEnd
      })),
      viewport: rfInstance ? rfInstance.getViewport() : null
    }

    // JSON 문자열로 변환
    const jsonString = JSON.stringify(saveData, null, 2)
    
    // Blob 생성
    const blob = new Blob([jsonString], { type: 'application/json' })
    
    // 유니크한 파일명 생성 (timestamp 기반)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const fileName = `routing-tree-${timestamp}.json`
    
    // 다운로드 링크 생성
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    // 성공 메시지 표시
    Swal.fire({
      title: 'Save Completed',
      text: `File saved as ${fileName}`,
      icon: 'success',
      confirmButtonColor: '#1f2937',
      width: '380px',
      padding: '20px',
      timer: 2000,
      showConfirmButton: false
    })
  }, [formData, patterns, nodes, edges, rfInstance])

  // settingsData가 변경될 때 ref 업데이트
  useEffect(() => {
    settingsDataRef.current = settingsData
  }, [settingsData])

  // addedParts가 변경될 때 ref 업데이트
  useEffect(() => {
    addedPartsRef.current = addedParts
  }, [addedParts])

  /* --------------------------------------------------------------
   * 연결된 모든 노드 찾기 (그룹 포함)
   * 노드 ID나 그룹 connector ID를 받아서 연결된 모든 일반 노드를 반환
   * --------------------------------------------------------------
   */
  // 확정된 그룹을 하나의 단위로 취급하는 함수
  const findAllConnectedNodesWithGroups = useCallback((startNodeId, currentNodes, currentEdges) => {
    // 안전성 체크
    if (!currentNodes || !Array.isArray(currentNodes) || !currentEdges || !Array.isArray(currentEdges)) {
      return []
    }

    // 그룹 connector 찾기 헬퍼
    const findGroupConnector = (nodeId) => {
      return currentNodes.find(n =>
        n && n.type === 'groupConnector' &&
        n.data?.isConfirmed === true &&
        !n.data?.hidden &&
        (n.data?.nodeIds?.includes(nodeId) || n.data?.nodeId === nodeId)
      )
    }

    // 재귀적으로 연결된 모든 노드/그룹 찾기 (확정된 그룹은 connector로 반환)
    const findConnectedNodes = (nodeId, visited = new Set(), visitedGroups = new Set()) => {
      const node = currentNodes.find(n => n.id === nodeId)
      if (!node) return []

      // 그룹 connector인 경우
      if (node.type === 'groupConnector' && node.data?.isConfirmed === true && !node.data?.hidden) {
        // 이미 방문한 그룹이면 스킵
        if (visitedGroups.has(nodeId)) return []
        visitedGroups.add(nodeId)

        // 그룹의 모든 노드를 방문한 것으로 표시
        const groupNodeIds = node.data?.nodeIds || [node.data?.nodeId].filter(Boolean)
        groupNodeIds.forEach(nId => visited.add(nId))

        // 그룹 connector를 결과에 추가
        const result = [node]

        // 그룹과 연결된 다른 노드/그룹 찾기
        currentEdges.forEach(edge => {
          if (!edge) return

          // edge의 source나 target이 그룹 connector ID인지 확인
          const isSourceConnector = edge.source === node.id
          const isTargetConnector = edge.target === node.id

          // edge의 source나 target이 그룹의 노드 ID인지 확인
          const isSourceInGroup = groupNodeIds.includes(edge.source)
          const isTargetInGroup = groupNodeIds.includes(edge.target)

          // 그룹 내부 edge는 제외 (source와 target 모두 그룹 내부에 있거나, connector와 그룹 노드를 연결하는 경우)
          if ((isSourceInGroup && isTargetInGroup) || (isSourceConnector && isTargetInGroup) || (isTargetConnector && isSourceInGroup)) {
            return
          }

          // 그룹과 외부 노드를 연결하는 edge만 처리
          if (isSourceConnector || isTargetConnector || isSourceInGroup || isTargetInGroup) {
            let nextNodeId = null
            if (isSourceConnector) {
              nextNodeId = edge.target
            } else if (isTargetConnector) {
              nextNodeId = edge.source
            } else if (isSourceInGroup) {
              nextNodeId = edge.target
            } else if (isTargetInGroup) {
              nextNodeId = edge.source
            }

            if (nextNodeId && !groupNodeIds.includes(nextNodeId) && nextNodeId !== node.id) {
              const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
              result.push(...nextNodes)
            }
          }
        })

        return result
      }

      // 확정된 그룹에 속한 노드인지 확인
      const groupConnector = findGroupConnector(nodeId)
      if (groupConnector) {
        // 이미 방문한 그룹이면 스킵
        if (visitedGroups.has(groupConnector.id)) {
          return []
        }
        visitedGroups.add(groupConnector.id)

        // 그룹의 모든 노드를 방문한 것으로 표시
        const groupNodeIds = groupConnector.data?.nodeIds || [groupConnector.data?.nodeId].filter(Boolean)
        groupNodeIds.forEach(nId => visited.add(nId))

        // 그룹 connector를 결과에 추가
        const result = [groupConnector]

        // 그룹과 연결된 다른 노드/그룹 찾기
        currentEdges.forEach(edge => {
          if (!edge) return

          // edge의 source나 target이 그룹 connector ID인지 확인
          const isSourceConnector = edge.source === groupConnector.id
          const isTargetConnector = edge.target === groupConnector.id

          // edge의 source나 target이 그룹의 노드 ID인지 확인
          const isSourceInGroup = groupNodeIds.includes(edge.source)
          const isTargetInGroup = groupNodeIds.includes(edge.target)

          // 그룹 내부 edge는 제외 (source와 target 모두 그룹 내부에 있거나, connector와 그룹 노드를 연결하는 경우)
          if ((isSourceInGroup && isTargetInGroup) || (isSourceConnector && isTargetInGroup) || (isTargetConnector && isSourceInGroup)) {
            return
          }

          // 그룹과 외부 노드를 연결하는 edge만 처리
          if (isSourceConnector || isTargetConnector || isSourceInGroup || isTargetInGroup) {
            let nextNodeId = null
            if (isSourceConnector) {
              nextNodeId = edge.target
            } else if (isTargetConnector) {
              nextNodeId = edge.source
            } else if (isSourceInGroup) {
              nextNodeId = edge.target
            } else if (isTargetInGroup) {
              nextNodeId = edge.source
            }

            if (nextNodeId && !groupNodeIds.includes(nextNodeId) && nextNodeId !== groupConnector.id) {
              const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
              result.push(...nextNodes)
            }
          }
        })

        return result
      }

      // 일반 노드인 경우
      if (visited.has(nodeId)) return []

      // 먼저 이 노드가 그룹에 속해 있는지 확인
      const nodeGroupConnector = findGroupConnector(nodeId)
      if (nodeGroupConnector) {
        // 이미 방문한 그룹이면 스킵
        if (visitedGroups.has(nodeGroupConnector.id)) {
          return []
        }
        visitedGroups.add(nodeGroupConnector.id)

        // 그룹의 모든 노드를 방문한 것으로 표시
        const groupNodeIds = nodeGroupConnector.data?.nodeIds || [nodeGroupConnector.data?.nodeId].filter(Boolean)
        groupNodeIds.forEach(nId => visited.add(nId))

        // 그룹 connector를 결과에 추가
        const result = [nodeGroupConnector]

        // 그룹과 연결된 다른 노드/그룹 찾기
        currentEdges.forEach(edge => {
          if (!edge) return

          // edge의 source나 target이 그룹 connector ID인지 확인
          const isSourceConnector = edge.source === nodeGroupConnector.id
          const isTargetConnector = edge.target === nodeGroupConnector.id

          // edge의 source나 target이 그룹의 노드 ID인지 확인
          const isSourceInGroup = groupNodeIds.includes(edge.source)
          const isTargetInGroup = groupNodeIds.includes(edge.target)

          // 그룹 내부 edge는 제외 (source와 target 모두 그룹 내부에 있거나, connector와 그룹 노드를 연결하는 경우)
          if ((isSourceInGroup && isTargetInGroup) || (isSourceConnector && isTargetInGroup) || (isTargetConnector && isSourceInGroup)) {
            return
          }

          // 그룹과 외부 노드를 연결하는 edge만 처리
          if (isSourceConnector || isTargetConnector || isSourceInGroup || isTargetInGroup) {
            let nextNodeId = null
            if (isSourceConnector) {
              nextNodeId = edge.target
            } else if (isTargetConnector) {
              nextNodeId = edge.source
            } else if (isSourceInGroup) {
              nextNodeId = edge.target
            } else if (isTargetInGroup) {
              nextNodeId = edge.source
            }

            if (nextNodeId && !groupNodeIds.includes(nextNodeId) && nextNodeId !== nodeGroupConnector.id) {
              const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
              result.push(...nextNodes)
            }
          }
        })

        return result
      }

      // 그룹에 속하지 않은 일반 노드인 경우
      visited.add(nodeId)
      const result = [node]

      // 직접 연결된 노드 찾기
      currentEdges.forEach(edge => {
        if (!edge) return
        if (edge.source === nodeId || edge.target === nodeId) {
          const nextNodeId = edge.source === nodeId ? edge.target : edge.source
          const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
          if (nextNodes && Array.isArray(nextNodes)) {
            result.push(...nextNodes)
          }
        }
      })

      return result
    }

    const allNodes = findConnectedNodes(startNodeId)
    // 중복 제거
    if (!allNodes || !Array.isArray(allNodes)) {
      return []
    }
    const uniqueNodes = Array.from(new Map(allNodes.filter(n => n && n.id).map(n => [n.id, n])).values())
    // partNode와 groupConnector 모두 반환 (확정된 그룹은 connector로 대체)
    const filtered = uniqueNodes.filter(n => n && (n.type === 'partNode' || n.type === 'groupConnector'))
    return filtered
  }, [])

  const findAllConnectedPartNodes = useCallback((startNodeId, currentNodes, currentEdges) => {
    // 안전성 체크
    if (!currentNodes || !Array.isArray(currentNodes) || !currentEdges || !Array.isArray(currentEdges)) {
      return []
    }

    // 그룹 connector 찾기 헬퍼
    const findGroupConnector = (nodeId) => {
      return currentNodes.find(n =>
        n && n.type === 'groupConnector' &&
        n.data?.isConfirmed === true &&
        !n.data?.hidden &&
        (n.data?.nodeIds?.includes(nodeId) || n.data?.nodeId === nodeId)
      )
    }

    // 그룹 내부의 모든 일반 노드 찾기
    const getGroupPartNodes = (connectorId) => {
      const connector = currentNodes.find(n => n && n.id === connectorId)
      if (!connector || connector.type !== 'groupConnector') return []

      const groupNodeIds = connector.data?.nodeIds || (connector.data?.nodeId ? [connector.data.nodeId] : [])
      if (!Array.isArray(groupNodeIds)) return []

      return currentNodes.filter(n =>
        n && n.type === 'partNode' && groupNodeIds.includes(n.id)
      )
    }

    // 재귀적으로 연결된 모든 노드 찾기
    const findConnectedNodes = (nodeId, visited = new Set(), visitedGroups = new Set()) => {
      if (visited.has(nodeId)) return []

      const node = currentNodes.find(n => n.id === nodeId)
      if (!node) return []

      // 그룹 connector인 경우
      if (node.type === 'groupConnector') {
        if (visitedGroups.has(nodeId)) return []
        visitedGroups.add(nodeId)

        const partNodes = getGroupPartNodes(nodeId)
        const result = [...partNodes]

        // 그룹과 연결된 다른 노드/그룹 찾기
        currentEdges.forEach(edge => {
          if (!edge) return
          const groupNodeIds = node.data?.nodeIds || (node.data?.nodeId ? [node.data.nodeId] : [])
          if (!Array.isArray(groupNodeIds)) return
          const isSourceInGroup = groupNodeIds.includes(edge.source)
          const isTargetInGroup = groupNodeIds.includes(edge.target)

          if (isSourceInGroup || isTargetInGroup) {
            const nextNodeId = isSourceInGroup ? edge.target : edge.source
            const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
            result.push(...nextNodes)
          }
        })

        return result
      }

      // 일반 노드인 경우
      visited.add(nodeId)
      const result = [node]

      // 그룹에 속해 있는지 확인
      const groupConnector = findGroupConnector(nodeId)
      if (groupConnector && !visitedGroups.has(groupConnector.id)) {
        visitedGroups.add(groupConnector.id)
        const groupPartNodes = getGroupPartNodes(groupConnector.id)
        if (groupPartNodes && Array.isArray(groupPartNodes)) {
          result.push(...groupPartNodes.filter(n => n && n.id !== nodeId))
        }

        // 그룹과 연결된 다른 노드/그룹 찾기
        currentEdges.forEach(edge => {
          if (!edge) return
          const groupNodeIds = groupConnector.data?.nodeIds || (groupConnector.data?.nodeId ? [groupConnector.data.nodeId] : [])
          if (!Array.isArray(groupNodeIds)) return
          const isSourceInGroup = groupNodeIds.includes(edge.source)
          const isTargetInGroup = groupNodeIds.includes(edge.target)

          if (isSourceInGroup || isTargetInGroup) {
            const nextNodeId = isSourceInGroup ? edge.target : edge.source
            if (!groupNodeIds.includes(nextNodeId)) {
              const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
              result.push(...nextNodes)
            }
          }
        })
      } else {
        // 직접 연결된 노드 찾기
        currentEdges.forEach(edge => {
          if (!edge) return
          if (edge.source === nodeId || edge.target === nodeId) {
            const nextNodeId = edge.source === nodeId ? edge.target : edge.source
            const nextNodes = findConnectedNodes(nextNodeId, visited, visitedGroups)
            if (nextNodes && Array.isArray(nextNodes)) {
              result.push(...nextNodes)
            }
          }
        })
      }

      return result
    }

    const allNodes = findConnectedNodes(startNodeId)
    // 중복 제거
    if (!allNodes || !Array.isArray(allNodes)) {
      return []
    }
    const uniqueNodes = Array.from(new Map(allNodes.filter(n => n && n.id).map(n => [n.id, n])).values())
    // partNode와 groupConnector 모두 반환 (확정된 그룹은 connector로 대체)
    return uniqueNodes.filter(n => n && (n.type === 'partNode' || n.type === 'groupConnector'))
  }, [])

  /* --------------------------------------------------------------
   * 노드/그룹 설정 패널 열기
   * nodeId가 그룹 connector인 경우 그룹 정보 표시
   * --------------------------------------------------------------
   */
  const handleNodeSettingsClick = useCallback((nodeId) => {
    console.log('handleNodeSettingsClick:', nodeId)
    setNodes((currentNodes) => {
      // edge ID인지 확인 (edge ID는 currentEdges에서 찾을 수 있음)
      setEdges((currentEdges) => {
        const targetEdge = currentEdges.find(e => e.id === nodeId)

        // edge인 경우 edge의 savedSettings 사용
        if (targetEdge) {
          const addedParts = []

          // 설정 패널 열기
          setSelectedNodeId(nodeId)
          setShowSettingsPanel(true)

          // edge의 확정 상태 확인
          setIsEdgeConfirmed(targetEdge.data?.isConfirmed === true)

          // edge의 savedSettings 불러오기 (isConfirmed 여부와 관계없이 savedSettings가 있으면 불러오기)
          if (targetEdge.data?.savedSettings && Object.keys(targetEdge.data.savedSettings).length > 0) {
            // savedSettings에서 addedPartsIds 확인
            const { addedPartsIds, ...settingsData } = targetEdge.data.savedSettings

            // 설정 데이터 설정
            setSettingsData(settingsData)

            // addedPartsIds가 있으면 저장된 노드 ID로 addedParts 설정
            if (addedPartsIds && Array.isArray(addedPartsIds) && addedPartsIds.length > 0) {
              // 저장된 노드 ID로 노드 찾기
              const savedAddedParts = currentNodes.filter(n =>
                n && addedPartsIds.includes(n.id) && (n.type === 'partNode' || n.type === 'groupConnector')
              )
              setAddedParts(savedAddedParts)
            } else {
              // addedPartsIds가 없으면 모든 연결된 노드 찾기
              // 그룹 경계를 존중하여 확정된 그룹은 connector로 반환
              const sourceNode = currentNodes.find(n => n && n.id === targetEdge.source)
              const targetNode = currentNodes.find(n => n && n.id === targetEdge.target)

              // source나 target이 groupConnector인 경우
              if (sourceNode && sourceNode.type === 'groupConnector') {
                // groupConnector를 직접 추가
                const addedParts = [sourceNode]
                if (targetNode && targetNode.type === 'partNode' && targetNode.id !== sourceNode.id) {
                  addedParts.push(targetNode)
                }
                setAddedParts(addedParts)
              } else if (targetNode && targetNode.type === 'groupConnector') {
                // groupConnector를 직접 추가
                const addedParts = [targetNode]
                if (sourceNode && sourceNode.type === 'partNode' && sourceNode.id !== targetNode.id) {
                  addedParts.push(sourceNode)
                }
                setAddedParts(addedParts)
              } else if (sourceNode && sourceNode.type === 'partNode') {
                // findAllConnectedNodesWithGroups 사용 (그룹 경계 존중)
                const allConnectedNodes = findAllConnectedNodesWithGroups(sourceNode.id, currentNodes, currentEdges)
                if (allConnectedNodes && Array.isArray(allConnectedNodes) && allConnectedNodes.length > 0) {
                  // partNode와 groupConnector 모두 포함
                  setAddedParts(allConnectedNodes.filter(n =>
                    n && (n.type === 'partNode' || n.type === 'groupConnector')
                  ))
                } else {
                  // fallback: source/target만 사용
                  const fallbackParts = []
                  if (sourceNode) fallbackParts.push(sourceNode)
                  if (targetNode && targetNode.type === 'partNode' && !fallbackParts.some(p => p.id === targetNode.id)) {
                    fallbackParts.push(targetNode)
                  }
                  setAddedParts(fallbackParts)
                }
              } else {
                // source가 partNode가 아니면 source/target만 사용
                const fallbackParts = []
                if (sourceNode) fallbackParts.push(sourceNode)
                if (targetNode && !fallbackParts.some(p => p.id === targetNode.id)) {
                  fallbackParts.push(targetNode)
                }
                setAddedParts(fallbackParts)
              }
            }

            return currentEdges
          } else {
            // savedSettings가 없으면 모든 연결된 노드 찾기 (확정되지 않은 그룹)
            // 그룹 경계를 존중하여 확정된 그룹은 connector로 반환
            setSettingsData(INITIAL_SETTINGS_DATA)

            const sourceNode = currentNodes.find(n => n && n.id === targetEdge.source)
            const targetNode = currentNodes.find(n => n && n.id === targetEdge.target)

            // source나 target이 groupConnector인 경우
            if (sourceNode && sourceNode.type === 'groupConnector') {
              // groupConnector를 직접 추가
              const addedParts = [sourceNode]
              if (targetNode && targetNode.type === 'partNode' && targetNode.id !== sourceNode.id) {
                addedParts.push(targetNode)
              }
              setAddedParts(addedParts)
            } else if (targetNode && targetNode.type === 'groupConnector') {
              // groupConnector를 직접 추가
              const addedParts = [targetNode]
              if (sourceNode && sourceNode.type === 'partNode' && sourceNode.id !== targetNode.id) {
                addedParts.push(sourceNode)
              }
              setAddedParts(addedParts)
            } else if (sourceNode && sourceNode.type === 'partNode') {
              // findAllConnectedNodesWithGroups 사용 (그룹 경계 존중)
              const allConnectedNodes = findAllConnectedNodesWithGroups(sourceNode.id, currentNodes, currentEdges)
              if (allConnectedNodes && Array.isArray(allConnectedNodes) && allConnectedNodes.length > 0) {
                // partNode와 groupConnector 모두 포함
                setAddedParts(allConnectedNodes.filter(n =>
                  n && (n.type === 'partNode' || n.type === 'groupConnector')
                ))
              } else {
                // fallback: source/target만 사용
                const fallbackParts = []
                if (sourceNode) fallbackParts.push(sourceNode)
                if (targetNode && targetNode.type === 'partNode' && !fallbackParts.some(p => p.id === targetNode.id)) {
                  fallbackParts.push(targetNode)
                }
                setAddedParts(fallbackParts)
              }
            } else {
              // source가 partNode가 아니면 source/target만 사용
              const fallbackParts = []
              if (sourceNode) fallbackParts.push(sourceNode)
              if (targetNode && !fallbackParts.some(p => p.id === targetNode.id)) {
                fallbackParts.push(targetNode)
              }
              setAddedParts(fallbackParts)
            }
          }

          return currentEdges
        }

        // node인 경우 기존 로직
      const node = currentNodes.find(n => n.id === nodeId)
        if (!node) {
          return currentEdges
        }
      
      // 설정 패널 열기
      setSelectedNodeId(nodeId)
      setShowSettingsPanel(true)
      
        // edge가 아닌 경우 isEdgeConfirmed를 false로 설정
        setIsEdgeConfirmed(false)

        // 그룹 connector인 경우 그룹 정보 표시
        if (node.type === 'groupConnector') {
          // 그룹 connector인 경우 항상 그룹에 속한 노드만 표시
          if (node.data?.isGroupBox && node.data?.isConfirmed) {
            // 저장된 설정이 있고 addedParts 정보가 있으면 로직 건너뛰고 저장된 값 사용
            if (node.data?.savedSettings &&
              Object.keys(node.data.savedSettings).length > 0 &&
              node.data?.savedSettings?.addedPartsIds &&
              Array.isArray(node.data.savedSettings.addedPartsIds) &&
              node.data.savedSettings.addedPartsIds.length > 0) {
              // 저장된 설정 데이터 사용
              const { addedPartsIds, ...settingsData } = node.data.savedSettings
              setSettingsData(settingsData)

              // 저장된 addedPartsIds로 노드 찾기
              const savedAddedParts = currentNodes.filter(n =>
                n && addedPartsIds.includes(n.id) && n.type === 'partNode'
              )
              setAddedParts(savedAddedParts)
            } else {
              // 저장된 값이 없으면 기존 로직 진행
              // 그룹에 속한 노드 찾기 (partNode만, edge ID 제외)
              const groupNodeIds = (node.data?.nodeIds || []).filter(id => {
                // edge ID인지 확인 (edge ID는 'edge-'로 시작)
                if (typeof id === 'string' && id.startsWith('edge-')) {
                  return false
                }
                // partNode인지 확인
                const targetNode = currentNodes.find(n => n && n.id === id && n.type === 'partNode')
                return targetNode !== undefined
              })
              const groupPartNodes = currentNodes.filter(n =>
                n && n.type === 'partNode' && groupNodeIds.includes(n.id)
              )

              // 그룹의 저장된 설정 불러오기 (그룹 단위 정보 관리)
              if (node.data?.savedSettings && Object.keys(node.data.savedSettings).length > 0) {
                setSettingsData(node.data.savedSettings)
              } else {
                setSettingsData(INITIAL_SETTINGS_DATA)
              }

              // 그룹에 속한 노드를 addedParts에 추가
              if (groupPartNodes && Array.isArray(groupPartNodes) && groupPartNodes.length > 0) {
                setAddedParts(groupPartNodes)
              } else {
                setAddedParts([])
              }
            }
          } else {
            // 확정되지 않은 그룹 connector인 경우
            setSettingsData(INITIAL_SETTINGS_DATA)
            setAddedParts([])
          }
        } else {
          // 일반 노드인 경우 기존 로직
          // 연결된 모든 일반 노드 찾기
          const connectedPartNodes = findAllConnectedPartNodes(nodeId, currentNodes, currentEdges)
        
        // 저장된 설정 불러오기
        if (node.data?.savedSettings && Object.keys(node.data.savedSettings).length > 0) {
          setSettingsData(node.data.savedSettings)
        } else {
          setSettingsData(INITIAL_SETTINGS_DATA)
        }
        
          // 연결된 모든 노드를 addedParts에 추가
          if (connectedPartNodes && Array.isArray(connectedPartNodes) && connectedPartNodes.length > 0) {
            setAddedParts(connectedPartNodes)
          } else {
            setAddedParts([node])
          }
        }
        return currentEdges
      })
      
      return currentNodes
    })
  }, [setNodes, setEdges, findAllConnectedPartNodes, findAllConnectedNodesWithGroups])

  /* --------------------------------------------------------------
   * 노드 Step Value 변경 핸들러
   * --------------------------------------------------------------
   */
  const handleNodeStepChange = useCallback((id, value) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, stepValue: value } }
        }
        return node
      })
    )
  }, [setNodes])

  /* --------------------------------------------------------------
   * 노드 삭제 핸들러
   * --------------------------------------------------------------
   */
  const handleNodeDelete = useCallback((id) => {
    setNodes((nds) => {
      // 노드 삭제
      const filteredNodes = nds.filter((node) => node.id !== id)
      
      // 파츠 노드만 필터링 (groupConnector 제외)
      const partNodes = filteredNodes.filter(n => n && n.type === 'partNode')
      
      // 파츠 노드 번호 재정렬
      const updatedNodes = filteredNodes.map(node => {
        if (node && node.type === 'partNode') {
          const nodeIndex = partNodes.findIndex(n => n.id === node.id)
          const nodeNumber = nodeIndex + 1
          return {
            ...node,
            data: {
              ...node.data,
              number: nodeNumber
            }
          }
        }
        return node
      })
      
      return updatedNodes
    })
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id))
    
    if (selectedNodeId === id) {
      setShowSettingsPanel(false)
      setSelectedNodeId(null)
    }
  }, [setNodes, setEdges, selectedNodeId])

  /* --------------------------------------------------------------
   * Edge 삭제 핸들러
   * --------------------------------------------------------------
   */
  const handleEdgeDelete = useCallback((edgeId) => {
    setEdges((eds) => {
      const edge = eds.find(e => e.id === edgeId)
      if (!edge) return eds

      // edge 삭제
      const updatedEdges = eds.filter((e) => e.id !== edgeId)

      // edge 삭제 후 연결된 노드들의 hasConnectedEdge 상태 업데이트
      setNodes((nds) => {
        return nds.map(node => {
          // source나 target 노드인 경우 hasConnectedEdge 재확인
          if (node.id === edge.source || node.id === edge.target) {
            const hasOtherEdges = updatedEdges.some(e =>
              e.source === node.id || e.target === node.id
            )
            return {
              ...node,
              data: {
                ...node.data,
                hasConnectedEdge: hasOtherEdges
              }
            }
          }
          return node
        })
      })

      return updatedEdges
    })
  }, [setNodes, setEdges, findAllConnectedNodesWithGroups, setIsEdgeConfirmed])

  /* --------------------------------------------------------------
   * 노드 편집(Edit) 핸들러
   * 확정된 그룹을 편집 가능한 상태로 전환
   * --------------------------------------------------------------
   */
  const handleNodeEdit = useCallback((id) => {
    // 함수형 업데이트를 사용하여 최신 상태 가져오기
    setEdges((eds) => {
      // edge ID인지 확인
      const targetEdge = eds.find(e => e.id === id)

      if (targetEdge) {
        // edge 편집 처리: 확정 시 저장된 addedPartsIds를 기반으로 편집 가능한 노드 결정
        setNodes((nds) => {
          // 편집 대상 노드 ID 집합
          const editableNodeIds = new Set()

          // savedSettings에서 addedPartsIds 가져오기
          // 해결책 2: connector ID 필터링 (partNode만 editableNodeIds에 추가)
          if (targetEdge.data?.savedSettings?.addedPartsIds && Array.isArray(targetEdge.data.savedSettings.addedPartsIds)) {
            // 저장된 addedPartsIds에서 partNode만 편집 대상으로 설정 (connector ID 제외)
            targetEdge.data.savedSettings.addedPartsIds.forEach(nodeId => {
              const node = nds.find(n => n && n.id === nodeId)
              if (node && node.type === 'partNode') {
                editableNodeIds.add(nodeId) // partNode만 추가
              }
              // connector ID는 무시 (그룹 단위 정보 관리)
            })
          } else {
            // savedSettings가 없거나 addedPartsIds가 없으면 source/target만 사용 (fallback)
            const sourceNode = nds.find(n => n && n.id === targetEdge.source)
            const targetNode = nds.find(n => n && n.id === targetEdge.target)

            if (sourceNode && sourceNode.type === 'partNode') {
              editableNodeIds.add(sourceNode.id)
            }
            if (targetNode && targetNode.type === 'partNode') {
              editableNodeIds.add(targetNode.id)
            }
          }

          // 편집 대상 노드와 연결된 edge 찾기 (다른 확정된 그룹의 edge는 제외)
          const editableEdges = eds.filter(edge => {
            const isSourceEditable = editableNodeIds.has(edge.source)
            const isTargetEditable = editableNodeIds.has(edge.target)

            // 편집 대상 노드와 연결된 edge만 포함
            if (isTargetEditable) {
              // 다른 확정된 그룹의 edge인지 확인
              const edgeTargetNode = nds.find(n => n && n.id === edge.target)

              // source나 target이 확정된 그룹 connector면 제외
              if (edgeTargetNode?.type === 'groupConnector' && edgeTargetNode.data?.isConfirmed === true && !edgeTargetNode.data?.hidden) {
                return false
              }
              return true
            }

            if (isSourceEditable) {
              const edgeSourceNode = nds.find(n => n && n.id === edge.source)

              if (edgeSourceNode?.type === 'groupConnector' && edgeSourceNode.data?.isConfirmed === true && !edgeSourceNode.data?.hidden) {
                return false
              }
              return true
            }
            return false
          })

          const editableEdgeIds = new Set(editableEdges.map(e => e.id))

          // 그룹 정보 생성
          const sortedNodeIds = Array.from(editableNodeIds).sort()
          const groupId = `group-${sortedNodeIds.join('-')}`

          // 편집 대상 edge들이 속한 그룹의 connector ID 수집
          // targetEdge의 savedSettings에서 groupId나 connectorId를 먼저 확인
          const targetGroupId = targetEdge.data?.savedSettings?.groupId
          const targetConnectorId = targetEdge.data?.savedSettings?.connectorId

          const editableConnectorIds = new Set()

          // 방법 1: savedSettings에 저장된 connectorId나 groupId로 직접 찾기 (가장 정확)
          if (targetConnectorId || targetGroupId) {
            nds.forEach(node => {
              if (node && node.type === 'groupConnector') {
                if (node.id === targetConnectorId || node.data?.groupId === targetGroupId) {
                  editableConnectorIds.add(node.id)
                }
              }
            })
          }

          // 방법 2: groupEdges를 기반으로 찾기 (fallback, savedSettings가 없는 경우)
          if (editableConnectorIds.size === 0) {
            nds.forEach(node => {
              if (node && node.type === 'groupConnector' && node.data?.groupEdges) {
                // connector의 groupEdges와 editableEdgeIds가 완전히 일치하면 해당 connector
                // 단, 다른 그룹의 edge와 겹치지 않도록 정확히 일치하는지 확인
                const connectorEdgeIds = new Set(node.data.groupEdges)
                const editableEdgeIdsSet = new Set(editableEdgeIds)
                const isExactMatch =
                  connectorEdgeIds.size === editableEdgeIdsSet.size &&
                  Array.from(connectorEdgeIds).every(edgeId => editableEdgeIdsSet.has(edgeId))

                if (isExactMatch) {
                  editableConnectorIds.add(node.id)
                }
              }
            })
          }

          // 하위 그룹 connector 보임 처리 (addedPartsIds에 포함된 그룹 connector)
          const childGroupConnectorIds = new Set()
          if (targetEdge.data?.savedSettings?.addedPartsIds && Array.isArray(targetEdge.data.savedSettings.addedPartsIds)) {
            targetEdge.data.savedSettings.addedPartsIds.forEach(nodeId => {
              const node = nds.find(n => n && n.id === nodeId)
              if (node && node.type === 'groupConnector') {
                childGroupConnectorIds.add(nodeId)
              }
            })
          }

          // 그룹 내 모든 노드를 편집 가능한 상태로 변경 (확정된 그룹에 속한 노드 제외)
          const updatedNodes = nds.map(node => {
            // 편집 대상 노드만 활성화
            if (editableNodeIds.has(node.id)) {
              return {
                ...node,
                draggable: true,
                data: {
                  ...node.data,
                  isConfirmed: false
                }
              }
            }
            // 그룹 connector 처리
            if (node.type === 'groupConnector') {
              // 하위 그룹 connector 보임 처리 (편집 모드로 전환되면 하위 그룹도 보여줌)
              if (childGroupConnectorIds.has(node.id)) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    hidden: false, // 하위 그룹 connector 보임
                    isConfirmed: node.data?.isConfirmed || false // 확정 상태 유지
                  }
                }
              }
              // 방법 1: connector ID로 직접 확인 (가장 정확) - 편집 대상 그룹의 connector 숨김
              if (editableConnectorIds.has(node.id)) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    hidden: true,
                    // isConfirmed 상태 유지 (updateEdgeLabels에서 제외되지 않도록)
                    isConfirmed: node.data?.isConfirmed || false
                  }
                }
              }
              // 방법 2: nodeIds로 확인 (fallback, 단일 노드 connector용)
              if (node.data?.nodeIds) {
                const connectorNodeIds = node.data.nodeIds || []
                if (connectorNodeIds.some(nId => editableNodeIds.has(nId))) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      hidden: true,
                      // isConfirmed 상태 유지
                      isConfirmed: node.data?.isConfirmed || false
                    }
                  }
                }
              }
              if (node.data?.nodeId && editableNodeIds.has(node.data.nodeId)) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    hidden: true,
                    // isConfirmed 상태 유지
                    isConfirmed: node.data?.isConfirmed || false
                  }
                }
              }
            }
            return node
          }).filter(Boolean)

          // isEdgeConfirmed를 먼저 false로 설정 (쓰기 모드)
          setIsEdgeConfirmed(false)

          // 편집 모드로 전환한 edge의 설정패널 열기 (updatedNodes 사용)
          const editedEdge = eds.find(e => e.id === id)
          if (editedEdge && editedEdge.data?.savedSettings) {
            // 저장된 설정 불러오기
            const { addedPartsIds, ...settingsData } = editedEdge.data.savedSettings
            setSettingsData(settingsData)

            // addedPartsIds가 있으면 저장된 노드 ID로 addedParts 설정
            // updatedNodes에서 최신 노드 객체 가져오기 (isConfirmed: false로 업데이트된 노드)
            if (addedPartsIds && Array.isArray(addedPartsIds) && addedPartsIds.length > 0) {
              const savedAddedParts = updatedNodes.filter(n =>
                n && addedPartsIds.includes(n.id) && (n.type === 'partNode' || n.type === 'groupConnector')
              )
              setAddedParts(savedAddedParts)
            } else {
              // addedPartsIds가 없으면 source/target으로 설정
              const addedParts = []
              const sourceNode = updatedNodes.find(n => n && n.id === editedEdge.source)
              const targetNode = updatedNodes.find(n => n && n.id === editedEdge.target)

              if (sourceNode && (sourceNode.type === 'partNode' || sourceNode.type === 'groupConnector')) {
                addedParts.push(sourceNode)
              }
              if (targetNode && (targetNode.type === 'partNode' || targetNode.type === 'groupConnector')) {
                if (!addedParts.some(p => p.id === targetNode.id)) {
                  addedParts.push(targetNode)
                }
              }
              setAddedParts(addedParts)
            }

            // 설정패널 열기
            setSelectedNodeId(id)
            setShowSettingsPanel(true)
          }

          // 그룹 edge를 편집 가능한 상태로 변경 (savedSettings 유지)
          setTimeout(() => {
            setEdges((currentEdges) => {
              return currentEdges.map(edge => {
                if (editableEdgeIds.has(edge.id)) {
                  return {
                    ...edge,
                    data: {
                      ...edge.data,
                      isConfirmed: false,
                      // savedSettings는 유지 (편집 모드에서도 저장된 설정 사용)
                      savedSettings: edge.data?.savedSettings
                    }
                  }
                }
                return edge
              })
            })
          }, 0)

          return updatedNodes
        })

        return eds
      }

      // 노드 편집 처리: 단일 노드만 편집 (hasConnectedEdge: false인 노드만 편집 아이콘 표시)
      setNodes((nds) => {
        const startNode = nds.find(n => n.id === id)
        if (!startNode || startNode.type !== 'partNode') {
          return nds
        }

        // 단일 노드만 편집 가능한 상태로 변경
        return nds.map(node => {
          if (node.id === id) {
            return {
              ...node,
              draggable: true,
              data: {
                ...node.data,
                isConfirmed: false
              }
            }
          }
          // 단일 노드 connector 숨김 처리
          if (node.type === 'groupConnector' && node.data?.nodeId === id) {
            return {
              ...node,
              data: {
                ...node.data,
                hidden: true
              }
            }
          }
          return node
        })
      })
      return eds
    })
  }, [setNodes, setEdges, setIsEdgeConfirmed])

  /* --------------------------------------------------------------
   * Edge 라벨 및 그룹 연결포인트 업데이트
   * 다른 함수들보다 먼저 정의되어야 함 (의존성 체인)
   * --------------------------------------------------------------
   */
  const updateEdgeLabels = useCallback((currentEdges, currentNodes, rfInst = null, handleEdgeDeleteFn = null, handleNodeSettingsClickFn = null, handleNodeConfirmFn = null) => {
    // 안전성 체크
    if (!currentEdges || !Array.isArray(currentEdges) || !currentNodes || !Array.isArray(currentNodes)) {
      return { updatedEdges: currentEdges || [], groupConnectorNodes: [] }
    }

    // 확정된 그룹 연결포인트 찾기
    // hidden: true인 connector도 포함 (편집 모드에서 숨겨진 connector 유지)
    const confirmedConnectors = currentNodes.filter(
      node => node && node.type === 'groupConnector' &&
        node.data?.isConfirmed === true
      // hidden 상태와 관계없이 모든 확정된 connector 포함
    )

    // 확정된 그룹 정보 수집
    const confirmedGroups = new Map()
    confirmedConnectors.forEach(connector => {
      if (connector.data?.isGroupBox && connector.data?.groupEdges) {
        const groupId = connector.data.groupId || `group-${connector.id}`
        confirmedGroups.set(groupId, {
          connectorId: connector.id,
          connector,
          groupEdges: connector.data.groupEdges,
          level: connector.data.level || 1,
          nodeIds: connector.data.nodeIds || []
        })
      } else if (connector.data?.nodeId) {
        const groupId = `single-node-${connector.data.nodeId}`
        confirmedGroups.set(groupId, {
          connectorId: connector.id,
          connector,
          groupEdges: [],
          level: connector.data.level || 1,
          nodeIds: [connector.data.nodeId]
        })
      }
    })

    // 확정된 그룹에 속한 edge ID 수집
    const confirmedEdgeIds = new Set()
    confirmedGroups.forEach(group => {
      group.groupEdges.forEach(edgeId => confirmedEdgeIds.add(edgeId))
    })

    // 확정된 그룹에 속한 노드 ID 수집
    const confirmedNodeIds = new Set()
    confirmedGroups.forEach(group => {
      group.nodeIds.forEach(nodeId => confirmedNodeIds.add(nodeId))
    })

    // 확정되지 않은 edge만 그룹화
    const unconfirmedEdges = currentEdges.filter(edge => !confirmedEdgeIds.has(edge.id))

    // 재귀적으로 연결된 edge 찾기
    const findConnectedEdges = (startNodeId, visited = new Set()) => {
      if (visited.has(startNodeId)) return []
      visited.add(startNodeId)

      // 확정된 그룹에 속한 노드면 중단
      if (confirmedNodeIds.has(startNodeId)) return []

      const connected = []
      unconfirmedEdges.forEach(edge => {
        if (edge.source === startNodeId || edge.target === startNodeId) {
          connected.push(edge)
          const nextNodeId = edge.source === startNodeId ? edge.target : edge.source
          connected.push(...findConnectedEdges(nextNodeId, visited))
        }
      })
      return connected
    }

    // Edge 그룹화
    const edgeGroups = []
    const processedEdgeIds = new Set()

    unconfirmedEdges.forEach(edge => {
      if (processedEdgeIds.has(edge.id)) return

      const groupEdges = findConnectedEdges(edge.source)
      const uniqueEdges = Array.from(new Map(groupEdges.map(e => [e.id, e])).values())

      uniqueEdges.forEach(e => processedEdgeIds.add(e.id))

      if (uniqueEdges.length > 0) {
        edgeGroups.push(uniqueEdges)
      }
    })

    // 확정된 그룹도 edgeGroups에 추가 (독립적으로 관리)
    confirmedGroups.forEach((group, groupId) => {
      if (group.groupEdges.length > 0) {
        const groupEdges = currentEdges.filter(e => group.groupEdges.includes(e.id))
        if (groupEdges.length > 0) {
          edgeGroups.push(groupEdges)
        }
      }
    })

    // showLabel 관리: 확정된 edge의 showLabel은 절대 변경하지 않음
    const updatedEdges = currentEdges.map(edge => {
      // edge에 핸들러 추가 (없는 경우에만)
      const edgeData = {
        ...edge.data
      }

      // 핸들러가 없으면 추가 (확정된 edge도 포함)
      if (handleEdgeDeleteFn && !edgeData.onDelete) {
        edgeData.onDelete = handleEdgeDeleteFn
      }
      if (handleNodeSettingsClickFn) {
        // onSettingsClick 핸들러는 항상 최신으로 업데이트 (edge의 savedSettings를 사용하기 위해)
        // CustomEdge에서 edge.id를 파라미터로 전달하므로, 이를 그대로 사용
        edgeData.onSettingsClick = (edgeId) => {
          // edgeId가 전달되지 않으면 edge.id 사용
          const targetEdgeId = edgeId || edge.id
          handleNodeSettingsClickFn(targetEdgeId)
        }
      }

      // onConfirm 핸들러는 항상 최신 핸들러로 업데이트 (onConnect에서 생성된 edge의 잘못된 핸들러 덮어쓰기)
      if (handleNodeConfirmFn) {
        edgeData.onConfirm = () => {
          handleNodeConfirmFn(edge.id) // 기존에는 노드를 찾아 넘겼으나, 이제 엣지 ID를 직접 넘김
        }
      }

      // 확정된 edge는 showLabel 유지 (그룹 단위 정보 관리)
      // 확정된 edge의 showLabel은 절대 변경하지 않음
      if (edge.data?.isConfirmed) {
        return {
          ...edge,
          data: {
            ...edgeData,
            isConfirmed: true, // 확정 상태 유지
            showLabel: edge.data?.showLabel !== undefined ? edge.data.showLabel : true, // showLabel 명시적으로 유지
            savedSettings: edge.data?.savedSettings || edgeData.savedSettings // 저장된 설정 유지
          }
        }
      }

      // 그룹 내에서 showLabel 결정
      // 여러 노드가 연결된 경우: 그룹 내 하나의 edge만 showLabel: true, 나머지는 false
      let shouldShowLabel = false
      let isInGroup = false

      for (const group of edgeGroups) {
        if (group.some(e => e.id === edge.id)) {
          isInGroup = true

          // 그룹 내 확정된 edge 중 showLabel: true인 것이 있으면 유지
          const confirmedWithLabel = group.find(
            e => e.data?.isConfirmed && e.data?.showLabel === true
          )
          if (confirmedWithLabel) {
            shouldShowLabel = edge.id === confirmedWithLabel.id
            break
          }

          // 확정되지 않은 그룹: 기존에 showLabel: true였던 edge가 있으면 유지
          if (!group.some(e => e.data?.isConfirmed)) {
            const existingLabelEdge = group.find(e => e.data?.showLabel === true)
            if (existingLabelEdge) {
              // 기존에 showLabel: true였던 edge가 있으면 그것을 유지
              shouldShowLabel = edge.id === existingLabelEdge.id
            } else {
              // 기존에 showLabel: true였던 edge가 없으면 첫 번째 edge에만 라벨 표시
              // 그룹 내 여러 edge가 있으면 하나만 표시, 나머지는 숨김
              shouldShowLabel = group[0]?.id === edge.id
            }
          }
          break
        }
      }

      // 그룹에 속한 edge가 아니면 개별 edge로 처리 (단일 노드 연결이 아닌 경우)
      // 그룹에 속한 edge는 showLabel이 명시적으로 설정되어야 함
      if (isInGroup) {
        // 그룹 내 edge: showLabel 명시적으로 설정
        edgeData.showLabel = shouldShowLabel
      } else {
        // 그룹에 속하지 않은 edge: 기존 로직 유지 (단일 노드 연결 등)
        if (edge.data?.showLabel === true && shouldShowLabel === false) {
          edgeData.showLabel = true
        } else {
          edgeData.showLabel = shouldShowLabel
        }
      }

      return {
        ...edge,
        data: edgeData
      }
    })

    // 그룹 연결포인트 생성/업데이트
    const groupConnectorNodes = []

    // 확정된 그룹 연결포인트는 위치 유지
    // 가장 안전한 방법: confirmedConnectors를 직접 사용 (이미 currentNodes에서 필터링된 것)
    // 이렇게 하면 connectorId로 찾지 못하는 경우에도 모든 확정된 connector가 포함됨
    // hidden: true인 connector도 포함 (편집 모드에서 숨겨진 connector 유지)
    confirmedConnectors.forEach(connector => {
      // 확정된 connector는 모두 추가 (hidden 상태와 관계없이)
      // hidden: true인 경우에도 유지하여 편집 모드에서 사라지지 않도록 함
      if (connector.data?.isConfirmed === true) {
        groupConnectorNodes.push(connector)
      }
    })

    // 확정되지 않은 그룹의 connector도 찾아서 추가
    // edgeGroups가 비어있어도 기존 connector는 유지해야 함
    const unconfirmedConnectors = currentNodes.filter(
      node => node && node.type === 'groupConnector' &&
        node.data?.isConfirmed === false &&
        !node.data?.hidden &&
        node.data?.isGroupBox === true
    )

    // 확정되지 않은 connector를 groupConnectorNodes에 추가 (중복 제거)
    unconfirmedConnectors.forEach(connector => {
      // 이미 추가되지 않은 경우만 추가
      if (!groupConnectorNodes.some(c => c.id === connector.id)) {
        groupConnectorNodes.push(connector)
      }
    })

    // 새로운 그룹 연결포인트 생성 (확정되지 않은 그룹만)
    edgeGroups.forEach((group, groupIndex) => {
      // 확정된 그룹은 이미 처리됨
      const isConfirmedGroup = group.some(e => e.data?.isConfirmed)
      if (isConfirmedGroup) return

      // 그룹에 속한 노드 찾기
      const groupNodeIds = new Set()
      group.forEach(edge => {
        groupNodeIds.add(edge.source)
        groupNodeIds.add(edge.target)
      })

      const groupNodes = currentNodes.filter(n =>
        n && groupNodeIds.has(n.id) && n.type === 'partNode'
      )

      if (groupNodes.length === 0) return

      // 그룹 ID 생성 (노드 ID 기반으로 고유 ID 생성)
      const sortedNodeIds = Array.from(groupNodeIds).sort()
      const groupId = `group-${sortedNodeIds.join('-')}`
      const connectorId = `group-connector-${groupId}`

      // 기존 connector 찾기 (확정되지 않은 그룹 connector 중 nodeIds가 겹치는 것 찾기)
      const existingConnector = currentNodes.find(n => {
        if (!n || n.type !== 'groupConnector' || n.data?.isConfirmed !== false) {
          return false
        }
        // 기존 connector의 nodeIds와 새로운 groupNodeIds가 겹치면 같은 그룹
        const existingNodeIds = new Set(n.data?.nodeIds || [])
        const hasOverlap = Array.from(groupNodeIds).some(nodeId => existingNodeIds.has(nodeId))
        return hasOverlap
      })

      if (existingConnector) {
        // 기존 connector가 있으면 nodeIds, groupEdges, groupId 업데이트
        const updatedConnector = {
          ...existingConnector,
          id: connectorId, // 새로운 connectorId로 업데이트
          data: {
            ...existingConnector.data,
            groupId: groupId, // 새로운 groupId로 업데이트
            nodeIds: Array.from(groupNodeIds), // 새로운 노드 포함하여 업데이트
            groupEdges: group.map(e => e.id), // 새로운 edge 포함하여 업데이트
            hidden: false, // 숨김 해제
            isConfirmed: false // 아직 확정되지 않음
          }
        }
        groupConnectorNodes.push(updatedConnector)
        return // 기존 connector 업데이트 완료
      }

      // 새로운 connector 생성 (기존에 없을 때만)
      // 여러 노드 연결 시: edge-label-box의 DOM 좌표를 기반으로 위치 계산
      let position = null

      if (group.length > 0 && rfInst) {
        // 첫 번째 edge의 edge-label-box DOM 위치 사용
        const firstEdge = group[0]
        const labelBox = document.querySelector(`.edge-label-box[data-edge-id="${firstEdge.id}"]`)
        if (labelBox) {
          const rect = labelBox.getBoundingClientRect()
          const flowPosition = rfInst.screenToFlowPosition({
            x: rect.left + rect.width / 2 - 25,
            y: rect.top + rect.height / 2 - 62
          })
          position = flowPosition
        }
      }

      // DOM에서 찾지 못한 경우 fallback: 첫 번째 노드 기준 계산
      if (!position) {
        const firstNode = groupNodes[0]
        const labelX = firstNode.position.x + 90
        const labelY = firstNode.position.y + 200 + 60
        position = { x: labelX, y: labelY }
      }

      groupConnectorNodes.push({
        id: connectorId,
        type: 'groupConnector',
        position,
        data: {
          isConfirmed: false,
          isGroupBox: true,
          groupId: groupId,
          groupEdges: group.map(e => e.id),
          nodeIds: Array.from(groupNodeIds),
          level: 1,
          hidden: false // 명시적으로 설정
        },
        zIndex: 1000
      })
    })

    // 단일 노드 연결포인트 (연결된 edge가 없는 확정된 노드)
    const partNodes = currentNodes.filter(n =>
      n && n.type === 'partNode' &&
      n.data?.isConfirmed === true &&
      !confirmedNodeIds.has(n.id)
    )

    partNodes.forEach(node => {
      // 연결된 edge 확인
      const hasEdge = currentEdges.some(
        e => (e.source === node.id || e.target === node.id) &&
          !e.data?.isConfirmed
      )

      if (hasEdge) return // edge가 있으면 그룹 연결포인트로 처리됨

      const connectorId = `single-node-connector-${node.id}`
      // 모든 connector 찾기 (타입 체크 없이 ID만으로 찾기 - 숨겨진 것도 포함)
      const existingConnector = currentNodes.find(n => n.id === connectorId)

      if (existingConnector) {
        // 숨겨진 connector도 다시 보여주기
        if (existingConnector.data?.hidden) {
          groupConnectorNodes.push({
            ...existingConnector,
            data: {
              ...existingConnector.data,
              hidden: false, // 숨김 해제
              isConfirmed: true
            }
          })
        } else {
          // 이미 보이는 connector는 그대로 유지
          groupConnectorNodes.push(existingConnector)
        }
      } else {
        // 새로운 connector 생성 (기존에 없을 때만)
        const labelX = node.position.x + 90
        const labelY = node.position.y + 200 + 60

        groupConnectorNodes.push({
          id: connectorId,
          type: 'groupConnector',
          position: { x: labelX, y: labelY },
          data: {
            isConfirmed: true,
            isGroupBox: false,
            nodeId: node.id,
            level: 1
          },
          zIndex: 1001
        })
      }
    })

    return {
      updatedEdges,
      groupConnectorNodes
    }
  }, [])

  /* --------------------------------------------------------------
   * 그룹 확정(Confirm) 핸들러
   * 단일 노드든 여러 노드든 모두 그룹 확정으로 처리
   * --------------------------------------------------------------
   */
  const handleNodeConfirm = useCallback((id) => {
    // 중복 호출 방지: 이미 처리 중인 ID는 무시
    if (confirmingRef.current.has(id)) {
      return
    }
    confirmingRef.current.add(id)

    // 1. 유효성 검사
    const currentSettings = settingsDataRef.current
    if (!currentSettings.processOrder) {
      confirmingRef.current.delete(id)
      showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please select a process order' })
      // 설정 패널 열기 및 포커스
      setShowSettingsPanel(true)
      setFocusField('processOrder')
      return
    }
    if (!currentSettings.processSelection) {
      confirmingRef.current.delete(id)
      showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please select a process selection' })
      // 설정 패널 열기 및 포커스
      setShowSettingsPanel(true)
      setFocusField('processSelection')
      return
    }
    // 유효성 검사 통과 시 focusField 초기화
    setFocusField(null)

    // 최신 edges와 nodes를 가져와서 처리
    setEdges((eds) => {
      // 엣지 ID인지 확인 (엣지 ID는 eds에서 찾을 수 있음)
      const targetEdge = eds.find(e => e.id === id)

      // 엣지 확정 처리 (통합 edge의 경우)
      if (targetEdge) {
        // 엣지의 stepValue 검사
        if (!targetEdge.data?.stepValue) {
          confirmingRef.current.delete(id)
          setTimeout(() => {
            showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please enter a step value' })
            const stepInput = document.querySelector(`.edge-label-box[data-edge-id="${id}"] .node-step-input`)
            if (stepInput) {
              stepInput.focus()
              stepInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 0)
          return eds
        }

        // 설정 패널의 addedParts에서 노드 ID만 추출 (최신 값 참조)
        const currentAddedParts = addedPartsRef.current
        const addedPartsIds = currentAddedParts.map(part => typeof part === 'string' ? part : part.id).filter(Boolean)

        // 그룹 정보 미리 생성 (savedSettings에 저장하기 위해)
        // targetEdge의 source/target을 기반으로 임시 그룹 ID 생성
        const tempNodeIds = new Set([targetEdge.source, targetEdge.target])
        const tempSortedNodeIds = Array.from(tempNodeIds).sort()
        const tempGroupId = `group-${tempSortedNodeIds.join('-')}`
        const tempConnectorId = `group-connector-${tempGroupId}`

        // 엣지 확정 처리: 즉시 edge 업데이트 (addedPartsIds, groupId, connectorId 포함)
        const updatedEdges = eds.map(edge => {
          if (edge.id === id) {
            return {
              ...edge,
              data: {
                ...edge.data,
                isConfirmed: true,
                showLabel: true, // 확정 시 showLabel을 true로 명시적으로 설정
                savedSettings: {
                  ...currentSettings,
                  addedPartsIds: addedPartsIds, // 설정 패널의 addedParts 노드 ID 저장
                  groupId: tempGroupId, // 그룹 ID 저장
                  connectorId: tempConnectorId // Connector ID 저장
                }
              }
            }
          }
          return edge
        })

        // edge 확정 후 즉시 isEdgeConfirmed 상태 업데이트 (설정 패널이 열려있으면 즉시 읽기 전용으로 변경)
        setIsEdgeConfirmed(true)

        // 연결된 모든 노드 찾기 (setNodes 밖에서 처리하여 최신 edges 사용)
        // 해결책 1: findAllConnectedPartNodes 대신 savedSettings의 addedPartsIds 직접 사용
      setNodes((nds) => {
          // savedSettings의 addedPartsIds에서 partNode ID만 추출 (connector ID 제외)
          const partNodeIds = addedPartsIds.filter(nodeId => {
            const node = nds.find(n => n && n.id === nodeId)
            return node && node.type === 'partNode'
          })

          if (partNodeIds.length === 0) {
            confirmingRef.current.delete(id)
          return nds
        }

          // partNode ID만 사용하여 allConnectedNodeIds 생성
          const allConnectedNodeIds = new Set(partNodeIds)

          // 연결된 모든 edge 찾기 (원본 edges 사용)
          // targetEdge와 partNodeIds에 포함된 노드들만 연결된 edge 찾기
          const connectedEdges = eds.filter(edge => {
            // targetEdge는 항상 포함
            if (edge.id === id) return true
            // partNodeIds에 포함된 노드들만 연결된 edge
            return allConnectedNodeIds.has(edge.source) || allConnectedNodeIds.has(edge.target)
          })

          // 그룹 정보 생성 (그룹 단위 정보 관리)
          // targetEdge의 savedSettings에서 기존 groupId나 connectorId를 먼저 확인
          const savedGroupId = targetEdge.data?.savedSettings?.groupId
          const savedConnectorId = targetEdge.data?.savedSettings?.connectorId

          const sortedNodeIds = Array.from(allConnectedNodeIds).sort()
          const groupId = savedGroupId || `group-${sortedNodeIds.join('-')}`
          const connectorId = savedConnectorId || `group-connector-${groupId}`

          // console.log('=== 그룹 확정 정보 ===')
          // console.log('Group ID:', groupId)
          // console.log('Connector ID:', connectorId)
          // console.log('Node IDs:', Array.from(allConnectedNodeIds))
          // console.log('Connected Edges:', connectedEdges.map(e => e.id))
          // console.log('Added Parts IDs:', addedPartsIds)
          // console.log('Settings:', currentSettings)

          // updateEdgeLabels 호출하여 connector 생성/업데이트
          const { updatedEdges: finalEdges, groupConnectorNodes } = updateEdgeLabels(updatedEdges, nds, rfInstance, handleEdgeDelete, handleNodeSettingsClick, handleNodeConfirm)

          // edges 업데이트 (즉시 반영)
          setEdges(finalEdges)

          // 연결된 모든 노드를 확정 상태로 변경
          const updatedPartNodes = nds.map(node => {
            if (allConnectedNodeIds.has(node.id) && node.type === 'partNode') {
              return {
                ...node,
                draggable: false,
                data: {
                  ...node.data,
                  isConfirmed: true,
                  savedSettings: { ...currentSettings },
                  // 편집 핸들러 유지
                  onEdit: node.data?.onEdit || (() => handleNodeEdit(node.id)),
                  onSettingsClick: node.data?.onSettingsClick,
                  onDelete: node.data?.onDelete,
                  onStepChange: node.data?.onStepChange,
                  onConfirm: node.data?.onConfirm,
                  onTextChange: node.data?.onTextChange
                }
              }
            }
            return node
          })

          const filteredNodes = updatedPartNodes.filter(n => n && n.type !== 'groupConnector')
          const existingConnectorMap = new Map(
            nds
              .filter(n => n && n.type === 'groupConnector')
              .map(n => [n.id, n])
          )

          const updatedConnectorMap = new Map()

          if (groupConnectorNodes && Array.isArray(groupConnectorNodes)) {
            groupConnectorNodes.forEach(newConnector => {
              // 그룹 connector에 그룹 정보 저장 (독립적인 데이터 관리)
              // connectorId나 groupId로 직접 매칭 확인 (가장 정확)
              const isMatchingConnector =
                newConnector.data?.groupId === groupId ||
                newConnector.id === connectorId

              // fallback: groupEdges가 완전히 일치하는지 확인 (savedSettings가 없는 경우)
              let shouldMatch = isMatchingConnector
              if (!shouldMatch && newConnector.data?.groupEdges) {
                const connectedEdgeIds = new Set(connectedEdges.map(e => e.id))
                const connectorEdgeIds = new Set(newConnector.data.groupEdges)
                const isExactMatch =
                  connectorEdgeIds.size === connectedEdgeIds.size &&
                  Array.from(connectorEdgeIds).every(edgeId => connectedEdgeIds.has(edgeId))
                if (isExactMatch) {
                  shouldMatch = true
                }
              }

              if (shouldMatch) {
                // 해결책 3: updateEdgeLabels에서 반환된 connector의 위치 유지
                // 기존 connector가 있으면 위치 유지, 없으면 edge-label-box DOM 위치 사용
                let connectorPosition = newConnector.position
                const existingConnector = nds.find(n => n && n.id === newConnector.id)
                if (existingConnector && existingConnector.position) {
                  connectorPosition = existingConnector.position // 기존 위치 유지
                } else if (rfInstance) {
                  // edge-label-box DOM 위치 사용
                  const labelBox = document.querySelector(`.edge-label-box[data-edge-id="${id}"]`)

                  if (labelBox) {
          const rect = labelBox.getBoundingClientRect()
                    const flowPosition = rfInstance.screenToFlowPosition({
                      x: rect.left + rect.width / 2 - 20,
                      y: rect.top + rect.height / 2 - 52
                    })
                    connectorPosition = flowPosition
                  }
                }

                const updatedConnectorData = {
                  ...newConnector,
                  position: connectorPosition, // 해결책 3: 위치 유지 또는 DOM 위치
                  data: {
                    ...newConnector.data,
                    isConfirmed: true,
                    isGroupBox: true,
                    groupId: groupId,
                    groupEdges: connectedEdges.map(e => e.id), // 그룹에 속한 edge ID 목록
                    nodeIds: Array.from(allConnectedNodeIds), // 그룹에 속한 노드 ID 목록
                    savedSettings: {
                      ...currentSettings,
                      addedPartsIds: addedPartsIds // 설정 패널의 addedParts 노드 ID 저장
                    }, // 그룹의 processOrder 및 공정 정보
                    level: 1,
                    hidden: false // 숨김 해제
                  }
                }

                // console.log('=== updateEdgeLabels에서 반환된 Connector 업데이트 ===')
                // console.log('Connector ID:', newConnector.id)
                // console.log('Group ID:', groupId)
                // console.log('Node IDs:', Array.from(allConnectedNodeIds))
                // console.log('Group Edges:', connectedEdges.map(e => e.id))
                // console.log('Added Parts IDs:', addedPartsIds)
                // console.log('Updated Connector:', updatedConnectorData)

                updatedConnectorMap.set(newConnector.id, updatedConnectorData)
              } else {
                updatedConnectorMap.set(newConnector.id, newConnector)
              }
            })
          }

          // 기존 connector 중 그룹에 해당하는 것 찾기 (hidden: true인 것도 포함)
          // 방법 1: savedSettings에 저장된 connectorId나 groupId로 직접 찾기 (가장 정확)
          let existingGroupConnector = nds.find(n =>
            n && n.type === 'groupConnector' &&
            (n.id === connectorId || n.data?.groupId === groupId)
          )

          // 방법 2: connectedEdges를 기반으로 찾기 (fallback, savedSettings가 없는 경우)
          // connector의 groupEdges와 connectedEdges가 완전히 일치하면 해당 connector
          if (!existingGroupConnector) {
            const connectedEdgeIds = new Set(connectedEdges.map(e => e.id))
            existingGroupConnector = nds.find(n => {
              if (!n || n.type !== 'groupConnector' || !n.data?.groupEdges) {
                return false
              }
              // connector의 groupEdges와 connectedEdges가 완전히 일치하는지 확인
              const connectorEdgeIds = new Set(n.data.groupEdges)
              const isExactMatch =
                connectorEdgeIds.size === connectedEdgeIds.size &&
                Array.from(connectorEdgeIds).every(edgeId => connectedEdgeIds.has(edgeId))
              return isExactMatch
            })
          }

          if (existingGroupConnector && !updatedConnectorMap.has(existingGroupConnector.id)) {
            // 그룹에 속한 partNode 찾기 (addedParts 저장용)
            const groupPartNodesForExisting = nds.filter(n =>
              n && allConnectedNodeIds.has(n.id) && n.type === 'partNode'
            )
            const addedPartsIdsForExisting = groupPartNodesForExisting.map(n => n.id)

            // 기존 connector가 있으면 그룹 정보 업데이트 (hidden 해제)
            const updatedConnector = {
              ...existingGroupConnector,
              data: {
                ...existingGroupConnector.data,
                isConfirmed: true,
                isGroupBox: true,
                groupId: groupId,
                groupEdges: connectedEdges.map(e => e.id), // 최신 edge 목록으로 업데이트
                nodeIds: Array.from(allConnectedNodeIds), // 최신 노드 목록으로 업데이트
                savedSettings: {
                  ...currentSettings,
                  addedPartsIds: addedPartsIdsForExisting, // 그룹에 속한 노드 ID 목록 저장
                  groupId: groupId, // 그룹 ID 저장
                  connectorId: existingGroupConnector.id // Connector ID 저장
                },
                level: 1,
                hidden: false // 숨김 해제
              }
            }

            // console.log('=== 기존 그룹 Connector 업데이트 (재확정) ===')
            // console.log('Connector ID:', existingGroupConnector.id)
            // console.log('Group ID:', groupId)
            // console.log('Node IDs:', Array.from(allConnectedNodeIds))
            // console.log('Group Edges:', connectedEdges.map(e => e.id))
            // console.log('Added Parts IDs:', addedPartsIdsForExisting)
            // console.log('Was Hidden:', existingGroupConnector.data?.hidden)
            // console.log('Updated Connector:', updatedConnector)

            updatedConnectorMap.set(existingGroupConnector.id, updatedConnector)
          } else if (!existingGroupConnector && !updatedConnectorMap.has(connectorId)) {
            // 새로운 connector 생성 (그룹 정보 포함)
            // 해결책 3: edge-label-box DOM 위치 우선 사용
            let position = null

            // targetEdge의 edge-label-box DOM 위치 사용
            if (rfInstance) {
              const labelBox = document.querySelector(`.edge-label-box[data-edge-id="${id}"]`)
              if (labelBox) {
                const rect = labelBox.getBoundingClientRect()
                const flowPosition = rfInstance.screenToFlowPosition({
                  x: rect.left + rect.width / 2 - 25,
                  y: rect.top + rect.height / 2 - 62
                })
                position = flowPosition
              }
            }

            // DOM에서 찾지 못한 경우 fallback: partNodeIds의 첫 번째 노드 기준 계산
            if (!position) {
              const groupPartNodes = nds.filter(n =>
                n && allConnectedNodeIds.has(n.id) && n.type === 'partNode'
              )
              const firstNode = groupPartNodes[0]
              const labelX = firstNode ? firstNode.position.x + 90 : 0
              const labelY = firstNode ? firstNode.position.y + 200 + 60 : 0
              position = { x: labelX, y: labelY }
            }

            const groupPartNodes = nds.filter(n =>
              n && allConnectedNodeIds.has(n.id) && n.type === 'partNode'
            )
            const addedPartsIdsForNew = groupPartNodes.map(n => n.id)

            const newConnector = {
              id: connectorId,
          type: 'groupConnector',
              position: position, // 해결책 3: edge-label-box DOM 위치 또는 fallback 위치
          data: {
            isConfirmed: true,
                isGroupBox: true,
                groupId: groupId,
                groupEdges: connectedEdges.map(e => e.id),
                nodeIds: Array.from(allConnectedNodeIds),
                savedSettings: {
                  ...currentSettings,
                  addedPartsIds: addedPartsIdsForNew, // 그룹에 속한 노드 ID 목록 저장
                  groupId: groupId, // 그룹 ID 저장
                  connectorId: connectorId // Connector ID 저장
                },
                level: 1,
                hidden: false
          },
          zIndex: 1001
        }

            // console.log('=== 새 그룹 Connector 생성 ===')
            // console.log('Connector:', newConnector)
            // console.log('Group ID:', groupId)
            // console.log('Node IDs:', Array.from(allConnectedNodeIds))
            // console.log('Group Edges:', connectedEdges.map(e => e.id))
            // console.log('Added Parts IDs:', addedPartsIdsForNew)

            updatedConnectorMap.set(connectorId, newConnector)
          }

          // 하위 그룹 connector 숨김 처리 (addedPartsIds에 포함된 그룹 connector)
          const childGroupConnectorIds = new Set()
          addedPartsIds.forEach(nodeId => {
            const node = nds.find(n => n && n.id === nodeId)
            if (node && node.type === 'groupConnector') {
              childGroupConnectorIds.add(nodeId)
            }
          })
          
          // 하위 그룹 connector를 hidden: true로 설정
          childGroupConnectorIds.forEach(childConnectorId => {
            const childConnector = existingConnectorMap.get(childConnectorId)
            if (childConnector && childConnector.data?.isConfirmed === true) {
              updatedConnectorMap.set(childConnectorId, {
                ...childConnector,
                data: {
                  ...childConnector.data,
                  hidden: true, // 하위 그룹 connector 숨김
                  isConfirmed: true // 확정 상태 유지
                }
              })
            }
          })

          // 다른 그룹의 connector는 그대로 유지 (독립성 보장)
          existingConnectorMap.forEach((existingConnector, connectorId) => {
            if (!updatedConnectorMap.has(connectorId)) {
              // 하위 그룹 connector가 아닌 경우만 유지
              if (!childGroupConnectorIds.has(connectorId)) {
                if (existingConnector.data?.isConfirmed === true && !existingConnector.data?.hidden) {
                  updatedConnectorMap.set(connectorId, existingConnector)
                } else if (existingConnector.data?.isGroupBox === true && !existingConnector.data?.hidden) {
                  updatedConnectorMap.set(connectorId, existingConnector)
                }
              }
            }
          })

          const finalConnectors = Array.from(updatedConnectorMap.values())

          // 모든 그룹 정보 로그 출력
          // console.log('=== 최종 그룹 Connector 목록 ===')
          // finalConnectors.forEach(connector => {
          //   if (connector.data?.isGroupBox) {
          //     console.log(`그룹: ${connector.data?.groupId}`)
          //     console.log('  - Connector ID:', connector.id)
          //     console.log('  - Node IDs:', connector.data?.nodeIds)
          //     console.log('  - Group Edges:', connector.data?.groupEdges)
          //     console.log('  - Added Parts IDs:', connector.data?.savedSettings?.addedPartsIds)
          //     console.log('  - Is Confirmed:', connector.data?.isConfirmed)
          //     console.log('  - Settings:', connector.data?.savedSettings)
          //     console.log('---')
          //   }
          // })

          // 처리 완료 후 ref에서 제거
          confirmingRef.current.delete(id)

          return [...filteredNodes, ...finalConnectors]
        })

        return updatedEdges
      }

      // 노드 확정 처리: 단일 노드만 확정 (hasConnectedEdge: false인 노드만 확정 아이콘 표시)
      setNodes((nds) => {
        const startNode = nds.find(n => n.id === id)
        if (!startNode || startNode.type !== 'partNode') {
          confirmingRef.current.delete(id)
          return nds
        }

        // stepValue 검사
        if (!startNode.data?.stepValue) {
          confirmingRef.current.delete(id)
          setTimeout(() => {
            showSmallAlert({ icon: 'warning', title: 'Required', text: 'Please enter a step value' })
            const stepInput = document.querySelector(`.node-label-box[data-node-id="${id}"] .node-step-input`)
            if (stepInput) {
              stepInput.focus()
              stepInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 0)
          return nds
        }

        // 단일 노드만 확정 처리
        const updatedNodes = nds.map(node => {
            if (node.id === id) {
              return {
                ...node,
                draggable: false,
                data: {
                  ...node.data,
                  isConfirmed: true,
                savedSettings: { ...currentSettings },
                onEdit: node.data?.onEdit || (() => handleNodeEdit(node.id)),
                onSettingsClick: node.data?.onSettingsClick,
                onDelete: node.data?.onDelete,
                onStepChange: node.data?.onStepChange,
                onConfirm: node.data?.onConfirm,
                onTextChange: node.data?.onTextChange
                }
              }
            }
            return node
        })

        // 단일 노드 확정 시: 설정 패널을 닫았다가 다시 열어 읽기 모드로 전환
        const confirmedNode = updatedNodes.find(n => n.id === id)
        if (confirmedNode) {
          setTimeout(() => {
            setShowSettingsPanel(false)
            setSelectedNodeId(id)
            setAddedParts([confirmedNode])

            setTimeout(() => {
              setShowSettingsPanel(true)
            }, 20)
          }, 10)
        }

        confirmingRef.current.delete(id)
        return updatedNodes
      })

      return eds
    })

    // 확정 후 edge 라벨 업데이트 (단일 노드 connector 생성 포함)
    // setNodes가 완료된 후 updateEdgeLabels를 호출하여 업데이트된 노드들이 반영되도록 함
    setTimeout(() => {
      setEdges((currentEdges) => {
        setNodes((currentNodes) => {
          // currentNodes에는 이미 handleNodeConfirm에서 업데이트한 노드들이 포함되어 있음
          if (!currentNodes || !Array.isArray(currentNodes)) {
            return currentNodes || []
          }

          const { updatedEdges, groupConnectorNodes } = updateEdgeLabels(currentEdges, currentNodes, rfInstance, handleEdgeDelete, handleNodeSettingsClick, handleNodeConfirm)

          // 그룹 connector 노드 업데이트
          // handleNodeConfirm에서 이미 업데이트한 connector는 유지
          // 일반 노드는 currentNodes에서 그대로 가져옴 (이미 확정 처리됨)
          const filteredNodes = currentNodes.filter(n => n && n.type !== 'groupConnector')
          const existingConnectorMap = new Map(
            currentNodes
              .filter(n => n && n.type === 'groupConnector')
              .map(n => [n.id, n])
          )

          // updateEdgeLabels가 반환한 connector로 업데이트하되, 기존 connector도 모두 유지
          const updatedConnectorMap = new Map()

          // updateEdgeLabels가 반환한 connector로 업데이트
          groupConnectorNodes.forEach(newConnector => {
            updatedConnectorMap.set(newConnector.id, newConnector)
          })

          // 기존 connector 중 updateEdgeLabels가 반환하지 않은 것도 유지 (확정된 connector만)
          // updateEdgeLabels가 반환한 connector를 우선 사용 (확정/미확정 모두)
          existingConnectorMap.forEach((existingConnector, id) => {
            if (!updatedConnectorMap.has(id)) {
              // 확정되고 숨겨지지 않은 connector는 유지 (안전장치)
              if (existingConnector.data?.isConfirmed === true && !existingConnector.data?.hidden) {
                updatedConnectorMap.set(id, existingConnector)
              }
            }
            // updateEdgeLabels가 반환한 connector가 있으면 그것을 사용 (확정/미확정 모두)
            // updateEdgeLabels가 최신 상태를 반환하므로 우선 사용
          })

          const finalConnectors = Array.from(updatedConnectorMap.values())

          setTimeout(() => setEdges(updatedEdges), 0)
          // filteredNodes에는 이미 확정 처리된 일반 노드들이 포함되어 있음
          return [...filteredNodes, ...finalConnectors]
        })
        return currentEdges
      })
    }, 100)
  }, [rfInstance, setNodes, setEdges, handleNodeEdit, updateEdgeLabels, findAllConnectedPartNodes, findAllConnectedNodesWithGroups, handleEdgeDelete, handleNodeSettingsClick, showSmallAlert, setShowSettingsPanel, setFocusField, settingsDataRef, selectedNodeId, setAddedParts])

  /* --------------------------------------------------------------
   * 파츠 드롭 (노드 생성)
   * --------------------------------------------------------------
   */
  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      if (!draggedPart || !rfInstance) return

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const isTextPart = draggedPart.isTextPart || false
      // 드롭 위치 보정 (중앙 정렬)
      position.x -= (isTextPart ? 400 : nodeWidth) / 2
      position.y -= nodeHeight / 2
      
      const newNodeId = `node-${Date.now()}`
      
      setNodes((nds) => {
        // 파츠 노드만 필터링 (groupConnector 제외)
        const partNodes = nds.filter(n => n && n.type === 'partNode')
        const newNumber = partNodes.length + 1
      
      const newNode = {
        id: newNodeId,
        type: 'partNode',
        position,
        draggable: true,
        data: { 
          label: isTextPart ? '' : draggedPart.code,
            number: newNumber, // 현재 파츠 노드 개수 + 1
          isLastNode: true,
          thumbnail: draggedPart.thumbnail,
          isTextNode: isTextPart,
          text: isTextPart ? '' : undefined,
          step: 'STEP.',
          stepValue: '',
          hasConnectedEdge: false,
          isConfirmed: false,
          // 핸들러 연결
          onSettingsClick: () => handleNodeSettingsClick(newNodeId),
          onDelete: () => handleNodeDelete(newNodeId),
          onStepChange: (id, val) => handleNodeStepChange(id, val),
          onConfirm: () => handleNodeConfirm(newNodeId),
            onEdit: () => handleNodeEdit(newNodeId),
          // 텍스트 변경 등 추가 핸들러 필요 시 연결
          onTextChange: (id, val) => {
              setNodes(currentNodes => currentNodes.map(n => n.id === id ? { ...n, data: { ...n.data, text: val } } : n))
          }
        },
      }

        // 기존 노드들의 isLastNode false 처리
        const updatedNodes = nds.map(node => ({
          ...node,
          data: { ...node.data, isLastNode: false }
        }))
        return [...updatedNodes, newNode]
      })
      
      // 생성 직후 설정 패널 열기
      setTimeout(() => {
        handleNodeSettingsClick(newNodeId)
      }, 100)
      
      setDraggedPart(null)
    },
    [draggedPart, rfInstance, nodes.length, setNodes, handleNodeSettingsClick, handleNodeDelete, handleNodeStepChange, handleNodeConfirm, handleNodeEdit]
  )

  /* --------------------------------------------------------------
   * 드래그 오버 처리
   * --------------------------------------------------------------
   */
  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  /* --------------------------------------------------------------
   * 노드 간 연결 처리
   * 노드-노드, 노드-그룹, 그룹-그룹 연결 지원
   * --------------------------------------------------------------
   */
  const onConnect = useCallback((connection) => {
    if (!connection.source || !connection.target) return

    const newEdge = {
      id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'custom',
      data: {
        step: 'STEP.',
        stepValue: '',
        isConfirmed: false,
        showLabel: true,
        // Edge 핸들러 연결
        onEdit: (edgeId) => {
          handleNodeEdit(edgeId)
        },
        onConfirm: (edgeId) => {
          handleNodeConfirm(edgeId)
        },
        onStepChange: (edgeId, value) => {
          setEdges((eds) =>
            eds.map(e =>
              e.id === edgeId
                ? { ...e, data: { ...e.data, stepValue: value } }
                : e
            )
          )
        },
        onSettingsClick: (edgeId) => {
          handleNodeSettingsClick(edgeId)
        }
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    }

    setEdges((eds) => {
      const updatedEdges = addEdge(newEdge, eds)

      // 연결 후 연결된 모든 노드를 찾아서 addedParts 업데이트
      setNodes((nds) => {
        // source와 target 중 하나라도 일반 노드인 경우 연결된 그룹 찾기
        const sourceNode = nds.find(n => n.id === connection.source)
        const targetNode = nds.find(n => n.id === connection.target)

        if (sourceNode || targetNode) {     
          let startNodeId = null

          if (sourceNode?.type === 'groupConnector') {
            startNodeId = sourceNode.data?.groupId
          } else if (sourceNode?.type === 'partNode') {
            startNodeId = connection.source
          } else if (targetNode?.type === 'groupConnector') {
            startNodeId = targetNode.data?.groupId
          } else if (targetNode?.type === 'partNode') {
            startNodeId = connection.target
          } 

          console.log('startNodeId:', startNodeId)

          // 설정 패널이 열려있고 선택된 노드가 연결된 그룹에 포함되어 있으면 addedParts 업데이트
          if (startNodeId && showSettingsPanel && selectedNodeId) {
            // startNodeId가 groupId인지 확인 (확정되지 않은 groupConnector의 groupId만)
            let groupConnector = nds.find(n => 
              n && n.type === 'groupConnector' && 
              n.data?.isConfirmed === false &&
              n.data?.groupId === startNodeId
            )
            
            // startNodeId가 groupId가 아닌 경우, 해당 노드가 속한 확정되지 않은 그룹 connector 찾기
            if (!groupConnector) {
              // connection의 source나 target이 확정되지 않은 그룹 connector인지 확인
              const sourceConnector = nds.find(n => 
                n && n.type === 'groupConnector' && 
                n.data?.isConfirmed === false &&
                n.id === connection.source
              )
              const targetConnector = nds.find(n => 
                n && n.type === 'groupConnector' && 
                n.data?.isConfirmed === false &&
                n.id === connection.target
              )
              
              if (sourceConnector) {
                groupConnector = sourceConnector
              } else if (targetConnector) {
                groupConnector = targetConnector
              } else {
                // startNodeId가 속한 확정되지 않은 그룹 connector 찾기
                groupConnector = nds.find(n => 
                  n && n.type === 'groupConnector' && 
                  n.data?.isConfirmed === false &&
                  n.data?.nodeIds && 
                  Array.isArray(n.data.nodeIds) &&
                  n.data.nodeIds.includes(startNodeId)
                )
              }
            }
            
            console.log('groupConnector:', groupConnector)
            
            if (groupConnector) {
              // 편집 모드로 전환된 그룹인지 확인 (확정되지 않은 그룹이고 savedSettings가 있고 addedPartsIds가 있는 경우)
              const isEditedGroup = groupConnector.data?.isConfirmed === false &&
                                    groupConnector.data?.savedSettings?.addedPartsIds && 
                                    Array.isArray(groupConnector.data.savedSettings.addedPartsIds) &&
                                    groupConnector.data.savedSettings.addedPartsIds.length > 0
              
              if (isEditedGroup) {
                // 편집 모드로 전환된 그룹: 기존 addedPartsIds에 새 노드만 추가
                const existingAddedPartsIds = groupConnector.data.savedSettings.addedPartsIds
                const addedParts = []
                
                // 기존 노드들 추가
                existingAddedPartsIds.forEach(nodeId => {
                  const node = nds.find(n => n && n.id === nodeId)
                  if (node && (node.type === 'partNode' || node.type === 'groupConnector')) {
                    addedParts.push(node)
                  }
                })
                
                // 새로 연결된 노드 추가
                const newNodeId = connection.source === groupConnector.id 
                  ? connection.target 
                  : connection.target === groupConnector.id 
                    ? connection.source 
                    : (sourceNode?.type === 'partNode' ? connection.source : connection.target)
                
                if (newNodeId && !existingAddedPartsIds.includes(newNodeId)) {
                  const newNode = nds.find(n => n && n.id === newNodeId)
                  if (newNode && (newNode.type === 'partNode' || newNode.type === 'groupConnector')) {
                    addedParts.push(newNode)
                  }
                }
                
                // 기존 설정 데이터 유지 (savedSettings에서 addedPartsIds 제외한 나머지 설정)
                const { addedPartsIds, ...settingsData } = groupConnector.data.savedSettings
                setSettingsData(settingsData)
                
                setAddedParts(addedParts)
                return nds
              }
              
              // 확정되지 않은 그룹의 경우: 현재 connection과 같은 그룹에 속한 edge들을 찾아서 노드 수집
              
              // 확정된 그룹에 속한 노드 ID 수집
              const confirmedNodeIds = new Set()
              // 확정된 그룹 connector ID 수집 (확정된 그룹 connector를 만나면 탐색 중단)
              const confirmedConnectorIds = new Set()
              nds.forEach(node => {
                if (node && node.type === 'groupConnector' && node.data?.isConfirmed === true) {
                  confirmedConnectorIds.add(node.id)
                  const nodeIds = node.data?.nodeIds || []
                  nodeIds.forEach(id => confirmedNodeIds.add(id))
                }
              })
              
              // 확정되지 않은 edge만 그룹화
              const unconfirmedEdges = updatedEdges.filter(edge => {
                // 확정된 그룹에 속한 edge인지 확인
                const isSourceConfirmed = confirmedNodeIds.has(edge.source)
                const isTargetConfirmed = confirmedNodeIds.has(edge.target)
                return !(isSourceConfirmed && isTargetConfirmed)
              })
              
              // 현재 connection과 같은 그룹에 속한 edge 찾기
              // 확정된 그룹 connector는 그룹 경계로만 처리하고, 확정되지 않은 노드는 계속 탐색
              const findConnectedEdges = (startNodeId, visited = new Set(), visitedConnectors = new Set()) => {
                if (visited.has(startNodeId)) return []
                
                // 확정된 그룹에 속한 노드면 중단 (그룹 내부로 들어가지 않음)
                if (confirmedNodeIds.has(startNodeId)) return []
                
                // 확정된 그룹 connector를 만나면:
                // - connector 자체는 그룹의 일부로 인정 (edge는 추가하지 않지만 connector는 인식)
                // - 하지만 그 connector를 통해 더 이상 탐색하지 않음 (다른 그룹으로 넘어가지 않도록)
                if (confirmedConnectorIds.has(startNodeId)) {
                  // 이미 방문한 connector면 중단
                  if (visitedConnectors.has(startNodeId)) return []
                  visitedConnectors.add(startNodeId)
                  return [] // connector를 통해 더 이상 탐색하지 않음
                }
                
                visited.add(startNodeId)
                const connected = []
                unconfirmedEdges.forEach(edge => {
                  if (edge.source === startNodeId || edge.target === startNodeId) {
                    connected.push(edge)
                    const nextNodeId = edge.source === startNodeId ? edge.target : edge.source
                    connected.push(...findConnectedEdges(nextNodeId, visited, visitedConnectors))
                  }
                })
                return connected
              }
              
              // 현재 connection의 source나 target 중 하나를 시작점으로 같은 그룹의 edge 찾기
              const startNodeIdForGroup = connection.source === groupConnector.id 
                ? connection.target 
                : connection.target === groupConnector.id 
                  ? connection.source 
                  : (sourceNode?.type === 'partNode' ? connection.source : connection.target)
              
              // 방문한 확정된 그룹 connector 추적
              const visitedConnectorsSet = new Set()
              const groupEdges = findConnectedEdges(startNodeIdForGroup, new Set(), visitedConnectorsSet)
              const uniqueGroupEdges = Array.from(new Map(groupEdges.map(e => [e.id, e])).values())
              
              // 그룹에 속한 노드 ID 수집
              const groupNodeIds = new Set()
              uniqueGroupEdges.forEach(edge => {
                groupNodeIds.add(edge.source)
                groupNodeIds.add(edge.target)
              })
              
              // 현재 connection의 source와 target도 포함 (edge가 아직 추가되지 않았을 수 있음)
              groupNodeIds.add(connection.source)
              groupNodeIds.add(connection.target)
              
              // 방문한 확정된 그룹 connector도 추가 (그룹의 일부로 인정)
              visitedConnectorsSet.forEach(connectorId => {
                groupNodeIds.add(connectorId)
              })
              
              // 그룹에 속한 노드들 찾기 (확정된 그룹은 connector로 표시)
              const addedParts = []
              
              // 먼저 확정된 그룹 connector 추가
              groupNodeIds.forEach(nodeId => {
                const node = nds.find(n => n && n.id === nodeId)
                if (node && node.type === 'groupConnector' && node.data?.isConfirmed === true) {
                  // 이미 추가되지 않았으면 추가
                  if (!addedParts.some(p => p.id === node.id)) {
                    addedParts.push(node)
                  }
                }
              })
              
              // 그 다음 partNode 추가 (확정된 그룹에 속하지 않은 노드만)
              groupNodeIds.forEach(nodeId => {
                // 확정된 그룹에 속한 노드는 제외
                if (confirmedNodeIds.has(nodeId)) return
                
                // 확정된 그룹 connector도 제외 (이미 위에서 추가됨)
                if (confirmedConnectorIds.has(nodeId)) return
                
                const node = nds.find(n => n && n.id === nodeId)
                if (node && node.type === 'partNode') {
                  // 이미 추가되지 않았으면 추가
                  if (!addedParts.some(p => p.id === node.id)) {
                    addedParts.push(node)
                  }
                }
              })
              
              setAddedParts(addedParts)
            } else {
              // 일반 노드인 경우 기존 로직 사용
              const connectedPartNodes = findAllConnectedPartNodes(startNodeId, nds, updatedEdges)
              // 선택된 노드가 연결된 그룹에 포함되어 있으면 업데이트
              if (connectedPartNodes && Array.isArray(connectedPartNodes) && connectedPartNodes.some(n => n && n.id === selectedNodeId)) {
                setAddedParts(connectedPartNodes)
              }
            }
          }
        }

        return nds.map(node => {
          // source 노드 업데이트 (일반 노드인 경우만)
          if (node.id === connection.source && node.type === 'partNode') {
            return {
              ...node,
              data: {
                ...node.data,
                hasConnectedEdge: true
              }
            }
          }
          // target 노드 업데이트 (일반 노드인 경우만)
          if (node.id === connection.target && node.type === 'partNode') {
            return {
              ...node,
              data: {
                ...node.data,
                hasConnectedEdge: true
              }
            }
          }
          return node
        })
      })

      return updatedEdges
    })

    // 연결 후 edge 라벨 업데이트 (최신 상태 사용)
    setTimeout(() => {
      setEdges((currentEdges) => {
        setNodes((currentNodes) => {
          if (!currentNodes || !Array.isArray(currentNodes)) {
            return currentNodes || []
          }

          const { updatedEdges, groupConnectorNodes } = updateEdgeLabels(currentEdges, currentNodes, rfInstance, handleEdgeDelete, handleNodeSettingsClick, handleNodeConfirm)

          if (!groupConnectorNodes || !Array.isArray(groupConnectorNodes)) {
            return currentNodes
          }

          // 그룹 connector 노드 업데이트
          const filteredNodes = currentNodes.filter(n => n && n.type !== 'groupConnector')
          const existingConnectorMap = new Map(
            currentNodes
              .filter(n => n && n.type === 'groupConnector')
              .map(n => [n.id, n])
          )

          // updateEdgeLabels가 반환한 connector로 업데이트하되, 기존 connector도 모두 유지
          const updatedConnectorMap = new Map()

          // updateEdgeLabels가 반환한 connector로 업데이트
          groupConnectorNodes.forEach(newConnector => {
            updatedConnectorMap.set(newConnector.id, newConnector)
          })
          
          // updateEdgeLabels 완료 후 addedParts 업데이트 (설정 패널이 열려있고 연결된 그룹이 있는 경우)
          if (showSettingsPanel && selectedNodeId) {
            // 새로 생성된 그룹 connector 찾기
            const newGroupConnector = groupConnectorNodes.find(connector => 
              connector && connector.type === 'groupConnector' &&
              connector.data?.isConfirmed === false &&
              (connector.data?.nodeIds?.includes(connection.source) || 
               connector.data?.nodeIds?.includes(connection.target) ||
               connector.id === connection.source ||
               connector.id === connection.target)
            )
            
            if (newGroupConnector) {
              // 확정된 그룹에 속한 노드 ID 수집
              const confirmedNodeIds = new Set()
              const confirmedConnectorIds = new Set()
              currentNodes.forEach(node => {
                if (node && node.type === 'groupConnector' && node.data?.isConfirmed === true) {
                  confirmedConnectorIds.add(node.id)
                  const nodeIds = node.data?.nodeIds || []
                  nodeIds.forEach(id => confirmedNodeIds.add(id))
                }
              })
              
              // 확정되지 않은 edge만 그룹화
              const unconfirmedEdges = updatedEdges.filter(edge => {
                const isSourceConfirmed = confirmedNodeIds.has(edge.source)
                const isTargetConfirmed = confirmedNodeIds.has(edge.target)
                return !(isSourceConfirmed && isTargetConfirmed)
              })
              
              // 현재 connection과 같은 그룹에 속한 edge 찾기
              const findConnectedEdges = (startNodeId, visited = new Set(), visitedConnectors = new Set()) => {
                if (visited.has(startNodeId)) return []
                if (confirmedNodeIds.has(startNodeId)) return []
                if (confirmedConnectorIds.has(startNodeId)) {
                  if (visitedConnectors.has(startNodeId)) return []
                  visitedConnectors.add(startNodeId)
                  return []
                }
                visited.add(startNodeId)
                const connected = []
                unconfirmedEdges.forEach(edge => {
                  if (edge.source === startNodeId || edge.target === startNodeId) {
                    connected.push(edge)
                    const nextNodeId = edge.source === startNodeId ? edge.target : edge.source
                    connected.push(...findConnectedEdges(nextNodeId, visited, visitedConnectors))
                  }
                })
                return connected
              }
              
              const startNodeIdForGroup = connection.source === newGroupConnector.id 
                ? connection.target 
                : connection.target === newGroupConnector.id 
                  ? connection.source 
                  : connection.source
              
              const visitedConnectorsSet = new Set()
              const groupEdges = findConnectedEdges(startNodeIdForGroup, new Set(), visitedConnectorsSet)
              const uniqueGroupEdges = Array.from(new Map(groupEdges.map(e => [e.id, e])).values())
              
              const groupNodeIds = new Set()
              uniqueGroupEdges.forEach(edge => {
                groupNodeIds.add(edge.source)
                groupNodeIds.add(edge.target)
              })
              groupNodeIds.add(connection.source)
              groupNodeIds.add(connection.target)
              visitedConnectorsSet.forEach(connectorId => {
                groupNodeIds.add(connectorId)
              })
              
              const addedParts = []
              groupNodeIds.forEach(nodeId => {
                const node = [...currentNodes, ...groupConnectorNodes].find(n => n && n.id === nodeId)
                if (node && node.type === 'groupConnector' && node.data?.isConfirmed === true) {
                  if (!addedParts.some(p => p.id === node.id)) {
                    addedParts.push(node)
                  }
                }
              })
              
              groupNodeIds.forEach(nodeId => {
                if (confirmedNodeIds.has(nodeId)) return
                if (confirmedConnectorIds.has(nodeId)) return
                const node = [...currentNodes, ...groupConnectorNodes].find(n => n && n.id === nodeId)
                if (node && node.type === 'partNode') {
                  if (!addedParts.some(p => p.id === node.id)) {
                    addedParts.push(node)
                  }
                }
              })
              
              setTimeout(() => {
                setAddedParts(addedParts)
              }, 0)
            }
          }

          // 기존 connector 중 updateEdgeLabels가 반환하지 않은 것도 유지 (확정된 connector만)
          // updateEdgeLabels가 반환한 connector를 우선 사용 (확정/미확정 모두)
          existingConnectorMap.forEach((existingConnector, id) => {
            if (!updatedConnectorMap.has(id)) {
              // 확정되고 숨겨지지 않은 connector는 유지 (안전장치)
              if (existingConnector.data?.isConfirmed === true && !existingConnector.data?.hidden) {
                updatedConnectorMap.set(id, existingConnector)
              }
            }
            // updateEdgeLabels가 반환한 connector가 있으면 그것을 사용 (확정/미확정 모두)
            // updateEdgeLabels가 최신 상태를 반환하므로 우선 사용
          })

          const finalConnectors = Array.from(updatedConnectorMap.values())

          setTimeout(() => setEdges(updatedEdges), 0)
          return [...filteredNodes, ...finalConnectors]
        })
        return currentEdges
      })
    }, 100)
  }, [rfInstance, setNodes, setEdges, handleNodeEdit, updateEdgeLabels, findAllConnectedPartNodes, handleEdgeDelete, handleNodeSettingsClick, showSmallAlert, setShowSettingsPanel, setFocusField, settingsDataRef, selectedNodeId, setAddedParts])

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
        }}
        onSave={handleSave}
      />

      <div className="editor-main">
        <div className="canvas-area">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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
            minZoom={0.5}
            maxZoom={2}
            attributionPosition="bottom-left"
            connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 2 }}
            connectionLineType="smoothstep"
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
        />

        <PartsPanel
          patterns={patterns}
          nodes={nodes}
          onPartDragStart={(e, part) => {
            setDraggedPart(part)
            e.dataTransfer.effectAllowed = 'move'
          }}
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