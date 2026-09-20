import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import DemoReplay from "./DemoReplay";

const Home = () => {
  const { isAuthenticated, user } = useAuth();
    const handleGoogleLogin = (): void => {
        // Google OAuth URL - you'll need to configure this with your Google Client ID
        console.log("VITE_GOOGLE_CLIENT_ID", import.meta.env.VITE_GOOGLE_CLIENT_ID);
        console.log("VITE_API_BASE_URL", import.meta.env.VITE_API_BASE_URL);
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(import.meta.env.VITE_API_BASE_URL + '/api/v1/auth/google/callback')}&response_type=code&scope=openid%20email%20profile`;
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-800">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-20">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-blue-300 blur-3xl"></div>
          <div className="pointer-events-none absolute top-24 left-1/3 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-indigo-300 blur-3xl"></div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-20">
          <div className="grid items-center gap-12">
            <div className="text-center lg:text-left">
              {isAuthenticated ? (
                <>
                  <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200">
                Welcome back, {user?.name}! 🎉
                  </span>
                  <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Ready to continue optimizing?
                  </h1>
                  <p className="mt-4 text-lg text-slate-600">
                Jump back into your dashboard to view recent sessions, create new campaigns, or analyze user behavior patterns.
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                    <Link
                      to="/dashboard"
                      className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-3 text-sm font-semibold text-white transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Go to Dashboard
                    </Link>
                    <Link
                      to="/createCampaign"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white/80 backdrop-blur-sm px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-white transition duration-300 shadow-lg hover:shadow-xl"
                    >
                      Create Campaign
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                New • Launch offer available
                  </span>
                  <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Track and replay user sessions with precision
                  </h1>
                  <p className="mt-4 text-lg text-slate-600">
                Understand exactly how users interact with your website. Record, analyze, and replay user sessions to optimize conversion rates and user experience.
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                    <a
                      href="/dashboard"
                      className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-3 text-sm font-semibold text-white transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Get started free
                    </a>
                    <a
                      href="#features"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white/80 backdrop-blur-sm px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-white transition duration-300 shadow-lg hover:shadow-xl"
                    >
                      See features
                    </a>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">No credit card required • 14‑day free trial</p>
                </>
              )}
            </div>

            <div className="relative max-w-6xl mx-auto w-full">
              <div className="w-full overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-sm shadow-xl">
                <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
                  <DemoReplay />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 sm:py-20 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Everything you need</h2>
            <p className="mt-3 text-slate-600">
              A streamlined toolkit to launch, validate, and grow—without the bloat.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Session Recording',
                desc: 'Capture every user interaction with pixel-perfect accuracy.',
                iconBg: 'bg-blue-100',
                iconDot: 'bg-blue-500',
              },
              {
                title: 'Real-time Analytics',
                desc: 'Monitor user behavior and conversion patterns instantly.',
                iconBg: 'bg-emerald-100',
                iconDot: 'bg-emerald-500',
              },
              {
                title: 'Bot Detection',
                desc: 'Automatically identify and filter out automated traffic.',
                iconBg: 'bg-amber-100',
                iconDot: 'bg-amber-500',
              },
              {
                title: 'Easy Integration',
                desc: 'One line of code to start recording user sessions.',
                iconBg: 'bg-indigo-100',
                iconDot: 'bg-indigo-500',
              },
              {
                title: 'Privacy Compliant',
                desc: 'GDPR and CCPA compliant data collection.',
                iconBg: 'bg-rose-100',
                iconDot: 'bg-rose-500',
              },
              {
                title: 'Performance Optimized',
                desc: 'Minimal impact on page load times and user experience.',
                iconBg: 'bg-fuchsia-100',
                iconDot: 'bg-fuchsia-500',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`h-12 w-12 rounded-xl ${f.iconBg} flex items-center justify-center`}>
                  <span className={`h-3 w-3 rounded-full ${f.iconDot}`}></span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-800">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <ol className="space-y-6">
                {[
                  { title: 'Install', desc: 'Add our lightweight script to your website with one line of code.' },
                  { title: 'Record', desc: 'Automatically capture user interactions, clicks, and page views.' },
                  { title: 'Analyze', desc: 'Review session replays and identify optimization opportunities.' },
                ].map((step, idx) => (
                  <li key={step.title} className="relative pl-10">
                    <span className="absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-lg">
                      {idx + 1}
                    </span>
                    <h4 className="font-semibold text-slate-800">{step.title}</h4>
                    <p className="text-sm text-slate-600">{step.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="order-1 lg:order-2">
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-sm shadow-xl">
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 flex items-center justify-center">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-600 font-medium">How it works</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing (simple teaser) */}
      <section id="pricing" className="py-16 sm:py-20 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Simple, predictable pricing</h2>
            <p className="mt-3 text-slate-600">Start free and upgrade whenever you're ready.</p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-sm p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-800">Starter</h3>
              <p className="mt-1 text-sm text-slate-600">Everything to get going.</p>
              <div className="mt-4 text-3xl font-bold text-slate-800">$0</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>• 1,000 sessions/month</li>
                <li>• Basic analytics</li>
                <li>• Email support</li>
              </ul>
                {isAuthenticated ? (
              <a
                href="/dashboard"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 px-4 py-2 text-sm font-semibold text-white transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Get started
              </a>
                ):(
                    <button
                        onClick={handleGoogleLogin}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                    >
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Sign in with Google
                    </button>
                )}
            </div>
            <div className="rounded-2xl border border-slate-900 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-xl">
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-1 text-sm text-slate-300">Scale with confidence.</p>
              <div className="mt-4 text-3xl font-bold">To be announced</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-100/90">
                <li>• Unlimited sessions</li>
                <li>• Advanced analytics</li>
                <li>• Priority support</li>
              </ul>
                <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 opacity-60 cursor-not-allowed shadow-lg"
                    title="Coming soon"
                >
                    Coming Soon
                </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-10 text-white shadow-2xl sm:px-10 sm:py-14">
            <div className="grid items-center gap-8 sm:grid-cols-2">
              <div>
                <h3 className="text-2xl font-semibold">
                  {isAuthenticated ? 'Ready to optimize more?' : 'Start recording today'}
                </h3>
                <p className="mt-2 text-slate-300">
                  {isAuthenticated 
                    ? 'Continue analyzing user behavior and improving conversion rates with session replay insights.'
                    : 'Join others who are optimizing their websites with session replay insights.'
                  }
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-3">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Go to Dashboard
                    </Link>
                    <Link to="/createCampaign" className="text-sm text-slate-300 hover:text-white transition-colors">
                      Create New Campaign
                    </Link>
                  </>
                ) : (
                  <>
                    <a
                      href="/dashboard"
                      className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Get started free
                    </a>
                    <a href="#contact" className="text-sm text-slate-300 hover:text-white transition-colors">Have questions? Contact us</a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-slate-200/50 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600"></div>
              <span className="text-sm font-semibold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">lookIns1de</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
            </div>
          </div>
          <p className="mt-6 text-xs text-slate-500">© {new Date().getFullYear()} LookInside. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
