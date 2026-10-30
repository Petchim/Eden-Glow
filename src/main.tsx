import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './styles/base.css';
import './styles/sections.css';
import './styles/pages.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing <div id="root">.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
