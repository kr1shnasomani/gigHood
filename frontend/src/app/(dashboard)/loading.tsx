export default function WorkerDashboardLoading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <div style={{
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(15,23,42,0.55)',
        color: '#CBD5E1',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 13,
      }}>
        Loading worker app...
      </div>
    </div>
  );
}
