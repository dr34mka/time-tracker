import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import { AppProvider } from '../state';
import { parseState } from '../lib/storage';
import { STORAGE_KEY } from '../lib/runtime';
import { createDemoState } from './demo';
import '../fonts.css';
import '../styles.css';
import '../workspace.css';
import '../editor-controls.css';
import '../control-elevation.css';

const initialState = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseState(raw) ?? createDemoState();
  } catch { /* The preview can still run in memory. */ }
  return createDemoState();
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider initialState={initialState}>
      <App createPreviewState={createDemoState} />
    </AppProvider>
  </React.StrictMode>,
);
