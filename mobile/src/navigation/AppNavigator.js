import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { AuthContext } from '../context/AuthContext';

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

const COLORS = {
  primary: '#4A90D9',
  background: '#EDF4FB',
  surface: '#FFFFFF',
  text: '#1E3A54',
  textMuted: '#7A9BB5',
  border: '#B8D8F0',
};

function TabIcon({ name, color, size }) {
  const icons = {
    home: '🏠',
    plus: '➕',
    chat: '💬',
    person: '👤',
  };
  return (
    <Text style={{ fontSize: size - 4, color }}>{icons[name]}</Text>
  );
}

function AuthGuardScreen({ navigation, targetScreen }) {
  React.useEffect(() => {
    navigation.replace('Login');
  }, []);
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
}

function NewFishTabScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  React.useEffect(() => {
    if (!user) {
      navigation.navigate('Login');
    }
  }, [user]);
  if (!user) return null;
  return <NewFishScreen navigation={navigation} />;
}

function ChatListTabScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  React.useEffect(() => {
    if (!user) {
      navigation.navigate('Login');
    }
  }, [user]);
  if (!user) return null;
  return <ChatListScreen navigation={navigation} />;
}

function MyPageTabScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  React.useEffect(() => {
    if (!user) {
      navigation.navigate('Login');
    }
  }, [user]);
  if (!user) return null;
  return <MyPageScreen navigation={navigation} />;
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
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: '홈',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="NewFish"
        options={{
          tabBarLabel: '등록',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="plus" color={color} size={size} />
          ),
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
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="chat" color={color} size={size} />
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
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person" color={color} size={size} />
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
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '600' },
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
        options={{ title: '로그인', headerBackTitle: '뒤로' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: '회원가입', headerBackTitle: '뒤로' }}
      />
      <Stack.Screen
        name="FishDetail"
        component={FishDetailScreen}
        options={{ title: '상품 상세', headerBackTitle: '뒤로' }}
      />
      <Stack.Screen
        name="SellerProfile"
        component={SellerProfileScreen}
        options={{ title: '판매자 프로필', headerBackTitle: '뒤로' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: '채팅', headerBackTitle: '뒤로' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EDF4FB',
  },
});
