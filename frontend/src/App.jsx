import { useEffect, useState } from 'react';
import { Activity, Server, LayoutDashboard, GitMerge, Settings as SettingsIcon, ChevronLeft, Home, Sun, Moon, Power, RefreshCw, BookOpen, Menu, X } from 'lucide-react';
import LiveDashboard from './components/LiveDashboard';
import PipelineBuilder from './components/PipelineBuilder/PipelineBuilder';
import Settings from './components/Settings/Settings';
import ProjectList from './components/Home/ProjectList';
import ResourceMonitor from './components/ResourceMonitor';
import ErrorBoundary from './components/ErrorBoundary';
import LogsViewer from './components/LogsViewer';
import NodeWiki from './components/Wiki/NodeWiki';
import logoImg from './assets/logo.svg';

function App() {
  const [activeProject, setActiveProject] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [wikiNode, setWikiNode] = useState(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const handleSystemAction = async (action) => {
    const actionText = action === 'restart' ? 'Restart' : 'Shutdown';
    if (!window.confirm(`Are you sure you want to ${actionText} the system?`)) return;
    try {
      await fetch(`http://${window.location.hostname}:8000/api/system/${action}`, { method: 'POST' });
      if (action === 'restart') {
        alert("System is restarting. Please wait a minute and refresh the page.");
      } else {
        alert("System is shutting down. It is now safe to unplug the power.");
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to send ${actionText} command`);
    }
  };
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
    <div className="h-screen bg-gray-950 text-white font-sans flex overflow-hidden relative">
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* Left Sidebar / Mobile Slide-over Drawer */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-20
          ${isMobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          ${isSidebarOpen ? 'w-64' : 'md:w-20 w-64'} 
          transition-all duration-300 ease-in-out bg-gray-900 border-r border-gray-800 flex flex-col shrink-0
        `}
      >
        {/* Desktop Sidebar Collapse Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:block absolute -right-3 top-5 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded-full p-1.5 z-50 transition-transform shadow-md hover:scale-110"
        >
          <ChevronLeft size={14} className={`transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Brand Header */}
        <div className={`h-16 flex items-center justify-between ${isSidebarOpen ? 'px-6' : 'md:justify-center px-4'} border-b border-gray-800 shrink-0 overflow-hidden whitespace-nowrap`}>
          <div 
            onClick={() => {
              setActiveProject(null);
              setActiveTab('home');
              setIsMobileDrawerOpen(false);
            }}
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            title="IRIV Vision Studio"
          >
            <img 
              src={logoImg} 
              alt="IRIV Logo" 
              className={`object-contain transition-all duration-300 ${isSidebarOpen ? 'h-9 w-auto max-w-[150px]' : 'md:h-7 h-9 w-auto md:max-w-[48px] max-w-[150px]'}`} 
            />
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsMobileDrawerOpen(false)}
            className="md:hidden text-gray-400 hover:text-white p-1.5 rounded-lg bg-gray-800/80 border border-gray-700 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className={`flex-1 overflow-y-auto py-6 flex flex-col gap-1 ${isSidebarOpen ? 'px-3' : 'md:px-2 md:items-center px-3'}`}>
          {isSidebarOpen && <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">Menu</div>}
          <button
            onClick={() => {
              setActiveProject(null);
              setActiveTab('home');
              setIsMobileDrawerOpen(false);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
              activeTab === 'home' && !activeProject
                ? 'bg-blue-600/10 text-blue-400' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={!isSidebarOpen ? "Projects" : ""}
          >
            <Home size={18} className="shrink-0" />
            {(isSidebarOpen || isMobileDrawerOpen) && <span>Projects</span>}
          </button>
          <button
            onClick={() => {
              setActiveProject(null);
              setActiveTab('settings');
              setIsMobileDrawerOpen(false);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
              activeTab === 'settings' && !activeProject
                ? 'bg-blue-600/10 text-blue-400' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={!isSidebarOpen ? "Global Settings" : ""}
          >
            <SettingsIcon size={18} className="shrink-0" />
            {(isSidebarOpen || isMobileDrawerOpen) && <span>Global Settings</span>}
          </button>

          {activeProject && (
            <>
              {isSidebarOpen ? (
                <div className="mt-8 mb-2 px-3 flex items-center justify-between group">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider line-clamp-1 flex-1">
                    {activeProject.name}
                  </div>
                  <button 
                    onClick={() => {
                      setActiveProject(null);
                      setIsMobileDrawerOpen(false);
                    }}
                    className="text-gray-500 hover:text-red-400 p-1 rounded-md hover:bg-gray-800 transition-colors"
                    title="Close Project"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              ) : (
                <div className="mt-6 mb-2 border-t border-gray-800 w-full"></div>
              )}
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
                  activeTab === 'dashboard' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={!isSidebarOpen ? "Live Dashboard" : ""}
              >
                <LayoutDashboard size={18} className="shrink-0" />
                {(isSidebarOpen || isMobileDrawerOpen) && <span>Live Dashboard</span>}
              </button>
              <button
                onClick={() => {
                  setActiveTab('pipeline');
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
                  activeTab === 'pipeline' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={!isSidebarOpen ? "Pipeline Builder" : ""}
              >
                <GitMerge size={18} className="shrink-0" />
                {(isSidebarOpen || isMobileDrawerOpen) && <span>Pipeline Builder</span>}
              </button>
              <button
                onClick={() => {
                  setActiveTab('logs');
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
                  activeTab === 'logs' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={!isSidebarOpen ? "Database Logs" : ""}
              >
                <Server size={18} className="shrink-0" />
                {(isSidebarOpen || isMobileDrawerOpen) && <span>Database Logs</span>}
              </button>
              <button
                onClick={() => {
                  setWikiNode(null);
                  setActiveTab('wiki');
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
                  activeTab === 'wiki' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={!isSidebarOpen ? "Node Wiki" : ""}
              >
                <BookOpen size={18} className="shrink-0" />
                {(isSidebarOpen || isMobileDrawerOpen) && <span>Node Wiki</span>}
              </button>
            </>
          )}
        </div>

        <div className={`p-4 border-t border-gray-800 flex flex-col gap-3 shrink-0 ${!isSidebarOpen && 'md:items-center md:px-2 px-4'}`}>
          {activeProject && (
             <div className={`flex items-center gap-2 text-xs bg-gray-950 px-3 py-2.5 rounded-lg border border-gray-800 justify-center shadow-inner ${!isSidebarOpen && 'md:w-12 md:h-12 md:!px-0'}`} title={connected ? 'Connected' : 'Disconnected'}>
              <Server size={14} className={connected ? 'text-green-500 shrink-0' : 'text-red-500 shrink-0'} />
              {(isSidebarOpen || isMobileDrawerOpen) && (
                <span className={connected ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-3 sm:px-6 border-b border-gray-800 shrink-0 bg-gray-900/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0">
             {/* Mobile Drawer Trigger Button */}
             <button
               onClick={() => setIsMobileDrawerOpen(true)}
               className="md:hidden p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white active:scale-95 transition-transform shrink-0"
               title="Open Navigation"
             >
               <Menu size={18} />
             </button>

             {/* Breadcrumbs */}
             <span className="hover:text-white cursor-pointer transition-colors shrink-0 hidden sm:inline" onClick={() => { setActiveProject(null); setActiveTab('home'); }}>Projects</span>
             {activeProject && (
               <>
                 <span className="text-gray-600 hidden sm:inline">/</span>
                 <span className="text-gray-300 font-medium truncate max-w-[100px] sm:max-w-[200px]" title={activeProject.name}>{activeProject.name}</span>
                 <span className="text-gray-600">/</span>
                 <span className="text-blue-400 font-medium truncate">
                   {activeTab === 'dashboard' ? 'Live Dashboard' : activeTab === 'pipeline' ? 'Pipeline Builder' : activeTab === 'wiki' ? 'Node Wiki' : 'Database Logs'}
                 </span>
               </>
             )}
             {!activeProject && activeTab === 'settings' && (
                <>
                  <span className="text-gray-600 hidden sm:inline">/</span>
                  <span className="text-blue-400 font-medium">Global Settings</span>
                </>
             )}
             {!activeProject && activeTab === 'home' && (
               <span className="text-blue-400 font-medium sm:hidden">Projects</span>
             )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <ResourceMonitor />
            <div className="flex items-center gap-1.5 sm:gap-2 border-l border-gray-800 pl-2 sm:pl-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shadow-sm flex items-center justify-center active:scale-95"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px]" />}
              </button>
              <button
                onClick={() => handleSystemAction('restart')}
                className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 transition-colors shadow-sm flex items-center justify-center active:scale-95"
                title="Restart System"
              >
                <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <button
                onClick={() => handleSystemAction('shutdown')}
                className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors shadow-sm flex items-center justify-center active:scale-95"
                title="Shutdown System"
              >
                <Power size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden relative flex flex-col bg-gray-950 pb-16 md:pb-0">
          {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
              <ProjectList 
                onOpenProject={(project) => {
                  setActiveProject(project);
                  setActiveTab('dashboard');
                }} 
              />
            </div>
          )}
          {activeTab === 'settings' && (
             <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
               <Settings />
             </div>
          )}
          
          {activeProject && activeTab === 'dashboard' && (
            <ErrorBoundary>
              <div className="h-full flex flex-col p-2 sm:p-4 md:p-6">
                <LiveDashboard metadata={metadata} connected={connected} projectId={activeProject.id} />
              </div>
            </ErrorBoundary>
          )}
          
          {activeProject && activeTab === 'pipeline' && (
             <ErrorBoundary>
               <div className="h-full flex flex-col p-2 sm:p-4 md:p-6">
                 <PipelineBuilder 
                   projectId={activeProject.id} 
                   onOpenWiki={(nodeType) => {
                     setWikiNode(nodeType);
                     setActiveTab('wiki');
                   }}
                 />
               </div>
             </ErrorBoundary>
          )}
          
          {activeProject && activeTab === 'wiki' && (
             <div className="h-full bg-gray-950">
               <NodeWiki initialNode={wikiNode} />
             </div>
          )}
          
          {activeProject && activeTab === 'logs' && (
             <div className="h-full bg-gray-950">
               <LogsViewer />
             </div>
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (< md) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 z-30 flex items-center justify-around px-2">
          <button 
            onClick={() => { setActiveProject(null); setActiveTab('home'); }}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'home' && !activeProject ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <Home size={18} />
            <span className="text-[10px]">Projects</span>
          </button>

          {activeProject ? (
            <>
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'dashboard' ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <LayoutDashboard size={18} />
                <span className="text-[10px]">Dashboard</span>
              </button>
              <button 
                onClick={() => setActiveTab('pipeline')}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'pipeline' ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <GitMerge size={18} />
                <span className="text-[10px]">Pipeline</span>
              </button>
              <button 
                onClick={() => setActiveTab('logs')}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'logs' ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <Server size={18} />
                <span className="text-[10px]">Logs</span>
              </button>
              <button 
                onClick={() => { setWikiNode(null); setActiveTab('wiki'); }}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'wiki' ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <BookOpen size={18} />
                <span className="text-[10px]">Wiki</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => { setActiveProject(null); setActiveTab('settings'); }}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'settings' && !activeProject ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <SettingsIcon size={18} />
              <span className="text-[10px]">Settings</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}

export default App;
