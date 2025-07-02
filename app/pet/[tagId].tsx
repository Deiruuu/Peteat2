import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Handles deep-links like peteat://pet/ABC123 or https://peteat.app/pet/ABC123
export default function PetDeepLinkWithId() {
  const { tagId } = useLocalSearchParams<{ tagId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace({ pathname: '/(features)/nfc', params: { tagId } });
  }, [tagId]);

  return null;
} 