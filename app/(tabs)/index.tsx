import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/constants/Typography';
import { Card } from '@/components/ui/Card';
import { LoadingDialog } from '@/components/ui/LoadingDialog';
import { useUserRole } from '../contexts/UserRoleContext';
import { useAuth } from '../contexts/AuthContext';
import * as Location from 'expo-location';
import { userAPI } from '../api/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

type Clinic = { _id: string; clinicName: string; profilePicture?: string; address?: string };
type Booking = {
  _id: string;
  petOwner: {
    _id: string;
    fullName: string;
    email: string;
  };
  clinic: {
    _id: string;
    clinicName: string;
    fullName?: string;
  };
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
  zoomConsultation?: boolean;
  zoomMeeting?: {
    meetingId: string;
    password: string;
    start_url: string;
    join_url: string;
    created_at: string;
  };
};

// Pet owner buttons configuration with icons
const USER_BUTTONS = [
  { id: '2', imageIcon: require('../../assets/images/nfc.png'), label: 'Pet Details', color: 'mintGreen' },
  { id: '3', imageIcon: require('../../assets/images/chatting.png'), label: 'Messages', color: 'lavender' },
  { id: '4', imageIcon: require('../../assets/images/appointment.png'), label: 'Booking', color: 'peach' },
  { id: '5', imageIcon: require('../../assets/images/veterinary.png'), label: 'Add Pets', color: 'babyBlue' },
  { id: '7', imageIcon: require('../../assets/images/magnifying-glass.png'), label: 'Find Clinics', color: 'lavender' },
];

// Clinic role buttons configuration with icons
const CLINIC_BUTTONS = [
  { id: '2', imageIcon: require('../../assets/images/nfc.png'), label: 'Pet Details', color: 'mintGreen' },
  { id: '3', imageIcon: require('../../assets/images/chatting.png'), label: 'Messages', color: 'lavender' },
  { id: '4', imageIcon: require('../../assets/images/booking.png'), label: 'Manage Bookings', color: 'peach' },
  { id: '6', imageIcon: require('../../assets/images/magnifying-glass.png'), label: 'Find Clinics', color: 'lavender' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isLoading, setIsLoading] = useState(false);
  const { userRole } = useUserRole();
  const { user } = useAuth();
  const [nearbyClinics, setNearbyClinics] = useState<Clinic[]>([]);
  
  useEffect(() => {
    fetchNearbyClinics();
  }, []);
  
  const fetchNearbyClinics = async () => {
    try {
      // ask permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      const data = await userAPI.getNearbyClinics(loc.coords.latitude, loc.coords.longitude);
      setNearbyClinics(data);
    } catch (err) { console.log('Clinics fetch err', err); }
  };
  
  // Open account page (placeholder)
  const openAccountPage = () => {
    router.push('/account');
  };
  
  // Handle search button press
  const handleSearch = () => {
    router.push('/(features)/clinic-search');
  };
  
  // Handle notification button press
  const handleNotifications = () => {
    console.log('Notifications button pressed');
  };
  
  // Handle category button press
  const handleCategoryPress = (id: string, label: string) => {
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      
      // Create routes based on button label
      switch (label) {
        case 'Pet Details':
          router.push("/(features)/nfc");
          break;
        case 'Messages':
          router.push("/(features)/messages");
          break;
        case 'Booking':
          router.push("/(features)/booking");
          break;
        case 'Manage Bookings':
          router.push("/(features)/clinic-bookings");
          break;
        case 'Add Pets':
          router.push("/(features)/add-pet");
          break;
        case 'Find Clinics':
          router.push("/(features)/clinic-search");
          break;
        default:
          // Display a "coming soon" alert for features not yet implemented
          Alert.alert(
            "Coming Soon",
            `The ${label} feature is coming soon!`,
            [{ text: "OK" }]
          );
      }
    }, 600);
  };
  
  // Handle clinic press
  const handleClinicPress = (id: string, clinicName: string) => {
    // Navigate to clinic search page
    router.push('/(features)/clinic-search');
  };
  
  // Determine which buttons to show based on user role
  const buttonData = userRole === 'user' ? USER_BUTTONS : CLINIC_BUTTONS;
  
  // Display appropriate heading based on user role
  const welcomeHeading = userRole === 'user' 
    ? `Welcome, ${user?.fullName?.split(' ')[0] || 'Pet Owner'}`
    : `Welcome, ${user?.fullName || 'Clinic'}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { 
        borderBottomColor: colors.border,
        backgroundColor: colors.cardBackground,
      }]}>
        <TouchableOpacity 
          style={styles.logoButton} 
          onPress={openAccountPage}
          activeOpacity={0.7}
        >
          <Image 
            source={require('../../assets/images/peteat-logo.png')} 
            style={[styles.logoImage, { borderRadius: 16 }]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <Text style={[Typography.nunitoHeading3, { color: colors.babyBlue, textAlign: 'center', flex: 1 }]}>PetEat</Text>
        
        <View style={styles.topBarRightIcons}>
          <TouchableOpacity style={styles.iconButton} onPress={handleSearch}>
            <Image 
              source={require('../../assets/images/magnifying-glass.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconButton} onPress={handleNotifications}>
            <Image 
              source={require('../../assets/images/notification.jpg')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Main Content Scroll */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome message */}
        <View style={styles.welcomeSection}>
          <Text style={[Typography.nunitoHeading2, { color: colors.text }]}>
            {welcomeHeading}
          </Text>
          <Text style={[Typography.nunitoBody, { color: colors.icon, marginTop: 4 }]}>
            {userRole === 'user' ? 'Manage your pets and find clinics' : 'Manage your bookings and patients'}
          </Text>
        </View>
        
        {/* Feature Categories Grid */}
        <View style={styles.categoriesSection}>
          <Text style={[Typography.nunitoHeading3, { color: colors.text, marginBottom: 16 }]}>
            {userRole === 'user' ? 'Pet Owner Features' : 'Clinic Features'}
          </Text>
          
          <View style={styles.categoriesGrid}>
            {buttonData.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.categoryButton,
                  { backgroundColor: colors[item.color as keyof typeof colors] }
                ]}
                onPress={() => handleCategoryPress(item.id, item.label)}
              >
                <Image source={item.imageIcon} style={styles.categoryIcon} resizeMode="contain" />
                <Text style={styles.categoryLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Nearby Clinics Section - Only show for pet owners */}
        {userRole === 'user' && (
          <View style={styles.nearbySection}>
            <View style={styles.sectionHeader}>
              <Text style={[Typography.nunitoHeading3, { color: colors.text }]}>
                Nearby Clinics
              </Text>
              <TouchableOpacity onPress={() => router.push('/(features)/clinic-search')}>
                <Text style={[Typography.nunitoBodyBold, { color: colors.tint }]}>
                  See All
                </Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={nearbyClinics}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.clinicCard, { backgroundColor: colors.cardBackground }]}
                  onPress={() => handleClinicPress(item._id, item.clinicName)}
                >
                  <Image source={require('../../assets/images/splash-icon.png')} style={styles.clinicImage} />
                  <View style={styles.clinicInfo}>
                    <Text style={[Typography.nunitoBodyBold, { color: colors.text }]}>{item.clinicName}</Text>
                    <Text style={[Typography.nunitoBody, { color: colors.icon, marginTop: 4 }]}>
                      {item.address}
                    </Text>
                    <View style={styles.ratingContainer}>
                      <IconSymbol name="star.fill" size={14} color="#FFD700" />
                      <Text style={[Typography.nunitoBodyBold, { color: colors.text, marginLeft: 4 }]}>
                        {/* Assuming a default rating */}
                        4.5
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.clinicList}
            />
          </View>
        )}
      </ScrollView>
      
      {isLoading && <LoadingDialog visible={true} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  topBarRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  iconImage: {
    width: 24,
    height: 24,
  },
  welcomeSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  bannerSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  bannerList: {
    paddingRight: 16,
  },
  bannerCard: {
    width: CARD_WIDTH,
    height: 160,
    borderRadius: 16,
    marginRight: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  categoriesSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryButton: {
    width: '48%',
    height: 100,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 32,
    height: 32,
    marginBottom: 8,
  },
  categoryLabel: {
    ...Typography.nunitoBodyBold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  nearbySection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clinicList: {
    paddingRight: 16,
  },
  clinicCard: {
    width: 220,
    borderRadius: 16,
    marginRight: 16,
    overflow: 'hidden',
  },
  clinicImage: {
    width: '100%',
    height: 120,
  },
  clinicInfo: {
    padding: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
});
