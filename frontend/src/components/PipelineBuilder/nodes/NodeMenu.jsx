import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Settings } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function NodeMenu({ id }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const deleteNode = usePipelineStore((state) => state.deleteNode);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-md hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden nodrag">
          <button 
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-left"
            onClick={() => setIsOpen(false)}
          >
            <Settings size={14} />
            Node Settings
          </button>
          
          <div className="h-px bg-gray-700 w-full" />
          
          <button 
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-950 hover:text-red-300 transition-colors text-left"
            onClick={() => deleteNode(id)}
          >
            <Trash2 size={14} />
            Delete Node
          </button>
        </div>
      )}
    </div>
  );
}
