import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback, useEffect } from 'react';
import { useUserRole } from '../contexts/UserRoleContext';
import { notificationsAPI } from '../api/api';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';

// Notification type definition
type Notification = {
  id: string;
  _id?: string;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  type: 'appointment' | 'treatment' | 'medication' | 'followup' | 'promotion' | 'update' | 'security';
  action?: string;
  isSelected?: boolean;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userRole } = useUserRole();
  
  // Mock notifications based on user role
  const getUserNotifications = (): Notification[] => [
    {
      id: '1',
      title: 'Appointment Confirmation',
      description: 'Your appointment with PawCare Clinic for Fluffy has been confirmed for tomorrow at 10:00 AM.',
      timestamp: '2023-05-18T09:30:00',
      isRead: false,
      type: 'appointment',
      action: 'View Appointment'
    },
    {
      id: '2',
      title: 'Treatment Update',
      description: 'Max has completed the first stage of heartworm treatment. Please ensure medication is given as prescribed.',
      timestamp: '2023-05-17T14:20:00',
      isRead: true,
      type: 'treatment',
      action: 'View Details'
    },
    {
      id: '3',
      title: 'Medication Reminder',
      description: 'Time to give Fluffy the prescribed medication. Mark as done once completed.',
      timestamp: '2023-05-17T08:00:00',
      isRead: false,
      type: 'medication',
      action: 'Mark as Done'
    },
    {
      id: '4',
      title: 'Follow-Up Needed',
      description: 'Fluffy is due for a follow-up vaccination check. Please schedule an appointment soon.',
      timestamp: '2023-05-16T16:45:00',
      isRead: true,
      type: 'followup',
      action: 'Schedule Now'
    },
    {
      id: '5',
      title: 'Special Discount on Pet Food',
      description: 'Enjoy 20% off on premium pet food at PawCare Clinic shop this weekend only!',
      timestamp: '2023-05-15T11:30:00',
      isRead: true,
      type: 'promotion'
    },
    {
      id: '6',
      title: 'App Update Available',
      description: 'A new version of PetEat is available with improved features and bug fixes.',
      timestamp: '2023-05-14T09:15:00',
      isRead: true,
      type: 'update',
      action: 'Update Now'
    },
    {
      id: '7',
      title: 'Security Alert',
      description: 'Your account was accessed from a new device. If this was not you, please secure your account.',
      timestamp: '2023-05-12T22:10:00',
      isRead: true,
      type: 'security',
      action: 'Secure Account'
    }
  ];
  
  const getClinicNotifications = (): Notification[] => [
    {
      id: '1',
      title: 'New Appointment Booked',
      description: 'Jane Smith has booked an appointment for Fluffy on May 20th at 2:00 PM.',
      timestamp: '2023-05-18T10:15:00',
      isRead: false,
      type: 'appointment',
      action: 'View Details'
    },
    {
      id: '2',
      title: 'Appointment Canceled',
      description: 'Michael Brown has canceled the appointment for Bella scheduled on May 19th.',
      timestamp: '2023-05-18T09:30:00',
      isRead: false,
      type: 'appointment'
    },
    {
      id: '3',
      title: 'Pet Added to Treatment',
      description: 'Rex has been admitted for treatment. Please assign a staff member.',
      timestamp: '2023-05-17T16:20:00',
      isRead: true,
      type: 'treatment',
      action: 'Assign Staff'
    },
    {
      id: '4',
      title: 'Staff Request',
      description: 'Dr. Johnson has requested assistance with a surgery scheduled at 3:00 PM today.',
      timestamp: '2023-05-17T11:45:00',
      isRead: false,
      type: 'treatment'
    },
    {
      id: '5',
      title: 'Inventory Alert',
      description: 'Amoxicillin stock is running low. Please reorder soon.',
      timestamp: '2023-05-16T14:30:00',
      isRead: true,
      type: 'update',
      action: 'Reorder Now'
    },
    {
      id: '6',
      title: 'System Update',
      description: 'Clinic management system will undergo maintenance tonight from 2:00 AM to 4:00 AM.',
      timestamp: '2023-05-15T12:10:00',
      isRead: true,
      type: 'update'
    },
    {
      id: '7',
      title: 'Security Alert',
      description: 'Multiple failed login attempts detected for staff account "receptionist1".',
      timestamp: '2023-05-14T08:45:00',
      isRead: true,
      type: 'security',
      action: 'Review Activity'
    }
  ];
  
  // State management
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const loadNotifications = async () => {
    try {
      const data = await notificationsAPI.getMine();
      setNotifications(data);
    } catch(err) {
      console.warn('Notifications API failed, falling back to mock');
      setNotifications(userRole === 'user' ? getUserNotifications() : getClinicNotifications());
    }
  };
  
  useEffect(() => { loadNotifications(); }, [userRole]);
  
  const goBack = () => {
    router.back();
  };
  
  // Refresh when screen in focus
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [userRole])
  );
  
  const markAsRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.map(notif => 
        notif._id === id || notif.id === id ? { ...notif, readAt: new Date().toISOString(), isRead: true } : notif
      ));
    } catch(err) {
      console.error(err);
    }
  };
  
  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAll();
      setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString(), isRead: true })));
      Alert.alert('All notifications marked as read');
    } catch(err){ console.error(err);}  
  };
  
  const toggleSelection = (id: string) => {
    setNotifications(notifications.map(notif => 
      notif.id === id ? { ...notif, isSelected: !notif.isSelected } : notif
    ));
  };
  
  const selectAllNotifications = () => {
    setNotifications(notifications.map(notif => ({ ...notif, isSelected: true })));
  };
  
  const clearAll = () => {
    Alert.alert(
      "Clear All Notifications",
      "Are you sure you want to clear all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive",
          onPress: () => {
            setNotifications([]);
          }
        }
      ]
    );
  };
  
  const deleteSelected = () => {
    const selectedCount = notifications.filter(n => n.isSelected).length;
    if (selectedCount === 0) {
      Alert.alert('No notifications selected', 'Please select notifications to delete.');
      return;
    }
    
    Alert.alert(
      `Delete ${selectedCount} Notification${selectedCount > 1 ? 's' : ''}`,
      "Are you sure you want to delete the selected notifications?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            setNotifications(notifications.filter(n => !n.isSelected));
          }
        }
      ]
    );
  };
  
  const exportNotifications = () => {
    Alert.alert(
      "Export Notifications",
      "Notifications will be exported to a CSV file",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Export", onPress: () => Alert.alert("Success", "Notifications exported successfully") }
      ]
    );
  };
  
  const refreshNotifications = () => { loadNotifications(); };
  
  const openNotificationSettings = () => {
    Alert.alert(
      "Notification Settings",
      "This would open notification preference settings",
      [{ text: "OK" }]
    );
  };
  
  const handleNotificationAction = (notification: Notification) => {
    // Mark the notification as read
    markAsRead(notification.id);
    
    // Handle different actions based on notification type
    if (notification.action) {
      Alert.alert(
        notification.title,
        `This would perform action: ${notification.action}`,
        [{ text: "OK" }]
      );
    }
  };
  
  // Icon for different notification types
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment': return "calendar";
      case 'treatment': return "cross.case.fill";
      case 'medication': return "pill.fill";
      case 'followup': return "person.crop.circle.badge.checkmark";
      case 'promotion': return "tag.fill";
      case 'update': return "arrow.triangle.2.circlepath";
      case 'security': return "lock.fill";
      default: return "bell.fill";
    }
  };
  
  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const formattedTime = new Date(item.timestamp).toLocaleString();
    
    return (
      <TouchableOpacity 
        style={[
          styles.notificationItem, 
          !item.isRead && styles.unreadNotification,
          item.isSelected && styles.selectedNotification
        ]}
        onPress={() => handleNotificationAction(item)}
        onLongPress={() => toggleSelection(item.id)}
      >
        <View style={styles.notificationIconContainer}>
          <IconSymbol 
            name={getNotificationIcon(item.type)} 
            size={24} 
            color={item.isRead ? Colors.light.icon : Colors.light.tint} 
          />
          {item.isSelected && (
            <View style={styles.selectionIndicator}>
              <IconSymbol name="checkmark" size={12} color="#FFF" />
            </View>
          )}
        </View>
        
        <View style={styles.notificationContent}>
          <Text style={[
            styles.notificationTitle,
            !item.isRead && styles.unreadText
          ]}>
            {item.title}
          </Text>
          
          <Text style={styles.notificationDescription}>
            {item.description}
          </Text>
          
          <Text style={styles.notificationTime}>
            {formattedTime}
          </Text>
          
          {item.action && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleNotificationAction(item)}
            >
              <Text style={styles.actionButtonText}>
                {item.action}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={goBack}>
            <Image 
              source={require('../../assets/images/left-arrow.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <Text style={styles.screenTitle}>Notifications</Text>
          
          <TouchableOpacity style={styles.iconButton} onPress={openNotificationSettings}>
            <IconSymbol name="slider.horizontal.3" size={24} color={Colors.light.text} />
          </TouchableOpacity>
        </View>
        
        {/* Notification List */}
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="bell.slash.fill" size={48} color={Colors.light.icon} />
              <Text style={styles.emptyText}>No notifications</Text>
            </View>
          }
        />
        
        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={styles.actionBarButton} onPress={refreshNotifications}>
              <IconSymbol name="arrow.clockwise" size={18} color={Colors.light.text} />
              <Text style={styles.actionBarButtonText}>Refresh</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBarButton} onPress={markAllAsRead}>
              <IconSymbol name="checkmark.circle" size={18} color={Colors.light.text} />
              <Text style={styles.actionBarButtonText}>Mark All as Read</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBarButton} onPress={clearAll}>
              <IconSymbol name="trash" size={18} color={Colors.light.text} />
              <Text style={styles.actionBarButtonText}>Clear All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBarButton} onPress={deleteSelected}>
              <IconSymbol name="trash.slash" size={18} color={Colors.light.text} />
              <Text style={styles.actionBarButtonText}>Delete Selected</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBarButton} onPress={exportNotifications}>
              <IconSymbol name="square.and.arrow.up" size={18} color={Colors.light.text} />
              <Text style={styles.actionBarButtonText}>Export</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#FFF',
  },
  unreadNotification: {
    backgroundColor: '#F0F7FF',
  },
  selectedNotification: {
    backgroundColor: '#E8F5E9',
  },
  notificationIconContainer: {
    marginRight: 12,
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: '700',
  },
  notificationDescription: {
    fontSize: 14,
    color: Colors.light.icon,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.light.icon,
    marginBottom: 8,
  },
  actionButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.tint,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.icon,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  actionBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  actionBarButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: Colors.light.text,
  }
}); 