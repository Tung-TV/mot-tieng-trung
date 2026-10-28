import { createRoot } from 'react-dom/client';
import './styles/legacy.css';
import './styles/app.css';
import './styles/admin.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
