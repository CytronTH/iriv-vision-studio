import React, { useState, useEffect } from 'react';
import { nodeTutorials, mockNodeData } from '../../data/nodeTutorials';
import { 
  Activity, Cpu, LogIn, LogOut, BookOpen, 
  Camera, BrainCircuit, Filter, Bell, ToggleLeft, 
  ToggleRight, Lightbulb, BellRing, Settings2, Info, X 
} from 'lucide-react';

export default function NodeWiki({ initialNode }) {
  const [selectedNode, setSelectedNode] = useState(initialNode || Object.keys(nodeTutorials)[0]);
  const [isMobileWikiSidebarOpen, setIsMobileWikiSidebarOpen] = useState(false);

  // Handle external changes to initialNode
  useEffect(() => {
    if (initialNode && nodeTutorials[initialNode]) {
      setSelectedNode(initialNode);
    }
  }, [initialNode]);

  const categories = {
    'Nodes': ['inputNode', 'aiNode', 'logicNode', 'counterNode', 'actionNode', 'snapshotNode'],
    'Hardware (CM5)': ['digitalInputNode', 'digitalOutputNode', 'ledNode', 'buzzerNode', 'rs485Node'],
    'Dashboard Outputs': ['dashboardVideoNode', 'dashboardMetricNode', 'dashboardTextNode', 'dashboardLogNode'],
    'Debugging': ['debugNode']
  };

  const getIcon = (type) => {
    switch (type) {
      case 'inputNode': return <Camera size={18} className="text-blue-400" />;
      case 'aiNode': return <BrainCircuit size={18} className="text-purple-400" />;
      case 'logicNode': return <Filter size={18} className="text-orange-400" />;
      case 'counterNode': return <span className="text-emerald-400 font-bold px-1">∑</span>;
      case 'actionNode': return <Bell size={18} className="text-green-400" />;
      case 'snapshotNode': return <Camera size={18} className="text-pink-400" />;
      case 'digitalInputNode': return <ToggleLeft size={18} className="text-cyan-400" />;
      case 'digitalOutputNode': return <ToggleRight size={18} className="text-orange-400" />;
      case 'ledNode': return <Lightbulb size={18} className="text-yellow-400" />;
      case 'buzzerNode': return <BellRing size={18} className="text-red-400" />;
      case 'rs485Node': return <Settings2 size={18} className="text-indigo-400" />;
      case 'dashboardVideoNode': return <span className="text-pink-400 font-bold px-1">📺</span>;
      case 'dashboardMetricNode': return <span className="text-pink-400 font-bold px-1">🔢</span>;
      case 'dashboardTextNode': return <span className="text-pink-400 font-bold px-1">📝</span>;
      case 'dashboardLogNode': return <span className="text-indigo-400 font-bold px-1">📋</span>;
      case 'debugNode': return <span className="text-gray-300 font-bold px-1">🐛</span>;
      default: return <Info size={18} className="text-gray-400" />;
    }
  };

  const data = nodeTutorials[selectedNode];

  const renderSidebarContent = (isMobile = false) => (
    <>
      <div className="p-4 sm:p-6 border-b border-gray-800 shrink-0 sticky top-0 bg-gray-900/95 backdrop-blur z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
            <BookOpen className="text-blue-400" size={22} />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold">Node Wiki</h1>
            <p className="text-[11px] text-gray-500">คู่มือการใช้งานโหนดต่างๆ</p>
          </div>
        </div>
        {isMobile && (
          <button 
            onClick={() => setIsMobileWikiSidebarOpen(false)}
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white border border-gray-700 active:scale-95"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-3 sm:p-4 flex flex-col gap-5 overflow-y-auto flex-1">
        {Object.entries(categories).map(([category, nodes]) => {
          const availableNodes = nodes.filter(n => nodeTutorials[n]);
          if (availableNodes.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">
                {category}
              </h3>
              <div className="flex flex-col gap-1">
                {availableNodes.map(nodeType => {
                   const isSelected = selectedNode === nodeType;
                   const nodeInfo = nodeTutorials[nodeType];
                   return (
                     <button
                       key={nodeType}
                       onClick={() => {
                         setSelectedNode(nodeType);
                         if (isMobile) setIsMobileWikiSidebarOpen(false);
                       }}
                       className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full active:scale-[0.98] ${
                         isSelected 
                           ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-inner font-semibold' 
                           : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'
                       }`}
                     >
                       <div className={`shrink-0 flex items-center justify-center w-6 h-6 rounded ${isSelected ? 'bg-black/20' : ''}`}>
                         {getIcon(nodeType)}
                       </div>
                       <span className="truncate">{nodeInfo?.title || nodeType}</span>
                     </button>
                   );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex h-full bg-gray-950 text-white font-sans overflow-hidden relative">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex w-72 bg-gray-900 border-r border-gray-800 flex-col h-full overflow-y-auto shrink-0">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Sidebar Navigation Drawer */}
      {isMobileWikiSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileWikiSidebarOpen(false)}
        >
          <div 
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-gradient-to-br from-gray-950 to-gray-900 flex flex-col">
        {/* Mobile Header Bar */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900/90 backdrop-blur shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="text-blue-400 shrink-0" size={18} />
            <span className="text-xs sm:text-sm font-bold text-gray-200 truncate">{data?.title || 'Node Wiki'}</span>
          </div>
          <button
            onClick={() => setIsMobileWikiSidebarOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/15 border border-blue-500/30 text-xs text-blue-400 font-medium active:scale-95 shrink-0"
          >
            <span>All Nodes</span>
          </button>
        </div>

        {!data ? (
          <div className="flex flex-1 items-center justify-center text-gray-500 p-6">
            <p>กรุณาเลือก Node เพื่อดูรายละเอียด</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12 pb-24 w-full">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5 mb-6 sm:mb-10 pb-6 sm:pb-8 border-b border-gray-800">
              <div className="bg-gray-800 p-3 sm:p-4 rounded-2xl border border-gray-700 shadow-xl flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 shrink-0">
                {getIcon(selectedNode)}
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3 tracking-tight">{data.title}</h2>
                <p className="text-gray-400 text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl">{data.description}</p>
              </div>
            </div>

            {/* Detailed Sections */}
            <div className="space-y-6 sm:space-y-8">
              
              {/* Input Section */}
              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md hover:border-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="bg-green-900/30 p-2 rounded-lg text-green-400">
                    <LogIn size={20} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-200">1. ข้อมูลขาเข้า (Input)</h3>
                </div>
                <div className="pl-0 sm:pl-11 space-y-3 sm:space-y-4">
                  <p className="text-gray-300 leading-relaxed text-xs sm:text-sm md:text-base">{data.input.desc}</p>
                  <div className="bg-black/40 border border-gray-800 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-gray-400 border-l-4 border-l-green-500 font-mono shadow-inner overflow-x-auto">
                    <span className="font-semibold text-gray-300">ตัวอย่าง: </span>{data.input.example}
                  </div>
                </div>
              </section>

              {/* Process Section */}
              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md hover:border-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="bg-blue-900/30 p-2 rounded-lg text-blue-400">
                    <Cpu size={20} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-200">2. การประมวลผล (Process)</h3>
                </div>
                <div className="pl-0 sm:pl-11 space-y-3 sm:space-y-4">
                  <p className="text-gray-300 leading-relaxed text-xs sm:text-sm md:text-base">{data.process.desc}</p>
                  <div className="bg-black/40 border border-gray-800 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-gray-400 border-l-4 border-l-blue-500 font-mono shadow-inner overflow-x-auto">
                    <span className="font-semibold text-gray-300">ตัวอย่าง: </span>{data.process.example}
                  </div>
                </div>
              </section>

              {/* Output Section */}
              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md hover:border-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="bg-orange-900/30 p-2 rounded-lg text-orange-400">
                    <LogOut size={20} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-200">3. ข้อมูลขาออก (Output)</h3>
                </div>
                <div className="pl-0 sm:pl-11 space-y-3 sm:space-y-4">
                  <p className="text-gray-300 leading-relaxed text-xs sm:text-sm md:text-base">{data.output.desc}</p>
                  <div className="bg-black/40 border border-gray-800 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-gray-400 border-l-4 border-l-orange-500 font-mono shadow-inner overflow-x-auto">
                    <span className="font-semibold text-gray-300">ตัวอย่าง: </span>{data.output.example}
                  </div>
                </div>
              </section>


              {/* Compatibility Section */}
              {(data.supportedInputs?.length > 0 || data.supportedOutputs?.length > 0) && (
                <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-sm mt-8">
                  <h3 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
                    <Activity size={18} className="text-gray-400"/> การเชื่อมต่อที่รองรับ
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Supported Inputs */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">รับข้อมูลจากโหนด (Inputs)</h4>
                      {data.supportedInputs && data.supportedInputs.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {data.supportedInputs.map(t => (
                            <div key={t} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-300 flex items-center gap-2">
                              {getIcon(t)} {nodeTutorials[t]?.title || t}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">ไม่มี (เป็นโหนดเริ่มต้น)</p>
                      )}
                    </div>

                    {/* Supported Outputs */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">ส่งต่อให้โหนด (Outputs)</h4>
                      {data.supportedOutputs && data.supportedOutputs.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {data.supportedOutputs.map(t => (
                            <div key={t} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-300 flex items-center gap-2">
                              {getIcon(t)} {nodeTutorials[t]?.title || t}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">ไม่มี (เป็นโหนดปลายทาง)</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
