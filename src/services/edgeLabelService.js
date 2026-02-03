import { EditorUtils } from '../helper'
import { LABEL_BOX_HEIGHT } from '../constants'

/**
 * Edge 라벨 및 그룹 커넥터 업데이트 메인 함수
 */
export const updateEdgeLabels = (
  currentEdges, 
  currentNodes, 
  rfInst = null, 
  handleEdgeDeleteFn = null, 
  handleNodeSettingsClickFn = null, 
  handleNodeConfirmFn = null, 
  handleNodeAddFn = null,
  targetGroupId = null
) => {
  // 1. 유효성 체크
  if (!isValidInput(currentEdges, currentNodes)) {
    return { updatedEdges: currentEdges || [], groupConnectorNodes: [] }
  }

  // 2. 확정된 그룹 정보 분석
  const { confirmedGroups, confirmedEdgeIds, confirmedNodeIds, confirmedConnectors } = analyzeConfirmedGroups(currentNodes, targetGroupId)

  // 3. 엣지 그룹화 (확정되지 않은 엣지 그룹화 + 확정된 그룹 포함)
  const edgeGroups = groupAllEdges(currentEdges, confirmedEdgeIds, confirmedNodeIds, confirmedGroups)

  // 4. 라벨 표시 여부 결정 (미리 계산)
  const edgesToShowLabel = determineLabelVisibility(edgeGroups, currentEdges)

  // 5. 엣지 데이터 업데이트 (핸들러 연결 및 라벨 표시 설정)
  const updatedEdges = processEdges(
    currentEdges, 
    edgesToShowLabel, 
    handleEdgeDeleteFn, 
    handleNodeSettingsClickFn, 
    handleNodeConfirmFn,
    handleNodeAddFn
  )

  // 6. 그룹 커넥터 노드 생성 및 업데이트
  const groupConnectorNodes = generateAllConnectors(
    currentNodes, 
    edgeGroups, 
    confirmedConnectors, 
    confirmedNodeIds, 
    targetGroupId, 
    currentEdges // connectedEdges 확인용
  )

  return { updatedEdges, groupConnectorNodes }
}

/* ==========================================================================
   Helper Functions (Internal)
   ========================================================================== */

// 입력 데이터 유효성 검사
const isValidInput = (edges, nodes) => {
  return edges && Array.isArray(edges) && nodes && Array.isArray(nodes)
}

// 확정된 그룹 및 커넥터 분석
const analyzeConfirmedGroups = (nodes, targetGroupId) => {
  const confirmedConnectors = []
  const confirmedGroups = new Map()
  const confirmedEdgeIds = new Set()
  const confirmedNodeIds = new Set()

  nodes.forEach(node => {
    if (node?.type !== 'groupConnector' || node.data?.isConfirmed !== true) return

    confirmedConnectors.push(node)

    // 그룹 정보 추출
    let groupId = null
    let groupEdges = []
    let nodeIds = []

    if (node.data?.isGroupBox && node.data?.groupEdges) {
      groupId = node.data.groupId || `group-${node.id}`
      groupEdges = node.data.groupEdges
      nodeIds = node.data.nodeIds || []
    } else if (node.data?.nodeId) {
      groupId = `single-node-${node.data.nodeId}`
      nodeIds = [node.data.nodeId]
    }

    if (groupId) {
      // 타겟 그룹 필터링
      if (targetGroupId && groupId !== targetGroupId && !node.data?.isGroupBox) {
        // 단일 노드 그룹이면서 타겟이 아니면 스킵 (로직 유지)
      } else {
        confirmedGroups.set(groupId, {
          connectorId: node.id,
          connector: node,
          groupEdges,
          nodeIds
        })
      }

      // ID 수집
      groupEdges.forEach(id => confirmedEdgeIds.add(id))
      nodeIds.forEach(id => confirmedNodeIds.add(id))
    }
  })

  return { confirmedGroups, confirmedEdgeIds, confirmedNodeIds, confirmedConnectors }
}

// 모든 엣지 그룹화 (미확정 + 확정)
const groupAllEdges = (currentEdges, confirmedEdgeIds, confirmedNodeIds, confirmedGroups) => {
  const edgeGroups = []
  
  // 1. 미확정 엣지 그룹화 (DFS)
  const unconfirmedEdges = currentEdges.filter(edge => !confirmedEdgeIds.has(edge.id))
  const processedEdgeIds = new Set()

  const findConnected = (startNodeId, visited = new Set()) => {
    if (visited.has(startNodeId) || confirmedNodeIds.has(startNodeId)) return []
    visited.add(startNodeId)

    const connected = []
    unconfirmedEdges.forEach(edge => {
      if (edge.source === startNodeId || edge.target === startNodeId) {
        connected.push(edge)
        const nextNode = edge.source === startNodeId ? edge.target : edge.source
        connected.push(...findConnected(nextNode, visited))
      }
    })
    return connected
  }

  unconfirmedEdges.forEach(edge => {
    if (processedEdgeIds.has(edge.id)) return
    const group = findConnected(edge.source)
    const uniqueGroup = Array.from(new Map(group.map(e => [e.id, e])).values()) // 중복 제거
    
    if (uniqueGroup.length > 0) {
      uniqueGroup.forEach(e => processedEdgeIds.add(e.id))
      edgeGroups.push(uniqueGroup)
    }
  })

  // 2. 확정된 그룹 추가
  confirmedGroups.forEach(group => {
    if (group.groupEdges.length > 0) {
      const edges = currentEdges.filter(e => group.groupEdges.includes(e.id))
      if (edges.length > 0) edgeGroups.push(edges)
    }
  })

  return edgeGroups
}

// 라벨을 표시할 엣지 ID 결정
const determineLabelVisibility = (edgeGroups, allEdges) => {
  const edgesToShow = new Set()

  // 그룹에 속하지 않은 엣지 중 showLabel이 true인 것 유지
  const edgesInGroups = new Set(edgeGroups.flat().map(e => e.id))
  allEdges.forEach(edge => {
    if (!edgesInGroups.has(edge.id) && edge.data?.showLabel !== false) {
      edgesToShow.add(edge.id)
    }
  })

  // 각 그룹별 대표 엣지 선정
  edgeGroups.forEach(group => {
    let labelEdgeId = null

    // 1. 확정된 엣지 중 라벨이 있는 것 우선
    const confirmedWithLabel = group.find(e => e.data?.isConfirmed && e.data?.showLabel === true)
    if (confirmedWithLabel) {
      labelEdgeId = confirmedWithLabel.id
    } else if (!group.some(e => e.data?.isConfirmed)) {
      // 2. 미확정 그룹: 기존에 라벨이 있던 것 우선
      const existingLabel = group.find(e => e.data?.showLabel === true)
      labelEdgeId = existingLabel ? existingLabel.id : group[0]?.id
    }

    if (labelEdgeId) edgesToShow.add(labelEdgeId)
  })

  return edgesToShow
}

// 엣지 데이터 업데이트 (핸들러 주입)
const processEdges = (edges, edgesToShowLabel, onDelete, onSettings, onConfirm, onAdd) => {
  return edges.map(edge => {
    const edgeData = { ...edge.data }

    // 핸들러 주입
    if (onDelete && !edgeData.onDelete) edgeData.onDelete = onDelete
    if (onSettings) edgeData.onSettingsClick = (id) => onSettings(id || edge.id)
    if (onConfirm) edgeData.onConfirm = () => onConfirm(edge.id)
    if (onAdd) edgeData.onAdd = () => onAdd(edge.id)

    // 확정된 엣지는 라벨 상태 유지, 아니면 계산된 결과 적용
    if (edge.data?.isConfirmed) {
      edgeData.isConfirmed = true
      // showLabel 값 유지
    } else {
      edgeData.showLabel = edgesToShowLabel.has(edge.id)
    }

    return { ...edge, data: edgeData }
  })
}

// 모든 그룹 커넥터 노드 생성 (다중 그룹 + 단일 노드)
const generateAllConnectors = (currentNodes, edgeGroups, confirmedConnectors, confirmedNodeIds, targetGroupId, currentEdges) => {
  const resultConnectors = []
  const processedConnectorIds = new Set()

  // 1. 확정된 커넥터 유지
  confirmedConnectors.forEach(c => {
    resultConnectors.push(c)
    processedConnectorIds.add(c.id)
  })

  // 2. 기존의 미확정 커넥터 유지 (화면 깜빡임 방지용)
  currentNodes.forEach(node => {
    if (node?.type === 'groupConnector' && !node.data?.isConfirmed && !processedConnectorIds.has(node.id)) {
      if (node.data?.isGroupBox) { // 그룹박스인 경우만, 단일노드는 아래에서 재계산
         resultConnectors.push(node)
         processedConnectorIds.add(node.id)
      }
    }
  })

  // 3. 다중 엣지 그룹에 대한 커넥터 처리
  edgeGroups.forEach(group => {
    // 확정된 그룹이고, 특정 타겟 그룹을 수정하는 경우가 아니면 스킵
    const isConfirmedGroup = group.some(e => e.data?.isConfirmed)
    if (isConfirmedGroup && !targetGroupId) return

    const groupNodeIds = new Set()
    group.forEach(e => { groupNodeIds.add(e.source); groupNodeIds.add(e.target) })
    
    // 유효한 파츠 노드 확인
    const validNodes = currentNodes.filter(n => n && groupNodeIds.has(n.id) && (n.type === 'partNode' || n.type === 'groupConnector'))
    if (validNodes.length === 0) return

    const groupId = EditorUtils.createGroupId(groupNodeIds)
    if (targetGroupId && groupId !== targetGroupId) return

    // 커넥터 생성 또는 업데이트 로직
    const newConnector = createOrUpdateGroupConnector(currentNodes, group, groupId, groupNodeIds)
    
    // 결과 리스트에 추가 (기존 것 대체)
    const existingIdx = resultConnectors.findIndex(c => c.id === newConnector.id)
    if (existingIdx >= 0) {
      resultConnectors[existingIdx] = newConnector
    } else {
      resultConnectors.push(newConnector)
    }
  })

  // 4. 단일 노드 커넥터 및 케이스 5 처리
  const singleNodeConnectors = processSingleNodes(currentNodes, currentEdges, confirmedNodeIds, targetGroupId)
  
  // 단일 노드 커넥터 병합
  singleNodeConnectors.forEach(conn => {
     // 이미 확정된 리스트에 있거나 처리된 경우 제외하고 추가할 수도 있지만, 
     // 여기선 로직에 따라 새로 생성된 정보를 우선시하거나 병합함
     const existingIdx = resultConnectors.findIndex(c => c.id === conn.id)
     if (existingIdx >= 0) {
        // 이미 존재하면 덮어쓰기 (최신 상태 반영)
        // 단, 확정된 상태는 보존해야 할 수도 있음
        if (!resultConnectors[existingIdx].data.isConfirmed) {
            resultConnectors[existingIdx] = conn
        }
     } else {
        resultConnectors.push(conn)
     }
  })

  return resultConnectors
}

// 그룹 커넥터 객체 생성/업데이트
const createOrUpdateGroupConnector = (nodes, groupEdges, groupId, groupNodeIds) => {
  const connectorId = EditorUtils.createGroupConnectorId(groupId)
  const isConfirmed = groupEdges.some(e => e.data?.isConfirmed === true)
  
  // 기존 커넥터 검색 (재활용을 위해)
  const existing = nodes.find(n => n.id === connectorId) || 
                   nodes.find(n => n.type === 'groupConnector' && n.data?.groupId === groupId)

  // 위치 계산
  let position = null
  if (existing) {
     position = existing.position
  } else {
     // 새 위치 계산 (평균값 등)
     position = calculateInitialPosition(nodes, groupEdges)
  }

  // 그룹간 연결 여부 확인
  const hasConnectorIds = Array.from(groupNodeIds).some(id => nodes.find(n => n.id === id)?.type === 'groupConnector')
  const isGroupToGroup = hasConnectorIds && !Array.from(groupNodeIds).some(id => nodes.find(n => n.id === id)?.type === 'partNode')

  return {
    id: connectorId,
    type: 'groupConnector',
    position,
    data: {
      isConfirmed,
      isGroupBox: true,
      groupId,
      groupEdges: groupEdges.map(e => e.id),
      nodeIds: Array.from(groupNodeIds),
      hidden: !isConfirmed,
      isGroupToGroup: isGroupToGroup && !isConfirmed
    },
    zIndex: 1000
  }
}

// 단일 노드 처리 (Case 5 포함)
const processSingleNodes = (nodes, edges, confirmedNodeIds, targetGroupId) => {
  const connectors = []
  
  // 확정된 파츠 노드 중 그룹에 속하지 않은 것
  const targetNodes = nodes.filter(n => 
    n?.type === 'partNode' && 
    n.data?.isConfirmed === true && 
    !confirmedNodeIds.has(n.id)
  )

  targetNodes.forEach(node => {
    const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id)
    
    // Case 5: 단일 노드가 다른 다중 그룹과 연결된 경우
    let isCase5 = false
    if (connectedEdges.length > 0) {
      const connectorId = EditorUtils.createSingleNodeConnectorId(node.id)
      const existing = EditorUtils.findConnector(nodes, connectorId)
      
      if (existing?.data?.isConfirmed) {
         // 연결된 대상이 다중 그룹인지 확인
         isCase5 = connectedEdges.some(edge => {
            const otherId = edge.source === node.id ? edge.target : edge.source
            const otherNode = EditorUtils.findNode(nodes, otherId)
            return otherNode?.type === 'groupConnector' && otherNode.data?.isGroupBox
         })
      }

      if (isCase5 && existing) {
        connectors.push({
          ...existing,
          data: { ...existing.data, hidden: true, isConfirmed: true }
        })
        return
      }
    }

    if (connectedEdges.length > 0) return // 이미 엣지가 있으면 그룹 처리 로직에서 처리됨

    // 단일 노드 커넥터 생성/유지
    const singleGroupId = EditorUtils.createSingleNodeGroupId(node.id)
    if (targetGroupId && singleGroupId !== targetGroupId) return

    const connectorId = EditorUtils.createSingleNodeConnectorId(node.id)
    const existing = EditorUtils.findConnector(nodes, connectorId)

    const position = existing ? existing.position : {
       x: node.position.x + 90,
       y: node.position.y + 260
    }

    connectors.push({
      id: connectorId,
      type: 'groupConnector',
      position,
      data: {
        isConfirmed: true,
        isGroupBox: false,
        nodeId: node.id,
        hidden: false,
        ...existing?.data
      },
      zIndex: 1001
    })
  })

  return connectors
}

// 초기 위치 계산 (간단 버전)
const calculateInitialPosition = (nodes, edges) => {
  let sumX = 0, maxY = 0, count = 0
  edges.forEach(e => {
    const s = nodes.find(n => n.id === e.source)
    const t = nodes.find(n => n.id === e.target)
    if (s && t) {
      sumX += (s.position.x + t.position.x) / 2
      maxY = Math.max(maxY, Math.max(s.position.y, t.position.y) + 180 + LABEL_BOX_HEIGHT)
      count++
    }
  })
  return count > 0 ? { x: sumX / count, y: maxY } : { x: 0, y: 0 }
}