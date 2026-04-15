import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Unhandled React render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container">
          <header className="page-header">
            <h1>Cloud DevSecOps Security Advisor</h1>
            <p>Something went wrong while rendering this page.</p>
          </header>
          <p className="error-message">
            Please refresh the page. If the issue continues, check backend logs.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
