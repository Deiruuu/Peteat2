import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

// This page handles deep-links like `peteat://pet?tagId=ABC123` (query string)
// and redirects to the existing NFC screen so we don't need to change
// previously encoded tags or intent-filter definitions.
export default function PetDeepLinkIndex() {
  const { tagId } = useLocalSearchParams<{ tagId?: string }>();
  const router = useRouter();

  useEffect(() => {
    // Forward to the NFC feature screen, preserving the tagId if present
    if (tagId) {
      router.replace({ pathname: '/(features)/nfc', params: { tagId } });
    } else {
      router.replace('/(features)/nfc');
    }
  }, [tagId]);

  // Render nothing – user is immediately redirected
  return null;
} 