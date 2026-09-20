import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {API_BASE, API_ENDPOINTS} from "../config";
import { useAuth } from "../contexts/AuthContext";

interface InitConnectionStreamingDTO {
  id?: number;
  campaignId: string;
  sessionId: string;
  remoteIpAddress?: string;
  userAgent?: string;
  language?: string;
  hardwareConcurrency?: string;
  deviceMemory?: string;
  maxTouchPoints?: string;
  networkType?: string;
  geolocation?: string;
  cookiesEnabled: boolean;
  webdriver?: boolean;
  fullScreenEnabled: boolean;
  hasFocus: boolean;
  storageEstimate?: string;
  timezone?: string;
  localeTime?: string;
  country?: string; // Add country field
}

const Campaign: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { refreshToken } = useAuth();
  const [sessions, setSessions] = useState<InitConnectionStreamingDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<InitConnectionStreamingDTO | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'human' | 'webdriver'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Function to get country name from IP address
  const getCountryFromIP = async (ipAddress: string): Promise<string> => {
    try {
      if (!ipAddress || ipAddress === 'N/A' || ipAddress === '') {
        return 'Unknown';
      }
      
      const response = await fetch(`https://ipapi.co/${ipAddress}/country_name/`, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const countryName = await response.text();
      return countryName.trim() || 'Unknown';
    } catch (error) {
      console.warn(`Failed to get country for IP ${ipAddress}:`, error);
      return 'Unknown';
    }
  };

  // Function to enrich sessions with country data
  const enrichSessionsWithCountryData = async (sessions: InitConnectionStreamingDTO[]): Promise<InitConnectionStreamingDTO[]> => {
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        if (session.remoteIpAddress) {
          const country = await getCountryFromIP(session.remoteIpAddress);
          return { ...session, country };
        }
        return { ...session, country: 'Unknown' };
      })
    );
    return enrichedSessions;
  };

  const fetchSessions = async () => {
    if (!campaignId) {
      setError("Campaign ID is required");
      return;
    }

    setLoading(true);
    setError("");

    const doRequest = async () => {
      return fetch(`${API_BASE}${API_ENDPOINTS.CAMPAIGN.SESSIONS}/${campaignId}/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    };

    try {
      let response = await doRequest();

      // If unauthorized, attempt refresh and retry once
      if (response.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          response = await doRequest();
        }
      }

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      let sessionsArray: InitConnectionStreamingDTO[];
      
      if (Array.isArray(data)) {
        sessionsArray = data;
      } else if (data && Array.isArray(data.sessions)) {
        sessionsArray = data.sessions;
      } else if (data && Array.isArray(data.data)) {
        sessionsArray = data.data;
      } else if (data && typeof data === 'object') {
        sessionsArray = [data];
      } else {
        sessionsArray = [];
      }
      
      // Enrich sessions with country data
      const enrichedSessions = await enrichSessionsWithCountryData(sessionsArray);
      setSessions(enrichedSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      fetchSessions();
    }
  }, [campaignId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedSession(null);
      }
    };

    if (selectedSession) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSession]);

  const formatValue = (value: any): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === null || value === undefined || value === '') return 'N/A';
    return String(value);
  };

  const getSessionType = (session: InitConnectionStreamingDTO): 'human' | 'webdriver' => {
    return session.webdriver ? 'webdriver' : 'human';
  };

    const filteredSessions = sessions.filter(session => {
        const matchesSearch = session.sessionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.remoteIpAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.language?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.country?.toLowerCase().includes(searchTerm.toLowerCase()); // Add country to search

        if (filterType === 'all') {
            return matchesSearch;
        }

        const sessionType = getSessionType(session);
        return matchesSearch && sessionType === filterType;
    });

  const humanSessions = sessions.filter(s => !s.webdriver).length;
  const webdriverSessions = sessions.filter(s => s.webdriver).length;

  const redirectToReplayPage = (sessionId: string) => {
    if (!campaignId) return;
    navigate(`/campaign/${campaignId}/session/${sessionId}`);
  };

  const handleDeleteCampaign = async () => {
    if (!campaignId) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE}${API_ENDPOINTS.CAMPAIGN.DELETE}/${campaignId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      // Redirect to dashboard after successful deletion
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete campaign");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const renderSessionCard = (session: InitConnectionStreamingDTO) => (
    <div
      key={session.sessionId}
      className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl p-6 border border-white/30 group transition-all duration-300 hover:-translate-y-1"
    >
      {/* Header with Status and Session ID */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${session.webdriver ? 'bg-amber-400 shadow-amber-200 shadow-md' : 'bg-emerald-400 shadow-emerald-200 shadow-md'}`}></div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
              Session {session.sessionId.substring(0, 8)}...
            </h3>
            <p className="text-sm text-slate-500 font-medium">ID: {session.sessionId}</p>
          </div>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
          session.webdriver
            ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-200 shadow-sm'
            : 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border border-emerald-200 shadow-sm'
        }`}>
          {session.webdriver ? '🤖 Bot Traffic' : '👤 Human User'}
        </span>
      </div>

      {/* Session Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="bg-blue-100 p-2 rounded-lg">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">IP Address</p>
            <p className="text-slate-800 font-medium">{formatValue(session.remoteIpAddress)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="bg-green-100 p-2 rounded-lg">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Country</p>
            <p className="text-slate-800 font-medium">{formatValue(session.country)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="bg-purple-100 p-2 rounded-lg">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Language</p>
            <p className="text-slate-800 font-medium">{formatValue(session.language)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="bg-green-100 p-2 rounded-lg">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Hardware</p>
            <p className="text-slate-800 font-medium">{formatValue(session.hardwareConcurrency)} cores</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="bg-pink-100 p-2 rounded-lg">
            <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Timezone</p>
            <p className="text-slate-800 font-medium">{formatValue(session.timezone)}</p>
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
          session.cookiesEnabled
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {session.cookiesEnabled ? '🍪 Cookies Enabled' : '🚫 Cookies Disabled'}
        </span>
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
          session.hasFocus
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-gray-50 text-gray-600 border border-gray-200'
        }`}>
          {session.hasFocus ? '👁️ Active Focus' : '💤 No Focus'}
        </span>
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
          session.fullScreenEnabled
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            : 'bg-gray-50 text-gray-600 border border-gray-200'
        }`}>
          {session.fullScreenEnabled ? '🖥️ Fullscreen' : '🪟 Windowed'}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSession(session);
            }}
            className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all duration-200 flex items-center gap-2 hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            View Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              redirectToReplayPage(session.sessionId);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 border border-emerald-200 rounded-xl transition-all duration-200 flex items-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a2.5 2.5 0 110 5H9m4.5-2H14" />
            </svg>
            Watch Replay
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-8 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Campaign Sessions
              </h1>
              <p className="text-slate-600 mt-3 text-lg">
                Campaign ID: <span className="font-mono font-medium text-slate-800">{campaignId}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold px-6 py-3 rounded-xl transition duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Campaign
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/30 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Total Sessions</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{sessions.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/30 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Human Users</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{humanSessions}</p>
              </div>
              <div className="bg-emerald-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/30 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Bot Traffic</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{webdriverSessions}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by session ID, IP address, or language..."
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/90 backdrop-blur-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'human' | 'webdriver')}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/90 backdrop-blur-sm font-medium"
              >
                <option value="all">All Sessions</option>
                <option value="human">Human Users Only</option>
                <option value="webdriver">Bot Traffic Only</option>
              </select>
              <button
                onClick={fetchSessions}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl transition duration-300 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl p-6 mb-8 shadow-lg">
            <div className="flex items-center">
              <div className="bg-red-100 p-2 rounded-lg mr-4">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-red-800 font-medium">Error loading sessions</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sessions Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredSessions.length > 0 ? (
              filteredSessions.map(renderSessionCard)
            ) : (
              <div className="col-span-full text-center py-16">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 p-12">
                  <svg className="mx-auto w-16 h-16 text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No sessions found</h3>
                  <p className="text-slate-500">
                    {searchTerm || filterType !== 'all' 
                      ? "Try adjusting your search or filter criteria." 
                      : "Sessions will appear here once users interact with your campaign."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-red-100 p-3 rounded-full mr-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Delete Campaign?</h3>
                </div>
                
                <div className="mb-6">
                  <p className="text-slate-600 mb-3">
                    This action cannot be undone. Deleting this campaign will permanently remove:
                  </p>
                  <ul className="text-slate-700 space-y-2">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="font-medium">All {sessions.length} sessions</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>All session recordings and data</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Campaign configuration</span>
                    </li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl font-medium transition duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteCampaign}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl font-medium transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      'Delete Campaign'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Details Modal */}
        {selectedSession && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-6 rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Session Details</h2>
                    <p className="text-slate-600 mt-1">ID: {selectedSession.sessionId}</p>
                  </div>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="text-slate-400 hover:text-slate-600 p-2"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(selectedSession).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{key}</p>
                    <p className="text-slate-800 font-medium">{formatValue(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Campaign;