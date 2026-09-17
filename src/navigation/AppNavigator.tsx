import React, { useEffect } from "react";
import { Text } from "react-native";
import {
  NavigationContainer,
  useNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes, RootRoutes } from "./types";
import { useNavigationChrome } from "../context/NavigationChromeContext";
import { useTheme } from "../context/ThemeContext";
import {
  HomeScreen,
  ScheduleScreen,
  WeekScreen,
  ManageServicesScreen,
} from "../screens/WeeklyScreens";
import {
  ServiceScreen,
  ArrangementScreen,
  AddSongsScreen,
  MetronomeAddSongsScreen,
} from "../screens/ServiceScreens";
import {
  LibraryScreen,
  SongScreen,
  SongEditScreen,
  TargetsScreen,
} from "../screens/LibraryScreens";
import { PeopleScreen } from "../screens/PeopleScreen";
import { LibraryImportScreen } from "../screens/LibraryImportScreen";
import { PracticeScreen } from "../screens/PracticeScreen";
import {
  ProfileScreen,
  AnnouncementsScreen,
  RulesScreen,
} from "../screens/ProfileScreen";
const Stack = createNativeStackNavigator<Routes>();
const RootStack = createNativeStackNavigator<RootRoutes>();
const Tabs = createBottomTabNavigator();
function PageStack({
  initial,
}: {
  initial: "Home" | "Schedule" | "Library" | "Announcements" | "Profile";
}) {
  const { colors, mode } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerStyle: {
          backgroundColor: mode === "dark" ? colors.surface : colors.teal,
        },
        headerTintColor: mode === "dark" ? colors.ink : colors.onAccent,
        statusBarStyle: "light",
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: "Kembali",
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Beranda" }}
      />
      <Stack.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ title: "Jadwal Pelayan" }}
      />
      <Stack.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: "Song Bank" }}
      />
      <Stack.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{ title: "Pengumuman" }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profil" }}
      />
      <Stack.Screen
        name="Week"
        component={WeekScreen}
        options={{ title: "GPdI Elshaddai Magelang" }}
      />
      <Stack.Screen
        name="Service"
        component={ServiceScreen}
        options={{ title: "Ibadah" }}
      />
      <Stack.Screen
        name="Arrangement"
        component={ArrangementScreen}
        options={{ title: "Aransemen ibadah" }}
      />
      <Stack.Screen
        name="AddSongs"
        component={AddSongsScreen}
        options={{ title: "Tambah lagu" }}
      />
      <Stack.Screen
        name="Song"
        component={SongScreen}
        options={{ title: "Lagu" }}
      />
      <Stack.Screen
        name="LibraryImport"
        component={LibraryImportScreen}
        options={{ title: "Import ProPresenter" }}
      />
      <Stack.Screen
        name="SongEdit"
        component={SongEditScreen}
        options={{ title: "Edit Song Bank" }}
      />
      <Stack.Screen
        name="Targets"
        component={TargetsScreen}
        options={{ title: "Pilih ibadah" }}
      />
      <Stack.Screen
        name="People"
        component={PeopleScreen}
        options={{ title: "Kelola Petugas" }}
      />
      <Stack.Screen
        name="ManageServices"
        component={ManageServicesScreen}
        options={{ title: "Kelola Ibadah" }}
      />
      <Stack.Screen
        name="Rules"
        component={RulesScreen}
        options={{ title: "Peraturan" }}
      />
    </Stack.Navigator>
  );
}
function HomeStack() {
  return <PageStack initial="Home" />;
}
function ScheduleStack() {
  return <PageStack initial="Schedule" />;
}
function LibraryStack() {
  return <PageStack initial="Library" />;
}
function AnnouncementsStack() {
  return <PageStack initial="Announcements" />;
}
function ProfileStack() {
  return <PageStack initial="Profile" />;
}
function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          minHeight: 66,
          paddingTop: 5,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 22 }}>
            {
              (
                {
                  Beranda: "⌂",
                  Jadwal: "▦",
                  "Song Bank": "♫",
                  Pengumuman: "◇",
                  Profil: "○",
                } as Record<string, string>
              )[route.name]
            }
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="Beranda" component={HomeStack} />
      <Tabs.Screen name="Jadwal" component={ScheduleStack} />
      <Tabs.Screen name="Song Bank" component={LibraryStack} />
      <Tabs.Screen name="Pengumuman" component={AnnouncementsStack} />
      <Tabs.Screen name="Profil" component={ProfileStack} />
    </Tabs.Navigator>
  );
}
export function AppNavigator() {
  const { colors, mode } = useTheme();
  const baseTheme = mode === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.teal,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.border,
      notification: colors.teal,
    },
  };
  const nav = useNavigationContainerRef<RootRoutes>();
  const { setMetronomeActive } = useNavigationChrome();
  const updateChrome = () => {
    const state = nav.getRootState();
    setMetronomeActive(
      !!state && state.routes[state.index].name !== "MainTabs",
    );
  };
  useEffect(() => () => setMetronomeActive(false), [setMetronomeActive]);
  return (
    <NavigationContainer
      theme={navigationTheme}
      ref={nav}
      onReady={updateChrome}
      onStateChange={updateChrome}
    >
      <RootStack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: mode === "dark" ? colors.surface : colors.teal,
          },
          headerTintColor: mode === "dark" ? colors.ink : colors.onAccent,
          statusBarStyle: "light",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <RootStack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="Practice"
          component={PracticeScreen}
          options={{ title: "Metronome", headerBackTitle: "Kembali" }}
        />
        <RootStack.Screen
          name="MetronomeAddSongs"
          component={MetronomeAddSongsScreen}
          options={{ title: "Tambah lagu" }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
