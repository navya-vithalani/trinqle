import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Trinqle ErrorBoundary:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fff3f6] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-[#f6dfe7] p-5 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>

            <div className="space-y-1">
              <h2 className="font-bold text-base text-[#5b4350]">Something went wrong</h2>
              <p className="text-xs text-[#a58b98]">
                An unexpected error occurred while loading this view.
              </p>
            </div>

            {this.state.error && (
              <pre className="p-3 bg-[#f6dfe7]/30 border border-[#f6dfe7] rounded-lg text-[10px] text-left text-[#5b4350] overflow-x-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}

            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-2.5 px-4 rounded-full bg-[#ff8fb1] text-white font-bold text-xs flex items-center justify-center space-x-2 active:scale-95 shadow-sm"
            >
              <RefreshCw size={14} />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
