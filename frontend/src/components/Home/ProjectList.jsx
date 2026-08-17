import React, { useState, useEffect } from 'react';
import { Folder, Plus, Play, Trash2, ArrowRight, Edit2, Check, Video, Activity } from 'lucide-react';

export default function ProjectList({ onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      const data = await res.json();
      setProjects(data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch projects", err);
      setLoading(false);
    }
  };

  const createProject = async () => {
    const newProject = {
      id: `proj_${Date.now()}`,
      name: `New Project ${projects.length + 1}`,
      description: "A new AI vision project",
      pipeline: { nodes: [], edges: [] }
    };
    
    const updated = [...projects, newProject];
    setProjects(updated);
    
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error("Failed to save project", err);
    }
  };

  const deleteProject = async (id) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
        <Activity className="animate-spin mb-4" size={32} />
        <p>Loading projects...</p>
      </div>
    );
  }

  const startEditing = (project) => {
    setEditingId(project.id);
    setEditForm({ name: project.name, description: project.description });
  };

  const saveEditing = async (id) => {
    const updated = projects.map(p => 
      p.id === id ? { ...p, name: editForm.name, description: editForm.description } : p
    );
    setProjects(updated);
    setEditingId(null);
    
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error("Failed to update project", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-800/50 rounded-2xl p-8 mb-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div>
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3 text-white">
            <Video className="text-blue-400" size={32} />
            My Projects
          </h2>
          <p className="text-blue-200/70 max-w-xl">
            Create and manage multiple AI vision pipelines. Each project runs isolated on its own GStreamer thread and RTSP output, allowing you to run multiple cameras simultaneously.
          </p>
        </div>
        <button 
          onClick={createProject}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/50 hover:scale-105 active:scale-95 whitespace-nowrap"
        >
          <Plus size={20} />
          Create New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map(project => (
          <div key={project.id} className="bg-gray-900/80 border border-gray-800 hover:border-blue-900/50 rounded-2xl p-6 transition-all group flex flex-col shadow-lg relative overflow-hidden backdrop-blur-sm">
            
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-blue-600/10 transition-colors"></div>

            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-blue-900/20">
                <Folder size={24} />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {editingId !== project.id && (
                  <button 
                    onClick={() => startEditing(project)}
                    className="text-gray-400 hover:text-blue-400 transition-colors p-2 bg-gray-800 rounded-lg"
                    title="Edit Details"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                <button 
                  onClick={() => deleteProject(project.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-800 rounded-lg"
                  title="Delete Project"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 relative z-10">
              {editingId === project.id ? (
                <div className="space-y-3 mb-6">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-gray-950 border border-blue-500 rounded-lg px-3 py-2 text-white font-bold outline-none"
                    placeholder="Project Name"
                    autoFocus
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="w-full bg-gray-950 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-gray-300 text-sm outline-none resize-none h-20"
                    placeholder="Project Description"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={() => saveEditing(project.id)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Check size={16} /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-2 text-white group-hover:text-blue-400 transition-colors cursor-pointer" onClick={() => onOpenProject(project)}>
                    {project.name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-6 line-clamp-2">{project.description}</p>
                </>
              )}
            </div>
            
            <div className="flex items-center justify-between pt-5 border-t border-gray-800/50 mt-auto relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                <span className="text-xs text-gray-500 font-medium">
                  {project.pipeline?.nodes?.length || 0} Nodes Configured
                </span>
              </div>
              <button 
                onClick={() => onOpenProject(project)}
                className="bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all group/btn"
              >
                Open Studio <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-800 rounded-2xl bg-gray-900/30">
            <div className="bg-gray-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Folder size={32} className="text-gray-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-300 mb-2">No Projects Yet</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Create your first project to start building AI vision pipelines and analyzing video streams.
            </p>
            <button 
              onClick={createProject}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95"
            >
              <Plus size={20} />
              Create Your First Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
