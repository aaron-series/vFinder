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
  const { formData, patterns, reorderPatterns } = useRoutingStore()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [draggedPart, setDraggedPart] = useState(null)
  const [showPartsListModal, setShowPartsListModal] = useState(false)
  const [draggedRowIndex, setDraggedRowIndex] = useState(null)
  
  // 설정 패널 관련 상태
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [settingsData, setSettingsData] = useState(INITIAL_SETTINGS_DATA)
  const settingsDataRef = useRef(settingsData) // 최신 상태 참조용 Ref
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [addedParts, setAddedParts] = useState([])
  
  // React Flow 인스턴스 (좌표 변환용)
  const [rfInstance, setRfInstance] = useState(null)

  // settingsData가 변경될 때 ref 업데이트
  useEffect(() => {
    settingsDataRef.current = settingsData
  }, [settingsData])

  /* * 노드 설정 패널 열기
   */
  const handleNodeSettingsClick = useCallback((nodeId) => {
    setNodes((currentNodes) => {
      const node = currentNodes.find(n => n.id === nodeId)
      if (!node) return currentNodes
      
      // 설정 패널 열기
      setSelectedNodeId(nodeId)
      setShowSettingsPanel(true)
      
      // 연결된 노드 찾기 (그룹핑 로직)
      setEdges((currentEdges) => {
        const connectedNodeIds = new Set([nodeId])
        // 단순 구현: 현재 노드와 연결된 모든 노드를 재귀적으로 탐색하는 로직 필요
        // 여기서는 간단히 직접 연결된 것만 확인하거나, 기존 로직 유지
        
        // ... (연결된 노드 탐색 로직 - 기존 코드 참조)
        
        // 저장된 설정 불러오기
        if (node.data?.savedSettings && Object.keys(node.data.savedSettings).length > 0) {
          setSettingsData(node.data.savedSettings)
        } else {
          setSettingsData(INITIAL_SETTINGS_DATA)
        }
        
        setAddedParts([node]) // 실제로는 연결된 모든 노드를 배열에 넣어야 함
        return currentEdges
      })
      
      return currentNodes
    })
  }, [setNodes, setEdges])

  /*
   * 노드 Step Value 변경 핸들러
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

  /*
   * 노드 삭제 핸들러
   */
  const handleNodeDelete = useCallback((id) => {
    setNodes((nds) => nds.filter((node) => node.id !== id))
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id))
    
    if (selectedNodeId === id) {
      setShowSettingsPanel(false)
      setSelectedNodeId(null)
    }
  }, [setNodes, setEdges, selectedNodeId])

  /*
   * 확정(Confirm) 핸들러
   */
  const handleNodeConfirm = useCallback((id) => {
    // 1. 유효성 검사
    const currentSettings = settingsDataRef.current
    if (!currentSettings.processOrder) {
      showSmallAlert({ icon: 'warning', title: 'Process Order is required' })
      return
    }
    if (!currentSettings.processSelection) {
      showSmallAlert({ icon: 'warning', title: 'Process Selection is required' })
      return
    }

    // 대상 식별 (노드 ID인지 엣지 ID인지 확인)
    const isEdge = id.includes('edge') || edges.some(e => e.id === id)
    
    if (!isEdge) {
      // --- 단일 노드 확정 로직 ---
      setNodes((nds) => {
        const targetNode = nds.find(n => n.id === id)
        if (!targetNode) return nds
        
        if (!targetNode.data.stepValue) {
          showSmallAlert({ icon: 'warning', title: 'Step Value is required' })
          return nds
        }

        // DOM에서 라벨 박스 위치 가져오기
        const labelBox = document.querySelector(`.node-label-box[data-node-id="${id}"]`)
        let position = { x: targetNode.position.x + 90, y: targetNode.position.y + 260 } // 기본값

        if (labelBox && rfInstance) {
          const rect = labelBox.getBoundingClientRect()
          // 화면 좌표를 ReactFlow 좌표로 변환
          position = rfInstance.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top
          })
        }

        // 커넥터 노드 생성 (확정된 라벨박스 역할)
        const connectorNode = {
          id: `single-node-connector-${id}`,
          type: 'groupConnector',
          position: position,
          data: {
            isConfirmed: true,
            isGroupBox: false,
            nodeId: id
          },
          zIndex: 1001
        }

        // 노드 상태 업데이트 (확정됨, 드래그 불가, 설정 저장)
        return [
          ...nds.map(node => {
            if (node.id === id) {
              return {
                ...node,
                draggable: false,
                data: {
                  ...node.data,
                  isConfirmed: true,
                  savedSettings: { ...currentSettings }
                }
              }
            }
            return node
          }),
          connectorNode
        ]
      })
    } else {
      // --- 엣지(그룹) 확정 로직 (추후 구현 또는 기존 로직 확장) ---
      // 엣지 확정 시에는 연결된 소스/타겟 노드 모두를 확정 상태로 변경해야 함
      console.log('Edge confirm logic needs to be implemented for:', id)
    }
  }, [edges, rfInstance, setNodes])

  /* * 파츠 드롭 (노드 생성)
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
      
      const newNode = {
        id: newNodeId,
        type: 'partNode',
        position,
        draggable: true,
        data: { 
          label: isTextPart ? '' : draggedPart.code,
          number: nodes.length + 1, // 단순 카운트 (실제로는 id 기반 등 고유값 권장)
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
          // 텍스트 변경 등 추가 핸들러 필요 시 연결
          onTextChange: (id, val) => {
             setNodes(nds => nds.map(n => n.id === id ? {...n, data: {...n.data, text: val}} : n))
          }
        },
      }

      setNodes((nds) => {
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
    [draggedPart, rfInstance, nodes.length, setNodes, handleNodeSettingsClick, handleNodeDelete, handleNodeStepChange, handleNodeConfirm]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="editor-container">
      <PartsListModal
        isOpen={showPartsListModal}
        onClose={() => setShowPartsListModal(false)}
        patterns={patterns}
        reorderPatterns={reorderPatterns}
        draggedRowIndex={draggedRowIndex}
        setDraggedRowIndex={setDraggedRowIndex}
      />

      <EditorHeader />
      <EditorMetaBar formData={formData} onReset={() => {
        setNodes([])
        setEdges([])
        setAddedParts([])
        setShowSettingsPanel(false)
      }} />

      <div className="editor-main">
        <div className="canvas-area">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setRfInstance}
            onPaneClick={() => {
              setShowSettingsPanel(false)
              setSelectedNodeId(null)
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
            minZoom={0.5}
            maxZoom={2}
            attributionPosition="bottom-left"
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
          }}
          addedParts={addedParts}
          settingsData={settingsData}
          setSettingsData={setSettingsData}
          selectedNodeId={selectedNodeId}
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          handleNodeDelete={handleNodeDelete}
          setSelectedNodeId={setSelectedNodeId}
          setAddedParts={setAddedParts}
          // updateEdgeLabels={updateEdgeLabels} // 필요 시 구현하여 전달
          updateEdgeLabels={() => {}} 
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