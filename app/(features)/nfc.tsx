import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  FlatList,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/constants/Typography';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingDialog } from '@/components/ui/LoadingDialog';
import { useLocalSearchParams } from 'expo-router';
import { nfcTagAPI, petAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { InputDialog } from '../../components/ui/InputDialog';

// Define TypeScript interfaces
interface Coordinates {
  latitude: number;
  longitude: number;
}

export default function NFCScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [userPets, setUserPets] = useState<any[]>([]);
  const [userTags, setUserTags] = useState<any[]>([]);
  const [selectedPetIndex, setSelectedPetIndex] = useState(0);
  const [showScannedPet, setShowScannedPet] = useState(false);
  const [scannedPetData, setScannedPetData] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [tagPromptVisible, setTagPromptVisible] = useState(false);
  const [tagIdInput, setTagIdInput] = useState('');
  
  const params = useLocalSearchParams();
  const currentPet = showScannedPet ? scannedPetData : userPets[selectedPetIndex];

  // Fetch user's pets on component mount
  useEffect(() => {
    if (user?.id) {
      fetchUserPets();
      fetchUserTags();
    }
  }, [user]);

  // Handle NFC scan from deeplink
  useEffect(() => {
    if (params?.tagId) {
      handleNFCScan(params.tagId as string);
    }
  }, [params?.tagId]);

  const fetchUserPets = async () => {
    try {
      setIsLoading(true);
      const pets = await petAPI.getPetsByOwner(user?.id);
      if (pets && pets.length > 0) {
        setUserPets(pets);
      }
    } catch (error) {
      console.error('Error fetching pets:', error);
      Alert.alert('Error', 'Failed to load your pets. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserTags = async () => {
    if (!user?.id) return;
    
    try {
      const tags = await nfcTagAPI.getOwnerTags(user.id);
      setUserTags(tags || []);
    } catch (error) {
      console.error('Error fetching user tags:', error);
    }
  };

  const handleLocationPermission = async (): Promise<Coordinates | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location permission is required to record where the tag was scanned. You can enable it in Settings.',
          [
            { text: 'OK' }
          ]
        );
        return null;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.log('Failed to get location:', error);
      return null;
    }
  };

  const handleNFCScan = async (tagId: string) => {
    setIsLoading(true);
    setScanError(null);
    
    try {
      // Get current location if available
      const coordinates: Coordinates | null = await handleLocationPermission();
      
      // Scan the tag with the API
      const tagData = await (nfcTagAPI as any).scanTag(tagId, coordinates ?? null);
      
      if (tagData && tagData.pet) {
        // Transform data for display
        const petData = {
          id: tagData.pet._id || tagData.pet.id,
          name: tagData.pet.name,
          type: tagData.pet.species,
          age: tagData.pet.age,
          birthdate: tagData.pet.birthdate || 'Unknown',
          breed: tagData.pet.breed,
          sex: tagData.pet.gender,
          imageUri: tagData.pet.profileImage 
            ? { uri: tagData.pet.profileImage } 
            : require('../../assets/images/peteat-logo.png'),
          medicalInfo: tagData.pet.medicalHistory?.length > 0 
            ? tagData.pet.medicalHistory[0].description 
            : 'No medical history available',
          clinic: tagData.isLostPet ? 'LOST PET - Contact Owner' : '',
          ownerContact: tagData.isLostPet && tagData.pet.owner ? tagData.pet.owner.contactNumber : null,
          ownerEmail: tagData.isLostPet && tagData.pet.owner ? tagData.pet.owner.email : null,
          isLost: tagData.isLostPet
        };
        
        setScannedPetData(petData);
        setShowScannedPet(true);
      } else {
        setScanError('Pet information not found for this tag.');
        setShowScannedPet(false);
      }
    } catch (error) {
      console.error('Error scanning tag:', error);
      setScanError('Could not read pet data from tag. Please try again.');
      setShowScannedPet(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const goBack = () => {
    router.back();
  };
  
  const registerNewTag = () => {
    if (userPets.length === 0) {
      Alert.alert('No Pets', 'Please add a pet first before registering an NFC tag.');
      return;
    }
    
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Register NFC Tag',
        'Enter the NFC tag ID:',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Register',
            onPress: (input) => handleRegisterTag(input ?? ''),
          },
        ],
        'plain-text'
      );
    } else {
      setTagPromptVisible(true);
    }
  };
  
  const handleRegisterTag = async (tagId: string) => {
    if (!tagId || tagId.trim() === '') {
      Alert.alert('Error', 'Please enter a valid tag ID');
      return;
    }
    try {
      setIsLoading(true);
      const petId = userPets[selectedPetIndex]?._id;
      if (!petId) {
        Alert.alert('Error', 'Selected pet does not have a valid ID');
        return;
      }
      await nfcTagAPI.registerTag({
        tagId: tagId.trim(),
        pet: petId as string,
        isActive: true,
      });
      Alert.alert('Success', `NFC tag successfully registered for ${userPets[selectedPetIndex].name}`);
      fetchUserTags();
    } catch (error) {
      console.error('Error registering tag:', error);
      Alert.alert('Error', 'Failed to register NFC tag. It may already be registered.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const reportLostPet = async () => {
    if (!userTags.length || selectedPetIndex >= userPets.length) {
      Alert.alert('Error', 'No NFC tags registered for this pet.');
      return;
    }
    
    // Find tag for the selected pet
    const petId = userPets[selectedPetIndex]._id;
    const tag = userTags.find(t => t.pet._id === petId);
    
    if (!tag) {
      Alert.alert('No Tag', 'No NFC tag found for this pet. Please register a tag first.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      await nfcTagAPI.reportLostPet(tag._id, {
        lastSeenLocation: 'Last known location',
        contactDetails: user?.contactNumber || user?.phone || user?.email,
        additionalInfo: 'Please contact the owner if found.'
      });
      
      Alert.alert(
        'Pet Reported Lost',
        `${userPets[selectedPetIndex].name} has been reported as lost. Anyone who scans the NFC tag will see your contact details.`
      );
      
      // Refresh tags to update status
      fetchUserTags();
    } catch (error) {
      console.error('Error reporting lost pet:', error);
      Alert.alert('Error', 'Failed to report pet as lost. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const markPetFound = async () => {
    if (!userTags.length || selectedPetIndex >= userPets.length) {
      return;
    }
    
    // Find tag for the selected pet
    const petId = userPets[selectedPetIndex]._id;
    const tag = userTags.find(t => t.pet._id === petId && t.isLostPet);
    
    if (!tag) {
      Alert.alert('Not Lost', 'This pet is not currently marked as lost.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      await nfcTagAPI.markPetFound(tag._id);
      
      Alert.alert(
        'Pet Marked as Found',
        `${userPets[selectedPetIndex].name} has been marked as found. Thank you!`
      );
      
      // Refresh tags to update status
      fetchUserTags();
    } catch (error) {
      console.error('Error marking pet as found:', error);
      Alert.alert('Error', 'Failed to update pet status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const contactOwner = (contact: string, isPhone = true) => {
    if (isPhone) {
      Linking.openURL(`tel:${contact}`);
    } else {
      Linking.openURL(`mailto:${contact}`);
    }
  };
  
  // Display instructions for writing the NFC tag
  const showSetupInstructions = () => {
    Alert.alert(
      'How to set up your NFC Tag',
      `You need to install an NFC tool from the Play Store.\n\n` +
      `1. Open the app and SCAN/READ the blank NFC tag.\n` +
      `2. Go to the WRITE section, tap "Add a record" ➜ choose "Custom URL".\n` +
      `3. Paste the following URL (replace pet_tag_id with the real tag id):\n\n` +
      `    peteat://pet?tagId=pet_tag_id\n\n` +
      `4. Tap WRITE and hold the phone near the tag until it completes.\n\n` +
      `Reminder: Only available for Android devices for now.`,
      [{ text: 'OK' }]
    );
  };
  
  const isPetLost = (petId: string) => {
    if (!userTags.length) return false;
    const tag = userTags.find(t => t.pet._id === petId && t.isLostPet);
    return !!tag;
  };

  // Color constants to handle the TypeScript errors
  const highlightColor = colors.tint;
  const errorColor = colors.error;
  const successColor = colors.success;
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Image 
            source={require('../../assets/images/left-arrow.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <Text style={[Typography.nunitoSubheading, { color: colors.text }]}>Pet NFC</Text>
      </View>
      
      {/* Main Content */}
      <ScrollView style={styles.content}>
        <Card style={styles.nfcCard}>
          <View style={styles.nfcContainer}>
            {/* Loading and error states */}
            {isLoading && <LoadingDialog visible={isLoading} message="Processing..." />}
            {scanError && (
              <View style={{ marginBottom: 16, backgroundColor: errorColor + '30', padding: 12, borderRadius: 8 }}>
                <Text style={[Typography.nunitoBody, { color: colors.text }]}>❌ {scanError}</Text>
              </View>
            )}
            
            {/* Scanned Pet View */}
            {showScannedPet && scannedPetData && (
              <>
                <Text style={[Typography.nunitoHeading2, { color: colors.text, marginBottom: 16 }]}>Scanned Pet Profile</Text>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <Image 
                    source={scannedPetData.imageUri} 
                    style={{ width: 120, height: 120, borderRadius: 60, marginBottom: 8, borderWidth: 3, borderColor: highlightColor }} 
                  />
                  
                  <Text style={[Typography.nunitoHeading3, { color: colors.text, marginBottom: 4 }]}>
                    {scannedPetData.name}
                  </Text>
                  
                  <Text style={[Typography.nunitoBody, { color: colors.text, marginBottom: 2 }]}>
                    {scannedPetData.type} • {scannedPetData.breed}
                  </Text>
                  
                  <Text style={[Typography.nunitoBody, { color: colors.text, marginBottom: 2 }]}>
                    {scannedPetData.sex} • Age: {scannedPetData.age} years
                  </Text>
                  
                  {scannedPetData.medicalInfo && (
                    <Text style={[Typography.nunitoBody, { color: colors.text, marginBottom: 2 }]}>
                      🧾 {scannedPetData.medicalInfo}
                    </Text>
                  )}
                  
                  {scannedPetData.isLost && (
                    <View style={styles.lostPetAlert}>
                      <Text style={[Typography.nunitoBodyBold, { color: '#fff' }]}>⚠️ LOST PET</Text>
                      {scannedPetData.ownerContact && (
                        <Button 
                          title={`Call owner: ${scannedPetData.ownerContact}`} 
                          onPress={() => contactOwner(scannedPetData.ownerContact)}
                          variant="primary"
                          size="medium"
                          fullWidth
                          style={{ marginTop: 8 }}
                        />
                      )}
                      {scannedPetData.ownerEmail && (
                        <Button 
                          title={`Email owner: ${scannedPetData.ownerEmail}`}
                          onPress={() => contactOwner(scannedPetData.ownerEmail, false)}
                          variant="secondary"
                          size="medium"
                          fullWidth
                          style={{ marginTop: 8 }}
                        />
                      )}
                    </View>
                  )}
                </View>
                
                <Button 
                  title="Close"
                  onPress={() => setShowScannedPet(false)}
                  variant="secondary"
                  size="medium"
                  fullWidth
                  style={{ marginTop: 8 }}
                />
              </>
            )}
            
            {/* My Pets View (when not viewing scanned pet) */}
            {!showScannedPet && (
              <>
                <Text style={[Typography.nunitoHeading2, { color: colors.text, marginBottom: 16 }]}>My Pets NFC Tags</Text>
                
                {userPets.length === 0 ? (
                  <View style={{ marginBottom: 16, alignItems: 'center' }}>
                    <Text style={[Typography.nunitoBody, { color: colors.text, textAlign: 'center', marginBottom: 16 }]}>
                      You don't have any pets registered yet.
                    </Text>
                    <Button 
                      title="Add Your First Pet"
                      onPress={() => router.push('/(features)/add-pet')}
                      variant="primary"
                      size="medium"
                    />
                  </View>
                ) : (
                  <>
                    {userPets.length > 1 && (
                      <FlatList
                        data={userPets}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={item => item._id}
                        renderItem={({ item, index }) => (
                          <TouchableOpacity onPress={() => setSelectedPetIndex(index)}>
                            <View style={{ 
                              marginHorizontal: 8, 
                              borderWidth: selectedPetIndex === index ? 2 : 0, 
                              borderColor: highlightColor, 
                              borderRadius: 16, 
                              backgroundColor: selectedPetIndex === index ? highlightColor + '20' : 'transparent', 
                              padding: 4 
                            }}>
                              <Image 
                                source={item.profileImage ? { uri: item.profileImage } : require('../../assets/images/peteat-logo.png')} 
                                style={{ width: 80, height: 80, borderRadius: 40 }} 
                              />
                              <Text style={{ 
                                textAlign: 'center', 
                                color: colors.text, 
                                fontWeight: selectedPetIndex === index ? 'bold' : 'normal' 
                              }}>
                                {item.name}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        style={{ marginBottom: 16 }}
                      />
                    )}
                    
                    {currentPet && (
                      <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <Image 
                          source={currentPet.profileImage ? { uri: currentPet.profileImage } : require('../../assets/images/peteat-logo.png')}
                          style={{ width: 120, height: 120, borderRadius: 60, marginBottom: 8, borderWidth: 3, borderColor: highlightColor }} 
                        />
                        
                        <Text style={[Typography.nunitoHeading3, { color: colors.text, marginBottom: 4 }]}>
                          {currentPet.name}
                        </Text>
                        
                        <Text style={[Typography.nunitoBody, { color: colors.text, marginBottom: 2 }]}>
                          {currentPet.species} • {currentPet.breed}
                        </Text>
                        
                        <Text style={[Typography.nunitoBody, { color: colors.text, marginBottom: 2 }]}>
                          {currentPet.gender} • Age: {currentPet.age} years
                        </Text>
                      </View>
                    )}
                    
                    {/* NFC Tag Actions */}
                    <View style={styles.buttonGroup}>
                      <Button 
                        title="Register NFC Tag"
                        onPress={registerNewTag}
                        variant="primary"
                        size="medium"
                        fullWidth
                        style={{ marginBottom: 12 }}
                      />
                      
                      <Button 
                        title="How to set up your NFC Tag"
                        onPress={showSetupInstructions}
                        variant="secondary"
                        size="medium"
                        fullWidth
                        style={{ marginBottom: 12 }}
                      />
                      
                      {isPetLost(currentPet?._id) ? (
                        <Button 
                          title="Mark Pet as Found"
                          onPress={markPetFound}
                          variant="primary"
                          size="medium"
                          fullWidth
                        />
                      ) : (
                        <Button 
                          title="Report Lost Pet"
                          onPress={reportLostPet}
                          variant="secondary"
                          size="medium"
                          fullWidth
                        />
                      )}
                    </View>
                    
                    <View style={{ marginTop: 16, backgroundColor: highlightColor + '20', padding: 12, borderRadius: 12 }}>
                      <Text style={[Typography.nunitoBody, { color: colors.text }]}>
                        PetEat NFC tags help identify your pet if they get lost. 
                        Anyone who scans your pet's tag will see their basic information 
                        and your contact details if you've reported them as lost.
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </Card>
      </ScrollView>

      {/* Tag Input Dialog for Android / fallback */}
      <InputDialog
        visible={tagPromptVisible}
        title="Register NFC Tag"
        placeholder="Enter tag ID"
        onCancel={() => setTagPromptVisible(false)}
        onSubmit={(input) => {
          setTagPromptVisible(false);
          handleRegisterTag(input ?? '');
        }}
      />
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
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  nfcCard: {
    padding: 16,
  },
  nfcContainer: {
    width: '100%',
  },
  buttonGroup: {
    marginTop: 8,
  },
  lostPetAlert: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
});