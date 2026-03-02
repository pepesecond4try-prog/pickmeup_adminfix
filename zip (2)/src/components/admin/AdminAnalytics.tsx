import React, { useState, useEffect } from 'react';
import { Activity, LogIn, UserPlus, Ticket, MapPin, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

export default function AdminAnalytics() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select(`
          *,
          users (display_name, emoji, accent_color),
          sessions (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (fetchError) throw fetchError;
      if (data) setEvents(data);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError(err.message || 'Failed to load activity feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    if (!supabase) return;
    const subscription = supabase
      .channel('public:events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login_success': return <LogIn size={16} className="text-green-500" />;
      case 'login_failed': return <LogIn size={16} className="text-red-500" />;
      case 'user_created':
      case 'user_updated': return <UserPlus size={16} className="text-blue-500" />;
      case 'session_created': return <Activity size={16} className="text-purple-500" />;
      case 'pickup_requested': return <MapPin size={16} className="text-yellow-500" />;
      case 'ticket_reset':
      case 'bulk_tickets_reset': return <Ticket size={16} className="text-orange-500" />;
      default: return <Activity size={16} className="text-neutral-500" />;
    }
  };

  const formatEventMessage = (event: any) => {
    const user = event.users ? `${event.users.emoji || '👤'} ${event.users.display_name}` : 'System/Unknown';
    const session = event.sessions ? ` in ${event.sessions.name}` : '';
    
    switch (event.event_type) {
      case 'login_success': return `${user} logged in`;
      case 'login_failed': return `Failed login attempt (IP: ${event.metadata?.ip || 'unknown'})`;
      case 'user_created': return `${user} created a new passenger`;
      case 'user_updated': return `${user} updated a passenger profile`;
      case 'session_created': return `${user} created session ${event.sessions?.name || ''}`;
      case 'pickup_requested': return `${user} requested a pickup${session}`;
      case 'ticket_reset': return `${user} reset a ticket`;
      case 'bulk_tickets_reset': return `${user} bulk reset tickets${session}`;
      default: return `${user} performed ${event.event_type}`;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Activity Feed</h2>
        <button 
          onClick={fetchEvents}
          className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Error loading activity</span>
            <span className="text-xs opacity-80">{error}</span>
          </div>
        </div>
      )}

      {loading && events.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-neutral-500" size={24} />
        </div>
      ) : events.length === 0 && !error ? (
        <div className="text-center text-neutral-500 py-10 text-sm">
          No recent activity.
        </div>
      ) : (
        <div className="flex flex-col gap-0 relative before:absolute before:inset-y-0 before:left-6 before:w-px before:bg-neutral-800">
          {events.map((event, index) => (
            <div key={event.id} className="relative flex items-start gap-4 py-4 group">
              <div className="absolute left-6 top-6 w-4 h-px bg-neutral-800"></div>
              <div className="relative z-10 size-12 rounded-full bg-black border border-neutral-800 flex items-center justify-center shrink-0 group-hover:border-neutral-600 transition-colors">
                {getEventIcon(event.event_type)}
              </div>
              <div className="flex flex-col pt-1.5">
                <p className="text-sm text-white font-medium">
                  {formatEventMessage(event)}
                </p>
                <span className="text-xs text-neutral-500 mt-1">
                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
