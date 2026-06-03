import React from 'react';
import { NavLink } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { LucideIcon } from 'lucide-react';

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
}

export default function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <NavLink
            to={to}
            className={({ isActive }) => `
              relative w-10 xl:w-full h-10 rounded-xl flex items-center justify-center xl:justify-start xl:px-3.5 transition-all duration-300 group
              focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan
              ${isActive 
                ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]' 
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent'
              }
            `}
          >
            {({ isActive }) => (
              <>
                {/* Active side indicator glow */}
                {isActive && (
                  <span className="absolute -left-2 xl:-left-3.5 top-[20%] bottom-[20%] w-[3px] bg-accent-cyan rounded-r-md shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                )}
                
                <Icon 
                  size={18} 
                  className={`transition-transform duration-300 group-hover:scale-110 flex-shrink-0 ${
                    isActive ? 'drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]' : ''
                  }`} 
                />

                <span className="hidden xl:inline text-[9px] font-display font-bold tracking-widest uppercase ml-3 truncate transition-opacity duration-300">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        </Tooltip.Trigger>
        
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={12}
            className="z-50 px-3 py-1.5 text-[10px] font-display font-bold tracking-wider uppercase bg-[#0d1117]/95 border border-white/10 rounded-md text-text-primary shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 xl:hidden"
          >
            {label}
            <Tooltip.Arrow className="fill-white/10" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

