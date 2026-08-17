import { useEffect, useState } from 'react';
import { Activity, Server, LayoutDashboard, GitMerge, Settings as SettingsIcon, ChevronLeft, Home, Sun, Moon } from 'lucide-react';
import LiveDashboard from './components/LiveDashboard';
import PipelineBuilder from './components/PipelineBuilder/PipelineBuilder';
import Settings from './components/Settings/Settings';
import ProjectList from './components/Home/ProjectList';
import ResourceMonitor from './components/ResourceMonitor';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [activeProject, setActiveProject] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if (!activeProject) {
      setConnected(false);
      return;
    }
    
    // Connect to FastAPI WebSocket dynamically using the current hostname
    const wsUrl = `ws://${window.location.hostname}:8000/ws/metadata/${activeProject.id}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMetadata(prev => {
          const newData = { ...prev };
          if (data.camera_id) {
            if (data.type === 'logic_state') {
               // Ignore logic states in main metadata so we don't overwrite bounding boxes
               if (!newData['logic']) newData['logic'] = {};
               newData['logic'][data.node_id] = data;
            } else {
               newData[data.camera_id] = data;
            }
          } else {
             // For generic metadata without camera_id
             newData['global'] = data;
          }
          return newData;
        });
      } catch (err) {
        console.error("Error parsing WS data", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [activeProject]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans flex flex-col">
      <header className="flex items-center justify-between pb-6 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="text-blue-500 animate-pulse" />
            IRIV Studio
          </h1>
          
          <ResourceMonitor />
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
            <button
              onClick={() => {
                setActiveProject(null);
                setActiveTab('home');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'home' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Home size={18} />
              Projects
            </button>
            <button
              onClick={() => {
                setActiveProject(null);
                setActiveTab('settings');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'settings' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <SettingsIcon size={18} />
              Global Settings
            </button>
          </div>
          
          {activeProject && (
            <>
              <div className="h-6 w-px bg-gray-800 mx-2"></div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="font-semibold text-white px-3 py-1 bg-gray-800 rounded-md">
                  {activeProject.name}
                </span>
              </div>
              <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 ml-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'dashboard' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <LayoutDashboard size={18} />
                  Live Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('pipeline')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'pipeline' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <GitMerge size={18} />
                  Pipeline Builder
                </button>
              </div>
            </>
          )}
        </div>

        {activeProject && (
          <div className="flex items-center gap-2 text-sm bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
            <Server size={16} className={connected ? 'text-green-500' : 'text-red-500'} />
            <span className={connected ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
              {connected ? 'WebSocket Connected' : 'Disconnected'}
            </span>
          </div>
        )}
        
        <button
          onClick={toggleTheme}
          className="ml-4 p-2 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="flex-1 mt-6 overflow-hidden flex flex-col">
        {activeTab === 'home' && (
          <ProjectList 
            onOpenProject={(project) => {
              setActiveProject(project);
              setActiveTab('pipeline');
            }} 
          />
        )}
        {activeTab === 'settings' && <Settings />}
        
        {activeProject && activeTab === 'dashboard' && (
          <ErrorBoundary>
            <LiveDashboard metadata={metadata} connected={connected} projectId={activeProject.id} />
          </ErrorBoundary>
        )}
        
        {activeProject && activeTab === 'pipeline' && (
          <PipelineBuilder projectId={activeProject.id} />
        )}
      </main>
    </div>
  );
}

export default App;
