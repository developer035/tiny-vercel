import React, { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Info } from 'lucide-react';

export default function EnvVarsEditor({
  envs = [],
  onChange,
  readOnly = false,
  badge = 'Placeholder Only • No Backend Persistence',
}) {
  const [showValues, setShowValues] = useState({});

  const toggleShowValue = (index) => {
    setShowValues((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleAdd = () => {
    if (readOnly) return;
    onChange([...envs, { key: '', value: '' }]);
  };

  const handleRemove = (index) => {
    if (readOnly) return;
    onChange(envs.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, val) => {
    if (readOnly) return;
    const next = [...envs];
    next[index] = { ...next[index], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-zinc-300">
            Environment Variables
          </label>
          {badge && (
            <span className="inline-flex items-center gap-1 rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] font-mono text-zinc-400 border border-zinc-700/60">
              <Info className="h-3 w-3 text-cyan-400" />
              {badge}
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Variable</span>
          </button>
        )}
      </div>

      {envs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800/80 p-4 text-center text-xs text-zinc-500 font-mono">
          No environment variables added. Click &ldquo;Add Variable&rdquo; to configure key-value pairs.
        </div>
      ) : (
        <div className="space-y-2">
          {envs.map((env, index) => {
            const isVisible = Boolean(showValues[index]);
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border border-zinc-800 bg-[#121215] p-2 text-xs font-mono"
              >
                <input
                  type="text"
                  placeholder="KEY"
                  value={env.key}
                  disabled={readOnly}
                  onChange={(e) =>
                    handleChange(index, 'key', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))
                  }
                  className="w-1/3 rounded bg-zinc-950 px-2.5 py-1.5 text-zinc-200 placeholder-zinc-600 border border-zinc-800/80 focus:outline-none focus:border-zinc-600 transition-colors"
                />
                <span className="text-zinc-600">=</span>
                <div className="relative flex-1">
                  <input
                    type={isVisible ? 'text' : 'password'}
                    placeholder="VALUE"
                    value={env.value}
                    disabled={readOnly}
                    onChange={(e) => handleChange(index, 'value', e.target.value)}
                    className="w-full rounded bg-zinc-950 pl-2.5 pr-8 py-1.5 text-zinc-200 placeholder-zinc-600 border border-zinc-800/80 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowValue(index)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title={isVisible ? 'Hide value' : 'Show value'}
                  >
                    {isVisible ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                    title="Remove variable"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
