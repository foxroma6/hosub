import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AuthContext } from '../context/AuthContext';
import { COLORS, FONTS } from '../constants/colors';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import FishDetailScreen from '../screens/FishDetailScreen';
import NewFishScreen from '../screens/NewFishScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import MyPageScreen from '../screens/MyPageScreen';
import SellerProfileScreen from '../screens/SellerProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AddTabIcon({ focused }) {
  return (
    <View style={[tabStyles.addIcon, focused && tabStyles.addIconFocused]}>
      <Text style={[tabStyles.addIconText, focused && tabStyles.addIconTextFocused]}>+</Text>
    </View>
  );
}

function AuthGuardWrapper({ navigation }) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate('Login');
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
}

function MainTabs() {
  const { user } = useContext(AuthContext);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: FONTS.medium,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: '홈',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="NewFish"
        options={{
          tabBarLabel: '등록',
          tabBarIcon: ({ focused }) => <AddTabIcon focused={focused} />,
        }}
      >
        {(props) =>
          user ? (
            <NewFishScreen {...props} />
          ) : (
            <AuthGuardWrapper {...props} />
          )
        }
      </Tab.Screen>
      <Tab.Screen
        name="ChatList"
        options={{
          tabBarLabel: '채팅',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>💬</Text>
          ),
        }}
      >
        {(props) =>
          user ? (
            <ChatListScreen {...props} />
          ) : (
            <AuthGuardWrapper {...props} />
          )
        }
      </Tab.Screen>
      <Tab.Screen
        name="MyPage"
        options={{
          tabBarLabel: 'MY',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>👤</Text>
          ),
        }}
      >
        {(props) =>
          user ? (
            <MyPageScreen {...props} />
          ) : (
            <AuthGuardWrapper {...props} />
          )
        }
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: FONTS.semibold,
          fontSize: 16,
        },
        headerShadowVisible: false,
        headerBackTitle: '뒤로',
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: '로그인' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: '회원가입' }}
      />
      <Stack.Screen
        name="FishDetail"
        component={FishDetailScreen}
        options={{ title: '상품 상세' }}
      />
      <Stack.Screen
        name="SellerProfile"
        component={SellerProfileScreen}
        options={{ title: '판매자 프로필' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: '채팅' }}
      />
    </Stack.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconFocused: {
    backgroundColor: COLORS.primary,
  },
  addIconText: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: FONTS.bold,
    lineHeight: 24,
  },
  addIconTextFocused: {
    color: '#FFFFFF',
  },
});

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
