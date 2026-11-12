import { Component, type ReactNode } from "react";

/** Keeps one broken widget from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto mt-10 max-w-lg p-6 text-sm">
        <h2 className="font-semibold">Something broke on this page</h2>
        <p className="mt-2 text-muted">{this.state.error.message}</p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
