import React from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import Home from './pages/Home.jsx'
import Events from './pages/Events.jsx'
import EventDetail from './pages/EventDetail.jsx'
import Signup from './pages/Signup.jsx'
import Login from './pages/Login.jsx'
import Checkout from './pages/customer/Checkout.jsx'
import OrderSubmitted from './pages/customer/OrderSubmitted.jsx'
import MyTickets from './pages/customer/MyTickets.jsx'
import TicketDetail from './pages/customer/TicketDetail.jsx'
import MyOrders from './pages/customer/MyOrders.jsx'
import Notifications from './pages/customer/Notifications.jsx'

import StaffLogin from './pages/staff/StaffLogin.jsx'
import OrganizerAcceptInvite from './pages/staff/OrganizerAcceptInvite.jsx'

import OrganizerDashboard from './pages/organizer/OrganizerDashboard.jsx'
import OrganizerNewEvent from './pages/organizer/OrganizerNewEvent.jsx'
import OrganizerEventDetail from './pages/organizer/OrganizerEventDetail.jsx'

import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminEvents from './pages/admin/AdminEvents.jsx'
import AdminEventDetail from './pages/admin/AdminEventDetail.jsx'
import AdminOrderRequests from './pages/admin/AdminOrderRequests.jsx'
import AdminWalkIn from './pages/admin/AdminWalkIn.jsx'
import AdminComp from './pages/admin/AdminComp.jsx'
import AdminGateStaff from './pages/admin/AdminGateStaff.jsx'
import AdminMockInbox from './pages/admin/AdminMockInbox.jsx'
import AdminTicketDetail from './pages/admin/AdminTicketDetail.jsx'

import GateLogin from './pages/gate/GateLogin.jsx'
import GateScan from './pages/gate/GateScan.jsx'

import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/events" element={<Events />} />
      <Route path="/events/:id" element={<EventDetail />} />

      {/* Customer auth */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />

      {/* Customer */}
      <Route path="/checkout/:eventId" element={
        <ProtectedRoute roles={['customer']}><Checkout /></ProtectedRoute>
      } />
      <Route path="/orders/:orderId/submitted" element={
        <ProtectedRoute roles={['customer']}><OrderSubmitted /></ProtectedRoute>
      } />
      <Route path="/my-tickets" element={
        <ProtectedRoute roles={['customer']}><MyTickets /></ProtectedRoute>
      } />
      <Route path="/my-tickets/:id" element={
        <ProtectedRoute roles={['customer']}><TicketDetail /></ProtectedRoute>
      } />
      <Route path="/my-orders" element={
        <ProtectedRoute roles={['customer']}><MyOrders /></ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute roles={['customer']}><Notifications /></ProtectedRoute>
      } />

      {/* Staff auth */}
      <Route path="/staff/login" element={<StaffLogin />} />
      <Route path="/organizer/accept-invite" element={<OrganizerAcceptInvite />} />

      {/* Organizer */}
      <Route path="/org" element={
        <ProtectedRoute roles={['organizer']}><OrganizerDashboard /></ProtectedRoute>
      } />
      <Route path="/org/new" element={
        <ProtectedRoute roles={['organizer']}><OrganizerNewEvent /></ProtectedRoute>
      } />
      <Route path="/org/events/:id" element={
        <ProtectedRoute roles={['organizer']}><OrganizerEventDetail /></ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/admin/events" element={
        <ProtectedRoute roles={['admin']}><AdminEvents /></ProtectedRoute>
      } />
      <Route path="/admin/events/:id" element={
        <ProtectedRoute roles={['admin']}><AdminEventDetail /></ProtectedRoute>
      } />
      <Route path="/admin/order-requests" element={
        <ProtectedRoute roles={['admin']}><AdminOrderRequests /></ProtectedRoute>
      } />
      <Route path="/admin/walk-in" element={
        <ProtectedRoute roles={['admin']}><AdminWalkIn /></ProtectedRoute>
      } />
      <Route path="/admin/comp" element={
        <ProtectedRoute roles={['admin']}><AdminComp /></ProtectedRoute>
      } />
      <Route path="/admin/gate-staff" element={
        <ProtectedRoute roles={['admin']}><AdminGateStaff /></ProtectedRoute>
      } />
      <Route path="/admin/mock-inbox" element={
        <ProtectedRoute roles={['admin']}><AdminMockInbox /></ProtectedRoute>
      } />
      <Route path="/admin/tickets/:id" element={
        <ProtectedRoute roles={['admin']}><AdminTicketDetail /></ProtectedRoute>
      } />

      {/* Gate */}
      <Route path="/gate/login" element={<GateLogin />} />
      <Route path="/gate/scan" element={
        <ProtectedRoute roles={['gate_staff']}><GateScan /></ProtectedRoute>
      } />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
