
import { useEffect, useRef, useState } from 'react';
import 'rrweb-player/dist/style.css';
import rrwebPlayer from 'rrweb-player';

import { API_BASE, API_ENDPOINTS } from '../config';

const DemoReplay: React.FC = () => {
    const containerRef = useRef<HTMLDivElement | null>(null); // sizing container (we control height here)
    const playerHostRef = useRef<HTMLDivElement | null>(null); // rrweb-player mounts here
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [meta, setMeta] = useState<{ w: number; h: number } | null>(null);
    const [scale, setScale] = useState<number>(1);
    const [playerInstance, setPlayerInstance] = useState<any>(null);

    useEffect(() => {
        let disposed = false;
        let resizeObserver: ResizeObserver | null = null;

        const load = async () => {
            try {
                // Basic mobile detection (viewport width or user agent fallback)
                const isMobile =
                    (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) ||
                    (typeof navigator !== 'undefined' &&
                        /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent));

                // Fetch demo replay events
                const url = new URL(`${API_BASE}${API_ENDPOINTS.CAMPAIGN.REPLAY_DEMO}`);
                url.searchParams.set('isMobile', String(!!isMobile));

                const res = await fetch(url.toString(), {
                    credentials: 'include',
                });
                if (!res.ok) throw new Error(`Failed to fetch demo replay (${res.status})`);
                const data = await res.json();

                const events = Array.isArray(data) ? data : (data?.data ?? []);
                if (!events.length) throw new Error('No demo events available');

                if (disposed || !containerRef.current || !playerHostRef.current) return;

                // Extract recording native size from Meta event (fallback to 1366x768)
                const metaEvt = events.find((e: any) => e?.type === 4 && e?.data && (e.data.width || e.data.height));
                const nativeW = Math.max(1, Number(metaEvt?.data?.width) || 1366);
                const nativeH = Math.max(1, Number(metaEvt?.data?.height) || 768);
                
                // Add space for rrweb-player controls (typically around 60-80px for the control bar)
                const controllerHeight = 70; // Adjust this value based on your needs
                const totalNativeH = nativeH + controllerHeight;
                
                setMeta({ w: nativeW, h: totalNativeH });

                // Clear previous content if any
                playerHostRef.current.innerHTML = '';

                // Clean up previous player instance
                if (playerInstance) {
                    try {
                        playerInstance.destroy?.();
                    } catch (e) {
                        console.warn('Failed to destroy previous player:', e);
                    }
                }

                // Transform events to rrweb format if needed
                const rrwebEvents = events.map((event: any) => ({
                    type: event.type,
                    data: event.data,
                    timestamp: event.timestamp
                }));

                // Mount rrweb-player at its native resolution; we will scale it to fit width
                const newPlayerInstance = new rrwebPlayer({
                    target: playerHostRef.current,
                    props: {
                        events: rrwebEvents,
                        autoPlay: false,
                        showController: true,
                        width: nativeW,
                        height: nativeH,
                        speedOption: [0.5, 1, 2, 4, 8],
                    },
                });

                setPlayerInstance(newPlayerInstance);

                // Compute initial scale and set container height to make parent grow if needed
                const recompute = () => {
                    if (!containerRef.current) return;
                    const cw = containerRef.current.clientWidth || 1;
                    const s = cw / nativeW;
                    setScale(s);
                    // Make the container as tall as the scaled player + controls; this lets the parent grow
                    const scaledH = Math.round(totalNativeH * s);
                    containerRef.current.style.height = `${scaledH}px`;
                };
                recompute();

                // Observe size changes to keep it responsive
                resizeObserver = new ResizeObserver(recompute);
                resizeObserver.observe(containerRef.current);
            } catch (e: any) {
                console.error('Failed to load demo replay:', e);
                if (!disposed) setErr(e?.message || 'Failed to load demo');
            } finally {
                if (!disposed) setLoading(false);
            }
        };

        load();

        return () => {
            disposed = true;
            // Best-effort cleanup
            if (resizeObserver && containerRef.current) {
                try { resizeObserver.disconnect(); } catch {}
            }
            if (playerInstance) {
                try {
                    playerInstance.destroy?.();
                } catch {}
            }
            if (playerHostRef.current) {
                try { playerHostRef.current.innerHTML = ''; } catch {}
            }
        };
    }, []);

    if (err) {
        return (
            <div className="h-full w-full flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="text-sm font-semibold text-rose-600">Couldn't load demo</div>
                    <div className="text-xs text-slate-500 mt-1">{err}</div>
                </div>
            </div>
        );
    }

    return (
        <>
            {loading && (
                <div className="w-full flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 animate-pulse" />
                        <p className="text-slate-600 font-medium">Loading demo replay…</p>
                    </div>
                </div>
            )}
            <div
                ref={containerRef}
                className="w-full relative"
                style={{
                    // height is managed dynamically after load to let parent expand
                    // fallback height for SSR or before meta is known:
                    height: !meta ? undefined : undefined,
                }}
            >
                <div
                    // This shell scales the player to fit the parent's width
                    className="absolute top-0 left-0 origin-top-left"
                    style={{
                        transform: `scale(${scale})`,
                        width: meta ? `${meta.w}px` : undefined,
                        height: meta ? `${meta.h}px` : undefined,
                    }}
                >
                    <div ref={playerHostRef} />
                </div>
            </div>
        </>
    );
};

export default DemoReplay;