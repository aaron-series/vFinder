import { useState, useRef, useEffect, useCallback } from 'react'
import Swal from 'sweetalert2'
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
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

// Dagre 레이아웃 설정
const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const nodeWidth = NODE_WIDTH
const nodeHeight = NODE_HEIGHT

// 노드 및 엣지 컴포넌트는 별도 파일에서 import됨

const nodeTypes = {
  partNode: PartNode,
  groupConnector: GroupConnectorNode,
}

const edgeTypes = {
  custom: CustomEdge,
}

function RoutingTreeEditor() {
  // Zustand store에서 데이터 가져오기
  const { formData, patterns, reorderPatterns } = useRoutingStore()

  const [nodes, setNodes, onNodesChangeBase] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [draggedPart, setDraggedPart] = useState(null)
  const [showPartsListModal, setShowPartsListModal] = useState(false)
  const [draggedRowIndex, setDraggedRowIndex] = useState(null)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [settingsData, setSettingsData] = useState(INITIAL_SETTINGS_DATA)
  const settingsDataRef = useRef(settingsData)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [addedParts, setAddedParts] = useState([])


  /* 
   * 캔버스 리셋 이벤트 처리
   */
  const handleReset = () => {
    Swal.fire({
      title: 'Reset Canvas',
      html: 'Are you sure you want to reset the canvas?<br/>All nodes and edges will be removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Reset',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        setNodes([])
        setEdges([])
        setShowSettingsPanel(false)
        setSelectedNodeId(null)
        setAddedParts([])
      }
    })
  }

  /* 
   * 노드 설정 패널 열기 이벤트 처리
   */
  const handleNodeSettingsClick = useCallback((nodeId) => {
    setNodes((currentNodes) => {
      const node = currentNodes.find(n => n.id === nodeId)
      if (!node) return currentNodes
      
      setEdges((currentEdges) => {
        setSelectedNodeId(nodeId)
        setShowSettingsPanel(true)
        
        const connectedNodeIds = new Set([nodeId])
        const findAllConnectedNodes = (currentNodeId) => {
          currentEdges.forEach(edge => {
            if (edge.source === currentNodeId && !connectedNodeIds.has(edge.target)) {
              connectedNodeIds.add(edge.target)
              findAllConnectedNodes(edge.target)
            }
            if (edge.target === currentNodeId && !connectedNodeIds.has(edge.source)) {
              connectedNodeIds.add(edge.source)
              findAllConnectedNodes(edge.source)
            }
          })
        }
        
        findAllConnectedNodes(nodeId)
        
        const otherConnectedNodeIds = Array.from(connectedNodeIds).filter(id => id !== nodeId)
        const connectedNodes = currentNodes.filter(n => otherConnectedNodeIds.includes(n.id))
        
        const hasConnectedEdges = currentEdges.some(edge => 
          edge.source === nodeId || edge.target === nodeId
        )
        
        let savedSettings = null
        if (hasConnectedEdges) {
          for (const id of connectedNodeIds) {
            const n = currentNodes.find(n => n.id === id)
            if (n?.data?.savedSettings && Object.keys(n.data.savedSettings).length > 0) {
              if (n.data.savedSettings.processOrder) {
                savedSettings = n.data.savedSettings
                break
              }
            }
          }
        } else {
          if (node.data?.savedSettings && Object.keys(node.data.savedSettings).length > 0) {
            savedSettings = node.data.savedSettings
          }
        }
        
        if (savedSettings) {
          setSettingsData(savedSettings)
        } 
        else if (!hasConnectedEdges) {
          setSettingsData(INITIAL_SETTINGS_DATA)
        }
        
        setAddedParts([node, ...connectedNodes])
        return currentEdges
      })
      
      return currentNodes
    })
  }, [setNodes, setEdges])


  /* 
   * 파츠를 캔버스에 드롭 이벤트 처리 (드래그 앤 드롭 시 드롭 효과 설정)
   */
  const onDrop = useCallback(
    (event) => {
      event.preventDefault()

      if (!draggedPart) return

      const reactFlowBounds = event.currentTarget.getBoundingClientRect()
      const isTextPart = draggedPart.isTextPart || false
      const nodeWidthForDrop = isTextPart ? 400 : nodeWidth // text node인 경우 width를 400px로 설정
      
      const newNode = {
        id: `node-${Date.now()}`,
        type: 'partNode',
        position: {
          x: event.clientX - reactFlowBounds.left - nodeWidthForDrop / 2,
          y: event.clientY - reactFlowBounds.top - nodeHeight / 2,
        },
        draggable: true, // 새 노드는 기본적으로 드래그 가능
        data: { 
          label: isTextPart ? '' : draggedPart.code,
          number: nodes.length + 1,
          isLastNode: true,
          thumbnail: draggedPart.thumbnail,
          isTextNode: isTextPart,
          text: isTextPart ? '' : undefined,
          step: 'STEP.',
          stepValue: '',
          hasConnectedEdge: false,
          isConfirmed: false
        },
      }

      // 기존 노드들의 isLastNode를 false로 설정
      setNodes((nds) => {
        let updatedNodes;
        if (nds.length > 0) {
          // 기존 노드가 있으면 모두 isLastNode를 false로 설정
          updatedNodes = nds.map(node => ({
            ...node,
            data: { 
              ...node.data, 
              isLastNode: false
            }
          }))
        } else {
          // 기존 노드가 없으면 그대로 반환
          updatedNodes = nds
        }
        const finalNodes = [...updatedNodes, newNode]
        
        // 새로 생성된 노드의 설정 패널 자동으로 열기
        setTimeout(() => {
          handleNodeSettingsClick(newNode.id)
        }, 100)
        
        return finalNodes
      })
      
      setDraggedPart(null)
    },
    [draggedPart, nodes.length, setNodes, handleNodeSettingsClick]
  )

  /* 
   * 드래그 오버 이벤트 처리 (드래그 앤 드롭 시 드롭 효과 설정)
   */
  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  /* 
   * 파츠 드래그 시작 이벤트 처리 (드래그 앤 드롭 시 드롭 효과 설정)
   */
  const onPartDragStart = (event, part) => {
    setDraggedPart(part)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="editor-container">
      {/* Parts List Modal */}
      <PartsListModal
        isOpen={showPartsListModal}
        onClose={() => setShowPartsListModal(false)}
        patterns={patterns}
        reorderPatterns={reorderPatterns}
        draggedRowIndex={draggedRowIndex}
        setDraggedRowIndex={setDraggedRowIndex}
      />

      {/* Header */}
      <EditorHeader />

      {/* Meta Bar */}
      <EditorMetaBar formData={formData} onReset={handleReset} />

      {/* Main Content */}
      <div className="editor-main">
        {/* Canvas Area with ReactFlow */}
        <div className="canvas-area">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            // onNodesChange={onNodesChange}
            // onEdgesChange={onEdgesChange}
            // onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
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
            {/* <MiniMap 
              nodeColor={(node) => '#2563eb'}
              maskColor="rgba(0, 0, 0, 0.1)"
            /> */}
            {/* <Panel position="top-left" className="layout-panel">
              <button className="layout-btn" onClick={() => onLayout('TB')}>
                세로 정렬
              </button>
              <button className="layout-btn" onClick={() => onLayout('LR')}>
                가로 정렬
              </button>
            </Panel> */}
            {/* {nodes.length === 0 && (
              <Panel position="top-center" className="empty-panel">
                <div className="canvas-placeholder">
                  <p className="canvas-message">하단의 Part를 드래그하여</p>
                  <p className="canvas-message">Routing Tree 생성을 시작하세요.</p>
                </div>
              </Panel>
            )} */}
          </ReactFlow>
        </div>

        {/* Settings Process Panel */}
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
          // handleNodeDelete={handleNodeDelete}
          setSelectedNodeId={setSelectedNodeId}
          setAddedParts={setAddedParts}
          // updateEdgeLabels={updateEdgeLabels}
        />

        {/* Parts Panel */}
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

export default RoutingTreeEditor
