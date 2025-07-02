import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { useUserRole } from '../contexts/UserRoleContext';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../contexts/AuthContext';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout: authLogout, user, refreshProfile } = useAuth();
  
  // State variables
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  // Use the global user role context
  const { userRole } = useUserRole();
  
  // Toggle states for settings
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [promotionalAlerts, setPromotionalAlerts] = useState(false);
  const [locationAccess, setLocationAccess] = useState(true);
  const [autoApproveAppointments, setAutoApproveAppointments] = useState(false);
  
  const placeholderUserPic = require("../../assets/images/robert-pisot.jpg");
  const placeholderClinicPic = require("../../assets/images/peteat-logo.png");
  
  const userData = {
    name: user?.fullName || "Pet Owner",
    email: user?.email || "",
    profilePic: user?.profilePicture ? { uri: user.profilePicture } : placeholderUserPic,
    phone: user?.contactNumber || "",
    landline: user?.landline || "",
    username: user?.username || user?.email?.split('@')[0] || "",
    address: user?.address || "",
  };
  
  const clinicData = {
    name: user?.clinicName || user?.fullName || "Clinic",
    email: user?.email || "",
    profilePic: user?.profilePicture ? { uri: user.profilePicture } : placeholderClinicPic,
    phone: user?.contactNumber || "",
    landline: user?.landline || "",
    address: user?.address || "",
    operatingHours: user?.openingHour && user?.closingHour ? `${user.openingHour} - ${user.closingHour}` : "",
    numberOfStaff: user?.numberOfStaff || 0,
    role: user?.role || "",
  };
  
  // Functions
  const goToHome = () => {
    router.replace("/");
  };
  
  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };
  
  const toggleSettingsPanel = () => {
    setShowSettingsPanel(!showSettingsPanel);
  };
  
  const logout = async () => {
    try {
      // Show a confirmation dialog first
      Alert.alert(
        "Log Out",
        "Are you sure you want to log out?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Log Out",
            onPress: async () => {
              try {
                // Call the actual logout function from auth context
                await authLogout();
                
                // Navigate directly to the login screen
                // Using a direct path to avoid navigation errors
                setTimeout(() => {
                  router.navigate("/(auth)/login");
                }, 100);
              } catch (error) {
                console.error("Logout error:", error);
                Alert.alert("Logout Failed", "There was an error logging out. Please try again.");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Logout Failed", "There was an error logging out. Please try again.");
    }
  };
  
  // Function to handle menu item clicks
  const handleMenuItemClick = (item: string) => {
    setShowDropdown(false);
    
    // Navigate to the appropriate page based on the menu selection
    switch (item) {
      case 'My Profile':
        router.push('/(features)/my-profile');
        break;
      case 'Pet Profiles':
        router.push('/(features)/pet-profiles');
        break;
      case 'Manage Curing Pet':
        router.push('/(features)/manage-curing-pets');
        break;
      case 'Add Pets':
        router.push('/(features)/add-pet');
        break;
      case 'Notifications':
        router.push('/(features)/notifications');
        break;
      case 'Add Staff':
        router.push('/(features)/add-staff');
        break;
      default:
        // If we don't have a dedicated page yet, show the content in the same page
        setSelectedMenu(item);
    }
  };
  
  // Determine which profile data to show based on role
  const profileData = userRole === 'clinic' ? clinicData : userData;
  
  useEffect(() => {
    refreshProfile();
  }, []);
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top Section */}
        <View style={styles.topBar}>
          {/* Top Left Home Button */}
          <TouchableOpacity style={styles.iconButton} onPress={goToHome}>
            <Image 
              source={require("../../assets/images/peteat-logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <Text style={styles.screenTitle}>Account</Text>
          
          {/* Top Right Settings Button */}
          <TouchableOpacity style={styles.iconButton} onPress={toggleSettingsPanel}>
            <Image 
              source={require("../../assets/images/options.png")}
              style={styles.settingsIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        
        {/* Profile Header Section */}
        <TouchableOpacity style={styles.profileHeader} onPress={toggleDropdown}>
          <Image 
            source={profileData.profilePic}
            style={styles.profilePic}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileData.name}</Text>
            <Text style={styles.profileEmail}>{profileData.email}</Text>
          </View>
          <IconSymbol 
            name={showDropdown ? "chevron.up" : "chevron.down"} 
            size={20} 
            color={Colors.light.text} 
          />
        </TouchableOpacity>
        
        {/* Drop-down Menu - Role-specific items */}
        {showDropdown && (
          <View style={styles.dropdownMenu}>
            {/* My Profile - All Roles */}
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleMenuItemClick('My Profile')}
            >
              <IconSymbol name="person.fill" size={20} color={Colors.light.tint} />
              <Text style={styles.menuItemText}>My Profile</Text>
            </TouchableOpacity>
            
            {/* Pet Profiles - Users Only */}
            {userRole === 'user' && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuItemClick('Pet Profiles')}
              >
                <IconSymbol name="pawprint.fill" size={20} color={Colors.light.tint} />
                <Text style={styles.menuItemText}>Pet Profiles</Text>
              </TouchableOpacity>
            )}
            
            {/* Manage Curing Pets - Clinic Only */}
            {userRole === 'clinic' && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuItemClick('Manage Curing Pet')}
              >
                <IconSymbol name="cross.case.fill" size={20} color={Colors.light.tint} />
                <Text style={styles.menuItemText}>Manage Curing Pets</Text>
              </TouchableOpacity>
            )}
            
            {/* Add Staff - Clinic Only */}
            {userRole === 'clinic' && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuItemClick('Add Staff')}
              >
                <IconSymbol name="person.badge.plus" size={20} color={Colors.light.tint} />
                <Text style={styles.menuItemText}>Add Staff</Text>
              </TouchableOpacity>
            )}
            
            {/* Notifications - All Roles */}
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleMenuItemClick('Notifications')}
            >
              <IconSymbol name="bell.fill" size={20} color={Colors.light.tint} />
              <Text style={styles.menuItemText}>Notifications</Text>
            </TouchableOpacity>
            
            {/* Log Out - All Roles */}
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={logout}
            >
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="#E53935" />
              <Text style={[styles.menuItemText, { color: "#E53935" }]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Settings Panel */}
        {showSettingsPanel && (
          <Modal
            animationType="fade"
            transparent={true}
            visible={showSettingsPanel}
            onRequestClose={() => setShowSettingsPanel(false)}
          >
            <TouchableOpacity 
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowSettingsPanel(false)}
            >
              <View 
                style={styles.settingsPanel}
                onStartShouldSetResponder={() => true}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsPanelTitle}>Settings</Text>
                  <TouchableOpacity onPress={() => setShowSettingsPanel(false)}>
                    <IconSymbol name="xmark" size={24} color={Colors.light.text} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.settingsContent}>
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>Notifications</Text>
                    
                    <View style={styles.settingsItem}>
                      <View style={styles.settingsItemInfo}>
                        <Text style={styles.settingsItemTitle}>Appointment Reminders</Text>
                        <Text style={styles.settingsItemDescription}>
                          Receive reminders for upcoming appointments
                        </Text>
                      </View>
                      <Switch
                        value={appointmentReminders}
                        onValueChange={setAppointmentReminders}
                        trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                        thumbColor={appointmentReminders ? Colors.light.tint : '#f4f3f4'}
                      />
                    </View>
                    
                    <View style={styles.settingsItem}>
                      <View style={styles.settingsItemInfo}>
                        <Text style={styles.settingsItemTitle}>Promotional Alerts</Text>
                        <Text style={styles.settingsItemDescription}>
                          Receive special offers and promotions
                        </Text>
                      </View>
                      <Switch
                        value={promotionalAlerts}
                        onValueChange={setPromotionalAlerts}
                        trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                        thumbColor={promotionalAlerts ? Colors.light.tint : '#f4f3f4'}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>Privacy</Text>
                    
                    <View style={styles.settingsItem}>
                      <View style={styles.settingsItemInfo}>
                        <Text style={styles.settingsItemTitle}>Location Access</Text>
                        <Text style={styles.settingsItemDescription}>
                          Allow the app to access your location
                        </Text>
                      </View>
                      <Switch
                        value={locationAccess}
                        onValueChange={setLocationAccess}
                        trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                        thumbColor={locationAccess ? Colors.light.tint : '#f4f3f4'}
                      />
                    </View>
                  </View>
                  
                  {userRole === 'clinic' && (
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsSectionTitle}>Clinic Settings</Text>
                      
                      <View style={styles.settingsItem}>
                        <View style={styles.settingsItemInfo}>
                          <Text style={styles.settingsItemTitle}>Auto-Approve Appointments</Text>
                          <Text style={styles.settingsItemDescription}>
                            Automatically approve appointment requests
                          </Text>
                        </View>
                        <Switch
                          value={autoApproveAppointments}
                          onValueChange={setAutoApproveAppointments}
                          trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                          thumbColor={autoApproveAppointments ? Colors.light.tint : '#f4f3f4'}
                        />
                      </View>
                    </View>
                  )}
                  
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>About</Text>
                    
                    <TouchableOpacity style={styles.settingsButton}>
                      <Text style={styles.settingsButtonText}>Terms of Service</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.settingsButton}>
                      <Text style={styles.settingsButtonText}>Privacy Policy</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.settingsButton}>
                      <Text style={styles.settingsButtonText}>App Version: 1.0.0</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
        
        {/* Content Area */}
        <ScrollView style={styles.contentArea}>
          {/* If no menu is selected or the selected menu doesn't have a dedicated page,
              show a placeholder content */}
          {!selectedMenu ? (
            <View style={styles.placeholderContent}>
              <IconSymbol name="person.crop.circle" size={48} color={Colors.light.icon} />
              <Text style={styles.placeholderTitle}>Account Management</Text>
              <Text style={styles.placeholderText}>
                Tap on your profile or use the dropdown menu to access account features
              </Text>
            </View>
          ) : (
            <View style={styles.menuContent}>
              <Text style={styles.menuContentTitle}>{selectedMenu}</Text>
              <Text style={styles.menuContentText}>
                This is a placeholder for the {selectedMenu} feature, which will be implemented in the future.
              </Text>
            </View>
          )}
        </ScrollView>
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
  logoImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  settingsIcon: {
    width: 24,
    height: 24,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.light.icon,
  },
  dropdownMenu: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: Colors.light.text,
  },
  contentArea: {
    flex: 1,
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.light.icon,
    textAlign: 'center',
  },
  menuContent: {
    padding: 16,
  },
  menuContentTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  menuContentText: {
    fontSize: 16,
    color: Colors.light.icon,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsPanel: {
    width: '80%',
    maxHeight: '80%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsPanelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  settingsContent: {
    padding: 16,
  },
  settingsSection: {
    marginBottom: 20,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.tint,
    marginBottom: 12,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingsItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingsItemTitle: {
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 2,
  },
  settingsItemDescription: {
    fontSize: 14,
    color: Colors.light.icon,
  },
  settingsButton: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsButtonText: {
    fontSize: 16,
    color: Colors.light.text,
  },
});
