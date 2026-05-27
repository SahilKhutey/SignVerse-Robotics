'use client';
import React from 'react';

export const DashboardShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <header className="flex justify-between items-center px-4 py-2 bg-[#111] border-b border-[#333]">
        <h1 className="text-sm font-semibold tracking-wider text-gray-300">SIGNVERSE // MISSION CONTROL</h1>
        <div className="flex gap-2">
          <div className="text-xs bg-green-900/30 text-green-500 px-2 py-1 rounded border border-green-900/50">SYSTEM ONLINE</div>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-12 bg-[#111] border-r border-[#333] flex flex-col items-center py-4">
          {/* Sidebar Icons Placeholder */}
          <div className="w-8 h-8 bg-[#222] rounded mb-2 flex items-center justify-center text-xs text-gray-500">M</div>
          <div className="w-8 h-8 hover:bg-[#222] rounded mb-2 flex items-center justify-center text-xs text-gray-500 cursor-pointer">AI</div>
        </aside>
        <main className="flex-1 overflow-auto bg-[#0a0a0a]">
          {children}
        </main>
      </div>
      <footer className="h-6 bg-[#007ACC] text-white flex items-center px-2 text-[10px] font-mono tracking-wide">
        WS: CONNECTED | GPU: READY | ROS: DISCONNECTED
      </footer>
    </div>
  );
};
