import React, { useState } from 'react';
import { Terminal, Play, AlertCircle, Database, Table as TableIcon } from 'lucide-react';

export default function SqlExplorer() {
  const [query, setQuery] = useState('SELECT * FROM custom_metric_log ORDER BY timestamp DESC LIMIT 50;');
  const [dbName, setDbName] = useState('telemetry');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const executeSearch = async (q, db) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, db_name: db })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ status: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRunQuery = () => executeSearch(query, dbName);

  const applyQuickQuery = (q) => {
    setQuery(q);
    executeSearch(q, dbName);
  };

  const handleCellClick = (col, value) => {
    if ((col === 'name' || col === 'tbl_name') && typeof value === 'string') {
      const newQuery = `SELECT * FROM ${value} LIMIT 50;`;
      setQuery(newQuery);
      executeSearch(newQuery, dbName);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Left Panel: Query Editor */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 border-r border-gray-200 dark:border-gray-800 pr-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 dark:text-white">
              <Terminal size={18} className="text-blue-400" />
              SQL Explorer
            </h2>
            <select
              className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 dark:text-gray-300"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
            >
              <option value="telemetry">Telemetry Logs (AI Data)</option>
              <option value="config">System Config (Projects)</option>
            </select>
          </div>

          <div className="flex-1 min-h-[200px] flex flex-col">
            <textarea
              className="w-full flex-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 font-mono text-sm text-green-400 focus:outline-none focus:border-blue-500/50 resize-none shadow-inner"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM table_name..."
              spellCheck={false}
            />
            <div className="flex justify-between items-center mt-3">
              <div className="text-xs text-gray-500 dark:text-gray-500">Only SELECT or PRAGMA commands allowed</div>
              <button
                onClick={handleRunQuery}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 text-sm shadow-lg shadow-blue-900/20"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={14} />}
                Run Query
              </button>
            </div>
          </div>

          <div className="bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <h3 className="text-xs font-bold text-gray-600 uppercase mb-3 dark:text-gray-400">Quick Queries</h3>
            <div className="flex flex-col gap-2">
              <button onClick={() => applyQuickQuery("SELECT * FROM custom_metric_log ORDER BY timestamp DESC LIMIT 50;")} className="text-left text-xs bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded text-gray-700 transition-colors truncate dark:text-gray-300">
                View 50 Recent Custom Metrics
              </button>
              <button onClick={() => applyQuickQuery("SELECT variable_name, COUNT(*), MAX(timestamp) FROM custom_metric_log GROUP BY variable_name;")} className="text-left text-xs bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded text-gray-700 transition-colors truncate dark:text-gray-300">
                Group Custom Metrics by Variable
              </button>

              <button onClick={() => applyQuickQuery("SELECT name FROM sqlite_master WHERE type='table';")} className="text-left text-xs bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded text-gray-700 transition-colors truncate dark:text-gray-300">
                List All Tables in Database
              </button>
              <button onClick={() => applyQuickQuery("PRAGMA table_info('custom_metric_log');")} className="text-left text-xs bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded text-gray-700 transition-colors truncate dark:text-gray-300">
                View Schema: custom_metric_log
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="w-full lg:w-2/3 flex flex-col bg-gray-100/30 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-inner">
          <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <TableIcon size={16} className="text-gray-600 dark:text-gray-400" />
              Query Results
            </h3>
            {result?.status === 'success' && (
              <span className="bg-gray-200 dark:bg-gray-800 text-xs px-2 py-1 rounded text-gray-600 dark:text-gray-400">{result.count} rows returned</span>
            )}
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            {!result ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3 dark:text-gray-500">
                <Database size={32} className="opacity-20" />
                <p className="text-sm">Run a query to see results here</p>
              </div>
            ) : result.status === 'error' ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-400">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div className="text-sm font-mono whitespace-pre-wrap">{result.message}</div>
              </div>
            ) : result.rows && result.rows.length > 0 ? (
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 text-xs uppercase sticky top-0 dark:text-gray-400">
                    <tr>
                      {result.columns.map((col, idx) => (
                        <th key={idx} className="px-4 py-3 font-semibold border-b border-gray-200 dark:border-gray-800">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-gray-700 font-mono text-xs dark:text-gray-300">
                    {result.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-200/50 dark:hover:bg-gray-100 dark:bg-gray-800/50 transition-colors">
                        {result.columns.map((col, colIdx) => {
                          const isClickable = (col === 'name' || col === 'tbl_name') && typeof row[col] === 'string';
                          return (
                            <td 
                              key={colIdx} 
                              className={`px-4 py-2.5 ${isClickable ? 'text-blue-400 hover:text-blue-300 hover:underline cursor-pointer' : ''}`}
                              onClick={() => isClickable && handleCellClick(col, row[col])}
                            >
                              {row[col] === null ? <span className="text-gray-600 dark:text-gray-400 italic dark:text-gray-600">null</span> : String(row[col])}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-gray-500 text-sm mt-10 dark:text-gray-500">
                Query executed successfully, but returned 0 rows.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
