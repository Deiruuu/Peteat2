import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { bookingAPI } from '../api/api';

// Define booking type
interface Booking {
  _id: string;
  petOwner: {
    _id: string;
    fullName: string;
    email: string;
  };
  clinic: string;
  pet: {
    _id: string;
    name: string;
    species: string;
  };
  bookingDate: string;
  appointmentTime: string;
  appointmentType: 'video' | 'in_person';
  reason: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export default function ClinicBookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  const goBack = () => {
    router.back();
  };
  
  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setLoading(true);
      const data = await bookingAPI.getBookingsByClinic(user.id);
      setBookings(data);
    } catch (err) {
      console.error('Error fetching bookings', err);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };
  
  const approveBooking = async (id: string) => {
    try {
      // First, get the booking details to check if it's a video consultation
      const booking = await bookingAPI.getBooking(id);
      
      // Update booking status to confirmed
      await bookingAPI.updateBookingStatus(id, 'confirmed');
      
      Alert.alert('Success', 'Booking has been approved');
      
      fetchBookings(); // Refresh the list
    } catch (error) {
      console.error('Error approving booking', error);
      Alert.alert('Error', 'Failed to approve booking');
    }
  };
  
  const rejectBooking = async (id: string) => {
    Alert.alert('Reject Booking', 'Are you sure you want to reject this booking?', [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await bookingAPI.updateBookingStatus(id, 'cancelled');
            Alert.alert('Success', 'Booking has been rejected');
            fetchBookings(); // Refresh the list
          } catch (error) {
            console.error('Error rejecting booking', error);
            Alert.alert('Error', 'Failed to reject booking');
          }
        }
      }
    ]);
  };
  
  const viewDetails = (booking: Booking) => {
    Alert.alert(
      'Booking Details',
      `Pet: ${booking.pet?.name || 'N/A'}\n` +
      `Owner: ${booking.petOwner?.fullName || 'N/A'}\n` +
      `Date: ${new Date(booking.bookingDate).toLocaleDateString()}\n` +
      `Time: ${booking.appointmentTime}\n` +
      `Reason: ${booking.reason}\n` +
      `Status: ${booking.status}`
    );
  };

  // Filter bookings based on selected filter
  const filteredBookings = bookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    return booking.status === selectedFilter;
  });
  
  const renderBookingItem = ({ item }: { item: Booking }) => (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        {/* Use a default image if pet image is not available */}
        <Image 
          source={require('../../assets/images/robert-pisot.jpg')} 
          style={styles.petImage} 
        />
        <View style={styles.bookingInfo}>
          <Text style={styles.petName}>{item.pet?.name || 'Unknown Pet'}</Text>
          <Text style={styles.ownerName}>Owner: {item.petOwner?.fullName || 'Unknown Owner'}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          getStatusStyle(item.status)
        ]}>
          <Text style={styles.statusText}>
            {capitalizeFirstLetter(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <IconSymbol name="calendar" size={16} color={Colors.light.icon} />
          <Text style={styles.detailText}>
            {new Date(item.bookingDate).toLocaleDateString()} at {item.appointmentTime}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <IconSymbol name="list.clipboard" size={16} color={Colors.light.icon} />
          <Text style={styles.detailText}>
            Reason: {item.reason}
          </Text>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.viewButton]} 
          onPress={() => viewDetails(item)}
        >
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
        
        {item.status === 'pending' && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, styles.approveButton]} 
              onPress={() => approveBooking(item._id)}
            >
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]} 
              onPress={() => rejectBooking(item._id)}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  // Helper functions
  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed':
        return styles.statusApproved;
      case 'pending':
        return styles.statusPending;
      case 'cancelled':
        return styles.statusCancelled;
      case 'completed':
        return styles.statusCompleted;
      default:
        return styles.statusPending;
    }
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Image 
            source={require('../../assets/images/left-arrow.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Manage Bookings</Text>
        
        <View style={{ width: 40 }} />
      </View>
      
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === 'all' && styles.activeFilterTab
            ]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[
              styles.filterText,
              selectedFilter === 'all' && styles.activeFilterText
            ]}>All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === 'pending' && styles.activeFilterTab
            ]}
            onPress={() => setSelectedFilter('pending')}
          >
            <Text style={[
              styles.filterText,
              selectedFilter === 'pending' && styles.activeFilterText
            ]}>Pending</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === 'confirmed' && styles.activeFilterTab
            ]}
            onPress={() => setSelectedFilter('confirmed')}
          >
            <Text style={[
              styles.filterText,
              selectedFilter === 'confirmed' && styles.activeFilterText
            ]}>Confirmed</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === 'completed' && styles.activeFilterTab
            ]}
            onPress={() => setSelectedFilter('completed')}
          >
            <Text style={[
              styles.filterText,
              selectedFilter === 'completed' && styles.activeFilterText
            ]}>Completed</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === 'cancelled' && styles.activeFilterTab
            ]}
            onPress={() => setSelectedFilter('cancelled')}
          >
            <Text style={[
              styles.filterText,
              selectedFilter === 'cancelled' && styles.activeFilterText
            ]}>Cancelled</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      {/* Booking List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No bookings found</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={fetchBookings}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: Colors.light.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  activeFilterTab: {
    backgroundColor: Colors.light.tint,
  },
  filterText: {
    color: Colors.light.text,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  bookingHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  petImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  bookingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  petName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  ownerName: {
    fontSize: 14,
    color: Colors.light.icon,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: '#FFF9C4',
  },
  statusApproved: {
    backgroundColor: '#C8E6C9',
  },
  statusCancelled: {
    backgroundColor: '#FFCDD2',
  },
  statusCompleted: {
    backgroundColor: '#BBDEFB',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetails: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginHorizontal: 4,
  },
  viewButton: {
    backgroundColor: '#f5f5f5',
  },
  approveButton: {
    backgroundColor: '#C8E6C9',
  },
  rejectButton: {
    backgroundColor: '#FFCDD2',
  },
  viewButtonText: {
    color: Colors.light.text,
    fontWeight: '500',
  },
  approveButtonText: {
    color: '#388E3C',
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#D32F2F',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.icon,
  },
}); 