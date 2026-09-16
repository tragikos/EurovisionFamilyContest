import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as destructive (red) - use for anything irreversible. */
  danger?: boolean
}

interface ConfirmRequest extends ConfirmOptions {
  message: string
}

interface ConfirmContextValue {
  /** Replaces window.confirm with a styled modal. Resolves true/false depending on the user's choice. */
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setRequest({ message, ...options })
    })
  }, [])

  function settle(value: boolean) {
    setRequest(null)
    resolver.current?.(value)
    resolver.current = null
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {request && (
        <div className="modal-overlay" onClick={() => settle(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{request.title ?? 'Are you sure?'}</h3>
            <p>{request.message}</p>
            <div className="modal__actions">
              <button type="button" className="secondary-button" onClick={() => settle(false)}>
                {request.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                className={request.danger ? 'danger-button' : 'primary-button'}
                onClick={() => settle(true)}
                autoFocus
              >
                {request.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}
