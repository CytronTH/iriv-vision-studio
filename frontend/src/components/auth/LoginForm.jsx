import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { LogIn, KeyRound, User, AlertCircle, Loader2 } from 'lucide-react';
import logoImg from '../../assets/logo-login.svg';
import logoDarkImg from '../../assets/logo-login-dark.svg';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  // Sync theme with localStorage
  React.useEffect(() => {
    const theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const theme = localStorage.getItem('theme') || 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Invalid username or password');
      }

      const data = await response.json();
      
      // Fetch user profile
      const userResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const userData = await userResponse.json();

      login(userData, data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 bg-gray-100/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-500/20 dark:border-gray-500/20 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-36 mb-6 w-full">
            <img 
              src={theme === 'dark' ? logoDarkImg : logoImg} 
              alt="PiDo.AI Logo" 
              className="h-full w-auto object-contain drop-shadow-2xl scale-110" 
            />
          </div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 dark:from-gray-100 to-gray-600 dark:to-gray-400 mb-2">
            PiDo.AI
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Welcome back, please sign in to continue.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 ml-1 dark:text-gray-300">Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors dark:text-gray-500">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-200/40 dark:bg-gray-800/40 border border-gray-500/20 dark:border-gray-500/20 rounded-xl text-gray-900 placeholder-gray-600 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all duration-300 dark:text-gray-100"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 ml-1 dark:text-gray-300">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-purple-400 transition-colors dark:text-gray-500">
                <KeyRound className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-200/40 dark:bg-gray-800/40 border border-gray-500/20 dark:border-gray-500/20 rounded-xl text-gray-900 placeholder-gray-600 dark:placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all duration-300 dark:text-gray-100"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-gray-900 rounded-xl font-medium shadow-lg shadow-blue-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 dark:text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
