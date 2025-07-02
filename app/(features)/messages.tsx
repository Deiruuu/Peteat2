import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { messageAPI } from '../api/api';
import { getSocket, addSocketListener, removeSocketListener, initializeSocket } from '../../utils/socket';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';

// Define conversation item type
interface ConversationItem {
  conversationId?: string;
  userId: string;
  partnerName?: string;
  partnerPicture?: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

// Define web conversation type
interface WebConversation {
  _id: string;
  participant?: {
    _id: string;
    fullName?: string;
    clinicName?: string;
    profilePicture?: string;
  };
  lastMessageText?: string;
  lastMessageDate?: string;
  updatedAt?: string;
  unreadCount?: number;
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const appState = useRef(AppState.currentState);
  
  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground - reconnecting socket and refreshing data');
        setupSocketConnection();
        loadConversations();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
  
  const loadConversations = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Loading conversations...');
      
      // Try website-compatible method first
      try {
        const webConversations = await messageAPI.getConversations();
        console.log(`Loaded ${webConversations?.length || 0} web conversations`);
        
        if (webConversations && webConversations.length > 0) {
          // Convert to our format
          const formatted = webConversations.map((conv: WebConversation) => ({
            conversationId: conv._id,
            userId: conv.participant?._id || '',
            partnerName: conv.participant?.fullName || conv.participant?.clinicName || 'Unknown',
            partnerPicture: conv.participant?.profilePicture || '',
            lastMessage: conv.lastMessageText || '',
            timestamp: conv.lastMessageDate || conv.updatedAt || new Date().toISOString(),
            unread: conv.unreadCount || 0
          }));
          setConversations(formatted);
        } else {
          // Try mobile method as fallback
          await loadMobileConversations();
        }
      } catch (err) {
        console.log('Web conversations failed, trying mobile format:', err);
        await loadMobileConversations();
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const loadMobileConversations = async () => {
    try {
      const mobileConversations = await messageAPI.getUserConversations();
      console.log(`Loaded ${mobileConversations?.length || 0} mobile conversations`);
      
      if (mobileConversations && mobileConversations.length > 0) {
        // Filter out conversations with invalid partner IDs
        const validConversations = mobileConversations.filter(
          (conv: ConversationItem) => conv.userId && conv.userId !== 'undefined'
        );
        
        // Sort by timestamp (newest first)
        validConversations.sort((a: ConversationItem, b: ConversationItem) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        setConversations(validConversations);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error('Mobile conversations failed:', err);
      setError('Failed to load conversations. Pull down to refresh.');
      setConversations([]);
    }
  };
  
  // Fetch inbox on mount
  useEffect(() => {
    loadConversations();
    
    // Set up socket connection for real-time updates
    setupSocketConnection();
    
    // Clean up function to remove listeners
    return () => {
      removeSocketListener('conversationUpdated');
      removeSocketListener('newMessage');
    };
  }, []);
  
  // Reload conversations when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadConversations();
      return () => {};
    }, [])
  );
  
  const setupSocketConnection = async () => {
    try {
      // Initialize socket directly to ensure we have a fresh connection
      await initializeSocket();
      
      // Get the socket instance
      const socket = await getSocket();
      setSocketConnected(true);
      
      console.log('Socket connected in messages screen');
      
      // Add listener for conversation updates (mobile format)
      addSocketListener('conversationUpdated', handleConversationUpdate);
      
      // Add listener for web format messages
      addSocketListener('newMessage', handleWebMessage);
    } catch (e) {
      console.error('Socket connection failed:', e);
      setSocketConnected(false);
    }
  };
  
  const handleConversationUpdate = (summary: any) => {
    if (!summary || !summary.userId) {
      console.log('Received invalid conversation update:', summary);
      return;
    }
    
    console.log('Received conversation update:', summary);
    
    setConversations((prev) => {
      // Check if this conversation already exists
      const idx = prev.findIndex((c) => 
        c.userId === summary.userId || 
        (c.conversationId && c.conversationId === summary.conversationId)
      );
      
      if (idx >= 0) {
        // Update existing conversation
        const updated = { ...prev[idx], ...summary };
        const list = [...prev];
        list[idx] = updated;
        
        // Sort by timestamp (newest first)
        return list.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }
      
      // Add new conversation at the top
      return [summary, ...prev].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });
  };
  
  const handleWebMessage = (data: { conversationId: string, message: any }) => {
    if (!data || !data.conversationId || !data.message) {
      console.log('Received invalid message:', data);
      return;
    }
    
    console.log('Received new message for conversation:', data.conversationId);
    
    const { conversationId, message } = data;
    
    setConversations((prev) => {
      // Find conversation by ID
      const idx = prev.findIndex((c) => c.conversationId === conversationId);
      
      if (idx >= 0) {
        // Update existing conversation
        const msgSenderId = typeof message.sender === 'object' ? message.sender._id : message.sender;
        const updated = { 
          ...prev[idx], 
          lastMessage: message.text || message.content || '📎 Attachment',
          timestamp: message.createdAt || message.timestamp || new Date().toISOString(),
          // Increment unread count if message is from partner
          unread: prev[idx].userId === msgSenderId ? prev[idx].unread + 1 : prev[idx].unread
        };
        
        const list = [...prev];
        list[idx] = updated;
        
        // Sort by timestamp (newest first)
        return list.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }
      
      // Conversation not found, we'll reload the full list
      setTimeout(() => loadConversations(), 500);
      return prev;
    });
  };
  
  const goBack = () => {
    router.back();
  };
  
  const handleNewChat = () => {
    router.push('/create-chat' as any);
  };
  
  const openConversation = (partnerId: string, name: string) => {
    if (!partnerId || partnerId === 'undefined') {
      Alert.alert('Error', 'Invalid conversation partner');
      return;
    }
    router.push(`/chat/${partnerId}` as any);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      // If invalid date, return empty string
      if (isNaN(date.getTime())) return '';
      
      // Today - show time only
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Yesterday
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      
      // This week - show day name
      const dayDiff = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
      if (dayDiff < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      }
      
      // Older - show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (err) {
      return '';
    }
  };

  const renderItem = ({ item }: { item: ConversationItem }) => {
    return (
      <TouchableOpacity
        style={[styles.conversationItem, { backgroundColor: colors.cardBackground }]}
        onPress={() => openConversation(item.userId, item.partnerName || 'Chat')}
      >
        <View style={styles.avatarContainer}>
          {item.partnerPicture ? (
            <Image
              source={{ uri: item.partnerPicture }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.icon }]}>
              <Text style={styles.avatarText}>
                {(item.partnerName?.charAt(0) || '?').toUpperCase()}
              </Text>
            </View>
          )}
          {item.unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread}</Text>
            </View>
          )}
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.nameRow}>
            <Text 
              style={[
                Typography.nunitoSubheading, 
                { color: colors.text, flex: 1 },
                item.unread > 0 ? { fontWeight: 'bold' } : {}
              ]}
              numberOfLines={1}
            >
              {item.partnerName || 'Unknown'}
            </Text>
            <Text style={[Typography.nunitoCaption, { color: colors.icon }]}>
              {formatDate(item.timestamp)}
            </Text>
          </View>
          <Text 
            style={[
              Typography.nunitoBody, 
              { color: item.unread > 0 ? colors.text : colors.icon },
              item.unread > 0 ? { fontWeight: 'bold' } : {}
            ]}
            numberOfLines={1}
          >
            {item.lastMessage || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Define accent color for buttons
  const accentColor = colors.accent || '#4caf50';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <Text style={[Typography.nunitoHeading, { color: colors.text }]}>Messages</Text>
        <TouchableOpacity onPress={handleNewChat} style={styles.newMessageBtn}>
          <Text style={{ fontSize: 24, color: colors.icon }}>+</Text>
        </TouchableOpacity>
        
        {/* Socket connection indicator */}
        <View style={[
          styles.connectionIndicator, 
          { backgroundColor: socketConnected ? '#4caf50' : '#f44336' }
        ]} />
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.icon} />
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={[Typography.nunitoBody, { color: colors.text, textAlign: 'center', marginBottom: 16 }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={loadConversations}
          >
            <Text style={[Typography.nunitoBody, { color: '#fff' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={[Typography.nunitoBody, { color: colors.text, textAlign: 'center' }]}>
            No conversations yet.{'\n'}Start a new chat to message a clinic.
          </Text>
          <TouchableOpacity
            style={[styles.newChatButton, { backgroundColor: accentColor, marginTop: 16 }]}
            onPress={handleNewChat}
          >
            <Text style={[Typography.nunitoBody, { color: '#fff' }]}>New Message</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.conversationId || item.userId || Math.random().toString()}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[accentColor]}
              tintColor={accentColor}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  newMessageBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    backgroundColor: '#e53935',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  newChatButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
});