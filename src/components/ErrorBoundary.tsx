import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in Eurovision Family Contest:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-card">
          <h1>Something went wrong</h1>
          <p className="error-text">{this.state.error.message}</p>
          <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
