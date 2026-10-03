import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/useAuthStore';
import { Users, Plus, Shield, Trash2, Key, X, RefreshCw } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = useAuthStore(state => state.token);
  
  const [showInvite, setShowInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ username: '', password: '', role: 'viewer' });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inviteData)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Failed to invite user');
      }
      setShowInvite(false);
      setInviteData({ username: '', password: '', role: 'viewer' });
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
         const d = await res.json();
         throw new Error(d.detail || 'Failed to delete user');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error('Failed to update role');
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 dark:text-white">
            <Users className="w-8 h-8 text-blue-400" />
            User Management
          </h1>
          <p className="text-zinc-400 mt-2">Manage team members, roles, and access permissions.</p>
        </div>
        <button 
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors font-medium shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Invite User
        </button>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowInvite(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-gray-900 transition-colors dark:hover:text-white">
               <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-6 dark:text-white">Invite New User</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Username</label>
                <input 
                  type="text" 
                  value={inviteData.username}
                  onChange={e => setInviteData({...inviteData, username: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Temporary Password</label>
                <input 
                  type="password" 
                  value={inviteData.password}
                  onChange={e => setInviteData({...inviteData, password: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Role</label>
                <select 
                  value={inviteData.role}
                  onChange={e => setInviteData({...inviteData, role: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [&>option]:bg-zinc-900"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button type="submit" className="w-full mt-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors">
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-800/50 text-zinc-400 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium">Username</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Joined Date</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                 <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-zinc-500">
                       <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                       Loading users...
                    </td>
                 </tr>
              ) : users.length === 0 ? (
                 <tr><td colSpan="5" className="px-6 py-8 text-center text-zinc-500">No users found.</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-gray-900 font-bold uppercase dark:text-white">
                          {user.username.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:border-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${user.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(user.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete User">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
