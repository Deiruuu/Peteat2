import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { Colors } from '../../constants/Colors';
import { Button } from '@/components/ui/Button';

import { useAuth } from '../contexts/AuthContext';
import { petAPI, bookingAPI, API_BASE_URL } from '../api/api';

// Small helper components ----------------------------------------------------
const StepProgress: React.FC<{ currentIndex: number; total: number }> = ({ currentIndex, total }) => {
  const progressPercent = (currentIndex) / (total - 1);
  const circles = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <View style={styles.progressWrapper}>
      {/* Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPercent * 100}%` }]} />
      </View>
      {/* Circles */}
      <View style={styles.progressCircles}>
        {circles.map((num, idx) => {
          const reached = idx <= currentIndex;
          return (
            <View
              key={num}
              style={[styles.progressCircle, reached && styles.progressCircleActive]}
            >
              <Text style={[styles.progressCircleText, reached && styles.progressCircleTextActive]}>
                {num}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const StepHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.stepTitle}>{title}</Text>
);

const ListItem: React.FC<{
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}> = ({ label, subtitle, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.listItem, selected && styles.listItemSelected]}
    onPress={onPress}
  >
    <Text style={[styles.listItemText, selected && styles.listItemTextSelected]}>
      {label}
    </Text>
    {subtitle ? (
      <Text style={[styles.listItemSubtitle, selected && styles.listItemSubtitleSelected]}>
        {subtitle}
      </Text>
    ) : null}
  </TouchableOpacity>
);

// Reusable bottom navigation with safe-area padding
const BottomNav: React.FC<{ disabled?: boolean; label?: string; onPress: () => void }> = ({ disabled, label = 'Next', onPress }) => {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['bottom']} style={[styles.bottomNav, { paddingBottom: insets.bottom || 16 }]}> 
      <TouchableOpacity
        style={[styles.navButton, disabled && { opacity: 0.4 }]}
        disabled={disabled}
        onPress={onPress}
      >
        <Text style={styles.navButtonText}>{label}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
export default function BookingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, authAPI } = useAuth();

  // Steps management --------------------------------------------------------
  type Step = 'type' | 'pet' | 'clinic' | 'datetime' | 'notes' | 'review';
  const order: Step[] = ['type', 'pet', 'clinic', 'datetime', 'notes', 'review'];
  const [step, setStep] = useState<Step>('type');

  const next = () => {
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };
  const back = () => {
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
    else router.back();
  };

  // Data states -------------------------------------------------------------
  const [appointmentType, setAppointmentType] = useState<'video' | 'in_person' | null>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);

  const [selectedClinic, setSelectedClinic] = useState<any | null>(null);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [dateTime, setDateTime] = useState<Date | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [reason, setReason] = useState<string>('');

  // Fetch clinics & pets -----------------------------------------------------
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [loadingPets, setLoadingPets] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (step === 'pet' && pets.length === 0 && user?.id) {
      fetchPets();
    }
    if (step === 'clinic' && selectedPet) {
      // Reset selected clinic when changing pet
      setSelectedClinic(null);
      fetchClinicsByPetType();
    }
  }, [step, selectedPet]);

  const fetchClinicsByPetType = async () => {
    try {
      setLoadingClinics(true);
      
      // Get the pet species/type
      const petType = selectedPet?.species || selectedPet?.type;
      
      if (!petType) {
        console.error('No pet type available');
        // Fallback to all clinics if pet type is not available
        const response = await fetch(`${API_BASE_URL}/users/clinics/approved`);
        const data = await response.json();
        setClinics(data || []);
        return;
      }
      
      // Fetch clinics that manage this pet type
      let data;
      if (authAPI && authAPI.getClinicsByPetType) {
        data = await authAPI.getClinicsByPetType(petType);
      } else {
        // Fallback to direct API call if authAPI is not available
        const response = await fetch(`${API_BASE_URL}/users/clinics/by-pet/${petType}`);
        data = await response.json();
      }
      
      setClinics(data || []);
      
      // If no clinics found for this pet type, show a message
      if (!data || data.length === 0) {
        Alert.alert(
          'No Clinics Available', 
          `No clinics currently manage ${petType}s. Showing all available clinics instead.`,
          [{ text: 'OK' }]
        );
        // Fallback to all clinics
        const response = await fetch(`${API_BASE_URL}/users/clinics/approved`);
        const allClinics = await response.json();
        setClinics(allClinics || []);
      }
    } catch (err) {
      console.error('Error fetching clinics by pet type', err);
      Alert.alert('Error', 'Failed to load clinics');
      
      // Fallback to all clinics
      try {
        const response = await fetch(`${API_BASE_URL}/users/clinics/approved`);
        const data = await response.json();
        setClinics(data || []);
      } catch (fallbackErr) {
        console.error('Error in fallback clinic fetch', fallbackErr);
      }
    } finally {
      setLoadingClinics(false);
    }
  };

  const fetchPets = async () => {
    try {
      setLoadingPets(true);
      const data = await petAPI.getPetsByOwner(user?.id);
      setPets(data || []);
    } catch (err) {
      console.error('Error fetching pets', err);
      Alert.alert('Error', 'Failed to load your pets');
    } finally {
      setLoadingPets(false);
    }
  };

  // Date picker -------------------------------------------------------------
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDateTime(selectedDate);
  };

  // Submit ------------------------------------------------------------------
  const submit = async () => {
    if (!appointmentType || !selectedClinic || !selectedPet || !dateTime) {
      Alert.alert('Incomplete', 'Please fill out all required fields');
      return;
    }

    try {
      const bookingData = {
        appointmentType,
        clinic: selectedClinic._id || selectedClinic.id,
        pet: selectedPet._id || selectedPet.id,
        bookingDate: dateTime,
        appointmentTime: dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reason,
      };
      await bookingAPI.createBooking(bookingData);
      Alert.alert('Booked', 'Appointment created successfully', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (error: any) {
      console.error('Booking error', error);
      Alert.alert('Error', error?.message || 'Failed to create booking');
    }
  };

  // Render helpers ----------------------------------------------------------

  const renderTypeStep = () => (
    <>
      <StepHeader title="Select Appointment Type" />
      <View style={styles.choiceContainer}>
        <ListItem
          label="Video Consultation"
          selected={appointmentType === 'video'}
          onPress={() => setAppointmentType('video')}
        />
        <ListItem
          label="In-person Visit"
          selected={appointmentType === 'in_person'}
          onPress={() => setAppointmentType('in_person')}
        />
      </View>
      <BottomNav disabled={!appointmentType} onPress={next} />
    </>
  );

  const renderPetStep = () => (
    <View style={{ flex: 1 }}>
      <StepHeader title="Select a Pet" />
      {loadingPets ? (
        <ActivityIndicator size="large" color={Colors.light.tint} />
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ListItem
              label={item.name}
              subtitle={`${item.species || ''}${item.breed ? ' - ' + item.breed : ''}`}
              selected={selectedPet?._id === item._id}
              onPress={() => setSelectedPet(item)}
            />
          )}
          ListEmptyComponent={<Text>No pets found</Text>}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
      <BottomNav disabled={!selectedPet} onPress={next} />
    </View>
  );

  const renderClinicStep = () => (
    <View style={{ flex: 1 }}>
      <StepHeader title="Select a Clinic" />
      {loadingClinics ? (
        <ActivityIndicator size="large" color={Colors.light.tint} />
      ) : (
        <FlatList
          data={clinics}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ListItem
              label={item.fullName || item.name || item.clinicName}
              subtitle={item.address || item.description || ''}
              selected={selectedClinic?._id === item._id}
              onPress={() => setSelectedClinic(item)}
            />
          )}
          ListEmptyComponent={<Text>No clinics available for this pet type</Text>}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
      <BottomNav disabled={!selectedClinic} onPress={next} />
    </View>
  );

  const renderDateTimeStep = () => (
    <>
      <StepHeader title="Select Date & Time" />
      {/* Date field */}
      <Text style={styles.fieldLabel}>Date</Text>
      <TouchableOpacity style={styles.fieldInput} onPress={() => setShowDatePicker(true)}>
        <Text>{dateTime ? dateTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Select date'}</Text>
      </TouchableOpacity>
      {/* Time field */}
      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Time</Text>
      <TouchableOpacity style={styles.fieldInput} onPress={() => setShowTimePicker(true)}>
        <Text>{dateTime ? dateTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Select time'}</Text>
      </TouchableOpacity>

      {(showDatePicker || showTimePicker) && (
        <DateTimePicker
          value={dateTime || new Date()}
          mode={showDatePicker ? 'date' : 'time'}
          display="default"
          onChange={(e, sel) => {
            if (sel) {
              const d = dateTime || new Date();
              const newDate = new Date(d);
              if (showDatePicker) {
                newDate.setFullYear(sel.getFullYear(), sel.getMonth(), sel.getDate());
              } else {
                newDate.setHours(sel.getHours(), sel.getMinutes());
              }
              // Ensure seconds and milliseconds are zeroed
              newDate.setSeconds(0, 0);
              setDateTime(newDate);
            }
            setShowDatePicker(false);
            setShowTimePicker(false);
          }}
        />
      )}
      <BottomNav onPress={next} />
    </>
  );

  const renderNotesStep = () => (
    <>
      <StepHeader title="Consultation Reason" />
      <TextInput
        style={styles.input}
        placeholder="Reason for visit"
        value={reason}
        onChangeText={setReason}
        multiline
      />
      <BottomNav onPress={next} />
    </>
  );

  const renderReviewStep = () => (
    <>
      <StepHeader title="Review & Submit" />
      <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Type</Text><View style={styles.reviewValueContainer}><Text style={styles.reviewValue}>{appointmentType === 'video' ? 'Video Consultation' : 'In-person Visit'}</Text></View></View>
      <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Pet</Text><View style={styles.reviewValueContainer}><Text style={styles.reviewValue}>{selectedPet?.name}</Text></View></View>
      <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Clinic</Text><View style={styles.reviewValueContainer}><Text style={styles.reviewValue}>{selectedClinic?.fullName || selectedClinic?.name || selectedClinic?.clinicName}</Text></View></View>
      <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Date</Text><View style={styles.reviewValueContainer}><Text style={styles.reviewValue}>{dateTime?.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</Text></View></View>
      <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Time</Text><View style={styles.reviewValueContainer}><Text style={styles.reviewValue}>{dateTime?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text></View></View>
      {reason ? (<View style={styles.reviewRow}><Text style={styles.reviewLabel}>Reason</Text><View style={styles.reviewValueContainer}><Text style={styles.reviewValue}>{reason}</Text></View></View>) : null}
      <BottomNav label="Submit" onPress={submit} />
    </>
  );

  // Main render -------------------------------------------------------------
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={back}>
          <Image 
            source={require('../../assets/images/left-arrow.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book an Appointment</Text>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Progress indicator */}
      <StepProgress currentIndex={order.indexOf(step)} total={order.length} />
      
      {/* Content */}
      <View style={styles.content}>
        {step === 'type' && renderTypeStep()}
        {step === 'pet' && renderPetStep()}
        {step === 'clinic' && renderClinicStep()}
        {step === 'datetime' && renderDateTimeStep()}
        {step === 'notes' && renderNotesStep()}
        {step === 'review' && renderReviewStep()}
      </View>
    </View>
  );
}

// Styles --------------------------------------------------------------------
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
  content: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  choiceContainer: {
    gap: 12,
  },
  listItem: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  listItemSelected: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  listItemText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  listItemTextSelected: {
    color: '#fff',
  },
  listItemSubtitle: {
    fontSize: 12,
    color: Colors.light.text,
  },
  listItemSubtitleSelected: {
    color: '#fff',
  },
  dateButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bottomNav: {
    marginTop: 24,
    alignItems: 'center',
  },
  navButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewItem: {
    paddingVertical: 6,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewLabel: {
    width: 80,
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewValueContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 12,
  },
  reviewValue: {
    fontSize: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
  },
  progressWrapper: {
    // This is the main container for the progress bar.
    // Adjust paddingHorizontal to control how close circles are to the screen edges.
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  progressBarBg: {
    height: 4, // Height of the background bar
    backgroundColor: '#f0f0f0', // Color of the background bar
    borderRadius: 2, // Rounded corners for the bar
    position: 'absolute', // Position behind the circles
    left: 20 + (30 / 2), // Start after half of the first circle's width + padding
    right: 20 + (30 / 2), // End before half of the last circle's width + padding
    top: '50%', // Vertically center it
    transform: [{ translateY: -2 }], // Adjust by half of its height
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.light.tint, // Color of the filled progress bar
    borderRadius: 2,
  },
  progressCircles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // No specific width needed here as justify-content: space-between distributes them
  },
  progressCircle: {
    width: 30, // Diameter of the circle
    height: 30, // Diameter of the circle
    borderRadius: 15, // Half of width/height for a perfect circle
    backgroundColor: '#fff', // Inactive circle background
    borderWidth: 1,
    borderColor: '#ddd', // Inactive circle border
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleActive: {
    backgroundColor: Colors.light.tint, // Active circle background
    borderColor: Colors.light.tint, // Active circle border
  },
  progressCircleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text, // Inactive text color
  },
  progressCircleTextActive: {
    color: '#fff', // Active text color
  },
}); 