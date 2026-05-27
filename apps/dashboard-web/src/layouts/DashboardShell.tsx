'use client'
import React, { useState } from 'react';
import { Activity, Cpu, Camera, Terminal, Shield, Workflow } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardShell() {
  const [activeTab, setActiveTab] = useState('telemetry');

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A]">
      {/* Sidebar */}
      <div className="w-64 bg-[#111111] border-r border-[#222] p-4 flex flex-col">
        <div className="text-xl font-bold tracking-widest text-emerald-400 mb-10 flex items-center gap-2">
          <Activity /> SIGN-VERSE
        </div>
        
        <nav className="flex-1 space-y-2">
          {[
            { id: 'telemetry', icon: <Activity size={18}/>, label: 'Fleet Telemetry' },
            { id: 'perception', icon: <Camera size={18}/>, label: 'Perception Stream' },
            { id: 'agentic', icon: <Workflow size={18}/>, label: 'Agentic Core' },
            { id: 'security', icon: <Shield size={18}/>, label: 'Enterprise Auth' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 ${
                activeTab === item.id 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'text-gray-400 hover:bg-[#1A1A1A] hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pt-4 border-t border-[#222]">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            SYSTEM ONLINE
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-[#222] flex items-center px-6 justify-between bg-[#0F0F0F]">
          <h1 className="text-lg font-medium text-gray-200 capitalize">{activeTab} Monitor</h1>
          <div className="flex gap-4">
            <div className="px-3 py-1 rounded bg-[#1A1A1A] border border-[#333] flex items-center gap-2 text-xs text-emerald-400">
              <Cpu size={14} /> GPU Load: 42%
            </div>
            <div className="px-3 py-1 rounded bg-[#1A1A1A] border border-[#333] flex items-center gap-2 text-xs text-blue-400">
              <Terminal size={14} /> Agents: 3
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-12 gap-6 h-full">
            
            {/* Main Viewport */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-8 bg-[#111] rounded-xl border border-[#222] overflow-hidden flex flex-col"
            >
              <div className="h-10 bg-[#151515] border-b border-[#222] px-4 flex items-center text-xs text-gray-400 font-mono">
                [ viewport: /api/v1/stream ]
              </div>
              <div className="flex-1 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1A1A1A] to-[#111]"></div>
                <div className="text-emerald-500/20 font-mono text-6xl tracking-tighter">
                  NO SIGNAL
                </div>
              </div>
            </motion.div>

            {/* Sidebar Widgets */}
            <div className="col-span-4 flex flex-col gap-6">
              
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[#111] rounded-xl border border-[#222] p-5 flex-1"
              >
                <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                  <Terminal size={14}/> LLM Task Graph
                </h3>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center bg-[#1A1A1A] p-2 rounded">
                    <span className="text-blue-400">task_1</span>
                    <span className="text-emerald-400">completed</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#1A1A1A] p-2 rounded border border-emerald-500/30">
                    <span className="text-blue-400">task_2</span>
                    <span className="text-amber-400 animate-pulse">executing</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[#111] rounded-xl border border-[#222] p-5 h-48"
              >
                 <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                  <Activity size={14}/> System Load
                </h3>
                <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-emerald-500 w-[42%]"></div>
                </div>
                <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[78%]"></div>
                </div>
              </motion.div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
