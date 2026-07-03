import { BrowserRouter, Routes, Route } from "react-router-dom";
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import ScheduleEvents from "./pages/ScheduleEvents";
import Services from "./pages/Services";
import ServicesInquiry from "./pages/ServicesInquiry";
import ServicesFeedback from "./pages/ServicesFeedback";
import Profile from "./pages/Profile";
import ProfilePassword from "./pages/ProfilePassword";
import Settings from "./pages/Settings";
import Messaging from "./pages/Messaging";
import Admin from "./pages/Admin";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/schedule-events" element={<ScheduleEvents />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services-inquiry" element={<ServicesInquiry />} />
        <Route path="/services-feedback" element={<ServicesFeedback />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile-password" element={<ProfilePassword />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/messaging" element={<Messaging />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}