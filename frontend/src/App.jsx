import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Activity, Server, LayoutDashboard, GitMerge, Settings as SettingsIcon, ChevronLeft, Home, Sun, Moon, Power, RefreshCw, BookOpen, Menu, X, Database, Users, LogOut, Play, Square } from 'lucide-react';
import LiveDashboard from './components/LiveDashboard';
import PipelineBuilder from './components/PipelineBuilder/PipelineBuilder';
import Settings from './components/Settings/Settings';
import ProjectList from './components/Home/ProjectList';
import ResourceMonitor from './components/ResourceMonitor';
import ErrorBoundary from './components/ErrorBoundary';
import LogsViewer from './components/LogsViewer';
import NodeWiki from './components/Wiki/NodeWiki';
import DatabaseMonitoring from './components/DatabaseMonitoring';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
import UserManagement from './components/users/UserManagement';
import useAuthStore from './store/useAuthStore';
import logoImg from './assets/logo-menu.svg';
import logoDarkImg from './assets/logo-menu-dark.svg';
import SystemClock from './components/SystemClock';

function AppContent() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [activeProject, setActiveProject] = useState(null);
  const [projectStatus, setProjectStatus] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [connected, setConnected] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [wikiNode, setWikiNode] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'project') {
      const projectId = pathParts[1];
      if (location.state?.project && location.state.project.id === projectId) {
        setActiveProject(location.state.project);
      } else if (!activeProject || activeProject.id !== projectId) {
        fetch('/api/projects')
          .then(res => res.json())
          .then(data => {
            const proj = data.find(p => p.id === projectId);
            if (proj) {
              setActiveProject(proj);
            } else {
              navigate('/');
            }
          })
          .catch(err => {
            console.error("Failed to fetch projects", err);
          });
      }
    } else {
      if (activeProject) {
        setActiveProject(null);
      }
    }
  }, [location.pathname, location.state, activeProject, navigate]);

  let activeTab = 'home';
  const pathParts = location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'project') {
    activeTab = pathParts[2] || 'dashboard';
  } else if (pathParts[0] === 'settings') {
    activeTab = 'settings';
  } else if (pathParts[0] === 'database') {
    activeTab = 'database';
  } else if (pathParts[0] === 'users') {
    activeTab = 'users';
  }

  const handleOpenWiki = useCallback((nodeType) => {
    setWikiNode(nodeType);
    if (pathParts[0] === 'project') {
      navigate(`/project/${pathParts[1]}/wiki`);
    }
  }, [navigate, pathParts]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  useEffect(() => {
    if (!activeProject) {
      setProjectStatus(null);
      return;
    }
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/projects/status');
        const data = await res.json();
        setProjectStatus(data[activeProject.id] || { status: 'stopped' });
      } catch (err) {
        // ignore errors during polling
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [activeProject]);

  const toggleProject = async (id, isRunning) => {
    try {
      if (isRunning) {
        await fetch(`/api/pipeline/stop/${id}`, { method: 'POST' });
        setProjectStatus(prev => ({...prev, status: 'stopped'}));
      } else {
        await fetch(`/api/projects/${id}/start`, { method: 'POST' });
        setProjectStatus(prev => ({...prev, status: 'running'}));
      }
    } catch (err) {
      console.error("Failed to toggle project", err);
    }
  };
  
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
          
          // Dispatch generic message for DebugWebSocket and other components to share the connection
          window.dispatchEvent(new CustomEvent('pido_ws_message', { detail: data }));
          
          // Dispatch specific event for high-frequency AI bounding boxes and skip React state update entirely!
          if (data.camera_id && (data.type === 'detection' || data.type === 'classification' || data.type === 'pose' || data.type === 'segmentation' || !data.type)) {
             window.dispatchEvent(new CustomEvent('ai_metadata', { detail: data }));
             return; // Bail out to avoid 30fps React root re-renders
          }
          
          // Throttle React state updates to ~15fps (only applies to logic/dashboard updates now)
          if (data.type !== 'dashboard_update' && data.type !== 'logic_state' && data.type !== 'target_tracker_update') {
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
                
                let newHistory = history;
                if (history.length === 0 || history[0].value !== data.value) {
                    let ts = new Date().toLocaleTimeString();
                    if (data.msg && data.msg.metadata && data.msg.metadata.timestamp) {
                       ts = new Date(data.msg.metadata.timestamp * 1000).toLocaleTimeString();
                    } else if (data.timestamp) {
                       ts = new Date(data.timestamp * 1000).toLocaleTimeString();
                    }
                    
                    // STRIP HEAVY DATA: Prevent Out of Memory by removing huge arrays from history
                    let safeMsg = data.msg;
                    if (safeMsg && typeof safeMsg === 'object') {
                       safeMsg = { ...safeMsg };
                       delete safeMsg.data;
                       delete safeMsg.detections;
                    }

                    const newItem = { timestamp: ts, value: data.value, msg: safeMsg };
                    newHistory = [newItem, ...history].slice(0, 50);
                }
                
                newData['dashboard'][data.node_id] = {
                   value: data.value,
                   history: newHistory,
                   msg: data.msg
                };
                return newData;
             });
             return;
          } else if (data.type === 'target_tracker_update') {
             setMetadata(prev => {
                const newData = { ...prev };
                if (!newData['dashboard']) newData['dashboard'] = {};
                newData['dashboard'][data.node_id] = {
                   value: data
                };
                return newData;
             });
             return;
          }

          setMetadata(prev => {
            const newData = { ...prev };
            if (data.camera_id) {
              if (data.type === 'logic_state') {
                 if (!newData['logic']) newData['logic'] = {};
                 newData['logic'][data.node_id] = data;
              }
            } else {
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
    <div className="h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 font-sans flex overflow-hidden relative dark:text-white">
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
          transition-all duration-300 ease-in-out bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0
        `}
      >
        {/* Desktop Sidebar Collapse Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:block absolute -right-3 top-5 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 hover:text-white rounded-full p-1.5 z-50 transition-transform shadow-md hover:scale-110 dark:text-gray-400"
        >
          <ChevronLeft size={14} className={`transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Brand Header */}
        <div className={`h-24 flex items-center justify-between ${isSidebarOpen ? 'px-4' : 'md:justify-center px-4'} border-b border-gray-200 dark:border-gray-800 shrink-0 overflow-hidden whitespace-nowrap`}>
          <div 
            onClick={() => {
              navigate('/');
              setIsMobileDrawerOpen(false);
            }}
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            title="PiDo.AI"
          >
            <img 
              src={theme === 'dark' ? logoDarkImg : logoImg} 
              alt="PiDo.AI Logo" 
              className={`object-contain transition-all duration-300 ${isSidebarOpen ? 'h-16 w-auto max-w-full scale-110' : 'h-12 w-auto md:max-w-[56px] max-w-full'}`} 
            />
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsMobileDrawerOpen(false)}
            className="md:hidden text-gray-600 hover:text-white p-1.5 rounded-lg bg-gray-200/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 active:scale-95 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className={`flex-1 overflow-y-auto py-6 flex flex-col gap-1 ${isSidebarOpen ? 'px-3' : 'md:px-2 md:items-center px-3'}`}>
          {isSidebarOpen && <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3 dark:text-gray-500">Menu</div>}
          <button
            onClick={() => {
              navigate('/');
              setIsMobileDrawerOpen(false);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
              activeTab === 'home' && !activeProject
                ? 'bg-blue-600/10 text-blue-400' 
                : 'text-gray-600 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800'
            } dark:text-gray-400`}
            title={!isSidebarOpen ? "Projects" : ""}
          >
            <Home size={18} className="shrink-0" />
            {(isSidebarOpen || isMobileDrawerOpen) && <span>Projects</span>}
          </button>
          <button
            onClick={() => {
              navigate('/settings');
              setIsMobileDrawerOpen(false);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
              activeTab === 'settings' && !activeProject
                ? 'bg-blue-600/10 text-blue-400' 
                : 'text-gray-600 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800'
            } dark:text-gray-400`}
            title={!isSidebarOpen ? "Global Settings" : ""}
          >
            <SettingsIcon size={18} className="shrink-0" />
            {(isSidebarOpen || isMobileDrawerOpen) && <span>Global Settings</span>}
          </button>
          
          <button
            onClick={() => {
              navigate('/database');
              setIsMobileDrawerOpen(false);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
              activeTab === 'database' && !activeProject
                ? 'bg-blue-600/10 text-blue-400' 
                : 'text-gray-600 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800'
            } dark:text-gray-400`}
            title={!isSidebarOpen ? "Database" : ""}
          >
            <Database size={18} className="shrink-0" />
            {(isSidebarOpen || isMobileDrawerOpen) && <span>Database</span>}
          </button>
          
          {user?.role === 'admin' && (
          <button
            onClick={() => {
              navigate('/users');
              setIsMobileDrawerOpen(false);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
              activeTab === 'users' && !activeProject
                ? 'bg-blue-600/10 text-blue-400' 
                : 'text-gray-600 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800'
            } dark:text-gray-400`}
            title={!isSidebarOpen ? "User Management" : ""}
          >
            <Users size={18} className="shrink-0" />
            {(isSidebarOpen || isMobileDrawerOpen) && <span>User Management</span>}
          </button>
          )}


          {activeProject && (
            <>
              {isSidebarOpen ? (
                <div className="mt-8 mb-2 px-3 flex items-center justify-between group">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider line-clamp-1 flex-1 dark:text-gray-500">
                    {activeProject.name}
                  </div>
                  <button 
                    onClick={() => {
                      navigate('/');
                      setIsMobileDrawerOpen(false);
                    }}
                    className="text-gray-500 hover:text-red-400 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800 transition-colors dark:text-gray-500"
                    title="Close Project"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              ) : (
                <div className="mt-6 mb-2 border-t border-gray-200 dark:border-gray-800 w-full"></div>
              )}
              <button
                onClick={() => {
                  navigate(`/project/${activeProject.id}/dashboard`);
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
                  activeTab === 'dashboard' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-600 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800'
                } dark:text-gray-400`}
                title={!isSidebarOpen ? "Live Dashboard" : ""}
              >
                <LayoutDashboard size={18} className="shrink-0" />
                {(isSidebarOpen || isMobileDrawerOpen) && <span>Live Dashboard</span>}
              </button>
              <button
                onClick={() => {
                  navigate(`/project/${activeProject.id}/pipeline`);
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
                  activeTab === 'pipeline' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-600 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800'
                } dark:text-gray-400`}
                title={!isSidebarOpen ? "Pipeline Builder" : ""}
              >
                <GitMerge size={18} className="shrink-0" />
                {(isSidebarOpen || isMobileDrawerOpen) && <span>Pipeline Builder</span>}
              </button>
              <button
                onClick={() => {
                  navigate(`/project/${activeProject.id}/logs`);
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
                  activeTab === 'logs' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-600 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800'
                } dark:text-gray-400`}
                title={!isSidebarOpen ? "Database Logs" : ""}
              >
                <Server size={18} className="shrink-0" />
                {(isSidebarOpen || isMobileDrawerOpen) && <span>Database Logs</span>}
              </button>
              <button
                onClick={() => {
                  setWikiNode(null);
                  navigate(`/project/${activeProject.id}/wiki`);
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isSidebarOpen && 'md:justify-center md:w-12 md:h-12'} ${
                  activeTab === 'wiki' 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-gray-600 hover:text-white hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-gray-800'
                } dark:text-gray-400`}
                title={!isSidebarOpen ? "Node Wiki" : ""}
              >
                <BookOpen size={18} className="shrink-0" />
                {(isSidebarOpen || isMobileDrawerOpen) && <span>Node Wiki</span>}
              </button>
            </>
          )}
        </div>

        <div className={`p-4 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3 shrink-0 ${!isSidebarOpen && 'md:items-center md:px-2 px-4'}`}>
          {activeProject && (
             <div className={`flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-950 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 justify-center shadow-inner ${!isSidebarOpen && 'md:w-12 md:h-12 md:!px-0'}`} title={connected ? 'Connected' : 'Disconnected'}>
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
        <header className="h-16 flex items-center justify-between px-3 sm:px-6 border-b border-gray-200 dark:border-gray-800 shrink-0 bg-gray-100/50 dark:bg-gray-900/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0 dark:text-gray-400">
             {/* Mobile Drawer Trigger Button */}
             <button
               onClick={() => setIsMobileDrawerOpen(true)}
               className="md:hidden p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 hover:text-white active:scale-95 transition-transform shrink-0 dark:text-gray-300"
               title="Open Navigation"
             >
               <Menu size={18} />
             </button>

             {/* Breadcrumbs */}
             <span className="hover:text-gray-900 cursor-pointer transition-colors shrink-0 hidden sm:inline dark:hover:text-white" onClick={() => { navigate('/'); }}>Projects</span>
             {activeProject && (
               <>
                 <span className="text-gray-600 dark:text-gray-400 hidden sm:inline dark:text-gray-600">/</span>
                 <span className="text-gray-700 font-medium truncate max-w-[100px] sm:max-w-[200px] dark:text-gray-300" title={activeProject.name}>{activeProject.name}</span>
                 <span className="text-gray-600 dark:text-gray-400 dark:text-gray-600">/</span>
                 <span className="text-blue-400 font-medium truncate">
                   {activeTab === 'dashboard' ? 'Live Dashboard' : activeTab === 'pipeline' ? 'Pipeline Builder' : activeTab === 'wiki' ? 'Node Wiki' : 'Database Logs'}
                 </span>
               </>
             )}
             {!activeProject && activeTab === 'settings' && (
                <>
                  <span className="text-gray-600 dark:text-gray-400 hidden sm:inline dark:text-gray-600">/</span>
                  <span className="text-blue-400 font-medium">Global Settings</span>
                </>
             )}
             {!activeProject && activeTab === 'home' && (
               <span className="text-blue-400 font-medium sm:hidden">Projects</span>
             )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
             {activeProject && projectStatus && (
               <div className="mr-1 sm:mr-2">
                  {projectStatus.status === 'running' ? (
                     <button 
                       onClick={() => toggleProject(activeProject.id, true)}
                       className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-600 hover:text-white transition-colors border border-red-800/50 text-sm font-medium active:scale-95"
                     >
                       <Square size={14} fill="currentColor" />
                       <span className="hidden sm:inline">Stop</span>
                     </button>
                  ) : (
                     <button 
                       onClick={() => toggleProject(activeProject.id, false)}
                       className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/40 text-green-400 hover:bg-green-600 hover:text-white transition-colors border border-green-800/50 text-sm font-medium active:scale-95"
                     >
                       <Play size={14} fill="currentColor" />
                       <span className="hidden sm:inline">Start</span>
                     </button>
                  )}
               </div>
             )}
            <SystemClock />
            <ResourceMonitor />
            <div className="flex items-center gap-1.5 sm:gap-2 border-l border-gray-200 dark:border-gray-800 pl-2 sm:pl-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 hover:text-white hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 transition-colors shadow-sm flex items-center justify-center active:scale-95 dark:text-gray-400"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px]" />}
              </button>
              <button
                onClick={() => handleSystemAction('restart')}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition-colors shadow-sm flex items-center justify-center active:scale-95 dark:text-gray-400"
                title="Restart System"
              >
                <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <button
                onClick={() => handleSystemAction('shutdown')}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors shadow-sm flex items-center justify-center active:scale-95 dark:text-gray-400"
                title="Shutdown System"
              >
                <Power size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 hover:text-white hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 transition-colors shadow-sm flex items-center justify-center active:scale-95 dark:text-gray-400"
                title="Log Out"
              >
                <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden relative flex flex-col bg-gray-50 dark:bg-gray-950 pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                <ProjectList onOpenProject={(project) => {
                  setActiveProject(project);
                  navigate(`/project/${project.id}/pipeline`);
                }} />
              </div>
            } />
            <Route path="/settings" element={
               <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                 <Settings />
               </div>
            } />
            <Route path="/database" element={
               <div className="flex-1 overflow-y-auto">
                 <DatabaseMonitoring />
               </div>
            } />
            <Route path="/users" element={
               <div className="flex-1 overflow-y-auto">
                 <UserManagement />
               </div>
            } />
            <Route path="/project/:projectId/dashboard" element={
               activeProject ? (
                 <ErrorBoundary>
                   <div className="h-full flex flex-col p-2 sm:p-4 md:p-6">
                     <LiveDashboard metadata={metadata} connected={connected} projectId={activeProject.id} />
                   </div>
                 </ErrorBoundary>
               ) : null
            } />
            <Route path="/project/:projectId/pipeline" element={
               activeProject ? (
                 <ErrorBoundary>
                   <div className="h-full flex flex-col p-2 sm:p-4 md:p-6">
                     <PipelineBuilder 
                       projectId={activeProject.id} 
                       onOpenWiki={handleOpenWiki}
                     />
                   </div>
                 </ErrorBoundary>
               ) : null
            } />
            <Route path="/project/:projectId/wiki" element={
               activeProject ? (
                 <div className="h-full bg-gray-50 dark:bg-gray-950">
                   <NodeWiki initialNode={wikiNode} />
                 </div>
               ) : null
            } />
            <Route path="/project/:projectId/logs" element={
               activeProject ? (
                 <div className="h-full bg-gray-50 dark:bg-gray-950">
                   <LogsViewer projectId={activeProject.id} />
                 </div>
               ) : null
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Mobile Bottom Navigation Bar (< md) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gray-100/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 z-30 flex items-center justify-around px-2">
          <button 
            onClick={() => { navigate('/'); }}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'home' && !activeProject ? 'text-blue-400 font-semibold' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-800 dark:text-gray-200'}`}
          >
            <Home size={18} />
            <span className="text-[10px]">Projects</span>
          </button>

          {activeProject ? (
            <>
              <button 
                onClick={() => navigate(`/project/${activeProject.id}/dashboard`)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'dashboard' ? 'text-blue-400 font-semibold' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-800 dark:text-gray-200'}`}
              >
                <LayoutDashboard size={18} />
                <span className="text-[10px]">Dashboard</span>
              </button>
              <button 
                onClick={() => navigate(`/project/${activeProject.id}/pipeline`)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'pipeline' ? 'text-blue-400 font-semibold' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-800 dark:text-gray-200'}`}
              >
                <GitMerge size={18} />
                <span className="text-[10px]">Pipeline</span>
              </button>
              <button 
                onClick={() => navigate(`/project/${activeProject.id}/logs`)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'logs' ? 'text-blue-400 font-semibold' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-800 dark:text-gray-200'}`}
              >
                <Server size={18} />
                <span className="text-[10px]">Logs</span>
              </button>
              <button 
                onClick={() => { setWikiNode(null); navigate(`/project/${activeProject.id}/wiki`); }}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'wiki' ? 'text-blue-400 font-semibold' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-800 dark:text-gray-200'}`}
              >
                <BookOpen size={18} />
                <span className="text-[10px]">Wiki</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => { navigate('/settings'); }}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${activeTab === 'settings' && !activeProject ? 'text-blue-400 font-semibold' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-800 dark:text-gray-200'}`}
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppContent />
        </ProtectedRoute>
      } />
    </Routes>
  );
}
