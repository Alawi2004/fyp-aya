export const formatCurrency = (amount, currency = 'USD') => `${currency} ${parseFloat(amount || 0).toFixed(2)}`;
export const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
export const formatDateTime = (date) => `${formatDate(date)} · ${formatTime(date)}`;
export const formatDuration = (mins) => mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
export const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
};