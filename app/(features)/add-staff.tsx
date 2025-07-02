import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import * as ImagePicker from 'expo-image-picker';

export default function AddStaffScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  // State for staff member details
  const [staffData, setStaffData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'Veterinarian', // Default role
    profilePic: null as any,
    specialization: '',
    availability: 'Full-time',
    skills: [''],
  });
  
  // State for permissions
  const [permissions, setPermissions] = useState({
    canViewAllPatients: true,
    canEditPatientRecords: false,
    canPrescribeMedication: false,
    canManageAppointments: true,
    canManageInventory: false,
    canManageStaff: false,
    canAccessBilling: false,
  });
  
  // Available roles for dropdown
  const roles = [
    'Veterinarian',
    'Veterinary Technician',
    'Clinic Manager',
    'Receptionist',
    'Groomer',
    'Assistant',
    'Intern'
  ];
  
  // Available availability options
  const availabilityOptions = [
    'Full-time',
    'Part-time',
    'Weekends only',
    'Evenings only',
    'On-call',
    'Consulting'
  ];
  
  const goBack = () => {
    router.back();
  };
  
  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setStaffData({...staffData, profilePic: {uri: result.assets[0].uri}});
    }
  };
  
  const handleAddSkill = () => {
    setStaffData({
      ...staffData,
      skills: [...staffData.skills, '']
    });
  };
  
  const handleUpdateSkill = (index: number, value: string) => {
    const updatedSkills = [...staffData.skills];
    updatedSkills[index] = value;
    setStaffData({...staffData, skills: updatedSkills});
  };
  
  const handleRemoveSkill = (index: number) => {
    if (staffData.skills.length > 1) {
      const updatedSkills = staffData.skills.filter((_, i) => i !== index);
      setStaffData({...staffData, skills: updatedSkills});
    }
  };
  
  const handleSubmit = () => {
    // Validation
    if (!staffData.firstName || !staffData.lastName || !staffData.email) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    // In a real app, we would send the staff data to an API
    Alert.alert(
      'Success',
      `Staff member ${staffData.firstName} ${staffData.lastName} has been added successfully!`,
      [{ text: 'OK', onPress: goBack }]
    );
  };
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top Section */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={goBack}>
            <Image 
              source={require('../../assets/images/left-arrow.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <Text style={styles.screenTitle}>Add Staff Member</Text>
          
          <View style={styles.iconButton} />
        </View>
        
        <ScrollView 
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.contentContainer}
        >
          {/* Profile Picture Section */}
          <View style={styles.profilePicSection}>
            <TouchableOpacity style={styles.profilePicButton} onPress={handleImagePick}>
              {staffData.profilePic ? (
                <Image 
                  source={staffData.profilePic} 
                  style={styles.profilePic}
                />
              ) : (
                <View style={styles.profilePicPlaceholder}>
                  <Image
                    source={require('../../assets/images/add.png')}
                    style={styles.addIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Basic Information Section */}
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.formGrid}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>First Name <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Enter first name"
                value={staffData.firstName}
                onChangeText={(text) => setStaffData({...staffData, firstName: text})}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Last Name <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Enter last name"
                value={staffData.lastName}
                onChangeText={(text) => setStaffData({...staffData, lastName: text})}
              />
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address <Text style={styles.requiredStar}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              value={staffData.email}
              onChangeText={(text) => setStaffData({...staffData, email: text})}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              value={staffData.phone}
              onChangeText={(text) => setStaffData({...staffData, phone: text})}
              keyboardType="phone-pad"
            />
          </View>
          
          {/* Professional Information */}
          <Text style={styles.sectionTitle}>Professional Information</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Role</Text>
            <View style={styles.pickerContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roleButtonsContainer}
              >
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      staffData.role === role ? styles.activeRoleButton : {}
                    ]}
                    onPress={() => setStaffData({...staffData, role})}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        staffData.role === role ? styles.activeRoleButtonText : {}
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Specialization</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter specialization (if applicable)"
              value={staffData.specialization}
              onChangeText={(text) => setStaffData({...staffData, specialization: text})}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Availability</Text>
            <View style={styles.pickerContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roleButtonsContainer}
              >
                {availabilityOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.roleButton,
                      staffData.availability === option ? styles.activeRoleButton : {}
                    ]}
                    onPress={() => setStaffData({...staffData, availability: option})}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        staffData.availability === option ? styles.activeRoleButtonText : {}
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Skills & Certifications</Text>
            
            {staffData.skills.map((skill, index) => (
              <View key={index} style={styles.skillInputContainer}>
                <TextInput
                  style={styles.skillInput}
                  placeholder={`Enter skill or certification ${index + 1}`}
                  value={skill}
                  onChangeText={(text) => handleUpdateSkill(index, text)}
                />
                
                <TouchableOpacity 
                  style={styles.removeSkillButton}
                  onPress={() => handleRemoveSkill(index)}
                  disabled={staffData.skills.length === 1}
                >
                  <IconSymbol 
                    name="minus.circle.fill" 
                    size={24} 
                    color={staffData.skills.length === 1 ? Colors.light.icon + '50' : Colors.light.error}
                  />
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity 
              style={styles.addSkillButton}
              onPress={handleAddSkill}
            >
              <IconSymbol name="plus.circle.fill" size={20} color={Colors.light.tint} />
              <Text style={styles.addSkillText}>Add Another Skill</Text>
            </TouchableOpacity>
          </View>
          
          {/* Permissions Section */}
          <Text style={styles.sectionTitle}>System Permissions</Text>
          
          <View style={styles.permissionsContainer}>
            <View style={styles.permissionItem}>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionLabel}>View All Patient Records</Text>
                <Text style={styles.permissionDescription}>Can view all patient records in the system</Text>
              </View>
              <Switch
                value={permissions.canViewAllPatients}
                onValueChange={(value) => setPermissions({...permissions, canViewAllPatients: value})}
                trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                thumbColor={permissions.canViewAllPatients ? Colors.light.tint : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.permissionItem}>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionLabel}>Edit Patient Records</Text>
                <Text style={styles.permissionDescription}>Can modify patient medical records</Text>
              </View>
              <Switch
                value={permissions.canEditPatientRecords}
                onValueChange={(value) => setPermissions({...permissions, canEditPatientRecords: value})}
                trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                thumbColor={permissions.canEditPatientRecords ? Colors.light.tint : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.permissionItem}>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionLabel}>Prescribe Medication</Text>
                <Text style={styles.permissionDescription}>Can prescribe medication to patients</Text>
              </View>
              <Switch
                value={permissions.canPrescribeMedication}
                onValueChange={(value) => setPermissions({...permissions, canPrescribeMedication: value})}
                trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                thumbColor={permissions.canPrescribeMedication ? Colors.light.tint : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.permissionItem}>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionLabel}>Manage Appointments</Text>
                <Text style={styles.permissionDescription}>Can schedule, modify or cancel appointments</Text>
              </View>
              <Switch
                value={permissions.canManageAppointments}
                onValueChange={(value) => setPermissions({...permissions, canManageAppointments: value})}
                trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                thumbColor={permissions.canManageAppointments ? Colors.light.tint : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.permissionItem}>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionLabel}>Manage Inventory</Text>
                <Text style={styles.permissionDescription}>Can add, modify or remove inventory items</Text>
              </View>
              <Switch
                value={permissions.canManageInventory}
                onValueChange={(value) => setPermissions({...permissions, canManageInventory: value})}
                trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                thumbColor={permissions.canManageInventory ? Colors.light.tint : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.permissionItem}>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionLabel}>Manage Staff</Text>
                <Text style={styles.permissionDescription}>Can add, modify or remove staff members</Text>
              </View>
              <Switch
                value={permissions.canManageStaff}
                onValueChange={(value) => setPermissions({...permissions, canManageStaff: value})}
                trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                thumbColor={permissions.canManageStaff ? Colors.light.tint : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.permissionItem}>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionLabel}>Access Billing</Text>
                <Text style={styles.permissionDescription}>Can view and process billing information</Text>
              </View>
              <Switch
                value={permissions.canAccessBilling}
                onValueChange={(value) => setPermissions({...permissions, canAccessBilling: value})}
                trackColor={{ false: '#d0d0d0', true: Colors.light.tint + '80' }}
                thumbColor={permissions.canAccessBilling ? Colors.light.tint : '#f4f3f4'}
              />
            </View>
          </View>
          
          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Add Staff Member</Text>
          </TouchableOpacity>
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
  backIcon: {
    width: 24,
    height: 24,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  profilePicSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  profilePicButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },
  profilePicPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
  addIcon: {
    width: 40,
    height: 40,
    tintColor: Colors.light.tint,
    marginBottom: 8,
  },
  addPhotoText: {
    color: Colors.light.tint,
    fontWeight: '500',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 16,
    color: Colors.light.tint,
  },
  formGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formGroup: {
    flex: 1,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 14,
    color: Colors.light.icon,
    marginBottom: 6,
  },
  requiredStar: {
    color: Colors.light.error,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  roleButtonsContainer: {
    padding: 8,
  },
  roleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  activeRoleButton: {
    backgroundColor: Colors.light.tint,
  },
  roleButtonText: {
    fontSize: 14,
    color: Colors.light.icon,
  },
  activeRoleButtonText: {
    color: '#FFF',
  },
  skillInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  skillInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  removeSkillButton: {
    marginLeft: 8,
    padding: 4,
  },
  addSkillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addSkillText: {
    fontSize: 14,
    color: Colors.light.tint,
    marginLeft: 8,
  },
  permissionsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  permissionTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  permissionDescription: {
    fontSize: 12,
    color: Colors.light.icon,
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: Colors.light.tint,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 