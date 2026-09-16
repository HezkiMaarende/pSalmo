import React from "react";
import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "./types";
import { colors } from "../components/ui";
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
} from "../screens/ServiceScreens";
import {
  LibraryScreen,
  SongScreen,
  SongEditScreen,
  TargetsScreen,
} from "../screens/LibraryScreens";
import { PeopleScreen } from "../screens/PeopleScreen";
import { PracticeScreen } from "../screens/PracticeScreen";
import {
  ProfileScreen,
  AnnouncementsScreen,
  RulesScreen,
} from "../screens/ProfileScreen";
const Stack = createNativeStackNavigator<Routes>();
const Tabs = createBottomTabNavigator();
function PageStack({
  initial,
}: {
  initial: "Home" | "Schedule" | "Library" | "Announcements" | "Profile";
}) {
  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerStyle: { backgroundColor: colors.teal },
        headerTintColor: "#fff",
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
        name="Practice"
        component={PracticeScreen}
        options={{ title: "Latihan · Edit / Play" }}
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
export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tabs.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.teal,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { minHeight: 66, paddingTop: 5 },
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
    </NavigationContainer>
  );
}
