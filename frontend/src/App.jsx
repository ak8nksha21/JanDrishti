import React, { useEffect, useState } from 'react';
import { fetchHealth, fetchRoot, API_BASE_URL } from './services/api';

function App() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [rootData, setRootData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    async function checkBackend() {
      try {
        const health = await fetchHealth();
        if (health.status === 'healthy') {
          const root = await fetchRoot();
          setRootData(root);
          setBackendStatus('connected');
        } else {
          setBackendStatus('degraded');
        }
      } catch (err) {
        setBackendStatus('disconnected');
        setErrorMsg(err.message);
      }
    }
    checkBackend();
  }, []);

  return (
    <div className="container">
      <header className="header">
        <span className="badge">Hackathon Prototype Foundation</span>
        <h1 className="title">JanDrishti</h1>
        <p className="subtitle">AI-Powered MPLADS Monitoring & Risk Assessment Platform</p>
      </header>

      <main>
        <div className="card-grid">
          <div className="card">
            <h3>Backend Connectivity</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Target: {API_BASE_URL}</p>
            <div className="status-indicator">
              <span
                className={`status-dot ${
                  backendStatus === 'connected'
                    ? 'status-online'
                    : backendStatus === 'checking'
                    ? 'status-loading'
                    : 'status-offline'
                }`}
              />
              <span>
                {backendStatus === 'connected' && 'Connected (API Healthy)'}
                {backendStatus === 'checking' && 'Connecting to API...'}
                {backendStatus === 'disconnected' && `Disconnected (${errorMsg || 'Failed to reach API'})`}
              </span>
            </div>
            {rootData && (
              <pre className="code-box">
                {JSON.stringify(rootData, null, 2)}
              </pre>
            )}
          </div>

          <div className="card">
            <h3>Foundation Modules Ready</h3>
            <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem', color: '#4b5563', fontSize: '0.9rem' }}>
              <li><strong>Backend:</strong> FastAPI + SQLAlchemy (PostgreSQL 16)</li>
              <li><strong>ML Pipeline:</strong> Anomaly, Duplicate & Risk Engine stubs</li>
              <li><strong>Frontend:</strong> React + Vite + Recharts + React Leaflet</li>
              <li><strong>Orchestration:</strong> Docker Compose (Ports 8000, 5173, 5433)</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
