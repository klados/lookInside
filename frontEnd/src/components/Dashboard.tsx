import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { minify } from 'terser';
import { API_BASE, API_ENDPOINTS } from '../config';
import { useApiGet } from '../utils/useApiWithRefresh';

interface Campaign {
    id: string;
    name: string;
    domains: string;
    limit: number;
    start_date_time: number;
    end_date_time: number;
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Pending' | 'Expired'>('all');
    const [scriptContent, setScriptContent] = useState<string>('');
    const [copiedCampaignId, setCopiedCampaignId] = useState<string | null>(null);

    // Use the new hook with automatic token refresh
    const { data: campaignsData, loading, error, execute: fetchCampaigns, reset } = useApiGet<{ data: Campaign[] }>(
        API_ENDPOINTS.CAMPAIGN.LIST,
        1 // max retries
    );

    const campaigns = campaignsData?.data || [];

    // Fetch campaigns on component mount
    useEffect(() => {
        fetchCampaigns();
        const fetchScript = async () => {
            try {
                const response = await fetch(`${API_BASE}${API_ENDPOINTS.STATIC.MAGIC_FORMAT}`)
                if (!response.ok) {
                    throw new Error(`Failed to fetch script: ${response.status} ${response.statusText}`);
                }
                const text = await response.text();
                setScriptContent(text);
            } catch (err) {
                console.error("Failed to fetch magicFormat.js", err);
            }
        };
        fetchScript();
    }, []);

    const handleCreateCampaign = (): void => {
        navigate('/createCampaign');
    };

    const formatDate = (timestamp: number): string => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getCampaignStatus = (startTime: number, endTime: number): 'Active' | 'Pending' | 'Expired' => {
        const now = Date.now();
        if (now < startTime) {
            return 'Pending';
        } else if (now > endTime) {
            return 'Expired';
        } else {
            return 'Active';
        }
    };

    const getStatusBadgeColor = (status: 'Active' | 'Pending' | 'Expired'): string => {
        switch (status) {
            case 'Active':
                return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
            case 'Pending':
                return 'bg-amber-100 text-amber-800 border border-amber-200';
            case 'Expired':
                return 'bg-slate-100 text-slate-600 border border-slate-200';
            default:
                return 'bg-slate-100 text-slate-600 border border-slate-200';
        }
    };

    const showRecordings = (campaignId: string): void => {
        navigate(`/campaign/${campaignId}`);
    };

    const handleDownload = async (campaignId: string) => {
        if (!scriptContent) {
            alert("Script content is not loaded yet. Please try again in a moment.");
            return;
        }
        const campaignRegex = /(campaignId\s*=\s*["'])([^"']+)(["'])/;
        const baseUrlRegex = /(this\.baseUrl\s*=\s*["'])([^"']+)(["'])/;

        const withCampaign = scriptContent.replace(campaignRegex, `$1${campaignId}$3`);
        const modifiedContent = withCampaign.replace(baseUrlRegex, `$1${API_BASE}$3`);

        try {
            // Minify the JavaScript content using Terser
            const result = await minify(modifiedContent, {
                compress: {
                    dead_code: true,
                    drop_console: false,
                    drop_debugger: true,
                    keep_classnames: false,
                    keep_fargs: true,
                    keep_fnames: false,
                    keep_infinity: false
                },
                mangle: {
                    toplevel: false
                },
                format: {
                    comments: false
                }
            });
            
            const minifiedContent = result.code || modifiedContent;
            
            const blob = new Blob([minifiedContent], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `magicFormat-${campaignId}.js`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to minify script:', error);
            // Fallback to original content if minification fails
            const blob = new Blob([modifiedContent], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `magicFormat-${campaignId}.js`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleCopyToClipboard = async (campaignId: string) => {
        if (!scriptContent) {
            alert("Script content is not loaded yet. Please try again in a moment.");
            return;
        }
        const campaignRegex = /(campaignId\s*=\s*["'])([^"']+)(["'])/;
        const baseUrlRegex = /(this\.baseUrl\s*=\s*["'])([^"']+)(["'])/;

        const withCampaign = scriptContent.replace(campaignRegex, `$1${campaignId}$3`);
        const modifiedContent = withCampaign.replace(baseUrlRegex, `$1${API_BASE}$3`);

        try {
            // Minify the JavaScript content using Terser
            const result = await minify(modifiedContent, {
                compress: {
                    dead_code: true,
                    drop_console: false,
                    drop_debugger: true,
                    keep_classnames: false,
                    keep_fargs: true,
                    keep_fnames: false,
                    keep_infinity: false
                },
                mangle: {
                    toplevel: false
                },
                format: {
                    comments: false
                }
            });
            
            const minifiedContent = result.code || modifiedContent;
            
            navigator.clipboard.writeText(minifiedContent).then(() => {
                setCopiedCampaignId(campaignId);
                setTimeout(() => setCopiedCampaignId(null), 2500);
            }, () => {
                alert('Failed to copy script. Please try downloading it instead.');
            });
        } catch (error) {
            console.error('Failed to minify script:', error);
            // Fallback to original content if minification fails
            navigator.clipboard.writeText(modifiedContent).then(() => {
                setCopiedCampaignId(campaignId);
                setTimeout(() => setCopiedCampaignId(null), 2500);
            }, () => {
                alert('Failed to copy script. Please try downloading it instead.');
            });
        }
    };

    const handleRetry = (): void => {
        fetchCampaigns();
    };

    // Filter campaigns based on search term and status
    const filteredCampaigns = campaigns.filter(campaign => {
        const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             campaign.domains.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (filterStatus === 'all') {
            return matchesSearch;
        }
        
        const status = getCampaignStatus(campaign.start_date_time, campaign.end_date_time);
        return matchesSearch && status === filterStatus;
    });

    // Calculate stats
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => getCampaignStatus(c.start_date_time, c.end_date_time) === 'Active').length;
    const pendingCampaigns = campaigns.filter(c => getCampaignStatus(c.start_date_time, c.end_date_time) === 'Pending').length;
    const expiredCampaigns = campaigns.filter(c => getCampaignStatus(c.start_date_time, c.end_date_time) === 'Expired').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header Section */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 mb-8">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                                Campaign Dashboard
                            </h1>
                            <p className="text-slate-600 mt-3 text-lg">Manage and monitor your campaigns with ease</p>
                        </div>
                        <button
                            onClick={handleCreateCampaign}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8 py-4 rounded-xl transition duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Campaign
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-600 text-sm font-medium">Total Campaigns</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">{totalCampaigns}</p>
                            </div>
                            <div className="bg-blue-100 p-3 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-600 text-sm font-medium">Active</p>
                                <p className="text-3xl font-bold text-emerald-600 mt-1">{activeCampaigns}</p>
                            </div>
                            <div className="bg-emerald-100 p-3 rounded-lg">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-600 text-sm font-medium">Pending</p>
                                <p className="text-3xl font-bold text-amber-600 mt-1">{pendingCampaigns}</p>
                            </div>
                            <div className="bg-amber-100 p-3 rounded-lg">
                                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-600 text-sm font-medium">Expired</p>
                                <p className="text-3xl font-bold text-slate-500 mt-1">{expiredCampaigns}</p>
                            </div>
                            <div className="bg-slate-100 p-3 rounded-lg">
                                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl p-6 mb-8 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="bg-red-100 p-2 rounded-lg mr-4">
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-red-800 font-medium">Error loading campaigns</p>
                                    <p className="text-red-600 text-sm mt-1">{error}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleRetry}
                                className="bg-red-100 hover:bg-red-200 text-red-700 font-medium px-4 py-2 rounded-lg transition duration-200"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {/* Campaigns List */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                    {/* Search and Filter Header */}
                    <div className="p-8 border-b border-slate-200/50 bg-gradient-to-r from-slate-50/50 to-blue-50/50">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Your Campaigns</h2>
                                <p className="text-slate-600 mt-1">
                                    {filteredCampaigns.length} of {totalCampaigns} campaigns
                                </p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                                {/* Search */}
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search campaigns..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm text-slate-700 placeholder-slate-400 w-full sm:w-64"
                                    />
                                </div>
                                
                                {/* Filter */}
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value as any)}
                                    className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm text-slate-700 w-full sm:w-auto"
                                >
                                    <option value="all">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Expired">Expired</option>
                                </select>
                            </div>
                        </div>
                        
                        {loading && (
                            <div className="flex items-center text-slate-500 mt-4">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading campaigns...
                            </div>
                        )}
                    </div>

                    {loading && campaigns.length === 0 ? (
                        // Loading skeleton
                        <div className="divide-y divide-slate-100">
                            {[1, 2, 3].map((_, index) => (
                                <div key={index} className="p-8 animate-pulse">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="h-6 bg-slate-200 rounded-lg w-64"></div>
                                                <div className="h-8 bg-slate-200 rounded-full w-20"></div>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                <div className="h-4 bg-slate-200 rounded w-40"></div>
                                                <div className="h-4 bg-slate-200 rounded w-32"></div>
                                                <div className="h-4 bg-slate-200 rounded w-36"></div>
                                            </div>
                                        </div>
                                        <div className="h-10 bg-slate-200 rounded-lg w-32"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredCampaigns.map((campaign) => {
                                const status = getCampaignStatus(campaign.start_date_time, campaign.end_date_time);
                                return (
                                    <div key={campaign.id} className="p-8 hover:bg-slate-50/50 transition duration-200 group">
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <h3 className="text-xl font-semibold text-slate-800 group-hover:text-blue-700 transition duration-200">
                                                        {campaign.name}
                                                    </h3>
                                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(status)}`}>
                                                        {status}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <div className="bg-slate-100 p-2 rounded-lg">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h3z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-700">Duration</p>
                                                            <p className="text-slate-500">{formatDate(campaign.start_date_time)} - {formatDate(campaign.end_date_time)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <div className="bg-slate-100 p-2 rounded-lg">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-700">Session Limit</p>
                                                            <p className="text-slate-500">{campaign.limit === 0 ? 'No limit' : `${campaign.limit} sessions`}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <div className="bg-slate-100 p-2 rounded-lg">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-700">Domains</p>
                                                            <p className="text-slate-500 truncate max-w-48" title={campaign.domains}>{campaign.domains}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
                                                <button
                                                    onClick={() => handleDownload(campaign.id)}
                                                    disabled={!scriptContent}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-3 rounded-lg transition duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={!scriptContent ? "Script is loading..." : "Download tracking script"}
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                                    <span>Download</span>
                                                </button>
                                                <button
                                                    onClick={() => handleCopyToClipboard(campaign.id)}
                                                    disabled={!scriptContent}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-3 rounded-lg transition duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative"
                                                    title={!scriptContent ? "Script is loading..." : "Copy tracking script"}
                                                >
                                                    {copiedCampaignId === campaign.id ? (
                                                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                    ) : (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                                    )}
                                                    <span>{copiedCampaignId === campaign.id ? 'Copied!' : 'Copy Script'}</span>
                                                </button>
                                                <button
                                                    onClick={() => showRecordings(campaign.id)}
                                                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium px-4 py-3 rounded-lg transition duration-200 flex items-center gap-2"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>View Recordings</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && filteredCampaigns.length === 0 && !error && (
                        <div className="text-center py-16">
                            <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-semibold text-slate-700 mb-3">
                                {searchTerm || filterStatus !== 'all' ? 'No matching campaigns' : 'No campaigns yet'}
                            </h3>
                            <p className="text-slate-500 mb-8 max-w-md mx-auto">
                                {searchTerm || filterStatus !== 'all' 
                                    ? 'Try adjusting your search or filter criteria to find what you\'re looking for.'
                                    : 'Get started by creating your first campaign to begin tracking and monitoring your marketing efforts.'
                                }
                            </p>
                            {(!searchTerm && filterStatus === 'all') && (
                                <button
                                    onClick={handleCreateCampaign}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8 py-4 rounded-xl transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    Create Your First Campaign
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
