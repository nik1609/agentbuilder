export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#06060f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      boxSizing: 'border-box',
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* Background glows */}
      <div style={{ position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(124,111,240,0.11) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '10%', left: '8%', width: 400, height: 400, background: 'radial-gradient(ellipse, rgba(34,215,154,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '20%', right: '5%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(176,128,248,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}
