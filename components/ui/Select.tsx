import React, { useState } from 'react';
import { Modal, TouchableOpacity, View, Text, FlatList, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeProvider';

type Item = { label: string; value: string; icon?: React.ReactNode; category?: string };

interface Props {
  label?: string;
  options: Item[];
  value?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

export const Select: React.FC<Props> = ({ label, options, value, onSelect, placeholder = 'Select' }) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (val: string) => {
    onSelect(val);
    setVisible(false);
  };

  return (
    <>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <TouchableOpacity
        style={[styles.selectBox, { borderColor: colors.border }]}
        onPress={() => setVisible(true)}
      >
        <Text style={{ color: value ? colors.text : colors.icon }}>
          {value ? options.find(o => o.value === value)?.label : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <TextInput
              placeholder="Search..."
              placeholderTextColor={colors.icon}
              style={[styles.search, { borderColor: colors.border, color: colors.text }]}
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.option} onPress={() => handleSelect(item.value)}>
                  {item.icon}
                  <Text style={{ color: colors.text }}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
              <Text style={{ color: colors.tint }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 4, fontSize: 14, fontWeight: '500' },
  selectBox: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '60%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  search: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 40,
  },
  option: {
    paddingVertical: 12,
  },
  closeBtn: { alignItems: 'center', paddingVertical: 12 },
}); 