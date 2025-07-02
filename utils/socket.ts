// @ts-ignore - types may not be available in mobile environment
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Key used in api.ts as well – keep in sync
const AUTH_TOKEN_KEY = 'peteat_auth_token';

// Resolve base URL similar to api.ts
const ENV_BASE_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl;
const DEV_IP = process.env.EXPO_PUBLIC_DEV_IP || Constants.expoConfig?.extra?.devIp || '192.168.1.15';

let SOCKET_BASE_URL = ENV_BASE_URL ? ENV_BASE_URL.replace(/\/api$/, '') : undefined;
if (!SOCKET_BASE_URL) {
  if (Platform.OS === 'android') {
    SOCKET_BASE_URL = `http://${DEV_IP || '10.0.2.2'}:5000`;
  } else {
    SOCKET_BASE_URL = 'http://localhost:5000';
  }
}

// Fallback URLs to try if the main one fails
const FALLBACK_URLS = [
  'https://peteat-backend.onrender.com',
  `http://${DEV_IP}:5000`,
  'http://10.0.2.2:5000',
  'http://localhost:5000'
];

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// Socket connection status
export enum SocketConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error'
}

// Current connection status
let connectionStatus: SocketConnectionStatus = SocketConnectionStatus.DISCONNECTED;

// Socket event listeners with proper type definitions
interface SocketEventListener {
  event: string;
  callback: (...args: any[]) => void;
  id: string; // Unique ID to prevent duplicate listeners
}

const socketEventListeners: SocketEventListener[] = [];

// Generate a unique ID for event listeners
const generateListenerId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Get current socket connection status
export const getConnectionStatus = (): SocketConnectionStatus => {
  return connectionStatus;
};

// Try fallback URLs if main one fails
const tryFallbackUrls = async (): Promise<boolean> => {
  for (const url of FALLBACK_URLS) {
    if (url === SOCKET_BASE_URL) continue; // Skip the current URL
    
    try {
      console.log(`Trying fallback socket URL: ${url}`);
      
      // Create a timeout promise that rejects after 3 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Socket connection timed out')), 3000);
      });
      
      // Create socket with this URL
      const testSocket = io(url, {
        transports: ['websocket'],
        timeout: 3000,
        autoConnect: true,
      });
      
      // Wait for connection or timeout
      await new Promise<void>((resolve, reject) => {
        testSocket.on('connect', () => {
          console.log(`Fallback URL ${url} is working, switching to it`);
          SOCKET_BASE_URL = url;
          testSocket.disconnect();
          resolve();
        });
        
        testSocket.on('connect_error', (err) => {
          testSocket.disconnect();
          reject(err);
        });
        
        // Set a timeout
        setTimeout(() => {
          testSocket.disconnect();
          reject(new Error('Connection timeout'));
        }, 3000);
      });
      
      return true;
    } catch (error) {
      console.log(`Fallback URL ${url} failed:`, error);
    }
  }
  
  console.log('All fallback URLs failed');
  return false;
};

// Initialize socket with token
export const initializeSocket = async (): Promise<Socket | null> => {
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    if (!token) {
      connectionStatus = SocketConnectionStatus.ERROR;
      throw new Error('Cannot initialize socket – user not authenticated');
    }

    // Clean up previous socket if it exists
    if (socket) {
      cleanupSocket();
    }

    connectionStatus = SocketConnectionStatus.CONNECTING;
    console.log(`Connecting to socket server at ${SOCKET_BASE_URL}`);
    
    socket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: RECONNECT_INTERVAL,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      timeout: 10000,
      forceNew: true,
    });

    // Set up event handlers for socket connection
    socket.on('connect', () => {
      console.log('Socket connected successfully');
      connectionStatus = SocketConnectionStatus.CONNECTED;
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      
      // Clear any pending reconnect timers
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      // Re-apply all event listeners
      reapplyEventListeners();
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${reason}`);
      connectionStatus = SocketConnectionStatus.DISCONNECTED;
      
      // If the disconnection wasn't initiated by the client, attempt to reconnect
      if (reason === 'io server disconnect' || reason === 'transport close') {
        attemptReconnect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      connectionStatus = SocketConnectionStatus.ERROR;
      
      // Try fallback URLs
      tryFallbackUrls().then(success => {
        if (success) {
          initializeSocket();
        } else {
          attemptReconnect();
        }
      });
    });

    // Add debug listeners
    socket.onAny((event, ...args) => {
      console.log(`Socket event received: ${event}`, args);
    });

    return socket;
  } catch (error) {
    console.error('Socket initialization error:', error);
    connectionStatus = SocketConnectionStatus.ERROR;
    return null;
  }
};

// Attempt to reconnect with exponential backoff
const attemptReconnect = () => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached, trying fallback URLs');
    tryFallbackUrls().then(success => {
      if (success) {
        reconnectAttempts = 0;
        initializeSocket();
      } else {
        connectionStatus = SocketConnectionStatus.ERROR;
        cleanupSocket();
      }
    });
    return;
  }
  
  reconnectAttempts++;
  
  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const delay = RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts - 1);
  console.log(`Attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
  
  reconnectTimer = setTimeout(async () => {
    if (connectionStatus === SocketConnectionStatus.DISCONNECTED || 
        connectionStatus === SocketConnectionStatus.ERROR) {
      await initializeSocket();
    }
  }, delay);
};

// Get socket instance, initializing if needed
export const getSocket = async (): Promise<Socket> => {
  if (socket && socket.connected) {
    return socket;
  }
  
  // If socket exists but is disconnected, try to reconnect
  if (socket && !socket.connected) {
    connectionStatus = SocketConnectionStatus.CONNECTING;
    socket.connect();
    
    // Return a promise that resolves when connected or rejects after timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 5000);
      
      socket!.once('connect', () => {
        clearTimeout(timeout);
        resolve(socket!);
      });
      
      socket!.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  // Initialize new socket
  const newSocket = await initializeSocket();
  if (!newSocket) {
    throw new Error('Failed to initialize socket connection');
  }
  
  return newSocket;
};

// Add event listener with duplicate prevention
export const addSocketListener = (event: string, callback: (...args: any[]) => void): string => {
  // Generate a unique ID for this listener
  const listenerId = generateListenerId();
  
  // Store the callback for reconnection scenarios
  socketEventListeners.push({
    event,
    callback,
    id: listenerId
  });
  
  // If socket exists, add listener immediately
  if (socket) {
    console.log(`Adding listener for event: ${event}`);
    socket.on(event, callback);
  }
  
  return listenerId;
};

// Remove specific event listener by ID
export const removeSocketListenerById = (listenerId: string): boolean => {
  const index = socketEventListeners.findIndex(listener => listener.id === listenerId);
  
  if (index !== -1) {
    const { event, callback } = socketEventListeners[index];
    socketEventListeners.splice(index, 1);
    
    if (socket) {
      socket.off(event, callback);
    }
    
    return true;
  }
  
  return false;
};

// Remove event listener(s)
export const removeSocketListener = (event: string, callback?: Function): void => {
  if (socket && event) {
    if (callback) {
      socket.off(event, callback as any);
      
      // Also remove from stored listeners
      const index = socketEventListeners.findIndex(
        listener => listener.event === event && listener.callback === callback
      );
      
      if (index !== -1) {
        socketEventListeners.splice(index, 1);
      }
    } else {
      // Remove all listeners for this event
      socket.off(event);
      
      // Remove all stored listeners for this event
      const filteredListeners = socketEventListeners.filter(
        listener => listener.event !== event
      );
      
      // Clear the array and re-add the filtered listeners
      socketEventListeners.length = 0;
      socketEventListeners.push(...filteredListeners);
    }
  }
};

// Re-apply all stored event listeners to the socket
const reapplyEventListeners = (): void => {
  if (!socket) return;
  
  console.log(`Re-applying ${socketEventListeners.length} event listeners`);
  
  // First remove all listeners to avoid duplicates
  socketEventListeners.forEach(({ event }) => {
    socket!.off(event);
  });
  
  // Then re-add all listeners
  socketEventListeners.forEach(({ event, callback }) => {
    socket!.on(event, callback);
  });
};

// Clean up socket connection
const cleanupSocket = (): void => {
  if (socket) {
    // Remove all listeners
    socket.removeAllListeners();
    
    // Disconnect socket
    if (socket.connected) {
      socket.disconnect();
    }
    
    socket = null;
  }
  
  // Clear reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  connectionStatus = SocketConnectionStatus.DISCONNECTED;
};

// Disconnect socket (public method)
export const disconnectSocket = (): void => {
  cleanupSocket();
}; 