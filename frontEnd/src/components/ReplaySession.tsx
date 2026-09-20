import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import {API_ENDPOINTS} from "../config";
import { apiClient } from '../utils/apiClient';

interface EventStreamingDTO {
    timestamp: number;
    type: number;
    data: any;
}

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
}

interface ReplaySessionData {
    init: InitConnectionStreamingDTO;
    events: EventStreamingDTO[];
}

const ReplaySession: React.FC = () => {
    const { campaignId, sessionId } = useParams<{
        campaignId: string;
        sessionId: string;
    }>();
    const navigate = useNavigate();
    const playerRef = useRef<HTMLDivElement>(null);
    const [sessionData, setSessionData] = useState<ReplaySessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [player, setPlayer] = useState<any>(null);

    const fetchSessionData = async () => {
        if (!campaignId || !sessionId) {
            setError('Campaign ID and Session ID are required');
            setLoading(false);
            return;
        }

        try {
            const data: ReplaySessionData = await apiClient.get(
                `${API_ENDPOINTS.CAMPAIGN.REPLAY}/${campaignId}/${sessionId}`
            );
            
            if (!data.events || data.events.length === 0) {
                setError('No events found for this session');
                setLoading(false);
                return;
            }

            setSessionData(data);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching session data:', err);
            
            // Handle specific authentication errors
            if (err.status === 401 || err.message?.includes('401')) {
                setError('Authentication failed. Please log in again.');
            } else if (err.status === 403) {
                setError('You do not have permission to access this session.');
            } else if (err.status === 404) {
                setError('Session not found. It may have been deleted or does not exist.');
            } else {
                setError(err instanceof Error ? err.message : 'Failed to load session data');
            }
        } finally {
            setLoading(false);
        }
    };

    const initializePlayer = () => {
        if (!sessionData || !playerRef.current) return;

        // Clean up existing player
        if (player) {
            player.destroy?.();
        }

        try {
            // Transform events to rrweb format if needed
            const rrwebEvents = sessionData.events.map(event => ({
                type: event.type,
                data: event.data,
                timestamp: event.timestamp
            }));

            const newPlayer = new rrwebPlayer({
                target: playerRef.current,
                props: {
                    events: rrwebEvents,
                    width: 1024,
                    height: 768,
                    autoPlay: false,
                    showController: true,
                    speedOption: [1, 2, 4, 8],
                    tags: {
                        'virtual-dom': 'rrweb'
                    }
                }
            });

            setPlayer(newPlayer);
        } catch (err) {
            console.error('Error initializing player:', err);
            setError('Failed to initialize replay player');
        }
    };

    useEffect(() => {
        fetchSessionData();
    }, [campaignId, sessionId]);

    useEffect(() => {
        if (sessionData && !loading && !error) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                initializePlayer();
            }, 100);
        }

        // Cleanup function
        return () => {
            if (player) {
                player.destroy?.();
            }
        };
    }, [sessionData, loading, error]);

    const handleBackClick = () => {
        // Navigate back to the campaign page
        navigate(`/campaign/${campaignId}`);
    };

    const handleRetry = () => {
        setError(null);
        setLoading(true);
        fetchSessionData();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600 font-medium">Loading session replay...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-8">
                        <div className="text-center">
                            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">
                                Error Loading Session
                            </h2>
                            <p className="text-slate-600 mb-6">{error}</p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={handleRetry}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl transition duration-300 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Try Again
                                </button>
                                <button
                                    onClick={handleBackClick}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition duration-300 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Go Back
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header Section */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-8 mb-8">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                                Session Replay
                            </h1>
                            <p className="text-slate-600 mt-3 text-lg">
                                Session: <span className="font-mono font-medium text-slate-800">{sessionId}</span> | 
                                Campaign: <span className="font-mono font-medium text-slate-800">{campaignId}</span>
                            </p>
                        </div>
                        <button
                            onClick={handleBackClick}
                            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Campaign
                        </button>
                    </div>
                </div>

                {/* Session Info */}
                {sessionData?.init && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-6 mb-8">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Session Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {sessionData.init.userAgent && (
                                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">User Agent</p>
                                    <p className="text-slate-800 font-medium truncate" title={sessionData.init.userAgent}>
                                        {sessionData.init.userAgent}
                                    </p>
                                </div>
                            )}
                            {sessionData.init.remoteIpAddress && (
                                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">IP Address</p>
                                    <p className="text-slate-800 font-medium">{sessionData.init.remoteIpAddress}</p>
                                </div>
                            )}
                            {sessionData.init.language && (
                                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Language</p>
                                    <p className="text-slate-800 font-medium">{sessionData.init.language}</p>
                                </div>
                            )}
                            {sessionData.init.timezone && (
                                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Timezone</p>
                                    <p className="text-slate-800 font-medium">{sessionData.init.timezone}</p>
                                </div>
                            )}
                            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Session Type</p>
                                <p className="text-slate-800 font-medium">
                                    {sessionData.init.webdriver ? '🤖 Bot Traffic' : '👤 Human User'}
                                </p>
                            </div>
                            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Cookies</p>
                                <p className="text-slate-800 font-medium">
                                    {sessionData.init.cookiesEnabled ? '✅ Enabled' : '❌ Disabled'}
                                </p>
                            </div>
                            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Focus</p>
                                <p className="text-slate-800 font-medium">
                                    {sessionData.init.hasFocus ? '👁️ Active' : '💤 Inactive'}
                                </p>
                            </div>
                            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Fullscreen</p>
                                <p className="text-slate-800 font-medium">
                                    {sessionData.init.fullScreenEnabled ? '🖥️ Enabled' : '🪟 Windowed'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Player Container */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-8">
                    <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">
                            Session Replay Player
                        </h3>
                        <p className="text-slate-600">
                            {sessionData?.events?.length || 0} events recorded
                        </p>
                    </div>
                    
                    {/* Player */}
                    <div className="flex justify-center">
                        <div
                            ref={playerRef}
                            className="border border-slate-200 rounded-xl overflow-hidden shadow-lg"
                            style={{ maxWidth: '100%', width: 'fit-content' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReplaySession;