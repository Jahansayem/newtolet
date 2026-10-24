'use client'

import { createContext, useContext, useEffect } from 'react'

/**
 * Lets a section set the shell header's description and action buttons while
 * the shell keeps ownership of the single <h1>.
 */
export const PanelShellContext = createContext(null)

export const useShellHeader = ({ description = null, actions = null } = {}) => {
  const context = useContext(PanelShellContext)
  useEffect(() => {
    if (!context) return undefined
    context.setHeader({ description, actions })
    return () => context.setHeader(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.setHeader, description, actions])
}
