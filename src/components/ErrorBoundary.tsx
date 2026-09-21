import { Component, type ComponentChildren } from 'preact';
import type { Dictionary } from '../i18n';

interface Props {
  dict: Dictionary;
  children: ComponentChildren;
}

interface State {
  hasError: boolean;
}

/** Catches render/runtime errors in the app island and shows a recoverable fallback screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error('İrticalen: unhandled error in app island', error);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const { dict } = this.props;
      return (
        <div class="error-screen" role="alert">
          <h2 class="error-title">{dict.error.title}</h2>
          <p class="error-body">{dict.error.body}</p>
          <button type="button" class="btn btn-primary" onClick={this.handleRetry}>
            {dict.error.retry}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
