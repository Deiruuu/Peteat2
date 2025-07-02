import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../hooks/useColorScheme';
import { Colors } from '../../../constants/Colors';
import { Typography } from '../../../constants/Typography';
import { messageAPI, API_BASE_URL } from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';
import { getSocket, addSocketListener, removeSocketListener, initializeSocket } from '../../../utils/socket';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

interface MessageItem {
  _id: string;
  sender: string | { _id: string };
  receiver: string;
  content: string;
  text?: string; // For web compatibility
  timestamp: string;
  createdAt?: string; // For web compatibility
  attachments?: string[];
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ partnerId: string }>();
  const partnerId = params.partnerId && params.partnerId !== 'undefined' ? params.partnerId : null;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [uploading, setUploading] = useState(false);
  const [partnerName, setPartnerName] = useState('Chat');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const appState = useRef(AppState.currentState);
  const [socketReconnecting, setSocketReconnecting] = useState(false);

  useEffect(() => {
    if (!partnerId) {
      setError('Invalid partner ID. Please go back and try again.');
      setLoading(false);
    }
  }, [partnerId]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground - reconnecting socket');
        setupSocket();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Load initial conversation
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Validate partnerId
        if (!partnerId || partnerId === 'undefined') {
          setError('Invalid partner ID');
          setLoading(false);
          return;
        }
        
        // First, try to get existing conversation using the old method
        try {
          const data = await messageAPI.getConversation(partnerId as string);
          if (data && data.length > 0) {
            setMessages(data);
          } else {
            setMessages([]);
          }
        } catch (convErr) {
          console.log('Using website-compatible method instead');
          
          // Try website-compatible method as fallback
          try {
            // Create or find conversation
            const conversation = await messageAPI.startConversation(partnerId as string);
            
            if (conversation && conversation._id) {
              // Save conversation ID for future use
              setConversationId(conversation._id);
              
              // Now get messages for this conversation
              const messages = await messageAPI.getConversationMessages(conversation._id);
              setMessages(messages || []);
            } else {
              // No messages yet
              setMessages([]);
            }
          } catch (webErr) {
            console.error('Both conversation methods failed:', webErr);
            setError('Could not load messages. Please try again.');
            setMessages([]);
          }
        }
        
        // Try to load partner info
        try {
          const response = await fetch(`${API_BASE_URL}/users/${partnerId}/public`);
          if (response.ok) {
            const userData = await response.json();
            if (userData && userData.fullName) {
              setPartnerName(userData.fullName);
            } else if (userData && userData.clinicName) {
              setPartnerName(userData.clinicName);
            } else if (userData && userData.email) {
              setPartnerName(userData.email);
            }
          }
        } catch (partnerErr) {
          console.log('Could not load partner info:', partnerErr);
        }
      } catch (err) {
        console.error('Failed to load conversation', err);
        setError('Could not load messages. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();

    // Set up socket connection
    setupSocket();

    return () => {
      cleanupSocket();
    };
  }, [partnerId]);

  const setupSocket = async () => {
    try {
      setSocketReconnecting(true);
      
      // Initialize socket directly to ensure we have a fresh connection
      await initializeSocket();
      
      // Get the socket instance
      const socket = await getSocket();
      setSocketConnected(true);
      
      console.log('Socket connected in chat screen');
      
      // Scroll to bottom when connected
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);

      // Listen for messages in mobile format
      addSocketListener('receiveMessage', handleReceiveMessage);
      
      // Listen for messages in web format
      addSocketListener('newMessage', handleNewMessage);
      
      // Save conversation ID if we receive it from a message
      addSocketListener('messageSaved', handleMessageSaved);
    } catch (err) {
      console.error('Socket connect error:', err);
      setSocketConnected(false);
    } finally {
      setSocketReconnecting(false);
    }
  };

  const cleanupSocket = () => {
    removeSocketListener('receiveMessage');
    removeSocketListener('newMessage');
    removeSocketListener('messageSaved');
  };

  const handleReceiveMessage = (msg: MessageItem) => {
    // Support raw Mongo ObjectId objects (which don\'t have an _id prop) by coercing to string first
    const extractId = (value: any) => {
      if (!value) return undefined;
      if (typeof value === 'string') return value;
      // Handle populated objects ( { _id: "..." } )
      if (typeof value === 'object' && value._id) return value._id as string;
      // Handle raw ObjectId instances
      if (typeof value.toString === 'function') return value.toString();
      return undefined;
    };

    const msgSenderId = extractId(msg.sender);
    const msgReceiverId = extractId(msg.receiver);
    
    if (
      (msgSenderId === partnerId && msgReceiverId === user?.id) ||
      (msgSenderId === user?.id && msgReceiverId === partnerId)
    ) {
      console.log('Received message:', msg);
      
      // Check if we already have this message (avoid duplicates)
      const isDuplicate = messages.some(m => 
        m._id === msg._id || 
        (m.content === msg.content && 
         ((typeof m.sender === 'object' ? m.sender._id : m.sender) === msgSenderId) && 
         m.timestamp === msg.timestamp)
      );
      
      if (!isDuplicate) {
        setMessages((prev) => [...prev, msg]);
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }
  };

  const handleNewMessage = (data: { conversationId: string, message: MessageItem }) => {
    if (!data || !data.message) return;
    
    const msg = data.message;
    // Support raw Mongo ObjectId objects (which don\'t have an _id prop) by coercing to string first
    const extractId = (value: any) => {
      if (!value) return undefined;
      if (typeof value === 'string') return value;
      // Handle populated objects ( { _id: "..." } )
      if (typeof value === 'object' && value._id) return value._id as string;
      // Handle raw ObjectId instances
      if (typeof value.toString === 'function') return value.toString();
      return undefined;
    };

    const msgSenderId = extractId(msg.sender);
    const msgReceiverId = extractId(msg.receiver);

    // Check if this message belongs to our conversation (compare string IDs)
    if (
      (msgSenderId === partnerId && msgReceiverId === user?.id) ||
      (msgSenderId === user?.id && msgReceiverId === partnerId)
    ) {
      console.log('Received web message:', msg);
      
      // Save the conversation ID if we don't have it yet
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }
      
      // Normalize message format
      const normalizedMsg = {
        ...msg,
        _id: msg._id || `temp-${Date.now()}-${Math.random()}`,
        content: msg.content || msg.text || '',
        sender: typeof msg.sender === 'object' ? msg.sender._id : msg.sender,
        timestamp: msg.timestamp || msg.createdAt || new Date().toISOString()
      };
      
      // Check if we already have this message (avoid duplicates)
      const isDuplicate = messages.some(m => 
        m._id === normalizedMsg._id || 
        (m.content === normalizedMsg.content && 
         ((typeof m.sender === 'object' ? m.sender._id : m.sender) === msgSenderId) && 
         m.timestamp === normalizedMsg.timestamp)
      );
      
      if (!isDuplicate) {
        setMessages((prev) => [...prev, normalizedMsg]);
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }
  };

  const handleMessageSaved = (msg: MessageItem & { conversation?: string }) => {
    if (msg.conversation && !conversationId) {
      setConversationId(msg.conversation);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Validate partnerId
    if (!partnerId || partnerId === 'undefined') {
      Alert.alert('Error', 'Invalid partner ID. Please go back and try again.');
      return;
    }
    
    try {
      // If we have a conversation ID, use it
      if (conversationId) {
        try {
          await messageAPI.sendConversationMessage(conversationId, input.trim());
          
          // Try socket notification for web clients
          try {
            const socket = await getSocket();
            socket.emit('newMessage', {
              conversationId: conversationId,
              text: input.trim()
            });
          } catch (socketErr) {
            console.log('Socket error, but message sent via API:', socketErr);
          }
        } catch (err) {
          console.log('Falling back to direct message sending');
          await fallbackSendMessage();
        }
      } else {
        // No conversation ID yet, try to create one first
        try {
          const conversation = await messageAPI.startConversation(partnerId as string);
          
          if (conversation && conversation._id) {
            setConversationId(conversation._id);
            await messageAPI.sendConversationMessage(conversation._id, input.trim());
            
            // Try socket notification
            try {
              const socket = await getSocket();
              socket.emit('newMessage', {
                conversationId: conversation._id,
                text: input.trim()
              });
            } catch (socketErr) {
              console.log('Socket error, but message sent via API:', socketErr);
            }
          } else {
            await fallbackSendMessage();
          }
        } catch (err) {
          await fallbackSendMessage();
        }
      }
      
      // Optimistic UI update
      const tempMessage = {
        _id: `temp-${Date.now()}`,
        sender: user!.id,
        receiver: partnerId as string,
        content: input.trim(),
        timestamp: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, tempMessage]);
      setInput('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      console.error('Failed to send message', err);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };
  
  // Fallback method for sending messages
  const fallbackSendMessage = async () => {
    await messageAPI.sendMessage(partnerId as string, input.trim());
    
    // Try socket notification
    try {
      const socket = await getSocket();
      socket.emit('sendMessage', {
        receiver: partnerId,
        content: input.trim(),
      });
    } catch (socketErr) {
      console.log('Socket error in fallback:', socketErr);
    }
  };

  const pickImageFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) {
      await handleFileUpload(res.assets[0].uri, 'image');
    }
  };

  const pickDocument = async () => {
    const res: any = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] });
    if (!res.canceled && res.assets?.[0]?.uri) {
      await handleFileUpload(res.assets[0].uri, 'document');
    } else if (res.uri) {
      await handleFileUpload(res.uri, 'document');
    }
  };

  const handleFileUpload = async (uri: string, kind: 'image' | 'document') => {
    try {
      setUploading(true);
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: uri.split('/').pop() || `upload.${kind === 'image' ? 'jpg' : 'pdf'}`,
        type: kind === 'image' ? 'image/jpeg' : 'application/pdf',
      } as any);

      const response = await fetch(`${API_BASE_URL.replace(/\/api$/, '')}/uploads/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
      const data = await response.json();
      if (data.url) {
        await sendMessageWithAttachment(data.url);
      }
    } catch (e) {
      console.error('Upload error', e);
    } finally {
      setUploading(false);
    }
  };

  const sendMessageWithAttachment = async (url: string) => {
    try {
      if (conversationId) {
        // Try to send via conversation first
        try {
          const socket = await getSocket();
          socket.emit('newMessage', {
            conversationId,
            text: '📎 Attachment',
            attachments: [url]
          });
        } catch (err) {
          // Fallback to direct message
          const socket = await getSocket();
          socket.emit('sendMessage', { 
            receiver: partnerId, 
            content: '', 
            attachments: [url] 
          });
        }
      } else {
        // No conversation ID yet, use direct message
        const socket = await getSocket();
        socket.emit('sendMessage', { 
          receiver: partnerId, 
          content: '', 
          attachments: [url] 
        });
      }
      
      // Optimistic UI update
      setMessages((prev) => [...prev, {
        _id: Date.now().toString(),
        sender: user!.id,
        receiver: partnerId as string,
        content: '',
        attachments: [url],
        timestamp: new Date().toISOString(),
      }]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      console.error('Failed to send attachment', err);
    }
  };

  const renderItem = ({ item }: { item: MessageItem }) => {
    // Handle both string and object sender formats
    const senderId = typeof item.sender === 'object' ? item.sender._id : item.sender;
    const isMine = senderId === user?.id;
    const hasImage = item.attachments && item.attachments[0] && item.attachments[0].match(/\.(png|jpe?g|gif)$/i);
    
    return (
      <View
        style={[
          styles.messageBubble,
          {
            alignSelf: isMine ? 'flex-end' : 'flex-start',
            backgroundColor: isMine ? (colors as any).babyBlue : colors.cardBackground,
          },
        ]}
      >
        {(item.content || item.text) ? (
          <Text style={[Typography.nunitoBody, { color: isMine ? '#fff' : colors.text }]}>
            {item.content || item.text}
          </Text>
        ) : null}
        {hasImage && (
          <Image source={{ uri: item.attachments![0] }} style={{ width: 160, height: 160, borderRadius: 8, marginTop: 4 }} />
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={[Typography.nunitoSubheading, { color: colors.text }]}>{partnerName}</Text>
        
        {/* Socket connection indicator */}
        <View style={[
          styles.connectionIndicator, 
          { backgroundColor: socketConnected ? '#4caf50' : '#f44336' }
        ]} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.icon} />
          <Text style={[Typography.nunitoBody, { color: colors.text, marginTop: 10 }]}>Loading messages...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              // Reload conversation
              const load = async () => {
                setLoading(true);
                setError('');
                try {
                  const data = await messageAPI.getConversation(partnerId as string);
                  setMessages(data);
                } catch (err) {
                  console.error('Failed to load conversation', err);
                  setError('Could not load messages. Please try again.');
                } finally {
                  setLoading(false);
                }
              };
              load();
              setupSocket();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item._id || item.timestamp || Date.now().toString() + Math.random().toString()}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Text>No messages yet. Start the conversation!</Text>
            </View>
          }
        />
      )}

      {/* Socket reconnecting indicator */}
      {socketReconnecting && (
        <View style={styles.reconnectingContainer}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.reconnectingText}>Reconnecting...</Text>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={pickImageFromLibrary} style={styles.attachBtn}>
          <Text style={{ fontSize: 20 }}>📎</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={pickDocument} style={styles.attachBtn}>
          <Text style={{ fontSize: 20 }}>📄</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.icon}
        />
        <TouchableOpacity 
          onPress={sendMessage} 
          style={styles.sendBtn}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={(colors as any).babyBlue} />
          ) : (
            <Text style={{ color: (colors as any).babyBlue, fontWeight: '600' }}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginRight: 12,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: '80%',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f1f3',
    marginRight: 8,
  },
  sendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  attachBtn: {
    padding: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#e53935',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  reconnectingContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reconnectingText: {
    color: 'white',
    marginLeft: 8,
  },
}); 