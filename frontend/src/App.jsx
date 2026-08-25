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
    
    let ws = null;
    let reconnectTimer = null;
    let isSubscribed = true;

    const connect = () => {
      if (!isSubscribed) return;
      const wsUrl = `ws://${window.location.hostname}:8000/ws/metadata/${activeProject.id}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isSubscribed) setConnected(true);
      };

      // Throttle metadata updates to ~15fps to prevent UI freezing
      let lastUpdate = 0;
      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data);
          const now = Date.now();
          
          // Only throttle camera bounding box updates, NEVER drop state changes!
          if (data.type !== 'dashboard_update' && data.type !== 'logic_state') {
            if (now - lastUpdate < 66) {
               return;
            }
            lastUpdate = now;
          }

          if (data.type === 'dashboard_update') {
             setMetadata(prev => {
                const newData = { ...prev };
                if (!newData['dashboard']) newData['dashboard'] = {};
                
                const prevNodeData = newData['dashboard'][data.node_id];
                const history = prevNodeData?.history || [];
                const newItem = { timestamp: new Date().toLocaleTimeString(), value: data.value };
                
                const newHistory = [newItem, ...history].slice(0, 50);
                newData['dashboard'][data.node_id] = {
                   value: data.value,
                   history: newHistory
                };
                return newData;
             });
             return;
          }

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
        if (!isSubscribed) return;
        setConnected(false);
        // Automatically reconnect after a delay
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      isSubscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [activeProject]);

  return (
    <div className="h-screen bg-gray-950 text-white font-sans flex overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 relative z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-800 shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-3">
            <Activity className="text-blue-500 animate-pulse" />
            IRIV Vision
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1 px-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">Menu</div>
          <button
            onClick={() => {
              setActiveProject(null);
              setActiveTab('home');
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'home' && !activeProject
                ? 'bg-blue-600/10 text-blue-400' 
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
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'settings' && !activeProject
                ? 'bg-blue-600/10 text-blue-400' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <SettingsIcon size={18} />
            Global Settings
          </button>

          {activeProject && (
            <>
              <div className="mt-8 mb-2 px-3 flex items-center justify-between group">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider line-clamp-1 flex-1">
                  {activeProject.name}
                </div>
                <button 
                  onClick={() => setActiveProject(null)}
                  className="text-gray-500 hover:text-red-400 p-1 rounded-md hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100"
                  title="Close Project"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'dashboard' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <LayoutDashboard size={18} />
                Live Dashboard
              </button>
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'pipeline' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <GitMerge size={18} />
                Pipeline Builder
              </button>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 flex flex-col gap-3 shrink-0">
          {activeProject && (
             <div className="flex items-center gap-2 text-xs bg-gray-950 px-3 py-2.5 rounded-lg border border-gray-800 justify-center shadow-inner">
              <Server size={14} className={connected ? 'text-green-500' : 'text-red-500'} />
              <span className={connected ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center gap-2 w-full p-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors shadow-sm"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <><Sun size={16} /> Light Mode</> : <><Moon size={16} /> Dark Mode</>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-gray-800 shrink-0 bg-gray-900/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-sm text-gray-400">
             {/* Breadcrumbs */}
             <span className="hover:text-white cursor-pointer transition-colors" onClick={() => { setActiveProject(null); setActiveTab('home'); }}>Projects</span>
             {activeProject && (
               <>
                 <span className="text-gray-600">/</span>
                 <span className="text-gray-300 font-medium">{activeProject.name}</span>
                 <span className="text-gray-600">/</span>
                 <span className="text-blue-400 font-medium">
                   {activeTab === 'dashboard' ? 'Live Dashboard' : 'Pipeline Builder'}
                 </span>
               </>
             )}
             {!activeProject && activeTab === 'settings' && (
                <>
                  <span className="text-gray-600">/</span>
                  <span className="text-blue-400 font-medium">Global Settings</span>
                </>
             )}
          </div>
          <div className="flex items-center gap-4">
            <ResourceMonitor />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden relative flex flex-col bg-gray-950">
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto p-6">
              <ProjectList 
                onOpenProject={(project) => {
                  setActiveProject(project);
                  setActiveTab('pipeline');
                }} 
              />
            </div>
          )}
          {activeTab === 'settings' && (
             <div className="flex-1 overflow-y-auto p-6">
               <Settings />
             </div>
          )}
          
          {activeProject && activeTab === 'dashboard' && (
            <ErrorBoundary>
              <div className="h-full flex flex-col p-6">
                <LiveDashboard metadata={metadata} connected={connected} projectId={activeProject.id} />
              </div>
            </ErrorBoundary>
          )}
          
          {activeProject && activeTab === 'pipeline' && (
             <div className="h-full flex flex-col p-6">
               <PipelineBuilder projectId={activeProject.id} />
             </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
