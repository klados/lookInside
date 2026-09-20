import React, {useState} from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, API_ENDPOINTS } from '../config';
import { useAuth } from "../contexts/AuthContext";

interface CampaignFormData {
  campaignName: string;
  domains: string;
  sessionLimit: number;
  startDate: string;
  endDate: string;
}

const CreateCampaign : React.FC = () => {
    const navigate = useNavigate();
    const { refreshToken } = useAuth();

    const getTodayDateTime = () => {
        const now = new Date();
        // Format to YYYY-MM-DDTHH:MM for datetime-local input
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
   };

    const [formData, setFormData] = useState<CampaignFormData>({
    campaignName: '',
    domains: '',
    sessionLimit: 5,
    startDate: getTodayDateTime(),
    endDate: ''
    });

    const [errors, setErrors] = useState<Partial<CampaignFormData>>({});
    const [submitting, setSubmitting] = useState(false);
    const [serverMessage, setServerMessage] = useState<string | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
          ...prev,
          [name]: name === 'sessionLimit' ? parseInt(value) || 0 : value
        }));

        // Clear error when user starts typing
        if (errors[name as keyof CampaignFormData]) {
          setErrors(prev => ({
            ...prev,
            [name]: ''
          }));
        }
    };

    const isValidDomain = (domain: string): boolean => {
        // Check for localhost (with or without port)
        const localhostRegex = /^localhost(:\d+)?$/;
        if (localhostRegex.test(domain)) {
            return true;
        }

        // Check for IPv4 addresses (with optional port)
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(:\d+)?$/;
        if (ipv4Regex.test(domain)) {
            return true;
        }

        // Check for IPv6 addresses (with optional port)
        // IPv6 can be in brackets [::1] or [::1]:port format
        const ipv6BracketRegex = /^\[([0-9a-fA-F:]+)](:\d+)?$/;
        const ipv6Match = domain.match(ipv6BracketRegex);
        if (ipv6Match) {
            const ipv6Address = ipv6Match[1];
            const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$|^::1$|^::$/;
            return ipv6Regex.test(ipv6Address);
        }

        // Check for IPv6 addresses without brackets (less common but valid)
        const ipv6SimpleRegex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$|^::1$|^::$/;
        if (ipv6SimpleRegex.test(domain)) {
            return true;
        }

        // Check for regular domains
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    };

    const validateDomains = (domains: string): boolean => {
        if (!domains.trim()) return false;

        const domainList = domains.split(',').map(d => d.trim()).filter(d => d);

        return domainList.every(domain => isValidDomain(domain));
    };

    const validateForm = (): boolean => {
        const newErrors: Partial<CampaignFormData> = {};

        if (!formData.campaignName.trim()) {
          newErrors.campaignName = 'Campaign name is required';
        }

        if (!formData.domains.trim()) {
            newErrors.domains = 'At least one domain is required';
        } else if (!validateDomains(formData.domains)) {
            newErrors.domains = 'Please enter valid domains (e.g., example.com, test.org)';
        }

        if (!formData.startDate) {
          newErrors.startDate = 'Start date is required';
        }

        if (!formData.endDate) {
          newErrors.endDate = 'End date is required';
        } else if (formData.startDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
          newErrors.endDate = 'End date must be after start date';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
      };

    const toUnixMillis = (v: string) => {
        // Create a Date object from the datetime-local input
        const date = new Date(v);
        // Convert to Unix timestamp in milliseconds
        return date.getTime();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setServerMessage(null);

        if (!validateForm()) return;

        // Ensure dates are sent as milliseconds since epoch
        const payload = {
            name: formData.campaignName.trim(),
            domains: formData.domains.trim(),
            limit: formData.sessionLimit,
            start_date_time: toUnixMillis(formData.startDate),
            end_date_time: toUnixMillis(formData.endDate),
        };

        const doRequest = async () => {
          return fetch(`${API_BASE}${API_ENDPOINTS.CAMPAIGN.CREATE}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        };

        try {
          setSubmitting(true);
          let res = await doRequest();

          // If unauthorized, try refreshing token once and retry
          if (res.status === 401) {
            const refreshed = await refreshToken().catch(() => false);
            if (refreshed) {
              res = await doRequest();
            }
          }

          if (!res.ok) {
            // Try to parse JSON error response first
            try {
              const errorData = await res.json();
              const errorMessage = errorData.error || `Request failed with status ${res.status}`;
              // Handle specific 403 error for campaign limit
              if (res.status === 403) {
                setServerMessage(`${errorMessage}`);
              } else {
                setServerMessage(errorMessage);
              }
              return; // Don't throw, just set the message
            } catch (jsonError) {
              // If JSON parsing fails, fall back to text
              const text = await res.text().catch(() => '');
              throw new Error(text || `Request failed with status ${res.status}`);
            }
          }

          navigate('/dashboard');
        } catch (err: any) {
          setServerMessage(err?.message || 'Failed to create campaign.');
        } finally {
          setSubmitting(false);
        }
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header Section */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Create Campaign
              </h1>
              <p className="text-slate-600 mt-3 text-lg">Set up a new campaign to start tracking user sessions</p>
            </div>
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

        {/* Form Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          {serverMessage && (
            <div className={`mb-6 p-4 rounded-xl border ${
              serverMessage.includes('success') 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' 
                : 'bg-red-50/80 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-3">
                {serverMessage.includes('success') ? (
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="font-medium">{serverMessage}</span>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campaign Name */}
            <div>
              <label htmlFor="campaignName" className="block text-sm font-semibold text-slate-700 mb-2">
                Campaign Name
              </label>
              <input
                type="text"
                id="campaignName"
                name="campaignName"
                value={formData.campaignName}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm text-slate-700 placeholder-slate-400 ${
                  errors.campaignName ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="Enter campaign name"
                disabled={submitting}
              />
              {errors.campaignName && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.campaignName}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-2">
                A unique identifier for your campaign. This name will help you identify and manage this campaign in your dashboard.
              </p>
            </div>

            {/* Domain */}
            <div>
              <label htmlFor="domains" className="block text-sm font-semibold text-slate-700 mb-2">
                Domain to Accept Traffic From
              </label>
              <input
                type="text"
                id="domains"
                name="domains"
                value={formData.domains}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm text-slate-700 placeholder-slate-400 ${
                  errors.domains ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="example.com"
                disabled={submitting}
              />
              {errors.domains && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.domains}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-2">
                Specify which domains are allowed to send traffic to this campaign. Separate multiple domains with commas.
                Only visitors from these domains will be tracked and counted toward your session limit. For testing purposes, you can use the external IP address of your computer.
              </p>
            </div>

            {/* Session Limit */}
            <div>
              <label htmlFor="sessionLimit" className="block text-sm font-semibold text-slate-700 mb-2">
                Session Limit
              </label>
              <input
                type="number"
                id="sessionLimit"
                name="sessionLimit"
                value={formData.sessionLimit}
                onChange={handleInputChange}
                min="1"
                max="20"
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm text-slate-700 placeholder-slate-400 ${
                  errors.sessionLimit ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="Enter number of sessions"
                disabled={submitting}
              />
              {errors.sessionLimit && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.sessionLimit}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-2">
                Maximum number of user sessions to capture for this campaign. Once this limit is reached,
                the campaign will stop accepting new sessions automatically to control costs and data volume.
              </p>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-sm font-semibold text-slate-700 mb-2">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm text-slate-700 ${
                    errors.startDate ? 'border-red-300' : 'border-slate-200'
                  }`}
                  disabled={submitting}
                />
                {errors.startDate && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.startDate}
                  </p>
                )}
                <p className="text-sm text-slate-500 mt-2">
                  The date when your campaign becomes active and starts capturing sessions.
                  Sessions received before this date will be ignored. Defaults to today's date.
                </p>
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="endDate" className="block text-sm font-semibold text-slate-700 mb-2">
                  End Date
                </label>
                <input
                  type="datetime-local"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm text-slate-700 ${
                    errors.endDate ? 'border-red-300' : 'border-slate-200'
                  }`}
                  disabled={submitting}
                />
                {errors.endDate && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 01-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.endDate}
                  </p>
                )}
                <p className="text-sm text-slate-500 mt-2">
                  The date when your campaign stops accepting new sessions. After this date,
                  the campaign will be automatically deactivated even if the session limit hasn't been reached.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 px-8 rounded-xl transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating Campaign...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Campaign
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaign;