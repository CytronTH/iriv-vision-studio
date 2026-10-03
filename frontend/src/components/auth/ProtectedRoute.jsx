import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // If they are logged in but don't have the right role, 
    // maybe show a "Not Authorized" component or redirect.
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white flex-col gap-4">
        <h1 className="text-4xl font-bold text-red-500">Access Denied</h1>
        <p className="text-zinc-400">You do not have permission to view this page.</p>
        <button 
          onClick={() => window.history.back()}
          className="mt-4 px-6 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
