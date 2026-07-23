import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_DRAWER_WIDTH = 360;

interface SideDrawerProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  testID?: string;
}

/**
 * Left-anchored slide-in menu on a plain RN Modal — the same deterministic overlay approach as
 * CustomBottomSheet. The panel is always fully on-screen when open (no motion-library enter
 * animations to get stuck at their initial off-screen offset), and tapping the dimmed backdrop
 * anywhere outside the panel dismisses it.
 */
export function SideDrawer({ children, isOpen, onClose, testID }: SideDrawerProps) {
  const { colorScheme } = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Modal visibility is managed separately so the close animation can finish before unmount.
  const [modalVisible, setModalVisible] = useState(false);
  const hasBeenOpened = useRef(false);
  // Swallow the opening tap so it can't land on the backdrop and instantly re-close (Android).
  const [backdropEnabled, setBackdropEnabled] = useState(false);
  const backdropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const drawerWidth = Math.min(Math.round(windowWidth * 0.8), MAX_DRAWER_WIDTH);

  const translateX = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      hasBeenOpened.current = true;
      setBackdropEnabled(false);
      setModalVisible(true);
      translateX.setValue(1);
      backdropOpacity.setValue(0);

      Animated.parallel([Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }), Animated.timing(backdropOpacity, { toValue: 0.5, duration: 220, useNativeDriver: true })]).start();

      if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
      backdropTimerRef.current = setTimeout(() => {
        setBackdropEnabled(true);
      }, 280);
    } else if (hasBeenOpened.current) {
      setBackdropEnabled(false);
      if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
      Animated.parallel([Animated.timing(translateX, { toValue: 1, duration: 180, useNativeDriver: true }), Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true })]).start(
        ({ finished }) => {
          if (finished) {
            setModalVisible(false);
          }
        }
      );
    }
    return () => {
      if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!modalVisible) return null;

  return (
    <Modal visible={modalVisible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose} testID={testID}>
      {/* Backdrop — tapping anywhere outside the panel dismisses the menu */}
      <Pressable style={{ flex: 1 }} onPress={backdropEnabled ? handleClose : undefined} testID={testID ? `${testID}-backdrop` : undefined}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            opacity: backdropOpacity,
          }}
        />
      </Pressable>

      {/* Menu panel */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: drawerWidth,
          transform: [{ translateX: translateX.interpolate({ inputRange: [0, 1], outputRange: [0, -drawerWidth] }) }],
          backgroundColor: colorScheme === 'dark' ? '#111827' : '#ffffff',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
        }}
        testID={testID ? `${testID}-panel` : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
