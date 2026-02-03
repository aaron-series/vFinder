import { EditorUtils } from '../helper'
import { NODE_WIDTH, NODE_HEIGHT, LABEL_BOX_HALF_WIDTH, LABEL_BOX_HALF_HEIGHT } from '../constants'

// 연결선 미리보기 방향을 결정하는 헬퍼 함수
export const getConnectionLineTypeForTarget = (sourcePosition, targetPosition) => {
  // source와 target의 position에 따라 연결선 타입 결정
  if (sourcePosition === 'bottom' && targetPosition === 'top') {
    return 'smoothstep' // 아래에서 위로: smoothstep이 자연스러움
  } else if (sourcePosition === 'bottom' && targetPosition === 'bottom') {
    return 'default' // 아래에서 아래로: bezier가 자연스러움
  } else if (sourcePosition === 'bottom' && targetPosition === 'left') {
    return 'step'
  } else if (sourcePosition === 'bottom' && targetPosition === 'right') {
    return 'step'
  }
  // 기본값
  return 'smoothstep'
}

// 연결 케이스 분류 헬퍼 함수
export const getConnectionCase = (sourceNode, targetNode) => {
  const isSourcePartNode = sourceNode?.type === 'partNode'
  const isTargetPartNode = targetNode?.type === 'partNode'
  const isSourceSingleGroup = sourceNode?.type === 'groupConnector' && sourceNode.data?.nodeId && !sourceNode.data?.isGroupBox
  const isSourceMultiGroup = sourceNode?.type === 'groupConnector' && sourceNode.data?.isGroupBox === true
  const isTargetSingleGroup = targetNode?.type === 'groupConnector' && targetNode.data?.nodeId && !targetNode.data?.isGroupBox
  const isTargetMultiGroup = targetNode?.type === 'groupConnector' && targetNode.data?.isGroupBox === true

  return {
    isSourcePartNode,
    isTargetPartNode,
    isSourceSingleGroup,
    isSourceMultiGroup,
    isTargetSingleGroup,
    isTargetMultiGroup,
    isCase1: isSourcePartNode && isTargetPartNode,
    isCase2: isSourcePartNode && isTargetSingleGroup,
    isCase3: isSourcePartNode && isTargetMultiGroup,
    isCase4: isSourceSingleGroup && isTargetSingleGroup,
    isCase5: (isSourceSingleGroup && isTargetMultiGroup) || (isSourceMultiGroup && isTargetSingleGroup),
    isCase6: isSourceMultiGroup && isTargetMultiGroup
  }
}

// 케이스 5를 위한 connection ID 수정 헬퍼 함수
export const correctConnectionForCase5 = (connection, nodes) => {
  let correctedSource = connection.source
  let correctedTarget = connection.target

  const sourceNode = EditorUtils.findNode(nodes, connection.source)
  const targetNode = EditorUtils.findNode(nodes, connection.target)

  // source가 partNode이고, 해당 노드의 단일노드그룹 connector가 있는지 확인
  if (sourceNode && sourceNode.type === 'partNode') {
    const singleNodeConnectorId = EditorUtils.createSingleNodeConnectorId(connection.source)
    const singleNodeConnector = EditorUtils.findConnector(nodes, singleNodeConnectorId)
    if (singleNodeConnector &&
      singleNodeConnector.data?.isConfirmed === true &&
      !singleNodeConnector.data?.hidden) {
      // target이 다중 노드 그룹 connector인 경우, source를 단일노드그룹 connector ID로 변경
      if (targetNode &&
        targetNode.type === 'groupConnector' &&
        targetNode.data?.isGroupBox === true) {
        correctedSource = singleNodeConnectorId
      }
    }
  }

  // target이 partNode이고, 해당 노드의 단일노드그룹 connector가 있는지 확인
  if (targetNode && targetNode.type === 'partNode') {
    const singleNodeConnectorId = EditorUtils.createSingleNodeConnectorId(connection.target)
    const singleNodeConnector = EditorUtils.findConnector(nodes, singleNodeConnectorId)
    if (singleNodeConnector &&
      singleNodeConnector.data?.isConfirmed === true &&
      !singleNodeConnector.data?.hidden) {
      // source가 다중 노드 그룹 connector인 경우, target을 단일노드그룹 connector ID로 변경
      if (sourceNode &&
        sourceNode.type === 'groupConnector' &&
        sourceNode.data?.isGroupBox === true) {
        correctedTarget = singleNodeConnectorId
      }
    }
  }

  return { correctedSource, correctedTarget }
}

// 마우스 위치에서 가장 가까운 handle 찾기 (자석 기능용)
export const findNearestHandle = (mouseX, mouseY, currentNodes, rfInst, sourceNodeId = null, snapRadius = 500) => {
  if (!rfInst) return null

  let nearestHandle = null
  let minDistance = Infinity

  // 모든 노드의 handle 위치 확인
  currentNodes.forEach(node => {
    if (!node) return
    // source 노드는 제외
    if (node.id === sourceNodeId) return

    // PartNode의 handle 위치
    if (node.type === 'partNode') {
      const nodeX = node.position.x
      const nodeY = node.position.y

      const actualWidth = NODE_WIDTH
      const actualHeight = NODE_HEIGHT

      // 각 방향의 handle 위치 계산
      const handles = [
        // Top (Target)
        { position: 'top', x: nodeX + actualWidth / 2, y: nodeY, handleId: 'top', type: 'target' },
        
        // Left (Target & Source)
        { position: 'left', x: nodeX, y: nodeY + actualHeight / 2, handleId: 'left', type: 'target' },
        { position: 'left', x: nodeX, y: nodeY + actualHeight / 2, handleId: 'left-source', type: 'source' },

        // Bottom (Source)
        { position: 'bottom', x: nodeX + actualWidth / 2, y: nodeY + actualHeight, handleId: 'bottom', type: 'source' },

        // Right (Source & Target)
        { position: 'right', x: nodeX + actualWidth, y: nodeY + actualHeight / 2, handleId: 'right', type: 'source' },
        { position: 'right', x: nodeX + actualWidth, y: nodeY + actualHeight / 2, handleId: 'right-target', type: 'target' },
      ]

      handles.forEach(handle => {
        const distance = Math.sqrt(
          Math.pow(handle.x - mouseX, 2) + Math.pow(handle.y - mouseY, 2)
        )
        if (distance < minDistance && distance < snapRadius) {
          minDistance = 500
          nearestHandle = {
            position: handle.position,
            x: handle.x,
            y: handle.y,
            nodeId: node.id,
            nodeType: 'partNode',
            handleId: handle.handleId,
            handleType: handle.type
          }
        }
      })
    }

    // GroupConnectorNode의 handle 위치
    if (node.type === 'groupConnector') {
      // 확정된 커넥터만 연결 가능
      if (!node.data?.isConfirmed || node.data?.hidden) return

      const nodeX = node.position.x
      const nodeY = node.position.y

      // GroupConnectorNode는 항상 bottom handle
      let handleX, handleY
      if (node.data?.isGroupBox) {
        // 그룹박스 커넥터
        handleX = nodeX + LABEL_BOX_HALF_WIDTH / 40 - 10
        handleY = nodeY - LABEL_BOX_HALF_HEIGHT / 15
      } else {
        // 단일 노드 커넥터
        handleX = nodeX + LABEL_BOX_HALF_WIDTH / 2.8
        handleY = nodeY + LABEL_BOX_HALF_HEIGHT * 1.3
      }

      const distance = Math.sqrt(
        Math.pow(handleX - mouseX, 2) + Math.pow(handleY - mouseY, 2)
      )
      if (distance < minDistance && distance < snapRadius) {
        minDistance = distance
        nearestHandle = {
          position: 'bottom',
          x: handleX,
          y: handleY,
          nodeId: node.id,
          nodeType: 'groupConnector',
          handleId: 'bottom-target',
          handleType: 'target'
        }
      }
    }
  })

  return nearestHandle
}