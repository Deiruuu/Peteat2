import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Colors } from '../../constants/Colors';
import { Typography } from '@/constants/Typography';
import { userAPI, messageAPI } from '../api/api';
import { useRouter } from 'expo-router';
import { useUserRole } from '../contexts/UserRoleContext';

interface ClinicItem {
  id: string;
  fullName: string; // stored as clinicName or fullName in DB
  clinicName?: string;
  profilePicture?: string;
  location?: any;
  operatingHours?: string;
}

export default function CreateChatScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userRole } = useUserRole();

  const [items, setItems] = useState<ClinicItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ClinicItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let data;
        if (userRole === 'clinic') {
          data = await userAPI.getPetOwners();
        } else {
          data = await userAPI.getApprovedClinics();
        }
        setItems(data);
      } catch (err) {
        console.error('Failed to fetch list', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [userRole]);

  const renderItem = ({ item }: { item: ClinicItem }) => (
    <TouchableOpacity
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
      activeOpacity={0.8}
      onPress={() => setSelectedItem(item)}
    >
      <Image
        source={item.profilePicture ? { uri: item.profilePicture } : require('../../assets/images/peteat-logo.png')}
        style={styles.avatar}
      />
      <Text style={[Typography.nunitoBodyBold, { flex: 1, color: colors.text }]}> 
        {item.clinicName || item.fullName}
      </Text>
      <TouchableOpacity
        onPress={() => {
          setSelectedItem(item);
          handleStartChat(item);
        }}
        style={styles.chatBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Image source={require('../../assets/images/chatting.png')} style={styles.chatIcon} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const handleStartChat = async (item: ClinicItem = selectedItem!) => {
    if (!item) return;
    
    try {
      setIsLoading(true);
      console.log('Starting chat with:', item.id, item.fullName || item.clinicName);
      
      // Use the new startConversation method that works with website
      let conversation;
      try {
        conversation = await messageAPI.startConversation(item.id);
      } catch (err) {
        console.error('Failed to start conversation:', err);
        // If conversation creation fails, still try to navigate to chat screen
        // The chat screen will handle creating the conversation
      }
      
      // Navigate to the chat screen with the partner ID
      router.push(`/(features)/chat/${item.id}`);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      
      // Show more detailed error message
      const errorMessage = typeof err === 'object' && err !== null && 'message' in err 
        ? (err as Error).message 
        : 'Failed to start conversation';
      Alert.alert('Error', `${errorMessage}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={[Typography.nunitoSubheading, { color: colors.text }]}>Select {userRole === 'clinic' ? 'Pet Owner' : 'Clinic'}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* Modal for clinic details */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedItem(null)}>
          <View style={styles.modalOverlay}>
            <Pressable onPress={() => {}} style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
              {selectedItem && (
                <>
                  <Image
                    source={selectedItem.profilePicture ? { uri: selectedItem.profilePicture } : require('../../assets/images/peteat-logo.png')}
                    style={styles.modalImage}
                  />
                  <Text style={[Typography.nunitoSubheading, { marginTop: 12, color: colors.text }]}> 
                    {selectedItem.clinicName || selectedItem.fullName}
                  </Text>
                  {selectedItem.location && (
                    <Text style={[Typography.nunitoBody, { marginTop: 8, color: colors.text }]}>📍 {typeof selectedItem.location === 'string' ? selectedItem.location : `${selectedItem.location.coordinates?.[1]?.toFixed(5)}, ${selectedItem.location.coordinates?.[0]?.toFixed(5)}`}</Text>
                  )}
                  {selectedItem.operatingHours && (
                    <Text style={[Typography.nunitoBody, { marginTop: 4, color: colors.text }]}>🕒 {selectedItem.operatingHours}</Text>
                  )}
                </>
              )}
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  chatBtn: { paddingHorizontal: 4 },
  chatIcon: { width: 24, height: 24, resizeMode: 'contain' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  modalImage: { width: 100, height: 100, borderRadius: 50 },
}); 