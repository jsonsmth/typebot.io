import React, { useEffect, useRef, useState } from 'react'

import { ChatBlock } from './ChatBlock/ChatBlock'
import { useFrame } from 'react-frame-component'
import { setCssVariablesValue } from '../services/theme'
import { useAnswers } from '../contexts/AnswersContext'
import { Block, Edge, PublicTypebot, Theme, VariableWithValue } from 'models'
import { byId, isNotDefined } from 'utils'
import { animateScroll as scroll } from 'react-scroll'
import { LinkedTypebot, useTypebot } from 'contexts/TypebotContext'
import { ChatContext } from 'contexts/ChatContext'

type Props = {
  theme: Theme
  predefinedVariables?: { [key: string]: string | undefined }
  startBlockId?: string
  onNewBlockVisible: (edge: Edge) => void
  onCompleted: () => void
}
export const ConversationContainer = ({
  theme,
  predefinedVariables,
  startBlockId,
  onNewBlockVisible,
  onCompleted,
}: Props) => {
  const {
    typebot,
    updateVariableValue,
    linkedBotQueue,
    popEdgeIdFromLinkedTypebotQueue,
  } = useTypebot()
  const { document: frameDocument } = useFrame()
  const [displayedBlocks, setDisplayedBlocks] = useState<
    { block: Block; startStepIndex: number }[]
  >([])
  const { updateVariables } = useAnswers()
  const bottomAnchor = useRef<HTMLDivElement | null>(null)
  const scrollableContainer = useRef<HTMLDivElement | null>(null)

  const displayNextBlock = ({
    edgeId,
    updatedTypebot,
    blockId,
  }: {
    edgeId?: string
    blockId?: string
    updatedTypebot?: PublicTypebot | LinkedTypebot
  }) => {
    const currentTypebot = updatedTypebot ?? typebot
    if (blockId) {
      const nextBlock = currentTypebot.blocks.find(byId(blockId))
      if (!nextBlock) return
      onNewBlockVisible({
        id: 'edgeId',
        from: { blockId: 'block', stepId: 'step' },
        to: { blockId },
      })
      return setDisplayedBlocks([
        ...displayedBlocks,
        { block: nextBlock, startStepIndex: 0 },
      ])
    }
    const nextEdge = currentTypebot.edges.find(byId(edgeId))
    if (!nextEdge) {
      if (linkedBotQueue.length > 0) {
        const nextEdgeId = linkedBotQueue[0].edgeId
        popEdgeIdFromLinkedTypebotQueue()
        displayNextBlock({ edgeId: nextEdgeId })
      }
      return onCompleted()
    }
    const nextBlock = currentTypebot.blocks.find(byId(nextEdge.to.blockId))
    if (!nextBlock) return onCompleted()
    const startStepIndex = nextEdge.to.stepId
      ? nextBlock.steps.findIndex(byId(nextEdge.to.stepId))
      : 0
    onNewBlockVisible(nextEdge)
    setDisplayedBlocks([
      ...displayedBlocks,
      { block: nextBlock, startStepIndex },
    ])
  }

  useEffect(() => {
    const prefilledVariables = injectPredefinedVariables(predefinedVariables)
    updateVariables(prefilledVariables)
    displayNextBlock({
      edgeId: startBlockId
        ? undefined
        : typebot.blocks[0].steps[0].outgoingEdgeId,
      blockId: startBlockId,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const injectPredefinedVariables = (predefinedVariables?: {
    [key: string]: string | undefined
  }) => {
    const prefilledVariables: VariableWithValue[] = []
    Object.keys(predefinedVariables ?? {}).forEach((key) => {
      const matchingVariable = typebot.variables.find(
        (v) => v.name.toLowerCase() === key.toLowerCase()
      )
      if (!predefinedVariables || isNotDefined(matchingVariable)) return
      const value = predefinedVariables[key]
      if (!value) return
      updateVariableValue(matchingVariable?.id, value)
      prefilledVariables.push({ ...matchingVariable, value })
    })
    return prefilledVariables
  }

  useEffect(() => {
    setCssVariablesValue(theme, frameDocument.body.style)
  }, [theme, frameDocument])

  const autoScrollToBottom = () => {
    if (!scrollableContainer.current) return
    setTimeout(() => {
      scroll.scrollToBottom({
        duration: 500,
        container: scrollableContainer.current,
      })
    }, 1)
  }

  return (
    <div
      ref={scrollableContainer}
      className="overflow-y-scroll w-full lg:w-3/4 min-h-full rounded lg:px-5 px-3 pt-10 relative scrollable-container typebot-chat-view"
    >
      <ChatContext onScroll={autoScrollToBottom}>
        {displayedBlocks.map((displayedBlock, idx) => (
          <ChatBlock
            key={displayedBlock.block.id + idx}
            steps={displayedBlock.block.steps}
            startStepIndex={displayedBlock.startStepIndex}
            onBlockEnd={displayNextBlock}
            blockTitle={displayedBlock.block.title}
            keepShowingHostAvatar={idx === displayedBlocks.length - 1}
          />
        ))}
      </ChatContext>

      {/* We use a block to simulate padding because it makes iOS scroll flicker */}
      <div className="w-full h-32" ref={bottomAnchor} />
    </div>
  )
}
