import { create } from 'zustand';
import { useNotificationsStore } from './notifications';
import { useTelemetryStore } from './telemetry';
import { usePerformanceStore } from './performance';
import { VITE_API_URL } from '../lib/env';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  intent?: string;
  primitive?: string;
  params?: Record<string, any>;
  affectedJoints?: number[];
  targetAngles?: number[];
  duration?: number;
  speedScaling?: number;
  error?: string;
}

interface CommandState {
  messages: ChatMessage[];
  pending: boolean;
  highlightedJoints: number[] | null;
  highlightTimestamp: number | null;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  setHighlightedJoints: (joints: number[] | null) => void;
}

const getStoredMessages = (): ChatMessage[] => {
  try {
    const data = localStorage.getItem('signverse_chat_messages');
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to parse stored chat messages', e);
  }
  return [
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: 'Hello Operator, SignVerse Cognitive Reasoning Kernel is active. Input natural language commands to retarget joint kinematics.',
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: 'success'
    }
  ];
};

const saveMessages = (messages: ChatMessage[]) => {
  try {
    localStorage.setItem('signverse_chat_messages', JSON.stringify(messages));
  } catch (e) {
    console.error('Failed to save chat messages', e);
  }
};

export const useCommandStore = create<CommandState>((set, get) => ({
  messages: getStoredMessages(),
  pending: false,
  highlightedJoints: null,
  highlightTimestamp: null,

  setHighlightedJoints: (highlightedJoints) => set({
    highlightedJoints,
    highlightTimestamp: highlightedJoints ? Date.now() : null
  }),

  clearMessages: () => {
    const cleared = [
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: 'Hello Operator, SignVerse Cognitive Reasoning Kernel is active. Input natural language commands to retarget joint kinematics.',
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'success'
      } as ChatMessage
    ];
    set({ messages: cleared });
    saveMessages(cleared);
  },

  sendMessage: async (text: string) => {
    const isEstopTriggered = useTelemetryStore.getState().isEstopTriggered;
    const addLog = useNotificationsStore.getState().addLog;

    if (isEstopTriggered) {
      addLog('❌ Cannot dispatch command. System is in EMERGENCY STOP state!', 'error');
      throw new Error('EMERGENCY_STOP_ACTIVE');
    }

    const commandText = text.trim();
    if (!commandText) return;

    const userMsgId = `msg-user-${Date.now()}`;
    const assistantMsgId = `msg-assistant-${Date.now()}`;
    const timestampStr = new Date().toLocaleTimeString([], { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: commandText,
      timestamp: timestampStr,
      status: 'success'
    };

    const pendingAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      timestamp: timestampStr,
      status: 'pending'
    };

    // Prepend user message and pending assistant indicator
    set((state) => {
      const updated = [userMessage, pendingAssistantMessage, ...state.messages];
      saveMessages(updated);
      return {
        pending: true,
        messages: updated
      };
    });

    addLog(`💬 Dispatching command to reasoning kernel: "${commandText}"`, 'info');

    const cmdStartTime = performance.now();
    try {
      const response = await fetch(`${VITE_API_URL}/api/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'signverse_local_dev_key',
        },
        body: JSON.stringify({ command: commandText }),
      });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }

      const resData = await response.json();
      
      const cmdEndTime = performance.now();
      const cmdLatency = Math.round(cmdEndTime - cmdStartTime);
      usePerformanceStore.getState().recordCommandLatency(cmdLatency);

      if (resData.status === 'success') {
        const agentOutput = resData.agent_output || {};
        const qTarget = agentOutput.q_target || [0.0, 0.0, 0.0];
        const radToDeg = (rad: number) => Math.round(rad * (180 / Math.PI));
        
        const isHome = commandText.toLowerCase().match(/home|reset|rest/);
        const parsedIntent = isHome ? 'HOME_POSITION' : 'JOINT_MOVE';
        const motionPrimitive = isHome ? 'retract_to_home' : 'joint_interpolation';
        const speedScaling = agentOutput.speed_scaling || 1.0;

        const affectedJoints: number[] = [];
        if (isHome) {
          affectedJoints.push(0, 1, 2, 3, 4, 5, 6);
        } else {
          if (Math.abs(qTarget[0]) > 0.001) affectedJoints.push(1);
          if (Math.abs(qTarget[1]) > 0.001) affectedJoints.push(3);
          if (Math.abs(qTarget[2]) > 0.001) affectedJoints.push(5);
          if (affectedJoints.length === 0) {
            affectedJoints.push(0, 1, 2, 3, 4, 5, 6);
          }
        }

        const targetAngles = [
          0,
          radToDeg(qTarget[0]),
          0,
          radToDeg(qTarget[1]),
          0,
          radToDeg(qTarget[2]),
          0
        ];

        const duration = (isHome ? 1.5 : 2.5) / speedScaling;

        set((state) => {
          const updated = state.messages.map((m) => {
            if (m.id === assistantMsgId) {
              return {
                ...m,
                status: 'success' as const,
                text: `Mapped semantic intent successfully. Driving physical actuators to target poses. (Speed: ${speedScaling}x)`,
                intent: parsedIntent,
                primitive: motionPrimitive,
                params: { q_target: qTarget, speed_scaling: speedScaling },
                affectedJoints,
                targetAngles,
                duration,
                speedScaling
              };
            }
            return m;
          });
          saveMessages(updated);
          return {
            pending: false,
            highlightedJoints: affectedJoints,
            highlightTimestamp: Date.now(),
            messages: updated
          };
        });

        addLog(`🟢 API matched intent ${parsedIntent} (primitive: ${motionPrimitive})`, 'success');
      } else {
        throw new Error(resData.message || 'Unknown parsing failure');
      }
    } catch (err: any) {
      if (err.message.includes('HTTP 500') || err.message.includes('500')) {
        import('./toast').then(({ useToastStore }) => {
          useToastStore.getState().addToast({
            message: 'Internal Server Error (500): Failed to parse command.',
            type: 'error',
            code: 'HTTP_500'
          });
        });
        set((state) => {
          const updated = state.messages.map((m) => {
            if (m.id === assistantMsgId) {
              return {
                ...m,
                status: 'error' as const,
                text: 'Internal Server Error (500): Failed to parse command.',
                error: err.message,
              };
            }
            return m;
          });
          saveMessages(updated);
          return {
            pending: false,
            messages: updated
          };
        });
        addLog(`❌ Command parsing failed: ${err.message}`, 'error');
        return;
      }

      // Local fallback parsing (simulating local reasoning engine offline)
      addLog(`⚠️ Cognitive Gateway offline. Running local parser heuristic fallback.`, 'warn');
      const lower = commandText.toLowerCase();
      
      let intent = 'FREEFORM_COMMAND';
      let primitive = 'waypoint_follow';
      let params: Record<string, any> = { raw_command: commandText };
      let affectedJoints = [0, 1, 2, 3, 4, 5, 6];
      let targetAngles = [0, 0, 0, 0, 0, 0, 0];
      let speedScaling = 1.0;
      let duration = 2.5;

      const isHome = lower.includes('home') || lower.includes('reset') || lower.includes('rest');
      
      // Look at past local thread messages for context!
      const lastSuccessMsg = get().messages.find(m => m.sender === 'assistant' && m.status === 'success' && m.targetAngles);
      const isSlower = lower.includes('slower');
      const isFaster = lower.includes('faster');

      if ((lower.includes('last time') || lower.includes('previous') || isSlower || isFaster) && lastSuccessMsg) {
        intent = lastSuccessMsg.intent || intent;
        primitive = lastSuccessMsg.primitive || primitive;
        params = { ...lastSuccessMsg.params };
        affectedJoints = lastSuccessMsg.affectedJoints || affectedJoints;
        targetAngles = lastSuccessMsg.targetAngles || targetAngles;
        
        if (isSlower) {
          speedScaling = 0.5;
        } else if (isFaster) {
          speedScaling = 1.5;
        }
        duration = (lastSuccessMsg.duration || 2.5) / speedScaling;
        params.speed_scaling = speedScaling;
      } else if (isHome) {
        intent = 'HOME_POSITION';
        primitive = 'retract_to_home';
        params = { speed_scaling: 1.0 };
        affectedJoints = [0, 1, 2, 3, 4, 5, 6];
        targetAngles = [0, 0, 0, 0, 0, 0, 0];
        duration = 1.5;
      } else if (lower.includes('pick') || lower.includes('grab') || lower.includes('block') || lower.includes('peg')) {
        intent = 'PICK_AND_PLACE';
        primitive = 'reach_grab_deposit';
        params = { target: lower.includes('red') ? 'red_cube' : 'blue_peg', velocity_limit: 0.8 };
        affectedJoints = [1, 3, 5];
        targetAngles = [0, 45, 0, -30, 0, 90, 0];
        duration = 3.2;
      } else if (lower.includes('extend')) {
        intent = 'EXTEND_FULLY';
        primitive = 'linear_extension';
        params = { distance_cm: 50 };
        affectedJoints = [1, 3, 5];
        targetAngles = [0, 75, 0, 60, 0, 45, 0];
        duration = 2.0;
      }

      set((state) => {
        const updated = state.messages.map((m) => {
          if (m.id === assistantMsgId) {
            return {
              ...m,
              status: 'success' as const,
              text: `Local heuristics resolved intent. Directing actuators in mock emulation. (Speed: ${speedScaling}x)`,
              intent,
              primitive,
              params,
              affectedJoints,
              targetAngles,
              duration,
              speedScaling
            };
          }
          return m;
        });
        saveMessages(updated);
        return {
          pending: false,
          highlightedJoints: affectedJoints,
          highlightTimestamp: Date.now(),
          messages: updated
        };
      });

      addLog(`🟢 Local parsed fallback matched intent ${intent} (primitive: ${primitive})`, 'success');
    }
  }
}
));

if (typeof window !== 'undefined') {
  (window as any).useCommandStore = useCommandStore;
}

