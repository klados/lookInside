import React, { useState } from 'react'
import './App.css'
import {BrowserRouter, Link, Route, Router, Routes} from "react-router-dom";
import Home from "./components/Home.tsx";
import Dashboard from "./components/Dashboard.tsx";
import CreateCampaign from "./components/CreateCampaign.js";
import Navbar from "./NavBar.js";
import Campaign from "./components/Campaign.js";
import ReplaySession from "./components/ReplaySession.js";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import NotFound from "./components/NotFound.tsx";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import apiClient from './utils/apiClient';

// Google OAuth Callback Component
const GoogleAuthCallback = () => {
    const [error, setError] = useState(null);
    const { login } = useAuth();

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            // Send the authorization code to your backend
            apiClient.googleCallback(code)
                .then(data => {
                    // The backend has set HTTP-only cookies, so we just need to update the auth context
                    if (data.user) {
                        login(data.user);
                        // Redirect to dashboard
                        window.location.href = '/dashboard';
                    } else {
                        throw new Error('No user data received');
                    }
                })
                .catch(error => {
                    console.error('Authentication failed:', error);
                    setError('Authentication failed. Please try again.');
                });
        } else {
            setError('No authorization code received.');
        }
    }, [login]);

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button 
                        onClick={() => window.location.href = '/'}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Processing authentication...</p>
            </div>
        </div>
    );
};

// Wrapper component to use useAuth hook
const GoogleAuthCallbackWrapper = () => {
    return (
        <AuthProvider>
            <GoogleAuthCallback />
        </AuthProvider>
    );
};

function App() {
  return (
      <AuthProvider>
          <BrowserRouter>
              <div className="App">
                  <Navbar />

                  <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/dashboard" element={
                          <ProtectedRoute>
                              <Dashboard />
                          </ProtectedRoute>
                      } />
                      <Route path="/createCampaign" element={
                          <ProtectedRoute>
                              <CreateCampaign />
                          </ProtectedRoute>
                      } />
                      <Route path="/campaign/:campaignId" element={
                          <ProtectedRoute>
                              <Campaign />
                          </ProtectedRoute>
                      } />
                      <Route path="/campaign/:campaignId/session/:sessionId" element={
                          <ProtectedRoute>
                              <ReplaySession />
                          </ProtectedRoute>
                      } />
                      <Route path="/auth/google/callback" element={<GoogleAuthCallbackWrapper />} />
                      <Route path="*" element={<NotFound />} />
                  </Routes>
              </div>
          </BrowserRouter>
      </AuthProvider>
  )
}

export default App
