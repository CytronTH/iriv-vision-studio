import React, { useState, useEffect } from 'react';
import { nodeTutorials, mockNodeData } from '../../data/nodeTutorials';
import { 
  Activity, Cpu, LogIn, LogOut, BookOpen, 
  Camera, BrainCircuit, Filter, Bell, ToggleLeft, 
  ToggleRight, Lightbulb, BellRing, Settings2, Info 
} from 'lucide-react';

export default function NodeWiki({ initialNode }) {
  const [selectedNode, setSelectedNode] = useState(initialNode || Object.keys(nodeTutorials)[0]);

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

  return (
    <div className="flex h-full bg-gray-950 text-white font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-y-auto shrink-0">
        <div className="p-6 border-b border-gray-800 shrink-0 sticky top-0 bg-gray-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
              <BookOpen className="text-blue-400" size={24} />
            </div>
            <h1 className="text-xl font-bold">Node Wiki</h1>
          </div>
          <p className="text-xs text-gray-500 mt-2">คู่มือการใช้งานโหนดต่างๆ ในระบบ</p>
        </div>

        <div className="p-4 flex flex-col gap-6">
          {Object.entries(categories).map(([category, nodes]) => {
            const availableNodes = nodes.filter(n => nodeTutorials[n]);
            if (availableNodes.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">
                  {category}
                </h3>
                <div className="flex flex-col gap-1">
                  {availableNodes.map(nodeType => {
                     const isSelected = selectedNode === nodeType;
                     const nodeInfo = nodeTutorials[nodeType];
                     return (
                       <button
                         key={nodeType}
                         onClick={() => setSelectedNode(nodeType)}
                         className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full ${
                           isSelected 
                             ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-inner' 
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
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-gradient-to-br from-gray-950 to-gray-900">
        {!data ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p>กรุณาเลือก Node เพื่อดูรายละเอียด</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto p-8 md:p-12 pb-24">
            
            {/* Header */}
            <div className="flex items-start gap-5 mb-10 pb-8 border-b border-gray-800">
              <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-xl flex items-center justify-center h-20 w-20 shrink-0">
                {getIcon(selectedNode)}
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">{data.title}</h2>
                <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">{data.description}</p>
              </div>
            </div>

            {/* Detailed Sections */}
            <div className="space-y-8">
              
              {/* Input Section */}
              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-900/30 p-2 rounded-lg text-green-400">
                    <LogIn size={20} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-200">1. ข้อมูลขาเข้า (Input)</h3>
                </div>
                <div className="pl-11 space-y-4">
                  <p className="text-gray-300 leading-relaxed text-sm md:text-base">{data.input.desc}</p>
                  <div className="bg-black/40 border border-gray-800 rounded-lg p-4 text-sm text-gray-400 border-l-4 border-l-green-500 font-mono shadow-inner">
                    <span className="font-semibold text-gray-300">ตัวอย่าง: </span>{data.input.example}
                  </div>
                </div>
              </section>

              {/* Process Section */}
              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-900/30 p-2 rounded-lg text-blue-400">
                    <Cpu size={20} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-200">2. การประมวลผล (Process)</h3>
                </div>
                <div className="pl-11 space-y-4">
                  <p className="text-gray-300 leading-relaxed text-sm md:text-base">{data.process.desc}</p>
                  <div className="bg-black/40 border border-gray-800 rounded-lg p-4 text-sm text-gray-400 border-l-4 border-l-blue-500 font-mono shadow-inner">
                    <span className="font-semibold text-gray-300">ตัวอย่าง: </span>{data.process.example}
                  </div>
                </div>
              </section>

              {/* Output Section */}
              <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-orange-900/30 p-2 rounded-lg text-orange-400">
                    <LogOut size={20} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-200">3. ข้อมูลขาออก (Output)</h3>
                </div>
                <div className="pl-11 space-y-4">
                  <p className="text-gray-300 leading-relaxed text-sm md:text-base">{data.output.desc}</p>
                  <div className="bg-black/40 border border-gray-800 rounded-lg p-4 text-sm text-gray-400 border-l-4 border-l-orange-500 font-mono shadow-inner">
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
