import { useState, useEffect, useRef } from 'react';

export function useRealtimeStream(endpoint: string, throttleMs: number = 33) {
    const [data, setData] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Refs to hold throttling state
    const latestDataRef = useRef<any>(null);
    const lastUpdateRef = useRef<number>(0);
    const frameIdRef = useRef<number | null>(null);
    const timeoutIdRef = useRef<any>(null);
    const throttleMsRef = useRef<number>(throttleMs);

    // Update throttle rate ref dynamically without tearing down WebSocket connection
    useEffect(() => {
        throttleMsRef.current = throttleMs;
    }, [throttleMs]);

    useEffect(() => {
        let socket: WebSocket | null = null;
        let mockInterval: any = null;
        let isClosed = false;

        function startMocking() {
            if (isClosed || isConnected || mockInterval) return;
            mockInterval = setInterval(() => {
                let mockData: any = null;
                if (endpoint.includes('inference') || endpoint.includes('ai-inference')) {
                    mockData = { type: 'vision', bounding_boxes: [10, 20, 50, 50], gesture: 'THUMBS_UP' };
                } else if (endpoint.includes('robotics') || endpoint.includes('telemetry')) {
                    mockData = { type: 'telemetry', joints: { J0: Math.random() * 90, J1: Math.random() * 45 } };
                }
                
                // Throttle mock data too
                handleIncomingMessage(mockData);
                setIsConnected(true);
            }, 1000);
        }

        const performUpdate = () => {
            setData(latestDataRef.current);
            lastUpdateRef.current = Date.now();
            frameIdRef.current = null;
            timeoutIdRef.current = null;
        };

        function handleIncomingMessage(parsedData: any) {
            latestDataRef.current = parsedData;
            const now = Date.now();
            const elapsed = now - lastUpdateRef.current;
            const currentThrottle = throttleMsRef.current;

            if (elapsed >= currentThrottle) {
                if (frameIdRef.current === null) {
                    frameIdRef.current = requestAnimationFrame(performUpdate);
                }
            } else {
                if (timeoutIdRef.current === null && frameIdRef.current === null) {
                    const delay = currentThrottle - elapsed;
                    timeoutIdRef.current = setTimeout(() => {
                        frameIdRef.current = requestAnimationFrame(performUpdate);
                    }, delay);
                }
            }
        }

        try {
            socket = new WebSocket(endpoint);
            
            socket.onopen = () => {
                if (isClosed) return;
                setIsConnected(true);
                if (mockInterval) {
                    clearInterval(mockInterval);
                    mockInterval = null;
                }
            };
            
            socket.onmessage = (event) => {
                if (isClosed) return;
                try {
                    const parsed = JSON.parse(event.data);
                    handleIncomingMessage(parsed);
                } catch {
                    handleIncomingMessage(event.data);
                }
            };
            
            socket.onerror = () => {
                startMocking();
            };
            
            socket.onclose = () => {
                startMocking();
            };
        } catch (e) {
            startMocking();
        }

        // Fallback timer: start mocking if connection isn't established within 1.5 seconds
        const fallbackTimer = setTimeout(() => {
            if (!isConnected && (!socket || socket.readyState !== WebSocket.OPEN)) {
                startMocking();
            }
        }, 1500);

        return () => {
            isClosed = true;
            clearTimeout(fallbackTimer);
            if (socket) {
                socket.close();
            }
            if (mockInterval) {
                clearInterval(mockInterval);
            }
            if (frameIdRef.current !== null) {
                cancelAnimationFrame(frameIdRef.current);
            }
            if (timeoutIdRef.current !== null) {
                clearTimeout(timeoutIdRef.current);
            }
            setIsConnected(false);
        };
    }, [endpoint]);

    return { data, isConnected };
}

