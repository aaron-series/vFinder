import { EditorUtils } from '../helper'
import { LABEL_BOX_HEIGHT } from '../constants'
import { waitForDOMReady } from '../utils/domUtils'
import { getSmoothStepPath } from 'reactflow'

// 커넥터 위치 동기화 함수 (동기 버전)
const syncConnectorPositionsSync = (currentNodes, currentEdges, rfInstance) => {
  if (!currentNodes || !currentEdges || !rfInstance) return currentNodes

  const partNodes = currentNodes.filter(n => n && n.type === 'partNode')
  const updatedNodes = currentNodes.map(node => {
    // 그룹 커넥터인 경우, edge-label-box의 DOM 위치를 사용하여 동기화
    // 확정된 그룹의 커넥터는 위치를 변경하지 않음 (다른 그룹/노드에 간섭받지 않음)
    if (node && node.type === 'groupConnector' && node.data?.isGroupBox === true && node.data?.groupEdges) {
      // 확정된 그룹의 커넥터는 위치를 변경하지 않음
      if (node.data?.isConfirmed === true) {
        return node
      }

      const groupEdges = node.data.groupEdges
      if (groupEdges && groupEdges.length > 0) {
        // edge-label-box DOM 요소들의 좌표 수집
        const labelBoxPositions = []
        const edgeIdsToCheck = []

        groupEdges.forEach(edgeId => {
          const edge = currentEdges.find(e => e && e.id === edgeId)
          // showLabel이 true인 edge의 label-box만 사용
          if (edge && edge.data?.showLabel !== false) {
            edgeIdsToCheck.push(edgeId)
            const labelBox = document.querySelector(`.edge-label-box[data-edge-id="${edgeId}"]`)
            if (labelBox && rfInstance) {
              const rect = labelBox.getBoundingClientRect()
              // 요소가 실제로 렌더링되었는지 확인 (크기가 0이 아닌지)
              if (rect.width > 0 && rect.height > 0) {
                // DOM 좌표를 Flow 좌표로 변환
                const flowPosition = rfInstance.screenToFlowPosition({
                  x: rect.left + rect.width / 2, // 라벨 박스 중앙 x
                  y: rect.bottom // 라벨 박스 하단 y
                })
                labelBoxPositions.push({
                  x: flowPosition.x,
                  y: flowPosition.y
                })
              }
            }
          }
        })

        // 모든 edge-label-box가 렌더링되었는지 확인
        if (labelBoxPositions.length > 0 && labelBoxPositions.length === edgeIdsToCheck.length) {
          // x는 모든 label-box의 평균 x 좌표 (정중앙)
          const connectorX = labelBoxPositions.reduce((sum, pos) => sum + pos.x, 0) / labelBoxPositions.length

          // y는 가장 아래쪽 label-box의 하단 위치
          const maxY = Math.max(...labelBoxPositions.map(pos => pos.y))

          const newPosition = {
            x: connectorX,
            y: maxY
          }

          // 위치가 변경된 경우에만 업데이트
          if (Math.abs(node.position.x - newPosition.x) > 0.1 || Math.abs(node.position.y - newPosition.y) > 0.1) {
            return {
              ...node,
              position: newPosition
            }
          }
        }
      }
    }

    return node
  })

  // 단일 노드 커넥터 위치 업데이트
  partNodes.forEach(node => {
    const connectorId = EditorUtils.createSingleNodeConnectorId(node.id)
    const connectorIndex = updatedNodes.findIndex(n => n && n.id === connectorId)
    if (connectorIndex !== -1) {
      const labelX = node.position.x + 90
      const labelY = node.position.y + 200 + 60
      updatedNodes[connectorIndex] = {
        ...updatedNodes[connectorIndex],
        position: { x: labelX, y: labelY }
      }
    }
  })

  return updatedNodes
}

// 커넥터 위치 동기화 함수 (비동기 버전 - DOM 렌더링 완료 대기)
export const syncConnectorPositions = async (currentNodes, currentEdges, rfInstance) => {
  if (!currentNodes || !currentEdges || !rfInstance) return currentNodes

  // 동기화가 필요한 커넥터의 edge ID 수집
  const edgeIdsToCheck = []
  currentNodes.forEach(node => {
    if (node && node.type === 'groupConnector' && node.data?.isGroupBox === true &&
      node.data?.groupEdges && !node.data?.isConfirmed) {
      node.data.groupEdges.forEach(edgeId => {
        const edge = currentEdges.find(e => e && e.id === edgeId)
        if (edge && edge.data?.showLabel !== false) {
          if (!edgeIdsToCheck.includes(edgeId)) {
            edgeIdsToCheck.push(edgeId)
          }
        }
      })
    }
  })

  if (edgeIdsToCheck.length > 0) {
    // DOM 렌더링 완료 대기
    await waitForDOMReady(edgeIdsToCheck)
  }

  // DOM이 렌더링되었으면 정확한 위치 계산
  return syncConnectorPositionsSync(currentNodes, currentEdges, rfInstance)
}

// 커넥터 위치 계산 함수 (동기 버전)
const calculateConnectorPositionSync = (connectedEdges, nodes, rfInst = null) => {
  if (!connectedEdges || connectedEdges.length === 0) return null

  // 1. 연결된 엣지들이 속한 '그룹 노드' 찾기
  const groupNode = nodes.findLast(n => 
    n.type === 'groupConnector' && 
    n.data?.groupEdges &&
    typeof n.data?.isLastNode === 'undefined'
  )
  console.log('groupNode', groupNode)

  let labelBox = null

  // 2. 그룹 노드가 존재하면, 그룹의 '마지막(최신) 엣지'가 렌더링하는 라벨 박스를 타겟으로 설정
  if (groupNode && groupNode.data?.groupEdges?.length > 0) {
    // [사용자 수정] 배열의 마지막 요소(최신 엣지) 선택
    const latestEdgeId = groupNode.data.groupEdges[groupNode.data.groupEdges.length - 1]
    labelBox = document.querySelector(`.edge-label-box[data-edge-id="${latestEdgeId}"]`)
  } 
  
  // 3. 그룹 노드를 못 찾았거나 라벨 박스가 없으면, 연결된 엣지 중 '마지막(최신) 엣지' 사용 (Fallback)
  if (!labelBox && connectedEdges.length > 0) {
    // [사용자 수정] 배열의 마지막 요소(최신 엣지) 선택
    const latestEdgeId = connectedEdges[connectedEdges.length - 1].id
    labelBox = document.querySelector(`.edge-label-box[data-edge-id="${latestEdgeId}"]`)
  }

  console.log('labelBox', labelBox)

  // 4. 찾은 라벨 박스의 '정중앙' 좌표 계산
  if (labelBox && rfInst) {
    const rect = labelBox.getBoundingClientRect()
    
    // 요소가 실제로 화면에 보일 때만 계산
    if (rect.width > 0 && rect.height > 0) {
      // DOM 좌표를 React Flow 캔버스 좌표로 변환
      const flowPosition = rfInst.screenToFlowPosition({
        x: rect.left + (rect.width / 2), // [핵심] 박스 왼쪽 + (너비/2) = 정중앙 X
        y: rect.bottom // 박스 하단 Y
      })

      return {
        x: flowPosition.x,
        y: flowPosition.y
      }
    }
  }

  return null
}

// 커넥터 위치 계산 함수 (비동기 버전 - DOM 렌더링 완료 대기)
export const calculateConnectorPosition = async (connectedEdges, nodes, rfInst = null) => {
  if (!connectedEdges || connectedEdges.length === 0) return null

  // showLabel이 true인 edge ID 수집
  const edgeIdsToCheck = connectedEdges
    .filter(edge => edge.data?.showLabel !== false)
    .map(edge => edge.id)

  if (edgeIdsToCheck.length === 0) {
    return calculateConnectorPositionSync(connectedEdges, nodes, rfInst)
  }

  // DOM 렌더링 완료 대기
  const allRendered = await waitForDOMReady(edgeIdsToCheck)

  if (allRendered) {
    // DOM이 렌더링되었으면 정확한 위치 계산
    return calculateConnectorPositionSync(connectedEdges, nodes, rfInst)
  }

  // edge-label-box를 찾을 수 없는 경우: 기존 계산 방식 사용 (fallback)
  let sumLabelX = 0
  let maxLabelY = 0

  connectedEdges.forEach(edge => {
    const sourceNode = nodes.find(n => n && n.id === edge.source)
    const targetNode = nodes.find(n => n && n.id === edge.target)

    if (sourceNode && targetNode) {
      // 그룹 커넥터인 경우 실제 partNode들의 위치를 사용
      let sourceX = sourceNode.position.x
      let sourceY = sourceNode.position.y
      let targetX = targetNode.position.x
      let targetY = targetNode.position.y

      // source가 그룹 커넥터인 경우, 그룹 내 partNode들의 평균 위치 사용
      if (sourceNode.type === 'groupConnector' && sourceNode.data?.nodeIds) {
        const groupPartNodes = nodes.filter(n =>
          n && n.type === 'partNode' && sourceNode.data.nodeIds.includes(n.id)
        )
        if (groupPartNodes.length > 0) {
          const avgX = groupPartNodes.reduce((sum, n) => sum + n.position.x, 0) / groupPartNodes.length
          const avgY = groupPartNodes.reduce((sum, n) => sum + n.position.y, 0) / groupPartNodes.length
          // sourceX = avgX
          sourceY = avgY
        }
      }

      // target이 그룹 커넥터인 경우, 그룹 내 partNode들의 평균 위치 사용
      if (targetNode.type === 'groupConnector' && targetNode.data?.nodeIds) {
        const groupPartNodes = nodes.filter(n =>
          n && n.type === 'partNode' && targetNode.data.nodeIds.includes(n.id)
        )
        if (groupPartNodes.length > 0) {
          const avgX = groupPartNodes.reduce((sum, n) => sum + n.position.x, 0) / groupPartNodes.length
          const avgY = groupPartNodes.reduce((sum, n) => sum + n.position.y, 0) / groupPartNodes.length
          // targetX = avgX
          targetY = avgY
        }
      }

      const labelX = (sourceX + targetX) / 2
      const adjustedLabelY = Math.max(sourceY, targetY) + 180
      const labelY = adjustedLabelY + LABEL_BOX_HEIGHT // 라벨 박스 하단 위치

      sumLabelX += labelX
      maxLabelY = Math.max(maxLabelY, labelY)
    }
  })

  return {
    x: sumLabelX,
    y: maxLabelY
  }
}
