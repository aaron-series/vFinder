import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactFlow, { Controls, Background, useNodesState, useEdgesState, ReactFlowProvider } from 'reactflow'
import 'reactflow/dist/style.css'
import useRoutingStore from './store/useRoutingStore'
import { NODE_WIDTH, NODE_HEIGHT, INITIAL_SETTINGS_DATA, ZOOM, ZOOM_MIN, ZOOM_MAX } from './constants'
import { syncConnectorPositions, calculateConnectorPosition } from './services/connectorService'
import { updateEdgeLabels } from './services/edgeLabelService'
import { exportImage } from './services/exportService'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useEdgeHandlers } from './hooks/useEdgeHandlers'
import { useNodeHandlers } from './hooks/useNodeHandlers'
import { useDragAndDrop } from './hooks/useDragAndDrop'
import { useSelectionHandler } from './hooks/useSelectionHandler'
import { useConnectionHandler } from './hooks/useConnectionHandler'
import { PartNode, GroupConnectorNode } from './components/nodes'
import { CustomEdge } from './components/edges'
import { EditorHeader, EditorMetaBar, SettingsProcessPanel, PartsPanel } from './components/layout'
import PartsListModal from './components/modals/PartsListModal'
import './RoutingTreeEditor.css'

function EditorContent() {
  const nodeTypes = useMemo(() => ({ partNode: PartNode, groupConnector: GroupConnectorNode }), [])
  const edgeTypes = useMemo(() => ({ custom: CustomEdge }), [])
  const { formData, patterns, reorderPatterns, removePattern } = useRoutingStore()
  
  // State
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showPartsListModal, setShowPartsListModal] = useState(false)
  const [draggedRowIndex, setDraggedRowIndex] = useState(null)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [focusField, setFocusField] = useState(null)
  const [settingsData, setSettingsData] = useState(INITIAL_SETTINGS_DATA)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [addedParts, setAddedParts] = useState([])
  const [isEdgeConfirmed, setIsEdgeConfirmed] = useState(false)
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [rfInstance, setRfInstance] = useState(null)
  const settingsDataRef = useRef(settingsData)
  const addedPartsRef = useRef(addedParts)
  const confirmingRef = useRef(new Set())

  // Refs Sync
  useEffect(() => { settingsDataRef.current = settingsData }, [settingsData])
  useEffect(() => { addedPartsRef.current = addedParts }, [addedParts])

  // Callbacks
  const calculateConnectorPositionCallback = useCallback((connectedEdges, currentNodes, rfInst) => 
    calculateConnectorPosition(connectedEdges, currentNodes, rfInst), [])
  const updateEdgeLabelsCallback = useCallback((currentEdges, currentNodes, rfInst, onDelete, onSettings, onConfirm, onAdd, targetGroup) => 
    updateEdgeLabels(currentEdges, currentNodes, rfInst, onDelete, onSettings, onConfirm, onAdd, targetGroup), [])
  const syncConnectorPositionsCallback = useCallback((nodes, edges) => 
    syncConnectorPositions(nodes, edges, rfInstance), [rfInstance])

  // 1. Edge Handlers
  const { handleEdgeDelete } = useEdgeHandlers({
    setEdges, setNodes, setIsEdgeConfirmed, setShowSettingsPanel, setSelectedNodeId
  })

  // 2. Selection Handler (설정 클릭)
  const { handleNodeSettingsClick } = useSelectionHandler({
    setNodes, setEdges, setSelectedNodeId, setShowSettingsPanel,
    setIsEdgeConfirmed, setSettingsData, setAddedParts
  })

  // 3. Node Handlers (편집/확정/삭제)
  const {
    handleNodeStepChange, handleNodeDelete, handleNodeEdit, handleNodeConfirm, handleNodeAdd,
    onNodeDragStart, onNodeDrag, onNodeDragStop
  } = useNodeHandlers({
    nodes, edges, setNodes, setEdges, rfInstance, settingsDataRef, addedPartsRef,
    confirmingRef, setIsEdgeConfirmed, setShowSettingsPanel, setFocusField,
    setSelectedNodeId, setAddedParts, setSettingsData, handleEdgeDelete,
    handleNodeSettingsClick, calculateConnectorPositionCallback, updateEdgeLabelsCallback
  })

  // 4. Connection Handler (연결/자석)
  const { onConnect, onConnectStart, onConnectEnd, connectionLineType } = useConnectionHandler({
    nodes, edges, setNodes, setEdges, rfInstance, handleNodeEdit, handleNodeConfirm,
    handleNodeSettingsClick, handleEdgeDelete, updateEdgeLabelsCallback,
    syncConnectorPositionsCallback, setAddedParts, setSettingsData,
    setSelectedNodeId, setShowSettingsPanel
  })

  // 5. Drag & Drop Handler
  const { onPartDragStart, onDrop, onDragOver } = useDragAndDrop({
    nodes, setNodes, rfInstance, nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT,
    handleNodeSettingsClick, handleNodeDelete, handleNodeStepChange, handleNodeConfirm, handleNodeEdit
  })

  // 6. LocalStorage Handler
  const { handleSave, clearLocalStorage } = useLocalStorage({
    formData, patterns, nodes, edges, rfInstance, setNodes, setEdges,
    handleNodeEdit, handleNodeConfirm, handleNodeSettingsClick, handleNodeDelete, handleNodeStepChange
  })

  // 7. General Events (Node Change & Double Click)
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes)
    if (changes.some(c => c.type === 'position' && !c.dragging)) {
      setNodes(curr => {
        syncConnectorPositionsCallback(curr, edges).then(updated => updated && setNodes(updated))
        return curr
      })
    }
  }, [onNodesChange, edges, setNodes, syncConnectorPositionsCallback])

  useEffect(() => {
    const handleDbClick = (e) => e.target.closest('.react-flow__pane') && (e.preventDefault(), e.stopPropagation())
    document.addEventListener('dblclick', handleDbClick, true)
    return () => document.removeEventListener('dblclick', handleDbClick, true)
  }, [])

  return (
    <div className="editor-container">
      <PartsListModal
        isOpen={showPartsListModal} onClose={() => setShowPartsListModal(false)}
        patterns={patterns} reorderPatterns={reorderPatterns} removePattern={removePattern}
        draggedRowIndex={draggedRowIndex} setDraggedRowIndex={setDraggedRowIndex}
      />
      <EditorHeader />
      <EditorMetaBar
        formData={formData}
        onReset={() => {
          setNodes([]); setEdges([]); setAddedParts([]); setShowSettingsPanel(false);
          setSelectedNodeId(null); setIsEdgeConfirmed(false); clearLocalStorage();
        }}
        onSave={handleSave}
        onExportImage={() => exportImage(rfInstance, setIsExportingImage)}
        isExportingImage={isExportingImage}
      />
      <div className="editor-main">
        <div className="canvas-area">
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange}
            onNodeDragStart={onNodeDragStart} onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop}
            onConnect={onConnect} onConnectStart={onConnectStart} onConnectEnd={onConnectEnd}
            onDrop={onDrop} onDragOver={onDragOver}
            onInit={setRfInstance}
            onPaneClick={() => { setShowSettingsPanel(false); setSelectedNodeId(null); }}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: ZOOM }} minZoom={ZOOM_MIN} maxZoom={ZOOM_MAX}
            attributionPosition="bottom-left"
            connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 2 }}
            connectionLineType={connectionLineType} connectionRadius={60} autoPanOnConnect={true} deleteKeyCode={null}
          >
            <Background color="#aaa" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
        <SettingsProcessPanel
          isOpen={showSettingsPanel}
          onClose={() => { setShowSettingsPanel(false); setSelectedNodeId(null); setFocusField(null); setIsEdgeConfirmed(false); }}
          addedParts={addedParts} settingsData={settingsData} setSettingsData={setSettingsData}
          selectedNodeId={selectedNodeId} isEdgeConfirmed={isEdgeConfirmed}
          nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges}
          handleNodeDelete={handleNodeDelete} setSelectedNodeId={setSelectedNodeId} setAddedParts={setAddedParts}
          updateEdgeLabels={updateEdgeLabelsCallback} focusField={focusField}
          findAllConnectedPartNodes={null} // Not used inside panel anymore? or pass util if needed
          handleEdgeDelete={handleEdgeDelete} handleNodeSettingsClick={handleNodeSettingsClick}
          handleNodeConfirm={handleNodeConfirm} rfInstance={rfInstance} formData={formData}
        />
        <PartsPanel
          patterns={patterns} nodes={nodes}
          onPartDragStart={onPartDragStart} onShowPartsListModal={() => setShowPartsListModal(true)}
        />
      </div>
    </div>
  )
}

export default function RoutingTreeEditor() {
  return (
    <ReactFlowProvider>
      <EditorContent />
    </ReactFlowProvider>
  )
}